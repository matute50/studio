
"use client";

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import Link from 'next/link';
import type { VideoItem } from '@/types';

import { supabase } from '@/lib/supabaseClient';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription as AlertDialogDescriptionComponent, AlertDialogFooter, AlertDialogHeader as AlertDialogHeaderComponent, AlertDialogTitle as AlertDialogTitleComponent } from "@/components/ui/alert-dialog";
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save, Trash2, Edit3, XCircle, Home, Film, Link2, Tag, ListVideo } from 'lucide-react';
import { Alert, AlertDescription as ShadcnAlertDescription, AlertTitle as ShadcnAlertTitle } from "@/components/ui/alert";

const SUPABASE_TABLE_NAME = 'videos';

const videoSchema = z.object({
  nombre: z.string().min(3, { message: "El nombre del video debe tener al menos 3 caracteres." }).max(150, { message: "El nombre del video debe tener 150 caracteres o menos." }),
  url: z.string().url({ message: "Por favor, introduce una URL válida para el video." }),
  categoria: z.string().optional(),
});

type VideoFormValues = z.infer<typeof videoSchema>;

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
      const description = `No se pudieron cargar los videos: ${error.message || 'Error desconocido'}. Verifica que la tabla '${SUPABASE_TABLE_NAME}' exista y tenga RLS configuradas. Columnas esperadas: nombre, url, categoria, createdAt, updatedAt.`;
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
  }, []);

  const resetForm = () => {
    form.reset({ nombre: '', url: '', categoria: '' });
    setEditingVideoId(null);
  };

  const onSubmit = async (data: VideoFormValues) => {
    setIsSubmitting(true);
    const now = new Date().toISOString();

    try {
      if (editingVideoId) {
        const videoPayload: Partial<VideoItem> = {
          nombre: data.nombre,
          url: data.url,
          categoria: data.categoria || null,
          updatedAt: now,
        };
        const { data: updatedData, error: updateError } = await supabase
          .from(SUPABASE_TABLE_NAME)
          .update(videoPayload)
          .eq('id', editingVideoId)
          .select()
          .single();
        if (updateError) throw updateError;
        toast({ title: "¡Video Actualizado!", description: `El video "${updatedData?.nombre}" ha sido actualizado.` });
      } else {
        const payloadToInsert: Omit<VideoItem, 'id' | 'fecha'> = { // 'fecha' is not in the form
          nombre: data.nombre,
          url: data.url,
          categoria: data.categoria || undefined,
          createdAt: now,
          updatedAt: now,
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
        description: `No se pudo guardar: ${error.message || 'Error desconocido'}. Revisa los logs y la tabla '${SUPABASE_TABLE_NAME}'. Columnas esperadas: nombre, url, categoria.`,
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
    });
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
        <h1 className="text-4xl font-bold tracking-tight text-primary">Gestor de Contenido Multimedia</h1>
      </header>
      <div className="mb-6 text-left">
        <Link href="/" passHref legacyBehavior>
          <Button variant="outline" size="sm">
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
                        <Input placeholder="Ej: Resumen del Partido X vs Y" {...field} />
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
                        <Input placeholder="https://www.youtube.com/watch?v=xxxxxxxxxxx" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="categoria"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Categoría (Opcional)</FormLabel>
                      <FormControl>
                        <Input placeholder="Ej: Deportes, Noticias Locales, Eventos" {...field} value={field.value ?? ''} />
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

        <div className="space-y-4 max-h-[calc(100vh-15rem)] overflow-y-auto pr-2">
          <h2 className="text-2xl font-semibold text-foreground mb-4">Videos Cargados</h2>
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
          {!isLoadingVideos && !errorLoadingVideos && videos.map((video, index) => (
            <Card key={video.id} className="shadow-md hover:shadow-lg transition-shadow">
              <CardHeader className="pb-2 pt-3 px-4">
                <CardTitle className="text-md font-semibold break-words">
                   <span className="text-primary mr-2">{index + 1}.</span>
                  {video.nombre}
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-2 pt-0 px-4 space-y-1.5">
                <div className="flex items-center text-sm text-muted-foreground">
                  <Link2 className="mr-1.5 h-3.5 w-3.5 shrink-0" />
                  <a href={video.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline break-all truncate" title={video.url}>
                    {video.url}
                  </a>
                </div>
                {video.categoria && (
                  <div className="flex items-center text-sm text-muted-foreground">
                    <Tag className="mr-1.5 h-3.5 w-3.5 shrink-0 text-sky-600" />
                    <span>{video.categoria}</span>
                  </div>
                )}
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
