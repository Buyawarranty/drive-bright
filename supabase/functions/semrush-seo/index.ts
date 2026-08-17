import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GATEWAY_URL = "https://connector-gateway.lovable.dev/semrush";

// Only these Semrush resource groups/methods may be proxied.
const ALLOWED: Record<string, string[]> = {
  domains: [
    "domain_ranks",
    "domain_rank",
    "domain_rank_history",
    "domain_organic",
    "domain_organic_unique",
    "domain_organic_subdomains",
    "domain_domains",
    "domain_adwords",
  ],
  keywords: [
    "phrase_this",
    "phrase_these",
    "phrase_all",
    "phrase_related",
    "phrase_questions",
    "phrase_kdi",
    "phrase_organic",
    "phrase_fullsearch",
  ],
  backlinks: [
    "backlinks_overview",
    "backlinks_refdomains",
    "backlinks_anchors",
    "backlinks_pages",
    "backlinks_competitors",
  ],
  url: ["url_organic", "url_ranks"],
  user: ["limits"],
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    const semrushApiKey = Deno.env.get("SEMRUSH_API_KEY");
    if (!lovableApiKey || !semrushApiKey) {
      return new Response(
        JSON.stringify({ error: "Semrush connection is not configured for this project." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // --- Auth: management only -------------------------------------------------
    const authHeader = req.headers.get("Authorization") ?? "";
    const jwt = authHeader.replace(/^Bearer\s+/i, "");
    if (!jwt) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const { data: userData, error: userError } = await admin.auth.getUser(jwt);
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: roles } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id);

    const allowedRoles = ["admin", "super_admin", "sales_manager", "performance_manager"];
    const isAllowed = (roles ?? []).some((r: { role: string }) => allowedRoles.includes(r.role));
    if (!isAllowed) {
      return new Response(JSON.stringify({ error: "Not authorised to read Semrush data" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- Validate request ------------------------------------------------------
    const body = await req.json().catch(() => null) as
      | { group?: string; method?: string; params?: Record<string, string | number> }
      | null;

    const group = String(body?.group ?? "").trim();
    const method = String(body?.method ?? "").trim();
    if (!group || !method || !ALLOWED[group] || !ALLOWED[group].includes(method)) {
      return new Response(
        JSON.stringify({ error: "Unsupported Semrush report requested" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(body?.params ?? {})) {
      if (value === undefined || value === null || value === "") continue;
      if (!/^[a-z_]{1,32}$/.test(key)) continue;
      search.set(key, String(value).slice(0, 300));
    }

    const path = group === "user" ? `/user/limits` : `/${group}/${method}`;
    const url = `${GATEWAY_URL}${path}${search.toString() ? `?${search}` : ""}`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "X-Connection-Api-Key": semrushApiKey,
        "Allow-Limit-Offset": "true",
      },
    });

    const text = await response.text();
    if (!response.ok) {
      console.error(`Semrush gateway failed [${response.status}]: ${text}`);
      const quotaHit = /TOTAL LIMIT EXCEEDED|LIMIT EXCEEDED/i.test(text);
      return new Response(
        JSON.stringify({
          error: quotaHit
            ? "The Semrush API quota is exhausted — upgrade the Semrush plan or wait for the quota to reset."
            : "Semrush request failed",
          status: response.status,
          details: text.slice(0, 2000),
        }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = { raw: text };
    }

    return new Response(JSON.stringify(parsed), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("semrush-seo error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
