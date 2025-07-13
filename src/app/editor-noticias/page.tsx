
import type { Metadata } from 'next';
import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/skeleton';

export const metadata: Metadata = {
  title: 'Editor de Noticias - NewsFlash',
  description: 'Crea y edita artículos de noticias con sugerencias de títulos impulsadas por IA.',
};

const NewsEditor = dynamic(
  () => import('@/components/news-editor').then(mod => mod.NewsEditor),
  { 
    ssr: false,
    loading: () => (
      <div className="container mx-auto px-4 py-8">
        <Skeleton className="h-10 w-1/3 mx-auto mb-8" />
        <div className="grid lg:grid-cols-2 gap-12 items-start">
          <Skeleton className="h-[700px] w-full" />
          <div className="space-y-4">
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
          </div>
        </div>
      </div>
    ),
  }
);

export default function EditorNoticiasPage() {
  return (
    <main className="min-h-screen">
      <NewsEditor />
    </main>
  );
}
