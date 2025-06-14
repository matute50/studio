
"use client";

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import Link from 'next/link';
import type { HcdItem } from '@/types';

import { supabase } from '@/lib/supabaseClient'; 

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription as AlertDialogDescriptionComponent, AlertDialogFooter, AlertDialogHeader as AlertDialogHeaderComponent, AlertDialogTitle as AlertDialogTitleComponent } from "@/components/ui/alert-dialog";
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save, Trash2, Edit3, XCircle, Home, Link2, LibrarySquare } from 'lucide-react';
import { Alert, AlertDescription as ShadcnAlertDescription, AlertTitle as ShadcnAlertTitle } from "@/components/ui/alert";

const TABLE_NAME = 'hcd';

const hcdSchema = z.object({
  nombre: z.string().min(3, { message: "El nombre debe tener al menos 3 caracteres." }).max(200, { message: "El nombre no puede exceder los 200 caracteres." }),
  url: z.string().url({ message: "Por favor, introduce una URL válida." }),
});

type HcdFormValues = z.infer<typeof hcdSchema>;

export function HcdManager() {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const editorFormCardRef = React.useRef<HTMLDivElement>(null);
  
  const [items, setItems] = React.useState<HcdItem[]>([]);
  const [isLoadingItems, setIsLoadingItems] = React.useState(true);
  const [errorLoadingItems, setErrorLoadingItems] = React.useState<string | null>(null);

  const [editingItemId, setEditingItemId] = React.useState<string | null>(null);
  const [showDeleteConfirmDialog, setShowDeleteConfirmDialog] = React.useState(false);
  const [itemToDelete, setItemToDelete] = React.useState<HcdItem | null>(null);

  const form = useForm<HcdFormValues>({
    resolver: zodResolver(hcdSchema),
    defaultValues: {
      nombre: '',
      url: '',
    },
    mode: "onChange",
  });

  const fetchItems = async () => {
    setIsLoadingItems(true);
    setErrorLoadingItems(null);
    try {
      const { data, error } = await supabase
        .from(TABLE_NAME)
        .select('*')
        .order('createdAt', { ascending: false });

      if (error) throw error;
      setItems(data || []);
    } catch (error: any) {
      const description = `No se pudieron cargar los items de HCD: ${error.message || 'Error desconocido'}. Verifica que la tabla '${TABLE_NAME}' exista.`;
      setErrorLoadingItems(description);
      toast({
        title: `Error al Cargar Items de HCD`,
        description,
        variant: "destructive",
      });
    } finally {
      setIsLoadingItems(false);
    }
  };

  React.useEffect(() => {
    fetchItems();
  }, []);

  const resetForm = () => {
    form.reset({ nombre: '', url: '' });
    setEditingItemId(null);
  };

  const onSubmit = async (data: HcdFormValues) => {
    setIsSubmitting(true);
    const now = new Date().toISOString();

    try {
      if (editingItemId) {
        const payload = { 
          nombre: data.nombre,
          url: data.url,
          updatedAt: now 
        };
        const { data: updatedData, error } = await supabase
          .from(TABLE_NAME)
          .update(payload)
          .eq('id', editingItemId)
          .select()
          .single();
        if (error) throw error;
        toast({ title: "¡Item HCD Actualizado!", description: `El item "${updatedData?.nombre}" ha sido actualizado.` });
      } else {
        const payload = { 
          nombre: data.nombre,
          url: data.url,
          createdAt: now,
          updatedAt: now 
        };
        const { data: insertedData, error } = await supabase
          .from(TABLE_NAME)
          .insert([payload])
          .select()
          .single();
        if (error) throw error;
        toast({ title: "¡Item HCD Guardado!", description: `El item "${insertedData?.nombre}" ha sido guardado.` });
      }
      fetchItems();
      resetForm();
    } catch (error: any) {
      let description = `No se pudo guardar el item HCD. Inténtalo de nuevo.`;
       const errorCode = (typeof error?.code === 'string') ? error.code : "";
       const errorMessageLowerCase = (typeof error?.message === 'string') ? error.message.toLowerCase() : "";

       if (errorCode === 'PGRST116' || (errorMessageLowerCase.includes('relation') && errorMessageLowerCase.includes('does not exist')) || (error?.status === 404 && (errorMessageLowerCase.includes('not found') || errorMessageLowerCase.includes('no existe')))) {
          description = `Error CRÍTICO 404 (Not Found): La tabla '${TABLE_NAME}' PARECE NO EXISTIR o no es accesible. Por favor, VERIFICA URGENTEMENTE tu configuración de tabla y RLS en Supabase. (Código: ${errorCode})`;
       } else if (error?.message) {
         description = `Error al guardar: ${error.message}. (Código: ${errorCode})`;
       }
       toast({
          title: "Error al Guardar Item HCD",
          description: `${description} Revisa consola y logs de Supabase.`,
          variant: "destructive",
          duration: 10000,
       });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (item: HcdItem) => {
    if (!item.id) return;
    setEditingItemId(item.id);
    form.reset({
      nombre: item.nombre,
      url: item.url,
    });
    editorFormCardRef.current?.scrollIntoView({ behavior: 'smooth' });
    toast({ title: "Modo Edición HCD", description: `Editando item: ${item.nombre}` });
  };

  const cancelEdit = () => {
    resetForm();
    toast({ title: "Edición Cancelada" });
  };

  const handleDelete = (item: HcdItem) => {
    if (!item.id) return;
    setItemToDelete(item);
    setShowDeleteConfirmDialog(true);
  };

  const confirmDelete = async () => {
    if (!itemToDelete || !itemToDelete.id) return;
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from(TABLE_NAME)
        .delete()
        .eq('id', itemToDelete.id);
      if (error) throw error;
      toast({ title: "Item HCD Eliminado", description: `El item "${itemToDelete.nombre}" ha sido eliminado.` });
      fetchItems();
      if (editingItemId === itemToDelete.id) {
        cancelEdit();
      }
    } catch (error: any) {
      toast({ title: "Error al Eliminar Item HCD", description: `No se pudo eliminar: ${error.message || 'Error desconocido'}.`, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
      setShowDeleteConfirmDialog(false);
      setItemToDelete(null);
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
        <LibrarySquare className="h-10 w-10 text-primary" />
        <h1 className="text-4xl font-bold tracking-tight text-primary">Gestor de Contenido HCD</h1>
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
        {/* Columna del Formulario */}
        <div className="space-y-8">
          <Card className="shadow-xl" ref={editorFormCardRef}>
            <CardHeader>
              <CardTitle>{editingItemId ? "Editar Item HCD" : "Añadir Nuevo Item HCD"}</CardTitle>
              <CardDescription>Ingresa el nombre y la URL del video del HCD.</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <FormField
                    control={form.control}
                    name="nombre"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nombre del Video/Item</FormLabel>
                        <FormControl>
                          <Input placeholder="Ej: Sesión Ordinaria 15/07/2024" {...field} />
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
                  <div className="flex flex-col sm:flex-row gap-2 pt-2">
                    <Button type="submit" variant="destructive" disabled={isSubmitting} className="w-full sm:flex-1">
                      {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                      {editingItemId ? "Actualizar Item" : "Guardar Item"}
                    </Button>
                    {editingItemId && (
                      <Button type="button" variant="outline" onClick={cancelEdit} className="w-full sm:w-auto" disabled={isSubmitting}>
                        <XCircle className="mr-2 h-4 w-4" /> Cancelar Edición
                      </Button>
                    )}
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        </div>

        {/* Columna de la Lista */}
        <div className="space-y-4">
          <h2 className="text-2xl font-semibold text-foreground mb-4">Items HCD Guardados</h2>
           <div className="max-h-[calc(100vh-18rem)] overflow-y-auto pr-2">
            {isLoadingItems && (
              <div className="flex justify-center items-center py-10">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="ml-2 text-muted-foreground">Cargando items HCD...</p>
              </div>
            )}
            {errorLoadingItems && (
              <Alert variant="destructive">
                <LibrarySquare className="h-4 w-4" />
                <ShadcnAlertTitle>Error al Cargar Items</ShadcnAlertTitle>
                <ShadcnAlertDescription>{errorLoadingItems}</ShadcnAlertDescription>
              </Alert>
            )}
            {!isLoadingItems && !errorLoadingItems && items.length === 0 && (
              <div className="text-center py-10 border-2 border-dashed border-muted-foreground/30 rounded-lg">
                <LibrarySquare className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
                <p className="text-muted-foreground">No hay items HCD guardados.</p>
                <p className="text-sm text-muted-foreground">Usa el formulario para añadir el primer item.</p>
              </div>
            )}
            {!isLoadingItems && !errorLoadingItems && items.map((item, index) => (
              <Card key={item.id} className="shadow-md hover:shadow-lg transition-shadow">
                <CardHeader className="pb-2 pt-3 px-3">
                  <CardTitle className="text-md font-semibold break-words">
                     <span className="text-primary mr-2">{index + 1}.</span>
                    {item.nombre}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pb-2 pt-0 px-3 space-y-1">
                  <div className="flex items-center text-sm text-muted-foreground">
                    <Link2 className="mr-2 h-4 w-4 shrink-0" />
                    <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline break-all truncate" title={item.url}>
                      {item.url}
                    </a>
                  </div>
                   <p className="text-xs text-muted-foreground/80">Añadido: {formatDate(item.createdAt)}</p>
                   {item.updatedAt && item.createdAt !== item.updatedAt && (
                      <p className="text-xs text-muted-foreground/70">Actualizado: {formatDate(item.updatedAt)}</p>
                   )}
                </CardContent>
                <CardFooter className="text-xs text-muted-foreground pt-0 pb-2 px-3 flex justify-end gap-1.5">
                  <Button variant="outline" size="sm" onClick={() => handleEdit(item)} disabled={isSubmitting} className="h-7 px-2.5 text-xs">
                    <Edit3 className="mr-1 h-3 w-3" /> Editar
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => handleDelete(item)} disabled={isSubmitting} className="h-7 px-2.5 text-xs">
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
            <AlertDialogTitleComponent>¿Estás seguro de eliminar este item HCD?</AlertDialogTitleComponent>
            <AlertDialogDescriptionComponent>
              Esta acción no se puede deshacer. El item "{itemToDelete?.nombre || 'seleccionado'}" será eliminado permanentemente.
            </AlertDialogDescriptionComponent>
          </AlertDialogHeaderComponent>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setShowDeleteConfirmDialog(false); setItemToDelete(null); }}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={isSubmitting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Eliminar Item
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
