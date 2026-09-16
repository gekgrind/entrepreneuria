/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    // Build fails on type errors, as it should. Verified green:
    // `npm run typecheck` (tsc --noEmit) passes across the repo.
    ignoreBuildErrors: false,
  },
  images: {
    // Next image optimizer enabled (sharp is pinned via package overrides).
    unoptimized: false,
  },
  allowedDevOrigins: ["192.168.12.105", "localhost"],

  /**
   * Resources IA cleanup.
   *
   * Two kinds of redirect, and the distinction is deliberate:
   *
   *   permanent (308) — the page still exists, at a better URL. The Launch
   *     Pad wrapper segment is gone, so the two live destinations moved up to
   *     the top level. Safe to cache forever.
   *
   *   temporary (307) — the page was retired to `app/_archive` and is expected
   *     to come back. A 308 would be cached by browsers and crawlers and make
   *     restoration a fight, so these stay temporary on purpose.
   */
  async redirects() {
    return [
      // — Moved: the live Resources destinations —
      {
        source: "/launch-pad/tools",
        destination: "/tools",
        permanent: true,
      },
      {
        source: "/launch-pad/tools/:slug",
        destination: "/tools/:slug",
        permanent: true,
      },
      {
        source: "/launch-pad/resources",
        destination: "/library",
        permanent: true,
      },

      // — Retired: archived, routed to the nearest live intent —
      {
        // The hub's own primary CTA was "Open the free tools".
        source: "/launch-pad",
        destination: "/tools",
        permanent: false,
      },
      {
        // Founder reading material → the closest surviving reference shelf.
        source: "/launch-pad/blog",
        destination: "/library",
        permanent: false,
      },
      {
        source: "/launch-pad/blog/:slug",
        destination: "/library",
        permanent: false,
      },
      {
        // The Founder's Table always pointed at the waitlist for its opening.
        source: "/launch-pad/community",
        destination: "/waitlist",
        permanent: false,
      },
      {
        source: "/exchange",
        destination: "/",
        permanent: false,
      },
      {
        source: "/exchange/:slug",
        destination: "/",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
