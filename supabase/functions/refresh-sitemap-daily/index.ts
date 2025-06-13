// supabase/functions/refresh-sitemap-daily/index.ts
// @ts-ignore
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"; // Or a more recent stable version

console.log("[SITEMAP REFRESH FN] Edge Function initializing");

// IMPORTANT: Confirm this is the exact URL you want to hit.
// The sitemap generated earlier via route.ts is typically at /sitemap.xml, not /api/sitemap.xml
const SITEMAP_ENDPOINT_URL = "https://editor.saladillovivo.com/api/sitemap.xml";

async function callSitemapEndpoint() {
  console.log(`[SITEMAP REFRESH FN] Attempting to GET: ${SITEMAP_ENDPOINT_URL}`);

  try {
    const res = await fetch(SITEMAP_ENDPOINT_URL, { method: "GET" });

    if (res.ok) {
      const responseText = await res.text(); // Consume the body
      console.log(`[SITEMAP REFRESH FN] ✅ Successfully called sitemap endpoint. Status: ${res.status}. Response (first 100 chars): ${responseText.substring(0,100)}`);
      return new Response("Sitemap endpoint called successfully.", {
        headers: { "Content-Type": "text/plain" },
        status: 200,
      });
    } else {
      const errorText = await res.text();
      console.error(
        `[SITEMAP REFRESH FN] ❌ Error calling sitemap endpoint. Status: ${res.status}, Response Body: ${errorText}`
      );
      return new Response(
        `Error calling sitemap endpoint: ${res.status} - ${errorText}`,
        {
          headers: { "Content-Type": "text/plain" },
          status: res.status,
        }
      );
    }
  } catch (error) {
    // @ts-ignore
    const errorMessage = error.message || "Unknown error";
    console.error("[SITEMAP REFRESH FN] ❌ Failed to call sitemap endpoint due to a network or other error:", errorMessage, error);
    return new Response(
      `Failed to execute GET request to sitemap endpoint: ${errorMessage}`,
      {
        headers: { "Content-Type": "text/plain" },
        status: 500,
      }
    );
  }
}

serve(async (req: Request) => {
  // This function is intended to be called by pg_cron or a direct invocation.
  console.log(`[SITEMAP REFRESH FN] Edge Function invoked. Method: ${req.method}`);
  if (req.method === "POST" || req.method === "GET") { // Allow GET for direct testing / pg_net or POST from other invokers
    return await callSitemapEndpoint();
  } else {
    console.warn(`[SITEMAP REFRESH FN] Received unexpected method: ${req.method}. Responding with 405.`);
    return new Response("Method Not Allowed. This function expects a GET or POST request.", {
      status: 405,
      headers: { "Content-Type": "text/plain", "Allow": "GET, POST" },
    });
  }
});

/*
To deploy this Edge Function:
1. Ensure this file is saved as `supabase/functions/refresh-sitemap-daily/index.ts` in your local Supabase project.
2. Make sure you have the Supabase CLI installed and are logged into your project.
   (e.g., `supabase login`, then `supabase link --project-ref YOUR_PROJECT_REF`)
3. Navigate to your project's root directory in the terminal.
4. Deploy the function:
   `supabase functions deploy refresh-sitemap-daily --project-ref YOUR_PROJECT_REF --no-verify-jwt`

   Replace YOUR_PROJECT_REF with your actual Supabase project reference ID.
   The `--no-verify-jwt` flag is generally used when functions are called by automated systems like cron jobs.

After deploying, you can schedule it using pg_cron in Supabase. See next steps.
*/
