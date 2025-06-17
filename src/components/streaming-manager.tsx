
"use client";

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import Link from 'next/link';
import type { StreamingConfig } from '@/types';

import { supabase } from '@/lib/supabaseClient';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader as AlertDialogHeaderComponent, AlertDialogTitle as AlertDialogTitleComponent } from "@/components/ui/alert-dialog";
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save, Home, Radio, Trash2, Edit3, XCircle, Link2 } from 'lucide-react';
import { Alert, AlertDescription as ShadcnAlertDescription, AlertTitle as ShadcnAlertTitle } from "@/components/ui/alert";
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

const streamingSchema = z.object({
  nombre: z.string().min(1, { message: "El nombre no puede estar vacío." }).max(100, { message: "El nombre no puede exceder los 100 caracteres." }),
  url_de_streaming: z.string().url({ message: "Por favor, introduce una URL válida." })
    .min(1, { message: "La URL no puede estar vacía." }),
});

type StreamingFormValues = z.infer<typeof streamingSchema>;

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

  const form = useForm<StreamingFormValues>({
    resolver: zodResolver(streamingSchema),
    defaultValues: {
      nombre: '',
      url_de_streaming: '',
    },
    mode: "onChange",
  });

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

  React.useEffect(() => {
    fetchStreamingConfigs();
  }, []);

  const resetForm = () => {
    form.reset({ nombre: '', url_de_streaming: '' });
    setEditingStreamId(null);
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
        if (problematicFieldInTrigger === 'updatedat') { // Specific check for 'updatedat'
            suggestedFix = "la columna podría llamarse 'updatedAt' (camelCase). El trigger SQL DEBE referenciarla como NEW.\"updatedAt\" (con comillas dobles)";
        } else if (problematicFieldInTrigger === 'createdat') {
             suggestedFix = "la columna podría llamarse 'createdAt' (camelCase). El trigger SQL DEBE referenciarla como NEW.\"createdAt\" (con comillas dobles)";
        }


        description = `Error de Base de Datos (TRIGGER SQL): Un trigger en la tabla 'streaming' está intentando acceder al campo '${problematicFieldInTrigger}' en el registro (NEW o OLD), pero este campo no existe como se esperaba en el trigger.
        - CAUSA MÁS PROBABLE: El trigger SQL está usando un nombre de campo incorrecto o con un casing incorrecto (ej: '${problematicFieldInTrigger}'). ${suggestedFix}.
        - SOLUCIÓN: Revise el código SQL de TODOS los triggers en la tabla 'streaming'. Si su columna tiene un nombre sensible a mayúsculas/minúsculas (ej: 'updatedAt'), el trigger DEBE referenciarla como NEW."updatedAt" o OLD."updatedAt" (con comillas dobles).
        Error original completo: "${errorMessageOriginal || 'Desconocido'}"`;
    } else if (errorCode === '42703' && errorMessageLowerCase.includes("column") && errorMessageLowerCase.includes("does not exist")) {
        const colMatch = errorMessageOriginal.match(/'([^']*)' column of '([^']*)'/i) || errorMessageOriginal.match(/column "([^"]*)" of relation "([^"]*)" does not exist/i);
        const missingColumn = colMatch && colMatch[1] ? colMatch[1] : "desconocida";
        const tableName = colMatch && colMatch[2] ? colMatch[2] : "streaming";
        description = `Error de Base de Datos: La columna '${missingColumn}' NO EXISTE en la tabla '${tableName}' según el caché de Supabase o la base de datos. Por favor, verifica la estructura de tu tabla '${tableName}' en el Dashboard de Supabase y asegúrate de que la columna '${missingColumn}' (con el casing correcto, ej: 'updatedAt') exista. Error: ${errorMessageOriginal || 'Desconocido'}`;
    } else if (errorCode === '23505' && errorMessageLowerCase.includes('unique constraint')) {
        description = `Error al guardar: Ya existe una configuración con un valor único similar (ej. ID o un campo con restricción UNIQUE). Error: ${errorMessageOriginal}`;
    } else if (errorMessageOriginal) {
      description = `Error al ${actionDescription}: ${errorMessageOriginal}.`;
    }
    toast({
      title: `Error en Streaming`,
      description: `${description} Revisa la consola y los logs de Supabase.`,
      variant: "destructive",
      duration: 20000, // Increased duration for complex error messages
    });
  };

  const onSubmit = async (data: StreamingFormValues) => {
    setIsSubmitting(true);
    const now = new Date().toISOString();

    try {
      if (editingStreamId) {
        const payload = {
          nombre: data.nombre,
          url_de_streaming: data.url_de_streaming,
          updatedAt: now, // Frontend sends "updatedAt"
        };
        const { data: updatedData, error: updateError } = await supabase
          .from('streaming')
          .update(payload)
          .eq('id', editingStreamId)
          .select()
          .single();
        if (updateError) throw updateError;
        toast({ title: "¡Configuración Actualizada!", description: `La configuración de streaming "${updatedData?.nombre}" ha sido actualizada.` });
      } else {
        const payload: Omit<StreamingConfig, 'id'> = {
          nombre: data.nombre,
          url_de_streaming: data.url_de_streaming,
          isActive: false,
          createdAt: now, // Frontend sends "createdAt"
          updatedAt: now, // Frontend sends "updatedAt"
        };
        const { data: insertedData, error: insertError } = await supabase
          .from('streaming')
          .insert([payload])
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
      url_de_streaming: stream.url_de_streaming,
    });
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
          .update({ isActive: false, updatedAt: now })  // Frontend sends "updatedAt"
          .neq('id', streamId)
          .eq('isActive', true);

        if (deactivateError) {
          // Log error but try to proceed with activating the selected one
          console.error(
            "Error deactivating other streams (Supabase trigger likely at fault, check SQL for 'updatedat' vs '\"updatedAt\"'):", 
            (deactivateError as any)?.message || deactivateError
          );
          handleSupabaseError(deactivateError, "desactivar otros streams", "toggle");
        }
      }

      const { error: toggleError } = await supabase
        .from('streaming')
        .update({ isActive: newActiveState, updatedAt: now }) // Frontend sends "updatedAt"
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

      <div className="space-y-8 mt-8">
        <Card className="shadow-xl lg:max-w-2xl mx-auto" ref={editorFormCardRef}>
          <CardHeader>
            <CardTitle>{editingStreamId ? "Editar Configuración de Stream" : "Añadir Nueva Configuración de Stream"}</CardTitle>
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
                    <FormItem>
                      <FormLabel>Nombre del Stream</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="url_de_streaming"
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
                <ShadcnAlertTitle>Error al Cargar Configuraciones</ShadcnAlertTitle>
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
              <Card key={stream.id} className={`shadow-md hover:shadow-lg transition-shadow mb-4 ${stream.isActive ? 'border-green-500 border-2' : ''}`}>
                <CardHeader className="pb-2 pt-3 px-4">
                  <div className="flex justify-between items-start gap-2">
                    <CardTitle className="text-lg font-semibold break-words">
                      <span className="text-primary mr-2">{index + 1}.</span>
                      {stream.nombre}
                    </CardTitle>
                    <div className="flex flex-col items-end space-y-1 flex-shrink-0">
                      {stream.isActive && (
                        <Badge className="whitespace-nowrap bg-green-600 text-primary-foreground text-xs px-1.5 py-0.5">Activo</Badge>
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
                          className="data-[state=checked]:bg-green-600 data-[state=unchecked]:bg-input h-5 w-9 [&>span]:h-4 [&>span]:w-4 [&>span]:data-[state=checked]:translate-x-4"
                          aria-label={`Activar stream ${stream.nombre}`}
                        />
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pb-2 pt-0 px-4">
                  <div className="flex items-center text-sm text-muted-foreground">
                    <Link2 className="mr-2 h-4 w-4 shrink-0" />
                    <a href={stream.url_de_streaming} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline break-all truncate">
                      {stream.url_de_streaming}
                    </a>
                  </div>
                  <p className="text-xs text-muted-foreground/80 mt-1">Creado: {formatDate(stream.createdAt)}</p>
                   {stream.updatedAt && stream.createdAt !== stream.updatedAt && (
                      <p className="text-xs text-muted-foreground/70">Actualizado: {formatDate(stream.updatedAt)}</p>
                   )}
                </CardContent>
                <CardFooter className="text-xs text-muted-foreground pt-1 pb-3 px-4 flex justify-end gap-2 bg-muted/30">
                  <Button variant="outline" size="sm" onClick={() => handleEdit(stream)} disabled={isSubmitting || isTogglingActive} className="h-7 px-2.5 text-xs">
                    <Edit3 className="mr-1 h-3 w-3" /> Editar
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => handleDelete(stream)} disabled={isSubmitting || isTogglingActive || stream.isActive} className="h-7 px-2.5 text-xs">
                    <Trash2 className="mr-1 h-3 w-3" /> Eliminar
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        </div>
      </div>

      <AlertDialog open={showDeleteConfirmDialog} onOpenChange={setShowDeleteConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeaderComponent>
            <AlertDialogTitleComponent>¿Estás seguro de eliminar esta configuración?</AlertDialogTitleComponent>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. La configuración de stream "{streamToDelete?.nombre || 'seleccionada'}" será eliminada permanentemente.
            </AlertDialogDescription>
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


    
