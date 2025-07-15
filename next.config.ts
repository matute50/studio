import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "otwvfihzaznyjvjtkvvd.supabase.co",
        port: "",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "img.youtube.com",
        port: "",
        pathname: "/vi/**",
      },
      {
        protocol: "https",
        hostname: "placehold.co",
        port: "",
        pathname: "/**",
      },
    ],
  },
  // Configuración para manejar Handlebars (nueva ubicación)
  serverExternalPackages: ["handlebars"],
  experimental: {
    allowedDevOrigins: [
      "https://6000-firebase-studio-*.cloudworkstations.dev",
    ],
  },
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      // Ignorar módulos opcionales que causan problemas
      '@opentelemetry/winston-transport': false,
      '@opentelemetry/exporter-jaeger': false,
      '@genkit-ai/firebase': false,
    };
    return config;
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: false,
  },
};

export default nextConfig;