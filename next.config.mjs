/** @type {import('next').NextConfig} */
const nextConfig = {
 
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
}

/** @type {import('next').NextConfig} */
const NextConfig = {
  allowedDevOrigins: ["192.168.12.105", "localhost"],
};

export default nextConfig
