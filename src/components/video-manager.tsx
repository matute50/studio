
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
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save, Trash2, Edit3, XCircle, Home, Film, Link2, Tag, ListVideo, ChevronsUpDown, Check, PlusCircle, ImageOff, Upload, LibraryBig, Star, PlayCircle } from 'lucide-react';
import { Alert, AlertDescription as ShadcnAlertDescription, AlertTitle as ShadcnAlertTitle } from "@/components/ui/alert";
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from "@/components/ui/label";
import { Badge } from '@/components/ui/badge';

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
  novedad: z.boolean().optional(),
  forzar_video: z.boolean().optional(),
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

  const [existingImages, setExistingImages] = React.useState<string[]>([]);
  const [isLoadingExistingImages, setIsLoadingExistingImages] = React.useState(true);
  const [isImageGalleryOpen, setIsImageGalleryOpen] = React.useState(false);

  const form = useForm<VideoFormValues>({
    resolver: zodResolver(videoSchema),
    defaultValues: {
      nombre: '',
      url: '',
      categoria: '',
      imagen: undefined,
      novedad: false,
      forzar_video: false,
    },
    mode: "onChange",
  });
  const watchedImagen = form.watch('imagen');

  const fetchExistingImages = async () => {
    setIsLoadingExistingImages(true);
    try {
      const { data, error } = await supabase
        .from('eventos_calendario') // Changed: Fetch from eventos_calendario table
        .select('imagen')
        .not('imagen', 'is', null);

      if (error) {
         if (error.code === '42703' || (error.message && error.message.includes('does not exist'))) {
          console.warn(
            `Could not fetch existing images because the 'imagen' column is likely missing from your 'eventos_calendario' table. Please add this column (type: text) to enable the 'Choose Existing Image' feature.`
          );
          setExistingImages([]);
        } else {
          throw error;
        }
      } else if (data) {
        const uniqueImages = Array.from(
          new Set(data.map((item) => (item.imagen as string)).filter(Boolean))
        );
        setExistingImages(uniqueImages);
      }
    } catch (error: any) {
      toast({
        title: "Error al Cargar Imágenes Existentes",
        description: `No se pudieron cargar las imágenes de los eventos: ${error.message}`,
        variant: "destructive",
      });
    } finally {
      setIsLoadingExistingImages(false);
    }
  };

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
    fetchExistingImages();
  }, []);

  const resetForm = () => {
    form.reset({ nombre: '', url: '', categoria: '', imagen: undefined, novedad: false, forzar_video: false });
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
        novedad: data.novedad,
        forzar_video: data.forzar_video,
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
      fetchExistingImages();
      resetForm();
    } catch (error: any) {
      toast({
        title: "Error al Guardar Video",
        description: `No se pudo guardar: ${error.message || 'Error desconocido'}. Asegúrate de que las columnas 'novedad' y 'forzar_video' (tipo boolean) existan en la tabla 'videos'.`,
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
      novedad: videoToEdit.novedad || false,
      forzar_video: videoToEdit.forzar_video || false,
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
          <Button variant="default" size="sm" className="text-black">
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
                      <div className="flex flex-col sm:flex-row gap-2">
                        <Button type="button" variant="default" className="w-full sm:w-auto text-black" onClick={() => imageFileRef.current?.click()}>
                           <Upload className="mr-2 h-4 w-4" />
                           Subir Archivo
                        </Button>
                        <Button
                          type="button"
                          className="w-full sm:w-auto bg-primary/70 hover:bg-primary/80 text-black"
                          onClick={() => setIsImageGalleryOpen(true)}
                          disabled={isLoadingExistingImages || existingImages.length === 0}
                        >
                           {isLoadingExistingImages ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LibraryBig className="mr-2 h-4 w-4" />}
                          Elegir Existente
                        </Button>
                      </div>
                      <FormControl>
                        <Input
                          id="imagen"
                          type="file"
                          ref={imageFileRef}
                          accept="image/*"
                          onChange={handleImageFileChange}
                          className="hidden"
                        />
                      </FormControl>
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
                      <FormDescription>Sube una imagen (máx 5MB) o elige una existente. Si es de YouTube y no subes imagen, se usará su miniatura.</FormDescription>
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

                <FormField
                  control={form.control}
                  name="novedad"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md border p-4 shadow-sm">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          id="novedad-checkbox"
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <Label htmlFor="novedad-checkbox" className="cursor-pointer">
                          NOVEDAD
                        </Label>
                        <FormDescription>
                          Marcar este video como una novedad lo destacará.
                        </FormDescription>
                      </div>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="forzar_video"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md border p-4 shadow-sm">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          id="forzar-video-checkbox"
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <Label htmlFor="forzar-video-checkbox" className="cursor-pointer">
                          FORZAR VIDEO
                        </Label>
                        <FormDescription>
                          Fuerza la reproducción de este video al iniciar la pagina.
                        </FormDescription>
                      </div>
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
                    <CardTitle className="text-md font-semibold break-words flex items-center gap-2 flex-wrap">
                      <span className="text-primary mr-1">{index + 1}.</span>
                      <span>{video.nombre}</span>
                      {video.novedad && (
                        <Badge variant="destructive" className="text-xs px-1.5 py-0.5 h-fit">
                          <Star className="mr-1 h-3 w-3" />
                          NOVEDAD
                        </Badge>
                      )}
                      {video.forzar_video && (
                        <Badge className="text-xs px-1.5 py-0.5 h-fit bg-blue-600 hover:bg-blue-700 text-white">
                          <PlayCircle className="mr-1 h-3 w-3" />
                          FORZADO
                        </Badge>
                      )}
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
                  <Button size="sm" onClick={() => handleEdit(video)} disabled={isSubmitting} className="h-7 px-2.5 text-xs bg-green-500 hover:bg-green-600 text-black">
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

      <Dialog open={isImageGalleryOpen} onOpenChange={setIsImageGalleryOpen}>
          <DialogContent className="max-w-4xl">
              <DialogHeader>
                  <DialogTitle className="uppercase">Seleccionar una Imagen Existente</DialogTitle>
                  <DialogDescription>
                      Haz clic en una imagen para seleccionarla para tu video. Estas imágenes provienen de eventos guardados.
                  </DialogDescription>
              </DialogHeader>
              {isLoadingExistingImages ? (
                  <div className="flex justify-center items-center h-[60vh]">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
              ) : existingImages.length > 0 ? (
                  <ScrollArea className="h-[60vh] -mx-6">
                      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 px-6 py-4">
                      {existingImages.map((imgUrl, index) => (
                          <button
                              key={index}
                              type="button"
                              className="relative aspect-square w-full rounded-md overflow-hidden border-2 border-transparent hover:border-primary focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring group"
                              onClick={() => {
                                  form.setValue('imagen', imgUrl, { shouldValidate: true, shouldDirty: true });
                                  setPreviewImage(imgUrl);
                                  setIsImageGalleryOpen(false);
                                  if (imageFileRef.current) imageFileRef.current.value = "";
                              }}
                          >
                          <Image src={imgUrl} alt={`Imagen de evento ${index + 1}`} layout="fill" objectFit="cover" className="transition-transform group-hover:scale-105" data-ai-hint="video galeria" />
                          </button>
                      ))}
                      </div>
                  </ScrollArea>
              ) : (
                  <div className="flex flex-col justify-center items-center text-center py-8 h-[60vh]">
                    <LibraryBig className="w-16 h-16 text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">No hay imágenes de eventos anteriores para seleccionar.</p>
                    <p className="text-sm text-muted-foreground">Sube una imagen nueva o crea un evento con imagen para empezar.</p>
                  </div>
              )}
          </DialogContent>
      </Dialog>

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
    