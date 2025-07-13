
import type { Metadata } from 'next';
import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/skeleton';

export const metadata: Metadata = {
  title: 'Gestor de Imágenes Header - NewsFlash',
  description: 'Sube y administra imágenes para el header de la aplicación.',
};

const HeaderImageManager = dynamic(
  () => import('@/components/header-image-manager').then(mod => mod.HeaderImageManager),
  { 
    ssr: false,
    loading: () => (
       <div className="container mx-auto px-4 py-8">
        <Skeleton className="h-10 w-1/2 mx-auto mb-8" />
        <Skeleton className="h-96 w-full lg:max-w-2xl mx-auto mb-12" />
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    )
  }
);


export default function GestorImagenesHeaderPage() {
  return (
    <main className="min-h-screen">
      <HeaderImageManager />
    </main>
  );
}
