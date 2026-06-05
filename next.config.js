/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable src/instrumentation.js (process-level error handlers). Required on Next 14.
  experimental: {
    instrumentationHook: true,
  },
  // Map AUTH_URL to NEXTAUTH_URL for NextAuth v4 compatibility
  env: {
    NEXTAUTH_URL: process.env.AUTH_URL || process.env.NEXTAUTH_URL,
    NEXTAUTH_SECRET: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      }
    }
    return config
  },
}

module.exports = nextConfig
