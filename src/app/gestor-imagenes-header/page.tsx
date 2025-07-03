
import { HeaderImageManager } from '@/components/header-image-manager';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Gestor de Imágenes Header - NewsFlash',
  description: 'Sube y administra imágenes para el header de la aplicación.',
};

export default function GestorImagenesHeaderPage() {
  return (
    <main className="min-h-screen">
      <HeaderImageManager />
    </main>
  );
}
