
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Newspaper, TextQuote, CalendarDays, Megaphone, Video } from 'lucide-react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Panel de Control - NewsFlash',
  description: 'Accede a los diferentes módulos de gestión de NewsFlash.',
};

const modules = [
  {
    title: 'Editor de Noticias',
    href: '/editor-noticias',
    description: 'Crea, edita y gestiona artículos de noticias.',
    icon: <Newspaper className="h-8 w-8 text-primary" />,
  },
  {
    title: 'Editor de Textos Ticker',
    href: '/textos-ticker',
    description: 'Administra los mensajes para el ticker de noticias.',
    icon: <TextQuote className="h-8 w-8 text-primary" />,
  },
  {
    title: 'Agenda de Eventos',
    href: '/agenda-eventos',
    description: 'Programa y gestiona eventos del calendario.',
    icon: <CalendarDays className="h-8 w-8 text-primary" />,
  },
  {
    title: 'Gestor de Publicidad',
    href: '/gestor-publicidad',
    description: 'Crea y administra los anuncios publicitarios.',
    icon: <Megaphone className="h-8 w-8 text-primary" />,
  },
  {
    title: 'Gestor de Videos',
    href: '/gestor-videos',
    description: 'Añade y gestiona los videos de la plataforma.',
    icon: <Video className="h-8 w-8 text-primary" />,
  },
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-background flex flex-col items-center justify-center p-4 sm:p-8">
      <div className="text-center mb-10">
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-primary mb-3">
          Panel de Control NewsFlash
        </h1>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 w-full max-w-6xl">
        {modules.map((module) => (
          <Link href={module.href} key={module.title} legacyBehavior passHref>
            <a className="block transform transition-all duration-300 ease-out hover:scale-105 focus:scale-105 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded-lg">
              <Card className="h-full flex flex-col hover:shadow-xl hover:border-primary/50 transition-shadow duration-300">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4 px-4">
                  <CardTitle className="text-xl font-semibold">{module.title}</CardTitle>
                  {module.icon}
                </CardHeader>
                <CardContent className="pt-2 pb-4 px-4">
                  <CardDescription className="text-sm">{module.description}</CardDescription>
                </CardContent>
              </Card>
            </a>
          </Link>
        ))}
      </div>
      <footer className="mt-12 text-center text-sm text-muted-foreground">
        <p>&copy; {new Date().getFullYear()} NewsFlash. Todos los derechos reservados.</p>
      </footer>
    </main>
  );
}
