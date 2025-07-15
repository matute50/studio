"use client";

import dynamic from 'next/dynamic';

const GestorImagenesHeaderClient = dynamic(() => import('@/components/gestor-imagenes-header-client'), { ssr: false });

export default function GestorImagenesHeaderPage() {
  return <GestorImagenesHeaderClient />;
}
