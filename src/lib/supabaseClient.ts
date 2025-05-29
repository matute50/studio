
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
async function dataURIToBlob(dataURI: string): Promise<Blob | null> {
  try {
    const response = await fetch(dataURI);
    if (!response.ok) {
      console.error(`Error al hacer fetch del Data URI: ${response.status} ${response.statusText}`);
      const responseText = await response.text().catch(() => 'No se pudo leer el cuerpo de la respuesta.');
      console.error('Cuerpo de la respuesta del fetch (si disponible):', responseText);
      return null;
    }
    const blob = await response.blob();
    if (!blob || !blob.type) { 
      console.error('El Blob no tiene tipo MIME o es nulo. Data URI podría estar malformado o ser inválido:', dataURI.substring(0, 100));
      return null;
    }
    return blob;
  } catch (error) {
    console.error('Error en dataURIToBlob:', error);
    if (error instanceof Error) {
        console.error('Mensaje de error en dataURIToBlob:', error.message);
        console.error('Stack de error en dataURIToBlob:', error.stack);
    }
    return null;
  }
}

export async function uploadImageToSupabase(
  dataURI: string,
  bucketName: string
): Promise<string | null> {
  if (!bucketName || typeof bucketName !== 'string' || bucketName.trim() === '') {
    console.error('Error: Nombre del bucket inválido o no proporcionado:', bucketName);
    return null;
  }
  if (!dataURI || typeof dataURI !== 'string' || !dataURI.startsWith('data:image/')) {
    console.error('Error: Data URI inválido o no proporcionado. Data URI (primeros 100 caracteres):', dataURI ? dataURI.substring(0,100) + "..." : "undefined/null");
    return null;
  }

  try {
    console.log('Intentando convertir Data URI a Blob...');
    const blob = await dataURIToBlob(dataURI);

    if (!blob) {
      console.error('Falló la conversión de Data URI a Blob. No se puede proceder con la subida.');
      return null;
    }
    console.log('Blob creado exitosamente:', { type: blob.type, size: blob.size });

    const fileExt = blob.type.split('/')[1];
    if (!fileExt) {
        console.error('No se pudo determinar la extensión del archivo desde el tipo MIME del Blob:', blob.type);
        return null;
    }
    const fileName = `article_img_${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
    const filePath = `${fileName}`;
    console.log('Subiendo archivo a Supabase Storage con bucket:', bucketName, 'y filePath:', filePath);

    const { data, error: uploadError } = await supabase.storage
      .from(bucketName)
      .upload(filePath, blob, {
        contentType: blob.type,
        cacheControl: '3600',
        upsert: false, 
      });

    if (uploadError) {
      console.error("--- Supabase Storage Upload Error DETECTED ---"); // Line 100

      // Log 1: Direct log of the error object
      console.error("1. Raw uploadError object:", uploadError);

      // Log 2: Type of error
      console.error("2. typeof uploadError:", typeof uploadError);

      // Log 3: instanceof Error
      let isInstanceOfError = false;
      try {
        isInstanceOfError = uploadError instanceof Error;
      } catch (e) { /* ignore, might not be an object */ }
      console.error("3. uploadError instanceof Error:", isInstanceOfError);

      // Log 4: Constructor name
      let constructorName = 'N/A';
      if (uploadError && typeof (uploadError as any)?.constructor === 'function') {
        constructorName = (uploadError as any).constructor.name;
      }
      console.error("4. uploadError.constructor.name:", constructorName);

      // Log 5: String conversion
      let stringRepresentation = 'N/A';
      try {
        stringRepresentation = String(uploadError);
      } catch (e) { stringRepresentation = "Error converting to string: " + String(e); }
      console.error("5. String(uploadError):", stringRepresentation);

      // Log 6: JSON.stringify with circular replacer
      let jsonStringified = 'N/A';
      try {
        const getCircularReplacer = () => {
          const seen = new WeakSet();
          return (_key: string, value: any) => {
            if (typeof value === "object" && value !== null) {
              if (seen.has(value)) {
                return "[Circular Reference]";
              }
              seen.add(value);
            }
            return value;
          };
        };
        jsonStringified = JSON.stringify(uploadError, getCircularReplacer(), 2);
      } catch (e: any) {
        jsonStringified = "Error during JSON.stringify: " + String(e.message || e);
      }
      console.error("6. JSON.stringify(uploadError):", jsonStringified);

      // Log 7: Individual properties, explicitly casting to string
      if (uploadError && typeof uploadError === 'object') {
        const err = uploadError as any;
        console.error("7a. err.message:", String(err.message ?? 'N/A'));
        console.error("7b. err.name:", String(err.name ?? 'N/A'));
        console.error("7c. err.stack:", String(err.stack ?? 'N/A'));
        console.error("7d. err.status (HTTP status):", String(err.status ?? err.statusCode ?? 'N/A'));
        console.error("7e. err.error (Supabase code/string):", String(err.error ?? 'N/A'));
        console.error("7f. err.error_description (Supabase desc):", String(err.error_description ?? 'N/A'));
        console.error("7g. err.code (sometimes present):", String(err.code ?? 'N/A'));


        // Log 8: All enumerable keys
        try {
          const keys = Object.keys(err);
          console.error("8. Enumerable keys:", keys.length > 0 ? keys.join(', ') : 'None');
          if (keys.length > 0) {
            keys.forEach(key => {
              try {
                console.error(`   - Key '${key}':`, String(err[key]));
              } catch (e) {
                console.error(`   - Key '${key}': Error accessing/stringifying value - ${String(e)}`);
              }
            });
          }
        } catch (e) {
          console.error("8. Error getting enumerable keys:", String(e));
        }

        // Log 9: All own property names (enumerable or not)
        try {
          const ownPropertyNames = Object.getOwnPropertyNames(err);
          console.error("9. Own property names:", ownPropertyNames.length > 0 ? ownPropertyNames.join(', ') : 'None');
           if (ownPropertyNames.length > 0) {
            ownPropertyNames.forEach(key => {
              try {
                console.error(`   - OwnProp '${key}':`, String(err[key]));
              } catch (e) {
                console.error(`   - OwnProp '${key}': Error accessing/stringifying value - ${String(e)}`);
              }
            });
          }
        } catch (e) {
          console.error("9. Error getting own property names:", String(e));
        }

      } else if (uploadError) { // If not an object but still truthy (e.g. a string)
        console.error("7. uploadError is not an object, direct string value:", String(uploadError));
      }

      console.error("--- End of Supabase Storage Upload Error Details ---");
      return null;
    }

    console.log('Subida a Supabase Storage exitosa. Obteniendo URL pública...');
    const { data: publicURLData } = supabase.storage
      .from(bucketName)
      .getPublicUrl(filePath);
    
    if (!publicURLData || !publicURLData.publicUrl) {
        console.error('No se pudo obtener la URL pública para la imagen subida. El archivo podría estar en el bucket pero inaccesible. Path:', filePath);
        try {
          const { error: removeError } = await supabase.storage.from(bucketName).remove([filePath]);
          if (removeError) {
            console.error('Error al intentar eliminar el archivo huérfano:', removeError);
          } else {
            console.log('Archivo huérfano (sin URL pública) eliminado de Supabase Storage.');
          }
        } catch (removeCatchError) {
          console.error('Excepción al intentar eliminar el archivo huérfano:', removeCatchError);
        }
        return null;
    }
    console.log('URL pública obtenida:', publicURLData.publicUrl);
    return publicURLData.publicUrl;

  } catch (error) { 
    console.error('Error general en la función uploadImageToSupabase (bloque catch principal):', error);
    if (error instanceof Error) {
      console.error('Mensaje del error general:', error.message);
      console.error('Stack del error general:', error.stack);
    } else {
      console.error('Error general (no es instancia de Error, valor directo):', String(error));
    }
    return null;
  }
}

    