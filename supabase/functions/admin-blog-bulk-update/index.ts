// One-off maintenance function: applies SEO/AIO content rewrites to blog_posts.
// Protected by a shared secret so it cannot be called anonymously.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-maint-key",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const expected = Deno.env.get("BLOG_MAINT_KEY");
  if (!expected || req.headers.get("x-maint-key") !== expected) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { posts } = await req.json();
    if (!Array.isArray(posts)) throw new Error("posts array required");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const results: Array<Record<string, unknown>> = [];
    for (const post of posts) {
      const { slug, ...fields } = post;
      const { data, error } = await supabase
        .from("blog_posts")
        .update(fields)
        .eq("slug", slug)
        .select("id, slug, status");
      results.push({ slug, updated: data?.length ?? 0, error: error?.message ?? null });
    }

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
