
"use client";

import type { NewsArticle } from '@/types';
import Image from 'next/image';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ImageOff } from 'lucide-react';

interface NewsPreviewProps extends Omit<NewsArticle, 'id'> {}

// Este componente ya no se utiliza activamente en NewsEditor, 
// pero se mantiene por si se decide reutilizar o por referencia.
// La funcionalidad de vista previa en vivo ha sido reemplazada
// por una lista de artículos guardados en NewsEditor.
export function NewsPreview({ title, text, imageUrl, isFeatured }: NewsPreviewProps) {
  const displayTitle = title || "Vista Previa del Título del Artículo";
  const displayText = text || "El contenido del artículo aparecerá aquí mientras escribes. ¡Escribe algo atractivo e informativo!";
  
  const isValidImageUrl = imageUrl && (imageUrl.startsWith('http') || imageUrl.startsWith('data:image') || imageUrl.startsWith('https://placehold.co/'));
  const imageToDisplay = isValidImageUrl ? imageUrl : 'https://placehold.co/600x400.png';
  const altText = isValidImageUrl ? (title || 'Vista previa de la imagen del artículo') : 'Imagen de marcador de posición';

  return (
    <Card className="overflow-hidden shadow-lg h-full flex flex-col">
      <CardHeader>
        <CardTitle className="text-2xl font-bold break-words">
          {displayTitle}
        </CardTitle>
        {isFeatured && (
          <Badge variant="default" className="mt-2 w-fit bg-accent text-accent-foreground hover:bg-accent/90">
            Destacado
          </Badge>
        )}
      </CardHeader>
      <CardContent className="flex-grow flex flex-col gap-4">
        <div className="relative w-full aspect-video rounded-md overflow-hidden bg-muted">
          {isValidImageUrl ? (
            <Image
              src={imageToDisplay}
              alt={altText}
              fill
              style={{ objectFit: 'cover' }}
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.src = 'https://placehold.co/600x400.png'; // Fallback on error
                target.srcset = '';
              }}
              data-ai-hint="noticia articulo"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <ImageOff className="w-16 h-16 text-muted-foreground" />
            </div>
          )}
        </div>
        <CardDescription className="text-foreground/90 whitespace-pre-wrap break-words flex-grow prose prose-sm sm:prose-base max-w-none">
          {displayText}
        </CardDescription>
      </CardContent>
    </Card>
  );
}
