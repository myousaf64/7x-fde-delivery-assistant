import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // The optimizer fetches source images over HTTP from this same app, and that
    // internal request carries no basic-auth credentials, so the demo gate in
    // src/middleware.ts answers 401 and the logo fails to render on the hosted
    // demo. Serving the files as they are avoids the round trip. They are 50 to
    // 62 KB, so optimizing them buys nothing.
    unoptimized: true,
  },
};

export default nextConfig;
