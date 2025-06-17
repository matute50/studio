
"use client";

import * as React from 'react';
import type { NewsArticle } from '@/types';
import Image from 'next/image';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Edit3, Trash2, ImageOff, Star, CheckCircle, CaseLower, FileText } from 'lucide-react';

interface ArticleListItemProps {
  article: NewsArticle;
  index: number;
  onEdit: (article: NewsArticle) => void;
  onDelete: (article: NewsArticle) => void;
  isSubmitting: boolean;
  formatDate: (dateString?: string | null) => string;
  translateFeatureStatus: (status: 'destacada' | 'noticia2' | 'noticia3' | null) => string;
}

const ArticleListItemComponent: React.FC<ArticleListItemProps> = ({
  article,
  index,
  onEdit,
  onDelete,
  isSubmitting,
  formatDate,
  translateFeatureStatus,
}) => {
  return (
    <Card key={article.id} className="shadow-md hover:shadow-lg transition-shadow">
      <CardHeader className="pb-2 pt-3 px-4">
        <div className="flex justify-between items-start gap-2">
          <div className="flex-grow">
            <CardTitle className="text-base font-semibold break-words">
              <span className="text-primary mr-2">{index + 1}.</span>
              {article.title}
            </CardTitle>
          </div>
          <div className="flex flex-col items-end space-y-1 flex-shrink-0">
            {['destacada', 'noticia2', 'noticia3'].includes(article.featureStatus as string) && (
              <Badge className="whitespace-nowrap bg-green-600 text-primary-foreground text-xs px-1.5 py-0.5">
                {article.featureStatus === 'destacada' ? <Star className="mr-1 h-3 w-3" /> : <CheckCircle className="mr-1 h-3 w-3" />}
                {translateFeatureStatus(article.featureStatus)}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="grid grid-cols-1 md:grid-cols-[80px_1fr] gap-3 items-start pt-0 pb-3 px-4">
        <div className="relative w-full md:w-[80px] h-[60px] rounded-md overflow-hidden border bg-muted">
          {(article.imageUrl && (article.imageUrl.startsWith('http') || article.imageUrl.startsWith('data:image'))) ? (
            <Image
              src={article.imageUrl}
              alt={`Imagen para ${article.title}`}
              fill 
              style={{ objectFit: 'cover' }} 
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.src = 'https://placehold.co/80x60.png';
                target.srcset = '';
              }}
              data-ai-hint="noticia miniatura"
              sizes="(max-width: 768px) 100vw, 80px" 
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-muted">
              <ImageOff className="w-6 h-6 text-muted-foreground" />
            </div>
          )}
        </div>
        <div className="space-y-1">
          {article.slug && (
            <p className="text-xs text-muted-foreground flex items-center">
              <CaseLower className="mr-1.5 h-3.5 w-3.5 text-sky-600" />
              <span className="truncate">Slug: {article.slug}</span>
            </p>
          )}
          {article.description && (
            <p className="text-xs text-muted-foreground flex items-center">
              <FileText className="mr-1.5 h-3.5 w-3.5 text-amber-600" />
              <span className="truncate">Desc: {article.description}</span>
            </p>
          )}
          <p className="text-xs text-muted-foreground line-clamp-2 break-words">
            {article.text}
          </p>
        </div>
      </CardContent>
      <CardFooter className="text-xs text-muted-foreground pt-1 pb-2 px-4 flex justify-between items-center">
        <div>
          <p className="text-[0.7rem] leading-tight">Publicado: {formatDate(article.createdAt)}</p>
          {article.updatedAt && article.updatedAt !== article.createdAt && (
            <p className="text-[0.7rem] leading-tight text-muted-foreground/80">(Editado: {formatDate(article.updatedAt)})</p>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => article.id && onEdit(article)} disabled={isSubmitting} className="h-7 px-2 py-1 text-xs">
            <Edit3 className="mr-1 h-3 w-3" /> Editar
          </Button>
          <Button variant="destructive" size="sm" onClick={() => article.id && onDelete(article)} disabled={isSubmitting} className="h-7 px-2 py-1 text-xs">
            <Trash2 className="mr-1 h-3 w-3" /> Eliminar
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
};

export const ArticleListItem = React.memo(ArticleListItemComponent);
ArticleListItem.displayName = 'ArticleListItem';
