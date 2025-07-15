import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Configuración de TypeScript (mejor alternativa que ignorar errores)
  typescript: {
    tsconfigPath: './tsconfig.json', // Asegura usar tu tsconfig
  },

  // Configuración de ESLint (mejor que ignorar)
  eslint: {
    dirs: ['src'], // Solo verifica la carpeta src
  },

  // Configuración de imágenes
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
      },
      {
        protocol: 'https',
        hostname: 'otwvfihzaznyjvjtkvvd.supabase.co',
      },
      {
        protocol: 'https',
        hostname: 'img.youtube.com',
        pathname: '/vi/**',
      },
    ],
    // Optimización para Vercel
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 60, // 60 segundos de caché mínimo
  },

  // Configuración experimental
  experimental: {
    allowedDevOrigins: [
      "https://6000-firebase-studio-*.cloudworkstations.dev", // Usa wildcard para todos los subdominios
    ],
    // Mejoras para el rendimiento en Vercel
    optimizePackageImports: [
      '@supabase/supabase-js',
      '@genkit-ai/core',
    ],
  },

  // Configuración para Webpack (soluciona problemas con Handlebars y OpenTelemetry)
  webpack: (config) => {
    // Ignora módulos opcionales no críticos
    config.resolve.fallback = {
      ...config.resolve.fallback,
      '@opentelemetry/exporter-jaeger': false,
      '@genkit-ai/firebase': false,
    };

    return config;
  },

  // Configuración para el entorno de Vercel
  output: process.env.VERCEL ? 'standalone' : undefined, // Optimiza para serverless
};

export default nextConfig;