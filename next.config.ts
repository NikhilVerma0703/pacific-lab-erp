import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Uploads go through /api/uploads, so actions only carry form JSON.
      bodySizeLimit: "2mb",
    },
  },
};

export default nextConfig;
