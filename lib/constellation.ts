/**
 * Constellation scene kill switch — production escape hatch.
 *
 * NEXT_PUBLIC_CONSTELLATION_MODE=interactive  (default) WebGL scene with
 *                                             automatic fallbacks
 * NEXT_PUBLIC_CONSTELLATION_MODE=static       always render the static SVG
 *                                             constellation (zero WebGL)
 *
 * "interactive" still degrades gracefully per-device; "static" is the
 * explicit override for launch-day emergencies.
 */

export type ConstellationMode = "interactive" | "static";

export const CONSTELLATION_MODE: ConstellationMode =
  process.env.NEXT_PUBLIC_CONSTELLATION_MODE === "static"
    ? "static"
    : "interactive";
