
"use client";

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import Link from 'next/link';
import Image from 'next/image';
import type { VideoItem, InterviewItem } from '@/types';

import { supabase } from '@/lib/supabaseClient'; 

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription as AlertDialogDescriptionComponent, AlertDialogFooter, AlertDialogHeader as AlertDialogHeaderComponent, AlertDialogTitle as AlertDialogTitleComponent } from "@/components/ui/alert-dialog";
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save, Trash2, Edit3, XCircle, Home, VideoIcon, Link2, Mic2 } from 'lucide-react';
import { Alert, AlertDescription as ShadcnAlertDescription, AlertTitle as ShadcnAlertTitle } from "@/components/ui/alert";

const commonSchema = z.object({
  nombre: z.string().min(3, { message: "El nombre debe tener al menos 3 caracteres." }).max(150, { message: "El nombre no puede exceder los 150 caracteres." }),
  url: z.string().url({ message: "Por favor, introduce una URL válida." }),
});

type VideoFormValues = z.infer<typeof commonSchema>;
type InterviewFormValues = z.infer<typeof commonSchema>;

export function VideoManager() {
  const { toast } = useToast();
  
  // Video States
  const [isSubmittingVideo, setIsSubmittingVideo] = React.useState(false);
  const videoEditorFormCardRef = React.useRef<HTMLDivElement>(null);
  const [videos, setVideos] = React.useState<VideoItem[]>([]);
  const [isLoadingVideos, setIsLoadingVideos] = React.useState(true);
  const [errorLoadingVideos, setErrorLoadingVideos] = React.useState<string | null>(null);
  const [editingVideoId, setEditingVideoId] = React.useState<string | null>(null);
  const [showDeleteVideoConfirmDialog, setShowDeleteVideoConfirmDialog] = React.useState(false);
  const [videoToDelete, setVideoToDelete] = React.useState<VideoItem | null>(null);

  // Interview States
  const [isSubmittingInterview, setIsSubmittingInterview] = React.useState(false);
  const interviewEditorFormCardRef = React.useRef<HTMLDivElement>(null);
  const [interviews, setInterviews] = React.useState<InterviewItem[]>([]);
  const [isLoadingInterviews, setIsLoadingInterviews] = React.useState(true);
  const [errorLoadingInterviews, setErrorLoadingInterviews] = React.useState<string | null>(null);
  const [editingInterviewId, setEditingInterviewId] = React.useState<string | null>(null);
  const [showDeleteInterviewConfirmDialog, setShowDeleteInterviewConfirmDialog] = React.useState(false);
  const [interviewToDelete, setInterviewToDelete] = React.useState<InterviewItem | null>(null);

  const videoForm = useForm<VideoFormValues>({
    resolver: zodResolver(commonSchema),
    defaultValues: { nombre: '', url: '' },
    mode: "onChange",
  });

  const interviewForm = useForm<InterviewFormValues>({
    resolver: zodResolver(commonSchema),
    defaultValues: { nombre: '', url: '' },
    mode: "onChange",
  });

  const fetchVideos = async () => {
    setIsLoadingVideos(true);
    setErrorLoadingVideos(null);
    try {
      const { data, error } = await supabase
        .from('videos')
        .select('*')
        .order('createdAt', { ascending: false });
      if (error) throw error;
      setVideos(data || []);
    } catch (error: any) {
      const description = `No se pudieron cargar los videos: ${error.message || 'Error desconocido'}.`;
      setErrorLoadingVideos(description);
      toast({ title: "Error al Cargar Videos", description, variant: "destructive" });
    } finally {
      setIsLoadingVideos(false);
    }
  };

  const fetchInterviews = async () => {
    setIsLoadingInterviews(true);
    setErrorLoadingInterviews(null);
    try {
      const { data, error } = await supabase
        .from('entrevistas')
        .select('*')
        .order('createdAt', { ascending: false });
      if (error) throw error;
      setInterviews(data || []);
    } catch (error: any) {
      const description = `No se pudieron cargar las entrevistas: ${error.message || 'Error desconocido'}. Verifica que la tabla 'entrevistas' exista.`;
      setErrorLoadingInterviews(description);
      toast({ title: "Error al Cargar Entrevistas", description, variant: "destructive" });
    } finally {
      setIsLoadingInterviews(false);
    }
  };

  React.useEffect(() => {
    fetchVideos();
    fetchInterviews();
  }, []);

  const resetVideoForm = () => {
    videoForm.reset({ nombre: '', url: '' });
    setEditingVideoId(null);
  };

  const resetInterviewForm = () => {
    interviewForm.reset({ nombre: '', url: '' });
    setEditingInterviewId(null);
  };

  const onVideoSubmit = async (data: VideoFormValues) => {
    setIsSubmittingVideo(true);
    const now = new Date().toISOString();
    try {
      if (editingVideoId) {
        const payload = { nombre: data.nombre, url: data.url, updatedAt: now };
        const { data: updatedData, error } = await supabase.from('videos').update(payload).eq('id', editingVideoId).select().single();
        if (error) throw error;
        toast({ title: "¡Video Actualizado!", description: `El video "${updatedData?.nombre}" ha sido actualizado.` });
      } else {
        const payload = { nombre: data.nombre, url: data.url, createdAt: now, updatedAt: now };
        const { data: insertedData, error } = await supabase.from('videos').insert([payload]).select().single();
        if (error) throw error;
        toast({ title: "¡Video Guardado!", description: `El video "${insertedData?.nombre}" ha sido guardado.` });
      }
      fetchVideos();
      resetVideoForm();
    } catch (error: any) {
      handleSupabaseError(error, "Video");
    } finally {
      setIsSubmittingVideo(false);
    }
  };

  const onInterviewSubmit = async (data: InterviewFormValues) => {
    setIsSubmittingInterview(true);
    const now = new Date().toISOString();
    try {
      if (editingInterviewId) {
        const payload = { nombre: data.nombre, url: data.url, updatedAt: now };
        const { data: updatedData, error } = await supabase.from('entrevistas').update(payload).eq('id', editingInterviewId).select().single();
        if (error) throw error;
        toast({ title: "¡Entrevista Actualizada!", description: `La entrevista "${updatedData?.nombre}" ha sido actualizada.` });
      } else {
        const payload = { nombre: data.nombre, url: data.url, createdAt: now, updatedAt: now };
        const { data: insertedData, error } = await supabase.from('entrevistas').insert([payload]).select().single();
        if (error) throw error;
        toast({ title: "¡Entrevista Guardada!", description: `La entrevista "${insertedData?.nombre}" ha sido guardada.` });
      }
      fetchInterviews();
      resetInterviewForm();
    } catch (error: any) {
      handleSupabaseError(error, "Entrevista");
    } finally {
      setIsSubmittingInterview(false);
    }
  };

  const handleSupabaseError = (error: any, itemType: string) => {
    let description = `No se pudo guardar ${itemType.toLowerCase()}. Inténtalo de nuevo.`;
    const errorCode = (typeof error?.code === 'string') ? error.code : "";
    const errorMessageLowerCase = (typeof error?.message === 'string') ? error.message.toLowerCase() : "";

    if (errorCode === 'PGRST116' || (errorMessageLowerCase.includes('relation') && errorMessageLowerCase.includes('does not exist')) || (error?.status === 404 && (errorMessageLowerCase.includes('not found') || errorMessageLowerCase.includes('no existe')))) {
      description = `Error CRÍTICO 404 (Not Found): La tabla '${itemType === 'Video' ? 'videos' : 'entrevistas'}' PARECE NO EXISTIR o no es accesible. Por favor, VERIFICA URGENTEMENTE tu configuración de tabla y RLS en Supabase. (Código: ${errorCode})`;
    } else if (error?.message) {
      description = `Error al guardar: ${error.message}. (Código: ${errorCode})`;
    }
    toast({
      title: `Error al Guardar ${itemType}`,
      description: `${description} Revisa consola y logs de Supabase.`,
      variant: "destructive",
      duration: 10000,
    });
  };
  
  const formatDate = (dateString?: string | null) => {
    if (!dateString) return 'Fecha desconocida';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'Fecha inválida';
      return date.toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch (e: any) {
      return 'Error al formatear fecha';
    }
  };

  const handleEditVideo = (video: VideoItem) => {
    if (!video.id) return;
    setEditingVideoId(video.id);
    videoForm.reset({ nombre: video.nombre, url: video.url });
    videoEditorFormCardRef.current?.scrollIntoView({ behavior: 'smooth' });
    toast({ title: "Modo Edición Video", description: `Editando video: ${video.nombre}` });
  };

  const cancelEditVideo = () => resetVideoForm();

  const handleDeleteVideo = (video: VideoItem) => {
    if (!video.id) return;
    setVideoToDelete(video);
    setShowDeleteVideoConfirmDialog(true);
  };

  const confirmDeleteVideo = async () => {
    if (!videoToDelete || !videoToDelete.id) return;
    setIsSubmittingVideo(true);
    try {
      const { error } = await supabase.from('videos').delete().eq('id', videoToDelete.id);
      if (error) throw error;
      toast({ title: "Video Eliminado", description: `El video "${videoToDelete.nombre}" ha sido eliminado.` });
      fetchVideos();
      if (editingVideoId === videoToDelete.id) cancelEditVideo();
    } catch (error: any) {
      toast({ title: "Error al Eliminar Video", description: `No se pudo eliminar: ${error.message || 'Error desconocido'}.`, variant: "destructive" });
    } finally {
      setIsSubmittingVideo(false);
      setShowDeleteVideoConfirmDialog(false);
      setVideoToDelete(null);
    }
  };

  const handleEditInterview = (interview: InterviewItem) => {
    if (!interview.id) return;
    setEditingInterviewId(interview.id);
    interviewForm.reset({ nombre: interview.nombre, url: interview.url });
    interviewEditorFormCardRef.current?.scrollIntoView({ behavior: 'smooth' });
    toast({ title: "Modo Edición Entrevista", description: `Editando entrevista: ${interview.nombre}` });
  };

  const cancelEditInterview = () => resetInterviewForm();

  const handleDeleteInterview = (interview: InterviewItem) => {
    if (!interview.id) return;
    setInterviewToDelete(interview);
    setShowDeleteInterviewConfirmDialog(true);
  };

  const confirmDeleteInterview = async () => {
    if (!interviewToDelete || !interviewToDelete.id) return;
    setIsSubmittingInterview(true);
    try {
      const { error } = await supabase.from('entrevistas').delete().eq('id', interviewToDelete.id);
      if (error) throw error;
      toast({ title: "Entrevista Eliminada", description: `La entrevista "${interviewToDelete.nombre}" ha sido eliminada.` });
      fetchInterviews();
      if (editingInterviewId === interviewToDelete.id) cancelEditInterview();
    } catch (error: any) {
      toast({ title: "Error al Eliminar Entrevista", description: `No se pudo eliminar: ${error.message || 'Error desconocido'}.`, variant: "destructive" });
    } finally {
      setIsSubmittingInterview(false);
      setShowDeleteInterviewConfirmDialog(false);
      setInterviewToDelete(null);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <header className="flex flex-col sm:flex-row items-center justify-center text-center mb-8 gap-3 sm:gap-4">
        <Image src="/logo.png" alt="NewsFlash Logo" width={50} height={50} className="rounded-lg" data-ai-hint="app logo"/>
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
        {/* Columna de Videos */}
        <div className="space-y-8">
          <Card className="shadow-xl" ref={videoEditorFormCardRef}>
            <CardHeader>
              <CardTitle>{editingVideoId ? "Editar Video" : "Añadir Nuevo Video"}</CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...videoForm}>
                <form onSubmit={videoForm.handleSubmit(onVideoSubmit)} className="space-y-6">
                  <FormField control={videoForm.control} name="nombre" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nombre del Video</FormLabel>
                      <FormControl><Input placeholder="Ej: Resumen del Partido" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={videoForm.control} name="url" render={({ field }) => (
                    <FormItem>
                      <FormLabel>URL del Video</FormLabel>
                      <FormControl><Input placeholder="https://youtube.com/watch?v=..." {...field} /></FormControl>
                      <FormDescription>Pega la URL completa del video (Ej: YouTube, Vimeo, MP4).</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <div className="flex flex-col sm:flex-row gap-2 pt-2">
                    <Button type="submit" variant="destructive" disabled={isSubmittingVideo} className="w-full sm:flex-1">
                      {isSubmittingVideo ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                      {editingVideoId ? "Actualizar Video" : "Guardar Video"}
                    </Button>
                    {editingVideoId && (
                      <Button type="button" variant="outline" onClick={cancelEditVideo} className="w-full sm:w-auto" disabled={isSubmittingVideo}>
                        <XCircle className="mr-2 h-4 w-4" /> Cancelar Edición
                      </Button>
                    )}
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>

          <div className="space-y-4 max-h-[40vh] overflow-y-auto pr-2">
            <h2 className="text-2xl font-semibold text-foreground mb-4">Videos Existentes</h2>
            {isLoadingVideos && <div className="flex justify-center items-center py-10"><Loader2 className="h-8 w-8 animate-spin text-primary" /><p className="ml-2 text-muted-foreground">Cargando videos...</p></div>}
            {errorLoadingVideos && <Alert variant="destructive"><VideoIcon className="h-4 w-4" /><ShadcnAlertTitle>Error</ShadcnAlertTitle><ShadcnAlertDescription>{errorLoadingVideos}</ShadcnAlertDescription></Alert>}
            {!isLoadingVideos && !errorLoadingVideos && videos.length === 0 && (
              <div className="text-center py-10 border-2 border-dashed rounded-lg"><VideoIcon className="h-12 w-12 mx-auto mb-2" /><p>No hay videos.</p></div>
            )}
            {videos.map((video, index) => (
              <Card key={video.id} className="shadow-md">
                <CardHeader className="pb-2 pt-3 px-3"><CardTitle className="text-md font-semibold"><span className="text-primary mr-2">{index + 1}.</span>{video.nombre}</CardTitle></CardHeader>
                <CardContent className="pb-2 pt-0 px-3 space-y-1">
                  <div className="flex items-center text-sm"><Link2 className="mr-2 h-4 w-4 shrink-0" /><a href={video.url} target="_blank" rel="noopener noreferrer" className="truncate hover:underline">{video.url}</a></div>
                  <p className="text-xs">Añadido: {formatDate(video.createdAt)}</p>
                  {video.updatedAt && video.createdAt !== video.updatedAt && <p className="text-xs">Actualizado: {formatDate(video.updatedAt)}</p>}
                </CardContent>
                <CardFooter className="pt-0 pb-2 px-3 flex justify-end gap-1.5">
                  <Button variant="outline" size="sm" onClick={() => handleEditVideo(video)} disabled={isSubmittingVideo} className="h-7 px-2.5 text-xs"><Edit3 className="mr-1 h-3 w-3" /> Editar</Button>
                  <Button variant="destructive" size="sm" onClick={() => handleDeleteVideo(video)} disabled={isSubmittingVideo} className="h-7 px-2.5 text-xs"><Trash2 className="mr-1 h-3 w-3" /> Eliminar</Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        </div>

        {/* Columna de Entrevistas */}
        <div className="space-y-8">
          <Card className="shadow-xl" ref={interviewEditorFormCardRef}>
            <CardHeader>
              <CardTitle>{editingInterviewId ? "Editar Entrevista" : "Añadir Nueva Entrevista"}</CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...interviewForm}>
                <form onSubmit={interviewForm.handleSubmit(onInterviewSubmit)} className="space-y-6">
                  <FormField control={interviewForm.control} name="nombre" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nombre de la Entrevista</FormLabel>
                      <FormControl><Input placeholder="Ej: Entrevista con el Experto" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={interviewForm.control} name="url" render={({ field }) => (
                    <FormItem>
                      <FormLabel>URL de la Entrevista</FormLabel>
                      <FormControl><Input placeholder="https://youtube.com/watch?v=..." {...field} /></FormControl>
                      <FormDescription>Pega la URL completa de la entrevista.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <div className="flex flex-col sm:flex-row gap-2 pt-2">
                    <Button type="submit" variant="destructive" disabled={isSubmittingInterview} className="w-full sm:flex-1">
                      {isSubmittingInterview ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                      {editingInterviewId ? "Actualizar Entrevista" : "Guardar Entrevista"}
                    </Button>
                    {editingInterviewId && (
                      <Button type="button" variant="outline" onClick={cancelEditInterview} className="w-full sm:w-auto" disabled={isSubmittingInterview}>
                        <XCircle className="mr-2 h-4 w-4" /> Cancelar Edición
                      </Button>
                    )}
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>

          <div className="space-y-4 max-h-[40vh] overflow-y-auto pr-2">
            <h2 className="text-2xl font-semibold text-foreground mb-4">Entrevistas Existentes</h2>
            {isLoadingInterviews && <div className="flex justify-center items-center py-10"><Loader2 className="h-8 w-8 animate-spin text-primary" /><p className="ml-2 text-muted-foreground">Cargando entrevistas...</p></div>}
            {errorLoadingInterviews && <Alert variant="destructive"><Mic2 className="h-4 w-4" /><ShadcnAlertTitle>Error</ShadcnAlertTitle><ShadcnAlertDescription>{errorLoadingInterviews}</ShadcnAlertDescription></Alert>}
            {!isLoadingInterviews && !errorLoadingInterviews && interviews.length === 0 && (
              <div className="text-center py-10 border-2 border-dashed rounded-lg"><Mic2 className="h-12 w-12 mx-auto mb-2" /><p>No hay entrevistas.</p></div>
            )}
            {interviews.map((interview, index) => (
              <Card key={interview.id} className="shadow-md">
                <CardHeader className="pb-2 pt-3 px-3"><CardTitle className="text-md font-semibold"><span className="text-primary mr-2">{index + 1}.</span>{interview.nombre}</CardTitle></CardHeader>
                <CardContent className="pb-2 pt-0 px-3 space-y-1">
                  <div className="flex items-center text-sm"><Link2 className="mr-2 h-4 w-4 shrink-0" /><a href={interview.url} target="_blank" rel="noopener noreferrer" className="truncate hover:underline">{interview.url}</a></div>
                  <p className="text-xs">Añadida: {formatDate(interview.createdAt)}</p>
                  {interview.updatedAt && interview.createdAt !== interview.updatedAt && <p className="text-xs">Actualizada: {formatDate(interview.updatedAt)}</p>}
                </CardContent>
                <CardFooter className="pt-0 pb-2 px-3 flex justify-end gap-1.5">
                  <Button variant="outline" size="sm" onClick={() => handleEditInterview(interview)} disabled={isSubmittingInterview} className="h-7 px-2.5 text-xs"><Edit3 className="mr-1 h-3 w-3" /> Editar</Button>
                  <Button variant="destructive" size="sm" onClick={() => handleDeleteInterview(interview)} disabled={isSubmittingInterview} className="h-7 px-2.5 text-xs"><Trash2 className="mr-1 h-3 w-3" /> Eliminar</Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        </div>
      </div>

      {/* AlertDialogs */}
      <AlertDialog open={showDeleteVideoConfirmDialog} onOpenChange={setShowDeleteVideoConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeaderComponent><AlertDialogTitleComponent>¿Eliminar este video?</AlertDialogTitleComponent><AlertDialogDescriptionComponent>"{videoToDelete?.nombre || ''}" será eliminado.</AlertDialogDescriptionComponent></AlertDialogHeaderComponent>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setShowDeleteVideoConfirmDialog(false); setVideoToDelete(null); }}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteVideo} disabled={isSubmittingVideo} className="bg-destructive hover:bg-destructive/90">{isSubmittingVideo && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Eliminar Video</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={showDeleteInterviewConfirmDialog} onOpenChange={setShowDeleteInterviewConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeaderComponent><AlertDialogTitleComponent>¿Eliminar esta entrevista?</AlertDialogTitleComponent><AlertDialogDescriptionComponent>"{interviewToDelete?.nombre || ''}" será eliminada.</AlertDialogDescriptionComponent></AlertDialogHeaderComponent>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setShowDeleteInterviewConfirmDialog(false); setInterviewToDelete(null); }}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteInterview} disabled={isSubmittingInterview} className="bg-destructive hover:bg-destructive/90">{isSubmittingInterview && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Eliminar Entrevista</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
