"use client";

import type { NewsArticle } from '@/types';
import Image from 'next/image';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface NewsPreviewProps extends Omit<NewsArticle, 'id'> {}

export function NewsPreview({ title, text, imageUrl, isFeatured }: NewsPreviewProps) {
  const displayTitle = title || "Article Title Preview";
  const displayText = text || "Article content will appear here as you type. Write something engaging and informative!";
  
  return (
    <Card className="overflow-hidden shadow-lg h-full flex flex-col">
      <CardHeader>
        <CardTitle className="text-2xl font-bold break-words">
          {displayTitle}
        </CardTitle>
        {isFeatured && (
          <Badge variant="default" className="mt-2 w-fit bg-accent text-accent-foreground hover:bg-accent/90">
            Featured
          </Badge>
        )}
      </CardHeader>
      <CardContent className="flex-grow flex flex-col gap-4">
        {imageUrl ? (
          <div className="relative w-full aspect-video rounded-md overflow-hidden">
            <Image
              src={imageUrl}
              alt={title || 'Article image preview'}
              fill
              style={{ objectFit: 'cover' }}
              onError={(e) => (e.currentTarget.src = 'https://placehold.co/600x400.png')}
              data-ai-hint="news article"
            />
          </div>
        ) : (
           <div className="relative w-full aspect-video rounded-md overflow-hidden bg-muted flex items-center justify-center">
            <Image
              src="https://placehold.co/600x400.png"
              alt="Placeholder image"
              width={600}
              height={400}
              style={{ objectFit: 'cover' }}
              data-ai-hint="placeholder image"
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
