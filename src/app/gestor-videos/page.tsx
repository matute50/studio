"use client";

import dynamic from 'next/dynamic';

const GestorVideosClient = dynamic(() => import('@/components/gestor-videos-client'), { ssr: false });

export default function GestorVideosPage() {
  return <GestorVideosClient />;
}
