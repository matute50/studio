
import type { Metadata } from 'next';
import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/skeleton';

export const metadata: Metadata = {
  title: 'Configuración de Streaming - NewsFlash',
  description: 'Gestiona la URL del streaming en vivo para la plataforma.',
};

const StreamingManager = dynamic(
  () => import('@/components/streaming-manager').then(mod => mod.StreamingManager),
  { 
    ssr: false,
    loading: () => (
       <div className="container mx-auto px-4 py-8">
        <Skeleton className="h-10 w-1/2 mx-auto mb-8" />
        <div className="grid lg:grid-cols-5 gap-8 items-start">
          <div className="lg:col-span-3 space-y-8">
            <Skeleton className="h-96 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
          <div className="lg:col-span-2">
            <Skeleton className="aspect-video w-full" />
          </div>
        </div>
      </div>
    )
  }
);

export default function StreamingPage() {
  return (
    <main className="min-h-screen">
      <StreamingManager />
    </main>
  );
}
