
import type { Metadata } from 'next';
import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/skeleton';

export const metadata: Metadata = {
  title: 'Agenda de Eventos - NewsFlash',
  description: 'Programa y gestiona los eventos del calendario.',
};

const EventScheduler = dynamic(
  () => import('@/components/event-scheduler').then(mod => mod.EventScheduler),
  { 
    ssr: false,
    loading: () => (
      <div className="container mx-auto px-4 py-8">
        <Skeleton className="h-10 w-1/2 mx-auto mb-8" />
        <div className="grid lg:grid-cols-3 gap-8 items-start">
          <Skeleton className="lg:col-span-1 h-[600px]" />
          <div className="lg:col-span-2 space-y-4">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        </div>
      </div>
    ),
  }
);

export default function AgendaEventosPage() {
  return (
    <main className="min-h-screen">
      <EventScheduler />
    </main>
  );
}
