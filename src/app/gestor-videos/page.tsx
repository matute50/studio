
import { VideoManager } from '@/components/video-manager';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Gestor de Videos - NewsFlash',
  description: 'Añade, gestiona y visualiza los videos de la plataforma.',
};

export default function GestorVideosPage() {
  return (
    <main className="min-h-screen">
      <VideoManager />
    </main>
  );
}
