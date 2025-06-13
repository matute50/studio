// supabase/functions/notify-google-sitemap/index.ts
// @ts-ignore
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"; // Or a more recent stable version

console.log("[SITEMAP PING FN] Edge Function initializing");

// IMPORTANT: Ensure this is your correct production sitemap URL
const SITEMAP_URL = "https://saladillovivo.com/sitemap.xml"; // As provided by user
const GOOGLE_PING_URL_BASE = "https://www.google.com/ping?sitemap=";

async function sendGooglePing() {
  const fullPingUrl = `${GOOGLE_PING_URL_BASE}${encodeURIComponent(SITEMAP_URL)}`;
  console.log(`[SITEMAP PING FN] Attempting to ping Google at: ${fullPingUrl}`);

  try {
    // Google's ping endpoint expects a GET request
    const res = await fetch(fullPingUrl, { method: "GET" });

    if (res.ok) {
      console.log(`[SITEMAP PING FN] ✅ Successfully pinged Google for sitemap. Status: ${res.status}`);
      return new Response("Google sitemap pinged successfully.", {
        headers: { "Content-Type": "text/plain" },
        status: 200,
      });
    } else {
      const errorText = await res.text();
      console.error(
        `[SITEMAP PING FN] ❌ Error pinging Google. Status: ${res.status}, Response Body: ${errorText}`
      );
      return new Response(
        `Error pinging Google: ${res.status} - ${errorText}`,
        {
          headers: { "Content-Type": "text/plain" },
          status: res.status, // Reflect Google's error status
        }
      );
    }
  } catch (error) {
    // @ts-ignore
    const errorMessage = error.message || "Unknown error";
    console.error("[SITEMAP PING FN] ❌ Failed to ping Google due to a network or other error:", errorMessage, error);
    return new Response(
      `Failed to execute ping to Google: ${errorMessage}`,
      {
        headers: { "Content-Type": "text/plain" },
        status: 500, // Internal server error for the function itself
      }
    );
  }
}

serve(async (req: Request) => {
  // This function is typically invoked by a database trigger (via an SQL helper function making an HTTP request),
  // so we just proceed to ping Google.
  // The HTTP method from the trigger (via pg_net or http extension) will be GET.
  console.log(`[SITEMAP PING FN] Edge Function invoked. Method: ${req.method}`);
  if (req.method === "POST" || req.method === "GET") { // Allow GET for direct testing / pg_net or POST from other invokers
    return await sendGooglePing();
  } else {
    console.warn(`[SITEMAP PING FN] Received unexpected method: ${req.method}. Responding with 405.`);
    return new Response("Method Not Allowed. This function expects a GET or POST request.", {
      status: 405,
      headers: { "Content-Type": "text/plain", "Allow": "GET, POST" },
    });
  }
});

/*
To deploy this Edge Function:
1. Ensure this file is saved as `supabase/functions/notify-google-sitemap/index.ts` in your local Supabase project.
2. Make sure you have the Supabase CLI installed and are logged into your project.
   (e.g., `supabase login`, then `supabase link --project-ref YOUR_PROJECT_REF`)
3. Navigate to your project's root directory in the terminal.
4. Deploy the function:
   `supabase functions deploy notify-google-sitemap --project-ref YOUR_PROJECT_REF --no-verify-jwt`

   Replace YOUR_PROJECT_REF with your actual Supabase project reference ID.
   The `--no-verify-jwt` flag is generally used when functions are called by database triggers or other backend services,
   as they might not pass a standard user JWT.
*/
