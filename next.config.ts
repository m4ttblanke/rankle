import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // `next dev` otherwise appends a managed block to this repo's CLAUDE.md.
  // The Next.js 16 upgrade notes still live in node_modules/next/dist/docs/.
  agentRules: false,

  // Item imagery is served from Supabase Storage. Widen this list when the
  // production storage hostname is known (docs/DEPLOY.md sec 11).
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

export default nextConfig;
