import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  experimental: {
    useTypeScriptCli: false,
    workerThreads: true,
  },
};

export default nextConfig;
