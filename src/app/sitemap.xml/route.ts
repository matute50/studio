
// src/app/sitemap.xml/route.ts

// IMPORTANT: Replace with your actual public site URL
const BASE_URL = "https://saladillovivo.com"; 

// Define the type for the article data we expect from Supabase
interface SitemapArticle {
  slug: string;
  updatedAt: string; // Or createdAt if updatedAt is not always available
}

// Function to fetch articles from Supabase
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const getArticles = async (): Promise<SitemapArticle[]> => {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error("Sitemap: Supabase URL or Anon Key is not defined in environment variables.");
    return [];
  }

  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/articles?select=slug,updatedAt&order=updatedAt.desc`, {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      next: { revalidate: 3600 } // Revalidate data every hour
    });

    if (!response.ok) {
      console.error("Sitemap: Failed to fetch articles from Supabase", response.status, await response.text());
      return []; // Return empty array on error
    }
    
    const articles: any[] = await response.json();

    // Filter out articles that might be missing a slug or updatedAt
    return articles.filter(article => article.slug && article.updatedAt) as SitemapArticle[];

  } catch (error) {
    console.error("Sitemap: Error fetching articles", error);
    return []; // Return empty array on error
  }
};

// Function to generate the sitemap XML string
const generateSiteMap = (articles: SitemapArticle[]) => {
  const items = articles
    .map((article) => {
      // Ensure updatedAt is a valid date string before creating a new Date object
      const lastModDate = article.updatedAt ? new Date(article.updatedAt).toISOString() : new Date().toISOString();
      return `
  <url>
    <loc>${BASE_URL}/noticia/${article.slug}</loc>
    <lastmod>${lastModDate}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.7</priority>
  </url>`;
    })
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"
        xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">
  <url>
    <loc>${BASE_URL}</loc>
    <lastmod>${new Date().toISOString()}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  ${items}
</urlset>`;
};

// Route handler for GET requests to /sitemap.xml
export async function GET() {
  const articles = await getArticles();
  const sitemap = generateSiteMap(articles);

  return new Response(sitemap, {
    headers: {
      'Content-Type': 'application/xml',
    },
  });
}
