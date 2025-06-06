
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

export async function uploadImageToSupabase(
  dataURI: string,
  bucketName: string
): Promise<string | null> {
  if (!bucketName || typeof bucketName !== 'string' || bucketName.trim() === '') {
    console.warn('Error: Nombre del bucket inválido o no proporcionado:', bucketName);
    return null;
  }
  if (!dataURI || typeof dataURI !== 'string' ) { 
    console.warn('Error: Data URI inválido o no proporcionado.');
    return null;
  }

  try {
    const blob = await dataURIToBlob(dataURI);

    if (!blob) {
      console.warn('Falló la conversión de Data URI a Blob. No se puede proceder con la subida.');
      return null;
    }

    const fileExtMatch = blob.type.match(/^image\/(png|jpeg|gif|webp|svg\+xml)$/);
    if (!fileExtMatch || !fileExtMatch[1]) {
        console.warn('No se pudo determinar una extensión de archivo válida desde el tipo MIME del Blob:', blob.type);
        return null;
    }
    const fileExt = fileExtMatch[1] === 'svg+xml' ? 'svg' : fileExtMatch[1];
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
      console.warn("--- Supabase Storage Upload Error DETECTED ---");
      console.warn(
        "IMPORTANT: Client-side error details are often limited or misleading for storage issues. For the TRUE error reason (e.g., RLS, bucket policy), please check your Supabase Dashboard: Project > Logs > Storage Logs."
      );
      console.warn("Supabase Storage uploadError object:", uploadError);
      return null;
    }

    const { data: publicURLData } = supabase.storage
      .from(bucketName)
      .getPublicUrl(filePath);
    
    if (!publicURLData || !publicURLData.publicUrl) {
        console.warn('No se pudo obtener la URL pública para la imagen subida (bucket: ', bucketName, ', path: ', filePath, '). El archivo podría estar en el bucket pero inaccesible.');
        try {
          const { error: removeError } = await supabase.storage.from(bucketName).remove([filePath]);
          if (removeError) {
            console.warn('Error al intentar eliminar el archivo huérfano:', removeError.message);
          }
        } catch (removeCatchError: any) {
          console.warn('Excepción al intentar eliminar el archivo huérfano:', removeCatchError.message);
        }
        return null;
    }
    return publicURLData.publicUrl;

  } catch (error: any) { 
    console.warn('Error general en la función uploadImageToSupabase (bucket: ', bucketName, '):', error.message);
    console.warn("IMPORTANT: For the most accurate error details, please check your Supabase Dashboard Logs (Project > Logs > Storage Logs).");
    return null;
  }
}
