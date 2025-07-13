
"use client";

import * as React from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/hooks/use-toast';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';

const SETTING_ID = 1;

export function StreamingToggleSwitch() {
  const [isStreaming, setIsStreaming] = React.useState<boolean>(true);
  const [isLoading, setIsLoading] = React.useState<boolean>(true);
  const { toast } = useToast();

  React.useEffect(() => {
    let isMounted = true;

    const fetchInitialStatus = async () => {
      if (!isMounted) return;
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('stream-videos')
          .select('stream')
          .eq('id', SETTING_ID)
          .single();

        if (error && error.code !== 'PGRST116') { // PGRST116 means no rows found
          throw error;
        }

        if (isMounted) {
          // If no row exists, default to 'true' (streaming) or as per your logic
          setIsStreaming(data?.stream ?? true);
        }
      } catch (error: any) {
        if (isMounted) {
          toast({
            title: "Error al cargar estado del stream",
            description: `No se pudo obtener el estado inicial: ${error.message}`,
            variant: "destructive",
          });
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchInitialStatus();

    return () => {
      isMounted = false;
    };
  }, [toast]);


  const handleToggleChange = async (newStatus: boolean) => {
    setIsLoading(true);
    const previousStatus = isStreaming;
    setIsStreaming(newStatus); 

    try {
      const { data, error } = await supabase
        .from('stream-videos')
        .upsert({ id: SETTING_ID, stream: newStatus }, { onConflict: 'id' })
        .select()
        .single();


      if (error) throw error;

      toast({
        title: "Estado Actualizado",
        description: `El modo se ha cambiado a ${newStatus ? 'STREAMING' : 'VIDEOS'}.`,
      });
      setIsStreaming(data.stream);
    } catch (error: any) {
        setIsStreaming(previousStatus);
        toast({
          title: "Error al Actualizar",
          description: `No se pudo cambiar el estado: ${error.message}`,
          variant: "destructive",
        });
    } finally {
        setIsLoading(false);
    }
  };


  if (isLoading) {
    return (
      <div className="flex items-center justify-center space-x-2 h-10 w-full">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="text-sm text-muted-foreground">Cargando...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center space-y-2 w-full">
        <div className="flex items-center justify-center space-x-4 p-2 bg-muted/50 rounded-lg w-full">
          <Label htmlFor="streaming-toggle" className={`font-semibold transition-colors text-lg ${!isStreaming ? 'text-green-600' : 'text-muted-foreground'}`}>
            VIDEOS
          </Label>
          <Switch
            id="streaming-toggle"
            checked={isStreaming}
            onCheckedChange={handleToggleChange}
            disabled={isLoading}
            aria-label="Cambiar entre modo Streaming y Videos"
            className="w-[60px] h-[32px] data-[state=checked]:bg-destructive data-[state=unchecked]:bg-green-600 [&>span]:w-6 [&>span]:h-6 [&>span]:data-[state=checked]:translate-x-[28px]"
          />
          <Label htmlFor="streaming-toggle" className={`font-semibold transition-colors text-lg ${isStreaming ? 'text-destructive' : 'text-muted-foreground'}`}>
            STREAMING
          </Label>
        </div>
    </div>
  );
}
