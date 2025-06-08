
import { StreamingManager } from '@/components/streaming-manager';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Configuración de Streaming - NewsFlash',
  description: 'Gestiona la URL del streaming en vivo para la plataforma.',
};

export default function StreamingPage() {
  return (
    <main className="min-h-screen">
      <StreamingManager />
    </main>
  );
}
