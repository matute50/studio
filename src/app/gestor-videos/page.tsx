
import type { Metadata } from 'next';
import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/skeleton';

export const metadata: Metadata = {
  title: 'Gestor de Videos - NewsFlash',
  description: 'Añade, gestiona y visualiza los videos de la plataforma.',
};

const VideoManager = dynamic(
  () => import('@/components/video-manager').then(mod => mod.VideoManager),
  { 
    ssr: false,
    loading: () => (
       <div className="container mx-auto px-4 py-8">
        <Skeleton className="h-10 w-1/2 mx-auto mb-8" />
        <div className="grid lg:grid-cols-2 gap-8 items-start">
          <Skeleton className="h-[600px] w-full" />
          <div className="space-y-4">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        </div>
      </div>
    )
  }
);


export default function GestorVideosPage() {
  return (
    <main className="min-h-screen">
      <VideoManager />
    </main>
  );
}
