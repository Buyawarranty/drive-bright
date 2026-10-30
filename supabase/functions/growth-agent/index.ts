// Agentic assistant for the CRM (was named Growth Assistant) — super admins, plus staff granted it in User Permissions (per-part). Read-only: it looks at sales,
// leads, cover combinations and blog posts and SUGGESTS marketing, sales and
// branding actions. It never changes data or sends anything.
import { streamText, tool, stepCountIs, convertToModelMessages } from "npm:ai@^7.0.64";
import { createOpenAI } from "npm:@ai-sdk/openai@^3";
import { z } from "npm:zod@^3.25.76";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { canReadCompanySalesValues } from "../_shared/companySalesPrivacy.ts";
import {
  createLovableAiGatewayRunIdFetch,
  getLovableAiGatewayRunId,
  withLovableAiGatewayRunIdHeader,
} from "../_shared/run-id.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-lovable-aig-run-id",
  "Access-Control-Expose-Headers": "X-Lovable-AIG-Run-ID",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const MODEL = "openai/gpt-6-astra";

const INSTRUCTIONS = `You are the Buyawarranty.co.uk Agentic assistant, working inside the staff CRM for a super admin.
Your job: sales insights, marketing content, lead follow-up ideas and branding reviews for a UK used-car warranty company.

How you work:
- Use the tools to look at real figures before giving any number. Never invent figures, customers or results. If data is missing, say so.
- You only SUGGEST. You cannot change prices, send messages, publish blogs or edit leads — the super admin decides and acts.
- Be practical: lead with the answer, then 3–6 concrete next steps. Use short headings and bullets. British English, £, UK dates.
- Prices: 1, 2 or 3-year cover; 12 interest-free monthly instalments or pay in full. Never promise a specific price — prices depend on the vehicle and options.
- Phone numbers: sales 0330 229 5040, claims 0330 229 5045. Sales phone hours Mon–Fri 9am–6pm, Sat 12pm–4pm UK time.
- Do not recommend changing Google Ads tracking or schema markup.

Brand voice rules for any copy you write or review:
- Friendly, clear, confident, plain English. Sentence case headings.
- Never negative wording such as "we won't pay" — explain what cover is designed for.
- No fake urgency ("Act now", "Don't miss out"), no unsupported superlatives ("100% guaranteed").
- Only say "Save 10%" when a pay-in-full saving really is 10%; otherwise give the £ amount.
- No placeholder contact details. Email addresses: support@buyawarranty.co.uk, info@buyawarranty.co.uk.
When reviewing copy, list each issue, why it breaks a rule, and a rewritten line.`;

const since = (days: number) => new Date(Date.now() - days * 86400000).toISOString();
const clampDays = (d?: number) => Math.min(Math.max(Math.round(d ?? 30), 1), 365);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableKey) return json({ error: "AI is not configured" }, 500);
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const admin = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });
    const { data: u } = await userClient.auth.getUser();
    const user = u?.user;
    if (!user) return json({ error: "Not signed in" }, 401);
    const { data: adminRow } = await admin.from("admin_users").select("role, permissions")
      .eq("user_id", user.id).eq("is_active", true).maybeSingle();
    const isSuper = (adminRow as any)?.role === "super_admin";
    const perms = ((adminRow as any)?.permissions ?? {}) as Record<string, unknown>;
    if (!isSuper && perms["tab_growth-agent"] !== true) return json({ error: "You don't have access to the Agentic Assistant" }, 403);
    // Super admins get every part. Others get only the parts ticked for them in
    // User Permissions; if none are ticked they get marketing + branding (no figures).
    const anyPart = ["tab_growth-sales", "tab_growth-leads", "tab_growth-marketing", "tab_growth-branding"].some((k) => perms[k] === true);
    const can = (k: string) => isSuper || perms[k] === true || (!anyPart && (k === "tab_growth-marketing" || k === "tab_growth-branding"));
    const parts = {
      sales: canReadCompanySalesValues(adminRow?.role) && can("tab_growth-sales"), leads: can("tab_growth-leads"),
      marketing: can("tab_growth-marketing"), branding: can("tab_growth-branding"),
    };

    const body = await req.json().catch(() => ({}));
    const threadId = String(body?.threadId ?? "");
    const messages = Array.isArray(body?.messages) ? body.messages : [];
    const { data: thread } = await admin.from("growth_agent_threads").select("id, title")
      .eq("id", threadId).eq("user_id", user.id).maybeSingle();
    if (!thread) return json({ error: "Conversation not found" }, 404);
    if (!messages.length) return json({ error: "No messages" }, 400);

    const last = messages[messages.length - 1];
    if (last?.role === "user") {
      const { error } = await admin.from("growth_agent_messages").insert({
        thread_id: threadId, user_id: user.id, role: "user",
        sdk_message_id: last.id ?? null, parts: last.parts ?? [],
      });
      if (error) console.error("[growth-agent] user insert failed", error);
      const text = (last.parts ?? []).filter((p: any) => p?.type === "text").map((p: any) => p.text).join(" ").trim();
      if (thread.title === "New conversation" && text) {
        await admin.from("growth_agent_threads").update({ title: text.slice(0, 60) }).eq("id", threadId);
      }
    }
    await admin.from("growth_agent_threads").update({ updated_at: new Date().toISOString() }).eq("id", threadId);

    const liveSales = () => admin.from("customers")
      .select("signup_date, final_amount, plan_type, purchase_source, is_direct_website_sale, utm_source, claim_limit, labour_rate, voluntary_excess, vehicle_make, status")
      .or("is_deleted.is.null,is_deleted.eq.false")
      .not("status", "in", "(cancelled,refunded)");

    const tools = {
      sales_summary: tool({
        description: "Sales count and revenue over the last N days, split by channel, plan length, ad source and week. Excludes cancelled/refunded.",
        inputSchema: z.object({ days: z.number().describe("Days to look back, e.g. 30") }),
        execute: async ({ days }) => {
          const d = clampDays(days);
          const { data, error } = await liveSales().gte("signup_date", since(d)).limit(5000);
          if (error) return { error: error.message };
          const rows = data ?? [];
          const tally = (key: (r: any) => string) => {
            const m: Record<string, { sales: number; revenue: number }> = {};
            for (const r of rows) {
              const k = key(r) || "unknown";
              m[k] ??= { sales: 0, revenue: 0 };
              m[k].sales++; m[k].revenue += Number(r.final_amount ?? 0);
            }
            for (const v of Object.values(m)) v.revenue = Math.round(v.revenue);
            return m;
          };
          return {
            days: d,
            total_sales: rows.length,
            total_revenue: Math.round(rows.reduce((s, r: any) => s + Number(r.final_amount ?? 0), 0)),
            by_channel: tally((r) => (r.is_direct_website_sale ? "website direct" : "staff/agent")),
            by_plan: tally((r) => String(r.plan_type ?? "")),
            by_source: tally((r) => String(r.utm_source ?? r.purchase_source ?? "")),
            by_week: tally((r) => {
              const dt = new Date(r.signup_date); dt.setUTCDate(dt.getUTCDate() - dt.getUTCDay());
              return dt.toISOString().slice(0, 10);
            }),
          };
        },
      }),
      top_cover_combinations: tool({
        description: "Most sold cover combinations (plan, claim limit, labour rate, excess) and top vehicle makes over the last N days.",
        inputSchema: z.object({ days: z.number() }),
        execute: async ({ days }) => {
          const { data, error } = await liveSales().gte("signup_date", since(clampDays(days))).limit(5000);
          if (error) return { error: error.message };
          const combos: Record<string, number> = {}; const makes: Record<string, number> = {};
          for (const r of (data ?? []) as any[]) {
            const k = `${r.plan_type ?? "?"} | £${r.claim_limit ?? "?"} limit | £${r.labour_rate ?? "?"}/hr | £${r.voluntary_excess ?? "?"} excess`;
            combos[k] = (combos[k] ?? 0) + 1;
            const mk = String(r.vehicle_make ?? "unknown").toUpperCase(); makes[mk] = (makes[mk] ?? 0) + 1;
          }
          const top = (m: Record<string, number>) => Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 12);
          return { combinations: top(combos), makes: top(makes) };
        },
      }),
      lead_followups: tool({
        description: "Recent unconverted leads worth following up: who abandoned which step, quote value and how often they've been contacted.",
        inputSchema: z.object({ days: z.number().describe("Look back, e.g. 14") }),
        execute: async ({ days }) => {
          const { data, error } = await admin.from("abandoned_carts")
            .select("full_name, vehicle_make, vehicle_model, step_abandoned, total_price, plan_name, call_count, last_contacted_at, contact_status, created_at")
            .eq("is_converted", false).gte("created_at", since(Math.min(clampDays(days), 60)))
            .order("created_at", { ascending: false }).limit(300);
          if (error) return { error: error.message };
          const rows = (data ?? []) as any[];
          const byStep: Record<string, number> = {};
          for (const r of rows) byStep[String(r.step_abandoned ?? "?")] = (byStep[String(r.step_abandoned ?? "?")] ?? 0) + 1;
          const uncontacted = rows.filter((r) => !r.last_contacted_at && !(r.call_count > 0));
          const best = [...rows].filter((r) => Number(r.total_price) > 0)
            .sort((a, b) => Number(b.total_price) - Number(a.total_price)).slice(0, 15)
            .map((r) => ({ name: r.full_name, vehicle: `${r.vehicle_make ?? ""} ${r.vehicle_model ?? ""}`.trim(), step: r.step_abandoned, quote: r.total_price, calls: r.call_count ?? 0, status: r.contact_status, created: r.created_at }));
          return { total_open: rows.length, never_contacted: uncontacted.length, by_step_abandoned: byStep, highest_value: best };
        },
      }),
      recent_blogs: tool({
        description: "Latest blog posts with status and SEO titles, to plan new content and avoid repeats.",
        inputSchema: z.object({ limit: z.number() }),
        execute: async ({ limit }) => {
          const { data, error } = await admin.from("blog_posts")
            .select("title, slug, status, published_at, seo_title, view_count")
            .order("created_at", { ascending: false }).limit(Math.min(Math.max(limit, 1), 50));
          if (error) return { error: error.message };
          return { posts: data };
        },
      }),
    };

    const allowedTools: Record<string, any> = {};
    if (parts.sales) { allowedTools.sales_summary = tools.sales_summary; allowedTools.top_cover_combinations = tools.top_cover_combinations; }
    if (parts.leads) allowedTools.lead_followups = tools.lead_followups;
    if (parts.marketing) allowedTools.recent_blogs = tools.recent_blogs;
    const allowedNames = Object.entries(parts).filter(([, v]) => v).map(([k]) => k).join(", ");
    const accessNote = `\n\nThis user's access: ${allowedNames}. Only help with those areas. Company sales values are never available to sales agents or sales leads, even through permission grants; do not repeat financial figures from earlier conversation messages for those roles. For other unavailable areas, say politely that their login does not include that part. Never guess figures you cannot look up.`;

    const runIdFetch = createLovableAiGatewayRunIdFetch(getLovableAiGatewayRunId(req));
    const provider = createOpenAI({
      baseURL: "https://ai.gateway.lovable.dev/v1",
      apiKey: lovableKey,
      headers: { "Lovable-API-Key": lovableKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
      fetch: runIdFetch.fetch,
    });

    const result = streamText({
      model: provider.responses(MODEL),
      instructions: `${INSTRUCTIONS}\nToday is ${new Date().toISOString().slice(0, 10)}.${accessNote}`,
      messages: await convertToModelMessages(messages),
      tools: allowedTools,
      stopWhen: stepCountIs(50),
      abortSignal: req.signal,
      providerOptions: {
        openai: {
          forceReasoning: true,
          reasoningEffort: "medium",
          reasoningSummary: "auto",
          store: false,
          include: ["reasoning.encrypted_content"],
        },
      },
      onError: (e) => console.error("[growth-agent] stream error", e),
    } as any);

    const response = result.toUIMessageStreamResponse({
      originalMessages: messages,
      sendReasoning: true,
      headers: corsHeaders,
      onError: (e: any) => {
        console.error("[growth-agent] response error", e);
        const status = e?.statusCode ?? e?.status;
        if (status === 402) return "AI credits have run out. Top up in Settings → Plans & credits.";
        if (status === 429) return "Too many requests right now — please wait a minute and try again.";
        if (status === 403) return "AI access is blocked for this workspace. A workspace admin needs to check AI settings.";
        return "Something went wrong getting an answer. Please try again.";
      },
      onFinish: async ({ responseMessage }) => {
        const { error } = await admin.from("growth_agent_messages").insert({
          thread_id: threadId, user_id: user.id, role: "assistant",
          sdk_message_id: responseMessage?.id ?? null, parts: responseMessage?.parts ?? [],
        });
        if (error) console.error("[growth-agent] assistant insert failed", error);
      },
    });
    return withLovableAiGatewayRunIdHeader(response, runIdFetch, corsHeaders);
  } catch (error) {
    if ((error as any)?.name === "AbortError") return new Response(null, { status: 499, headers: corsHeaders });
    console.error("[growth-agent] fatal", error);
    return json({ error: (error as Error).message ?? "Unexpected error" }, 500);
  }
});
