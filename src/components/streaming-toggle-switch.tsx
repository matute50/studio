
"use client";

import * as React from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/hooks/use-toast';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Loader2, AlertTriangle, Cloud, Video } from 'lucide-react';
import Hls from 'hls.js';

const SETTING_ID = 1;

export function StreamingToggleSwitch() {
  const [isStreaming, setIsStreaming] = React.useState<boolean>(true);
  const [isAuto, setIsAuto] = React.useState<boolean>(false);
  const [isLoading, setIsLoading] = React.useState<boolean>(true);
  const [isChecking, setIsChecking] = React.useState<boolean>(false);
  const { toast } = useToast();

  React.useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;
    let isMounted = true;

    const checkStreamStatus = async (activeUrl: string): Promise<boolean> => {
      try {
        const url = new URL(activeUrl);
        const isYoutube = url.hostname.includes('youtube.com') || url.hostname.includes('youtu.be');

        if (isYoutube) {
          const res = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(activeUrl)}&format=json`);
          return res.ok;
        } else if (url.pathname.endsWith('.m3u8')) {
          return new Promise((resolve) => {
            const hls = new Hls();
            hls.loadSource(activeUrl);
            hls.on(Hls.Events.MANIFEST_PARSED, () => {
              hls.destroy();
              resolve(true);
            });
            hls.on(Hls.Events.ERROR, (event, data) => {
              if (data.fatal) {
                hls.destroy();
                resolve(false);
              }
            });
             setTimeout(() => {
              hls.destroy();
              resolve(false); 
            }, 5000);
          });
        }
        const response = await fetch(activeUrl, { method: 'HEAD', mode: 'no-cors' });
        return response.ok || response.type === 'opaque';
      } catch (e) {
        return false;
      }
    };
    
    const fetchAndCheck = async () => {
      if (!isMounted) return;
      setIsChecking(true);

      try {
        const { data: config, error: configError } = await supabase
          .from('stream-videos')
          .select('isAuto, stream')
          .eq('id', SETTING_ID)
          .single();

        if (configError && configError.code !== 'PGRST116') throw configError;

        const currentIsAuto = config?.isAuto ?? false;
        if (isMounted) setIsAuto(currentIsAuto);
        
        if (currentIsAuto) {
          const { data: activeStreamData, error: activeStreamError } = await supabase
            .from('streaming')
            .select('url')
            .eq('isActive', true)
            .single();

          if (activeStreamError) {
            if (isMounted) await updateStreamSetting(false, 'No active stream URL found.');
            return;
          }

          const isLive = await checkStreamStatus(activeStreamData.url);
          if (isMounted) await updateStreamSetting(isLive, `Stream is ${isLive ? 'live' : 'offline'}.`);
        } else {
           if (config && isMounted) {
               setIsStreaming(config.stream);
           }
        }
      } catch (error: any) {
        if (isMounted) {
            toast({
              title: "Error checking stream status",
              description: error.message,
              variant: "destructive",
            });
        }
      } finally {
        if (isMounted) {
            setIsLoading(false);
            setIsChecking(false);
        }
      }
    };

    const updateStreamSetting = async (newStatus: boolean, reason: string) => {
        const { data: currentData, error: fetchError } = await supabase
            .from('stream-videos')
            .select('stream')
            .eq('id', SETTING_ID)
            .single();

        if (fetchError && fetchError.code !== 'PGRST116') {
            console.error("Error fetching current stream status before update:", fetchError.message);
            return;
        }

        const currentStatus = currentData?.stream;
        if (currentStatus === newStatus) {
            console.log(`No update needed. Status is already ${newStatus}. Reason: ${reason}`);
            setIsStreaming(currentStatus ?? newStatus);
            return;
        }
        
      const { error } = await supabase
        .from('stream-videos')
        .update({ stream: newStatus })
        .eq('id', SETTING_ID);
      
      if (error) {
        toast({ title: "Auto-Update Failed", description: error.message, variant: "destructive" });
      } else {
        if (isMounted) setIsStreaming(newStatus);
        console.log(`Stream status auto-updated to ${newStatus}. Reason: ${reason}`);
      }
    };
    
    fetchAndCheck();
    intervalId = setInterval(fetchAndCheck, 20000);

    return () => {
      isMounted = false;
      if (intervalId) clearInterval(intervalId);
    };
  }, [toast]);


  const handleManualToggleChange = async (newStatus: boolean) => {
    setIsLoading(true);
    const previousStatus = isStreaming;
    setIsStreaming(newStatus); 

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
            onCheckedChange={handleManualToggleChange}
            disabled={isLoading || isAuto || isChecking}
            aria-label="Cambiar entre modo Streaming y Videos"
            className="w-[60px] h-[32px] data-[state=checked]:bg-destructive data-[state=unchecked]:bg-green-600 [&>span]:w-6 [&>span]:h-6 [&>span]:data-[state=checked]:translate-x-[28px]"
          />
          <Label htmlFor="streaming-toggle" className={`font-semibold transition-colors text-lg ${isStreaming ? 'text-destructive' : 'text-muted-foreground'}`}>
            STREAMING
          </Label>
        </div>
        {isAuto && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground p-1.5 bg-background rounded-md border">
                {isChecking ? <Loader2 className="h-3 w-3 animate-spin"/> : <Cloud className="h-3 w-3 text-blue-500" />}
                <span>Modo automático activado</span>
            </div>
        )}
    </div>
  );
}
