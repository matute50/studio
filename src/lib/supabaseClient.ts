
import { createClient } from '@supabase/supabase-js';

const supabaseUrlFromEnv = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKeyFromEnv = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const errors: string[] = [];

// Check Supabase URL
if (!supabaseUrlFromEnv || supabaseUrlFromEnv === 'YOUR_SUPABASE_URL_HERE' || supabaseUrlFromEnv === 'TU_SUPABASE_URL' || supabaseUrlFromEnv.trim() === '' || supabaseUrlFromEnv.toLowerCase() === 'undefined') {
  errors.push(`NEXT_PUBLIC_SUPABASE_URL (valor actual: "${supabaseUrlFromEnv}") falta, es un marcador de posición, está vacía, o es la cadena "undefined".`);
} else {
  try {
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
        contentType: blob.type,
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      console.error("--- Supabase Storage Upload Error ---");
      console.error("Raw uploadError object:", uploadError);
      console.error("typeof uploadError:", typeof uploadError);
      console.error("uploadError instanceof Error:", uploadError instanceof Error);

      try {
        console.error("JSON.stringify(uploadError, null, 2):", JSON.stringify(uploadError, null, 2));
      } catch (e) {
        console.error("Could not stringify uploadError (direct stringify):", e);
      }
      
      try {
        console.error("JSON.stringify(uploadError with own props, null, 2):", JSON.stringify(uploadError, Object.getOwnPropertyNames(uploadError), 2));
      } catch (e) {
        console.error("Could not stringify uploadError (with own props):", e);
      }

      const err = uploadError as any; // Cast to any to access potential properties
      console.error("uploadError.message:", String(err.message));
      console.error("uploadError.name:", String(err.name));
      console.error("uploadError.status (often statusCode for StorageError):", String(err.status));
      console.error("uploadError.statusCode:", String(err.statusCode));
      console.error("uploadError.error (often a short code string):", String(err.error));
      console.error("uploadError.error_description:", String(err.error_description));
      console.error("uploadError.stack:", String(err.stack));

      const enumerableKeys: string[] = [];
      if (err && typeof err === 'object') {
        for (const key in err) {
          if (Object.prototype.hasOwnProperty.call(err, key)) {
            enumerableKeys.push(key);
          }
        }
      }
      console.error("Enumerable keys in uploadError:", enumerableKeys.length > 0 ? enumerableKeys.join(', ') : 'None');
      
      try {
        if (err && typeof err === 'object') {
          console.error("Own property names in uploadError:", Object.getOwnPropertyNames(err).join(', '));
        } else {
          console.error("Cannot get own property names, uploadError is not a suitable object.");
        }
      } catch(e) {
        console.error("Error getting own property names for uploadError:", e);
      }
      console.error("--- End of Supabase Storage Upload Error Details ---");
      return null;
    }

    const { data: publicURLData } = supabase.storage
      .from(bucketName)
      .getPublicUrl(filePath);
    
    if (!publicURLData || !publicURLData.publicUrl) {
        console.error('No se pudo obtener la URL pública para la imagen subida.');
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
