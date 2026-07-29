import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep Turbopack rooted on this example, not the monorepo lockfile above.
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
