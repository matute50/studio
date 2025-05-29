import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase URL and Anon Key must be defined in .env file');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

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
        console.error('Could not determine file extension from MIME type:', blob.type);
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
      console.error('Error uploading image to Supabase Storage:', uploadError);
      return null;
    }

    const { data: publicURLData } = supabase.storage
      .from(bucketName)
      .getPublicUrl(filePath);
    
    if (!publicURLData || !publicURLData.publicUrl) {
        console.error('Could not get public URL for uploaded image.');
        // Attempt to clean up the uploaded file if URL retrieval fails
        await supabase.storage.from(bucketName).remove([filePath]);
        return null;
    }

    return publicURLData.publicUrl;
  } catch (error) {
    console.error('Error in uploadImageToSupabase utility:', error);
    return null;
  }
}
