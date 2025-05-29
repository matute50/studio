
import { createClient } from '@supabase/supabase-js';

const supabaseUrlFromEnv = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKeyFromEnv = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const errors: string[] = [];

// Check Supabase URL
if (!supabaseUrlFromEnv || supabaseUrlFromEnv === 'YOUR_SUPABASE_URL_HERE' || supabaseUrlFromEnv === 'TU_SUPABASE_URL' || supabaseUrlFromEnv.trim() === '' || supabaseUrlFromEnv.toLowerCase() === 'undefined') {
  errors.push(`NEXT_PUBLIC_SUPABASE_URL (valor actual: "${supabaseUrlFromEnv}") falta, es un marcador de posición, está vacía, o es la cadena "undefined".`);
} else {
  try {
    // Attempt to parse the URL to catch basic structural issues (e.g., missing scheme)
    new URL(supabaseUrlFromEnv);
  } catch (e) {
    errors.push(`NEXT_PUBLIC_SUPABASE_URL (valor actual: "${supabaseUrlFromEnv}") no parece ser una URL válida. Error de formato: ${(e as Error).message}. Asegúrate de que incluya el esquema (ej. https://).`);
  }
}

// Check Supabase Anon Key
if (!supabaseAnonKeyFromEnv || supabaseAnonKeyFromEnv === 'YOUR_SUPABASE_ANON_KEY_HERE' || supabaseAnonKeyFromEnv === 'TU_SUPABASE_ANON_KEY' || supabaseAnonKeyFromEnv.trim() === '' || supabaseAnonKeyFromEnv.toLowerCase() === 'undefined') {
  errors.push(`NEXT_PUBLIC_SUPABASE_ANON_KEY (valor actual: "${supabaseAnonKeyFromEnv}") falta, es un marcador de posición, está vacía, o es la cadena "undefined".`);
}

if (errors.length > 0) {
  const fullErrorMessage = 'Error de configuración de Supabase: \n- ' + errors.join('\n- ') + '\n\nPor favor, actualiza tu archivo .env con tus credenciales reales y válidas de Supabase.';
  throw new Error(fullErrorMessage);
}

// If we've reached here, the checks passed.
// The non-null assertions (!) are safe due to the throw statement above.
export const supabase = createClient(supabaseUrlFromEnv!, supabaseAnonKeyFromEnv!);

// Helper to convert data URI to Blob
async function dataURIToBlob(dataURI: string): Promise<Blob> {
  const response = await fetch(dataURI);
  const blob = await response.blob();
  return blob;
}

export async function uploadImageToSupabase(
  dataURI: string,
  bucketName: string
): Promise<string | null> {
  try {
    const blob = await dataURIToBlob(dataURI);
    // Extract file extension from MIME type (e.g., "image/png" -> "png")
    const fileExt = blob.type.split('/')[1];
    if (!fileExt) {
        console.error('No se pudo determinar la extensión del archivo desde el tipo MIME:', blob.type);
        return null;
    }
    const fileName = `article_img_${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
    const filePath = `${fileName}`;

    const { data, error: uploadError } = await supabase.storage
      .from(bucketName)
      .upload(filePath, blob, {
        contentType: blob.type, // Pass content type for better handling
        cacheControl: '3600', // Cache for 1 hour
        upsert: false, // Do not overwrite if file exists (consider true if updates are common)
      });

    if (uploadError) {
      console.error('Supabase Storage upload failed. Raw error object:', uploadError);

      let detailedMessage = 'No se pudo determinar la causa específica del error de subida.';
      if (typeof uploadError === 'object' && uploadError !== null) {
        const errorAsAny = uploadError as any;
        if (errorAsAny.message && typeof errorAsAny.message === 'string') {
          detailedMessage = `Mensaje: ${errorAsAny.message}`;
          if (errorAsAny.name && typeof errorAsAny.name === 'string') {
            detailedMessage = `Error: ${errorAsAny.name}, ${detailedMessage}`;
          }
          if (errorAsAny.status && typeof errorAsAny.status === 'number') {
            detailedMessage += `, Estado HTTP: ${errorAsAny.status}`;
          }
        } else if (Object.keys(uploadError).length > 0) {
          try {
            detailedMessage = `Detalles del error: ${JSON.stringify(uploadError)}`;
          } catch (e) {
            detailedMessage = 'El objeto de error no pudo ser serializado a JSON, pero no estaba vacío.';
          }
        } else {
            detailedMessage = 'El objeto de error de subida estaba vacío o no contenía un mensaje legible.';
        }
      } else if (typeof uploadError === 'string') {
        detailedMessage = `Error de subida (string): ${uploadError}`;
      }
      
      console.error('Información detallada del error de subida:', detailedMessage);

      if ((uploadError as any)?.stack) {
        console.error('Stack trace del error de subida:', (uploadError as any).stack);
      }
      
      return null;
    }

    const { data: publicURLData } = supabase.storage
      .from(bucketName)
      .getPublicUrl(filePath);
    
    if (!publicURLData || !publicURLData.publicUrl) {
        console.error('No se pudo obtener la URL pública para la imagen subida.');
        // Attempt to clean up the uploaded file if URL retrieval fails
        await supabase.storage.from(bucketName).remove([filePath]);
        return null;
    }

    return publicURLData.publicUrl;
  } catch (error) {
    console.error('Error en la utilidad uploadImageToSupabase (bloque catch general):', error);
    if (error instanceof Error && error.message) {
      console.error('Mensaje del error general:', error.message);
    }
    return null;
  }
}
