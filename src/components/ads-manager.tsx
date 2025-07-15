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

// Componentes UI optimizados
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save, Trash2, Upload, ImageOff, Edit3, XCircle, Tag, CalendarClock, Home, Image as ImageIcon } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from "@/components/ui/alert-dialog";

// Configuración de buckets
const AD_BUCKET_NAME = 'publicidad';
const BANNER_BUCKET_NAME = 'banner';

// Esquemas de validación
const adSchema = z.object({
  name: z.string().min(3, { message: "El nombre debe tener al menos 3 caracteres." }).max(100),
  imageUrl: z.string().refine(
    (value) => {
      if (!value) return false;
      if (value.startsWith("https://placehold.co/")) return true;
      if (value.startsWith("data:image/")) {
        return /^data:image\/(?:gif|png|jpeg|bmp|webp|svg\+xml)(?:;charset=utf-8)?;base64,(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value);
      }
      try {
        new URL(value);
        return true;
      } catch {
        return false;
      }
    },
    { message: "URL inválida o imagen no válida" }
  )
});

const bannerSchema = z.object({
  nombre: z.string().min(3, { message: "El nombre debe tener al menos 3 caracteres." }).max(100),
  imageUrl: z.string().refine(
    (value) => {
      if (!value) return false;
      if (value.startsWith("https://placehold.co/")) return true;
      if (value.startsWith("data:image/")) {
        return /^data:image\/(?:gif|png|jpeg|bmp|webp|svg\+xml)(?:;charset=utf-8)?;base64,(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value);
      }
      try {
        new URL(value);
        return true;
      } catch {
        return false;
      }
    },
    { message: "URL inválida o imagen no válida" }
  )
});

type AdFormValues = z.infer<typeof adSchema>;
type BannerFormValues = z.infer<typeof bannerSchema>;

export function PublicidadManager() {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  
  // Refs
  const adFileInputRef = React.useRef<HTMLInputElement>(null);
  const bannerFileInputRef = React.useRef<HTMLInputElement>(null);
  const adEditorFormCardRef = React.useRef<HTMLDivElement>(null);
  const bannerEditorFormCardRef = React.useRef<HTMLDivElement>(null);

  // Estados para anuncios
  const [ads, setAds] = React.useState<Advertisement[]>([]);
  const [isLoadingAds, setIsLoadingAds] = React.useState(true);
  const [errorLoadingAds, setErrorLoadingAds] = React.useState<string | null>(null);
  const [editingAdId, setEditingAdId] = React.useState<string | null>(null);
  const [adToDelete, setAdToDelete] = React.useState<Advertisement | null>(null);
  const [isTogglingAdActive, setIsTogglingAdActive] = React.useState(false);

  // Estados para banners
  const [banners, setBanners] = React.useState<BannerItem[]>([]);
  const [isLoadingBanners, setIsLoadingBanners] = React.useState(true);
  const [errorLoadingBanners, setErrorLoadingBanners] = React.useState<string | null>(null);
  const [editingBannerId, setEditingBannerId] = React.useState<string | null>(null);
  const [bannerToDelete, setBannerToDelete] = React.useState<BannerItem | null>(null);
  const [isTogglingBannerActive, setIsTogglingBannerActive] = React.useState(false);

  // Formularios
  const adForm = useForm<AdFormValues>({
    resolver: zodResolver(adSchema),
    defaultValues: { name: '', imageUrl: '' },
    mode: "onChange"
  });

  const bannerForm = useForm<BannerFormValues>({
    resolver: zodResolver(bannerSchema),
    defaultValues: { nombre: '', imageUrl: '' },
    mode: "onChange"
  });

  const watchedAdImageUrl = adForm.watch('imageUrl');
  const watchedBannerImageUrl = bannerForm.watch('imageUrl');

  // Funciones de fetch
  const fetchAds = async () => {
    setIsLoadingAds(true);
    try {
      const { data, error } = await supabase
        .from('anuncios')
        .select('*')
        .order('createdAt', { ascending: false });

      if (error) throw error;
      setAds(data || []);
    } catch (error: any) {
      setErrorLoadingAds(`Error al cargar anuncios: ${error.message}`);
      toast({
        title: "Error",
        description: `No se pudieron cargar los anuncios: ${error.message}`,
        variant: "destructive"
      });
    } finally {
      setIsLoadingAds(false);
    }
  };

  const fetchBanners = async () => {
    setIsLoadingBanners(true);
    try {
      const { data, error } = await supabase
        .from('banner')
        .select('*')
        .order('createdAt', { ascending: false });

      if (error) throw error;
      setBanners(data || []);
    } catch (error: any) {
      setErrorLoadingBanners(`Error al cargar banners: ${error.message}`);
      toast({
        title: "Error",
        description: `No se pudieron cargar los banners: ${error.message}`,
        variant: "destructive"
      });
    } finally {
      setIsLoadingBanners(false);
    }
  };

  React.useEffect(() => {
    fetchAds();
    fetchBanners();
  }, []);

  // Funciones de reset
  const resetAdForm = () => {
    adForm.reset({ name: '', imageUrl: '' });
    if (adFileInputRef.current) adFileInputRef.current.value = "";
    setEditingAdId(null);
  };

  const resetBannerForm = () => {
    bannerForm.reset({ nombre: '', imageUrl: '' });
    if (bannerFileInputRef.current) bannerFileInputRef.current.value = "";
    setEditingBannerId(null);
  };

  // Handlers de submit
  const handleAdSubmit = async (data: AdFormValues) => {
    setIsSubmitting(true);
    try {
      let imageUrl = data.imageUrl;
      
      if (imageUrl.startsWith('data:image/')) {
        const { url, errorMessage } = await uploadImageToSupabase(imageUrl, AD_BUCKET_NAME);
        if (!url) throw new Error(errorMessage || "Error al subir imagen");
        imageUrl = url;
      }

      const now = new Date().toISOString();
      const payload = {
        name: data.name,
        imageUrl,
        updatedAt: now,
        ...(!editingAdId && { createdAt: now, isActive: true })
      };

      if (editingAdId) {
        const { error } = await supabase
          .from('anuncios')
          .update(payload)
          .eq('id', editingAdId);
        if (error) throw error;
        toast({ title: "Anuncio actualizado", description: `"${data.name}" se actualizó correctamente` });
      } else {
        const { error } = await supabase
          .from('anuncios')
          .insert([payload]);
        if (error) throw error;
        toast({ title: "Anuncio creado", description: `"${data.name}" se creó correctamente` });
      }

      fetchAds();
      resetAdForm();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Ocurrió un error al guardar",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBannerSubmit = async (data: BannerFormValues) => {
    setIsSubmitting(true);
    try {
      let imageUrl = data.imageUrl;
      
      if (imageUrl.startsWith('data:image/')) {
        const { url, errorMessage } = await uploadImageToSupabase(imageUrl, BANNER_BUCKET_NAME);
        if (!url) throw new Error(errorMessage || "Error al subir imagen");
        imageUrl = url;
      }

      const now = new Date().toISOString();
      const payload = {
        nombre: data.nombre,
        imageUrl,
        updatedAt: now,
        ...(!editingBannerId && { createdAt: now, isActive: true })
      };

      if (editingBannerId) {
        const { error } = await supabase
          .from('banner')
          .update(payload)
          .eq('id', editingBannerId);
        if (error) throw error;
        toast({ title: "Banner actualizado", description: `"${data.nombre}" se actualizó correctamente` });
      } else {
        const { error } = await supabase
          .from('banner')
          .insert([payload]);
        if (error) throw error;
        toast({ title: "Banner creado", description: `"${data.nombre}" se creó correctamente` });
      }

      fetchBanners();
      resetBannerForm();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Ocurrió un error al guardar",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handlers de archivos
  const handleAdFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast({ title: "Archivo no válido", description: "Solo se permiten imágenes", variant: "destructive" });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Archivo muy grande", description: "El tamaño máximo es 5MB", variant: "destructive" });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      adForm.setValue('imageUrl', reader.result as string, { shouldValidate: true });
    };
    reader.readAsDataURL(file);
  };

  const handleBannerFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast({ title: "Archivo no válido", description: "Solo se permiten imágenes", variant: "destructive" });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Archivo muy grande", description: "El tamaño máximo es 5MB", variant: "destructive" });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      bannerForm.setValue('imageUrl', reader.result as string, { shouldValidate: true });
    };
    reader.readAsDataURL(file);
  };

  // Helpers de fecha
  const formatDate = (dateString?: string | null) => {
    if (!dateString) return 'Fecha desconocida';
    try {
      return new Date(dateString).toLocaleDateString('es-ES', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return 'Fecha inválida';
    }
  };

  const calculateExpiryDate = (dateString?: string | null) => {
    if (!dateString) return 'Fecha desconocida';
    try {
      const date = parseISO(dateString);
      return addDays(date, 30).toLocaleDateString('es-ES', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch {
      return 'Fecha inválida';
    }
  };

  // Handlers de edición
  const handleEditAd = (ad: Advertisement) => {
    if (!ad.id) return;
    setEditingAdId(ad.id);
    adForm.reset({
      name: ad.name,
      imageUrl: ad.imageUrl
    });
    adEditorFormCardRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleEditBanner = (banner: BannerItem) => {
    if (!banner.id) return;
    setEditingBannerId(banner.id);
    bannerForm.reset({
      nombre: banner.nombre,
      imageUrl: banner.imageUrl
    });
    bannerEditorFormCardRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Handlers de eliminación
  const handleDeleteAd = (ad: Advertisement) => {
    setAdToDelete(ad);
  };

  const handleDeleteBanner = (banner: BannerItem) => {
    setBannerToDelete(banner);
  };

  const confirmDeleteAd = async () => {
    if (!adToDelete?.id) return;
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('anuncios')
        .delete()
        .eq('id', adToDelete.id);
      
      if (error) throw error;
      
      toast({ title: "Eliminado", description: `Anuncio "${adToDelete.name}" eliminado` });
      fetchAds();
      if (editingAdId === adToDelete.id) resetAdForm();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Error al eliminar",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
      setAdToDelete(null);
    }
  };

  const confirmDeleteBanner = async () => {
    if (!bannerToDelete?.id) return;
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('banner')
        .delete()
        .eq('id', bannerToDelete.id);
      
      if (error) throw error;
      
      toast({ title: "Eliminado", description: `Banner "${bannerToDelete.nombre}" eliminado` });
      fetchBanners();
      if (editingBannerId === bannerToDelete.id) resetBannerForm();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Error al eliminar",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
      setBannerToDelete(null);
    }
  };

  // Handlers de toggle
  const toggleAdActive = async (adId: string, isActive: boolean) => {
    setIsTogglingAdActive(true);
    try {
      const { error } = await supabase
        .from('anuncios')
        .update({ isActive, updatedAt: new Date().toISOString() })
        .eq('id', adId);
      
      if (error) throw error;
      
      toast({ title: "Actualizado", description: `Anuncio ${isActive ? 'activado' : 'desactivado'}` });
      fetchAds();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Error al actualizar",
        variant: "destructive"
      });
    } finally {
      setIsTogglingAdActive(false);
    }
  };

  const toggleBannerActive = async (bannerId: string, isActive: boolean) => {
    setIsTogglingBannerActive(true);
    try {
      const { error } = await supabase
        .from('banner')
        .update({ isActive, updatedAt: new Date().toISOString() })
        .eq('id', bannerId);
      
      if (error) throw error;
      
      toast({ title: "Actualizado", description: `Banner ${isActive ? 'activado' : 'desactivado'}` });
      fetchBanners();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Error al actualizar",
        variant: "destructive"
      });
    } finally {
      setIsTogglingBannerActive(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <header className="mb-8 text-center">
        <h1 className="text-4xl font-bold tracking-tight text-primary uppercase">
          Gestor de Publicidad y Banners
        </h1>
      </header>

      <div className="mb-6">
        <Link href="/" passHref legacyBehavior>
          <Button variant="default" size="sm">
            <Home className="mr-2 h-4 w-4" />
            Volver al Inicio
          </Button>
        </Link>
      </div>

      <div className="grid lg:grid-cols-2 gap-8 items-start">
        {/* Sección de Anuncios */}
        <div className="space-y-8">
          <Card ref={adEditorFormCardRef}>
            <CardHeader>
              <CardTitle>
                {editingAdId ? "Editar Anuncio" : "Nuevo Anuncio"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...adForm}>
                <form onSubmit={adForm.handleSubmit(handleAdSubmit)} className="space-y-6">
                  <FormField
                    control={adForm.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nombre</FormLabel>
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
                        <FormLabel>Imagen</FormLabel>
                        <div className="flex gap-2">
                          <FormControl className="flex-1">
                            <Input {...field} />
                          </FormControl>
                          <Button
                            type="button"
                            onClick={() => adFileInputRef.current?.click()}
                            variant="default"
                          >
                            <Upload className="mr-2 h-4 w-4" />
                            Subir
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
                          URL o imagen (max 5MB)
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  {watchedAdImageUrl && (
                    <div className="relative w-full h-48 border rounded-md overflow-hidden">
                      <Image
                        src={watchedAdImageUrl}
                        alt="Preview"
                        fill
                        className="object-contain"
                      />
                    </div>
                  )}
                  
                  <div className="flex gap-2 pt-2">
                    <Button
                      type="submit"
                      disabled={isSubmitting}
                      className="flex-1"
                    >
                      {isSubmitting ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="mr-2 h-4 w-4" />
                      )}
                      {editingAdId ? "Actualizar" : "Guardar"}
                    </Button>
                    
                    {editingAdId && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={resetAdForm}
                        disabled={isSubmitting}
                      >
                        <XCircle className="mr-2 h-4 w-4" />
                        Cancelar
                      </Button>
                    )}
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
          
          <div className="space-y-4 max-h-[40vh] overflow-y-auto">
            <h2 className="text-2xl font-semibold">Anuncios Activos</h2>
            
            {isLoadingAds ? (
              <div className="flex justify-center items-center py-10">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : errorLoadingAds ? (
              <Alert variant="destructive">
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{errorLoadingAds}</AlertDescription>
              </Alert>
            ) : ads.length === 0 ? (
              <div className="text-center py-10 border rounded-lg">
                <p>No hay anuncios activos</p>
              </div>
            ) : (
              ads.map((ad) => (
                <Card key={ad.id}>
                  <CardHeader className="flex-row justify-between items-start pb-2">
                    <CardTitle className="text-lg">
                      {ad.name}
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      <Badge variant={ad.isActive ? "default" : "secondary"}>
                        {ad.isActive ? "Activo" : "Inactivo"}
                      </Badge>
                      <Switch
                        checked={ad.isActive}
                        onCheckedChange={(checked) => toggleAdActive(ad.id!, checked)}
                        disabled={isTogglingAdActive}
                      />
                    </div>
                  </CardHeader>
                  
                  <CardContent className="pb-2">
                    <div className="relative h-32 w-full rounded-md overflow-hidden border">
                      {ad.imageUrl ? (
                        <Image
                          src={ad.imageUrl}
                          alt={ad.name}
                          fill
                          className="object-contain"
                        />
                      ) : (
                        <div className="flex items-center justify-center h-full">
                          <ImageOff className="h-8 w-8" />
                        </div>
                      )}
                    </div>
                    
                    <div className="mt-2 text-sm">
                      <p>Creado: {formatDate(ad.createdAt)}</p>
                      {ad.updatedAt && (
                        <p>Actualizado: {formatDate(ad.updatedAt)}</p>
                      )}
                      <p className="text-orange-600">
                        <CalendarClock className="inline mr-1 h-3 w-3" />
                        Vence: {calculateExpiryDate(ad.createdAt)}
                      </p>
                    </div>
                  </CardContent>
                  
                  <CardFooter className="flex justify-end gap-2 pb-3">
                    <Button
                      size="sm"
                      onClick={() => handleEditAd(ad)}
                      disabled={isSubmitting}
                    >
                      <Edit3 className="mr-1 h-3 w-3" />
                      Editar
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDeleteAd(ad)}
                      disabled={isSubmitting}
                    >
                      <Trash2 className="mr-1 h-3 w-3" />
                      Eliminar
                    </Button>
                  </CardFooter>
                </Card>
              ))
            )}
          </div>
        </div>
        
        {/* Sección de Banners */}
        <div className="space-y-8">
          <Card ref={bannerEditorFormCardRef}>
            <CardHeader>
              <CardTitle>
                {editingBannerId ? "Editar Banner" : "Nuevo Banner"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...bannerForm}>
                <form onSubmit={bannerForm.handleSubmit(handleBannerSubmit)} className="space-y-6">
                  <FormField
                    control={bannerForm.control}
                    name="nombre"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nombre</FormLabel>
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
                        <FormLabel>Imagen</FormLabel>
                        <div className="flex gap-2">
                          <FormControl className="flex-1">
                            <Input {...field} />
                          </FormControl>
                          <Button
                            type="button"
                            onClick={() => bannerFileInputRef.current?.click()}
                            variant="default"
                          >
                            <Upload className="mr-2 h-4 w-4" />
                            Subir
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
                          URL o imagen (max 5MB)
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  {watchedBannerImageUrl && (
                    <div className="relative w-full h-48 border rounded-md overflow-hidden">
                      <Image
                        src={watchedBannerImageUrl}
                        alt="Preview"
                        fill
                        className="object-contain"
                      />
                    </div>
                  )}
                  
                  <div className="flex gap-2 pt-2">
                    <Button
                      type="submit"
                      disabled={isSubmitting}
                      className="flex-1"
                    >
                      {isSubmitting ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="mr-2 h-4 w-4" />
                      )}
                      {editingBannerId ? "Actualizar" : "Guardar"}
                    </Button>
                    
                    {editingBannerId && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={resetBannerForm}
                        disabled={isSubmitting}
                      >
                        <XCircle className="mr-2 h-4 w-4" />
                        Cancelar
                      </Button>
                    )}
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
          
          <div className="space-y-4 max-h-[40vh] overflow-y-auto">
            <h2 className="text-2xl font-semibold">Banners Activos</h2>
            
            {isLoadingBanners ? (
              <div className="flex justify-center items-center py-10">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : errorLoadingBanners ? (
              <Alert variant="destructive">
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{errorLoadingBanners}</AlertDescription>
              </Alert>
            ) : banners.length === 0 ? (
              <div className="text-center py-10 border rounded-lg">
                <p>No hay banners activos</p>
              </div>
            ) : (
              banners.map((banner) => (
                <Card key={banner.id}>
                  <CardHeader className="flex-row justify-between items-start pb-2">
                    <CardTitle className="text-lg">
                      {banner.nombre}
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      <Badge variant={banner.isActive ? "default" : "secondary"}>
                        {banner.isActive ? "Activo" : "Inactivo"}
                      </Badge>
                      <Switch
                        checked={banner.isActive}
                        onCheckedChange={(checked) => toggleBannerActive(banner.id!, checked)}
                        disabled={isTogglingBannerActive}
                      />
                    </div>
                  </CardHeader>
                  
                  <CardContent className="pb-2">
                    <div className="relative h-32 w-full rounded-md overflow-hidden border">
                      {banner.imageUrl ? (
                        <Image
                          src={banner.imageUrl}
                          alt={banner.nombre}
                          fill
                          className="object-contain"
                        />
                      ) : (
                        <div className="flex items-center justify-center h-full">
                          <ImageOff className="h-8 w-8" />
                        </div>
                      )}
                    </div>
                    
                    <div className="mt-2 text-sm">
                      <p>Creado: {formatDate(banner.createdAt)}</p>
                      {banner.updatedAt && (
                        <p>Actualizado: {formatDate(banner.updatedAt)}</p>
                      )}
                      <p className="text-orange-600">
                        <CalendarClock className="inline mr-1 h-3 w-3" />
                        Vence: {calculateExpiryDate(banner.createdAt)}
                      </p>
                    </div>
                  </CardContent>
                  
                  <CardFooter className="flex justify-end gap-2 pb-3">
                    <Button
                      size="sm"
                      onClick={() => handleEditBanner(banner)}
                      disabled={isSubmitting}
                    >
                      <Edit3 className="mr-1 h-3 w-3" />
                      Editar
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDeleteBanner(banner)}
                      disabled={isSubmitting}
                    >
                      <Trash2 className="mr-1 h-3 w-3" />
                      Eliminar
                    </Button>
                  </CardFooter>
                </Card>
              ))
            )}
          </div>
        </div>
      </div>
      
      {/* Diálogos de confirmación */}
      <AlertDialog open={!!adToDelete} onOpenChange={(open) => !open && setAdToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar anuncio?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. El anuncio "{adToDelete?.name}" será eliminado permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteAd}
              disabled={isSubmitting}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      <AlertDialog open={!!bannerToDelete} onOpenChange={(open) => !open && setBannerToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar banner?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. El banner "{bannerToDelete?.nombre}" será eliminado permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteBanner}
              disabled={isSubmitting}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}