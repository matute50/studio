
"use client";

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import Image from 'next/image';

import { suggestAlternativeTitles, SuggestAlternativeTitlesInput } from '@/ai/flows/suggest-alternative-titles';
import { supabase, uploadImageToSupabase } from '@/lib/supabaseClient'; 

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label'; 
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { NewsPreview } from './news-preview';
import { Loader2, Sparkles, Send, RotateCcw, Upload } from 'lucide-react';

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

  const watchedTitle = form.watch('title');
  const watchedText = form.watch('text');
  const watchedImageUrl = form.watch('imageUrl');
  const watchedIsFeatured = form.watch('isFeatured');

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

    if (data.imageUrl.startsWith('data:image/')) {
      toast({ title: "Subiendo imagen...", description: "Por favor espera un momento." });
      const uploadedUrl = await uploadImageToSupabase(data.imageUrl, 'imagenes-noticias'); 
      
      if (uploadedUrl) {
        finalImageUrl = uploadedUrl;
        toast({
          title: "Imagen Subida",
          description: "La imagen se ha subido correctamente a Supabase Storage.",
        });
      } else {
        toast({
          title: "Error al Subir Imagen",
          description: "No se pudo subir la imagen. Verifica los permisos de tu bucket ('imagenes-noticias') en Supabase (RLS) y los logs del servidor de Supabase para más detalles. El artículo se guardará con la imagen de marcador de posición o la URL original.",
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
      image_url: finalImageUrl,
      is_featured: data.isFeatured,
    };

    try {
      const { error: insertError } = await supabase
        .from('articles') 
        .insert([articleToInsert])
        .select(); 

      if (insertError) {
        throw insertError;
      }

      toast({
        title: "¡Artículo Guardado!",
        description: "Tu artículo de noticias ha sido guardado en Supabase.",
      });
      resetFormAndPreview(); 
    } catch (error: any) {
      console.error("--- ERROR AL GUARDAR ARTÍCULO EN SUPABASE (Inicio del bloque catch) ---");
      
      // The following detailed console logs for the 'error' object were removed 
      // as they seemed to interfere with the console's ability to log subsequent messages
      // when the error object from Supabase was problematic.
      // The primary debugging path for Supabase DB errors should be the Supabase Dashboard logs.

      let displayMessage = 'Error desconocido al guardar el artículo.';
      if (error && typeof error.message === 'string' && error.message.trim() !== '') {
        displayMessage = error.message;
      } else if (error && typeof error.code === 'string' && error.code.trim() !== '') {
        displayMessage = `Error con código: ${error.code}.`;
      }
      
      toast({
        title: "Error al Guardar Artículo",
        description: `No se pudo guardar el artículo. ${displayMessage} Por favor, revisa la consola del navegador para mensajes iniciales y, MUY IMPORTANTE, los logs de tu API y Base de Datos en el panel de Supabase para el detalle completo del error.`,
        variant: "destructive",
        duration: 10000, // Longer duration for this important message
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
    toast({
      title: "Formulario Reiniciado",
      description: "El editor y la vista previa han sido limpiados.",
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
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
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
    if (event.target) {
      event.target.value = ""; 
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <header className="mb-8 text-center">
        <h1 className="text-4xl font-bold tracking-tight text-primary">Editor NewsFlash</h1>
        <p className="text-muted-foreground mt-2">Crea noticias impactantes con asistencia de IA y guárdalas en Supabase.</p>
      </header>

      <div className="grid lg:grid-cols-2 gap-8 items-start">
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
                  <Button type="button" onClick={handleSuggestTitles} disabled={isSuggestingTitles || watchedText.length < 20} className="w-full sm:w-auto">
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

        <div className="sticky top-8">
          <CardHeader className="px-0 pt-0 lg:px-4">
            <CardTitle>Vista Previa en Vivo</CardTitle>
            <CardDescription>Mira cómo tu artículo toma forma en tiempo real.</CardDescription>
          </CardHeader>
          <NewsPreview
            title={watchedTitle}
            text={watchedText}
            imageUrl={watchedImageUrl}
            isFeatured={watchedIsFeatured}
          />
        </div>
      </div>
    </div>
  );
}
