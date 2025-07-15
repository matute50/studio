"use client";

import dynamic from 'next/dynamic';

const GestorPublicidadClient = dynamic(() => import('@/components/gestor-publicidad-client'), { ssr: false });

export default function GestorPublicidadPage() {
  return <GestorPublicidadClient />;
}
