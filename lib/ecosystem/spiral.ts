/**
 * Spiral-arm geometry of the galactic disk — the ONE shared truth for
 * every rendering of the ecosystem illustration:
 *
 *   - the interactive journey galaxy (components/journey/world —
 *     particle arm dust in ecosystem-shapes / ParticleField)
 *   - the static, non-interactive SVG (ConstellationStatic — the
 *     reduced-motion / no-WebGL / narrative image, top AND bottom of
 *     the page)
 *
 * Both draw the SAME two trailing arms around the founder core, so the
 * interactive and the still ecosystem always read as one image.
 *
 * Radii are in local galaxy units; the viewBox helper maps them into
 * the 1000×1000 constellation space of lib/ecosystem/orbits.
 */

/** World half-extent of the constellation in local galaxy units. */
export const GALAXY_WORLD = 2.6;

export const SPIRAL_ARM = {
  /** two-arm grand-design spiral (matches the reference illustration) */
  count: 2,
  /** arm roots start just outside the founder core's particle halo */
  rMin: 0.5,
  /** tips feather out just past the outermost product ring (tier 3 = 2.34) */
  rMax: 2.7,
  /** radians of wind per galaxy unit of radius; arms TRAIL the disk spin */
  swirl: 1.35,
} as const;

/** Galaxy units → constellation viewBox units (center at 500). */
export const GALAXY_TO_VIEWBOX = 500 / GALAXY_WORLD;
