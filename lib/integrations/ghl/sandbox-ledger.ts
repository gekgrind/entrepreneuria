/**
 * Durable run manifest for the GHL sandbox write test (owner condition 5).
 *
 * One append-only JSON-lines file per run. Every entry is written and
 * fsynced before the step it describes continues, so a crash at any point
 * leaves enough to find and remove what the run created:
 *   - `intent` is written BEFORE each create, so a create whose response is
 *     lost (or a crash before `created`) can still be found by its synthetic
 *     email or contact id;
 *   - `created` holds every confirmed contact and opportunity id.
 *
 * Contents: ids, synthetic emails and counts only. Never the token, never a
 * pre-existing contact's details (snapshots hold ids only).
 * The file is private: directory 0700, file 0600, kept out of Git.
 */
import { promises as fs } from "node:fs";
import path from "node:path";

export type RecordKind = "contact" | "opportunity";

/**
 * Journal format version. Version 2 journals write `delete_intent` before every
 * DELETE and `created … recovered` only with run-specific proof. Older journals
 * (no version) get read-only verification: nothing in them is deleted.
 */
export const JOURNAL_VERSION = 2;

export interface VerifyCounts {
  absent: number;
  present: number;
  unknown: number;
}

export type ManifestEntry =
  | { t: "start"; runId: string; locationId: string; pipelineId: string; stageId: string; gitSha: string; scope: string; at: string; journalVersion?: number }
  | { t: "snapshot"; phase: "pre" | "post"; total: number; ids: string[] }
  | { t: "intent"; kind: "contact"; email: string }
  | { t: "intent"; kind: "opportunity"; contactId: string; name?: string }
  | { t: "create_rejected"; kind: "contact"; email: string; status: number }
  | { t: "create_rejected"; kind: "opportunity"; contactId: string; status: number }
  | { t: "unresolved"; kind: RecordKind; ref: string; reason: string }
  | { t: "unowned_match"; kind: "contact"; email: string; id: string }
  | { t: "delete_intent"; kind: RecordKind; id: string }
  | { t: "created"; kind: "contact"; id: string; email: string; recovered?: boolean }
  | { t: "created"; kind: "opportunity"; id: string; contactId: string; recovered?: boolean }
  | { t: "deleted"; kind: RecordKind; id: string }
  | { t: "delete_failed"; kind: RecordKind; id: string; reason: string }
  | { t: "verified_absent"; kind: RecordKind; id: string }
  | { t: "verify_record"; kind: RecordKind; id: string; attempt: number; of: number; state: "absent" | "present" | "unknown" }
  | {
      t: "verify_attempt";
      attempt: number;
      of: number;
      verdict: "verified" | "waiting";
      contacts: VerifyCounts;
      opportunities: VerifyCounts;
      /** Opportunities the search still lists on run contacts; null when the search was unreadable. */
      searchRemaining: number | null;
      /** Ids only; null when the list was unreadable or there is no baseline. */
      list: { total: number; runIds: string[]; missingBaseline: string[]; foreign: string[] } | null;
    }
  | { t: "stopped"; reason: string }
  | { t: "end"; ok: boolean; at: string; cleanupState?: "verified" | "pending_consistency" | "failed"; unproven?: string[] };

export interface RunManifest {
  readonly path: string;
  append(entry: ManifestEntry): Promise<void>;
  entries(): Promise<ManifestEntry[]>;
}

export const RUN_ID = /^[a-zA-Z0-9-]{1,64}$/;

export function manifestPath(dir: string, runId: string): string {
  if (!RUN_ID.test(runId)) throw new Error("invalid sandbox run id");
  return path.join(path.resolve(dir), `${runId}.jsonl`);
}

/** Parses a manifest. A torn final line (crash mid-write) is ignored; any other bad line is an error. */
export function parseManifest(text: string): ManifestEntry[] {
  const lines = text.split("\n");
  const out: ManifestEntry[] = [];
  lines.forEach((line, i) => {
    if (!line.trim()) return;
    try {
      out.push(JSON.parse(line) as ManifestEntry);
    } catch {
      if (i !== lines.length - 1) throw new Error(`manifest line ${i + 1} is unreadable`);
    }
  });
  return out;
}

export interface JournalRepair {
  /** The damaged original, kept unchanged. */
  backup: string;
  /** "completed": the last record was whole but had no newline. "truncated": a partial last record was cut off. */
  action: "completed" | "truncated";
  droppedBytes: number;
}

async function fsyncDir(dir: string) {
  if (process.platform === "win32") return; // directories can't be opened for fsync on Windows
  const h = await fs.open(dir, "r");
  try {
    await h.sync();
  } finally {
    await h.close();
  }
}

/**
 * Makes an existing journal safe to append to after a crash. Every line but
 * the last must parse, or the journal is refused untouched. A last line with
 * no newline is either completed (it parses) or cut off (it doesn't). Either
 * way the damaged original is first copied to a backup beside it, fsynced.
 */
async function repairTail(file: string): Promise<JournalRepair | null> {
  const text = await fs.readFile(file, "utf8");
  const cut = text.lastIndexOf("\n") + 1;
  parseManifest(text.slice(0, cut)); // throws on any damaged complete line, before anything is changed
  const tail = text.slice(cut);
  if (!tail) return null;
  let whole = false;
  try {
    JSON.parse(tail);
    whole = true;
  } catch {
    whole = false;
  }
  const backup = `${file}.damaged-${Date.now()}`;
  const b = await fs.open(backup, "wx", 0o600);
  try {
    await b.writeFile(text);
    await b.sync();
  } finally {
    await b.close();
  }
  const h = await fs.open(file, "r+");
  try {
    if (whole) {
      await h.write("\n", Buffer.byteLength(text));
    } else {
      await h.truncate(Buffer.byteLength(text.slice(0, cut)));
    }
    await h.sync();
  } finally {
    await h.close();
  }
  await fsyncDir(path.dirname(file));
  return { backup, action: whole ? "completed" : "truncated", droppedBytes: whole ? 0 : Buffer.byteLength(tail) };
}

/**
 * File manifest. `create: true` makes a new file and refuses if it exists (a
 * new run never reuses an id); `create: false` appends to an existing one
 * (reconcile), first repairing a torn last line (see `repairTail`).
 */
export async function openFileManifest(dir: string, runId: string, opts: { create: boolean }): Promise<RunManifest & { repaired: JournalRepair | null }> {
  const file = manifestPath(dir, runId);
  if (opts.create) {
    await fs.mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
    if (process.platform !== "win32") await fs.chmod(path.dirname(file), 0o700);
  }
  const handle = await fs.open(file, opts.create ? "ax" : "r+", 0o600);
  await handle.close();
  const repaired = opts.create ? null : await repairTail(file);
  let queue: Promise<void> = Promise.resolve();
  return {
    path: file,
    repaired,
    append(entry) {
      const run = queue.then(async () => {
        const h = await fs.open(file, "a", 0o600);
        try {
          await h.appendFile(`${JSON.stringify(entry)}\n`);
          await h.sync();
        } finally {
          await h.close();
        }
      });
      queue = run.catch(() => {});
      return run;
    },
    async entries() {
      return parseManifest(await fs.readFile(file, "utf8"));
    },
  };
}

/** In-memory manifest for tests. `failOn` makes the append of the first matching entry throw, like a crash. */
export function createMemoryManifest(
  initial: ManifestEntry[] = []
): RunManifest & { log: ManifestEntry[]; failOn: ((e: ManifestEntry) => boolean) | null } {
  const m = {
    path: "memory",
    log: [...initial],
    failOn: null as ((e: ManifestEntry) => boolean) | null,
    async append(entry: ManifestEntry) {
      if (m.failOn?.(entry)) {
        m.failOn = null;
        throw new Error("simulated crash while writing the manifest");
      }
      m.log.push(structuredClone(entry));
    },
    async entries() {
      return structuredClone(m.log);
    },
  };
  return m;
}
