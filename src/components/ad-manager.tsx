
"use client";

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import Image from 'next/image';
import type { Advertisement } from '@/types';
import { addDays, parseISO } from 'date-fns';

import { supabase, uploadImageToSupabase } from '@/lib/supabaseClient'; 

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader as AlertDialogHeaderComponent, AlertDialogTitle as AlertDialogTitleComponent } from "@/components/ui/alert-dialog";
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save, Trash2, Upload, ImageOff, Edit3, XCircle, Tag, CalendarClock } from 'lucide-react';
import { Alert, AlertDescription as ShadcnAlertDescription, AlertTitle as ShadcnAlertTitle } from "@/components/ui/alert";
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

const BUCKET_NAME = 'imagenes-anuncios';

const adSchema = z.object({
  name: z.string().min(3, { message: "El nombre debe tener al menos 3 caracteres." }).max(100, { message: "El nombre debe tener 100 caracteres o menos." }),
  imageUrl: z.string()
    .refine(
      (value) => {
        if (value === "") return false; // Image is required
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
    ),
});

type AdFormValues = z.infer<typeof adSchema>;

export function AdManager() {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const editorFormCardRef = React.useRef<HTMLDivElement>(null);

  const [ads, setAds] = React.useState<Advertisement[]>([]);
  const [isLoadingAds, setIsLoadingAds] = React.useState(true);
  const [errorLoadingAds, setErrorLoadingAds] = React.useState<string | null>(null);

  const [editingAdId, setEditingAdId] = React.useState<string | null>(null);
  const [showDeleteConfirmDialog, setShowDeleteConfirmDialog] = React.useState(false);
  const [adToDelete, setAdToDelete] = React.useState<Advertisement | null>(null);
  const [isTogglingActive, setIsTogglingActive] = React.useState(false);


  const form = useForm<AdFormValues>({
    resolver: zodResolver(adSchema),
    defaultValues: {
      name: '',
      imageUrl: '',
    },
    mode: "onChange",
  });

  const watchedImageUrl = form.watch('imageUrl');

  const fetchAds = async () => {
    setIsLoadingAds(true);
    setErrorLoadingAds(null);
    try {
      const { data, error } = await supabase
        .from('anuncios')
        .select('*')
        .order('createdAt', { ascending: false });

      if (error) throw error;
      setAds(data || []);
    } catch (error: any) {
      console.error("Error cargando anuncios:", error);
      const description = `No se pudieron cargar los anuncios: ${error.message || 'Error desconocido'}. Verifica la consola y los logs de Supabase. Asegúrate de que la tabla 'anuncios' exista y tenga RLS configuradas.`;
      setErrorLoadingAds(description);
      toast({
        title: "Error al Cargar Anuncios",
        description,
        variant: "destructive",
      });
    } finally {
      setIsLoadingAds(false);
    }
  };

  React.useEffect(() => {
    fetchAds();
  }, []);

  const resetFormAndPreview = () => {
    form.reset({ name: '', imageUrl: '' });
    if (fileInputRef.current) {
      fileInputRef.current.value = ""; 
    }
    setEditingAdId(null);
  };

  const onSubmit = async (data: AdFormValues) => {
    setIsSubmitting(true);
    let finalImageUrl = data.imageUrl;
    const now = new Date().toISOString();
  
    if (data.imageUrl && data.imageUrl.startsWith('data:image/')) {
      toast({ title: "Subiendo imagen...", description: "Por favor espera un momento." });
      const uploadedUrl = await uploadImageToSupabase(data.imageUrl, BUCKET_NAME); 
      
      if (uploadedUrl) {
        finalImageUrl = uploadedUrl;
        form.setValue('imageUrl', uploadedUrl, { shouldValidate: true, shouldDirty: true });
        toast({
          title: "Imagen Subida",
          description: `La imagen se ha subido correctamente al bucket '${BUCKET_NAME}'.`,
        });
      } else {
        toast({
          title: "Error al Subir Imagen",
          description: `No se pudo subir la imagen al bucket '${BUCKET_NAME}'. Verifica los permisos de tu bucket y los logs de Supabase. El anuncio se guardará con la URL original si la subida falla.`,
          variant: "destructive",
          duration: 9000, 
        });
        if (!finalImageUrl.startsWith('http')) {
            setIsSubmitting(false);
            return;
        }
      }
    }

    try {
      if (editingAdId) {
        const adPayload = {
          name: data.name,
          imageUrl: finalImageUrl,
          updatedAt: now,
        };
        const { data: updatedData, error: updateError } = await supabase
          .from('anuncios')
          .update(adPayload)
          .eq('id', editingAdId)
          .select()
          .single();
        if (updateError) throw updateError;
        toast({ title: "¡Anuncio Actualizado!", description: `El anuncio "${updatedData?.name}" ha sido actualizado.` });
      } else {
        const payloadToInsert = { 
          name: data.name,
          imageUrl: finalImageUrl,
          createdAt: now,
          updatedAt: now,
          isActive: false, 
        };
        const { data: insertedData, error: insertError } = await supabase
          .from('anuncios')
          .insert([payloadToInsert])
          .select()
          .single();
        if (insertError) throw insertError;
        toast({ 
          title: "¡Anuncio Guardado!", 
          description: `El anuncio "${insertedData?.name}" ha sido guardado.` 
        });
      }
      fetchAds();
      resetFormAndPreview();
    } catch (error: any) {
      console.error("Error al guardar anuncio:", error);
      let description = "No se pudo guardar el anuncio. Inténtalo de nuevo.";
      const errorCode = (typeof error?.code === 'string') ? error.code : "";
      const errorMessageLowerCase = (typeof error?.message === 'string') ? error.message.toLowerCase() : "";

      if (errorCode === 'PGRST116' || (errorMessageLowerCase.includes('relation') && errorMessageLowerCase.includes('does not exist')) || (error?.status === 404 && (errorMessageLowerCase.includes('not found') || errorMessageLowerCase.includes('no existe')))) {
        description = `Error CRÍTICO 404 (Not Found): La tabla 'anuncios' PARECE NO EXISTIR o no es accesible. Por favor, VERIFICA URGENTEMENTE tu configuración de tabla 'anuncios' y sus políticas RLS en el panel de Supabase. (Código de error original: ${errorCode})`;
      } else if (error?.message) {
        description = `Error al guardar: ${error.message}.`;
         if (error?.code) description += ` (Código: ${error.code})`;
      }
      toast({
        title: "Error al Guardar Anuncio",
        description: `${description} Revisa la consola y los logs de Supabase.`,
        variant: "destructive",
        duration: 10000,
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (!file.type.startsWith("image/")) {
        toast({ title: "Tipo de archivo no válido", description: "Por favor, sube un archivo de imagen.", variant: "destructive" });
        return;
      }
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
         toast({ title: "Archivo demasiado grande", description: "Sube una imagen de menos de 5MB.", variant: "destructive" });
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
    if (!dateString) return 'Fecha desconocida';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        console.warn(`'formatDate' recibió una cadena de fecha inválida: "${dateString}"`);
        return 'Fecha inválida';
      }
      return date.toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch (e: any) {
      console.error("Error en 'formatDate':", dateString, e instanceof Error ? e.message : String(e));
      return 'Error al formatear fecha';
    }
  };

  const calculateAndFormatExpiryDate = (createdAt?: string | null) => {
    if (!createdAt) return 'Fecha desconocida';
    try {
      const createdDate = parseISO(createdAt);
      if (isNaN(createdDate.getTime())) {
        console.warn(`calculateAndFormatExpiryDate recibió una cadena de fecha de creación inválida: "${createdAt}"`);
        return 'Fecha de creación inválida';
      }
      const expiryDate = addDays(createdDate, 30);
      return expiryDate.toLocaleDateString('es-ES', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch (e: any) {
      console.error("Error en 'calculateAndFormatExpiryDate':", createdAt, e instanceof Error ? e.message : String(e));
      return 'Error al calcular vencimiento';
    }
  };

  const handleEdit = (adToEdit: Advertisement) => {
    if (!adToEdit.id) return;
    setEditingAdId(adToEdit.id);
    form.reset({
      name: adToEdit.name,
      imageUrl: adToEdit.imageUrl,
    });
    if (fileInputRef.current) fileInputRef.current.value = "";
    editorFormCardRef.current?.scrollIntoView({ behavior: 'smooth' });
    toast({ title: "Modo Edición", description: `Editando anuncio: ${adToEdit.name}` });
  };

  const cancelEdit = () => {
    resetFormAndPreview();
    toast({ title: "Edición Cancelada" });
  };

  const handleDelete = (ad: Advertisement) => {
    if (!ad.id) return;
    setAdToDelete(ad);
    setShowDeleteConfirmDialog(true);
  };

  const confirmDelete = async () => {
    if (!adToDelete || !adToDelete.id) return;
    setIsSubmitting(true);
    try {
      const { error: deleteError } = await supabase
        .from('anuncios')
        .delete()
        .eq('id', adToDelete.id);
      if (deleteError) throw deleteError;
      toast({ title: "Anuncio Eliminado", description: `El anuncio "${adToDelete.name}" ha sido eliminado.` });
      fetchAds();
      if (editingAdId === adToDelete.id) {
        cancelEdit();
      }
    } catch (error: any) {
      console.error("Error al eliminar anuncio:", error);
      toast({ title: "Error al Eliminar", description: `No se pudo eliminar el anuncio: ${error.message || 'Error desconocido'}.`, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
      setShowDeleteConfirmDialog(false);
      setAdToDelete(null);
    }
  };

  const handleActiveToggle = async (adId: string, newActiveState: boolean) => {
    setIsTogglingActive(true);
    try {
      const now = new Date().toISOString();
      const { error } = await supabase
        .from('anuncios')
        .update({ isActive: newActiveState, updatedAt: now })
        .eq('id', adId);

      if (error) throw error;

      toast({ title: "Estado de Anuncio Actualizado", description: `El anuncio ha sido ${newActiveState ? 'activado' : 'desactivado'}.` });
      fetchAds(); 
    } catch (error: any) {
      console.error("Error al actualizar estado del anuncio:", error);
      toast({ title: "Error al Actualizar Estado", description: `No se pudo actualizar el estado del anuncio: ${error.message || 'Error desconocido'}.`, variant: "destructive" });
    } finally {
      setIsTogglingActive(false);
    }
  };


  return (
    <div className="container mx-auto px-4 py-8">
      <header className="mb-8 text-center">
        <h1 className="text-4xl font-bold tracking-tight text-primary">Gestor de Publicidad</h1>
      </header>

      <div className="grid lg:grid-cols-2 gap-8 items-start">
        <Card className="lg:col-span-1 shadow-xl" ref={editorFormCardRef}>
          <CardHeader>
            <CardTitle>{editingAdId ? "Editar Anuncio" : "Crear Nuevo Anuncio"}</CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nombre del Anuncio</FormLabel>
                      <FormControl>
                        <Input placeholder="Ej: Venta de Verano" {...field} />
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
                      <FormLabel>Imagen del Anuncio</FormLabel>
                      <div className="flex flex-col sm:flex-row gap-2 items-start">
                        <FormControl className="flex-grow">
                          <Input 
                            placeholder="https://ejemplo.com/imagen.png o subir" 
                            {...field}
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
                        Introduce una URL o sube una imagen (máx 5MB).
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                {watchedImageUrl && (watchedImageUrl.startsWith('http') || watchedImageUrl.startsWith('data:image')) && (
                  <div className="relative w-full max-w-xs h-48 rounded-md overflow-hidden border">
                     <Image src={watchedImageUrl} alt="Vista previa de la imagen actual" layout="fill" objectFit="contain" data-ai-hint="anuncio banner"/>
                  </div>
                )}
                
                <div className="flex flex-col sm:flex-row gap-2 pt-2">
                    <Button type="submit" variant="destructive" disabled={isSubmitting || isTogglingActive} className="w-full sm:flex-1">
                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    {editingAdId ? "Actualizar Anuncio" : "Guardar Anuncio"}
                    </Button>
                    {editingAdId && (
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

        <div className="lg:col-span-1 space-y-4 max-h-[calc(100vh-15rem)] overflow-y-auto pr-2">
          <h2 className="text-2xl font-semibold text-foreground mb-4">Anuncios Existentes</h2>
          {isLoadingAds && (
            <div className="flex justify-center items-center py-10">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="ml-2 text-muted-foreground">Cargando anuncios...</p>
            </div>
          )}
          {errorLoadingAds && (
             <Alert variant="destructive">
               <Tag className="h-4 w-4" />
               <ShadcnAlertTitle>Error al Cargar Anuncios</ShadcnAlertTitle>
               <ShadcnAlertDescription>{errorLoadingAds}</ShadcnAlertDescription>
             </Alert>
          )}
          {!isLoadingAds && !errorLoadingAds && ads.length === 0 && (
            <div className="text-center py-10 border-2 border-dashed border-muted-foreground/30 rounded-lg">
              <Tag className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
              <p className="text-muted-foreground">No hay anuncios guardados.</p>
              <p className="text-sm text-muted-foreground">Usa el formulario para añadir tu primer anuncio.</p>
            </div>
          )}
          {!isLoadingAds && !errorLoadingAds && ads.map((ad) => (
            <Card key={ad.id} className="shadow-md hover:shadow-lg transition-shadow">
              <CardHeader className="pb-2 pt-3 px-3 flex flex-row justify-between items-start">
                <CardTitle className="text-md font-semibold break-words flex-grow">{ad.name}</CardTitle>
                <div className="flex flex-col items-end space-y-1 flex-shrink-0 ml-2">
                  {ad.isActive && (
                    <Badge className="whitespace-nowrap bg-accent text-accent-foreground text-xs px-1.5 py-0.5">Activo</Badge>
                  )}
                  <div className="flex items-center space-x-1">
                    <Label htmlFor={`active-switch-${ad.id}`} className="text-xs text-muted-foreground">
                      Activo
                    </Label>
                    <Switch
                      id={`active-switch-${ad.id}`}
                      checked={!!ad.isActive}
                      onCheckedChange={(isChecked) => {
                        if (ad.id) {
                          handleActiveToggle(ad.id, isChecked);
                        }
                      }}
                      disabled={isTogglingActive || isSubmitting}
                      className="data-[state=checked]:bg-accent data-[state=unchecked]:bg-input h-5 w-9 [&>span]:h-4 [&>span]:w-4 [&>span]:data-[state=checked]:translate-x-4"
                      aria-label={`Marcar anuncio ${ad.name} como activo`}
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pb-2 pt-0 px-3">
                <div className="relative w-full aspect-[16/9] max-h-32 rounded-md overflow-hidden border bg-muted mb-1.5">
                  {(ad.imageUrl && (ad.imageUrl.startsWith('http') || ad.imageUrl.startsWith('data:image'))) ? (
                    <Image
                      src={ad.imageUrl}
                      alt={`Imagen para ${ad.name}`}
                      layout="fill"
                      objectFit="contain"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.src = 'https://placehold.co/300x150.png'; 
                        target.srcset = '';
                      }}
                      data-ai-hint="publicidad imagen"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-muted">
                       <ImageOff className="w-6 h-6 text-muted-foreground" />
                    </div>
                  )}
                </div>
                 <p className="text-xs text-muted-foreground/80">Creado: {formatDate(ad.createdAt)}</p>
                 {ad.updatedAt && ad.createdAt !== ad.updatedAt && (
                    <p className="text-xs text-muted-foreground/70">Actualizado: {formatDate(ad.updatedAt)}</p>
                 )}
                 <p className="text-xs text-orange-600 dark:text-orange-400 flex items-center">
                   <CalendarClock className="mr-1 h-3 w-3" />
                   Vencimiento: {calculateAndFormatExpiryDate(ad.createdAt)}
                 </p>
              </CardContent>
              <CardFooter className="text-xs text-muted-foreground pt-0 pb-2 px-3 flex justify-end gap-1.5">
                <Button variant="outline" size="sm" onClick={() => handleEdit(ad)} disabled={isSubmitting || isTogglingActive} className="h-7 px-2.5 text-xs">
                  <Edit3 className="mr-1 h-3 w-3" /> Editar
                </Button>
                <Button variant="destructive" size="sm" onClick={() => handleDelete(ad)} disabled={isSubmitting || isTogglingActive} className="h-7 px-2.5 text-xs">
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
            <AlertDialogTitleComponent>¿Estás seguro de eliminar este anuncio?</AlertDialogTitleComponent>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. El anuncio "{adToDelete?.name || 'seleccionado'}" será eliminado permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeaderComponent>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setShowDeleteConfirmDialog(false); setAdToDelete(null); }}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={isSubmitting || isTogglingActive} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Eliminar Anuncio
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
