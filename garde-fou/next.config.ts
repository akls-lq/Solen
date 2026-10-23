import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // Le bouton de développement de Next.js gênerait la démo.
  devIndicators: false,
};

export default nextConfig;
