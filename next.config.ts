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

  // rankle.io is canonical (docs/DEPLOY.md sec 25). Vercel has no domain-level
  // redirect for its own auto-issued `rankle-theta.vercel.app` alias, so that
  // host redirects here at the framework level — preserves path/query
  // automatically, never matches the apex itself so it can't loop.
  //
  // NOTE: www.rankle.io is deliberately NOT redirected here. Vercel already
  // has an existing *domain-level* redirect sending the apex (rankle.io) to
  // www.rankle.io — discovered live in production on 2026-09-14 (it doesn't
  // surface in `vercel domains inspect`). Adding an app-level www->apex rule
  // on top of that created an infinite redirect loop between the two hosts.
  // Until that Vercel domain-level redirect is reconfigured (flipped to
  // apex-primary) or removed, do not add a www rule here — see docs/TODO.md.
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
