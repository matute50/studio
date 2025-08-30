
import { NextResponse } from 'next/server';

// --- Interfaces para tipar los datos y respuestas ---
interface Article {
  id: string;
  title: string;
  slug: string;
  description?: string;
  imageUrl: string;
}

interface SocialPostResult {
  platform: 'Facebook' | 'Instagram';
  success: boolean;
  message: string;
  postId?: string;
}

// --- Variables de Entorno y Configuración ---
const META_ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;
const FACEBOOK_PAGE_ID = process.env.FACEBOOK_PAGE_ID;
const INSTAGRAM_BUSINESS_ACCOUNT_ID = process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID;
const GRAPH_API_VERSION = 'v20.0'; // Usar una versión específica de la API

/**
 * Publica una noticia en una página de Facebook.
 * @param article - El objeto de la noticia a publicar.
 * @returns Un objeto SocialPostResult con el resultado.
 */
async function postToFacebook(article: Article): Promise<SocialPostResult> {
  if (!FACEBOOK_PAGE_ID) {
    return { platform: 'Facebook', success: false, message: 'FACEBOOK_PAGE_ID no está configurado.' };
  }

  const articleUrl = `https://www.saladillovivo.com.ar/noticia/${article.slug}`;
  const message = `${article.title}\n\n${article.description || ''}\n\nLee la nota completa aquí:`

  const endpoint = `https://graph.facebook.com/${GRAPH_API_VERSION}/${FACEBOOK_PAGE_ID}/feed`;

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: message,
        link: articleUrl,
        access_token: META_ACCESS_TOKEN,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error?.message || 'Respuesta no exitosa de la API de Facebook');
    }

    return { platform: 'Facebook', success: true, message: 'Publicado con éxito.', postId: data.id };
  } catch (error: any) {
    console.error('Error al publicar en Facebook:', error);
    return { platform: 'Facebook', success: false, message: error.message };
  }
}

/**
 * Publica una foto en una cuenta de Instagram Business.
 * @param article - El objeto de la noticia a publicar.
 * @returns Un objeto SocialPostResult con el resultado.
 */
async function postToInstagram(article: Article): Promise<SocialPostResult> {
  if (!INSTAGRAM_BUSINESS_ACCOUNT_ID) {
    return { platform: 'Instagram', success: false, message: 'INSTAGRAM_BUSINESS_ACCOUNT_ID no está configurado.' };
  }
  if (!article.imageUrl || article.imageUrl.includes('placehold.co')) {
     return { platform: 'Instagram', success: false, message: 'No se puede publicar en Instagram sin una imagen real.' };
  }

  const caption = `${article.title}\n\n${article.description || ''}\n\n#Saladillo #Noticias #SaladilloVivo`;
  
  try {
    // Paso 1: Crear el contenedor de medios
    const createContainerEndpoint = `https://graph.facebook.com/${GRAPH_API_VERSION}/${INSTAGRAM_BUSINESS_ACCOUNT_ID}/media`;
    const createContainerResponse = await fetch(createContainerEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image_url: article.imageUrl,
        caption: caption,
        access_token: META_ACCESS_TOKEN,
      }),
    });

    const createContainerData = await createContainerResponse.json();
    if (!createContainerResponse.ok) {
      throw new Error(createContainerData.error?.message || 'Error al crear el contenedor de medios de Instagram.');
    }
    const creationId = createContainerData.id;

    // Paso 2: Publicar el contenedor de medios
    const publishEndpoint = `https://graph.facebook.com/${GRAPH_API_VERSION}/${INSTAGRAM_BUSINESS_ACCOUNT_ID}/media_publish`;
    const publishResponse = await fetch(publishEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        creation_id: creationId,
        access_token: META_ACCESS_TOKEN,
      }),
    });

    const publishData = await publishResponse.json();
    if (!publishResponse.ok) {
      throw new Error(publishData.error?.message || 'Error al publicar el contenedor de medios de Instagram.');
    }

    return { platform: 'Instagram', success: true, message: 'Publicado con éxito.', postId: publishData.id };
  } catch (error: any) {
    console.error('Error al publicar en Instagram:', error);
    return { platform: 'Instagram', success: false, message: error.message };
  }
}


/**
 * Handler para la ruta POST /api/post-social
 * Recibe un artículo y lo publica en las redes sociales configuradas.
 */
export async function POST(request: Request) {
  // Validar que las claves principales existan
  if (!META_ACCESS_TOKEN) {
    return NextResponse.json(
      { success: false, message: 'Error de configuración: La variable de entorno META_ACCESS_TOKEN no está definida.' },
      { status: 500 }
    );
  }

  const article: Article = await request.json();
  console.log('API Route /api/post-social recibió para procesar:', article);

  // Ejecutar las publicaciones en paralelo
  const results = await Promise.allSettled([
    postToFacebook(article),
    postToInstagram(article),
  ]);

  // Procesar los resultados
  const outcomes: SocialPostResult[] = results.map(result => {
    if (result.status === 'fulfilled') {
      return result.value;
    } else {
      // Esto captura errores inesperados en las funciones de publicación
      return {
        platform: 'Unknown', // Debería ser sobreescrito por la lógica interna
        success: false,
        message: result.reason.message || 'Error desconocido durante la ejecución.',
      };
    }
  });

  const isAllSuccess = outcomes.every(res => res.success);

  return NextResponse.json({
    success: isAllSuccess,
    message: isAllSuccess ? 'Publicado en todas las plataformas.' : 'Ocurrieron errores en una o más plataformas.',
    results: outcomes,
  });
}
