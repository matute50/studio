import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function uploadImageToSupabase(
  imageData: string,
  bucketName: string
): Promise<{ url?: string; errorMessage?: string }> {
  try {
    // Si ya es una URL, retornarla directamente
    if (imageData.startsWith('http')) {
      return { url: imageData };
    }

    // Verificar si es un Base64 válido
    const base64Regex = /^data:image\/([a-z]+);base64,([^"]+)$/i;
    const matches = imageData.match(base64Regex);

    if (!matches) {
      throw new Error('Formato de imagen no válido. Debe ser una URL o Base64');
    }

    const mimeType = matches[1];
    const base64Data = matches[2];
    const fileExt = mimeType.split('/')[1];
    const fileName = `${Date.now()}.${fileExt}`;
    const filePath = `${fileName}`;

    // Convertir Base64 a ArrayBuffer
    const buffer = Buffer.from(base64Data, 'base64');

    // Subir a Supabase Storage
    const { data, error } = await supabase.storage
      .from(bucketName)
      .upload(filePath, buffer, {
        contentType: `image/${fileExt}`,
        upsert: true,
      });

    if (error) {
      throw error;
    }

    // Obtener URL pública
    const { data: { publicUrl } } = supabase.storage
      .from(bucketName)
      .getPublicUrl(filePath);

    return { url: publicUrl };
  } catch (error: any) {
    console.error('Error uploading image:', error);
    return { 
      errorMessage: error.message || 'Error desconocido al subir la imagen' 
    };
  }
}

// Función para eliminar imágenes
export async function deleteImageFromSupabase(
  imageUrl: string,
  bucketName: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const fileName = imageUrl.split('/').pop();
    if (!fileName) {
      throw new Error('URL de imagen no válida');
    }

    const { error } = await supabase.storage
      .from(bucketName)
      .remove([fileName]);

    if (error) throw error;

    return { success: true };
  } catch (error: any) {
    return { 
      success: false, 
      error: error.message || 'Error al eliminar la imagen' 
    };
  }
}