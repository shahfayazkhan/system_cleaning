/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Hosted builds (Vercel, or CLEAN_CACHE_HOSTED=1) show an info/download page instead of the cleaner:
  // a cloud server cannot see or clean the visitor's laptop.
  env: {
    NEXT_PUBLIC_HOSTED: process.env.VERCEL || process.env.CLEAN_CACHE_HOSTED === "1" ? "1" : "",
  },
  // The app only ever runs on your own machine (bound to 127.0.0.1).
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "no-referrer" },
        ],
      },
    ];
  },
};

export default nextConfig;
