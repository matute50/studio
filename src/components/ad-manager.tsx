
"use client";

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import Image from 'next/image';
import Link from 'next/link';
import type { Advertisement, BannerItem } from '@/types';
import { addDays, parseISO } from 'date-fns';

import { supabase, uploadImageToSupabase } from '@/lib/supabaseClient'; 

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription as AlertDialogDescriptionComponent, AlertDialogFooter, AlertDialogHeader as AlertDialogHeaderComponent, AlertDialogTitle as AlertDialogTitleComponent } from "@/components/ui/alert-dialog";
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save, Trash2, Upload, ImageOff, Edit3, XCircle, Tag, CalendarClock, Home, Image as ImageIcon } from 'lucide-react';
import { Alert, AlertDescription as ShadcnAlertDescription, AlertTitle as ShadcnAlertTitle } from "@/components/ui/alert";
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

const AD_BUCKET_NAME = 'publicidad';
const BANNER_BUCKET_NAME = 'banner';

const adSchema = z.object({
  name: z.string().min(3, { message: "El nombre debe tener al menos 3 caracteres." }).max(100, { message: "El nombre debe tener 100 caracteres o menos." }),
  imageUrl: z.string()
    .refine(
      (value) => {
        if (value === "") return false; 
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

const bannerSchema = z.object({
  nombre: z.string().min(3, { message: "El nombre debe tener al menos 3 caracteres." }).max(100, { message: "El nombre debe tener 100 caracteres o menos." }),
  imageUrl: z.string()
    .refine(
      (value) => {
        if (value === "") return false;
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

type BannerFormValues = z.infer<typeof bannerSchema>;


export function AdManager() {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  
  // Ad states
  const adFileInputRef = React.useRef<HTMLInputElement>(null);
  const adEditorFormCardRef = React.useRef<HTMLDivElement>(null);
  const [ads, setAds] = React.useState<Advertisement[]>([]);
  const [isLoadingAds, setIsLoadingAds] = React.useState(true);
  const [errorLoadingAds, setErrorLoadingAds] = React.useState<string | null>(null);
  const [editingAdId, setEditingAdId] = React.useState<string | null>(null);
  const [showDeleteAdConfirmDialog, setShowDeleteAdConfirmDialog] = React.useState(false);
  const [adToDelete, setAdToDelete] = React.useState<Advertisement | null>(null);
  const [isTogglingAdActive, setIsTogglingAdActive] = React.useState(false);

  // Banner states
  const bannerFileInputRef = React.useRef<HTMLInputElement>(null);
  const bannerEditorFormCardRef = React.useRef<HTMLDivElement>(null);
  const [banners, setBanners] = React.useState<BannerItem[]>([]);
  const [isLoadingBanners, setIsLoadingBanners] = React.useState(true);
  const [errorLoadingBanners, setErrorLoadingBanners] = React.useState<string | null>(null);
  const [editingBannerId, setEditingBannerId] = React.useState<string | null>(null);
  const [showDeleteBannerConfirmDialog, setShowDeleteBannerConfirmDialog] = React.useState(false);
  const [bannerToDelete, setBannerToDelete] = React.useState<BannerItem | null>(null);
  const [isTogglingBannerActive, setIsTogglingBannerActive] = React.useState(false);


  const adForm = useForm<AdFormValues>({
    resolver: zodResolver(adSchema),
    defaultValues: {
      name: '',
      imageUrl: '',
    },
    mode: "onChange",
  });
  const watchedAdImageUrl = adForm.watch('imageUrl');

  const bannerForm = useForm<BannerFormValues>({
    resolver: zodResolver(bannerSchema),
    defaultValues: {
      nombre: '',
      imageUrl: '',
    },
    mode: "onChange",
  });
  const watchedBannerImageUrl = bannerForm.watch('imageUrl');


  const fetchAds = async () => {
    setIsLoadingAds(true);
    setErrorLoadingAds(null);
    try {
      const { data, error } = await supabase
        .from('anuncios')
        .select('*')
        .eq('isActive', true) 
        .order('createdAt', { ascending: false });

      if (error) throw error;
      setAds(data || []);
    } catch (error: any) {
      const description = `No se pudieron cargar los anuncios activos: ${error.message || 'Error desconocido'}.`;
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

  const fetchBanners = async () => {
    setIsLoadingBanners(true);
    setErrorLoadingBanners(null);
    try {
      const { data, error } = await supabase
        .from('banner')
        .select('*')
        .eq('isActive', true) 
        .order('createdAt', { ascending: false });

      if (error) throw error;
      setBanners(data || []);
    } catch (error: any) {
      const description = `No se pudieron cargar los banners activos: ${error.message || 'Error desconocido'}.`;
      setErrorLoadingBanners(description);
      toast({
        title: "Error al Cargar Banners",
        description,
        variant: "destructive",
      });
    } finally {
      setIsLoadingBanners(false);
    }
  };

  React.useEffect(() => {
    fetchAds();
    fetchBanners();
  }, []);

  const resetAdFormAndPreview = () => {
    adForm.reset({ name: '', imageUrl: '' });
    if (adFileInputRef.current) {
      adFileInputRef.current.value = ""; 
    }
    setEditingAdId(null);
  };
  
  const resetBannerFormAndPreview = () => {
    bannerForm.reset({ nombre: '', imageUrl: '' });
    if (bannerFileInputRef.current) {
      bannerFileInputRef.current.value = ""; 
    }
    setEditingBannerId(null);
  };


  const onAdSubmit = async (data: AdFormValues) => {
    setIsSubmitting(true);
    let finalImageUrl = data.imageUrl;
    const now = new Date().toISOString();
  
    if (data.imageUrl && data.imageUrl.startsWith('data:image/')) {
      toast({ title: "Subiendo imagen de anuncio...", description: "Por favor espera un momento." });
      const { url: uploadedUrl, errorMessage: uploadErrorMessage } = await uploadImageToSupabase(data.imageUrl, AD_BUCKET_NAME); 
      
      if (uploadedUrl) {
        finalImageUrl = uploadedUrl;
        adForm.setValue('imageUrl', uploadedUrl, { shouldValidate: true, shouldDirty: true });
        toast({
          title: "Imagen de Anuncio Subida",
          description: `La imagen se ha subido correctamente al bucket '${AD_BUCKET_NAME}'.`,
        });
      } else {
        toast({
          title: "Error al Subir Imagen de Anuncio",
          description: uploadErrorMessage || `No se pudo subir la imagen. Verifica RLS del bucket '${AD_BUCKET_NAME}' y logs de Supabase.`,
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
          isActive: true, 
        };
        const { data: insertedData, error: insertError } = await supabase
          .from('anuncios')
          .insert([payloadToInsert])
          .select()
          .single();
        if (insertError) throw insertError;
        toast({ 
          title: "¡Anuncio Guardado!", 
          description: `El anuncio "${insertedData?.name}" ha sido guardado y está activo.` 
        });
      }
      fetchAds();
      resetAdFormAndPreview();
    } catch (error: any) {
      toast({
        title: "Error al Guardar Anuncio",
        description: `No se pudo guardar: ${error.message || 'Error desconocido'}. Revisa los logs.`,
        variant: "destructive",
        duration: 10000,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const onBannerSubmit = async (data: BannerFormValues) => {
    setIsSubmitting(true);
    let finalImageUrl = data.imageUrl;
    const now = new Date().toISOString();
  
    if (data.imageUrl && data.imageUrl.startsWith('data:image/')) {
      toast({ title: "Subiendo imagen de banner...", description: "Por favor espera un momento." });
      const { url: uploadedUrl, errorMessage: uploadErrorMessage } = await uploadImageToSupabase(data.imageUrl, BANNER_BUCKET_NAME); 
      
      if (uploadedUrl) {
        finalImageUrl = uploadedUrl;
        bannerForm.setValue('imageUrl', uploadedUrl, { shouldValidate: true, shouldDirty: true });
        toast({
          title: "Imagen de Banner Subida",
          description: `La imagen se ha subido correctamente al bucket '${BANNER_BUCKET_NAME}'.`,
        });
      } else {
        toast({
          title: "Error al Subir Imagen de Banner",
          description: uploadErrorMessage || `No se pudo subir la imagen. Verifica RLS del bucket '${BANNER_BUCKET_NAME}' y logs de Supabase.`,
          variant: "destructive",
          duration: 15000, 
        });
         if (!finalImageUrl.startsWith('http')) { 
            setIsSubmitting(false);
            return;
        }
      }
    }

    try {
      if (editingBannerId) {
        const bannerPayload = {
          nombre: data.nombre,
          imageUrl: finalImageUrl,
          updatedAt: now,
        };
        const { data: updatedData, error: updateError } = await supabase
          .from('banner')
          .update(bannerPayload)
          .eq('id', editingBannerId)
          .select()
          .single();
        if (updateError) throw updateError;
        toast({ title: "¡Banner Actualizado!", description: `El banner "${updatedData?.nombre}" ha sido actualizado.` });
      } else {
        if (!finalImageUrl || !finalImageUrl.startsWith('http')) {
            setIsSubmitting(false);
            toast({
                title: "Subida de Imagen Fallida",
                description: "No se pudo obtener una URL válida para la imagen del banner. El banner no fue guardado.",
                variant: "destructive",
            });
            return;
        }
        const payloadToInsert = { 
          nombre: data.nombre,
          imageUrl: finalImageUrl,
          createdAt: now,
          updatedAt: now,
          isActive: true, 
        };
        const { data: insertedData, error: insertError } = await supabase
          .from('banner')
          .insert([payloadToInsert])
          .select()
          .single();
        if (insertError) throw insertError;
        toast({ 
          title: "¡Banner Guardado!", 
          description: `El banner "${insertedData?.nombre}" ha sido guardado y está activo.` 
        });
      }
      fetchBanners();
      resetBannerFormAndPreview();
    } catch (error: any) {
      toast({
        title: "Error al Guardar Banner",
        description: `No se pudo guardar: ${error.message || 'Error desconocido'}. Revisa los logs.`,
        variant: "destructive",
        duration: 10000,
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const handleAdFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (!file.type.startsWith("image/")) {
        toast({ title: "Tipo de archivo no válido", description: "Por favor, sube un archivo de imagen.", variant: "destructive" });
        return;
      }
      if (file.size > 5 * 1024 * 1024) { 
         toast({ title: "Archivo demasiado grande", description: "Sube una imagen de menos de 5MB.", variant: "destructive" });
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        adForm.setValue('imageUrl', reader.result as string, { shouldValidate: true });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleBannerFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (!file.type.startsWith("image/")) {
        toast({ title: "Tipo de archivo no válido", description: "Por favor, sube un archivo de imagen.", variant: "destructive" });
        return;
      }
      if (file.size > 5 * 1024 * 1024) { 
         toast({ title: "Archivo demasiado grande", description: "Sube una imagen de menos de 5MB.", variant: "destructive" });
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        bannerForm.setValue('imageUrl', reader.result as string, { shouldValidate: true });
      };
      reader.readAsDataURL(file);
    }
  };
  
  const formatDate = (dateString?: string | null) => {
    if (!dateString) return 'Fecha desconocida';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return 'Fecha inválida';
      }
      return date.toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch (e: any) {
      return 'Error al formatear fecha';
    }
  };

  const calculateAndFormatExpiryDate = (createdAt?: string | null) => {
    if (!createdAt) return 'Fecha desconocida';
    try {
      const createdDate = parseISO(createdAt);
      if (isNaN(createdDate.getTime())) {
        return 'Fecha de creación inválida';
      }
      const expiryDate = addDays(createdDate, 30);
      return expiryDate.toLocaleDateString('es-ES', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch (e: any) {
      return 'Error al calcular vencimiento';
    }
  };

  const handleEditAd = (adToEdit: Advertisement) => {
    if (!adToEdit.id) return;
    setEditingAdId(adToEdit.id);
    adForm.reset({
      name: adToEdit.name,
      imageUrl: adToEdit.imageUrl,
    });
    if (adFileInputRef.current) adFileInputRef.current.value = "";
    adEditorFormCardRef.current?.scrollIntoView({ behavior: 'smooth' });
    toast({ title: "Modo Edición Anuncio", description: `Editando anuncio: ${adToEdit.name}` });
  };

  const cancelEditAd = () => {
    resetAdFormAndPreview();
    toast({ title: "Edición de Anuncio Cancelada" });
  };

  const handleDeleteAd = (ad: Advertisement) => {
    if (!ad.id) return;
    setAdToDelete(ad);
    setShowDeleteAdConfirmDialog(true);
  };

  const confirmDeleteAd = async () => {
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
        cancelEditAd();
      }
    } catch (error: any) {
      toast({ title: "Error al Eliminar Anuncio", description: `No se pudo eliminar: ${error.message || 'Error desconocido'}.`, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
      setShowDeleteAdConfirmDialog(false);
      setAdToDelete(null);
    }
  };

  const handleAdActiveToggle = async (adId: string, newActiveState: boolean) => {
    setIsTogglingAdActive(true);
    try {
      const now = new Date().toISOString();
      const { error } = await supabase
        .from('anuncios')
        .update({ isActive: newActiveState, updatedAt: now })
        .eq('id', adId);

      if (error) throw error;

      toast({ title: "Estado de Anuncio Actualizado", description: `El anuncio ha sido ${newActiveState ? 'activado' : 'desactivado'}. Si fue desactivado, ya no se mostrará en la lista.` });
      fetchAds(); 
    } catch (error: any) {
      toast({ title: "Error al Actualizar Estado de Anuncio", description: `No se pudo actualizar: ${error.message || 'Error desconocido'}.`, variant: "destructive" });
    } finally {
      setIsTogglingAdActive(false);
    }
  };

  const handleEditBanner = (bannerToEdit: BannerItem) => {
    if (!bannerToEdit.id) return;
    setEditingBannerId(bannerToEdit.id);
    bannerForm.reset({
      nombre: bannerToEdit.nombre,
      imageUrl: bannerToEdit.imageUrl,
    });
    if (bannerFileInputRef.current) bannerFileInputRef.current.value = "";
    bannerEditorFormCardRef.current?.scrollIntoView({ behavior: 'smooth' });
    toast({ title: "Modo Edición Banner", description: `Editando banner: ${bannerToEdit.nombre}` });
  };

  const cancelEditBanner = () => {
    resetBannerFormAndPreview();
    toast({ title: "Edición de Banner Cancelada" });
  };

  const handleDeleteBanner = (banner: BannerItem) => {
    if (!banner.id) return;
    setBannerToDelete(banner);
    setShowDeleteBannerConfirmDialog(true);
  };

  const confirmDeleteBanner = async () => {
    if (!bannerToDelete || !bannerToDelete.id) return;
    setIsSubmitting(true);
    try {
      const { error: deleteError } = await supabase
        .from('banner')
        .delete()
        .eq('id', bannerToDelete.id);
      if (deleteError) throw deleteError;
      toast({ title: "Banner Eliminado", description: `El banner "${bannerToDelete.nombre}" ha sido eliminado.` });
      fetchBanners();
      if (editingBannerId === bannerToDelete.id) {
        cancelEditBanner();
      }
    } catch (error: any) {
      toast({ title: "Error al Eliminar Banner", description: `No se pudo eliminar: ${error.message || 'Error desconocido'}.`, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
      setShowDeleteBannerConfirmDialog(false);
      setBannerToDelete(null);
    }
  };

  const handleBannerActiveToggle = async (bannerId: string, newActiveState: boolean) => {
    setIsTogglingBannerActive(true);
    try {
      const now = new Date().toISOString();
      const { error } = await supabase
        .from('banner')
        .update({ isActive: newActiveState, updatedAt: now })
        .eq('id', bannerId);

      if (error) throw error;

      toast({ title: "Estado de Banner Actualizado", description: `El banner ha sido ${newActiveState ? 'activado' : 'desactivado'}. Si fue desactivado, ya no se mostrará en la lista.` });
      fetchBanners(); 
    } catch (error: any) {
      toast({ title: "Error al Actualizar Estado de Banner", description: `No se pudo actualizar: ${error.message || 'Error desconocido'}.`, variant: "destructive" });
    } finally {
      setIsTogglingBannerActive(false);
    }
  };


  return (
    <div className="container mx-auto px-4 py-8">
      <header className="flex flex-col sm:flex-row items-center justify-center text-center mb-8 gap-3 sm:gap-4">
        <h1 className="text-4xl font-bold tracking-tight text-primary uppercase">Gestor de Publicidad y Banners</h1>
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
        {/* Columna de Anuncios: Formulario y Lista */}
        <div className="space-y-8">
          <Card className="shadow-xl" ref={adEditorFormCardRef}>
            <CardHeader>
              <CardTitle>{editingAdId ? "Editar Anuncio" : "Crear Nuevo Anuncio"}</CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...adForm}>
                <form onSubmit={adForm.handleSubmit(onAdSubmit)} className="space-y-6">
                  <FormField
                    control={adForm.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nombre del Anuncio</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={adForm.control}
                    name="imageUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Imagen del Anuncio</FormLabel>
                        <div className="flex flex-col sm:flex-row gap-2 items-start">
                          <FormControl className="flex-grow">
                            <Input 
                              {...field}
                            />
                          </FormControl>
                          <Button type="button" variant="default" onClick={() => adFileInputRef.current?.click()} className="w-full sm:w-auto">
                            <Upload className="mr-2 h-4 w-4" />
                            Subir Imagen
                          </Button>
                          <input
                            type="file"
                            ref={adFileInputRef}
                            className="hidden"
                            accept="image/*"
                            onChange={handleAdFileChange}
                          />
                        </div>
                         <FormDescription>
                          Introduce una URL o sube una imagen (máx 5MB). Los nuevos anuncios se activan por defecto.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  {watchedAdImageUrl && (watchedAdImageUrl.startsWith('http') || watchedAdImageUrl.startsWith('data:image')) && (
                    <div className="relative w-full max-w-xs h-48 rounded-md overflow-hidden border">
                       <Image src={watchedAdImageUrl} alt="Vista previa de la imagen del anuncio" layout="fill" objectFit="contain" data-ai-hint="anuncio preview"/>
                    </div>
                  )}
                  <div className="flex flex-col sm:flex-row gap-2 pt-2">
                      <Button type="submit" variant="destructive" disabled={isSubmitting || isTogglingAdActive || isTogglingBannerActive} className="w-full sm:flex-1">
                      {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                      {editingAdId ? "Actualizar Anuncio" : "Guardar Anuncio"}
                      </Button>
                      {editingAdId && (
                      <Button type="button" variant="outline" onClick={cancelEditAd} className="w-full sm:w-auto" disabled={isSubmitting || isTogglingAdActive || isTogglingBannerActive}>
                          <XCircle className="mr-2 h-4 w-4" />
                          Cancelar Edición
                      </Button>
                      )}
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>

          {/* Anuncios Activos */}
          <div className="space-y-4 max-h-[40vh] overflow-y-auto pr-2">
            <h2 className="text-2xl font-semibold text-foreground mb-4 uppercase">Anuncios Activos</h2>
            {isLoadingAds && (
              <div className="flex justify-center items-center py-10">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="ml-2 text-muted-foreground">Cargando anuncios activos...</p>
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
                <p className="text-muted-foreground">No hay anuncios activos.</p>
                <p className="text-sm text-muted-foreground">Usa el formulario para añadir un anuncio. Los nuevos se activan por defecto.</p>
              </div>
            )}
            {!isLoadingAds && !errorLoadingAds && ads.map((ad, index) => (
              <Card key={ad.id} className="shadow-md hover:shadow-lg transition-shadow">
                <CardHeader className="pb-2 pt-3 px-3 flex flex-row justify-between items-start">
                  <CardTitle className="text-md font-semibold break-words flex-grow">
                     <span className="text-primary mr-2">{index + 1}.</span>
                    {ad.name}
                  </CardTitle>
                  <div className="flex flex-col items-end space-y-1 flex-shrink-0 ml-2">
                    {ad.isActive && (
                      <Badge className="whitespace-nowrap bg-green-600 text-primary-foreground text-xs px-1.5 py-0.5">Activo</Badge>
                    )}
                    <div className="flex items-center space-x-1">
                      <Label htmlFor={`ad-active-switch-${ad.id}`} className="text-xs text-muted-foreground">
                        Activo
                      </Label>
                      <Switch
                        id={`ad-active-switch-${ad.id}`}
                        checked={!!ad.isActive}
                        onCheckedChange={(isChecked) => {
                          if (ad.id) {
                            handleAdActiveToggle(ad.id, isChecked);
                          }
                        }}
                        disabled={isTogglingAdActive || isSubmitting || isTogglingBannerActive}
                        className="data-[state=checked]:bg-green-600 data-[state=unchecked]:bg-input h-5 w-9 [&>span]:h-4 [&>span]:w-4 [&>span]:data-[state=checked]:translate-x-4"
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
                          console.warn(`Error cargando imagen para anuncio "${ad.name}" desde URL: ${ad.imageUrl}. Verifique la URL y la accesibilidad del bucket '${AD_BUCKET_NAME}'.`);
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
                  <Button variant="outline" size="sm" onClick={() => handleEditAd(ad)} disabled={isSubmitting || isTogglingAdActive || isTogglingBannerActive} className="h-7 px-2.5 text-xs">
                    <Edit3 className="mr-1 h-3 w-3" /> Editar
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => handleDeleteAd(ad)} disabled={isSubmitting || isTogglingAdActive || isTogglingBannerActive} className="h-7 px-2.5 text-xs">
                    <Trash2 className="mr-1 h-3 w-3" /> Eliminar
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        </div>

        {/* Columna de Banners: Formulario y Lista */}
        <div className="space-y-8">
          <Card className="shadow-xl" ref={bannerEditorFormCardRef}>
            <CardHeader>
              <CardTitle>{editingBannerId ? "Editar Banner" : "Crear Nuevo Banner"}</CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...bannerForm}>
                <form onSubmit={bannerForm.handleSubmit(onBannerSubmit)} className="space-y-6">
                  <FormField
                    control={bannerForm.control}
                    name="nombre"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nombre del Banner</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={bannerForm.control}
                    name="imageUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Imagen del Banner</FormLabel>
                        <div className="flex flex-col sm:flex-row gap-2 items-start">
                          <FormControl className="flex-grow">
                            <Input 
                              {...field}
                            />
                          </FormControl>
                          <Button type="button" variant="default" onClick={() => bannerFileInputRef.current?.click()} className="w-full sm:w-auto">
                            <Upload className="mr-2 h-4 w-4" />
                            Subir Imagen
                          </Button>
                          <input
                            type="file"
                            ref={bannerFileInputRef}
                            className="hidden"
                            accept="image/*"
                            onChange={handleBannerFileChange}
                          />
                        </div>
                         <FormDescription>
                          Introduce una URL o sube una imagen (máx 5MB). Los nuevos banners se activan por defecto.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  {watchedBannerImageUrl && (watchedBannerImageUrl.startsWith('http') || watchedBannerImageUrl.startsWith('data:image')) && (
                    <div className="relative w-full max-w-xs h-48 rounded-md overflow-hidden border">
                       <Image src={watchedBannerImageUrl} alt="Vista previa de la imagen del banner" layout="fill" objectFit="contain" data-ai-hint="banner preview"/>
                    </div>
                  )}
                  <div className="flex flex-col sm:flex-row gap-2 pt-2">
                      <Button type="submit" variant="destructive" disabled={isSubmitting || isTogglingBannerActive || isTogglingAdActive} className="w-full sm:flex-1">
                      {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                      {editingBannerId ? "Actualizar Banner" : "Guardar Banner"}
                      </Button>
                      {editingBannerId && (
                      <Button type="button" variant="outline" onClick={cancelEditBanner} className="w-full sm:w-auto" disabled={isSubmitting || isTogglingBannerActive || isTogglingAdActive}>
                          <XCircle className="mr-2 h-4 w-4" />
                          Cancelar Edición
                      </Button>
                      )}
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
          
          {/* Banners Activos */}
          <div className="space-y-4 max-h-[40vh] overflow-y-auto pr-2">
            <h2 className="text-2xl font-semibold text-foreground mb-4 uppercase">Banners Activos</h2>
            {isLoadingBanners && (
              <div className="flex justify-center items-center py-10">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="ml-2 text-muted-foreground">Cargando banners activos...</p>
              </div>
            )}
            {errorLoadingBanners && (
               <Alert variant="destructive">
                 <ImageIcon className="h-4 w-4" />
                 <ShadcnAlertTitle>Error al Cargar Banners</ShadcnAlertTitle>
                 <ShadcnAlertDescription>{errorLoadingBanners}</ShadcnAlertDescription>
               </Alert>
            )}
            {!isLoadingBanners && !errorLoadingBanners && banners.length === 0 && (
              <div className="text-center py-10 border-2 border-dashed border-muted-foreground/30 rounded-lg">
                <ImageIcon className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
                <p className="text-muted-foreground">No hay banners activos.</p>
                <p className="text-sm text-muted-foreground">Usa el formulario para añadir un banner. Los nuevos se activan por defecto.</p>
              </div>
            )}
            {!isLoadingBanners && !errorLoadingBanners && banners.map((banner, index) => (
              <Card key={banner.id} className="shadow-md hover:shadow-lg transition-shadow">
                <CardHeader className="pb-2 pt-3 px-3 flex flex-row justify-between items-start">
                  <CardTitle className="text-md font-semibold break-words flex-grow">
                    <span className="text-primary mr-2">{index + 1}.</span>
                    {banner.nombre}
                  </CardTitle>
                  <div className="flex flex-col items-end space-y-1 flex-shrink-0 ml-2">
                    {banner.isActive && (
                      <Badge className="whitespace-nowrap bg-green-600 text-primary-foreground text-xs px-1.5 py-0.5">Activo</Badge>
                    )}
                    <div className="flex items-center space-x-1">
                      <Label htmlFor={`banner-active-switch-${banner.id}`} className="text-xs text-muted-foreground">
                        Activo
                      </Label>
                      <Switch
                        id={`banner-active-switch-${banner.id}`}
                        checked={!!banner.isActive}
                        onCheckedChange={(isChecked) => {
                          if (banner.id) {
                            handleBannerActiveToggle(banner.id, isChecked);
                          }
                        }}
                        disabled={isTogglingBannerActive || isSubmitting || isTogglingAdActive}
                        className="data-[state=checked]:bg-green-600 data-[state=unchecked]:bg-input h-5 w-9 [&>span]:h-4 [&>span]:w-4 [&>span]:data-[state=checked]:translate-x-4"
                        aria-label={`Marcar banner ${banner.nombre} como activo`}
                      />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pb-2 pt-0 px-3">
                  <div className="relative w-full aspect-[16/9] max-h-32 rounded-md overflow-hidden border bg-muted mb-1.5">
                    {(banner.imageUrl && (banner.imageUrl.startsWith('http') || banner.imageUrl.startsWith('data:image'))) ? (
                      <Image
                        src={banner.imageUrl}
                        alt={`Imagen para ${banner.nombre}`}
                        layout="fill"
                        objectFit="contain"
                        onError={(e) => {
                          console.warn(`Error cargando imagen para banner "${banner.nombre}" desde URL: ${banner.imageUrl}. Verifique la URL y la accesibilidad del bucket '${BANNER_BUCKET_NAME}'.`);
                          const target = e.target as HTMLImageElement;
                          target.src = 'https://placehold.co/300x150.png'; 
                          target.srcset = '';
                        }}
                        data-ai-hint="banner imagen"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-muted">
                         <ImageOff className="w-6 h-6 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                   <p className="text-xs text-muted-foreground/80">Creado: {formatDate(banner.createdAt)}</p>
                   {banner.updatedAt && banner.createdAt !== banner.updatedAt && (
                      <p className="text-xs text-muted-foreground/70">Actualizado: {formatDate(banner.updatedAt)}</p>
                   )}
                   <p className="text-xs text-orange-600 dark:text-orange-400 flex items-center">
                     <CalendarClock className="mr-1 h-3 w-3" />
                     Vencimiento: {calculateAndFormatExpiryDate(banner.createdAt)}
                   </p>
                </CardContent>
                <CardFooter className="text-xs text-muted-foreground pt-0 pb-2 px-3 flex justify-end gap-1.5">
                  <Button variant="outline" size="sm" onClick={() => handleEditBanner(banner)} disabled={isSubmitting || isTogglingBannerActive || isTogglingAdActive} className="h-7 px-2.5 text-xs">
                    <Edit3 className="mr-1 h-3 w-3" /> Editar
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => handleDeleteBanner(banner)} disabled={isSubmitting || isTogglingBannerActive || isTogglingAdActive} className="h-7 px-2.5 text-xs">
                    <Trash2 className="mr-1 h-3 w-3" /> Eliminar
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        </div>
      </div>

      <AlertDialog open={showDeleteAdConfirmDialog} onOpenChange={setShowDeleteAdConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeaderComponent>
            <AlertDialogTitleComponent>¿Estás seguro de eliminar este anuncio?</AlertDialogTitleComponent>
            <AlertDialogDescriptionComponent>
              Esta acción no se puede deshacer. El anuncio "{adToDelete?.name || 'seleccionado'}" será eliminado permanentemente.
            </AlertDialogDescriptionComponent>
          </AlertDialogHeaderComponent>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setShowDeleteAdConfirmDialog(false); setAdToDelete(null); }}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteAd} disabled={isSubmitting || isTogglingAdActive || isTogglingBannerActive} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Eliminar Anuncio
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showDeleteBannerConfirmDialog} onOpenChange={setShowDeleteBannerConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeaderComponent>
            <AlertDialogTitleComponent>¿Estás seguro de eliminar este banner?</AlertDialogTitleComponent>
            <AlertDialogDescriptionComponent>
              Esta acción no se puede deshacer. El banner "{bannerToDelete?.nombre || 'seleccionado'}" será eliminado permanentemente.
            </AlertDialogDescriptionComponent>
          </AlertDialogHeaderComponent>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setShowDeleteBannerConfirmDialog(false); setBannerToDelete(null); }}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteBanner} disabled={isSubmitting || isTogglingBannerActive || isTogglingAdActive} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Eliminar Banner
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
