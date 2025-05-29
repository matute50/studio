
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
import { Label }
from '@/components/ui/label'; 
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Sparkles, Send, RotateCcw, Upload, Newspaper, ImageOff } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";


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

  const [articles, setArticles] = React.useState<NewsArticle[]>([]);
  const [isLoadingArticles, setIsLoadingArticles] = React.useState(true);
  const [errorLoadingArticles, setErrorLoadingArticles] = React.useState<string | null>(null);

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

  const onSubmit = async (data: NewsArticleFormValues) => {
    setIsSubmitting(true);
    let finalImageUrl = data.imageUrl;
  
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
  
    const articleToInsert = {
      title: data.title,
      text: data.text,
      imageUrl: finalImageUrl, 
      isFeatured: data.isFeatured,
      // createdAt y updatedAt son gestionados por Supabase si las columnas existen con valores por defecto
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
        description: "Tu artículo de noticias ha sido guardado en Supabase.",
      });
      fetchArticles(); 
      resetFormAndPreview(); 
    } catch (error: any) {
      console.error("--- ERROR AL GUARDAR ARTÍCULO EN SUPABASE (Inicio del bloque catch) ---");
      
      let specificErrorMessage = "No se pudo obtener un mensaje de error específico del cliente.";
      let errorCode = "Desconocido";
      let errorStatus = "Desconocido";

      if (error && typeof error.message === 'string' && error.message.trim() !== '') {
        specificErrorMessage = error.message;
      } else if (error && typeof error.details === 'string' && error.details.trim() !== '') {
        specificErrorMessage = error.details;
      }
      
      if (error && typeof error.code === 'string' && error.code.trim() !== '') {
         errorCode = error.code;
      }
       if (error && typeof error.status === 'number') {
         errorStatus = error.status.toString();
      }


      const isLikelyNotFoundError = 
        (errorStatus === '404') || 
        (typeof specificErrorMessage === 'string' && specificErrorMessage.toLowerCase().includes('relation') && specificErrorMessage.toLowerCase().includes('does not exist')) ||
        (typeof specificErrorMessage === 'string' && specificErrorMessage.toLowerCase().includes('not found')) ||
        (errorCode === 'PGRST116'); 
  
      let toastDescription = `Falló el intento de guardar en Supabase. Código: ${errorCode}, Estado: ${errorStatus}. Mensaje: "${specificErrorMessage}".`;
      
      if (isLikelyNotFoundError) {
        toastDescription = `Error crítico: La tabla 'articles' parece NO EXISTIR o no es accesible (Error 404 o similar - Código: ${errorCode}, Estado: ${errorStatus}). Por favor, VERIFICA URGENTEMENTE tu configuración de tabla 'articles' y sus políticas RLS en el panel de Supabase. Asegúrate de que la tabla esté creada en el esquema 'public' y que las columnas coincidan con las esperadas (title, text, imageUrl, isFeatured, createdAt, updatedAt).`;
      } else {
        toastDescription += ` Por favor, revisa la consola del navegador y, más importante aún, los logs de API y Base de Datos en tu panel de Supabase para más detalles. Un error común es no tener la tabla 'articles' creada o accesible, o que las políticas RLS impidan la inserción.`;
      }
  
      toast({
        title: "Error Crítico al Guardar Artículo",
        description: toastDescription,
        variant: "destructive",
        duration: 15000, 
      });
    } finally {
      setIsSubmitting(false);
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
    toast({
      title: "Formulario Reiniciado",
      description: "El editor ha sido limpiado.",
    });
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
    if (!dateString) { // Catches null, undefined, ""
      return 'Fecha desconocida';
    }
    try {
      const date = new Date(dateString);
      // Check if the date is valid after parsing
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
      // This catch might be redundant if isNaN check is robust, but keep for safety
      console.error("Error inesperado en 'formatDate' al procesar:", dateString, e);
      return 'Error al formatear fecha';
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <header className="mb-8 text-center">
        <h1 className="text-4xl font-bold tracking-tight text-primary">Editor NewsFlash</h1>
        <p className="text-muted-foreground mt-2">Crea noticias impactantes con asistencia de IA y guárdalas en Supabase.</p>
      </header>

      <div className="grid lg:grid-cols-2 gap-12 items-start">
        <Card className="shadow-xl">
          <CardHeader>
            <CardTitle>Editor de Artículos</CardTitle>
            <CardDescription>Completa los detalles de tu artículo de noticias. Se guardará en Supabase.</CardDescription>
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
                      <FormDescription>
                        Introduce una URL de imagen o sube una imagen (max 5MB). Deja vacío para un marcador de posición predeterminado.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                {watchedImageUrl && watchedImageUrl !== 'https://placehold.co/600x400.png' && (watchedImageUrl.startsWith('http') || watchedImageUrl.startsWith('data:image')) && (
                  <div className="relative w-full max-w-xs h-32 rounded-md overflow-hidden border">
                     <Image src={watchedImageUrl} alt="Vista previa de la imagen actual" layout="fill" objectFit="cover" onError={(e) => e.currentTarget.src = 'https://placehold.co/600x400.png'} data-ai-hint="imagen previa"/>
                  </div>
                )}


                <FormField
                  control={form.control}
                  name="isFeatured"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                      <div className="space-y-0.5">
                        <FormLabel>Artículo Destacado</FormLabel>
                        <FormDescription>
                          Marcar este artículo como destacado.
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <div className="space-y-4">
                  <Button type="button" onClick={handleSuggestTitles} disabled={isSuggestingTitles || !form.getValues('text') || form.getValues('text').length < 20} className="w-full sm:w-auto">
                    {isSuggestingTitles ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="mr-2 h-4 w-4" />
                    )}
                    Sugerir Títulos
                  </Button>

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
                </div>
                
                <div className="flex flex-col sm:flex-row gap-2 pt-4">
                  <Button type="submit" disabled={isSubmitting} className="flex-1">
                    {isSubmitting ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                       <Send className="mr-2 h-4 w-4" />
                    )}
                    Guardar Artículo
                  </Button>
                   <Button type="button" variant="outline" onClick={resetFormAndPreview} className="flex-1 sm:flex-none">
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Reiniciar Formulario
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <CardHeader className="px-0 pt-0 lg:px-2 pb-2">
            <CardTitle>Artículos Guardados</CardTitle>
            <CardDescription>Lista de todos los artículos de noticias almacenados en Supabase.</CardDescription>
          </CardHeader>
          {isLoadingArticles && (
            <div className="flex justify-center items-center py-10">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="ml-2 text-muted-foreground">Cargando artículos...</p>
            </div>
          )}
          {errorLoadingArticles && (
             <Alert variant="destructive">
               <Newspaper className="h-4 w-4" />
               <AlertTitle>Error al Cargar Artículos</AlertTitle>
               <AlertDescription>{errorLoadingArticles}</AlertDescription>
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
            <div className="space-y-3 max-h-[calc(100vh-10rem)] overflow-y-auto pr-2">
              {articles.map((article) => (
                <Card key={article.id} className="shadow-md hover:shadow-lg transition-shadow">
                  <CardHeader className="pb-2 pt-3 px-4">
                    <div className="flex justify-between items-start">
                        <CardTitle className="text-base font-semibold break-words">{article.title}</CardTitle>
                        {article.isFeatured && (
                            <Badge className="ml-2 whitespace-nowrap bg-accent text-accent-foreground text-xs px-1.5 py-0.5">Destacado</Badge>
                        )}
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
                   <CardFooter className="text-xs text-muted-foreground pt-0 pb-2 px-4 justify-end">
                      <p>Publicado: {formatDate(article.createdAt)}</p>
                   </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

    

