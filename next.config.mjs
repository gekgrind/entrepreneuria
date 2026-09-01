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
};

export default nextConfig;
