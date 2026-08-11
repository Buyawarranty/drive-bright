import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GATEWAY = "https://connector-gateway.lovable.dev/google_search_console";
const MANAGEMENT_ROLES = ["admin", "super_admin", "sales_manager"];

type SiteEntry = { siteUrl: string; permissionLevel?: string };

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function coversTarget(siteUrl: string, target: URL) {
  if (siteUrl.startsWith("sc-domain:")) {
    const domain = siteUrl.slice("sc-domain:".length).toLowerCase();
    const host = target.hostname.toLowerCase();
    return host === domain || host.endsWith(`.${domain}`);
  }
  try {
    return target.href.startsWith(new URL(siteUrl).href);
  } catch {
    return false;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    const connectionApiKey = Deno.env.get("GOOGLE_SEARCH_CONSOLE_API_KEY");

    if (!lovableApiKey || !connectionApiKey) {
      return json({ error: "Search Console connection is not configured for this project." }, 503);
    }

    // --- Caller must be a signed-in management user -------------------------
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    if (!token) return json({ error: "Missing auth" }, 401);

    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser(token);
    if (userErr || !userData.user) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
    const { data: callerAdmin } = await admin
      .from("admin_users")
      .select("role")
      .eq("user_id", userData.user.id)
      .maybeSingle();

    if (!callerAdmin || !MANAGEMENT_ROLES.includes(String(callerAdmin.role))) {
      return json({ error: "Forbidden: management only" }, 403);
    }

    // --- Input -------------------------------------------------------------
    const body = await req.json().catch(() => ({}));
    const action = body?.action === "inspect" ? "inspect" : "properties";
    const targetUrl = typeof body?.target_url === "string" && body.target_url.startsWith("http")
      ? body.target_url
      : "https://buyawarranty.co.uk/";
    const selectedSiteUrl = typeof body?.site_url === "string" ? body.site_url : undefined;

    const headers = {
      Authorization: `Bearer ${lovableApiKey}`,
      "X-Connection-Api-Key": connectionApiKey,
    };

    // --- Resolve verified property (list -> match -> select) ---------------
    const sitesRes = await fetch(`${GATEWAY}/webmasters/v3/sites`, { headers });
    if (!sitesRes.ok) {
      const details = await sitesRes.text();
      console.error(`Search Console sites list failed [${sitesRes.status}]: ${details}`);
      return json({ error: "Could not list Search Console properties", status: sitesRes.status, details }, sitesRes.status);
    }
    const { siteEntry = [] } = (await sitesRes.json()) as { siteEntry?: SiteEntry[] };
    const target = new URL(targetUrl);
    const matches = siteEntry.filter(
      (e) => e.permissionLevel !== "siteUnverifiedUser" && coversTarget(e.siteUrl, target),
    );

    if (matches.length === 0) {
      return json({ status: "no_property", candidates: [], message: "No verified Search Console property covers this site." });
    }

    let resolvedSiteUrl: string | null = null;
    if (selectedSiteUrl) {
      const found = matches.find((e) => e.siteUrl === selectedSiteUrl);
      if (!found) return json({ error: "Selected property is not verified for this site" }, 400);
      resolvedSiteUrl = found.siteUrl;
    } else if (matches.length === 1) {
      resolvedSiteUrl = matches[0].siteUrl;
    }

    if (action === "properties" || !resolvedSiteUrl) {
      return json({
        status: resolvedSiteUrl ? "selected" : "selection_required",
        site_url: resolvedSiteUrl,
        candidates: matches.map((e) => e.siteUrl),
      });
    }

    // --- Inspect the requested URLs ---------------------------------------
    const urls: string[] = Array.isArray(body?.urls)
      ? body.urls.filter((u: unknown) => typeof u === "string" && (u as string).startsWith("http")).slice(0, 25)
      : [];
    if (urls.length === 0) return json({ error: "Provide at least one absolute URL in `urls`" }, 400);

    const results: unknown[] = [];
    for (const inspectionUrl of urls) {
      const res = await fetch(`${GATEWAY}/v1/urlInspection/index:inspect`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ inspectionUrl, siteUrl: resolvedSiteUrl }),
      });

      if (!res.ok) {
        const details = await res.text();
        console.error(`URL inspection failed for ${inspectionUrl} [${res.status}]: ${details}`);
        results.push({ url: inspectionUrl, ok: false, status: res.status, details });
        continue;
      }

      const data = await res.json();
      const idx = data?.inspectionResult?.indexStatusResult ?? {};
      results.push({
        url: inspectionUrl,
        ok: true,
        verdict: idx.verdict ?? null,
        coverageState: idx.coverageState ?? null,
        robotsTxtState: idx.robotsTxtState ?? null,
        indexingState: idx.indexingState ?? null,
        pageFetchState: idx.pageFetchState ?? null,
        lastCrawlTime: idx.lastCrawlTime ?? null,
        googleCanonical: idx.googleCanonical ?? null,
        userCanonical: idx.userCanonical ?? null,
        sitemaps: idx.sitemap ?? [],
        referringUrls: idx.referringUrls ?? [],
        mobileUsability: data?.inspectionResult?.mobileUsabilityResult?.verdict ?? null,
        richResults: (data?.inspectionResult?.richResultsResult?.detectedItems ?? []).map(
          (item: { richResultType?: string; items?: unknown[] }) => ({
            type: item.richResultType ?? "Unknown",
            count: Array.isArray(item.items) ? item.items.length : 0,
          }),
        ),
        richResultsVerdict: data?.inspectionResult?.richResultsResult?.verdict ?? null,
        inspectionLink: data?.inspectionResult?.inspectionResultLink ?? null,
      });
    }

    return json({
      status: "ok",
      site_url: resolvedSiteUrl,
      candidates: matches.map((e) => e.siteUrl),
      checked_at: new Date().toISOString(),
      results,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("gsc-url-inspect error:", message);
    return json({ error: message }, 500);
  }
});
