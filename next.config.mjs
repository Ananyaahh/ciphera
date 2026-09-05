/** @type {import('next').NextConfig} */

// When BUILD_TARGET=static (the Capacitor app build), export a static site
// into ./out so the app can serve it from localhost â€” a secure context where
// the camera (getUserMedia) works. The normal Vercel build leaves this unset,
// so the API routes keep working there.
const isStatic = process.env.BUILD_TARGET === "static";

const nextConfig = {
  reactStrictMode: true,
  // Don't let the build fetch/optimize Google Fonts (some networks block that
  // at build time). Fonts load at runtime via <link> in app/layout.tsx.
  optimizeFonts: false,
  eslint: {
    ignoreDuringBuilds: true,
  },
  ...(isStatic
    ? {
        output: "export",
        trailingSlash: true,
        images: { unoptimized: true },
      }
    : {}),
};

export default nextConfig;