
import { HcdManager } from '@/components/hcd-manager';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Gestor HCD - NewsFlash',
  description: 'Administra los videos del Honorable Concejo Deliberante.',
};

export default function GestorHcdPage() {
  return (
    <main className="min-h-screen">
      <HcdManager />
    </main>
  );
}
