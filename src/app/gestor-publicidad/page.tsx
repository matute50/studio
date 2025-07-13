
import type { Metadata } from 'next';
import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/skeleton';

export const metadata: Metadata = {
  title: 'Gestor de Publicidad - NewsFlash',
  description: 'Crea, gestiona y visualiza los anuncios publicitarios.',
};

const AdManager = dynamic(
  () => import('@/components/ad-manager').then(mod => mod.AdManager),
  { 
    ssr: false,
    loading: () => (
       <div className="container mx-auto px-4 py-8">
        <Skeleton className="h-10 w-1/2 mx-auto mb-8" />
        <div className="grid lg:grid-cols-2 gap-8 items-start">
          <div className="space-y-8">
            <Skeleton className="h-96 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
           <div className="space-y-8">
            <Skeleton className="h-96 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        </div>
      </div>
    )
  }
);


export default function GestorPublicidadPage() {
  return (
    <main className="min-h-screen">
      <AdManager />
    </main>
  );
}
