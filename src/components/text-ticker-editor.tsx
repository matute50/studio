
"use client";

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import Link from 'next/link';

import type { TextoTicker } from '@/types';

import { supabase } from '@/lib/supabaseClient';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader as AlertDialogHeaderComponent, AlertDialogTitle as AlertDialogTitleComponent } from "@/components/ui/alert-dialog";
import { useToast } from '@/hooks/use-toast';
import { Loader2, Send, Trash2, ListCollapse, MessageSquareText, Edit3, Home } from 'lucide-react';
import { Alert, AlertDescription as ShadcnAlertDescription, AlertTitle as ShadcnAlertTitle } from "@/components/ui/alert";
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

const textoTickerSchema = z.object({
  text: z.string()
    .min(3, { message: "El texto debe tener al menos 3 caracteres." }),
});

type TextoTickerFormValues = z.infer<typeof textoTickerSchema>;

export function TextTickerEditor() {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [texts, setTexts] = React.useState<TextoTicker[]>([]);
  const [isLoadingTexts, setIsLoadingTexts] = React.useState(true);
  const [errorLoadingTexts, setErrorLoadingTexts] = React.useState<string | null>(null);
  
  const [editingTextId, setEditingTextId] = React.useState<string | null>(null);
  const [showDeleteConfirmDialog, setShowDeleteConfirmDialog] = React.useState(false);
  const [textToDelete, setTextToDelete] = React.useState<TextoTicker | null>(null);
  const [isTogglingActive, setIsTogglingActive] = React.useState(false);
  const editorFormCardRef = React.useRef<HTMLDivElement>(null);


  const form = useForm<TextoTickerFormValues>({
    resolver: zodResolver(textoTickerSchema),
    defaultValues: {
      text: '',
    },
    mode: "onChange",
  });

  const fetchTexts = async () => {
    setIsLoadingTexts(true);
    setErrorLoadingTexts(null);
    try {
      const { data, error } = await supabase
        .from('textos_ticker')
        .select('*')
        .order('createdAt', { ascending: false });

      if (error) {
         if (error.code === '42703' && error.message.includes('column') && error.message.toLowerCase().includes('createdat') && error.message.includes('does not exist')) {
            toast({
              title: "Advertencia de Carga",
              description: "No se pudo ordenar por fecha de creación (columna 'createdAt' podría faltar). Mostrando textos sin ordenar.",
              variant: "default",
            });
            const { data: dataUnordered, error: errorUnordered } = await supabase
                .from('textos_ticker')
                .select('*');
            if (errorUnordered) throw errorUnordered;
            setTexts(dataUnordered || []);
        } else {
            throw error;
        }
      } else {
        setTexts(data || []);
      }
    } catch (error: any) {
      let consoleErrorMessage = "Error cargando textos del ticker.";
      if (error?.message) consoleErrorMessage += ` Mensaje: ${error.message}`;
      if (error?.code) consoleErrorMessage += ` Código: ${error.code}`;
      
      let description = `No se pudieron cargar los textos del ticker. Revisa la consola y los logs del panel de Supabase para más detalles.`;
      const errorCode = (typeof error?.code === 'string') ? error.code : "";
      const errorMessageLowerCase = (typeof error?.message === 'string') ? error.message.toLowerCase() : "";

      if (errorCode === 'PGRST116' || (errorMessageLowerCase.includes('relation') && errorMessageLowerCase.includes('does not exist')) || (error?.status === 404 && (errorMessageLowerCase.includes('not found') || errorMessageLowerCase.includes('no existe')))) {
        description = "Error CRÍTICO: La tabla 'textos_ticker' NO EXISTE o no es accesible en Supabase. Por favor, VERIFICA URGENTEMENTE tu configuración de tabla 'textos_ticker' y sus políticas RLS en el panel de Supabase.";
      } else if (errorCode === '42703' || (errorMessageLowerCase.includes('column') && errorMessageLowerCase.includes('does not exist'))) {
        description = `Error de Base de Datos: Una columna requerida (por ejemplo, 'createdAt' para ordenamiento, o 'isActive', 'updatedAt') NO EXISTE en la tabla 'textos_ticker'. Por favor, verifica la ESTRUCTURA de tu tabla 'textos_ticker' en el panel de Supabase y asegúrate de que todas las columnas esperadas estén presentes. Error original: ${error.message || 'Desconocido'}`;
      } else if (error?.message) {
        description = `No se pudieron cargar los textos: ${error.message}. Asegúrate de que la tabla 'textos_ticker' exista y tenga RLS configuradas correctamente. Revisa los logs del panel de Supabase.`;
      }

      setErrorLoadingTexts(description);
      toast({
        title: "Error al Cargar Textos",
        description,
        variant: "destructive",
        duration: 10000, 
      });
    } finally {
      setIsLoadingTexts(false);
    }
  };

  React.useEffect(() => {
    fetchTexts();
  }, []);

  const resetForm = () => {
    form.reset({ text: '' });
    setEditingTextId(null);
  };

  const onSubmit = async (data: TextoTickerFormValues) => {
    setIsSubmitting(true);
    const now = new Date().toISOString();

    if (editingTextId) {
      const textToUpdate: Partial<TextoTicker> = { 
        text: data.text,
        updatedAt: now,
      };
      try {
        const { data: updatedData, error: updateError } = await supabase
          .from('textos_ticker')
          .update(textToUpdate)
          .eq('id', editingTextId)
          .select()
          .single();
        
        if (updateError) throw updateError;

        toast({ title: "¡Texto Actualizado!", description: `El texto del ticker ha sido actualizado.` });
        fetchTexts();
        resetForm();
      } catch (error: any) {
        let description = "No se pudo actualizar el texto del ticker. Inténtalo de nuevo.";
        if (error?.message) description = `Error: ${error.message}`;
        if (error?.code) description += ` (Código: ${error.code})`;
        
        const errorCode = (typeof error?.code === 'string') ? error.code : "";
        const errorMessageLowerCase = (typeof error?.message === 'string') ? error.message.toLowerCase() : "";

        if (errorCode === 'PGRST116' || (errorMessageLowerCase.includes('relation') && errorMessageLowerCase.includes('does not exist')) || (error?.status === 404 && (errorMessageLowerCase.includes('not found') || errorMessageLowerCase.includes('no existe')))) {
            description = "Error CRÍTICO al actualizar: La tabla 'textos_ticker' NO EXISTE o no es accesible. Revisa la configuración de Supabase.";
        }

        toast({
          title: "Error al Actualizar Texto",
          description: `${description} Revisa la consola y los logs de Supabase para más detalles.`,
          variant: "destructive",
          duration: 9000,
        });
      }

    } else {
      const textToInsert: Omit<TextoTicker, 'id' | 'updatedAt'> = { 
        text: data.text,
        createdAt: now,
        isActive: false, 
      };

      try {
        const { data: insertedData, error: insertError } = await supabase
          .from('textos_ticker')
          .insert([textToInsert])
          .select()
          .single();

        if (insertError) throw insertError;

        toast({ title: "¡Texto Guardado!", description: `El texto para el ticker ha sido guardado.` });
        fetchTexts();
        resetForm();
      } catch (error: any)
      {
        let description = "No se pudo crear el texto para el ticker. Inténtalo de nuevo.";
        
        const errorCode = (typeof error?.code === 'string') ? error.code : "";
        const errorMessageLowerCase = (typeof error?.message === 'string') ? error.message.toLowerCase() : "";

        if (errorCode === 'PGRST116' || (errorMessageLowerCase.includes('relation') && errorMessageLowerCase.includes('does not exist')) || (error?.status === 404 && (errorMessageLowerCase.includes('not found') || errorMessageLowerCase.includes('no existe')))) {
          description = "Error CRÍTICO al crear: La tabla 'textos_ticker' NO EXISTE o no es accesible en Supabase. Por favor, VERIFICA URGENTEMENTE tu configuración de tabla 'textos_ticker' y sus políticas RLS en el panel de Supabase.";
        } else if (error?.message) {
          description = `Error al crear texto: ${error.message}.`;
           if (error?.code) description += ` (Código: ${error.code})`;
        }
        
        toast({
          title: "Error al Crear Texto",
          description: `${description} Revisa la consola y los logs de Supabase para más detalles.`,
          variant: "destructive",
          duration: 10000,
        });
      }
    }
    setIsSubmitting(false);
  };

  const handleEdit = (textItem: TextoTicker) => {
    if (!textItem.id) {
      toast({ title: "Error", description: "No se puede editar un texto sin ID.", variant: "destructive" });
      return;
    }
    setEditingTextId(textItem.id);
    form.setValue('text', textItem.text);
    editorFormCardRef.current?.scrollIntoView({ behavior: 'smooth' });
    toast({ title: "Modo Edición", description: `Editando texto: "${textItem.text.substring(0,30)}..."` });
  };

  const cancelEdit = () => {
    setEditingTextId(null);
    resetForm();
    toast({ title: "Edición Cancelada" });
  };

  const handleDelete = (textItem: TextoTicker) => {
    if (!textItem.id) {
      toast({ title: "Error", description: "No se puede eliminar un texto sin ID.", variant: "destructive" });
      return;
    }
    setTextToDelete(textItem);
    setShowDeleteConfirmDialog(true);
  };

  const confirmDelete = async () => {
    if (!textToDelete || !textToDelete.id) return;
    setIsSubmitting(true); 

    try {
      const { error: deleteError } = await supabase
        .from('textos_ticker')
        .delete()
        .eq('id', textToDelete.id);

      if (deleteError) throw deleteError;

      toast({ title: "Texto Eliminado", description: `El texto del ticker ha sido eliminado.` });
      fetchTexts();
      if (editingTextId === textToDelete.id) {
        cancelEdit();
      }
    } catch (error: any) {
      let description = "No se pudo eliminar el texto. Inténtalo de nuevo.";
      if (error?.message) {
        description = `Error: ${error.message}.`;
         if (error?.code) description += ` (Código: ${error.code})`;
      }
      toast({ title: "Error al Eliminar Texto", description: `${description} Revisa los logs del panel de Supabase.`, variant: "destructive", duration: 9000 });
    } finally {
      setIsSubmitting(false);
      setShowDeleteConfirmDialog(false);
      setTextToDelete(null);
    }
  };

  const handleActiveToggle = async (textId: string, newActiveState: boolean) => {
    setIsTogglingActive(true);
    const now = new Date().toISOString();
    try {
      const { error: toggleError } = await supabase
        .from('textos_ticker')
        .update({ isActive: newActiveState, updatedAt: now })
        .eq('id', textId);
      if (toggleError) throw toggleError;

      toast({ title: "Estado de Activo Actualizado", description: "El estado del texto del ticker ha sido actualizado." });
      fetchTexts(); 
    } catch (error: any) {
      let description = "No se pudo actualizar el estado activo del texto.";
      if (error?.message) description = `Error: ${error.message}`;
      if (error?.code) description += ` (Código: ${error.code})`;
      toast({
        title: "Error al Actualizar Estado",
        description: `${description} Revisa los logs del panel de Supabase.`,
        variant: "destructive",
      });
    } finally {
      setIsTogglingActive(false);
    }
  };
  
  const formatDate = (dateString?: string | null) => {
    if (!dateString) return 'Fecha desconocida';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return 'Fecha inválida';
      }
      return date.toLocaleDateString('es-ES', {
        year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
      });
    } catch (e: any) {
      return 'Error al formatear fecha';
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <header className="flex flex-col sm:flex-row items-center justify-center text-center mb-8 gap-3 sm:gap-4">
        <h1 className="text-4xl font-bold tracking-tight text-primary uppercase">Editor de Textos Ticker</h1>
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
        <Card className="shadow-xl lg:max-w-3xl mx-auto" ref={editorFormCardRef}>
          <CardHeader>
            <CardTitle className="uppercase">{editingTextId ? "Editar Texto del Ticker" : "Nuevo Texto para Ticker"}</CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="text"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Texto del Ticker</FormLabel>
                      <FormControl>
                        <Textarea {...field} rows={5} placeholder="" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button 
                    type="submit" 
                    disabled={isSubmitting || isTogglingActive} 
                    className="w-full sm:flex-1"
                    variant="destructive"
                    size="sm"
                  >
                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                    {editingTextId ? "Actualizar Texto" : "Guardar Texto"}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <h2 className="text-2xl font-semibold text-foreground mb-4 text-center lg:text-left uppercase">Textos Actuales del Ticker</h2>
          <div className="max-h-[calc(100vh-25rem)] overflow-y-auto pr-2">
            {isLoadingTexts && (
              <div className="flex justify-center items-center py-10">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="ml-2 text-muted-foreground">Cargando textos...</p>
              </div>
            )}
            {errorLoadingTexts && (
              <Alert variant="destructive">
                <ListCollapse className="h-4 w-4" />
                <ShadcnAlertTitle>Error al Cargar Textos del Ticker</ShadcnAlertTitle>
                <ShadcnAlertDescription>{errorLoadingTexts}</ShadcnAlertDescription>
              </Alert>
            )}
            {!isLoadingTexts && !errorLoadingTexts && texts.length === 0 && (
              <div className="text-center py-10 border-2 border-dashed border-muted-foreground/30 rounded-lg">
                <MessageSquareText className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
                <p className="text-muted-foreground">No hay textos guardados para el ticker.</p>
                <p className="text-sm text-muted-foreground">Usa el editor para añadir el primer texto.</p>
              </div>
            )}
            {!isLoadingTexts && !errorLoadingTexts && texts.length > 0 && (
                texts.map((textItem, index) => (
                  <Card key={textItem.id} className="shadow-md hover:shadow-lg transition-shadow mb-4">
                    <CardHeader className="pb-2 pt-3 px-4">
                      <div className="flex justify-between items-start gap-2">
                        <div className="flex-grow">
                            <div className="flex items-center gap-2 mb-1">
                              {textItem.isActive ? (
                                <Badge className="whitespace-nowrap bg-green-600 text-primary-foreground text-xs px-1.5 py-0.5">
                                  <span className="font-semibold mr-1">{index + 1}.</span>Activo
                                </Badge>
                              ) : (
                                 <span className="text-sm font-semibold text-primary">{index + 1}.</span>
                              )}
                            </div>
                            <p className="text-sm text-foreground break-words whitespace-pre-wrap">
                              {textItem.text}
                            </p>
                        </div>
                        <div className="flex flex-col items-end space-y-1 flex-shrink-0">
                          <div className="flex items-center space-x-1">
                            <Label htmlFor={`active-switch-${textItem.id}`} className="text-xs text-muted-foreground">
                              Activo
                            </Label>
                            <Switch
                              id={`active-switch-${textItem.id}`}
                              checked={!!textItem.isActive}
                              onCheckedChange={(isChecked) => {
                                if (textItem.id) {
                                  handleActiveToggle(textItem.id, isChecked);
                                } else {
                                  toast({title: "Error", description: "Falta ID del texto para cambiar estado.", variant: "destructive"});
                                }
                              }}
                              disabled={isTogglingActive || isSubmitting}
                              className="data-[state=checked]:bg-green-600 data-[state=unchecked]:bg-input h-5 w-9 [&>span]:h-4 [&>span]:w-4 [&>span]:data-[state=checked]:translate-x-4"
                              aria-label={`Marcar texto como activo`}
                            />
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardFooter className="text-xs text-muted-foreground pt-1 pb-2 px-4 flex justify-between items-center bg-muted/30">
                        <div>
                          <p className="text-[0.7rem] leading-tight">Creado: {formatDate(textItem.createdAt)}</p>
                          {textItem.updatedAt && textItem.updatedAt !== textItem.createdAt && (
                            <p className="text-[0.7rem] leading-tight text-muted-foreground/80">(Editado: {formatDate(textItem.updatedAt)})</p>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" onClick={() => textItem.id && handleEdit(textItem)} disabled={isSubmitting || isTogglingActive} className="h-7 px-2 py-1 text-xs">
                            <Edit3 className="mr-1 h-3 w-3" /> Editar
                          </Button>
                          <Button variant="destructive" size="sm" onClick={() => handleDelete(textItem)} disabled={isSubmitting || isTogglingActive} className="h-7 px-2 py-1 text-xs">
                            <Trash2 className="mr-1 h-3 w-3" /> Eliminar
                          </Button>
                        </div>
                    </CardFooter>
                  </Card>
                ))
            )}
          </div>
        </div>
      </div>

      <AlertDialog open={showDeleteConfirmDialog} onOpenChange={setShowDeleteConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeaderComponent>
            <AlertDialogTitleComponent>¿ESTÁS ABSOLUTAMENTE SEGURO?</AlertDialogTitleComponent>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Esto eliminará permanentemente el texto del ticker: 
              "{textToDelete?.text.substring(0, 50) || 'seleccionado'}{textToDelete && textToDelete.text.length > 50 ? '...' : ''}"
            </AlertDialogDescription>
          </AlertDialogHeaderComponent>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setShowDeleteConfirmDialog(false); setTextToDelete(null); }}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={isSubmitting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
    
    
