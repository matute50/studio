
"use client";

import type { NewsArticle } from '@/types';
import Image from 'next/image';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface NewsPreviewProps extends Omit<NewsArticle, 'id'> {}

export function NewsPreview({ title, text, imageUrl, isFeatured }: NewsPreviewProps) {
  const displayTitle = title || "Vista Previa del Título del Artículo";
  const displayText = text || "El contenido del artículo aparecerá aquí mientras escribes. ¡Escribe algo atractivo e informativo!";
  // imageUrl will be the placeholder string if it was originally empty, thanks to the form schema's transform.
  
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
        {/* Ensure imageUrl is not an empty string before rendering Image to prevent potential issues if transform somehow fails */}
        {imageUrl && (imageUrl.startsWith('http') || imageUrl.startsWith('data:image') || imageUrl.startsWith('https://placehold.co/')) ? (
          <div className="relative w-full aspect-video rounded-md overflow-hidden">
            <Image
              src={imageUrl} // Directly use imageUrl as it's handled by the form schema
              alt={title || 'Vista previa de la imagen del artículo'}
              fill
              style={{ objectFit: 'cover' }}
              onError={(e) => (e.currentTarget.src = 'https://placehold.co/600x400.png')}
              data-ai-hint="noticia articulo"
            />
          </div>
        ) : (
           <div className="relative w-full aspect-video rounded-md overflow-hidden bg-muted flex items-center justify-center">
            <Image
              src="https://placehold.co/600x400.png" // Fallback if imageUrl is somehow invalid for <Image>
              alt="Imagen de marcador de posición"
              width={600}
              height={400}
              style={{ objectFit: 'cover' }}
              data-ai-hint="marcador imagen"
            />
          </div>
        )}
        <CardDescription className="text-foreground/90 whitespace-pre-wrap break-words flex-grow prose prose-sm sm:prose-base max-w-none">
          {displayText}
        </CardDescription>
      </CardContent>
    </Card>
  );
}
