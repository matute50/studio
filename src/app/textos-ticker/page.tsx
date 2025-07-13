
import type { Metadata } from 'next';
import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/skeleton';

export const metadata: Metadata = {
  title: 'Editor de Textos Ticker - NewsFlash',
  description: 'Crea y gestiona los textos para el ticker de noticias.',
};

const TextTickerEditor = dynamic(
  () => import('@/components/text-ticker-editor').then(mod => mod.TextTickerEditor),
  { 
    ssr: false,
    loading: () => (
      <div className="container mx-auto px-4 py-8">
        <Skeleton className="h-10 w-1/2 mx-auto mb-8" />
        <Skeleton className="h-80 w-full lg:max-w-3xl mx-auto mb-8" />
        <div className="space-y-4">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
        </div>
      </div>
    )
  }
);

export default function TextosTickerPage() {
  return (
    <main className="min-h-screen">
      <TextTickerEditor />
    </main>
  );
}
