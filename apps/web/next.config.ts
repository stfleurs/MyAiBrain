import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@pam/shared", "@pam/database"],
  output: "standalone",
};

export default nextConfig;
