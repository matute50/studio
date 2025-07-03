
import { AdManager } from '@/components/ad-manager';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Gestor de Publicidad - NewsFlash',
  description: 'Crea, gestiona y visualiza los anuncios publicitarios.',
};

export default function GestorPublicidadPage() {
  return (
    <main className="min-h-screen">
      <AdManager />
    </main>
  );
}
