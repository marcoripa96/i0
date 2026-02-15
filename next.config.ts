import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@libsql/client", "better-auth"],
  cacheComponents: true,
};

export default nextConfig;
