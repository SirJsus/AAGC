const path = require("path");

/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir: process.env.NEXT_DIST_DIR || ".next",
  output: process.env.NEXT_OUTPUT_MODE,
  experimental: {
    // outputFileTracingRoot is useful in monorepos to trace files from the
    // workspace root. However, setting it unconditionally can cause incorrect
    // traced paths on Vercel (e.g. duplicated `/vercel/path0/path0/...`).
    //
    // Only enable this option when not running on Vercel. If you need to set
    // a custom tracing root for a monorepo, set the environment variable
    // `ENABLE_OUTPUT_TRACING_ROOT=1` in your local environment or CI and
    // configure accordingly.
    ...(process.env.VERCEL
      ? {}
      : { outputFileTracingRoot: path.join(__dirname, "../") }),
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  images: { unoptimized: true },
};

module.exports = nextConfig;
