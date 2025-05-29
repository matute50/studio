
import { NewsEditor } from '@/components/news-editor';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Editor de Noticias - NewsFlash',
  description: 'Crea y edita artículos de noticias con sugerencias de títulos impulsadas por IA.',
};

export default function EditorNoticiasPage() {
  return (
    <main className="min-h-screen">
      <NewsEditor />
    </main>
  );
}
