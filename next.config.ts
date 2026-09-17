import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Production-readiness remediation (§10): the previous
  // `typescript.ignoreBuildErrors: true` override is REMOVED — production
  // builds now fail on real TypeScript errors. `bunx tsc --noEmit` is clean
  // for product code; scaffold/demo folders (examples/, skills/) are
  // excluded from typecheck via tsconfig.
  reactStrictMode: false,
};

export default nextConfig;
