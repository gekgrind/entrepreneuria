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

/**
 * `reserve: false` answers the same question without taking a slot or
 * raising a level alert. Requests that never become a new lead (returning
 * contacts, failed lookups) use it so their response matches what a new lead
 * would get, without consuming capacity.
 */
export type AdmitFn = (opts?: { reserve?: boolean }) => Promise<Admission>;

export function createAdmission(opts: {
  intake: "open" | "paused";
  maxOpen: number;
  count: () => Promise<number>;
  onCountUnavailable: () => void;
  /** Capacity level signal; `open` is the known open count, `max` the limit. */
  onLevel?: (level: "near" | "full", open: number, max: number) => void;
  cacheMs?: number;
  now?: () => number;
}): AdmitFn {
  const cacheMs = opts.cacheMs ?? 30_000;
  const now = opts.now ?? Date.now;
  let cached: { value: number; at: number } | null = null;
  let optimistic = 0;

  const report = (open: number) => {
    if (!opts.onLevel) return;
    if (open >= opts.maxOpen) opts.onLevel("full", open, opts.maxOpen);
    else if (opts.maxOpen >= 2 && open >= opts.maxOpen - 1) opts.onLevel("near", open, opts.maxOpen);
  };

  return async function admit({ reserve = true } = {}): Promise<Admission> {
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
      if (reserve) report(cached.value + optimistic);
      return { allowed: false, reason: "full" };
    }
    if (!reserve) return { allowed: true };
    optimistic += 1;
    report(cached.value + optimistic);
    return { allowed: true };
  };
}
