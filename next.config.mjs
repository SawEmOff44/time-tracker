/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: {
    // Don't block builds on ESLint errors in prod
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Don't block builds on TS errors in prod
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
