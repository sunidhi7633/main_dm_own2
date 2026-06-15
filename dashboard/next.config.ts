import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  async redirects() {
    return [
      // Fix browser-history typo: /l/* → /*
      {
        source: "/l/:path*",
        destination: "/:path*",
        permanent: false,
      },
      // Review Queue merged into Competitor Intel
      {
        source: "/review",
        destination: "/competitor-intel/generated",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
