
"use client";

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import Image from 'next/image';
import type { NewsArticle } from '@/types';

import { suggestAlternativeTitles, SuggestAlternativeTitlesInput } from '@/ai/flows/suggest-alternative-titles';
import { supabase, uploadImageToSupabase } from '@/lib/supabaseClient'; 

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label'; 
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from '@/hooks/use-toast';
import { Loader2, Sparkles, Send, Upload, Newspaper, ImageOff, Edit3, Trash2, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription as ShadcnAlertDescription, AlertTitle as ShadcnAlertTitle } from "@/components/ui/alert";


const newsArticleSchema = z.object({
  title: z.string().min(5, { message: "El título debe tener al menos 5 caracteres." }).max(150, { message: "El título debe tener 150 caracteres o menos." }),
  text: z.string().min(20, { message: "El texto del artículo debe tener al menos 20 caracteres." }),
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
  isFeatured: z.boolean().default(false), 
});

type NewsArticleFormValues = z.infer<typeof newsArticleSchema>;

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
  const [isTogglingFeature, setIsTogglingFeature] = React.useState(false);

  const [editingArticleId, setEditingArticleId] = React.useState<string | null>(null);
  const [showDeleteConfirmDialog, setShowDeleteConfirmDialog] = React.useState(false);
  const [articleToDelete, setArticleToDelete] = React.useState<NewsArticle | null>(null);


  const form = useForm<NewsArticleFormValues>({
    resolver: zodResolver(newsArticleSchema),
    defaultValues: {
      title: '',
      text: '',
      imageUrl: '', 
      isFeatured: false,
    },
    mode: "onChange",
  });

  const watchedImageUrl = form.watch('imageUrl');

  const fetchArticles = async () => {
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
      console.error("Error cargando artículos:", error);
      setErrorLoadingArticles(`No se pudieron cargar los artículos: ${error.message}`);
      toast({
        title: "Error al Cargar Artículos",
        description: `No se pudieron cargar los artículos guardados: ${error.message}`,
        variant: "destructive",
      });
    } finally {
      setIsLoadingArticles(false);
    }
  };

  React.useEffect(() => {
    fetchArticles();
  }, []);

  const handleSuggestTitles = async () => {
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
      console.error("Error al sugerir títulos:", error);
      toast({
        title: "Error",
        description: "Error al sugerir títulos. Por favor, inténtalo de nuevo.",
        variant: "destructive",
      });
    } finally {
      setIsSuggestingTitles(false);
    }
  };

  const resetFormAndPreview = () => {
    form.reset({
      title: '',
      text: '',
      imageUrl: '',
      isFeatured: false, 
    });
    setSuggestedTitles([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = ""; 
    }
  };

  const onSubmit = async (data: NewsArticleFormValues) => {
    setIsSubmitting(true);
    let finalImageUrl = data.imageUrl;
    const now = new Date().toISOString();
  
    if (data.imageUrl && data.imageUrl.startsWith('data:image/')) {
      toast({ title: "Subiendo imagen...", description: "Por favor espera un momento." });
      const uploadedUrl = await uploadImageToSupabase(data.imageUrl, 'imagenes-noticias'); 
      
      if (uploadedUrl) {
        finalImageUrl = uploadedUrl;
        form.setValue('imageUrl', uploadedUrl); 
        toast({
          title: "Imagen Subida",
          description: "La imagen se ha subido correctamente a Supabase Storage.",
        });
      } else {
        toast({
          title: "Error al Subir Imagen",
          description: "No se pudo subir la imagen. Verifica los permisos de tu bucket ('imagenes-noticias') en Supabase (RLS) y los logs del servidor de Supabase para más detalles. Un error 400/403 usualmente indica un problema de RLS. El artículo se guardará con la imagen de marcador de posición o la URL original si la subida falla.",
          variant: "destructive",
          duration: 9000, 
        });
        setIsSubmitting(false);
        return; 
      }
    }

    if (editingArticleId) { 
      const articleToUpdate = { // No es necesario NewsArticle completo, solo campos a actualizar
        title: data.title,
        text: data.text,
        imageUrl: finalImageUrl,
        updatedAt: now,
        // isFeatured no se actualiza desde el formulario principal de edición
      };

      try {
        const { data: updatedData, error: updateError } = await supabase
          .from('articles')
          .update(articleToUpdate)
          .eq('id', editingArticleId)
          .select()
          .single();

        if (updateError) throw updateError;

        toast({ title: "Artículo Actualizado", description: `El artículo "${updatedData?.title || ''}" ha sido actualizado.` });
        fetchArticles();
        resetFormAndPreview();
        setEditingArticleId(null);
      } catch (error: any) {
         console.error("Error al actualizar artículo:", error);
         let description = "No se pudo actualizar el artículo. Inténtalo de nuevo.";
         if (error?.message) {
           description = `Error: ${error.message}`;
         }
         toast({
            title: "Error al Actualizar Artículo",
            description: `${description} Revisa la consola y los logs de Supabase para más detalles.`,
            variant: "destructive",
            duration: 9000,
         });
      } finally {
        setIsSubmitting(false);
      }
    } else { 
      const articleToInsert = { // No es necesario NewsArticle completo, solo campos a insertar
        title: data.title,
        text: data.text,
        imageUrl: finalImageUrl,
        isFeatured: data.isFeatured, // Se mantiene el valor del formulario (aunque siempre será false por defecto si se eliminó el switch)
        updatedAt: now, 
        createdAt: now,
      };
    
      try {
        const { data: insertedData, error: insertError } = await supabase
          .from('articles') 
          .insert([articleToInsert])
          .select()
          .single(); 
    
        if (insertError) {
          throw insertError; 
        }
    
        toast({
          title: "¡Artículo Guardado!",
          description: `Tu artículo "${insertedData?.title || ''}" ha sido guardado en Supabase.`,
        });
        fetchArticles(); 
        resetFormAndPreview(); 
      } catch (error: any) {
        console.error("Error al crear artículo:", error);
        let description = "No se pudo crear el artículo. Inténtalo de nuevo.";
        if (error?.message) {
          description = `Error: ${error.message}`;
        }
        
        const errorCode = (typeof error?.code === 'string') ? error.code : "";
        const errorMessageLowerCase = (typeof error?.message === 'string') ? error.message.toLowerCase() : "";

        if (errorCode === 'PGRST116' || (errorMessageLowerCase.includes('relation') && errorMessageLowerCase.includes('does not exist'))) {
          description = "Error CRÍTICO: La tabla 'articles' no existe o no es accesible en Supabase. Por favor, verifica la configuración de tu base de datos.";
        } else if (error?.status === 404 && (errorMessageLowerCase.includes('not found') || errorMessageLowerCase.includes('no existe'))) {
           description = "Error CRÍTICO 404 (Not Found): La tabla 'articles' PARECE NO EXISTIR o no es accesible. Por favor, VERIFICA URGENTEMENTE tu configuración de tabla 'articles' y sus políticas RLS en el panel de Supabase.";
        }
    
        toast({
          title: "Error al Crear Artículo",
          description: `${description} Revisa la consola y los logs de Supabase para más detalles.`,
          variant: "destructive",
          duration: 10000, 
        });
      } finally {
        setIsSubmitting(false);
      }
    }
  };
  
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
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
  };
  
  const formatDate = (dateString?: string | null) => {
    if (!dateString) { 
      return 'Fecha desconocida';
    }
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        console.warn(`'formatDate' recibió una cadena de fecha inválida que no pudo ser parseada: "${dateString}"`);
        return 'Fecha inválida';
      }
      return date.toLocaleDateString('es-ES', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch (e) {
      console.error("Error inesperado en 'formatDate' al procesar:", dateString, e);
      return 'Error al formatear fecha';
    }
  };

  const handleFeatureToggle = async (articleId: string, newFeaturedState: boolean) => {
    setIsTogglingFeature(true);
    try {
      const now = new Date().toISOString();

      if (newFeaturedState) {
        // Desmarcar cualquier otro artículo destacado
        const { error: unfeatureError } = await supabase
          .from('articles')
          .update({ isFeatured: false, updatedAt: now })
          .eq('isFeatured', true)
          .neq('id', articleId); 

        if (unfeatureError) {
          console.error("Error al desmarcar otros artículos:", unfeatureError);
          // Considerar si este error debe detener el proceso o solo registrarse
        }

        // Marcar el artículo actual como destacado
        const { error: featureError } = await supabase
          .from('articles')
          .update({ isFeatured: true, updatedAt: now })
          .eq('id', articleId);

        if (featureError) {
          console.error("Error al marcar artículo como destacado:", featureError);
          throw featureError; // Lanzar para que se maneje en el catch general
        }
      } else {
        // Simplemente desmarcar el artículo actual
        const { error: unfeatureError } = await supabase
          .from('articles')
          .update({ isFeatured: false, updatedAt: now })
          .eq('id', articleId);

        if (unfeatureError) {
          console.error("Error al desmarcar artículo:", unfeatureError);
          throw unfeatureError; // Lanzar para que se maneje en el catch general
        }
      }

      toast({ title: "Estado de Destacado Actualizado", description: "El artículo ha sido actualizado." });
      fetchArticles(); // Recargar artículos para reflejar el cambio
    } catch (error: any) {
      toast({
        title: "Error al Actualizar Destacado",
        description: error.message || "No se pudo actualizar el estado de destacado del artículo.",
        variant: "destructive",
      });
    } finally {
      setIsTogglingFeature(false);
    }
  };

  const handleEdit = (article: NewsArticle) => {
    if (!article.id) {
      toast({ title: "Error", description: "No se puede editar un artículo sin ID.", variant: "destructive" });
      return;
    }
    setEditingArticleId(article.id);
    form.reset({
      title: article.title,
      text: article.text,
      imageUrl: article.imageUrl || '',
      isFeatured: article.isFeatured, 
    });
    setSuggestedTitles([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    editorFormCardRef.current?.scrollIntoView({ behavior: 'smooth' });
    toast({ title: "Modo Edición", description: `Editando artículo: ${article.title}` });
  };

  const cancelEdit = () => {
    setEditingArticleId(null);
    resetFormAndPreview();
    toast({ title: "Edición Cancelada" });
  };

  const handleDelete = (article: NewsArticle) => {
    if (!article.id) {
      toast({ title: "Error", description: "No se puede eliminar un artículo sin ID.", variant: "destructive" });
      return;
    }
    setArticleToDelete(article);
    setShowDeleteConfirmDialog(true);
  };

  const confirmDelete = async () => {
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
      console.error("Error al eliminar artículo:", error);
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
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <header className="mb-8 text-center">
        <h1 className="text-4xl font-bold tracking-tight text-primary">Editor NewsFlash</h1>
      </header>

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
                        <Input placeholder="Introduce el título del artículo" {...field} />
                      </FormControl>
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
                        <Textarea placeholder="Escribe tu artículo de noticias aquí..." {...field} rows={10} />
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
                            placeholder="https://ejemplo.com/imagen.png o subir" 
                            {...field} 
                            value={field.value === "https://placehold.co/600x400.png" ? "" : field.value}
                            onChange={e => {
                              field.onChange(e.target.value);
                            }}
                          />
                        </FormControl>
                        <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} className="w-full sm:w-auto">
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
                     <Image src={watchedImageUrl} alt="Vista previa de la imagen actual" layout="fill" objectFit="cover" onError={(e) => e.currentTarget.src = 'https://placehold.co/600x400.png'} data-ai-hint="imagen previa"/>
                  </div>
                )}

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
                    disabled={isSubmitting || isTogglingFeature} 
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
              articles.map((article) => (
                <Card key={article.id} className="shadow-md hover:shadow-lg transition-shadow">
                  <CardHeader className="pb-2 pt-3 px-4">
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex-grow">
                        <CardTitle className="text-base font-semibold break-words">{article.title}</CardTitle>
                      </div>
                      <div className="flex flex-col items-end space-y-1 flex-shrink-0">
                        {article.isFeatured && (
                          <Badge className="whitespace-nowrap bg-accent text-accent-foreground text-xs px-1.5 py-0.5">Destacado</Badge>
                        )}
                        <div className="flex items-center space-x-1"> 
                          <Label htmlFor={`featured-switch-${article.id}`} className="text-xs text-muted-foreground">
                            Destacado
                          </Label>
                          <Switch
                            id={`featured-switch-${article.id}`}
                            checked={!!article.isFeatured}
                            onCheckedChange={(isChecked) => {
                              if (article.id) {
                                handleFeatureToggle(article.id, isChecked);
                              } else {
                                toast({title: "Error", description: "Falta ID del artículo para cambiar estado.", variant: "destructive"});
                              }
                            }}
                            disabled={isTogglingFeature}
                            className="data-[state=checked]:bg-accent data-[state=unchecked]:bg-input h-5 w-9 [&>span]:h-4 [&>span]:w-4 [&>span]:data-[state=checked]:translate-x-4" 
                            aria-label={`Marcar ${article.title} como destacado`}
                          />
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="grid grid-cols-1 md:grid-cols-[80px_1fr] gap-3 items-start pt-0 pb-3 px-4">
                    <div className="relative w-full md:w-[80px] h-[60px] rounded-md overflow-hidden border bg-muted">
                      {(article.imageUrl && (article.imageUrl.startsWith('http') || article.imageUrl.startsWith('data:image'))) ? (
                        <Image
                          src={article.imageUrl}
                          alt={`Imagen para ${article.title}`}
                          layout="fill"
                          objectFit="cover"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.src = 'https://placehold.co/80x60.png'; 
                            target.srcset = '';
                          }}
                          data-ai-hint="noticia miniatura"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-muted">
                           <ImageOff className="w-6 h-6 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                    <div className="space-y-1">
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
                        <Button variant="outline" size="sm" onClick={() => article.id && handleEdit(article)} disabled={isSubmitting || isTogglingFeature} className="h-7 px-2 py-1 text-xs">
                          <Edit3 className="mr-1 h-3 w-3" /> Editar
                        </Button>
                        <Button variant="destructive" size="sm" onClick={() => article.id && handleDelete(article)} disabled={isSubmitting || isTogglingFeature} className="h-7 px-2 py-1 text-xs">
                          <Trash2 className="mr-1 h-3 w-3" /> Eliminar
                        </Button>
                      </div>
                   </CardFooter>
                </Card>
              ))
            
          )}
        </div>
      </div>

      <AlertDialog open={showDeleteConfirmDialog} onOpenChange={setShowDeleteConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Estás absolutamente seguro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Esto eliminará permanentemente el artículo 
              "{articleToDelete?.title || 'seleccionado'}" de la base de datos.
            </AlertDialogDescription>
          </AlertDialogHeader>
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
    

    

    

