
"use client";

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import type { TextoTicker } from '@/types';

import { supabase } from '@/lib/supabaseClient';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from '@/hooks/use-toast';
import { Loader2, Send, Trash2, ListCollapse, MessageSquareText } from 'lucide-react';
import { Alert, AlertDescription as ShadcnAlertDescription, AlertTitle as ShadcnAlertTitle } from "@/components/ui/alert";

const textoTickerSchema = z.object({
  text: z.string()
    .min(3, { message: "El texto debe tener al menos 3 caracteres." })
    .max(300, { message: "El texto debe tener 300 caracteres o menos." }),
});

type TextoTickerFormValues = z.infer<typeof textoTickerSchema>;

export function TextTickerEditor() {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [texts, setTexts] = React.useState<TextoTicker[]>([]);
  const [isLoadingTexts, setIsLoadingTexts] = React.useState(true);
  const [errorLoadingTexts, setErrorLoadingTexts] = React.useState<string | null>(null);
  const [showDeleteConfirmDialog, setShowDeleteConfirmDialog] = React.useState(false);
  const [textToDelete, setTextToDelete] = React.useState<TextoTicker | null>(null);

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

      if (error) throw error;
      setTexts(data || []);
    } catch (error: any) {
      let consoleErrorMessage = "Error cargando textos del ticker.";
      if (error && typeof error === 'object') {
        if (typeof error.message === 'string' && error.message) {
          consoleErrorMessage += ` Mensaje: ${error.message}`;
        }
        if (typeof error.code === 'string' && error.code) {
          consoleErrorMessage += ` Código: ${error.code}`;
        }
      }
      console.error(consoleErrorMessage + " (Objeto de error original abajo, podría mostrarse como '{}' si no es serializable por la consola).");
      console.error("Objeto de error original:", error); 

      let description = `No se pudieron cargar los textos del ticker. Revisa la consola y los logs del panel de Supabase para más detalles.`;
      
      const errorCode = (typeof error?.code === 'string') ? error.code : "";
      const errorMessageLowerCase = (typeof error?.message === 'string') ? error.message.toLowerCase() : "";

      if (errorCode === 'PGRST116' || (errorMessageLowerCase.includes('relation') && errorMessageLowerCase.includes('does not exist')) || (error?.status === 404 && (errorMessageLowerCase.includes('not found') || errorMessageLowerCase.includes('no existe')))) {
        description = "Error CRÍTICO: La tabla 'textos_ticker' NO EXISTE o no es accesible en Supabase. Por favor, VERIFICA URGENTEMENTE tu configuración de tabla 'textos_ticker' y sus políticas RLS en el panel de Supabase.";
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
  };

  const onSubmit = async (data: TextoTickerFormValues) => {
    setIsSubmitting(true);
    const now = new Date().toISOString();

    const textToInsert = {
      text: data.text,
      createdAt: now,
    };

    try {
      const { data: insertedData, error: insertError } = await supabase
        .from('textos_ticker')
        .insert([textToInsert])
        .select()
        .single();

      if (insertError) throw insertError;

      toast({
        title: "¡Texto Guardado!",
        description: `El texto para el ticker ha sido guardado.`,
      });
      fetchTexts();
      resetForm();
    } catch (error: any) {
      console.error("Error al crear texto para ticker:", error);
      let description = "No se pudo crear el texto para el ticker. Inténtalo de nuevo.";
      
      const errorCode = (typeof error?.code === 'string') ? error.code : "";
      const errorMessageLowerCase = (typeof error?.message === 'string') ? error.message.toLowerCase() : "";

      if (errorCode === 'PGRST116' || (errorMessageLowerCase.includes('relation') && errorMessageLowerCase.includes('does not exist')) || (error?.status === 404 && (errorMessageLowerCase.includes('not found') || errorMessageLowerCase.includes('no existe')))) {
        description = "Error CRÍTICO: La tabla 'textos_ticker' NO EXISTE o no es accesible en Supabase. Por favor, VERIFICA URGENTEMENTE tu configuración de tabla 'textos_ticker' y sus políticas RLS en el panel de Supabase.";
      } else if (error?.message) {
        description = `Error al crear texto: ${error.message}. Revisa los logs del panel de Supabase.`;
      }
      
      toast({
        title: "Error al Crear Texto",
        description: `${description} Revisa la consola y los logs de Supabase para más detalles.`,
        variant: "destructive",
        duration: 10000,
      });
    } finally {
      setIsSubmitting(false);
    }
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
    } catch (error: any) {
      console.error("Error al eliminar texto del ticker:", error);
      let description = "No se pudo eliminar el texto. Inténtalo de nuevo.";
      if (error?.message) {
        description = `Error: ${error.message}. Revisa los logs del panel de Supabase para más detalles.`;
      }
      toast({ title: "Error al Eliminar Texto", description, variant: "destructive", duration: 9000 });
    } finally {
      setIsSubmitting(false);
      setShowDeleteConfirmDialog(false);
      setTextToDelete(null);
    }
  };
  
  const formatDate = (dateString?: string | null) => {
    if (!dateString) return 'Fecha desconocida';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        console.warn(`'formatDate' recibió una cadena de fecha inválida que no pudo ser parseada: "${dateString}"`);
        return 'Fecha inválida';
      }
      return date.toLocaleDateString('es-ES', {
        year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
      });
    } catch (e) {
      console.error("Error inesperado en 'formatDate' al procesar:", dateString, e);
      return 'Error al formatear fecha';
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <header className="mb-8 text-center">
        <h1 className="text-4xl font-bold tracking-tight text-primary">Editor de Textos Ticker</h1>
        <p className="mt-2 text-muted-foreground">
          Gestiona los mensajes que aparecerán en el ticker de noticias.
        </p>
      </header>

      <div className="grid lg:grid-cols-3 gap-8 items-start">
        <Card className="shadow-xl lg:col-span-1">
          <CardHeader>
            <CardTitle>Nuevo Texto para Ticker</CardTitle>
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
                        <Textarea placeholder="Escribe el mensaje para el ticker aquí..." {...field} rows={5} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" disabled={isSubmitting} className="w-full">
                  {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                  Guardar Texto
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        <div className="lg:col-span-2 space-y-4 max-h-[calc(100vh-15rem)] overflow-y-auto pr-2">
          <h2 className="text-2xl font-semibold text-foreground mb-4">Textos Actuales del Ticker</h2>
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
              texts.map((textItem) => (
                <Card key={textItem.id} className="shadow-md hover:shadow-lg transition-shadow">
                  <CardContent className="pt-4 pb-3 px-4">
                    <p className="text-sm text-foreground break-words whitespace-pre-wrap">
                      {textItem.text}
                    </p>
                  </CardContent>
                   <CardFooter className="text-xs text-muted-foreground pt-1 pb-2 px-4 flex justify-between items-center bg-muted/30">
                      <p className="text-[0.7rem] leading-tight">Creado: {formatDate(textItem.createdAt)}</p>
                      <Button variant="destructive" size="sm" onClick={() => handleDelete(textItem)} disabled={isSubmitting} className="h-7 px-2 py-1 text-xs">
                        <Trash2 className="mr-1 h-3 w-3" /> Eliminar
                      </Button>
                   </CardFooter>
                </Card>
              ))
          )}
        </div>
      </div>

      <AlertDialog open={showDeleteConfirmDialog} onOpenChange={setShowDeleteConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Estás absolutamente seguro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Esto eliminará permanentemente el texto del ticker: 
              "{textToDelete?.text.substring(0, 50) || 'seleccionado'}{textToDelete && textToDelete.text.length > 50 ? '...' : ''}"
            </AlertDialogDescription>
          </AlertDialogHeader>
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

    