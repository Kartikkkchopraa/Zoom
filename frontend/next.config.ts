import type { NextConfig } from "next";

const backendUrl = process.env.BACKEND_URL ?? "http://localhost:8000";

const nextConfig: NextConfig = {
  devIndicators: false,
  // Pin the project root (a stray lockfile higher up would otherwise be picked).
  outputFileTracingRoot: __dirname,
  // Proxy REST calls to FastAPI so the browser only ever talks to one origin
  // (no CORS preflights, and auth cookies stay first-party).
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${backendUrl}/api/:path*` }];
  },
};

export default nextConfig;
