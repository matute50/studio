
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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save, Home, Radio } from 'lucide-react';
import { Alert, AlertDescription as ShadcnAlertDescription, AlertTitle as ShadcnAlertTitle } from "@/components/ui/alert";

const STREAMING_CONFIG_ROW_ID = 'main_stream_config'; // Fixed ID for the streaming config row

const streamingSchema = z.object({
  url_de_streaming: z.string().url({ message: "Por favor, introduce una URL válida." })
    .min(1, { message: "La URL no puede estar vacía." }),
});

type StreamingFormValues = z.infer<typeof streamingSchema>;

export function StreamingManager() {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(true);
  const [currentStreamingUrl, setCurrentStreamingUrl] = React.useState<string | null>(null);
  const [errorLoading, setErrorLoading] = React.useState<string | null>(null);

  const form = useForm<StreamingFormValues>({
    resolver: zodResolver(streamingSchema),
    defaultValues: {
      url_de_streaming: '',
    },
    mode: "onChange",
  });

  const fetchStreamingUrl = async () => {
    setIsLoading(true);
    setErrorLoading(null);
    try {
      const { data, error } = await supabase
        .from('streaming')
        .select('url_de_streaming')
        .eq('id', STREAMING_CONFIG_ROW_ID)
        .maybeSingle(); // Use maybeSingle as the row might not exist yet

      if (error) throw error;

      if (data && data.url_de_streaming) {
        setCurrentStreamingUrl(data.url_de_streaming);
        form.setValue('url_de_streaming', data.url_de_streaming);
      } else {
        setCurrentStreamingUrl(null);
        form.reset({ url_de_streaming: '' }); // Reset form if no URL is found
      }
    } catch (error: any) {
      let description = `No se pudo cargar la URL de streaming: ${error.message || 'Error desconocido'}.`;
      if (error?.code === 'PGRST116' || (error?.message?.toLowerCase().includes('relation') && error?.message?.toLowerCase().includes('does not exist'))) {
        description = `Error CRÍTICO: La tabla 'streaming' NO EXISTE o no es accesible en Supabase. Por favor, VERIFICA la tabla y sus políticas RLS. Error: ${error.message}`;
      }
      setErrorLoading(description);
      toast({
        title: "Error al Cargar URL de Streaming",
        description,
        variant: "destructive",
        duration: 10000,
      });
    } finally {
      setIsLoading(false);
    }
  };

  React.useEffect(() => {
    fetchStreamingUrl();
  }, []);

  const onSubmit = async (data: StreamingFormValues) => {
    setIsSubmitting(true);
    try {
      const payload: StreamingConfig = {
        id: STREAMING_CONFIG_ROW_ID,
        url_de_streaming: data.url_de_streaming,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('streaming')
        .upsert(payload, { onConflict: 'id' }); // Upsert will create if not exists, or update if exists

      if (error) throw error;

      toast({
        title: "¡URL de Streaming Guardada!",
        description: "La URL para el streaming ha sido actualizada.",
      });
      setCurrentStreamingUrl(data.url_de_streaming); // Update displayed URL
    } catch (error: any) {
      let description = `No se pudo guardar la URL: ${error.message || 'Error desconocido'}.`;
        if (error?.code === 'PGRST116' || (error?.message?.toLowerCase().includes('relation') && error?.message?.toLowerCase().includes('does not exist'))) {
            description = `Error CRÍTICO al guardar: La tabla 'streaming' NO EXISTE o no es accesible. Por favor, VERIFICA tu configuración de Supabase. Error: ${error.message}`;
        }
      toast({
        title: "Error al Guardar URL",
        description,
        variant: "destructive",
        duration: 10000,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 flex flex-col items-center">
      <header className="flex flex-col sm:flex-row items-center justify-center text-center mb-8 gap-3 sm:gap-4">
        <h1 className="text-4xl font-bold tracking-tight text-primary">Configuración de Streaming</h1>
      </header>
      <div className="w-full max-w-2xl">
        <div className="mb-6 text-left">
          <Link href="/" passHref legacyBehavior>
            <Button variant="outline" size="sm">
              <Home className="mr-2 h-4 w-4" />
              Volver al Inicio
            </Button>
          </Link>
        </div>

        <Card className="shadow-xl">
          <CardHeader>
            <CardTitle>URL de Streaming en Vivo</CardTitle>
            <CardDescription>
              Introduce la URL del servicio de streaming que se utilizará en el reproductor de la página.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading && (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="mr-2 h-6 w-6 animate-spin text-primary" />
                <span>Cargando configuración actual...</span>
              </div>
            )}
            {errorLoading && !isLoading && (
              <Alert variant="destructive" className="mb-4">
                <Radio className="h-4 w-4" />
                <ShadcnAlertTitle>Error de Carga</ShadcnAlertTitle>
                <ShadcnAlertDescription>{errorLoading}</ShadcnAlertDescription>
              </Alert>
            )}
            {!isLoading && !errorLoading && (
              <>
                {currentStreamingUrl && (
                  <div className="mb-6 p-4 border rounded-md bg-muted">
                    <p className="text-sm font-medium text-foreground">URL Actual:</p>
                    <a 
                      href={currentStreamingUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-sm text-primary hover:underline break-all"
                    >
                      {currentStreamingUrl}
                    </a>
                  </div>
                )}
                {!currentStreamingUrl && (
                    <div className="mb-6 p-4 border border-dashed rounded-md bg-muted/50 text-center">
                        <p className="text-sm text-muted-foreground">No hay URL de streaming configurada actualmente.</p>
                    </div>
                )}
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <FormField
                      control={form.control}
                      name="url_de_streaming"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nueva URL de Streaming</FormLabel>
                          <FormControl>
                            <Input placeholder="https://ejemplo.com/live/stream.m3u8" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button type="submit" variant="destructive" disabled={isSubmitting} className="w-full">
                      {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                      Guardar URL de Streaming
                    </Button>
                  </form>
                </Form>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
