/**
 * Durable, access-controlled record of inquiries that need manual review
 * (owner decision, 2026-11-09): returning GoHighLevel contacts, any
 * inquiry whose contact lookup failed or was ambiguous, and new leads whose
 * CRM delivery failed. The app never retries these into the CRM; this store
 * is their only complete record.
 *
 * Storage: one JSON file per inquiry in WEBSITES_REVIEW_DIR on the app
 * server (outside the web root and the release directories, so it survives
 * deploys). Directory 0700, files 0600, owned by the app's user. No HTTP
 * endpoint reads it; review happens over SSH with
 * scripts/websites-review.mts.
 *
 * Guarantees:
 *   - save() resolves only after the record is fsynced and linked into
 *     place, so a success response is never sent for an inquiry that isn't
 *     on disk. If it throws, the visitor gets a retryable error.
 *   - Exclusive create by reference (link(2) fails if it exists), so a
 *     retried or concurrent identical submission yields one record.
 *   - Updates (notified, resolved) replace the file atomically (rename).
 *   - References are validated, so a reference can never escape the
 *     directory.
 */
import { randomBytes } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

import type { InquiryFields } from "./inquiry-schema";

export type ReviewReason = "existing_contact" | "matched_on_upsert" | "lookup_failed" | "delivery_failed" | "manual_intake";

export interface ReviewRecord {
  /** Opaque reference: safe to put in a notification. "r-" + 16 hex. */
  ref: string;
  reason: ReviewReason;
  crm_contact_id: string | null;
  received_at: string;
  notified_at: string | null;
  resolved_at: string | null;
  submission: {
    idempotency_key: string;
    fields: InquiryFields;
    consent: Record<string, unknown>;
    page_url: string;
    utm: Record<string, string> | null;
    pricing_version: string;
  };
}

export interface ReviewStore {
  /** Durable before it resolves. `created: false` when the reference already exists. */
  save(record: ReviewRecord): Promise<{ created: boolean; record: ReviewRecord }>;
  get(ref: string): Promise<ReviewRecord | null>;
  list(): Promise<ReviewRecord[]>;
  markNotified(ref: string, at: string): Promise<void>;
  markResolved(ref: string, at: string): Promise<void>;
}

export const REVIEW_REF = /^r-[0-9a-f]{16}$/;

function assertRef(ref: string) {
  if (!REVIEW_REF.test(ref)) throw new Error("invalid review reference");
}

export function createFileReviewStore(dir: string): ReviewStore {
  if (!path.isAbsolute(dir)) throw new Error("review directory must be an absolute path");
  const file = (ref: string) => path.join(dir, `${ref}.json`);
  let ready: Promise<void> | null = null;
  const ensureDir = () =>
    (ready ??= fs.mkdir(dir, { recursive: true, mode: 0o700 }).then(async () => {
      await fs.chmod(dir, 0o700);
    }));

  async function fsyncDir() {
    // Windows cannot open a directory handle for fsync (EPERM); NTFS journals
    // the link/rename metadata itself. Production runs on Linux, where a
    // failed directory fsync still throws and the visitor gets a retryable error.
    if (process.platform === "win32") return;
    const h = await fs.open(dir, "r");
    try {
      await h.sync();
    } finally {
      await h.close();
    }
  }

  async function writeTemp(record: ReviewRecord): Promise<string> {
    const tmp = path.join(dir, `.tmp-${record.ref}-${randomBytes(6).toString("hex")}`);
    const h = await fs.open(tmp, "wx", 0o600);
    try {
      await h.writeFile(JSON.stringify(record, null, 2));
      await h.sync();
    } finally {
      await h.close();
    }
    return tmp;
  }

  async function read(ref: string): Promise<ReviewRecord | null> {
    try {
      return JSON.parse(await fs.readFile(file(ref), "utf8")) as ReviewRecord;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw err;
    }
  }

  async function update(ref: string, patch: Partial<ReviewRecord>) {
    assertRef(ref);
    await ensureDir();
    const current = await read(ref);
    if (!current) throw new Error("review record not found");
    const tmp = await writeTemp({ ...current, ...patch, ref });
    await fs.rename(tmp, file(ref));
    await fsyncDir();
  }

  return {
    async save(record) {
      assertRef(record.ref);
      await ensureDir();
      const tmp = await writeTemp(record);
      try {
        await fs.link(tmp, file(record.ref));
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code !== "EEXIST") throw err;
        const existing = await read(record.ref);
        if (!existing) throw err;
        await fsyncDir();
        return { created: false, record: existing };
      } finally {
        await fs.unlink(tmp).catch(() => {});
      }
      await fsyncDir();
      return { created: true, record };
    },
    async get(ref) {
      assertRef(ref);
      return read(ref);
    },
    async list() {
      await ensureDir();
      const names = (await fs.readdir(dir)).filter((n) => REVIEW_REF.test(n.replace(/\.json$/, "")) && n.endsWith(".json"));
      const out: ReviewRecord[] = [];
      for (const n of names) {
        const r = await read(n.slice(0, -5));
        if (r) out.push(r);
      }
      return out.sort((a, b) => a.received_at.localeCompare(b.received_at));
    },
    markNotified: (ref, at) => update(ref, { notified_at: at }),
    markResolved: (ref, at) => update(ref, { resolved_at: at }),
  };
}

/** In-memory store with the same semantics, for tests. */
export function createMemoryReviewStore(): ReviewStore & { failSave: boolean } {
  const m = new Map<string, ReviewRecord>();
  const store = {
    failSave: false,
    async save(record: ReviewRecord) {
      if (store.failSave) throw new Error("disk full");
      assertRef(record.ref);
      const existing = m.get(record.ref);
      if (existing) return { created: false, record: structuredClone(existing) };
      m.set(record.ref, structuredClone(record));
      return { created: true, record };
    },
    async get(ref: string) {
      const r = m.get(ref);
      return r ? structuredClone(r) : null;
    },
    async list() {
      return [...m.values()].map((r) => structuredClone(r)).sort((a, b) => a.received_at.localeCompare(b.received_at));
    },
    async markNotified(ref: string, at: string) {
      const r = m.get(ref);
      if (r) r.notified_at = at;
    },
    async markResolved(ref: string, at: string) {
      const r = m.get(ref);
      if (r) r.resolved_at = at;
    },
  };
  return store;
}
