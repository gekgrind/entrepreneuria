/**
 * Preview intake capacity: a paused switch and a configurable limit on open
 * preview requests.
 *
 * This protects the owner's workload; it is not a security control. There is
 * no database in leads mode, so the open count comes from GHL (open
 * opportunities in the intake pipeline, via the adapter). An in-process
 * counter alone would reset on every restart.
 *
 *  - paused: refuse, without calling GHL.
 *  - open: refuse when the open count has reached the limit.
 *  - count unavailable: ACCEPT and raise an alert. Losing a lead is worse
 *    than slightly exceeding the limit (owner design, 2026-11-08).
 *  - level: tells the owner BEFORE intake is exhausted (owner, 2026-11-09).
 *    "near" when the known open count reaches limit - 1 (limits of 2+),
 *    "full" when it reaches the limit or a request is refused as full.
 *    The alerter deduplicates, so repeated signals send one alert per window.
 *
 * The count is cached briefly to spare GHL rate limits, and accepted
 * requests are counted optimistically until the next refresh, so a burst
 * cannot far exceed the limit. Counting is still approximate: concurrent
 * requests across a refresh can pass the limit slightly. A returning
 * contact who already has an open request counts as one of the open ones.
 */
export type Admission = { allowed: true } | { allowed: false; reason: "paused" | "full" };

export function createAdmission(opts: {
  intake: "open" | "paused";
  maxOpen: number;
  count: () => Promise<number>;
  onCountUnavailable: () => void;
  /** Capacity level signal; `open` is the known open count, `max` the limit. */
  onLevel?: (level: "near" | "full", open: number, max: number) => void;
  cacheMs?: number;
  now?: () => number;
}): () => Promise<Admission> {
  const cacheMs = opts.cacheMs ?? 30_000;
  const now = opts.now ?? Date.now;
  let cached: { value: number; at: number } | null = null;
  let optimistic = 0;

  const report = (open: number) => {
    if (!opts.onLevel) return;
    if (open >= opts.maxOpen) opts.onLevel("full", open, opts.maxOpen);
    else if (opts.maxOpen >= 2 && open >= opts.maxOpen - 1) opts.onLevel("near", open, opts.maxOpen);
  };

  return async function admit(): Promise<Admission> {
    if (opts.intake === "paused") return { allowed: false, reason: "paused" };

    const t = now();
    if (!cached || t - cached.at >= cacheMs) {
      try {
        const value = await opts.count();
        if (!Number.isInteger(value) || value < 0) throw new Error("invalid count");
        cached = { value, at: t };
        optimistic = 0;
      } catch {
        opts.onCountUnavailable();
        return { allowed: true };
      }
    }
    if (cached.value + optimistic >= opts.maxOpen) {
      report(cached.value + optimistic);
      return { allowed: false, reason: "full" };
    }
    optimistic += 1;
    report(cached.value + optimistic);
    return { allowed: true };
  };
}
