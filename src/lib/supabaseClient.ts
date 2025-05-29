
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
      const errorDetails: Record<string, any> = {
        logTimestamp: new Date().toISOString(),
        context: 'Supabase Storage upload failed.',
        errorType: typeof uploadError,
        isErrorInstance: uploadError instanceof Error,
      };

      if (uploadError && typeof uploadError === 'object') {
        const err = uploadError as any; // Cast to any to access potential properties
        errorDetails.constructorName = err.constructor?.name;
        
        // Explicitly try to access known properties of Supabase StorageError/ApiError
        errorDetails.supaMessage = err.message;
        errorDetails.supaName = err.name;
        errorDetails.supaStatus = err.status; // HTTP status code
        errorDetails.supaError = err.error; // Sometimes a short error code string
        errorDetails.supaErrorDescription = err.error_description; // More descriptive error
        errorDetails.supaStack = err.stack;
        
        errorDetails.enumerableProps = {};
        for (const key in err) {
          if (Object.prototype.hasOwnProperty.call(err, key)) {
            (errorDetails.enumerableProps as Record<string, any>)[key] = err[key];
          }
        }
        
        try {
          errorDetails.stringifiedRaw = JSON.stringify(uploadError);
        } catch (e) {
          errorDetails.stringifyRawError = (e as Error).message;
        }
        
        try {
          // Attempt to stringify with non-enumerable properties (if any)
          errorDetails.stringifiedWithOwnProps = JSON.stringify(uploadError, Object.getOwnPropertyNames(uploadError));
        } catch (e) {
          errorDetails.stringifyWithOwnPropsError = (e as Error).message;
        }

      } else {
        // If uploadError is not an object (e.g., a string or primitive)
        errorDetails.rawValue = uploadError;
      }

      console.error('--- Supabase Storage Upload Error Details ---', errorDetails);
      // Log the original object as well, as console's own formatting might sometimes reveal more
      console.error('Original uploadError object for direct console inspection:', uploadError);
      console.error('--- End of Supabase Storage Upload Error Details ---');

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
