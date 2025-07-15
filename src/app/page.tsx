"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-background flex flex-col items-center justify-center p-4 sm:p-8">
      <header className="flex flex-col sm:flex-row items-center justify-center text-center mb-10 gap-3 sm:gap-4">
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-primary uppercase">
          Panel de Control
        </h1>
      </header>

      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 w-full max-w-5xl">
        <Link href="/editor-noticias">
          <Button variant="outline" className="w-full">
            Editor de Noticias
          </Button>
        </Link>
        <Link href="/gestor-videos">
          <Button variant="outline" className="w-full">
            Gestor de Videos
          </Button>
        </Link>
        <Link href="/gestor-publicidad">
          <Button variant="outline" className="w-full">
            Gestor de Publicidad
          </Button>
        </Link>
        <Link href="/gestor-imagenes-header">
          <Button variant="outline" className="w-full">
            Gestor de Imágenes del Header
          </Button>
        </Link>
        <Link href="/agenda-eventos">
          <Button variant="outline" className="w-full">
            Agenda de Eventos
          </Button>
        </Link>
      </section>
    </main>
  );
}
