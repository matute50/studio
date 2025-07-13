
"use client";

import * as React from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/hooks/use-toast';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import type { StreamVideosToggle } from '@/types';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';

const SETTING_ID = 1;
const CHECK_INTERVAL = 15000; // 15 seconds

async function checkStreamStatus(url: string): Promise<boolean> {
  if (!url) return false;
  try {
    const isYoutube = /youtu\.?be/.test(url);
    if (isYoutube) {
      // For YouTube, we can check if the video metadata is available (oEmbed is a good proxy)
      const oEmbedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
      const response = await fetch(oEmbedUrl);
      return response.ok;
    } else {
      // For HLS/other streams, a HEAD request can check for server availability without downloading content
      const response = await fetch(url, { method: 'HEAD', mode: 'cors' });
      return response.ok;
    }
  } catch (error) {
    console.error(`Error checking stream status for ${url}:`, error);
    return false;
  }
}

export function StreamingToggleSwitch() {
  const [settings, setSettings] = React.useState<StreamVideosToggle | null>(null);
  const [isLoading, setIsLoading] = React.useState<boolean>(true);
  const [isUpdatingManual, setIsUpdatingManual] = React.useState<boolean>(false);
  const { toast } = useToast();
  const intervalRef = React.useRef<NodeJS.Timeout | null>(null);

  const fetchAndSetSettings = React.useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('stream-videos')
        .select('*')
        .eq('id', SETTING_ID)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }
      
      const currentSettings = data || { id: SETTING_ID, stream: true, isAuto: false };
      setSettings(currentSettings);
      return currentSettings;

    } catch (error: any) {
      toast({
        title: "Error al cargar estado del stream",
        description: `No se pudo obtener el estado inicial: ${error.message}`,
        variant: "destructive",
      });
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const runAutomaticCheck = React.useCallback(async () => {
    const { data: activeStreamData, error: streamError } = await supabase
      .from('streaming')
      .select('url')
      .eq('isActive', true)
      .single();

    if (streamError && streamError.code !== 'PGRST116') {
      console.error("Error fetching active stream URL:", streamError.message);
      return;
    }

    const isLive = activeStreamData ? await checkStreamStatus(activeStreamData.url) : false;

    setSettings(prevSettings => {
      if (prevSettings && prevSettings.stream !== isLive) {
        const updateStreamStatus = async () => {
          const { error: updateError } = await supabase
            .from('stream-videos')
            .update({ stream: isLive })
            .eq('id', SETTING_ID);

          if (updateError) {
            console.error("Error updating stream status automatically:", updateError.message);
          } else {
            toast({
              title: "Modo Automático",
              description: `El estado del stream se actualizó a ${isLive ? 'STREAMING' : 'VIDEOS'}.`,
            });
          }
        };
        updateStreamStatus();
        return { ...prevSettings, stream: isLive };
      }
      return prevSettings;
    });

  }, [toast]);


  React.useEffect(() => {
    const initialize = async () => {
        const initialSettings = await fetchAndSetSettings();
        if (initialSettings?.isAuto) {
            runAutomaticCheck();
            if (intervalRef.current) clearInterval(intervalRef.current);
            intervalRef.current = setInterval(runAutomaticCheck, CHECK_INTERVAL);
        }
    };

    initialize();

    return () => {
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
        }
    };
  }, [fetchAndSetSettings, runAutomaticCheck, settings?.isAuto]);

  const handleManualToggleChange = async (newStatus: boolean) => {
    if (!settings || settings.isAuto) return;
    setIsUpdatingManual(true);
    const previousStatus = settings.stream;
    setSettings(prev => prev ? { ...prev, stream: newStatus } : null);

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
        setSettings(prev => prev ? { ...prev, stream: previousStatus } : null);
        toast({
          title: "Error al Actualizar",
          description: `No se pudo cambiar el estado: ${error.message}`,
          variant: "destructive",
        });
    } finally {
        setIsUpdatingManual(false);
    }
  };
  
  const handleAutoToggleChange = async (isAutoChecked: boolean) => {
    setIsLoading(true);
    const { error } = await supabase
        .from('stream-videos')
        .update({ isAuto: isAutoChecked })
        .eq('id', SETTING_ID);
        
    if (error) {
        toast({ title: "Error", description: `No se pudo cambiar al modo ${isAutoChecked ? 'automático' : 'manual'}.`, variant: "destructive"});
    } else {
        toast({ title: "Modo Cambiado", description: `Sistema en modo ${isAutoChecked ? 'automático' : 'manual'}.`});
        setSettings(prev => prev ? { ...prev, isAuto: isAutoChecked } : null);
        if (isAutoChecked) {
            runAutomaticCheck(); // Run check immediately on switching to auto
        }
    }
    setIsLoading(false);
  };

  if (isLoading || !settings) {
    return (
      <div className="flex flex-col items-center justify-center space-y-2 h-20 w-full">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="text-sm text-muted-foreground">Cargando configuración...</span>
      </div>
    );
  }

  const isSwitchDisabled = isLoading || isUpdatingManual || settings.isAuto;

  return (
    <div className="flex flex-col items-center justify-center space-y-3 w-full">
        <div className="flex items-center justify-center space-x-4 p-2 bg-muted/50 rounded-lg w-full">
          <Label htmlFor="streaming-toggle" className={`font-semibold transition-colors text-lg ${!settings.stream ? 'text-green-600' : 'text-muted-foreground'}`}>
            VIDEOS
          </Label>
          <Switch
            id="streaming-toggle"
            checked={settings.stream}
            onCheckedChange={handleManualToggleChange}
            disabled={isSwitchDisabled}
            aria-label="Cambiar entre modo Streaming y Videos"
            className="w-[60px] h-[32px] data-[state=checked]:bg-destructive data-[state=unchecked]:bg-green-600 [&>span]:w-6 [&>span]:h-6 [&>span]:data-[state=checked]:translate-x-[28px]"
          />
          <Label htmlFor="streaming-toggle" className={`font-semibold transition-colors text-lg ${settings.stream ? 'text-destructive' : 'text-muted-foreground'}`}>
            STREAMING
          </Label>
        </div>
        <div className={cn(
            "flex items-center space-x-2 border border-dashed p-2 rounded-md transition-colors",
            settings.isAuto && "bg-destructive text-destructive-foreground border-destructive-foreground/50"
          )}>
            <Checkbox 
                id="auto-mode" 
                checked={settings.isAuto}
                onCheckedChange={(checked) => handleAutoToggleChange(Boolean(checked))}
                disabled={isLoading || isUpdatingManual}
                className={cn(settings.isAuto && "border-destructive-foreground data-[state=checked]:bg-destructive-foreground data-[state=checked]:text-destructive")}
            />
            <Label htmlFor="auto-mode" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                Automático
            </Label>
        </div>
        {settings.isAuto && (
            <p className="text-xs text-muted-foreground text-center">
                Modo automático activado. El sistema ajustará el estado cada 15 seg.
            </p>
        )}
    </div>
  );
}
