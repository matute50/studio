
import { EventScheduler } from '@/components/event-scheduler';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Agenda de Eventos - NewsFlash',
  description: 'Programa y gestiona los eventos del calendario.',
};

export default function AgendaEventosPage() {
  return (
    <main className="min-h-screen">
      <EventScheduler />
    </main>
  );
}
