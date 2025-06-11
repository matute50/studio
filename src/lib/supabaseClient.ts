
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
    console.warn('Data URI no parece ser una imagen válida:', dataURI.substring(0, 30) + "...");
    return null;
  }
  try {
    const response = await fetch(dataURI);
    if (!response.ok) {
      console.warn(`Error al obtener datos del Data URI: ${response.status} ${response.statusText}`);
      return null;
    }
    const blob = await response.blob();
    if (!blob || !blob.type || !blob.type.startsWith('image/')) { 
      console.warn('El Data URI no se convirtió en un Blob de imagen válido.');
      return null;
    }
    return blob;
  } catch (error: any) {
    console.warn('Error al convertir Data URI a Blob:', error.message);
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
    const msg = `Error: Nombre del bucket inválido o no proporcionado: ${bucketName}`;
    console.warn(msg);
    return { url: null, errorMessage: msg };
  }
  if (!dataURI || typeof dataURI !== 'string' ) { 
    const msg = 'Error: Data URI inválido o no proporcionado.';
    console.warn(msg);
    return { url: null, errorMessage: msg };
  }

  try {
    const blob = await dataURIToBlob(dataURI);

    if (!blob) {
      const msg = 'Falló la conversión de Data URI a Blob. No se puede proceder con la subida.';
      console.warn(msg);
      return { url: null, errorMessage: msg };
    }

    const fileExtMatch = blob.type.match(/^image\/(png|jpeg|gif|webp|svg\+xml)$/);
    if (!fileExtMatch || !fileExtMatch[1]) {
        const msg = `No se pudo determinar una extensión de archivo válida desde el tipo MIME del Blob: ${blob.type}`;
        console.warn(msg);
        return { url: null, errorMessage: msg };
    }
    const fileExt = fileExtMatch[1] === 'svg+xml' ? 'svg' : fileExtMatch[1];
    const safeBucketNamePrefix = bucketName.replace(/[^a-zA-Z0-9-_]/g, '_'); // Sanitize bucket name for use in filename
    const fileName = `${safeBucketNamePrefix}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
    const filePath = `${fileName}`;

    const { data, error: uploadError } = await supabase.storage
      .from(bucketName)
      .upload(filePath, blob, {
        contentType: blob.type,
        cacheControl: '3600',
        upsert: false, 
      });

    if (uploadError) {
      const supabaseErrorMessage = uploadError.message || 'Error desconocido de Supabase Storage.';
      console.warn("--- Supabase Storage Upload Error DETECTED ---");
      console.warn("Error details:", uploadError);
      console.warn(
        "IMPORTANT: For the TRUE error reason (e.g., RLS, bucket policy, or if the bucket is not explicitly public), please check your Supabase Dashboard: Project > Logs > Storage Logs."
      );
      return { url: null, errorMessage: `Error de Supabase: ${supabaseErrorMessage}` };
    }

    const { data: publicURLData, error: getUrlError } = supabase.storage
      .from(bucketName)
      .getPublicUrl(filePath);
    
    if (getUrlError || !publicURLData || !publicURLData.publicUrl) {
        const msg = `No se pudo obtener la URL pública para la imagen subida (bucket: ${bucketName}, path: ${filePath}). El archivo podría estar en el bucket pero inaccesible. Verifique si el bucket está configurado como "Público" y que las políticas permitan la lectura. Error de getPublicUrl: ${getUrlError?.message || 'No hay URL pública devuelta.'}`;
        console.warn(msg);
        // Attempt to clean up the orphaned file if URL retrieval fails
        try {
          await supabase.storage.from(bucketName).remove([filePath]);
        } catch (removeCatchError: any) {
          console.warn('Excepción al intentar eliminar el archivo huérfano:', removeCatchError.message);
        }
        return { url: null, errorMessage: msg };
    }
    return { url: publicURLData.publicUrl, errorMessage: null };

  } catch (error: any) { 
    const msg = `Error general en la función uploadImageToSupabase (bucket: ${bucketName}): ${error.message}`;
    console.warn(msg);
    console.warn("IMPORTANT: For the most accurate error details, please check your Supabase Dashboard Logs (Project > Logs > Storage Logs).");
    return { url: null, errorMessage: msg };
  }
}
