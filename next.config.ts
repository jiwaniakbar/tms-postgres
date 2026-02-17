import type { NextConfig } from "next";

const nextConfig = {
  /* config options here */

  typescript: {
    ignoreBuildErrors: true,
  },
  output: "standalone",
  experimental: {
    instrumentationHook: true,
  },
};

export default nextConfig;
