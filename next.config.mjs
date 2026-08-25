/** @type {import('next').NextConfig} */

// When BUILD_TARGET=static (the Capacitor app build), export a static site
// into ./out so the app can serve it from localhost — a secure context where
// the camera (getUserMedia) works. The normal Vercel build leaves this unset,
// so the API routes keep working there.
const isStatic = process.env.BUILD_TARGET === "static";

const nextConfig = {
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  ...(isStatic
    ? {
        output: "export",
        images: { unoptimized: true },
      }
    : {}),
};

export default nextConfig;
