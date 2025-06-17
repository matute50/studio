
import Link from 'next/link';
import Image from 'next/image';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Newspaper, TextQuote, CalendarDays, Megaphone, Video, ExternalLink, RadioTower, ImageUp } from 'lucide-react';
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
  {
    title: 'Streaming',
    href: '/streaming',
    description: 'Configura la URL del streaming en vivo.',
    icon: <RadioTower className="h-8 w-8 text-primary" />,
  },
  {
    title: 'Gestor de Imágenes Header',
    href: '/gestor-imagenes-header',
    description: 'Sube y administra imágenes para el header.',
    icon: <ImageUp className="h-8 w-8 text-primary" />,
  },
];

const externalNewsSites = [
  { name: 'InfoSaladillo', url: 'http://infosaladillo.com.ar' },
  { name: 'ABCSaladillo', url: 'http://abcsladillo.com.ar' },
  { name: 'Saladillo Diario', url: 'http://saladillodiario.com.ar' },
  { name: 'Convergencias', url: 'http://convergencias.com.ar' },
  { name: 'CNSaladillo', url: 'http://cnsaladillo.com.ar' },
  { name: 'La Sintesis', url: 'http://lasintesis.com.ar' },
  { name: 'AlvearYA', url: 'http://alvearya.com.ar' },
  { name: '25 Digital', url: 'http://25digital.com.ar' },
  { name: 'InfoLobos', url: 'http://infolobos.com.ar' },
  { name: 'Ahora Saladillo', url: 'https://ahorasaladillo-diariodigital.com.ar' },
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-background flex flex-col items-center justify-center p-4 sm:p-8">
      <header className="flex flex-col sm:flex-row items-center justify-center text-center mb-10 gap-3 sm:gap-4">
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-primary uppercase">
          Panel de Control
        </h1>
      </header>
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

      <div className="mt-12 w-full max-w-6xl">
        <h2 className="text-2xl font-semibold text-center text-foreground mb-6 uppercase">Enlaces a Medios</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {externalNewsSites.map((site) => (
            <a
              key={site.name}
              href={site.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block"
            >
              <Button variant="outline" className="w-full justify-start text-left h-auto py-3">
                <ExternalLink className="mr-3 h-5 w-5 text-primary/80" />
                <span className="flex-1">{site.name}</span>
              </Button>
            </a>
          ))}
        </div>
      </div>

      <footer className="mt-12 text-center text-sm text-muted-foreground">
        <p>&copy; {new Date().getFullYear()} NewsFlash. Todos los derechos reservados.</p>
      </footer>
    </main>
  );
}
