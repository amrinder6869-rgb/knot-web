import type { NextConfig } from "next";

const securityHeaders = [
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // camera/microphone are left unrestricted: DailyCall.tsx embeds a
  // cross-origin Daily.co iframe that needs them delegated, and a page-level
  // Permissions-Policy can only narrow what an iframe's own allow attribute
  // grants, never widen it — locking them down here would break video calls.
  { key: 'Permissions-Policy', value: 'geolocation=(self)' },
];

const nextConfig: NextConfig = {
  // Next.js already content-hashes JS chunk filenames per build by default,
  // so stale bundles aren't a filename-collision problem — this just pins
  // generateBuildId explicitly rather than relying on the implicit default.
  generateBuildId: async () => Date.now().toString(),
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
