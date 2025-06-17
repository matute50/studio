
"use client";

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import Image from 'next/image';
import Link from 'next/link';
import type { HeaderImageItem } from '@/types';

import { supabase, uploadImageToSupabase } from '@/lib/supabaseClient';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription as AlertDialogDescriptionComponent, AlertDialogFooter, AlertDialogHeader as AlertDialogHeaderComponent, AlertDialogTitle as AlertDialogTitleComponent } from "@/components/ui/alert-dialog";
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save, Trash2, Upload, ImageOff, Edit3, XCircle, Home, ImageUp, Sun, Moon } from 'lucide-react';
import { Alert, AlertDescription as ShadcnAlertDescription, AlertTitle as ShadcnAlertTitle } from "@/components/ui/alert";
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

const HEADER_IMAGE_BUCKET_NAME = 'imagenesheader';

const imageSchema = z.object({
  nombre: z.string().min(3, { message: "El nombre debe tener al menos 3 caracteres." }).max(100, { message: "El nombre debe tener 100 caracteres o menos." }),
  imageFile: z.instanceof(File, { message: "Se requiere una imagen." })
    .refine(file => file.size <= 5 * 1024 * 1024, `El tamaño máximo del archivo es 5MB.`)
    .refine(
      file => ["image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml"].includes(file.type),
      "Solo se permiten formatos .jpg, .png, .webp, .gif, .svg."
    ),
  mode: z.enum(['light', 'dark']),
});

type ImageFormValues = z.infer<typeof imageSchema>;

export function HeaderImageManager() {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const editorFormCardRef = React.useRef<HTMLDivElement>(null);
  
  const [headerImages, setHeaderImages] = React.useState<HeaderImageItem[]>([]);
  const [isLoadingImages, setIsLoadingImages] = React.useState(true);
  const [errorLoadingImages, setErrorLoadingImages] = React.useState<string | null>(null);

  const [showDeleteConfirmDialog, setShowDeleteConfirmDialog] = React.useState(false);
  const [imageToDelete, setImageToDelete] = React.useState<HeaderImageItem | null>(null);
  const [previewImage, setPreviewImage] = React.useState<string | null>(null);

  const form = useForm<ImageFormValues>({
    resolver: zodResolver(imageSchema),
    defaultValues: {
      nombre: '',
      imageFile: undefined,
      mode: 'light',
    },
    mode: "onChange",
  });

  const fetchHeaderImages = async () => {
    setIsLoadingImages(true);
    setErrorLoadingImages(null);
    try {
      const { data, error } = await supabase
        .from('imagenes_header')
        .select('*')
        .order('createdAt', { ascending: false });

      if (error) throw error;
      setHeaderImages(data || []);
    } catch (error: any) {
      const description = `No se pudieron cargar las imágenes del header: ${error.message || 'Error desconocido'}. Verifica que la tabla 'imagenes_header' exista y tenga RLS configuradas.`;
      setErrorLoadingImages(description);
      toast({
        title: "Error al Cargar Imágenes",
        description,
        variant: "destructive",
      });
    } finally {
      setIsLoadingImages(false);
    }
  };

  React.useEffect(() => {
    fetchHeaderImages();
  }, []);

  const resetFormAndPreview = () => {
    form.reset({ nombre: '', imageFile: undefined, mode: 'light' });
    setPreviewImage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      form.setValue('imageFile', file, { shouldValidate: true });
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      form.setValue('imageFile', undefined, { shouldValidate: true });
      setPreviewImage(null);
    }
  };
  
  const onSubmit = async (data: ImageFormValues) => {
    setIsSubmitting(true);
    
    if (data.imageFile) {
      const reader = new FileReader();
      reader.readAsDataURL(data.imageFile);
      reader.onload = async (event) => {
        const dataUri = event.target?.result as string;
        if (!dataUri) {
          toast({ title: "Error de Archivo", description: "No se pudo leer el archivo de imagen.", variant: "destructive" });
          setIsSubmitting(false);
          return;
        }

        toast({ title: "Subiendo imagen...", description: "Por favor espera." });
        const { url: uploadedImageUrl, errorMessage: uploadErrorMessage } = await uploadImageToSupabase(dataUri, HEADER_IMAGE_BUCKET_NAME);

        if (uploadedImageUrl) {
          toast({ title: "Imagen Subida", description: "La imagen se subió correctamente." });
          await saveImageMetadata(data.nombre, uploadedImageUrl, data.mode);
        } else {
          toast({
            title: "Error al Subir Imagen",
            description: uploadErrorMessage || `No se pudo subir la imagen al bucket '${HEADER_IMAGE_BUCKET_NAME}'. Verifica RLS y logs de Supabase.`,
            variant: "destructive",
            duration: 9000,
          });
          setIsSubmitting(false);
        }
      };
      reader.onerror = () => {
        toast({ title: "Error de Archivo", description: "Error al leer el archivo de imagen.", variant: "destructive" });
        setIsSubmitting(false);
      };
    } else {
      toast({ title: "Error de Formulario", description: "Debes seleccionar una imagen.", variant: "destructive" });
      setIsSubmitting(false);
    }
  };

  const saveImageMetadata = async (nombre: string, imageUrl: string, mode: 'light' | 'dark') => {
    const now = new Date().toISOString();
    try {
      const payload = {
        nombre,
        imageUrl,
        mode,
        createdAt: now,
        updatedAt: now,
      };
      const { data: insertedData, error: insertError } = await supabase
        .from('imagenes_header')
        .insert([payload])
        .select()
        .single();

      if (insertError) throw insertError;

      toast({
        title: "¡Imagen Guardada!",
        description: `La imagen de header "${insertedData?.nombre}" ha sido guardada.`,
      });
      fetchHeaderImages();
      resetFormAndPreview();
    } catch (error: any) {
      toast({
        title: "Error al Guardar Metadatos",
        description: `No se pudo guardar la información de la imagen: ${error.message || 'Error desconocido'}. Revisa logs y tabla 'imagenes_header'.`,
        variant: "destructive",
        duration: 10000,
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const handleDelete = (image: HeaderImageItem) => {
    setImageToDelete(image);
    setShowDeleteConfirmDialog(true);
  };

  const confirmDelete = async () => {
    if (!imageToDelete) return;
    setIsSubmitting(true);

    try {
      const { error: dbError } = await supabase
        .from('imagenes_header')
        .delete()
        .eq('id', imageToDelete.id);

      if (dbError) throw dbError;

      const urlParts = imageToDelete.imageUrl.split('/');
      const fileNameWithPotentialParams = urlParts.pop(); 
      const fileName = fileNameWithPotentialParams?.split('?')[0];

      if (fileName) {
        const { error: storageError } = await supabase.storage
          .from(HEADER_IMAGE_BUCKET_NAME)
          .remove([fileName]);
        
        if (storageError && storageError.message !== "The resource was not found") {
          console.warn("Error deleting from storage (but DB record deleted):", storageError);
          toast({ title: "Advertencia", description: `DB record deleted, but storage delete failed: ${storageError.message}. Manual cleanup in bucket '${HEADER_IMAGE_BUCKET_NAME}' may be needed.`, variant: "default", duration: 10000});
        }
      } else {
         toast({ title: "Advertencia", description: `DB record deleted, but couldn't determine filename to delete from storage.`, variant: "default", duration: 8000});
      }

      toast({ title: "Imagen Eliminada", description: `La imagen "${imageToDelete.nombre}" ha sido eliminada.` });
      fetchHeaderImages();
    } catch (error: any) {
      toast({ title: "Error al Eliminar Imagen", description: `No se pudo eliminar: ${error.message || 'Error desconocido'}. Revisa los logs.`, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
      setShowDeleteConfirmDialog(false);
      setImageToDelete(null);
    }
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


  return (
    <div className="container mx-auto px-4 py-8">
      <header className="flex flex-col sm:flex-row items-center justify-center text-center mb-8 gap-3 sm:gap-4">
        <ImageUp className="h-10 w-10 text-primary" />
        <h1 className="text-4xl font-bold tracking-tight text-primary uppercase">Gestor de Imágenes Header</h1>
      </header>
      <div className="mb-6 text-left">
        <Link href="/" passHref legacyBehavior>
          <Button variant="default" size="sm">
            <Home className="mr-2 h-4 w-4" />
            Volver al Inicio
          </Button>
        </Link>
      </div>

      <Card className="shadow-xl lg:max-w-2xl mx-auto mb-12" ref={editorFormCardRef}>
        <CardHeader>
          <CardTitle>Subir Nueva Imagen de Header</CardTitle>
          <CardDescription>
            Selecciona una imagen, asígnale un nombre y elige si es para modo claro u oscuro.
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
                    <FormLabel>Nombre de la Imagen</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="imageFile"
                render={() => (
                  <FormItem>
                    <FormLabel>Archivo de Imagen</FormLabel>
                    <FormControl>
                       <Input
                          type="file"
                          ref={fileInputRef}
                          accept="image/png, image/jpeg, image/webp, image/gif, image/svg+xml"
                          onChange={handleFileChange}
                          className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
                        />
                    </FormControl>
                    <FormDescription>Sube una imagen (máx 5MB). Formatos: JPG, PNG, WEBP, GIF, SVG.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              {previewImage && (
                <div className="mt-4">
                  <FormLabel>Vista Previa</FormLabel>
                  <div className="relative w-full max-w-xs h-32 rounded-md overflow-hidden border mt-1 bg-muted">
                     <Image src={previewImage} alt="Vista previa de la imagen a subir" layout="fill" objectFit="contain" data-ai-hint="header preview"/>
                  </div>
                </div>
              )}

              <FormField
                control={form.control}
                name="mode"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                    <div className="space-y-0.5">
                      <FormLabel>Modo de Tema</FormLabel>
                      <FormDescription>
                        Selecciona si esta imagen es para el modo {field.value === 'light' ? 'Claro' : 'Oscuro'}.
                      </FormDescription>
                    </div>
                    <FormControl>
                      <div className="flex items-center space-x-2">
                        <Sun className={`h-5 w-5 ${field.value === 'light' ? 'text-primary' : 'text-muted-foreground'}`} />
                        <Switch
                          checked={field.value === 'dark'}
                          onCheckedChange={(checked) => field.onChange(checked ? 'dark' : 'light')}
                          aria-label="Cambiar modo claro/oscuro"
                        />
                        <Moon className={`h-5 w-5 ${field.value === 'dark' ? 'text-primary' : 'text-muted-foreground'}`} />
                      </div>
                    </FormControl>
                  </FormItem>
                )}
              />
              <Button type="submit" variant="destructive" disabled={isSubmitting} className="w-full">
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                Subir y Guardar Imagen
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      <div>
        <h2 className="text-2xl font-semibold text-foreground mb-6 text-center uppercase">Imágenes de Header Guardadas</h2>
        {isLoadingImages && (
          <div className="flex justify-center items-center py-10">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="ml-2 text-muted-foreground">Cargando imágenes...</p>
          </div>
        )}
        {errorLoadingImages && (
           <Alert variant="destructive" className="max-w-2xl mx-auto">
             <ImageUp className="h-4 w-4" />
             <ShadcnAlertTitle>Error al Cargar Imágenes</ShadcnAlertTitle>
             <ShadcnAlertDescription>{errorLoadingImages}</ShadcnAlertDescription>
           </Alert>
        )}
        {!isLoadingImages && !errorLoadingImages && headerImages.length === 0 && (
          <div className="text-center py-10 border-2 border-dashed border-muted-foreground/30 rounded-lg max-w-md mx-auto">
            <ImageUp className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">No hay imágenes de header guardadas.</p>
            <p className="text-sm text-muted-foreground">Usa el formulario de arriba para subir tu primera imagen.</p>
          </div>
        )}
        {!isLoadingImages && !errorLoadingImages && headerImages.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {headerImages.map((image) => (
              <Card key={image.id} className="shadow-lg hover:shadow-xl transition-shadow flex flex-col">
                <CardHeader className="pb-3 pt-4 px-4">
                  <CardTitle className="text-lg font-semibold break-words truncate" title={image.nombre}>
                    {image.nombre}
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex-grow pb-3 pt-0 px-4 space-y-2">
                  <div className="relative w-full aspect-[16/9] rounded-md overflow-hidden border bg-muted">
                    <Image
                      src={image.imageUrl}
                      alt={`Imagen para ${image.nombre}`}
                      layout="fill"
                      objectFit="contain"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.src = 'https://placehold.co/300x150.png?text=Error';
                        target.srcset = '';
                      }}
                      data-ai-hint="header imagen guardada"
                    />
                  </div>
                  <div className="flex items-center justify-between text-sm">
                     <Badge variant={image.mode === 'light' ? 'outline' : 'default'} className={image.mode === 'dark' ? 'bg-slate-700 text-slate-100' : ''}>
                        {image.mode === 'light' ? <Sun className="mr-1.5 h-3.5 w-3.5" /> : <Moon className="mr-1.5 h-3.5 w-3.5" />}
                        Modo {image.mode === 'light' ? 'Claro' : 'Oscuro'}
                      </Badge>
                  </div>
                   <p className="text-xs text-muted-foreground/80">Subido: {formatDate(image.createdAt)}</p>
                </CardContent>
                <CardFooter className="pt-2 pb-3 px-4 flex justify-end border-t mt-auto">
                  <Button variant="destructive" size="sm" onClick={() => handleDelete(image)} disabled={isSubmitting} className="h-8 px-3 text-xs">
                    <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Eliminar
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </div>

      <AlertDialog open={showDeleteConfirmDialog} onOpenChange={setShowDeleteConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeaderComponent>
            <AlertDialogTitleComponent>¿Estás seguro de eliminar esta imagen?</AlertDialogTitleComponent>
            <AlertDialogDescriptionComponent>
              Esta acción no se puede deshacer. La imagen "{imageToDelete?.nombre || 'seleccionada'}" será eliminada permanentemente de la base de datos y del almacenamiento.
            </AlertDialogDescriptionComponent>
          </AlertDialogHeaderComponent>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setShowDeleteConfirmDialog(false); setImageToDelete(null); }} disabled={isSubmitting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={isSubmitting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4"/>}
              Eliminar Imagen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
