// Sandbox AI customer chatbot — streaming assistant grounded in site content,
// with live indicative pricing and TEST-MODE payment links.
// Nothing here is wired into the public website.
import { streamText, tool, stepCountIs, convertToModelMessages } from "npm:ai@^7.0.64";
import { z } from "npm:zod@^3.25.76";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createLovableAiGatewayProvider } from "../_shared/ai-gateway.ts";
import { searchKnowledge } from "./knowledge.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const MODEL = "google/gemini-3.6-flash";

const ABSOLUTE_MIN = 399;
const TERMS = [12, 24, 36] as const;

const SYSTEM_PROMPT = `You are "Ruby", the Buyawarranty.co.uk assistant. You help UK drivers understand our vehicle warranty products and, when they are ready, you send them a payment link.

Voice and rules:
- Friendly, plain British English. Short paragraphs, sentence case headings, no jargon.
- Never use negative wording such as "we won't pay". Explain what the cover is designed for.
- Never invent cover, prices, terms or claim outcomes. If you are unsure, say so and offer to pass the customer to the team on 0330 229 5040.
- Always call search_site_knowledge before answering questions about cover, terms and conditions, exclusions, claims, eligibility or cancellation, and answer only from what it returns.
- For prices, always call get_indicative_price. Quote it as an indicative price and say the exact price is confirmed at checkout. Never offer a discount and never go below the quoted price.
- Eligibility: vehicles up to 15 years old and under 150,000 miles. Some high performance and supercar models are excluded.
- Defaults when the customer has no preference: 2 year cover, £2,000 claim limit, £100 excess, £70 per hour labour rate.
- Payment: card payment in full (Stripe) or interest free monthly instalments (Bumper, subject to their checks).
- You are running in a SANDBOX. Any payment link you create is a TEST link and cannot take a real payment. Say this whenever you send one.
- Never ask for card details, passwords or full bank details in chat.`;

function toolResultText(value: unknown) {
  return value;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableKey) {
      return new Response(
        JSON.stringify({ error: "LOVABLE_API_KEY is not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser();
    const user = userData?.user;
    if (!user) {
      return new Response(JSON.stringify({ error: "Not signed in" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    const body = await req.json();
    const threadId: string | undefined = body?.threadId;
    const messages = body?.messages ?? [];
    if (!threadId) {
      return new Response(JSON.stringify({ error: "threadId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: thread, error: threadError } = await admin
      .from("ai_sandbox_threads")
      .select("id, user_id, title")
      .eq("id", threadId)
      .maybeSingle();

    if (threadError) throw threadError;
    if (!thread || thread.user_id !== user.id) {
      return new Response(JSON.stringify({ error: "Thread not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Persist the newest user message
    const lastMessage = messages[messages.length - 1];
    if (lastMessage?.role === "user") {
      const text = (lastMessage.parts ?? [])
        .filter((p: any) => p?.type === "text")
        .map((p: any) => p.text)
        .join("\n");

      const { error: insertError } = await admin.from("ai_sandbox_messages").insert({
        thread_id: threadId,
        user_id: user.id,
        role: "user",
        sdk_message_id: lastMessage.id ?? null,
        parts: lastMessage.parts ?? [],
        content: text,
      });
      if (insertError) console.error("[ai-sandbox-chat] user insert failed", insertError);

      if (!thread.title || thread.title === "New chat") {
        await admin
          .from("ai_sandbox_threads")
          .update({ title: text.slice(0, 60) || "New chat" })
          .eq("id", threadId);
      } else {
        await admin
          .from("ai_sandbox_threads")
          .update({ updated_at: new Date().toISOString() })
          .eq("id", threadId);
      }
    }

    const gateway = createLovableAiGatewayProvider(lovableKey);

    const tools = {
      search_site_knowledge: tool({
        description:
          "Search Buyawarranty's own website content (FAQ, terms and conditions, warranty plan, claims, cancellation, transfer pages) for the wording to answer a customer question. Always use this before answering product, cover, terms, claims or eligibility questions.",
        inputSchema: z.object({
          query: z.string().describe("The customer's question or the topic to look up"),
        }),
        execute: async ({ query }) => {
          const results = searchKnowledge(query, 4);
          return toolResultText({
            found: results.length,
            passages: results.map((r) => ({ section: r.section, text: r.text })),
          });
        },
      }),

      lookup_vehicle: tool({
        description:
          "Look up a UK vehicle by registration plate to confirm make, model, year and fuel type. Northern Ireland plates may not return data.",
        inputSchema: z.object({
          registration: z.string().describe("UK registration plate, e.g. AB12CDE"),
        }),
        execute: async ({ registration }) => {
          const res = await fetch(`${SUPABASE_URL}/functions/v1/dvla-vehicle-lookup`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${SERVICE_ROLE}`,
            },
            body: JSON.stringify({ registrationNumber: registration.replace(/\s/g, "").toUpperCase() }),
          });
          if (!res.ok) {
            return toolResultText({
              found: false,
              note: "We could not confirm this plate automatically. The customer can enter the vehicle details manually.",
            });
          }
          const data = await res.json();
          return toolResultText({ found: true, vehicle: data });
        },
      }),

      get_indicative_price: tool({
        description:
          "Get the current indicative warranty price from the live pricing model. Use the defaults (24 months, £2,000 claim limit, £100 excess, £70 labour) unless the customer states otherwise.",
        inputSchema: z.object({
          term_months: z.number().describe("12, 24 or 36"),
          claim_limit: z.number().describe("1000, 2000, 3000 or 5000"),
          voluntary_excess: z.number().describe("0, 50, 100, 150, 250 or 500"),
          labour_rate: z.number().describe("50, 70, 100 or 150 (£ per hour)"),
          vehicle_type: z
            .enum(["car", "van", "motorbike", "ev", "hybrid"])
            .describe("Vehicle type — motorbikes are priced at half"),
        }),
        execute: async ({ term_months, claim_limit, voluntary_excess, labour_rate, vehicle_type }) => {
          const { data: version, error } = await admin
            .from("pricing_matrix_versions")
            .select("label, admin_matrix, claim_limit_factors, labour_rate_factors, step3_discount_pct")
            .eq("status", "live")
            .order("published_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (error || !version) {
            return toolResultText({
              ok: false,
              note: "Live pricing is unavailable right now — offer to have the team confirm the price.",
            });
          }

          const term = TERMS.includes(term_months as 12) ? term_months : 24;
          const matrix = (version.admin_matrix ?? {}) as Record<string, any>;
          const byExcess = matrix[`${term}months`] ?? {};
          const excessKey = String(voluntary_excess ?? 100);
          const row = byExcess[excessKey] ?? byExcess["100"] ?? {};

          const limitKey = [1000, 2000, 3000].includes(claim_limit)
            ? String(claim_limit)
            : "2000";
          let base = Number(row[limitKey] ?? row["2000"] ?? 0);
          if (!base) {
            return toolResultText({
              ok: false,
              note: "That combination is not priced — suggest the standard options instead.",
            });
          }

          // £5,000 claim limit is a factor on the £2,000 column and needs manager authorisation
          let needsAuthorisation = false;
          if (claim_limit === 5000) {
            const factors = (version.claim_limit_factors ?? []) as Array<{ limit: number; factor: number }>;
            const f5 = factors.find((f) => Number(f.limit) === 5000)?.factor ?? 1.3;
            const f2 = factors.find((f) => Number(f.limit) === 2000)?.factor ?? 1;
            base = Number(row["2000"] ?? base) * (Number(f5) / Number(f2));
            needsAuthorisation = true;
          }

          const labourFactors = (version.labour_rate_factors ?? []) as Array<{ rate: number; factor: number; label?: string }>;
          const labour = labourFactors.find((l) => Number(l.rate) === Number(labour_rate));
          const labourFactor = Number(labour?.factor ?? 1);

          const isBike = vehicle_type === "motorbike";
          const floor = isBike ? ABSOLUTE_MIN / 2 : ABSOLUTE_MIN;

          let quotesAndOrders = base * labourFactor;
          if (isBike) quotesAndOrders = quotesAndOrders / 2;
          quotesAndOrders = Math.max(quotesAndOrders, floor);

          const webDiscount = Number(version.step3_discount_pct ?? 0);
          const websitePrice = Math.max(quotesAndOrders * (1 - webDiscount / 100), floor);

          const round = (n: number) => Math.round(n);

          return toolResultText({
            ok: true,
            pricing_model: version.label,
            term_months: term,
            bonus_months: term / 12, // one bonus month per year
            claim_limit: claim_limit,
            voluntary_excess: voluntary_excess,
            labour_rate: labour_rate,
            labour_rate_label: labour?.label ?? null,
            website_price_total: round(websitePrice),
            website_price_monthly_over_12: round(websitePrice / 12),
            indicative: true,
            needs_manager_authorisation: needsAuthorisation,
            note: "Indicative website price, confirmed at checkout. Never quote below this.",
          });
        },
      }),

      create_test_payment_link: tool({
        description:
          "Create a TEST-MODE payment link so the customer can pay by card (Stripe) or interest free instalments (Bumper). Only use once the customer has agreed the cover, term and price. Always tell them it is a test link in this sandbox.",
        inputSchema: z.object({
          method: z.enum(["stripe", "bumper"]),
          amount: z.number().describe("Total price in pounds"),
          description: z.string().describe("What they are buying, e.g. '24 month warranty, £2,000 claim limit'"),
          email: z.string().describe("Customer email"),
          first_name: z.string(),
          last_name: z.string(),
          registration: z.string(),
        }),
        execute: async ({ method, amount, description, email, first_name, last_name, registration }) => {
          const origin = req.headers.get("origin") ?? "https://buyawarranty.co.uk";

          if (method === "stripe") {
            const testKey = Deno.env.get("STRIPE_TEST_SECRET_KEY");
            if (!testKey) {
              return toolResultText({
                ok: false,
                needs_setup: "STRIPE_TEST_SECRET_KEY",
                note: "Test card payments are not switched on in this sandbox yet. Tell the user a Stripe test key needs adding.",
              });
            }
            const stripe = new Stripe(testKey, { apiVersion: "2024-06-20" });
            const session = await stripe.checkout.sessions.create({
              mode: "payment",
              payment_method_types: ["card"],
              customer_email: email,
              line_items: [
                {
                  quantity: 1,
                  price_data: {
                    currency: "gbp",
                    unit_amount: Math.round(amount * 100),
                    product_data: {
                      name: `SANDBOX TEST — ${description}`,
                      description: `Vehicle ${registration.toUpperCase()} — test only, no real payment`,
                    },
                  },
                },
              ],
              metadata: {
                sandbox: "true",
                registration: registration.toUpperCase(),
                customer_name: `${first_name} ${last_name}`,
              },
              success_url: `${origin}/ai-sandbox?paid=1`,
              cancel_url: `${origin}/ai-sandbox?cancelled=1`,
            });
            return toolResultText({
              ok: true,
              mode: "stripe_test",
              url: session.url,
              note: "Stripe TEST link. Use card 4242 4242 4242 4242. No real money moves.",
            });
          }

          const apiKey = Deno.env.get("BUMPER_TEST_API_KEY");
          const secretKey = Deno.env.get("BUMPER_TEST_SECRET_KEY");
          if (!apiKey || !secretKey) {
            return toolResultText({
              ok: false,
              needs_setup: "BUMPER_TEST_API_KEY / BUMPER_TEST_SECRET_KEY",
              note: "Bumper instalments are not switched on in this sandbox yet. Tell the user Bumper test keys need adding.",
            });
          }
          return toolResultText({
            ok: false,
            note: "Bumper sandbox link creation is not enabled yet in this build.",
          });
        },
      }),
    };

    const result = streamText({
      model: gateway(MODEL),
      system: SYSTEM_PROMPT,
      messages: convertToModelMessages(messages),
      tools,
      stopWhen: stepCountIs(50),
      onError: (e) => console.error("[ai-sandbox-chat] stream error", e),
    });

    return result.toUIMessageStreamResponse({
      originalMessages: messages,
      onFinish: async ({ responseMessage }) => {
        try {
          const text = (responseMessage?.parts ?? [])
            .filter((p: any) => p?.type === "text")
            .map((p: any) => p.text)
            .join("\n");
          const { error } = await admin.from("ai_sandbox_messages").insert({
            thread_id: threadId,
            user_id: user.id,
            role: "assistant",
            sdk_message_id: responseMessage?.id ?? null,
            parts: responseMessage?.parts ?? [],
            content: text,
          });
          if (error) console.error("[ai-sandbox-chat] assistant insert failed", error);
        } catch (e) {
          console.error("[ai-sandbox-chat] onFinish failed", e);
        }
      },
      headers: corsHeaders,
    });
  } catch (error) {
    console.error("[ai-sandbox-chat] fatal", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message ?? "Unexpected error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
