import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    // Désactiver le prerendering pour éviter les erreurs Supabase
    staticGenerationRetryCount: 0,
  },
  // Forcer le rendu dynamique pour toutes les pages
  trailingSlash: false,
};

export default nextConfig;
