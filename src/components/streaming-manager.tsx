"use client";

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import Link from 'next/link';
import Image from 'next/image';
import Hls from 'hls.js';
import type { StreamingConfig } from '@/types';

import { supabase, uploadImageToSupabase } from '@/lib/supabaseClient';
import { cn } from "@/lib/utils";

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription as AlertDialogDescriptionComponent, AlertDialogFooter, AlertDialogHeader as AlertDialogHeaderComponent, AlertDialogTitle as AlertDialogTitleComponent } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save, Home, Radio, Trash2, Edit3, XCircle, Link2, ChevronsUpDown, Check, ImageOff, Upload, LibraryBig } from 'lucide-react';
import { Alert, AlertDescription as ShadcnAlertDescription, AlertTitle as ShadcnAlertTitle } from "@/components/ui/alert";
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

const IMAGE_VIDEOS_BUCKET_NAME = 'imagenvideos';

const streamingSchema = z.object({
  nombre: z.string().min(1, { message: "El nombre no puede estar vacío." }).max(100, { message: "El nombre no puede exceder los 100 caracteres." }),
  url: z.string().url({ message: "Por favor, introduce una URL válida." })
    .min(1, { message: "La URL no puede estar vacía." }),
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

type StreamingFormValues = z.infer<typeof streamingSchema>;

const getYoutubeEmbedUrl = (url: string): string | null => {
  let videoId: string | null = null;
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();
    const pathname = urlObj.pathname;

    if (hostname.includes('youtube.com')) {
      if (pathname.startsWith('/watch')) {
        videoId = urlObj.searchParams.get('v');
      } else if (pathname.startsWith('/embed/')) {
        videoId = pathname.split('/embed/')[1].split('?')[0];
      } else if (pathname.startsWith('/live/')) {
        videoId = pathname.split('/live/')[1].split('?')[0];
      }
    } else if (hostname.includes('youtu.be')) {
      videoId = pathname.substring(1).split('?')[0];
    }
  } catch (e) {
    return null;
  }

  if (videoId) {
    return `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1`;
  }

  return null;
};

export function StreamingManager() {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(true);
  const [streams, setStreams] = React.useState<StreamingConfig[]>([]);
  const [errorLoading, setErrorLoading] = React.useState<string | null>(null);
  const [editingStreamId, setEditingStreamId] = React.useState<string | null>(null);
  const [showDeleteConfirmDialog, setShowDeleteConfirmDialog] = React.useState(false);
  const [streamToDelete, setStreamToDelete] = React.useState<StreamingConfig | null>(null);
  const [isTogglingActive, setIsTogglingActive] = React.useState(false);
  const editorFormCardRef = React.useRef<HTMLDivElement>(null);
  
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const activeStream = streams.find(s => s.isActive);
  
  const [eventNames, setEventNames] = React.useState<string[]>([]);
  const [isLoadingEventNames, setIsLoadingEventNames] = React.useState(true);
  const [isComboboxOpen, setIsComboboxOpen] = React.useState(false);

  const imageFileRef = React.useRef<HTMLInputElement>(null);
  const [previewImage, setPreviewImage] = React.useState<string | null>(null);
  const [isImageGalleryOpen, setIsImageGalleryOpen] = React.useState(false);
  const [existingImages, setExistingImages] = React.useState<string[]>([]);
  const [isLoadingExistingImages, setIsLoadingExistingImages] = React.useState(true);

  const youtubeEmbedUrl = React.useMemo(() => {
    if (!activeStream?.url) return null;
    return getYoutubeEmbedUrl(activeStream.url);
  }, [activeStream]);

  React.useEffect(() => {
    let hls: Hls | null = null;
    const videoElement = videoRef.current;
    
    if (activeStream && !youtubeEmbedUrl && videoElement) {
      if (Hls.isSupported()) {
        hls = new Hls();
        hls.loadSource(activeStream.url);
        hls.attachMedia(videoElement);
      } else if (videoElement.canPlayType('application/vnd.apple.mpegurl')) {
        videoElement.src = activeStream.url;
      }
    }

    return () => {
      if (hls) {
        hls.destroy();
      }
    };
  }, [activeStream, youtubeEmbedUrl]);

  const form = useForm<StreamingFormValues>({
    resolver: zodResolver(streamingSchema),
    defaultValues: {
      nombre: '',
      url: '',
      imagen: undefined,
    },
    mode: "onChange",
  });
  const watchedImagen = form.watch('imagen');

  const fetchStreamingConfigs = async () => {
    setIsLoading(true);
    setErrorLoading(null);
    try {
      const { data, error } = await supabase
        .from('streaming')
        .select('*')
        .order('createdAt', { ascending: false });

      if (error) throw error;
      setStreams(data || []);
    } catch (error: any) {
      handleSupabaseError(error, "cargar configuraciones de streaming", "list");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchEventNames = async () => {
    setIsLoadingEventNames(true);
    try {
      const { data, error } = await supabase
        .from('eventos_calendario')
        .select('name');

      if (error) throw error;

      const uniqueNames = Array.from(
        new Set(data.map(item => item.name).filter(Boolean) as string[])
      ).sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
      setEventNames(uniqueNames);
    } catch (err: any) {
      toast({ title: "Error al Cargar Nombres de Eventos", description: err.message, variant: "destructive" });
      setEventNames([]);
    } finally {
      setIsLoadingEventNames(false);
    }
  };

  const fetchExistingImages = async () => {
    setIsLoadingExistingImages(true);
    try {
      const { data, error } = await supabase
        .from('eventos_calendario')
        .select('imagen')
        .not('imagen', 'is', null);

      if (error) {
        if (error.code === '42703' || (error.message && error.message.includes('does not exist'))) {
          console.warn(`Could not fetch existing images because the 'imagen' column is likely missing from 'eventos_calendario'.`);
          setExistingImages([]);
        } else {
          throw error;
        }
      } else if (data) {
        const uniqueImages = Array.from(new Set(data.map((item) => (item.imagen as string)).filter(Boolean)));
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

  React.useEffect(() => {
    fetchStreamingConfigs();
    fetchEventNames();
    fetchExistingImages();
  }, []);

  const resetForm = () => {
    form.reset({ nombre: '', url: '', imagen: undefined });
    setEditingStreamId(null);
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
        return;
      }
      if (file.size > 5 * 1024 * 1024) { 
        toast({ title: "Archivo muy grande", description: "La imagen debe ser menor a 5MB.", variant: "destructive" });
        return;
      }
      form.setValue('imagen', file, { shouldValidate: true });
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSupabaseError = (error: any, actionDescription: string, context?: "save" | "delete" | "toggle" | "list") => {
    let description = `No se pudo ${actionDescription}. Inténtalo de nuevo.`;
    const errorCode = (typeof error?.code === 'string') ? error.code : "";
    const errorMessageOriginal = (typeof error?.message === 'string') ? error.message : "";
    const errorMessageLowerCase = errorMessageOriginal.toLowerCase();

    if (errorCode === 'PGRST116' || (errorMessageLowerCase.includes('relation') && errorMessageLowerCase.includes('does not exist')) || (error?.status === 404 && (errorMessageLowerCase.includes('not found') || errorMessageLowerCase.includes('no existe')))) {
      description = `Error CRÍTICO (Supabase): La tabla 'streaming' NO EXISTE o no es accesible. Por favor, VERIFICA la tabla y sus políticas RLS. Error original: ${errorMessageOriginal || 'Desconocido'}`;
    } else if (errorMessageLowerCase.includes("record") && errorMessageLowerCase.includes("has no field")) {
      const fieldMatch = errorMessageLowerCase.match(/field "([^"]+)"/);
      const problematicFieldInTrigger = fieldMatch && fieldMatch[1] ? fieldMatch[1] : "desconocido";
      
      let suggestedFix = `como por ejemplo "${problematicFieldInTrigger.charAt(0).toUpperCase() + problematicFieldInTrigger.slice(1)}" si su columna es camelCase, o usando comillas dobles como NEW."${problematicFieldInTrigger.charAt(0).toUpperCase() + problematicFieldInTrigger.slice(1)}" si es sensible a mayúsculas/minúsculas`;
      if (problematicFieldInTrigger === 'updatedat') {
        suggestedFix = "la columna podría llamarse 'updatedAt' (camelCase). El trigger SQL DEBE referenciarla como NEW.\"updatedAt\" (con comillas dobles)";
      } else if (problematicFieldInTrigger === 'createdat') {
        suggestedFix = "la columna podría llamarse 'createdAt' (camelCase). El trigger SQL DEBE referenciarla como NEW.\"createdAt\" (con comillas dobles)";
      }

      description = `Error de Base de Datos (TRIGGER SQL): Un trigger en la tabla 'streaming' está intentando acceder al campo '${problematicFieldInTrigger}' en el registro (NEW o OLD), pero este campo no existe como se esperaba en el trigger.
      - CAUSA MÁS PROBABLE: El trigger SQL está usando un nombre de campo incorrecto o con un casing incorrecto (ej: '${problematicFieldInTrigger}'). ${suggestedFix}.
      - SOLUCIÓN: Revise el código SQL de TODOS los triggers en la tabla 'streaming'. Si su columna tiene un nombre sensible a mayúsculas/minúsculas (ej: 'updatedAt'), el trigger DEBE referenciarla como NEW."updatedAt" o OLD."updatedAt" (con comillas dobles).
      Error original completo: "${errorMessageOriginal || 'Desconocido'}"`;
    } else if (errorCode === '42703' && errorMessageLowerCase.includes("column") && errorMessageLowerCase.includes("does not exist")) {
      const colMatch = errorMessageOriginal.match(/column "([^"]*)"/i);
      const missingColumn = colMatch && colMatch[1] ? colMatch[1] : "desconocida";
      const tableName = "streaming";
      description = `Error de Base de Datos: La columna '${missingColumn}' NO EXISTE en la tabla '${tableName}'. Por favor, verifica la estructura de tu tabla y asegúrate de que exista (ej: 'imagen', 'updatedAt'). Error: ${errorMessageOriginal || 'Desconocido'}`;
    } else if (errorCode === '23505' && errorMessageLowerCase.includes('unique constraint')) {
      description = `Error al guardar: Ya existe una configuración con un valor único similar (ej. ID o un campo con restricción UNIQUE). Error: ${errorMessageOriginal}`;
    } else if (errorMessageOriginal) {
      description = `Error al ${actionDescription}: ${errorMessageOriginal}.`;
    }
    toast({
      title: `Error en Streaming`,
      description: `${description} Revisa la consola y los logs de Supabase.`,
      variant: "destructive",
      duration: 20000,
    });
  };

  const onSubmit = async (data: StreamingFormValues) => {
    setIsSubmitting(true);
    const now = new Date().toISOString();
    let finalImageUrl: string | null = null;

    if (data.imagen instanceof File) {
      toast({ title: "Subiendo imagen...", description: "Por favor espera." });
      const dataUri = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = error => reject(error);
        reader.readAsDataURL(data.imagen as File);
      });

      const { url: uploadedUrl, errorMessage } = await uploadImageToSupabase(dataUri, IMAGE_VIDEOS_BUCKET_NAME);
      if (errorMessage) {
        toast({ title: "Error al subir imagen", description: errorMessage, variant: "destructive" });
        setIsSubmitting(false);
        return;
      }
      finalImageUrl = uploadedUrl;
    } else if (typeof data.imagen === 'string' && data.imagen.startsWith('http')) {
      finalImageUrl = data.imagen;
    }

    try {
      const payload: Partial<StreamingConfig> = {
        nombre: data.nombre,
        url: data.url,
        imagen: finalImageUrl,
        updatedAt: now,
      };

      if (editingStreamId) {
        const { data: updatedData, error: updateError } = await supabase
          .from('streaming')
          .update(payload)
          .eq('id', editingStreamId)
          .select()
          .single();
        if (updateError) throw updateError;
        toast({ title: "¡Configuración Actualizada!", description: `La configuración de streaming "${updatedData?.nombre}" ha sido actualizada.` });
      } else {
        const insertPayload: Omit<StreamingConfig, 'id'> = {
          ...payload,
          isActive: false,
          createdAt: now,
        } as Omit<StreamingConfig, 'id'>;

        const { data: insertedData, error: insertError } = await supabase
          .from('streaming')
          .insert([insertPayload])
          .select()
          .single();
        if (insertError) throw insertError;
        toast({ title: "¡Configuración Guardada!", description: `La configuración de streaming "${insertedData?.nombre}" ha sido guardada.` });
      }
      fetchStreamingConfigs();
      resetForm();
    } catch (error: any) {
      handleSupabaseError(error, editingStreamId ? "actualizar configuración" : "guardar nueva configuración", "save");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (stream: StreamingConfig) => {
    if (!stream.id) {
      toast({ title: "Error de Edición", description: "El stream no tiene un ID válido.", variant: "destructive"});
      return;
    }
    setEditingStreamId(stream.id);
    form.reset({
      nombre: stream.nombre,
      url: stream.url,
      imagen: stream.imagen || undefined,
    });
    setPreviewImage(stream.imagen || null);
    if (imageFileRef.current) imageFileRef.current.value = "";
    editorFormCardRef.current?.scrollIntoView({ behavior: 'smooth' });
    toast({ title: "Modo Edición", description: `Editando stream: ${stream.nombre}` });
  };

  const cancelEdit = () => {
    resetForm();
    toast({ title: "Edición Cancelada" });
  };

  const handleDelete = (stream: StreamingConfig) => {
    if (!stream.id) {
      toast({ title: "Error de Eliminación", description: "El stream no tiene un ID válido.", variant: "destructive"});
      return;
    }
    setStreamToDelete(stream);
    setShowDeleteConfirmDialog(true);
  };

  const confirmDelete = async () => {
    if (!streamToDelete || !streamToDelete.id) return;
    setIsSubmitting(true);
    try {
      const { error: deleteError } = await supabase
        .from('streaming')
        .delete()
        .eq('id', streamToDelete.id);
      if (deleteError) throw deleteError;
      toast({ title: "Configuración Eliminada", description: `La configuración "${streamToDelete.nombre}" ha sido eliminada.` });
      fetchStreamingConfigs();
      if (editingStreamId === streamToDelete.id) {
        cancelEdit();
      }
    } catch (error: any) {
      handleSupabaseError(error, `eliminar configuración "${streamToDelete.nombre}"`, "delete");
    } finally {
      setIsSubmitting(false);
      setShowDeleteConfirmDialog(false);
      setStreamToDelete(null);
    }
  };

  const handleActiveToggle = async (streamId: string, newActiveState: boolean) => {
    setIsTogglingActive(true);
    const now = new Date().toISOString();
    try {
      if (newActiveState) {
        const { error: deactivateError } = await supabase
          .from('streaming')
          .update({ isActive: false, updatedAt: now })
          .neq('id', streamId)
          .eq('isActive', true);

        if (deactivateError) {
          console.error("Error deactivating other streams:", (deactivateError as any)?.message || deactivateError);
          handleSupabaseError(deactivateError, "desactivar otros streams", "toggle");
        }
      }

      const { error: toggleError } = await supabase
        .from('streaming')
        .update({ isActive: newActiveState, updatedAt: now })
        .eq('id', streamId);

      if (toggleError) throw toggleError;

      toast({ title: "Estado de Stream Actualizado", description: `El stream ha sido ${newActiveState ? 'activado' : 'desactivado'}.` });
      fetchStreamingConfigs(); 
    } catch (error: any) {
      handleSupabaseError(error, "actualizar estado activo del stream", "toggle");
    } finally {
      setIsTogglingActive(false);
    }
  };
  
  const formatDate = (dateString?: string | null) => {
    if (!dateString) return 'Fecha desconocida';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'Fecha inválida';
      return date.toLocaleDateString('es-ES', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch (e: any) {
      return 'Error al formatear fecha';
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <header className="flex flex-col sm:flex-row items-center justify-center text-center mb-8 gap-3 sm:gap-4">
        <h1 className="text-4xl font-bold tracking-tight text-primary uppercase">Configuración de URLs de Streaming</h1>
      </header>
      <div className="mb-6 text-left">
        <Link href="/" passHref legacyBehavior>
          <Button variant="default" size="sm">
            <Home className="mr-2 h-4 w-4" />
            Volver al Inicio
          </Button>
        </Link>
      </div>

      <div className="grid lg:grid-cols-5 gap-8 items-start">
        {/* Columna Izquierda: Formulario y Lista */}
        <div className="lg:col-span-3 space-y-8">
          <Card className="shadow-xl" ref={editorFormCardRef}>
            <CardHeader>
              <CardTitle className="uppercase">{editingStreamId ? "Editar Configuración de Stream" : "Añadir Nueva Configuración de Stream"}</CardTitle>
              <CardDescription>
                Define un nombre y la URL para una fuente de streaming. Puedes activar una de estas configuraciones para usarla en el reproductor.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <FormField
                    control={form.control}
                    name="nombre"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Nombre del Stream</FormLabel>
                        <Popover open={isComboboxOpen} onOpenChange={setIsComboboxOpen}>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant="outline"
                                role="combobox"
                                className={cn(
                                  "w-full justify-between font-normal",
                                  !field.value && "text-muted-foreground"
                                )}
                              >
                                {field.value
                                  ? eventNames.find(
                                      (name) => name.toLowerCase() === field.value?.toLowerCase()
                                    ) || field.value
                                  : "Selecciona o escribe un nombre"}
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                            <Command>
                              <CommandInput
                                placeholder="Busca un nombre..."
                                value={field.value || ''}
                                onValueChange={(currentValue) => {
                                  field.onChange(currentValue);
                                }}
                              />
                              <CommandList>
                                <CommandEmpty>
                                  {isLoadingEventNames
                                    ? "Cargando nombres..."
                                    : "No se encontraron nombres."
                                  }
                                </CommandEmpty>
                                {!isLoadingEventNames && eventNames.length > 0 && (
                                  <CommandGroup heading="Nombres de eventos existentes">
                                    {eventNames.map((name) => (
                                      <CommandItem
                                        value={name}
                                        key={name}
                                        onSelect={() => {
                                          form.setValue("nombre", name);
                                          setIsComboboxOpen(false);
                                        }}
                                      >
                                        <Check
                                          className={cn(
                                            "mr-2 h-4 w-4",
                                            field.value?.toLowerCase() === name.toLowerCase()
                                              ? "opacity-100"
                                              : "opacity-0"
                                          )}
                                        />
                                        {name}
                                      </CommandItem>
                                    ))}
                                  </CommandGroup>
                                )}
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                        <FormDescription>
                          Puedes seleccionar un nombre de un evento existente o escribir uno nuevo.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="url"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>URL de Streaming</FormLabel>
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
                        <FormLabel>Imagen del Stream (Opcional)</FormLabel>
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
                            id="imagen-stream"
                            type="file"
                            ref={imageFileRef}
                            accept="image/*"
                            onChange={handleImageFileChange}
                            className="hidden"
                          />
                        </FormControl>
                        {previewImage && (
                          <div className="relative w-full max-w-xs h-32 rounded-md overflow-hidden border mt-2">
                            <Image src={previewImage} alt="Vista previa de la imagen" layout="fill" objectFit="contain" data-ai-hint="stream preview"/>
                          </div>
                        )}
                        <FormDescription>Sube una imagen (máx 5MB) o elige una de un evento existente.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex flex-col sm:flex-row gap-2 pt-2">
                    <Button type="submit" variant="destructive" disabled={isSubmitting || isTogglingActive} className="w-full sm:flex-1">
                      {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                      {editingStreamId ? "Actualizar Configuración" : "Guardar Configuración"}
                    </Button>
                    {editingStreamId && (
                      <Button type="button" variant="outline" onClick={cancelEdit} className="w-full sm:w-auto" disabled={isSubmitting || isTogglingActive}>
                        <XCircle className="mr-2 h-4 w-4" />
                        Cancelar Edición
                      </Button>
                    )}
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
          
          <div className="space-y-4">
            <h2 className="text-2xl font-semibold text-foreground mb-4 text-center lg:text-left uppercase">Configuraciones de Streaming Guardadas</h2>
            <div className="max-h-[calc(100vh-25rem)] overflow-y-auto pr-2">
              {isLoading && (
                <div className="flex justify-center items-center py-10">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="ml-2 text-muted-foreground">Cargando configuraciones...</p>
                </div>
              )}
              {errorLoading && !isLoading && (
                <Alert variant="destructive">
                  <Radio className="h-4 w-4" />
                  <ShadcnAlertTitle className="uppercase">Error al Cargar Configuraciones</ShadcnAlertTitle>
                  <ShadcnAlertDescription>{errorLoading}</ShadcnAlertDescription>
                </Alert>
              )}
              {!isLoading && !errorLoading && streams.length === 0 && (
                <div className="text-center py-10 border-2 border-dashed border-muted-foreground/30 rounded-lg">
                  <Radio className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
                  <p className="text-muted-foreground">No hay configuraciones de streaming guardadas.</p>
                  <p className="text-sm text-muted-foreground">Usa el formulario para añadir la primera configuración.</p>
                </div>
              )}
              {!isLoading && !errorLoading && streams.map((stream, index) => (
                <Card key={stream.id} className={`shadow-md hover:shadow-lg transition-shadow mb-4 ${stream.isActive ? 'border-destructive border-2' : ''}`}>
                  <CardHeader className="pb-2 pt-3 px-4 flex flex-row items-start gap-3">
                    <div className="relative w-20 h-14 rounded-md overflow-hidden border bg-muted flex-shrink-0">
                      {stream.imagen ? (
                        <Image src={stream.imagen} alt={`Imagen para ${stream.nombre}`} layout="fill" objectFit="cover" data-ai-hint="stream thumbnail"/>
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-muted">
                          <ImageOff className="w-8 h-8 text-muted-foreground" />
                        </div>
                      )}
                    </div>

                    <div className="flex-grow flex justify-between items-start">
                      <div>
                        <CardTitle className="text-lg font-semibold break-words uppercase">
                          <span className="text-primary mr-2">{index + 1}.</span>
                          {stream.nombre}
                        </CardTitle>
                        <div className="flex items-center text-sm text-muted-foreground mt-1">
                          <Link2 className="mr-2 h-4 w-4 shrink-0" />
                          <a href={stream.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline break-all truncate">
                            {stream.url}
                          </a>
                        </div>
                      </div>

                      <div className="flex flex-col items-end space-y-1 flex-shrink-0 ml-2">
                        {stream.isActive && (
                          <Badge className="whitespace-nowrap bg-destructive text-destructive-foreground text-xs px-1.5 py-0.5">Activo</Badge>
                        )}
                        <div className="flex items-center space-x-1">
                          <Label htmlFor={`active-switch-${stream.id}`} className="text-xs text-muted-foreground">
                            Activar
                          </Label>
                          <Switch
                            id={`active-switch-${stream.id}`}
                            checked={!!stream.isActive} 
                            onCheckedChange={(isChecked) => {
                              if (stream.id) {
                                handleActiveToggle(stream.id, isChecked);
                              } else {
                                toast({title: "Error", description: "Falta ID del stream para cambiar estado.", variant: "destructive"});
                              }
                            }}
                            disabled={isTogglingActive || isSubmitting}
                            className="data-[state=checked]:bg-destructive data-[state=unchecked]:bg-input h-5 w-9 [&>span]:h-4 [&>span]:w-4 [&>span]:data-[state=checked]:translate-x-4"
                            aria-label={`Activar stream ${stream.nombre}`}
                          />
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  
                  <CardFooter className="text-xs text-muted-foreground pt-1 pb-3 px-4 flex justify-between items-center bg-muted/30">
                    <div>
                      <p className="text-xs text-muted-foreground/80">Creado: {formatDate(stream.createdAt)}</p>
                      {stream.updatedAt && stream.createdAt !== stream.updatedAt && (
                        <p className="text-xs text-muted-foreground/70">Actualizado: {formatDate(stream.updatedAt)}</p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => handleEdit(stream)} disabled={isSubmitting || isTogglingActive} className="h-7 px-2.5 text-xs bg-green-500 hover:bg-green-600 text-black">
                        <Edit3 className="mr-1 h-3 w-3" /> Editar
                      </Button>
                      <Button variant="destructive" size="sm" onClick={() => handleDelete(stream)} disabled={isSubmitting || isTogglingActive || stream.isActive} className="h-7 px-2.5 text-xs">
                        <Trash2 className="mr-1 h-3 w-3" /> Eliminar
                      </Button>
                    </div>
                  </CardFooter>
                </Card>
              ))}
            </div>
          </div>
        </div>

        {/* Columna Derecha: Reproductor de Video */}
        <div className="lg:col-span-2">
          {activeStream && (
            <Card className="shadow-xl lg:sticky lg:top-8 bg-muted/30">
              <CardHeader>
                <CardTitle className="uppercase">Reproductor de Prueba (Stream Activo)</CardTitle>
                <CardDescription>
                  Reproduciendo: <span className="font-semibold text-primary">{activeStream.nombre}</span>
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="aspect-video w-full bg-black rounded-md overflow-hidden border">
                  {youtubeEmbedUrl ? (
                    <iframe
                      key={activeStream.id}
                      src={youtubeEmbedUrl}
                      title="YouTube video player"
                      frameBorder="0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      allowFullScreen
                      className="w-full h-full"
                    ></iframe>
                  ) : (
                    <video
                      ref={videoRef}
                      key={activeStream.id}
                      id="streaming-player"
                      controls
                      autoPlay
                      muted
                      playsInline
                      width="100%"
                      className="w-full h-full"
                    >
                      Tu navegador no soporta la etiqueta de video para reproducir este stream.
                    </video>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <Dialog open={isImageGalleryOpen} onOpenChange={setIsImageGalleryOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="uppercase">Seleccionar una Imagen Existente</DialogTitle>
            <DialogDescription>
              Haz clic en una imagen para seleccionarla para tu stream. Estas imágenes provienen de eventos guardados.
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
                    <Image src={imgUrl} alt={`Imagen de evento ${index + 1}`} layout="fill" objectFit="cover" className="transition-transform group-hover:scale-105" data-ai-hint="stream galeria"/>
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
            <AlertDialogTitleComponent className="uppercase">¿Estás seguro de eliminar esta configuración?</AlertDialogTitleComponent>
            <AlertDialogDescriptionComponent>
              Esta acción no se puede deshacer. La configuración de stream "{streamToDelete?.nombre || 'seleccionada'}" será eliminada permanentemente.
            </AlertDialogDescriptionComponent>
          </AlertDialogHeaderComponent>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setShowDeleteConfirmDialog(false); setStreamToDelete(null); }}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={isSubmitting || isTogglingActive} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Eliminar Configuración
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}