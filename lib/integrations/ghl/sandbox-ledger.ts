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

export type ManifestEntry =
  | { t: "start"; runId: string; locationId: string; pipelineId: string; stageId: string; gitSha: string; scope: string; at: string }
  | { t: "snapshot"; phase: "pre" | "post"; total: number; ids: string[] }
  | { t: "intent"; kind: "contact"; email: string }
  | { t: "intent"; kind: "opportunity"; contactId: string }
  | { t: "created"; kind: "contact"; id: string; email: string; recovered?: boolean }
  | { t: "created"; kind: "opportunity"; id: string; contactId: string; recovered?: boolean }
  | { t: "deleted"; kind: RecordKind; id: string }
  | { t: "delete_failed"; kind: RecordKind; id: string; reason: string }
  | { t: "verified_absent"; kind: RecordKind; id: string }
  | { t: "stopped"; reason: string }
  | { t: "end"; ok: boolean; at: string };

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

/**
 * File manifest. `create: true` makes a new file and refuses if it exists (a
 * new run never reuses an id); `create: false` appends to an existing one
 * (reconcile).
 */
export async function openFileManifest(dir: string, runId: string, opts: { create: boolean }): Promise<RunManifest> {
  const file = manifestPath(dir, runId);
  if (opts.create) {
    await fs.mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
    if (process.platform !== "win32") await fs.chmod(path.dirname(file), 0o700);
  }
  const handle = await fs.open(file, opts.create ? "ax" : "r+", 0o600);
  await handle.close();
  let queue: Promise<void> = Promise.resolve();
  return {
    path: file,
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
