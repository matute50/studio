
"use client";

import * as React from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/hooks/use-toast';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';

// This component assumes a table 'stream-videos' with:
// - id: number (Primary Key)
// - stream: boolean
// It operates on a single row where id = 1 for this global setting.
const SETTING_ID = 1; 

export function StreamingToggleSwitch() {
  const [isStreaming, setIsStreaming] = React.useState<boolean>(true);
  const [isLoading, setIsLoading] = React.useState<boolean>(true);
  const { toast } = useToast();

  React.useEffect(() => {
    const fetchStreamingStatus = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('stream-videos')
          .select('stream')
          .eq('id', SETTING_ID)
          .single();

        if (error) {
            if (error.code === 'PGRST116') { // "pg_listen: no rows found"
                console.warn(`Setting for stream-videos with id=${SETTING_ID} not found. Creating with default value (true).`);
                const { data: newData, error: insertError } = await supabase
                    .from('stream-videos')
                    .insert({ id: SETTING_ID, stream: true })
                    .select()
                    .single();
                if (insertError) throw insertError;
                setIsStreaming(newData.stream);
            } else {
                throw error;
            }
        } else if (data) {
            setIsStreaming(data.stream);
        }
      } catch (error: any) {
        toast({
          title: "Error al Cargar Estado",
          description: `No se pudo obtener el estado de Streaming/Videos: ${error.message}. Asegúrate que la tabla 'stream-videos' (con columnas 'id' (number) y 'stream' (boolean)) exista.`,
          variant: "destructive",
          duration: 10000,
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchStreamingStatus();
  }, [toast]);

  const handleToggleChange = async (newStatus: boolean) => {
    setIsLoading(true);
    const previousStatus = isStreaming;
    setIsStreaming(newStatus); // Optimistic UI update

    try {
      const { error } = await supabase
        .from('stream-videos')
        .update({ stream: newStatus })
        .eq('id', SETTING_ID);

      if (error) throw error;

      toast({
        title: "Estado Actualizado",
        description: `El modo se ha cambiado a ${newStatus ? 'STREAMING' : 'VIDEOS'}.`,
      });
    } catch (error: any) {
        // Revert optimistic update on error
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
    <div className="flex items-center justify-center space-x-4 p-2 bg-muted/50 rounded-lg w-full">
      <Label htmlFor="streaming-toggle" className={`font-semibold transition-colors text-lg ${!isStreaming ? 'text-accent-foreground' : 'text-muted-foreground'}`}>
        VIDEOS
      </Label>
      <Switch
        id="streaming-toggle"
        checked={isStreaming}
        onCheckedChange={handleToggleChange}
        disabled={isLoading}
        aria-label="Cambiar entre modo Streaming y Videos"
        className="w-[60px] h-[32px] data-[state=checked]:bg-primary data-[state=unchecked]:bg-accent [&>span]:w-6 [&>span]:h-6"
      />
      <Label htmlFor="streaming-toggle" className={`font-semibold transition-colors text-lg ${isStreaming ? 'text-primary' : 'text-muted-foreground'}`}>
        STREAMING
      </Label>
    </div>
  );
}
