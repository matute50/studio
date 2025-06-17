
"use client";

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import Link from 'next/link';
import Image from 'next/image';
import type { VideoItem } from '@/types';

import { supabase, uploadImageToSupabase } from '@/lib/supabaseClient';
import { cn } from "@/lib/utils";

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription as AlertDialogDescriptionComponent, AlertDialogFooter, AlertDialogHeader as AlertDialogHeaderComponent, AlertDialogTitle as AlertDialogTitleComponent } from "@/components/ui/alert-dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save, Trash2, Edit3, XCircle, Home, Film, Link2, Tag, ListVideo, ChevronsUpDown, Check, PlusCircle, ImageOff } from 'lucide-react';
import { Alert, AlertDescription as ShadcnAlertDescription, AlertTitle as ShadcnAlertTitle } from "@/components/ui/alert";

const SUPABASE_TABLE_NAME = 'videos';
const IMAGE_VIDEOS_BUCKET_NAME = 'imagenvideos';

const videoSchema = z.object({
  nombre: z.string().min(3, { message: "El nombre del video debe tener al menos 3 caracteres." }).max(150, { message: "El nombre del video debe tener 150 caracteres o menos." }),
  url: z.string().url({ message: "Por favor, introduce una URL válida para el video." }),
  categoria: z.string().optional(),
  imagen: z.any().optional()
    .refine(value => {
      if (!value) return true;
      if (typeof value === 'string') return value.startsWith('http://') || value.startsWith('https://') || value.startsWith('data:image/');
      if (value instanceof File) return value.type.startsWith('image/');
      return false;
    }, { message: "Debe ser una URL de imagen válida o un archivo de imagen." })
    .refine(value => {
      if (value instanceof File) return value.size <= 5 * 1024 * 1024;
      return true;
    }, { message: "La imagen no debe exceder los 5MB." }),
});

type VideoFormValues = z.infer<typeof videoSchema>;

const getYoutubeThumbnailUrl = (youtubeUrl: string): string | null => {
  if (!youtubeUrl) return null;
  let videoId = null;
  try {
    const url = new URL(youtubeUrl);
    if (url.hostname === 'www.youtube.com' || url.hostname === 'youtube.com') {
      if (url.pathname.startsWith('/embed/')) {
        const pathParts = url.pathname.split('/embed/');
        if (pathParts[1]) {
          videoId = pathParts[1].split('?')[0];
        }
      } else {
        videoId = url.searchParams.get('v');
      }
    } else if (url.hostname === 'youtu.be') {
      const pathParts = url.pathname.substring(1);
      videoId = pathParts.split('?')[0];
    }
  } catch (e) {
    // Invalid URL or not a YouTube URL
    return null;
  }

  if (videoId) {
    return `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`; // Medium quality
  }
  return null;
};


export function VideoManager() {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [videos, setVideos] = React.useState<VideoItem[]>([]);
  const [isLoadingVideos, setIsLoadingVideos] = React.useState(true);
  const [errorLoadingVideos, setErrorLoadingVideos] = React.useState<string | null>(null);

  const [editingVideoId, setEditingVideoId] = React.useState<string | null>(null);
  const [showDeleteConfirmDialog, setShowDeleteConfirmDialog] = React.useState(false);
  const [videoToDelete, setVideoToDelete] = React.useState<VideoItem | null>(null);
  const editorFormCardRef = React.useRef<HTMLDivElement>(null);
  const imageFileRef = React.useRef<HTMLInputElement>(null);
  const [previewImage, setPreviewImage] = React.useState<string | null>(null);

  const [categories, setCategories] = React.useState<string[]>([]);
  const [isLoadingCategories, setIsLoadingCategories] = React.useState(false);
  const [isComboboxOpen, setIsComboboxOpen] = React.useState(false);

  const form = useForm<VideoFormValues>({
    resolver: zodResolver(videoSchema),
    defaultValues: {
      nombre: '',
      url: '',
      categoria: '',
      imagen: undefined,
    },
    mode: "onChange",
  });
  const watchedImagen = form.watch('imagen');

  const fetchCategories = async () => {
    setIsLoadingCategories(true);
    try {
      const { data, error } = await supabase
        .from(SUPABASE_TABLE_NAME)
        .select('categoria');

      if (error) throw error;

      const uniqueCategories = Array.from(
        new Set(data.map(item => item.categoria).filter(cat => cat && cat.trim() !== '') as string[])
      ).sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
      setCategories(uniqueCategories);
    } catch (catError: any) {
      toast({ title: "Error al Cargar Categorías", description: catError.message, variant: "destructive" });
      setCategories([]);
    } finally {
      setIsLoadingCategories(false);
    }
  };

  const fetchVideos = async () => {
    setIsLoadingVideos(true);
    setErrorLoadingVideos(null);
    try {
      const { data, error } = await supabase
        .from(SUPABASE_TABLE_NAME)
        .select('*')
        .order('createdAt', { ascending: false });

      if (error) throw error;
      setVideos(data || []);
    } catch (error: any) {
      const description = `No se pudieron cargar los videos: ${error.message || 'Error desconocido'}. Verifica que la tabla '${SUPABASE_TABLE_NAME}' exista y tenga RLS configuradas.`;
      setErrorLoadingVideos(description);
      toast({
        title: "Error al Cargar Videos",
        description,
        variant: "destructive",
      });
    } finally {
      setIsLoadingVideos(false);
    }
  };

  React.useEffect(() => {
    fetchVideos();
    fetchCategories();
  }, []);

  const resetForm = () => {
    form.reset({ nombre: '', url: '', categoria: '', imagen: undefined });
    setEditingVideoId(null);
    setPreviewImage(null);
    if (imageFileRef.current) {
      imageFileRef.current.value = "";
    }
  };

  const handleImageFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (!file.type.startsWith("image/")) {
        toast({ title: "Archivo no válido", description: "Por favor, sube una imagen.", variant: "destructive" });
        form.setValue('imagen', null, { shouldValidate: true });
        setPreviewImage(null);
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast({ title: "Archivo muy grande", description: "La imagen debe ser menor a 5MB.", variant: "destructive" });
        form.setValue('imagen', null, { shouldValidate: true });
        setPreviewImage(null);
        return;
      }
      form.setValue('imagen', file, { shouldValidate: true });
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      form.setValue('imagen', null, { shouldValidate: true });
      setPreviewImage(null);
    }
  };

  const onSubmit = async (data: VideoFormValues) => {
    setIsSubmitting(true);
    const now = new Date().toISOString();
    const categoriaToSave = data.categoria && data.categoria.trim() !== "" ? data.categoria.trim() : null;
    let finalImageUrlForSupabase: string | null = null;

    if (data.imagen instanceof File) {
      toast({ title: "Subiendo imagen del video...", description: "Por favor espera." });
      let dataUri: string;
      try {
        dataUri = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = (error) => reject(error);
          reader.readAsDataURL(data.imagen as File);
        });
      } catch (errorReadingFile) {
        toast({ title: "Error al leer archivo", description: "No se pudo procesar el archivo de imagen.", variant: "destructive" });
        setIsSubmitting(false);
        return;
      }

      const { url: supUrl, errorMessage } = await uploadImageToSupabase(dataUri, IMAGE_VIDEOS_BUCKET_NAME);
      if (errorMessage) {
        toast({ title: "Error al subir imagen", description: errorMessage, variant: "destructive", duration: 9000 });
        setIsSubmitting(false);
        return;
      }
      finalImageUrlForSupabase = supUrl;
    } else if (typeof data.imagen === 'string' && data.imagen.startsWith('http')) {
      finalImageUrlForSupabase = data.imagen;
    } else {
      finalImageUrlForSupabase = null;
    }

    try {
      const videoPayload: Omit<VideoItem, 'id' | 'createdAt' | 'updatedAt'> & { id?: string; createdAt?: string; updatedAt?: string } = {
        nombre: data.nombre,
        url: data.url,
        categoria: categoriaToSave,
        imagen: finalImageUrlForSupabase,
        updatedAt: now,
      };

      if (editingVideoId) {
        const { data: updatedData, error: updateError } = await supabase
          .from(SUPABASE_TABLE_NAME)
          .update(videoPayload)
          .eq('id', editingVideoId)
          .select()
          .single();
        if (updateError) throw updateError;
        toast({ title: "¡Video Actualizado!", description: `El video "${updatedData?.nombre}" ha sido actualizado.` });
      } else {
        videoPayload.createdAt = now;
        const { data: insertedData, error: insertError } = await supabase
          .from(SUPABASE_TABLE_NAME)
          .insert([videoPayload as VideoItem])
          .select()
          .single();
        if (insertError) throw insertError;
        toast({ title: "¡Video Guardado!", description: `El video "${insertedData?.nombre}" ha sido guardado.` });
      }
      fetchVideos();
      fetchCategories();
      resetForm();
    } catch (error: any) {
      toast({
        title: "Error al Guardar Video",
        description: `No se pudo guardar: ${error.message || 'Error desconocido'}.`,
        variant: "destructive",
        duration: 10000,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (videoToEdit: VideoItem) => {
    if (!videoToEdit.id) return;
    setEditingVideoId(videoToEdit.id);
    form.reset({
      nombre: videoToEdit.nombre,
      url: videoToEdit.url,
      categoria: videoToEdit.categoria || '',
      imagen: videoToEdit.imagen || undefined,
    });
    setPreviewImage(videoToEdit.imagen || null);
    if (imageFileRef.current) imageFileRef.current.value = "";
    editorFormCardRef.current?.scrollIntoView({ behavior: 'smooth' });
    toast({ title: "Modo Edición Video", description: `Editando video: ${videoToEdit.nombre}` });
  };

  const cancelEdit = () => {
    resetForm();
    toast({ title: "Edición de Video Cancelada" });
  };

  const handleDelete = (video: VideoItem) => {
    if (!video.id) return;
    setVideoToDelete(video);
    setShowDeleteConfirmDialog(true);
  };

  const confirmDelete = async () => {
    if (!videoToDelete || !videoToDelete.id) return;
    setIsSubmitting(true);
    try {
      const { error: deleteError } = await supabase
        .from(SUPABASE_TABLE_NAME)
        .delete()
        .eq('id', videoToDelete.id);
      if (deleteError) throw deleteError;
      toast({ title: "Video Eliminado", description: `El video "${videoToDelete.nombre}" ha sido eliminado.` });
      fetchVideos();
      fetchCategories();
      if (editingVideoId === videoToDelete.id) {
        cancelEdit();
      }
    } catch (error: any) {
      toast({ title: "Error al Eliminar Video", description: `No se pudo eliminar: ${error.message || 'Error desconocido'}.`, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
      setShowDeleteConfirmDialog(false);
      setVideoToDelete(null);
    }
  };
  
  const formatDate = (dateString?: string | null) => {
    if (!dateString) return 'Fecha desconocida';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'Fecha inválida';
      return date.toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric', hour:'2-digit', minute: '2-digit' });
    } catch (e: any) {
      return 'Error al formatear fecha';
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <header className="flex flex-col sm:flex-row items-center justify-center text-center mb-8 gap-3 sm:gap-4">
        <Film className="h-10 w-10 text-primary" />
        <h1 className="text-4xl font-bold tracking-tight text-primary uppercase">Gestor de Contenido Multimedia</h1>
      </header>
      <div className="mb-6 text-left">
        <Link href="/" passHref legacyBehavior>
          <Button variant="default" size="sm">
            <Home className="mr-2 h-4 w-4" />
            Volver al Inicio
          </Button>
        </Link>
      </div>

      <div className="grid lg:grid-cols-2 gap-8 items-start">
        <Card className="shadow-xl" ref={editorFormCardRef}>
          <CardHeader>
            <CardTitle>{editingVideoId ? "Editar Video" : "Añadir Nuevo Video"}</CardTitle>
            <CardDescription>
              Completa los detalles para añadir o actualizar un video.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="nombre"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nombre del Video</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="url"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>URL del Video</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                 <FormField
                  control={form.control}
                  name="imagen"
                  render={() => (
                    <FormItem>
                      <FormLabel>Imagen del Video (Opcional)</FormLabel>
                      <div className="flex flex-col gap-2">
                        <Input
                          id="imagen"
                          type="file"
                          ref={imageFileRef}
                          accept="image/*"
                          onChange={handleImageFileChange}
                          className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
                        />
                         {(previewImage || (typeof watchedImagen === 'string' && watchedImagen.startsWith('http'))) && (
                          <div className="relative w-full max-w-xs h-32 rounded-md overflow-hidden border bg-muted mt-2">
                            <Image 
                              src={previewImage || (typeof watchedImagen === 'string' ? watchedImagen : 'https://placehold.co/300x200.png?text=Error')} 
                              alt="Vista previa de la imagen" 
                              layout="fill" 
                              objectFit="contain"
                              data-ai-hint="video thumbnail preview"
                              onError={(e) => { const target = e.target as HTMLImageElement; target.src = 'https://placehold.co/300x200.png?text=Error'; target.srcset=''; }}
                            />
                          </div>
                        )}
                      </div>
                      <FormDescription>Sube una imagen para el video (máx 5MB). Si es un video de YouTube y no subes imagen, se intentará usar la miniatura de YouTube.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="categoria"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Categoría</FormLabel>
                      <Popover open={isComboboxOpen} onOpenChange={setIsComboboxOpen}>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              role="combobox"
                              aria-expanded={isComboboxOpen}
                              className={cn(
                                "w-full justify-between font-normal",
                                !field.value && "text-muted-foreground"
                              )}
                            >
                              {field.value
                                ? categories.find(
                                    (cat) => cat.toLowerCase() === field.value?.toLowerCase()
                                  ) || field.value 
                                : "Selecciona o crea una categoría"}
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                          <Command>
                            <CommandInput
                              placeholder="Busca o escribe una nueva categoría..."
                              value={field.value || ''}
                              onValueChange={(currentValue) => {
                                field.onChange(currentValue);
                              }}
                            />
                            <CommandList>
                              <CommandEmpty>
                                {isLoadingCategories
                                  ? "Cargando categorías..."
                                  : (form.getValues("categoria") && form.getValues("categoria").trim() !== "") 
                                    ? "No se encontró la categoría. Puedes crearla."
                                    : "No se encontraron categorías."
                                }
                              </CommandEmpty>
                              {!isLoadingCategories && categories.length > 0 && (
                                <CommandGroup heading="Categorías existentes">
                                  {categories.map((category) => (
                                    <CommandItem
                                      value={category}
                                      key={category}
                                      onSelect={() => {
                                        form.setValue("categoria", category);
                                        setIsComboboxOpen(false);
                                      }}
                                    >
                                      <Check
                                        className={cn(
                                          "mr-2 h-4 w-4",
                                          field.value?.toLowerCase() === category.toLowerCase()
                                            ? "opacity-100"
                                            : "opacity-0"
                                        )}
                                      />
                                      {category}
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              )}
                              {form.getValues("categoria") && form.getValues("categoria").trim() !== "" && !categories.some(c => c.toLowerCase() === form.getValues("categoria").toLowerCase()) && (
                                <CommandGroup heading="Acción">
                                 <CommandItem
                                    key={`create-${form.getValues("categoria")}`}
                                    value={`create-${form.getValues("categoria")}`}
                                    onSelect={() => {
                                      setIsComboboxOpen(false);
                                    }}
                                  >
                                    <PlusCircle className="mr-2 h-4 w-4" />
                                    Crear nueva categoría: "{form.getValues("categoria")}"
                                  </CommandItem>
                                </CommandGroup>
                              )}
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                      <FormDescription>
                        Selecciona una categoría existente o escribe una nueva.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex flex-col sm:flex-row gap-2 pt-2">
                    <Button type="submit" variant="destructive" disabled={isSubmitting} className="w-full sm:flex-1">
                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    {editingVideoId ? "Actualizar Video" : "Guardar Video"}
                    </Button>
                    {editingVideoId && (
                    <Button type="button" variant="outline" onClick={cancelEdit} className="w-full sm:w-auto" disabled={isSubmitting}>
                        <XCircle className="mr-2 h-4 w-4" />
                        Cancelar Edición
                    </Button>
                    )}
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>

        <div className="space-y-4 max-h-[calc(100vh-15rem)] overflow-y-auto pr-2">
          <h2 className="text-2xl font-semibold text-foreground mb-4 uppercase">Videos Cargados</h2>
          {isLoadingVideos && (
            <div className="flex justify-center items-center py-10">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="ml-2 text-muted-foreground">Cargando videos...</p>
            </div>
          )}
          {errorLoadingVideos && (
             <Alert variant="destructive">
               <ListVideo className="h-4 w-4" />
               <ShadcnAlertTitle>Error al Cargar Videos</ShadcnAlertTitle>
               <ShadcnAlertDescription>{errorLoadingVideos}</ShadcnAlertDescription>
             </Alert>
          )}
          {!isLoadingVideos && !errorLoadingVideos && videos.length === 0 && (
            <div className="text-center py-10 border-2 border-dashed border-muted-foreground/30 rounded-lg">
              <ListVideo className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
              <p className="text-muted-foreground">No hay videos cargados.</p>
              <p className="text-sm text-muted-foreground">Usa el formulario para añadir tu primer video.</p>
            </div>
          )}
          {!isLoadingVideos && !errorLoadingVideos && videos.map((video, index) => {
            let displayImageUrl: string | null = null;
            let imageAlt = `Imagen de ${video.nombre}`;
            let imageAiHint = 'video placeholder';
            const userUploadedImage = video.imagen;
            const youtubeThumbnail = getYoutubeThumbnailUrl(video.url);

            if (userUploadedImage) {
              displayImageUrl = userUploadedImage;
              imageAiHint = 'video thumbnail';
            } else if (youtubeThumbnail) {
              displayImageUrl = youtubeThumbnail;
              imageAlt = `Miniatura de YouTube para ${video.nombre}`;
              imageAiHint = 'youtube thumbnail';
            }

            return (
              <Card key={video.id} className="shadow-md hover:shadow-lg transition-shadow">
                <CardHeader className="pb-2 pt-3 px-4 flex flex-row items-start gap-3">
                  {displayImageUrl ? (
                    <div className="relative w-20 h-14 rounded-md overflow-hidden border bg-muted flex-shrink-0">
                      <Image 
                        src={displayImageUrl}
                        alt={imageAlt} 
                        layout="fill" 
                        objectFit="cover" 
                        data-ai-hint={imageAiHint}
                        onError={(e) => { const target = e.target as HTMLImageElement; target.src = 'https://placehold.co/80x56.png?text=Error'; target.srcset=''; }}
                      />
                    </div>
                  ) : (
                    <div className="w-20 h-14 rounded-md bg-muted flex items-center justify-center flex-shrink-0">
                      <ImageOff className="w-6 h-6 text-muted-foreground" data-ai-hint={imageAiHint} />
                    </div>
                  )}
                  <div className="flex-grow">
                    <CardTitle className="text-md font-semibold break-words">
                      <span className="text-primary mr-1">{index + 1}.</span>
                      {video.nombre}
                    </CardTitle>
                    {video.categoria && (
                      <div className="flex items-center text-xs text-muted-foreground mt-0.5">
                        <Tag className="mr-1 h-3 w-3 text-sky-600" />
                        <span>{video.categoria}</span>
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="pb-2 pt-1 px-4 space-y-1">
                  <div className="flex items-center text-sm text-muted-foreground">
                    <Link2 className="mr-1.5 h-3.5 w-3.5 shrink-0" />
                    <a href={video.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline break-all truncate" title={video.url}>
                      {video.url}
                    </a>
                  </div>
                   <p className="text-xs text-muted-foreground/80">Subido: {formatDate(video.createdAt)}</p>
                   {video.updatedAt && video.updatedAt !== video.createdAt && (
                      <p className="text-xs text-muted-foreground/70">Actualizado: {formatDate(video.updatedAt)}</p>
                   )}
                </CardContent>
                <CardFooter className="text-xs text-muted-foreground pt-1 pb-3 px-4 flex justify-end gap-2">
                  <Button variant="outline" size="sm" onClick={() => handleEdit(video)} disabled={isSubmitting} className="h-7 px-2.5 text-xs">
                    <Edit3 className="mr-1 h-3 w-3" /> Editar
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => handleDelete(video)} disabled={isSubmitting} className="h-7 px-2.5 text-xs">
                    <Trash2 className="mr-1 h-3 w-3" /> Eliminar
                  </Button>
                </CardFooter>
              </Card>
            )
          })}
        </div>
      </div>

      <AlertDialog open={showDeleteConfirmDialog} onOpenChange={setShowDeleteConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeaderComponent>
            <AlertDialogTitleComponent>¿Estás seguro de eliminar este video?</AlertDialogTitleComponent>
            <AlertDialogDescriptionComponent>
              Esta acción no se puede deshacer. El video "{videoToDelete?.nombre || 'seleccionado'}" será eliminado permanentemente.
            </AlertDialogDescriptionComponent>
          </AlertDialogHeaderComponent>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setShowDeleteConfirmDialog(false); setVideoToDelete(null); }}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={isSubmitting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Eliminar Video
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
