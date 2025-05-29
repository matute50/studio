
"use client";

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import type { CalendarEvent } from '@/types';

import { supabase } from '@/lib/supabaseClient';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save, Trash2, CalendarDays, Edit3, ClockIcon, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Alert, AlertDescription as ShadcnAlertDescription, AlertTitle as ShadcnAlertTitle } from "@/components/ui/alert";

const eventSchema = z.object({
  name: z.string().min(3, { message: "El nombre debe tener al menos 3 caracteres." }).max(150, { message: "El nombre debe tener 150 caracteres o menos." }),
  eventDateTime: z.date({
    required_error: "Por favor, selecciona una fecha y hora.",
    invalid_type_error: "Fecha y hora no válidas.",
  }),
});

type EventFormValues = z.infer<typeof eventSchema>;

const hourOptions = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'));
const minuteOptions = Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, '0'));

export function EventScheduler() {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [events, setEvents] = React.useState<CalendarEvent[]>([]);
  const [isLoadingEvents, setIsLoadingEvents] = React.useState(true);
  const [errorLoadingEvents, setErrorLoadingEvents] = React.useState<string | null>(null);

  const [editingEventId, setEditingEventId] = React.useState<string | null>(null);
  const [showDeleteConfirmDialog, setShowDeleteConfirmDialog] = React.useState(false);
  const [eventToDelete, setEventToDelete] = React.useState<CalendarEvent | null>(null);
  const editorFormCardRef = React.useRef<HTMLDivElement>(null);

  const [calendarDate, setCalendarDate] = React.useState<Date | undefined>();
  const [eventHour, setEventHour] = React.useState<string>("00");
  const [eventMinute, setEventMinute] = React.useState<string>("00");


  const form = useForm<EventFormValues>({
    resolver: zodResolver(eventSchema),
    defaultValues: {
      name: '',
      eventDateTime: undefined,
    },
    mode: "onChange",
  });

  React.useEffect(() => {
    if (calendarDate) {
      const newDateTime = new Date(calendarDate);
      const hour = parseInt(eventHour, 10);
      const minute = parseInt(eventMinute, 10);
      
      if (!isNaN(hour) && hour >= 0 && hour <= 23) {
        newDateTime.setHours(hour);
      } else {
        newDateTime.setHours(0); 
      }
      if (!isNaN(minute) && minute >= 0 && minute <= 59) {
        newDateTime.setMinutes(minute);
      } else {
        newDateTime.setMinutes(0); 
      }
      newDateTime.setSeconds(0);
      newDateTime.setMilliseconds(0);
      form.setValue('eventDateTime', newDateTime, { shouldValidate: true, shouldDirty: true });
    } else {
      form.setValue('eventDateTime', undefined, { shouldValidate: true, shouldDirty: true });
    }
  }, [calendarDate, eventHour, eventMinute, form]);


  const fetchEvents = async () => {
    setIsLoadingEvents(true);
    setErrorLoadingEvents(null);
    try {
      const { data, error } = await supabase
        .from('eventos_calendario')
        .select('*')
        .order('eventDateTime', { ascending: true });

      if (error) throw error;
      setEvents(data || []);
    } catch (error: any) {
      const description = `No se pudieron cargar los eventos: ${error.message || 'Error desconocido'}. Verifica la consola y los logs de Supabase. Asegúrate de que la tabla 'eventos_calendario' exista y tenga RLS configuradas.`;
      setErrorLoadingEvents(description);
      toast({
        title: "Error al Cargar Eventos",
        description,
        variant: "destructive",
      });
    } finally {
      setIsLoadingEvents(false);
    }
  };

  React.useEffect(() => {
    fetchEvents();
  }, []);

  const resetFormAndDateTimePickers = () => {
    form.reset({ name: '', eventDateTime: undefined });
    setCalendarDate(undefined);
    setEventHour("00");
    setEventMinute("00");
    setEditingEventId(null);
  };

  const onSubmit = async (data: EventFormValues) => {
    setIsSubmitting(true);
    const now = new Date().toISOString();
    const eventPayload = {
      name: data.name,
      eventDateTime: data.eventDateTime.toISOString(),
      updatedAt: now,
    };

    try {
      if (editingEventId) {
        const { data: updatedData, error: updateError } = await supabase
          .from('eventos_calendario')
          .update(eventPayload)
          .eq('id', editingEventId)
          .select()
          .single();
        if (updateError) throw updateError;
        toast({ title: "¡Evento Actualizado!", description: `El evento "${updatedData?.name}" ha sido actualizado.` });
      } else {
        const payloadWithCreation = { ...eventPayload, createdAt: now };
        const { data: insertedData, error: insertError } = await supabase
          .from('eventos_calendario')
          .insert([payloadWithCreation])
          .select()
          .single();
        if (insertError) throw insertError;
        toast({ title: "¡Evento Guardado!", description: `El evento "${insertedData?.name}" ha sido programado.` });
      }
      fetchEvents();
      resetFormAndDateTimePickers();
    } catch (error: any) {
      let description = "No se pudo guardar el evento. Inténtalo de nuevo.";
      if (error?.message) description = `Error: ${error.message}`;
      toast({
        title: "Error al Guardar Evento",
        description: `${description} Revisa la consola y los logs de Supabase.`,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (eventToEdit: CalendarEvent) => {
    if (!eventToEdit.id) return;
    setEditingEventId(eventToEdit.id);
    const dt = parseISO(eventToEdit.eventDateTime);
    form.reset({
      name: eventToEdit.name,
      eventDateTime: dt,
    });
    setCalendarDate(dt);
    setEventHour(dt.getHours().toString().padStart(2, '0'));
    setEventMinute(dt.getMinutes().toString().padStart(2, '0'));
    editorFormCardRef.current?.scrollIntoView({ behavior: 'smooth' });
    toast({ title: "Modo Edición", description: `Editando evento: ${eventToEdit.name}` });
  };

  const cancelEdit = () => {
    resetFormAndDateTimePickers();
    toast({ title: "Edición Cancelada" });
  };

  const handleDelete = (event: CalendarEvent) => {
    if (!event.id) return;
    setEventToDelete(event);
    setShowDeleteConfirmDialog(true);
  };

  const confirmDelete = async () => {
    if (!eventToDelete || !eventToDelete.id) return;
    setIsSubmitting(true);
    try {
      const { error: deleteError } = await supabase
        .from('eventos_calendario')
        .delete()
        .eq('id', eventToDelete.id);
      if (deleteError) throw deleteError;
      toast({ title: "Evento Eliminado", description: `El evento "${eventToDelete.name}" ha sido eliminado.` });
      fetchEvents();
      if (editingEventId === eventToDelete.id) {
        cancelEdit();
      }
    } catch (error: any) {
      let description = "No se pudo eliminar el evento.";
      if (error?.message) description = `Error: ${error.message}`;
      toast({ title: "Error al Eliminar", description, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
      setShowDeleteConfirmDialog(false);
      setEventToDelete(null);
    }
  };

  const formatDateTimeForDisplay = (isoDateString?: string) => {
    if (!isoDateString) return 'Fecha no especificada';
    try {
      return format(parseISO(isoDateString), "PPPp", { locale: es });
    } catch (e) {
      return 'Fecha inválida';
    }
  };
  

  return (
    <div className="container mx-auto px-4 py-8">
      <header className="mb-8 text-center">
        <h1 className="text-4xl font-bold tracking-tight text-primary">Agenda de Eventos</h1>
        <p className="text-muted-foreground">Programa y gestiona tus próximos eventos.</p>
      </header>

      <div className="grid lg:grid-cols-3 gap-8 items-start">
        <Card className="lg:col-span-1 shadow-xl" ref={editorFormCardRef}>
          <CardHeader>
            <CardTitle>{editingEventId ? "Editar Evento" : "Programar Nuevo Evento"}</CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nombre del Evento</FormLabel>
                      <FormControl>
                        <Input placeholder="Ej: Conferencia Anual" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="eventDateTime"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Fecha y Hora del Evento</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant={"outline"}
                              className={cn(
                                "w-full pl-3 text-left font-normal",
                                !field.value && "text-muted-foreground"
                              )}
                            >
                              {field.value ? (
                                format(field.value, "PPP HH:mm", { locale: es })
                              ) : (
                                <span>Elige fecha y hora</span>
                              )}
                              <CalendarDays className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={calendarDate}
                            onSelect={setCalendarDate}
                            initialFocus
                          />
                           <div className="p-3 border-t border-border">
                            <FormLabel className="text-sm font-medium mb-2 block">Hora del Evento</FormLabel>
                            <div className="flex items-center gap-2">
                                <Select value={eventHour} onValueChange={setEventHour}>
                                  <SelectTrigger className="w-[80px]">
                                    <SelectValue placeholder="HH" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {hourOptions.map(hour => (
                                      <SelectItem key={hour} value={hour}>{hour}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <span>:</span>
                                <Select value={eventMinute} onValueChange={setEventMinute}>
                                  <SelectTrigger className="w-[80px]">
                                    <SelectValue placeholder="MM" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {minuteOptions.map(minute => (
                                      <SelectItem key={minute} value={minute}>{minute}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                            </div>
                          </div>
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <div className="flex flex-col sm:flex-row gap-2 pt-2">
                    <Button type="submit" disabled={isSubmitting} className="w-full sm:flex-1">
                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    {editingEventId ? "Actualizar Evento" : "Guardar Evento"}
                    </Button>
                    {editingEventId && (
                    <Button type="button" variant="outline" onClick={cancelEdit} className="w-full sm:w-auto">
                        <XCircle className="mr-2 h-4 w-4" />
                        Cancelar Edición
                    </Button>
                    )}
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>

        <div className="lg:col-span-2 space-y-4 max-h-[calc(100vh-15rem)] overflow-y-auto pr-2">
          <h2 className="text-2xl font-semibold text-foreground mb-4">Eventos Programados</h2>
          {isLoadingEvents && (
            <div className="flex justify-center items-center py-10">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="ml-2 text-muted-foreground">Cargando eventos...</p>
            </div>
          )}
          {errorLoadingEvents && (
             <Alert variant="destructive">
               <CalendarDays className="h-4 w-4" />
               <ShadcnAlertTitle>Error al Cargar Eventos</ShadcnAlertTitle>
               <ShadcnAlertDescription>{errorLoadingEvents}</ShadcnAlertDescription>
             </Alert>
          )}
          {!isLoadingEvents && !errorLoadingEvents && events.length === 0 && (
            <div className="text-center py-10 border-2 border-dashed border-muted-foreground/30 rounded-lg">
              <CalendarDays className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
              <p className="text-muted-foreground">No hay eventos programados.</p>
              <p className="text-sm text-muted-foreground">Usa el formulario para añadir tu primer evento.</p>
            </div>
          )}
          {!isLoadingEvents && !errorLoadingEvents && events.map((event) => (
            <Card key={event.id} className="shadow-md hover:shadow-lg transition-shadow">
              <CardHeader className="pb-3 pt-4 px-4">
                <CardTitle className="text-lg font-semibold break-words">{event.name}</CardTitle>
              </CardHeader>
              <CardContent className="pb-3 pt-0 px-4">
                <div className="flex items-center text-sm text-muted-foreground">
                  <ClockIcon className="mr-2 h-4 w-4" />
                  <span>{formatDateTimeForDisplay(event.eventDateTime)}</span>
                </div>
                 <p className="text-xs text-muted-foreground/80 mt-1">Creado: {formatDateTimeForDisplay(event.createdAt)}</p>
              </CardContent>
              <CardFooter className="text-xs text-muted-foreground pt-1 pb-3 px-4 flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => handleEdit(event)} disabled={isSubmitting} className="h-8 px-3 text-xs">
                  <Edit3 className="mr-1.5 h-3.5 w-3.5" /> Editar
                </Button>
                <Button variant="destructive" size="sm" onClick={() => handleDelete(event)} disabled={isSubmitting} className="h-8 px-3 text-xs">
                  <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Eliminar
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      </div>

      <AlertDialog open={showDeleteConfirmDialog} onOpenChange={setShowDeleteConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Estás seguro de eliminar este evento?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. El evento "{eventToDelete?.name || 'seleccionado'}" será eliminado permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setShowDeleteConfirmDialog(false); setEventToDelete(null); }}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={isSubmitting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Eliminar Evento
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

