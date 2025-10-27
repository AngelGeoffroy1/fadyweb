import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    // Désactiver le prerendering pour éviter les erreurs Supabase
    staticGenerationRetryCount: 0,
  },
  // Configuration pour Netlify
  trailingSlash: true,
  images: {
    unoptimized: true
  },
};

export default nextConfig;
