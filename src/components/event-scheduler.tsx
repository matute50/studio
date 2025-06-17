
"use client";

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale'; 
import Link from 'next/link';

import type { CalendarEvent } from '@/types';

import { supabase } from '@/lib/supabaseClient';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Calendar } from '@/components/ui/calendar';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader as AlertDialogHeaderComponent, AlertDialogTitle as AlertDialogTitleComponent } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save, Trash2, CalendarDays, Edit3, ClockIcon, XCircle, Home } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Alert, AlertDescription as ShadcnAlertDescription, AlertTitle as ShadcnAlertTitle } from "@/components/ui/alert";

const eventSchema = z.object({
  name: z.string().min(3, { message: "El nombre debe tener al menos 3 caracteres." }).max(150, { message: "El nombre debe tener 150 caracteres o menos." }),
  eventDateTime: z.date({ 
    invalid_type_error: "La hora configurada no es válida.",
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

  const [calendarDates, setCalendarDates] = React.useState<Date[] | undefined>();
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
    const representativeDate = calendarDates && calendarDates.length > 0 ? calendarDates[0] : undefined;

    if (representativeDate) {
      const newDateTime = new Date(representativeDate);
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
  }, [calendarDates, eventHour, eventMinute, form]);


  const fetchEvents = async () => {
    setIsLoadingEvents(true);
    setErrorLoadingEvents(null);
    try {
      const twelveHoursAgo = new Date();
      twelveHoursAgo.setHours(twelveHoursAgo.getHours() - 12);

      const { data, error } = await supabase
        .from('eventos_calendario')
        .select('*')
        .gte('eventDateTime', twelveHoursAgo.toISOString()) 
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
    setCalendarDates(undefined);
    setEventHour("00");
    setEventMinute("00");
    setEditingEventId(null);
  };

  const onSubmit = async (data: EventFormValues) => {
    setIsSubmitting(true);
    const now = new Date().toISOString();

    try {
      if (editingEventId) {
        const eventPayload = {
          name: data.name,
          eventDateTime: data.eventDateTime.toISOString(), 
          updatedAt: now,
        };

        const { data: updatedData, error: updateError } = await supabase
          .from('eventos_calendario')
          .update(eventPayload)
          .eq('id', editingEventId)
          .select()
          .single();
        if (updateError) throw updateError;
        toast({ title: "¡Evento Actualizado!", description: `El evento "${updatedData?.name}" ha sido actualizado.` });
      } else {
        if (!calendarDates || calendarDates.length === 0) {
          toast({
            title: "Error de Validación",
            description: "Por favor, selecciona al menos una fecha en el calendario.",
            variant: "destructive",
          });
          setIsSubmitting(false);
          return;
        }

        const eventsToCreate = calendarDates.map(date => {
          const eventSpecificDateTime = new Date(date);
          const hour = parseInt(eventHour, 10);
          const minute = parseInt(eventMinute, 10);

          eventSpecificDateTime.setHours(isNaN(hour) ? 0 : hour);
          eventSpecificDateTime.setMinutes(isNaN(minute) ? 0 : minute);
          eventSpecificDateTime.setSeconds(0);
          eventSpecificDateTime.setMilliseconds(0);

          return {
            name: data.name,
            eventDateTime: eventSpecificDateTime.toISOString(),
            createdAt: now,
            updatedAt: now,
          };
        });
        
        const { data: insertedData, error: insertError } = await supabase
          .from('eventos_calendario')
          .insert(eventsToCreate)
          .select();

        if (insertError) throw insertError;
        
        const numCreated = insertedData?.length || 0;
        toast({ 
          title: "¡Eventos Guardados!", 
          description: `${numCreated} evento${numCreated === 1 ? '' : 's'} "${data.name}" ha${numCreated === 1 ? ' sido' : 'n sido'} programado${numCreated === 1 ? '' : 's'}.` 
        });
      }
      fetchEvents();
      resetFormAndDateTimePickers();
    } catch (error: any) {
      toast({
        title: "Error al Guardar",
        description: `No se pudo guardar el evento/los eventos: ${error.message || 'Error desconocido'}. Revisa los logs de Supabase.`,
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
    setCalendarDates([dt]); 
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
      toast({ title: "Error al Eliminar", description: `No se pudo eliminar el evento: ${error.message || 'Error desconocido'}.`, variant: "destructive" });
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
      <header className="flex flex-col sm:flex-row items-center justify-center text-center mb-8 gap-3 sm:gap-4">
        <h1 className="text-4xl font-bold tracking-tight text-primary uppercase">Agenda de Eventos</h1>
      </header>
      <div className="mb-6 text-left">
        <Link href="/" passHref legacyBehavior>
          <Button variant="default" size="sm">
            <Home className="mr-2 h-4 w-4" />
            Volver al Inicio
          </Button>
        </Link>
      </div>

      <div className="grid lg:grid-cols-3 gap-8 items-start">
        <Card className="lg:col-span-1 shadow-xl" ref={editorFormCardRef}>
          <CardContent className="pt-6"> 
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nombre del Evento</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="eventDateTime"
                  render={() => ( 
                    <FormItem className="space-y-3">
                      <FormLabel>Fecha(s) y Hora del Evento</FormLabel>
                      <Calendar
                        mode="multiple"
                        selected={calendarDates}
                        onSelect={setCalendarDates}
                        className="rounded-md border self-center shadow-sm"
                        disabled={(date) => date < new Date(new Date().setHours(0,0,0,0))} 
                        locale={es}
                        footer={
                            calendarDates && calendarDates.length > 0 ? (
                                <p className="text-xs text-muted-foreground pt-2 text-center">
                                {calendarDates.length} fecha{calendarDates.length === 1 ? '' : 's'} seleccionada{calendarDates.length === 1 ? '' : 's'}.
                                </p>
                            ) : (
                                <p className="text-xs text-muted-foreground pt-2 text-center">Selecciona una o más fechas.</p>
                            )
                        }
                      />
                       <div className="p-3 border rounded-md bg-muted/50 shadow-sm">
                        <FormLabel className="text-sm font-medium mb-2 block text-center">Hora del Evento</FormLabel>
                        <div className="flex items-center justify-center gap-2">
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
                            <span className="font-semibold text-muted-foreground">:</span>
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
                      {form.formState.errors.eventDateTime && (
                        <FormMessage>{form.formState.errors.eventDateTime.message}</FormMessage>
                      )}
                    </FormItem>
                  )}
                />
                
                <div className="flex flex-col sm:flex-row gap-2 pt-2">
                    <Button type="submit" variant="destructive" disabled={isSubmitting} className="w-full sm:flex-1">
                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    {editingEventId ? "Actualizar Evento" : "Guardar Evento(s)"}
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
          <h2 className="text-2xl font-semibold text-foreground mb-4 uppercase">Eventos Programados</h2>
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
          {!isLoadingEvents && !errorLoadingEvents && events.map((event, index) => (
            <Card key={event.id} className="shadow-md hover:shadow-lg transition-shadow">
              <CardHeader className="pb-3 pt-4 px-4">
                <CardTitle className="text-lg font-semibold break-words uppercase">
                   <span className="text-primary mr-2">{index + 1}.</span>
                  {event.name}
                </CardTitle>
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
          <AlertDialogHeaderComponent>
            <AlertDialogTitleComponent>¿ESTÁS SEGURO DE ELIMINAR ESTE EVENTO?</AlertDialogTitleComponent>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. El evento "{eventToDelete?.name || 'seleccionado'}" será eliminado permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeaderComponent>
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
    
