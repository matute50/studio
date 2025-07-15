"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import Image from "next/image";
import { supabase, uploadImageToSupabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Upload, ImageOff, Trash2 } from "lucide-react";

const BUCKET_NAME = "header-images";

const formSchema = z.object({
  title: z.string().min(3, {
    message: "El título debe tener al menos 3 caracteres",
  }),
  imageUrl: z.string().min(1, {
    message: "Debes subir una imagen",
  }),
  imageFile: z.instanceof(File).optional(),
});

type FormValues = z.infer<typeof formSchema>;

export function HeaderImageManager() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = React.useState(false);
  const [previewImage, setPreviewImage] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      imageUrl: "",
      imageFile: undefined,
    },
  });

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast({
        title: "Tipo de archivo no válido",
        description: "Por favor, sube un archivo de imagen",
        variant: "destructive",
      });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "Archivo demasiado grande",
        description: "El tamaño máximo permitido es 5MB",
        variant: "destructive",
      });
      return;
    }

    form.setValue("imageFile", file);
    const reader = new FileReader();
    reader.onload = () => {
      setPreviewImage(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const onSubmit = async (values: FormValues) => {
    setIsLoading(true);
    try {
      let imageUrl = values.imageUrl;

      if (values.imageFile) {
        const reader = new FileReader();
        const imageBase64 = await new Promise<string>((resolve, reject) => {
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(values.imageFile!);
        });

        const { url, errorMessage } = await uploadImageToSupabase(
          imageBase64,
          BUCKET_NAME
        );

        if (!url) {
          throw new Error(errorMessage || "Error al subir la imagen");
        }
        imageUrl = url;
      }

      const { error } = await supabase
        .from("header_images")
        .upsert({
          title: values.title,
          image_url: imageUrl,
          updated_at: new Date().toISOString(),
        });

      if (error) throw error;

      toast({
        title: "¡Éxito!",
        description: "La imagen del encabezado se ha guardado correctamente",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Ocurrió un error al guardar",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Título</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="imageUrl"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Imagen</FormLabel>
                <div className="flex items-center gap-4">
                  <FormControl>
                    <Input
                      {...field}
                      type="hidden"
                      value={previewImage || field.value}
                    />
                  </FormControl>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    Seleccionar imagen
                  </Button>
                  <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept="image/*"
                    onChange={handleFileChange}
                  />
                  {(previewImage || form.watch("imageUrl")) && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setPreviewImage(null);
                        form.resetField("imageUrl");
                        form.resetField("imageFile");
                        if (fileInputRef.current) {
                          fileInputRef.current.value = "";
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
                <FormMessage />
              </FormItem>
            )}
          />

          {(previewImage || form.watch("imageUrl")) && (
            <div className="relative w-full h-64 rounded-md overflow-hidden border">
              <Image
                src={previewImage || form.watch("imageUrl")}
                alt="Vista previa"
                fill
                className="object-cover"
                onError={() => {
                  setPreviewImage(null);
                  form.resetField("imageUrl");
                }}
              />
            </div>
          )}

          <Button type="submit" disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Guardar cambios
          </Button>
        </form>
      </Form>
    </div>
  );
}