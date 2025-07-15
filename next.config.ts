/** @type {import('next').NextConfig} */
const nextConfig = {
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
  experimental: {
    serverComponentsExternalPackages: ["handlebars"],
    allowedDevOrigins: [
      "https://6000-firebase-studio-*.cloudworkstations.dev",
    ],
  },
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      // Ignora estos módulos opcionales
      '@opentelemetry/winston-transport': false,
      '@opentelemetry/exporter-jaeger': false,
      '@genkit-ai/firebase': false,
    };

    return config;
  },
  typescript: {
    // Habilita la verificación de tipos en producción
    ignoreBuildErrors: false,
  },
  eslint: {
    // Habilita ESLint en producción
    ignoreDuringBuilds: false,
  },
};

module.exports = nextConfig;