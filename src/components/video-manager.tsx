
"use client";

import * as React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Home, Film } from 'lucide-react'; // Using Film as a generic multimedia icon

export function VideoManager() {
  return (
    <div className="container mx-auto px-4 py-8">
      <header className="flex flex-col sm:flex-row items-center justify-center text-center mb-8 gap-3 sm:gap-4">
        <Film className="h-10 w-10 text-primary" />
        <h1 className="text-4xl font-bold tracking-tight text-primary">Gestor de Contenido Multimedia</h1>
      </header>
      <div className="mb-6 text-left">
        <Link href="/" passHref legacyBehavior>
          <Button variant="outline" size="sm">
            <Home className="mr-2 h-4 w-4" />
            Volver al Inicio
          </Button>
        </Link>
      </div>

      <div className="flex flex-col items-center justify-center min-h-[40vh] border-2 border-dashed border-muted-foreground/20 rounded-lg p-8">
        <Film className="h-16 w-16 text-muted-foreground mb-4" />
        <h2 className="text-2xl font-semibold text-foreground mb-2">
          Sección en Desarrollo
        </h2>
        <p className="text-muted-foreground text-center">
          Los formularios y visores de contenido anteriores han sido eliminados.
          <br />
          Esta sección está lista para nuevas funcionalidades de gestión multimedia.
        </p>
      </div>
    </div>
  );
}
