
import { TextTickerEditor } from '@/components/text-ticker-editor';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Editor de Textos Ticker - NewsFlash',
  description: 'Crea y gestiona los textos para el ticker de noticias.',
};

export default function TextosTickerPage() {
  return (
    <main className="min-h-screen">
      <TextTickerEditor />
    </main>
  );
}
