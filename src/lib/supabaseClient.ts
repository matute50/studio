
import { createClient } from '@supabase/supabase-js';

const supabaseUrlFromEnv = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKeyFromEnv = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const errors: string[] = [];

if (!supabaseUrlFromEnv || supabaseUrlFromEnv === 'YOUR_SUPABASE_URL_HERE' || supabaseUrlFromEnv === 'TU_SUPABASE_URL' || supabaseUrlFromEnv.trim() === '' || supabaseUrlFromEnv.toLowerCase() === 'undefined') {
  errors.push(`NEXT_PUBLIC_SUPABASE_URL (valor actual: "${supabaseUrlFromEnv}") falta, es un marcador de posición, está vacía, o es la cadena "undefined".`);
} else {
  try {
    new URL(supabaseUrlFromEnv);
  } catch (e: any) {
    errors.push(`NEXT_PUBLIC_SUPABASE_URL (valor actual: "${supabaseUrlFromEnv}") no parece ser una URL válida. Error de formato: ${e.message}. Asegúrate de que incluya el esquema (ej. https://).`);
  }
}

if (!supabaseAnonKeyFromEnv || supabaseAnonKeyFromEnv === 'YOUR_SUPABASE_ANON_KEY_HERE' || supabaseAnonKeyFromEnv === 'TU_SUPABASE_ANON_KEY' || supabaseAnonKeyFromEnv.trim() === '' || supabaseAnonKeyFromEnv.toLowerCase() === 'undefined') {
  errors.push(`NEXT_PUBLIC_SUPABASE_ANON_KEY (valor actual: "${supabaseAnonKeyFromEnv}") falta, es un marcador de posición, está vacía, o es la cadena "undefined".`);
}

if (errors.length > 0) {
  const fullErrorMessage = 'Error de configuración de Supabase: \n- ' + errors.join('\n- ') + '\n\nPor favor, actualiza tu archivo .env con tus credenciales reales y válidas de Supabase.';
  throw new Error(fullErrorMessage);
}

export const supabase = createClient(supabaseUrlFromEnv!, supabaseAnonKeyFromEnv!);

async function dataURIToBlob(dataURI: string): Promise<Blob | null> {
  if (!dataURI.startsWith('data:image/')) {
    console.warn('Data URI no parece ser una imagen válida. Inicio del Data URI:', dataURI.substring(0, 100) + "...");
    return null;
  }
  try {
    const response = await fetch(dataURI);
    if (!response.ok) {
      console.warn(`Error al obtener datos del Data URI: ${response.status} ${response.statusText}. URL (inicio): ${dataURI.substring(0,100)}...`);
      return null;
    }
    const blob = await response.blob();
    if (!blob) {
      console.warn('El Data URI se convirtió en un Blob nulo.');
      return null;
    }
    if (!blob.type || !blob.type.startsWith('image/')) { 
      console.warn(`El Data URI no se convirtió en un Blob de imagen válido. Tipo de Blob recibido: ${blob.type}`);
      return null;
    }
    return blob;
  } catch (error: any) {
    console.warn('Excepción al convertir Data URI a Blob:', error.message, dataURI.substring(0,100));
    return null;
  }
}

interface UploadImageResult {
  url: string | null;
  errorMessage: string | null;
}

export async function uploadImageToSupabase(
  dataURI: string,
  bucketName: string
): Promise<UploadImageResult> {
  if (!bucketName || typeof bucketName !== 'string' || bucketName.trim() === '') {
    const msg = `Error de Pre-Subida: Nombre del bucket inválido o no proporcionado: '${bucketName}'`;
    console.warn(msg);
    return { url: null, errorMessage: msg };
  }
  if (!dataURI || typeof dataURI !== 'string' ) { 
    const msg = 'Error de Pre-Subida: Data URI inválido o no proporcionado.';
    console.warn(msg);
    return { url: null, errorMessage: msg };
  }

  try {
    const blob = await dataURIToBlob(dataURI);

    if (!blob) {
      const msg = 'Error de Pre-Subida: Falló la conversión de Data URI a Blob. Verifique la consola para más detalles. No se puede proceder con la subida.';
      console.warn(msg, dataURI.substring(0,100));
      return { url: null, errorMessage: msg };
    }

    const fileExtMatch = blob.type.match(/^image\/(png|jpeg|jpg|gif|webp|svg\+xml)$/i);
    if (!fileExtMatch || !fileExtMatch[1]) {
        const msg = `Error de Pre-Subida: No se pudo determinar una extensión de archivo válida desde el tipo MIME del Blob: '${blob.type}'. Formatos aceptados: png, jpeg, jpg, gif, webp, svg.`;
        console.warn(msg);
        return { url: null, errorMessage: msg };
    }
    const fileExt = fileExtMatch[1].toLowerCase() === 'svg+xml' ? 'svg' : fileExtMatch[1].toLowerCase();
    const safeBucketNamePrefix = bucketName.replace(/[^a-zA-Z0-9-_]/g, '_');
    const fileName = `${safeBucketNamePrefix}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
    const filePath = `${fileName}`;

    console.warn(`Intentando subir a Supabase Storage. Bucket: '${bucketName}', Path: '${filePath}', ContentType: '${blob.type}'`);

    const { data, error: uploadError } = await supabase.storage
      .from(bucketName)
      .upload(filePath, blob, {
        contentType: blob.type, 
        cacheControl: '3600',
        upsert: false, 
      });

    if (uploadError) {
      console.warn("--- Supabase Storage Upload Error DETECTED ---");
      console.warn("Full Supabase error object (raw):", uploadError);
      console.warn("uploadError.message:", (uploadError as any).message);
      console.warn("uploadError.name:", (uploadError as any).name);
      console.warn("uploadError.status (often HTTP status):", (uploadError as any).status);
      console.warn("uploadError.statusCode (alternative for status):", (uploadError as any).statusCode);
      console.warn("uploadError.error (sometimes a string or nested object):", (uploadError as any).error);
      console.warn("Bucket:", bucketName, "FilePath:", filePath, "ContentType Sent:", blob.type);
      console.warn(
        "IMPORTANT: For the TRUE error reason (e.g., RLS, bucket policy, or if the bucket is not explicitly public), please check your Supabase Dashboard: Project > Logs > Storage Logs, and also the browser's Network tab for the failing request."
      );
      
      let detailedUserMessage = 'Error desconocido de Supabase Storage.';
      if (uploadError && typeof uploadError === 'object') {
        const supMessage = (uploadError as any).message;
        const supError = (uploadError as any).error; 
        const supStatusCode = (uploadError as any).statusCode || (uploadError as any).status;

        if (supMessage && typeof supMessage === 'string' && supMessage.trim().toLowerCase() !== 'unknown error' && supMessage.trim().toLowerCase() !== 'bad request' && supMessage.trim() !== '') {
          detailedUserMessage = `Error de Supabase: ${supMessage}`;
          if (supError && typeof supError === 'string' && !supMessage.includes(supError)) detailedUserMessage += ` (Detalle: ${supError})`;
          if (supStatusCode && !supMessage.includes(String(supStatusCode))) detailedUserMessage += ` [Status: ${supStatusCode}]`;
        } else if (supError && typeof supError === 'string' && supError.trim() !== '') {
            detailedUserMessage = `Error de Supabase: ${supError}`;
            if (supStatusCode) detailedUserMessage += ` [Status: ${supStatusCode}]`;
        } else if (supStatusCode) {
            detailedUserMessage = `Error de Supabase: Status ${supStatusCode} (Bad Request).`;
        } else {
            detailedUserMessage = 'Error de Supabase al subir. La respuesta del servidor no incluyó detalles específicos en el objeto de error del cliente.';
        }
      } else if (typeof uploadError === 'string' && uploadError.trim() !== '') {
        detailedUserMessage = uploadError;
      }
      
      detailedUserMessage += "\n\nACCIÓN RECOMENDADA: Revisa la pestaña 'Network' en las herramientas de desarrollador de tu navegador. Busca la solicitud POST fallida (en rojo) a '/storage/v1/object/...' y examina la pestaña 'Response' para ver el JSON completo del error de Supabase. También, revisa los logs de Storage en tu panel de Supabase.";
      
      return { url: null, errorMessage: detailedUserMessage };
    }
    
    if (!data || !data.path) {
        const msg = `Error Post-Subida: Supabase no devolvió una ruta válida después de la subida al bucket '${bucketName}'. Respuesta de Supabase: ${JSON.stringify(data)}`;
        console.warn(msg);
        return { url: null, errorMessage: msg };
    }

    const { data: publicURLData, error: getUrlError } = supabase.storage
      .from(bucketName)
      .getPublicUrl(data.path); 
    
    if (getUrlError || !publicURLData || !publicURLData.publicUrl) {
        const msg = `Error Post-Subida: No se pudo obtener la URL pública para la imagen subida (bucket: ${bucketName}, path: ${data.path}). El archivo podría estar en el bucket pero inaccesible. Verifique si el bucket está configurado como "Público" y que las políticas permitan la lectura. Error de getPublicUrl: ${getUrlError?.message || 'No hay URL pública devuelta.'}`;
        console.warn(msg);
        try {
          await supabase.storage.from(bucketName).remove([data.path]);
          console.warn(`Archivo huérfano eliminado: ${data.path}`);
        } catch (removeCatchError: any) {
          console.warn(`Excepción al intentar eliminar el archivo huérfano '${data.path}':`, removeCatchError.message);
        }
        return { url: null, errorMessage: msg };
    }
    return { url: publicURLData.publicUrl, errorMessage: null };

  } catch (error: any) { 
    const msg = `Error general en la función uploadImageToSupabase (bucket: ${bucketName}): ${error.message}`;
    console.warn(msg, error);
    console.warn("IMPORTANT: For the most accurate error details, please check your Supabase Dashboard Logs (Project > Logs > Storage Logs) and the browser console/network tab.");
    return { url: null, errorMessage: msg };
  }
}
    

    