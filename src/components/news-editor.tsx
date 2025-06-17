
"use client";

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import Image from 'next/image';
import Link from 'next/link';
import type { NewsArticle } from '@/types';

import { suggestAlternativeTitles, SuggestAlternativeTitlesInput } from '@/ai/flows/suggest-alternative-titles';
import { supabase, uploadImageToSupabase } from '@/lib/supabaseClient'; 

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader as AlertDialogHeaderComponent, AlertDialogTitle as AlertDialogTitleComponent } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from '@/hooks/use-toast';
import { Loader2, Sparkles, Send, Upload, Newspaper, ImageOff, Edit3, Trash2, XCircle, Home } from 'lucide-react';

import { Alert, AlertDescription as ShadcnAlertDescription, AlertTitle as ShadcnAlertTitle } from "@/components/ui/alert";
import { ArticleListItem } from '@/components/article-list-item'; // Import the new component

const featureStatusEnum = z.enum(['destacada', 'noticia2', 'noticia3']);
const newsArticleSchema = z.object({
  title: z.string().min(5, { message: "El título debe tener al menos 5 caracteres." }).max(150, { message: "El título debe tener 150 caracteres o menos." }),
  slug: z.string().optional(),
  description: z.string().max(160, { message: "La descripción debe tener 160 caracteres o menos." }).optional(),
  text: z.string(), 
  imageUrl: z.string()
    .refine(
      (value) => {
        if (value === "") return true; 
        if (value.startsWith("https://placehold.co/")) return true; 
        if (value.startsWith("data:image/")) {
          return /^data:image\/(?:gif|png|jpeg|bmp|webp|svg\+xml)(?:;charset=utf-8)?;base64,(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value);
        }
        try {
          new URL(value);
          return true;
        } catch (_) {
          return false;
        }
      },
      { message: "Por favor, introduce una URL válida o sube una imagen." }
    )
    .transform(val => (val === "" ? "https://placehold.co/600x400.png" : val))
    .default(""),
  featureStatus: featureStatusEnum.nullable().default(null),
});

type NewsArticleFormValues = z.infer<typeof newsArticleSchema>;

const featureStatusOptions = [
  { value: 'null', label: 'Ninguno/a' },
  { value: 'destacada', label: 'Noticia Destacada' },
  { value: 'noticia2', label: 'Noticia 2' },
  { value: 'noticia3', label: 'Noticia 3' },
];

function translateFeatureStatus(status: 'destacada' | 'noticia2' | 'noticia3' | null): string {
  if (!status) return 'No Especificado'; // Return a default string if status is null
  const found = featureStatusOptions.find(opt => opt.value === status);
  return found ? found.label : status;
}

const generateSlug = (title: string): string => {
  if (!title) return '';
  return title
    .toString()
    .toLowerCase()
    .normalize('NFD') 
    .replace(/[\u0300-\u036f]/g, '') 
    .replace(/\s+/g, '-') 
    .replace(/[^\w-]+/g, '') 
    .replace(/--+/g, '-') 
    .replace(/^-+/, '') 
    .replace(/-+$/, ''); 
};

const formatDate = (dateString?: string | null) => {
  if (!dateString) { 
    return 'Fecha desconocida';
  }
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      return 'Fecha inválida';
    }
    return date.toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch (e: any) {
    return 'Error al formatear fecha';
  }
};


export function NewsEditor() {
  const { toast } = useToast();
  const [suggestedTitles, setSuggestedTitles] = React.useState<string[]>([]);
  const [isSuggestingTitles, setIsSuggestingTitles] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const editorFormCardRef = React.useRef<HTMLDivElement>(null);

  const [articles, setArticles] = React.useState<NewsArticle[]>([]);
  const [isLoadingArticles, setIsLoadingArticles] = React.useState(true);
  const [errorLoadingArticles, setErrorLoadingArticles] = React.useState<string | null>(null);

  const [editingArticleId, setEditingArticleId] = React.useState<string | null>(null);
  const [showDeleteConfirmDialog, setShowDeleteConfirmDialog] = React.useState(false);
  const [articleToDelete, setArticleToDelete] = React.useState<NewsArticle | null>(null);

  const form = useForm<NewsArticleFormValues>({
    resolver: zodResolver(newsArticleSchema),
    defaultValues: {
      title: '',
      slug: '',
      description: '',
      text: '',
      imageUrl: '',
      featureStatus: null,
    },
    mode: "onChange",
  });

  const watchedTitle = form.watch('title');
  const watchedImageUrl = form.watch('imageUrl');

  React.useEffect(() => {
    if (watchedTitle !== undefined) {
      const generated = generateSlug(watchedTitle);
      form.setValue('slug', generated, { shouldValidate: true, shouldDirty: true });
    }
  }, [watchedTitle, form]);

  const fetchArticles = React.useCallback(async () => {
    setIsLoadingArticles(true);
    setErrorLoadingArticles(null);
    try {
      const { data, error } = await supabase
        .from('articles')
        .select('*')
        .order('createdAt', { ascending: false });

      if (error) {
        throw error;
      }
      setArticles(data || []);
    } catch (error: any) {
      const description = `No se pudieron cargar los artículos guardados: ${error.message || 'Error desconocido'}.`;
      setErrorLoadingArticles(description);
      toast({
        title: "Error al Cargar Artículos",
        description: `${description} Revisa los logs del panel de Supabase para más detalles. Asegúrate que la tabla 'articles' existe y tiene las columnas 'slug', 'description' y 'featureStatus' de tipo TEXT.`,
        variant: "destructive",
        duration: 10000,
      });
    } finally {
      setIsLoadingArticles(false);
    }
  }, [toast]);

  React.useEffect(() => {
    fetchArticles();
  }, [fetchArticles]);

  const handleSuggestTitles = React.useCallback(async () => {
    const currentTitle = form.getValues('title');
    const currentText = form.getValues('text');

    if (!currentText || currentText.length < 20) {
      toast({
        title: "Contenido demasiado corto",
        description: "Por favor, escribe al menos 20 caracteres en el texto del artículo antes de sugerir títulos.",
        variant: "destructive",
      });
      return;
    }

    setIsSuggestingTitles(true);
    setSuggestedTitles([]);
    try {
      const input: SuggestAlternativeTitlesInput = {
        articleTitle: currentTitle || "Artículo sin Título",
        articleContent: currentText,
      };
      const result = await suggestAlternativeTitles(input);
      setSuggestedTitles(result.alternativeTitles);
      if (result.alternativeTitles.length === 0) {
        toast({
          title: "No hay sugerencias",
          description: "La IA no pudo generar títulos alternativos en este momento. Intenta refinar el texto de tu artículo.",
        });
      }
    } catch (error) {
      toast({
        title: "Error al Sugerir Títulos",
        description: "No se pudo generar sugerencias de títulos. Por favor, inténtalo de nuevo.",
        variant: "destructive",
      });
    } finally {
      setIsSuggestingTitles(false);
    }
  }, [form, toast]);

  const resetFormAndPreview = React.useCallback(() => {
    form.reset({
      title: '',
      slug: '',
      description: '',
      text: '',
      imageUrl: '',
      featureStatus: null,
    });
    setSuggestedTitles([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = ""; 
    }
    setEditingArticleId(null);
  }, [form]);

  const onSubmit = React.useCallback(async (data: NewsArticleFormValues) => {
    setIsSubmitting(true);
    let finalImageUrl = data.imageUrl;
    const now = new Date().toISOString();
  
    const currentSlug = data.slug || generateSlug(data.title);

    if (data.imageUrl && data.imageUrl.startsWith('data:image/')) {
      toast({ title: "Subiendo imagen...", description: "Por favor espera un momento." });
      const { url: uploadedUrl, errorMessage: uploadErrorMessage } = await uploadImageToSupabase(data.imageUrl, 'imagenes-noticias'); 
      
      if (uploadedUrl) {
        finalImageUrl = uploadedUrl;
        form.setValue('imageUrl', uploadedUrl, { shouldValidate: true, shouldDirty: true });
        toast({
          title: "Imagen Subida",
          description: "La imagen se ha subido correctamente a Supabase Storage.",
        });
      } else {
        toast({
          title: "Error al Subir Imagen",
          description: uploadErrorMessage || "No se pudo subir la imagen. Verifica RLS y logs de Supabase. El artículo se guardará con la imagen de marcador de posición.",
          variant: "destructive",
          duration: 9000, 
        });
        setIsSubmitting(false);
        return; 
      }
    }

    try {
      const newFeatureStatus = data.featureStatus;

      if (newFeatureStatus) {
        const { error: clearOldFeatureError } = await supabase
          .from('articles')
          .update({ featureStatus: null, updatedAt: now })
          .eq('featureStatus', newFeatureStatus)
          .neq('id', editingArticleId || '00000000-0000-0000-0000-000000000000'); 
        
        if (clearOldFeatureError) {
            console.error("Error clearing old feature status:", clearOldFeatureError);
            toast({
              title: "Advertencia al limpiar estado",
              description: `No se pudo limpiar '${translateFeatureStatus(newFeatureStatus)}' de otros artículos. Puede haber un problema de consistencia. Error: ${clearOldFeatureError.message}`,
              variant: "default",
              duration: 7000,
            });
        }
      }

      if (editingArticleId) { 
        const articleToUpdate = {
          title: data.title,
          slug: currentSlug,
          description: data.description,
          text: data.text,
          imageUrl: finalImageUrl,
          featureStatus: newFeatureStatus,
          updatedAt: now,
        };

        const { data: updatedData, error: updateError } = await supabase
          .from('articles')
          .update(articleToUpdate)
          .eq('id', editingArticleId)
          .select()
          .single();

        if (updateError) throw updateError;

        toast({ title: "Artículo Actualizado", description: `El artículo "${updatedData?.title || ''}" ha sido actualizado.` });
      } else { 
        const articleToInsert = {
          title: data.title,
          slug: currentSlug,
          description: data.description,
          text: data.text,
          imageUrl: finalImageUrl,
          featureStatus: newFeatureStatus,
          createdAt: now,
          updatedAt: now, 
        };
      
        const { data: insertedData, error: insertError } = await supabase
          .from('articles') 
          .insert([articleToInsert])
          .select()
          .single(); 
    
        if (insertError) throw insertError;
    
        toast({
          title: "¡Artículo Guardado!",
          description: `Tu artículo "${insertedData?.title || ''}" ha sido guardado.`,
        });
      }
      fetchArticles(); 
      resetFormAndPreview(); 
    } catch (error: any) {
       let description = "No se pudo guardar/actualizar el artículo. Inténtalo de nuevo.";
       const errorCode = (typeof error?.code === 'string') ? error.code : "";
       const errorMessageLowerCase = (typeof error?.message === 'string') ? error.message.toLowerCase() : "";

       if (errorCode === 'PGRST116' || (errorMessageLowerCase.includes('relation') && errorMessageLowerCase.includes('does not exist')) || (error?.status === 404 && (errorMessageLowerCase.includes('not found') || errorMessageLowerCase.includes('no existe')))) {
          description = "Error CRÍTICO 404 (Not Found): La tabla 'articles' PARECE NO EXISTIR o no es accesible. Por favor, VERIFICA URGENTEMENTE tu configuración de tabla 'articles' y sus políticas RLS en el panel de Supabase. Asegúrate que tenga las columnas 'slug', 'description' y 'featureStatus' de tipo TEXT.";
       } else if (error?.message && error.message.includes("violates check constraint") && error.message.includes("feature_status_types")) {
          description = `Error de Base de Datos: El valor proporcionado para 'featureStatus' no es válido. Valores permitidos son 'destacada', 'noticia2', 'noticia3' o NULL. Error original: ${error.message}.`;
       } else if (error?.message && (error.message.includes("column \"slug\" of relation \"articles\" does not exist") || error.message.includes("column \"description\" of relation \"articles\" does not exist") )) {
          description = `Error de Base de Datos: Las columnas 'slug' y/o 'description' NO EXISTEN en la tabla 'articles'. Por favor, añádelas en tu panel de Supabase (como tipo TEXT). Error original: ${error.message}.`;
       }
       else if (error?.message) {
         description = `Error al guardar/actualizar: ${error.message}.`;
       }
       toast({
          title: "Error al Guardar/Actualizar Artículo",
          description: `${description} Revisa la consola y los logs de Supabase para más detalles.`,
          variant: "destructive",
          duration: 15000,
       });
    }
    setIsSubmitting(false);
  }, [form, editingArticleId, toast, fetchArticles, resetFormAndPreview]);
  
  const handleFileChange = React.useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (!file.type.startsWith("image/")) {
        toast({
          title: "Tipo de archivo no válido",
          description: "Por favor, sube un archivo de imagen.",
          variant: "destructive",
        });
        return;
      }
      if (file.size > 5 * 1024 * 1024) { 
         toast({
          title: "Archivo demasiado grande",
          description: "Por favor, sube una imagen de menos de 5MB.",
          variant: "destructive",
        });
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        form.setValue('imageUrl', reader.result as string, { shouldValidate: true });
      };
      reader.readAsDataURL(file);
    }
  }, [form, toast]);
  

  const handleEdit = React.useCallback((article: NewsArticle) => {
    if (!article.id) {
      toast({ title: "Error", description: "No se puede editar un artículo sin ID.", variant: "destructive" });
      return;
    }
    setEditingArticleId(article.id);
    form.reset({
      title: article.title,
      slug: article.slug || generateSlug(article.title),
      description: article.description || '',
      text: article.text,
      imageUrl: article.imageUrl || '',
      featureStatus: article.featureStatus, 
    });
    setSuggestedTitles([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    editorFormCardRef.current?.scrollIntoView({ behavior: 'smooth' });
    toast({ title: "Modo Edición", description: `Editando artículo: ${article.title}` });
  }, [form, toast]);

  const cancelEdit = React.useCallback(() => {
    resetFormAndPreview();
    toast({ title: "Edición Cancelada" });
  }, [resetFormAndPreview, toast]);

  const handleDelete = React.useCallback((article: NewsArticle) => {
    if (!article.id) {
      toast({ title: "Error", description: "No se puede eliminar un artículo sin ID.", variant: "destructive" });
      return;
    }
    setArticleToDelete(article);
    setShowDeleteConfirmDialog(true);
  }, [toast]);

  const confirmDelete = React.useCallback(async () => {
    if (!articleToDelete || !articleToDelete.id) return;
    setIsSubmitting(true); 

    try {
      const { error: deleteError } = await supabase
        .from('articles')
        .delete()
        .eq('id', articleToDelete.id);

      if (deleteError) throw deleteError;

      toast({ title: "Artículo Eliminado", description: `El artículo "${articleToDelete.title}" ha sido eliminado.` });
      fetchArticles();
      if (editingArticleId === articleToDelete.id) {
        cancelEdit();
      }
    } catch (error: any) {
      let description = "No se pudo eliminar el artículo. Inténtalo de nuevo.";
      if (error?.message) {
        description = `Error: ${error.message}`;
      }
      toast({ title: "Error al Eliminar Artículo", description: `${description} Revisa la consola para más detalles.`, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
      setShowDeleteConfirmDialog(false);
      setArticleToDelete(null);
    }
  }, [articleToDelete, editingArticleId, fetchArticles, cancelEdit, toast]);

  return (
    <div className="container mx-auto px-4 py-8">
      <header className="flex flex-col sm:flex-row items-center justify-center text-center mb-8 gap-3 sm:gap-4">
        <h1 className="text-4xl font-bold tracking-tight text-primary uppercase">Editor NewsFlash</h1>
      </header>
      <div className="mb-6 text-left">
        <Link href="/" passHref legacyBehavior>
          <Button variant="default" size="sm">
            <Home className="mr-2 h-4 w-4" />
            Volver al Inicio
          </Button>
        </Link>
      </div>

      <div className="grid lg:grid-cols-2 gap-12 items-start">
        <Card className="shadow-xl" ref={editorFormCardRef}>
          <CardHeader>
            <CardTitle>{editingArticleId ? "Editar Artículo" : "Crear Nuevo Artículo"}</CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Título</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="slug"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Slug (URL amigable)</FormLabel>
                      <FormControl>
                        <Input {...field} readOnly className="bg-muted/50 cursor-not-allowed" />
                      </FormControl>
                      <FormDescription>Este es el fragmento de URL generado para SEO.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Descripción (Meta Tag)</FormLabel>
                      <FormControl>
                        <Textarea 
                          {...field} 
                          rows={3} 
                          maxLength={160}
                          value={field.value || ''} 
                        />
                      </FormControl>
                       <FormDescription>Ideal para SEO y cómo se muestra en redes sociales.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="text"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Texto del Artículo</FormLabel>
                      <FormControl>
                        <Textarea {...field} rows={10} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="imageUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>URL de Imagen o Subir</FormLabel>
                      <div className="flex flex-col sm:flex-row gap-2 items-start">
                        <FormControl className="flex-grow">
                          <Input 
                            value={field.value === "https://placehold.co/600x400.png" ? "" : field.value}
                            onChange={e => {
                              field.onChange(e.target.value);
                            }}
                          />
                        </FormControl>
                        <Button type="button" variant="default" onClick={() => fileInputRef.current?.click()} className="w-full sm:w-auto">
                          <Upload className="mr-2 h-4 w-4" />
                          Subir Imagen
                        </Button>
                        <input
                          type="file"
                          ref={fileInputRef}
                          className="hidden"
                          accept="image/*"
                          onChange={handleFileChange}
                        />
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                {watchedImageUrl && watchedImageUrl !== 'https://placehold.co/600x400.png' && (watchedImageUrl.startsWith('http') || watchedImageUrl.startsWith('data:image')) && (
                  <div className="relative w-full max-w-xs h-32 rounded-md overflow-hidden border">
                     <Image src={watchedImageUrl} alt="Vista previa de la imagen actual" fill style={{objectFit: "cover"}} onError={(e) => e.currentTarget.src = 'https://placehold.co/600x400.png'} data-ai-hint="imagen previa"/>
                  </div>
                )}

                <FormField
                  control={form.control}
                  name="featureStatus"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Estado de Noticia</FormLabel>
                      <Select 
                        onValueChange={(value) => field.onChange(value === 'null' ? null : value as NewsArticleFormValues['featureStatus'])} 
                        value={field.value === null ? 'null' : field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecciona un estado" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {featureStatusOptions.map(option => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {suggestedTitles.length > 0 && (
                  <div className="space-y-2 p-3 border rounded-md bg-secondary/50">
                    <h4 className="font-semibold text-sm text-secondary-foreground">Títulos Alternativos:</h4>
                    <ul className="list-disc list-inside space-y-1">
                      {suggestedTitles.map((title, index) => (
                        <li key={index} className="text-sm text-secondary-foreground/90">
                          <Button
                            variant="link"
                            size="sm"
                            className="p-0 h-auto text-left text-primary hover:underline"
                            onClick={() => form.setValue('title', title, { shouldValidate: true })}
                          >
                            {title}
                          </Button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                
                <div className="flex flex-col sm:flex-row items-center gap-2 pt-4">
                  <Button 
                    type="button" 
                    onClick={handleSuggestTitles} 
                    disabled={isSuggestingTitles || !form.getValues('text') || form.getValues('text').length < 20} 
                    className="w-full sm:w-auto"
                  >
                    {isSuggestingTitles ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="mr-2 h-4 w-4" />
                    )}
                    Sugerir Títulos
                  </Button>
                  <Button 
                    type="submit" 
                    variant="destructive"
                    disabled={isSubmitting} 
                    className="w-full sm:flex-1"
                  >
                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                    {editingArticleId ? 'Actualizar Artículo' : 'Guardar Artículo'}
                  </Button>
                  {editingArticleId && (
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={cancelEdit} 
                      className="w-full sm:w-auto"
                    >
                      <XCircle className="mr-2 h-4 w-4" />
                      Cancelar Edición
                    </Button>
                  )}
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>

        <div className="space-y-3 max-h-[calc(100vh-10rem)] overflow-y-auto pr-2">
          {isLoadingArticles && (
            <div className="flex justify-center items-center py-10">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="ml-2 text-muted-foreground">Cargando artículos...</p>
            </div>
          )}
          {errorLoadingArticles && (
             <Alert variant="destructive">
               <Newspaper className="h-4 w-4" />
               <ShadcnAlertTitle>Error al Cargar Artículos</ShadcnAlertTitle>
               <ShadcnAlertDescription>{errorLoadingArticles}</ShadcnAlertDescription>
             </Alert>
          )}
          {!isLoadingArticles && !errorLoadingArticles && articles.length === 0 && (
            <div className="text-center py-10">
              <Newspaper className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
              <p className="text-muted-foreground">No hay artículos guardados todavía.</p>
              <p className="text-sm text-muted-foreground">Usa el editor para crear tu primer artículo.</p>
            </div>
          )}
          {!isLoadingArticles && !errorLoadingArticles && articles.length > 0 && (
              articles.map((article, index) => (
                <ArticleListItem
                  key={article.id || index} 
                  article={article}
                  index={index}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  isSubmitting={isSubmitting}
                  formatDate={formatDate}
                  translateFeatureStatus={translateFeatureStatus}
                />
              ))
            
          )}
        </div>
      </div>

      <AlertDialog open={showDeleteConfirmDialog} onOpenChange={setShowDeleteConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeaderComponent>
            <AlertDialogTitleComponent>¿Estás absolutamente seguro?</AlertDialogTitleComponent>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Esto eliminará permanentemente el artículo 
              "{articleToDelete?.title || 'seleccionado'}" de la base de datos.
            </AlertDialogDescription>
          </AlertDialogHeaderComponent>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setShowDeleteConfirmDialog(false); setArticleToDelete(null); }}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={isSubmitting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}
