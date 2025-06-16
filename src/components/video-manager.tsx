
"use client";

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import Link from 'next/link';
import type { VideoItem } from '@/types';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

import { supabase } from '@/lib/supabaseClient';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription as AlertDialogDescriptionComponent, AlertDialogFooter, AlertDialogHeader as AlertDialogHeaderComponent, AlertDialogTitle as AlertDialogTitleComponent } from "@/components/ui/alert-dialog";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save, Trash2, VideoIcon, Edit3, XCircle, Home, CalendarIcon, Tag, Link2Icon } from 'lucide-react';
import { Alert, AlertDescription as ShadcnAlertDescription, AlertTitle as ShadcnAlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

const videoSchema = z.object({
  nombre: z.string().min(3, { message: "El nombre debe tener al menos 3 caracteres." }).max(150, { message: "El nombre no debe exceder 150 caracteres." }),
  url: z.string().url({ message: "Por favor, introduce una URL de video válida." }),
  fecha: z.date({ required_error: "Se requiere una fecha.", invalid_type_error: "Fecha inválida."}),
  categoria: z.string().min(1, { message: "La categoría no puede estar vacía." }).max(50, { message: "La categoría no debe exceder 50 caracteres." }),
});

type VideoFormValues = z.infer<typeof videoSchema>;

const SUPABASE_TABLE_NAME = 'videos'; // Define table name

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

  const form = useForm<VideoFormValues>({
    resolver: zodResolver(videoSchema),
    defaultValues: {
      nombre: '',
      url: '',
      fecha: undefined,
      categoria: '',
    },
    mode: "onChange",
  });

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
      const description = `No se pudieron cargar los videos: ${error.message || 'Error desconocido'}. Verifica la consola y los logs de Supabase. Asegúrate de que la tabla '${SUPABASE_TABLE_NAME}' exista y tenga las columnas 'nombre', 'url', 'fecha', 'categoria', 'createdAt', 'updatedAt' con RLS configuradas.`;
      setErrorLoadingVideos(description);
      toast({
        title: "Error al Cargar Videos",
        description,
        variant: "destructive",
        duration: 10000,
      });
    } finally {
      setIsLoadingVideos(false);
    }
  };

  React.useEffect(() => {
    fetchVideos();
  }, []);

  const resetForm = () => {
    form.reset({ nombre: '', url: '', fecha: undefined, categoria: '' });
    setEditingVideoId(null);
  };

  const onSubmit = async (data: VideoFormValues) => {
    setIsSubmitting(true);
    const now = new Date().toISOString();

    const videoPayload = {
      nombre: data.nombre,
      url: data.url,
      fecha: data.fecha.toISOString(), // Store as ISO string
      categoria: data.categoria,
      updatedAt: now,
    };

    try {
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
        const payloadToInsert = {
            ...videoPayload,
            createdAt: now,
        };
        const { data: insertedData, error: insertError } = await supabase
          .from(SUPABASE_TABLE_NAME)
          .insert([payloadToInsert])
          .select()
          .single();
        if (insertError) throw insertError;
        toast({ title: "¡Video Guardado!", description: `El video "${insertedData?.nombre}" ha sido guardado.` });
      }
      fetchVideos();
      resetForm();
    } catch (error: any) {
      toast({
        title: "Error al Guardar Video",
        description: `No se pudo guardar: ${error.message || 'Error desconocido'}. Revisa los logs y la estructura de la tabla '${SUPABASE_TABLE_NAME}'.`,
        variant: "destructive",
        duration: 10000,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (video: VideoItem) => {
    if (!video.id) return;
    setEditingVideoId(video.id);
    form.reset({
      nombre: video.nombre,
      url: video.url,
      fecha: video.fecha ? parseISO(video.fecha) : new Date(),
      categoria: video.categoria || '',
    });
    editorFormCardRef.current?.scrollIntoView({ behavior: 'smooth' });
    toast({ title: "Modo Edición Video", description: `Editando video: ${video.nombre}` });
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
  
  const formatDateForDisplay = (dateString?: string | null): string => {
    if (!dateString) return 'N/A';
    try {
      return format(parseISO(dateString), 'PPP', { locale: es });
    } catch (e) {
      return 'Fecha inválida';
    }
  };


  return (
    <div className="container mx-auto px-4 py-8">
      <header className="flex flex-col sm:flex-row items-center justify-center text-center mb-8 gap-3 sm:gap-4">
        <VideoIcon className="h-10 w-10 text-primary" />
        <h1 className="text-4xl font-bold tracking-tight text-primary">Gestor de Contenido Multimedia - Videos</h1>
      </header>
      <div className="mb-6 text-left">
        <Link href="/" passHref legacyBehavior>
          <Button variant="outline" size="sm">
            <Home className="mr-2 h-4 w-4" />
            Volver al Inicio
          </Button>
        </Link>
      </div>

      <div className="grid lg:grid-cols-3 gap-8 items-start">
        <Card className="lg:col-span-1 shadow-xl" ref={editorFormCardRef}>
          <CardHeader>
            <CardTitle>{editingVideoId ? "Editar Video" : "Añadir Nuevo Video"}</CardTitle>
            <CardDescription>
              Completa los detalles del video para añadirlo al gestor de contenido.
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
                        <Input placeholder="Ej: Resumen del Partido" {...field} />
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
                        <Input placeholder="https://youtube.com/watch?v=..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                 <FormField
                  control={form.control}
                  name="fecha"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Fecha del Video</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant={"outline"}
                              className={cn(
                                "w-full pl-3 text-left font-normal",
                                !field.value && "text-muted-foreground"
                              )}
                            >
                              {field.value ? (
                                format(field.value, "PPP", { locale: es })
                              ) : (
                                <span>Selecciona una fecha</span>
                              )}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            disabled={(date) =>
                              date > new Date() || date < new Date("1900-01-01")
                            }
                            initialFocus
                            locale={es}
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="categoria"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Categoría</FormLabel>
                      <FormControl>
                        <Input placeholder="Ej: Deportes, Noticias Locales" {...field} />
                      </FormControl>
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

        <div className="lg:col-span-2 space-y-4 max-h-[calc(100vh-15rem)] overflow-y-auto pr-2">
          <h2 className="text-2xl font-semibold text-foreground mb-4">Videos Guardados</h2>
          {isLoadingVideos && (
            <div className="flex justify-center items-center py-10">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="ml-2 text-muted-foreground">Cargando videos...</p>
            </div>
          )}
          {errorLoadingVideos && (
             <Alert variant="destructive">
               <VideoIcon className="h-4 w-4" />
               <ShadcnAlertTitle>Error al Cargar Videos</ShadcnAlertTitle>
               <ShadcnAlertDescription>{errorLoadingVideos}</ShadcnAlertDescription>
             </Alert>
          )}
          {!isLoadingVideos && !errorLoadingVideos && videos.length === 0 && (
            <div className="text-center py-10 border-2 border-dashed border-muted-foreground/30 rounded-lg">
              <VideoIcon className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
              <p className="text-muted-foreground">No hay videos guardados.</p>
              <p className="text-sm text-muted-foreground">Usa el formulario para añadir tu primer video.</p>
            </div>
          )}
          {!isLoadingVideos && !errorLoadingVideos && videos.map((video, index) => (
            <Card key={video.id} className="shadow-md hover:shadow-lg transition-shadow">
              <CardHeader className="pb-2 pt-3 px-4">
                <CardTitle className="text-base font-semibold break-words">
                   <span className="text-primary mr-2">{index + 1}.</span>
                  {video.nombre}
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-2 pt-0 px-4 space-y-1.5">
                <div className="flex items-center text-xs text-muted-foreground">
                  <Link2Icon className="mr-1.5 h-3.5 w-3.5 text-sky-600" />
                  <a href={video.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline break-all truncate" title={video.url}>
                    {video.url}
                  </a>
                </div>
                <div className="flex items-center text-xs text-muted-foreground">
                  <CalendarIcon className="mr-1.5 h-3.5 w-3.5 text-amber-600" />
                  <span>Fecha: {formatDateForDisplay(video.fecha)}</span>
                </div>
                <div className="flex items-center text-xs text-muted-foreground">
                  <Tag className="mr-1.5 h-3.5 w-3.5 text-purple-600" />
                  <span>Categoría: {video.categoria || 'N/A'}</span>
                </div>
                <p className="text-[0.65rem] text-muted-foreground/70 pt-1">Creado: {formatDateForDisplay(video.createdAt)}</p>
              </CardContent>
              <CardFooter className="text-xs text-muted-foreground pt-1 pb-2 px-4 flex justify-end gap-1.5">
                <Button variant="outline" size="sm" onClick={() => handleEdit(video)} disabled={isSubmitting} className="h-7 px-2.5 text-xs">
                  <Edit3 className="mr-1 h-3 w-3" /> Editar
                </Button>
                <Button variant="destructive" size="sm" onClick={() => handleDelete(video)} disabled={isSubmitting} className="h-7 px-2.5 text-xs">
                  <Trash2 className="mr-1 h-3 w-3" /> Eliminar
                </Button>
              </CardFooter>
            </Card>
          ))}
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
