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

  // rankle.io is canonical (docs/DEPLOY.md sec 25). www.rankle.io -> rankle.io
  // is handled by Vercel's own domain-level redirect (Project Settings ->
  // Domains), not here — do not duplicate it with an app-level rule, that
  // combination caused a live redirect loop in production on 2026-09-14
  // (docs/TODO.md). Vercel has no equivalent domain-level redirect for its
  // own auto-issued `rankle-theta.vercel.app` alias, so that one redirects
  // here at the framework level instead — preserves path/query
  // automatically, never matches the apex itself so it can't loop.
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "rankle-theta.vercel.app" }],
        destination: "https://rankle.io/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
