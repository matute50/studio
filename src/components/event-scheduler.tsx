"use client";

import { useForm } from "react-hook-form";
import { Calendar } from "@/components/ui/calendar";
import { es } from "date-fns/locale";

export default function EventScheduler() {
  const form = useForm();

  return (
    <div className="container mx-auto px-4 py-8">
      <header className="flex flex-col sm:flex-row items-center justify-center text-center mb-8 gap-3 sm:gap-4">
        <h1 className="text-4xl font-bold tracking-tight text-primary uppercase">Agenda de Eventos</h1>
      </header>

      <Calendar
        mode="multiple"
        selected={[]}
        onSelect={(date) => {
          // lógica para manejar fechas seleccionadas
        }}
        className="rounded-md border"
        disabled={() => false}
        locale={es}
        footer={<div className="text-sm text-muted-foreground">Selecciona una fecha</div>}
      />
    </div>
  );
}
