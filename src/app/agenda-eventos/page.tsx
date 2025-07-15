"use client";

import dynamic from 'next/dynamic';

const AgendaEventosClient = dynamic(() => import('@/components/agenda-eventos-client'), { ssr: false });

export default function AgendaEventosPage() {
  return <AgendaEventosClient />;
}
