// Sandbox AI customer chatbot — streaming assistant grounded in site content,
// with live indicative pricing and TEST-MODE payment links.
// Nothing here is wired into the public website.
import { streamText, tool, stepCountIs, convertToModelMessages } from "npm:ai@^7.0.64";
import { z } from "npm:zod@^3.25.76";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createLovableAiGatewayProvider } from "../_shared/ai-gateway.ts";
import { retrieveGrounded } from "./knowledge.ts";

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

const SYSTEM_PROMPT = `You are "Miles", the Buyawarranty.co.uk assistant. You help UK drivers understand our vehicle warranty products and, when they are ready, you send them a payment link.

Voice and rules:
- Warm, semi-casual British English — like a friendly, knowledgeable person on live chat, not a corporate script. Use contractions ("you'll", "that's", "I'd"), short sentences, the odd bit of natural warmth ("nice motor", "good question", "totally fair"). Plain words, no jargon, no bullet-point walls unless it genuinely helps.
- Be a person to talk to: acknowledge what they said before you ask the next thing, keep it to one question at a time, and mirror their energy. Never sound robotic, never repeat the same phrasing twice in a row.
- No fake feelings and no over-familiarity: don't claim to own a car, don't say "I love", don't use slang the customer hasn't used, and don't pile on exclamation marks.
- Honesty is non-negotiable: you are an AI assistant. If asked whether you're a real person, say plainly and cheerfully that you're the AI assistant and you can bring a human specialist in any time. Never imply, hint or play along that you are human, and never take on a human name as a "colleague".
- Never use negative wording such as "we won't pay". Explain what the cover is designed for.


GROUNDING — THE MOST IMPORTANT RULE:
- The ONLY approved material is: (1) the Platinum Warranty Plan v3.7 document, (2) the Terms and Conditions v3.7 document, and (3) the step 3 pricing page cover options (term, claim limit, excess, labour rate). Website marketing pages, blogs and older document versions are NOT approved and must never be used, even if you remember them.
- You must never invent, guess, infer or "fill in" warranty information. Anything about what is covered, what is excluded, claim limits, excess, labour rates, eligibility, cancellation, transfers, claim outcomes or any contractual term must come word-for-word in substance from the approved material returned by search_site_knowledge.
- Never give a generic "here's what's included" summary from memory. Every list of features, limits or exclusions must be built from passages the tool actually returned in this conversation, and describe the Platinum Plan exactly as the v3.7 document does — including its stated limits (for example MOT fee cover, vehicle hire and recovery, and labour cover) rather than a paraphrase you have assumed.
- Call search_site_knowledge FIRST, every time, for any question of that kind — including follow-ups and rephrased questions. Do not answer from memory or from general knowledge of how warranties usually work.
- The tool tells you whether it is grounded. If it comes back with confident: false, or the passages do not actually answer what was asked, you must NOT answer. Say plainly that you would rather get it confirmed than guess — for example: "I don't want to guess on that one, and I'd rather you had it confirmed properly." Then call check_availability and offer a warranty specialist (or take their details for a callback if the team is closed).
- Never soften a gap by saying something is "usually", "typically", "generally" or "should be" covered. If it is not in the approved material, it is a specialist question.
- Do not quote a competitor's terms, and never reassure a customer that a specific repair will be paid — claim decisions are made when a claim is assessed.
- For prices, always call get_indicative_price. Quote it as an indicative price and say the exact price is confirmed at checkout. Never offer a discount yourself and never go below the quoted price.
- PRICE MATCHING — keep it short and confident, in bullets, never a long explanation. If a customer mentions a competitor price or asks to match/beat a price, reply with a short line plus three bullets, roughly:
  "Good news — we can match any like-for-like price and beat it."
  • Give us a call on 0330 229 5040, or
  • Leave your name, number, email and reg and we'll call you back
  • We'll beat the price you've been quoted
  Then call capture_lead as soon as you have a phone number or email. Never say you "can't match or discount prices", never explain that system prices are fixed, and never write more than those bullets.

- Eligibility: vehicles up to 15 years old and under 150,000 miles. Some high performance and supercar models are excluded.
- Replaced parts: a replaced turbo unit, or a replaced hybrid/EV drive battery, stays covered even on an older or higher-mileage vehicle when a valid receipt and proof of purchase is supplied — the age/mileage cover period for that component starts again from the date the replacement was fitted, not the vehicle's original age or mileage. Never tell a customer an older turbo or hybrid battery is outside cover without asking whether it has been replaced.
- Defaults when the customer has no preference: 2 year cover, £2,000 claim limit, £100 excess, £70 per hour labour rate.
- Payment: card payment in full (Stripe) or interest free monthly instalments (Bumper, subject to their checks).
- The chat shows a "Build your price" panel where the customer picks term, claim limit, excess and labour rate. When they send a combination, price EXACTLY that combination with get_indicative_price, state the total plainly, then ask only for the details you still need (name, email, registration) and call create_test_payment_link with method "stripe" for card or "bumper" for monthly instalments. Give them the link as soon as you have those details.
- You are running in a SANDBOX. Any payment link you create is a TEST link and cannot take a real payment. Say this whenever you send one.
- Never ask for card details, passwords or full bank details in chat.
- Be open about being an AI. Say "I'm the AI assistant" if asked, and always say clearly when you are bringing a human specialist in. If the live context below says a specialist is ONLINE RIGHT NOW, mention it naturally when it helps ("one of our specialists is online right now if you'd rather talk it through with a person") and hand over the moment they say yes.

The sales journey — follow it in order:
1. Open: you have already said hello. Ask what vehicle they have (registration is quickest, or make, model and year).
2. Qualify, one step at a time: age and mileage, roughly what the vehicle is worth, and how long they want cover for. Call lookup_vehicle when they give a plate.
3. Recommend: suggest the cover level, term, claim limit, excess and labour rate that suits, explain why in a sentence or two, then call get_indicative_price and give the price. Offer a cheaper and a stronger option if it helps them decide.
4. Answer their questions ONLY from search_site_knowledge. If it is not grounded there, say you would rather have it confirmed than guess and move to step 5 with reason not_in_approved_material.
5. Hand over at buying intent, hesitation, OR any question the approved material does not answer. Buying intent: "how do I buy", "can I pay monthly", "I'll take it". Hesitation: price worries, comparing competitors, "let me think", repeated questions.
   - First call check_availability.
   - If open: offer it plainly — "Would you like me to connect you to a warranty specialist now?" — and only when they say yes, call connect_live_agent. Tell them a human specialist is joining and that the specialist can see the whole chat, so they will not need to repeat anything.
   - If closed: say the team's hours in plain terms, then get them as far as you can yourself — confirm the cover and price, offer the test payment link, and ask for their phone number (best), plus name, email and registration if they will share them, so a specialist can pick it up when the team opens. As soon as you have EITHER a phone number OR an email, call capture_lead — a name is optional, never block on it. Ask for anything still missing afterwards.
6. Never promise a callback time beyond the next opening hours, and never claim to be a human.`;

function toolResultText(value: unknown) {
  return value;
}

const OPENING_HOURS = {
  // Monday–Saturday, 9am–6pm Europe/London. Sunday closed.
  startHour: 9,
  endHour: 18,
  openDays: [1, 2, 3, 4, 5, 6],
  label: "Monday to Saturday, 9am to 6pm",
};

function londonParts(now = new Date()) {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(now);
  const weekday = parts.find((p) => p.type === "weekday")?.value ?? "Mon";
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  const dayIndex = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(weekday);
  return { weekday, dayIndex, hour, minute };
}

function availability(now = new Date()) {
  const { weekday, dayIndex, hour, minute } = londonParts(now);
  const openDay = OPENING_HOURS.openDays.includes(dayIndex);
  const isOpen = openDay && hour >= OPENING_HOURS.startHour && hour < OPENING_HOURS.endHour;

  let nextOpen: string;
  if (openDay && hour < OPENING_HOURS.startHour) {
    nextOpen = "today at 9am";
  } else {
    let d = dayIndex;
    let hops = 0;
    do {
      d = (d + 1) % 7;
      hops += 1;
    } while (!OPENING_HOURS.openDays.includes(d) && hops < 8);
    nextOpen = hops === 1 ? "tomorrow at 9am" : `${["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][d]} at 9am`;
  }

  return {
    is_open: isOpen,
    local_time: `${weekday} ${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")} London`,
    opening_hours: OPENING_HOURS.label,
    next_open: isOpen ? null : nextOpen,
  };
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

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    const body = await req.json();

    // Be tolerant about the incoming shape: the UI transport sends an array of
    // UIMessages, but a malformed/legacy payload used to crash streamText with
    // "messages.some is not a function".
    const rawMessages = body?.messages ?? body?.message ?? [];
    const messages: any[] = Array.isArray(rawMessages)
      ? rawMessages
      : rawMessages && typeof rawMessages === "object"
        ? [rawMessages]
        : [];
    if (!Array.isArray(rawMessages)) {
      console.warn("[ai-sandbox-chat] non-array messages payload", typeof rawMessages);
    }

    // Website visitors are not signed in: the widget generates a random token,
    // keeps it in the browser and owns exactly one conversation with it.
    const rawGuestToken = typeof body?.guestToken === "string" ? body.guestToken.trim() : "";
    const guestToken = /^[a-zA-Z0-9-]{16,64}$/.test(rawGuestToken) ? rawGuestToken : null;
    const pageSource = typeof body?.source === "string" ? body.source.slice(0, 80) : null;

    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser();
    const user = userData?.user ?? null;
    const userId: string | null = user?.id ?? null;

    if (!user && !guestToken) {
      return new Response(JSON.stringify({ error: "Not signed in" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let thread: { id: string; user_id: string | null; title: string | null } | null = null;
    let threadId: string | undefined;

    if (!user && guestToken) {
      const { data: existing } = await admin
        .from("ai_sandbox_threads")
        .select("id, user_id, title")
        .eq("guest_token", guestToken)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existing) {
        thread = existing as typeof thread;
      } else {
        const { data: created, error: createError } = await admin
          .from("ai_sandbox_threads")
          .insert({ guest_token: guestToken, source: pageSource, title: "Website chat" })
          .select("id, user_id, title")
          .single();
        if (createError) throw createError;
        thread = created as typeof thread;
      }
      threadId = thread!.id;
    } else {
      threadId = body?.threadId;
      if (!threadId) {
        return new Response(JSON.stringify({ error: "threadId is required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: found, error: threadError } = await admin
        .from("ai_sandbox_threads")
        .select("id, user_id, title")
        .eq("id", threadId)
        .maybeSingle();

      if (threadError) throw threadError;
      if (!found || found.user_id !== userId) {
        return new Response(JSON.stringify({ error: "Thread not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      thread = found as typeof thread;
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

    /** Log a learning signal for the admin "Chatbot data" section. Never throws. */
    const logEvent = async (row: Record<string, unknown>) => {
      try {
        const { error } = await admin.from("ai_chat_events").insert({
          thread_id: threadId,
          user_id: user.id,
          is_sandbox: true,
          ...row,
        });
        if (error) console.error("[ai-sandbox-chat] event log failed", error);
      } catch (e) {
        console.error("[ai-sandbox-chat] event log threw", e);
      }
    };

    if (lastMessage?.role === "user") {
      const wording = (lastMessage.parts ?? [])
        .filter((p: any) => p?.type === "text")
        .map((p: any) => p.text)
        .join("\n");
      await logEvent({ event_type: "customer_message", customer_wording: wording });
    }

    const gateway = createLovableAiGatewayProvider(lovableKey);


    /** How many warranty specialists are actually on duty in live chat right now. */
    const specialistsOnline = async (): Promise<number> => {
      const cutoff = new Date(Date.now() - 3 * 60 * 1000).toISOString();
      const { count } = await admin
        .from("ai_sandbox_specialist_presence")
        .select("user_id", { count: "exact", head: true })
        .eq("is_online", true)
        .gte("last_seen_at", cutoff);
      return count ?? 0;
    };

    /**
     * Write a captured chat lead into the real New Leads pipeline.
     * Gated behind the `ai_chat_creates_real_leads` feature flag so the sandbox stays isolated
     * until the assistant goes live. Dedupes by normalised email or phone tail-9 and lets the
     * existing round-robin / owner-sticky triggers do the assignment.
     */
    const createRealLead = async (args: {
      customer_name?: string | null;
      customer_email?: string | null;
      customer_phone?: string | null;
      registration?: string | null;
      cover_summary?: string | null;
      quoted_price?: number | null;
      notes?: string | null;
    }) => {
      try {
        const { data: flag } = await admin
          .from("feature_flags")
          .select("enabled")
          .eq("key", "ai_chat_creates_real_leads")
          .maybeSingle();
        if (!flag?.enabled) return { created: false, reason: "sandbox_only" };

        const email = (args.customer_email ?? "").trim().toLowerCase();
        const phone = (args.customer_phone ?? "").replace(/\D/g, "");
        const tail9 = phone.length >= 9 ? phone.slice(-9) : null;
        // Phone-only leads are valid — people often will not give a name or email.
        if (!email && !tail9) return { created: false, reason: "phone_or_email_required" };

        // Existing lead by email?
        if (email) {
          const { data: byEmail } = await admin
            .from("sales_leads")
            .select("id")
            .ilike("email", email)
            .limit(1);
          if (byEmail && byEmail.length > 0) {
            return { created: false, reason: "duplicate_email", lead_id: byEmail[0].id };
          }
        }

        // Existing lead by phone tail-9?
        if (tail9) {
          const { data: byPhone } = await admin.rpc("find_sales_lead_by_phone_tail9", {
            tail_digits: tail9,
          });
          const existingId = Array.isArray(byPhone) ? byPhone[0]?.id ?? byPhone[0] : byPhone;
          if (existingId) {
            return { created: false, reason: "duplicate_phone", lead_id: existingId };
          }
        }

        const nameParts = (args.customer_name ?? "").trim().split(/\s+/).filter(Boolean);
        const noteLines = [
          "Captured by Miles (AI live chat).",
          args.cover_summary ? `Cover discussed: ${args.cover_summary}` : null,
          args.quoted_price ? `Quoted: £${args.quoted_price}` : null,
          args.notes ? `Notes: ${args.notes}` : null,
          !email ? "No email given — phone only." : null,
          nameParts.length === 0 ? "No name given." : null,
        ].filter(Boolean);

        const { data: inserted, error: insertError } = await admin
          .from("sales_leads")
          .insert({
            first_name: nameParts[0] ?? null,
            last_name: nameParts.slice(1).join(" ") || null,
            email: email || null,
            phone: args.customer_phone ?? null,
            vehicle_reg: args.registration ? args.registration.toUpperCase().replace(/\s/g, "") : null,
            quote_amount: args.quoted_price ?? null,
            notes: noteLines.join("\n"),
          })
          .select("id")
          .single();

        if (insertError) {
          console.error("[ai-sandbox-chat] pipeline lead insert failed", insertError);
          return { created: false, reason: "insert_failed" };
        }

        // Tag it as a live chat lead so agents can see where it came from.
        try {
          const { data: tag } = await admin
            .from("lead_tags")
            .select("id")
            .eq("name", "Live chat")
            .maybeSingle();
          if (tag?.id) {
            await admin
              .from("lead_tag_assignments")
              .insert({ lead_id: inserted.id, tag_id: tag.id });
          }
        } catch (tagErr) {
          console.error("[ai-sandbox-chat] live chat tag failed", tagErr);
        }

        return { created: true, lead_id: inserted.id, tag: "Live chat" };
      } catch (e) {
        console.error("[ai-sandbox-chat] createRealLead threw", e);
        return { created: false, reason: "error" };
      }
    };

    const tools = {

      search_site_knowledge: tool({
        description:
          "Search Buyawarranty's APPROVED material (FAQ, terms and conditions, warranty plan, claims, cancellation, transfer pages) for the wording to answer a customer question. This is the ONLY permitted source for anything about cover, exclusions, claim limits, excess, labour rates, eligibility, cancellation or contractual terms. Always call it before answering such a question, and obey the 'confident' flag and 'instruction' it returns: if confident is false, do not answer — offer a warranty specialist instead.",
        inputSchema: z.object({
          query: z.string().describe("The customer's question or the topic to look up"),
        }),
        execute: async ({ query }) => {
          const grounded: any = retrieveGrounded(query, 5);
          await logEvent({
            event_type: "question",
            topic: query,
            customer_wording: query,
            knowledge_confident: grounded?.confident ?? null,
          });
          return toolResultText(grounded);
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
          await logEvent({
            event_type: "vehicle_interest",
            registration: String(registration).replace(/\s/g, "").toUpperCase(),
            vehicle_make: data?.make ?? null,
            vehicle_model: data?.model ?? null,
            vehicle_year: Number(data?.yearOfManufacture ?? data?.year) || null,
            metadata: data ?? {},
          });
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

          await logEvent({
            event_type: "price_quoted",
            quoted_price: round(websitePrice),
            term_months: term,
            topic: `${term}mo · £${claim_limit} limit · £${voluntary_excess} excess · £${labour_rate}/hr`,
            metadata: {
              vehicle_type,
              claim_limit,
              voluntary_excess,
              labour_rate,
              pricing_model: version.label,
            },
          });



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

      check_availability: tool({
        description:
          "Check whether the warranty specialists are available right now (opening hours plus how many specialists are actually on duty in live chat). Always call this before offering a live handover.",
        inputSchema: z.object({}),
        execute: async () =>
          toolResultText({ ...availability(), specialists_online_now: await specialistsOnline() }),
      }),


      connect_live_agent: tool({
        description:
          "Hand the chat over to a human warranty specialist. Only call this after check_availability says the team is open AND the customer has said yes to being connected. The specialist receives the whole conversation.",
        inputSchema: z.object({
          reason: z
            .enum([
              "buying_intent",
              "price_objection",
              "comparing_quotes",
              "hesitation",
              "complex_question",
              "not_in_approved_material",
              "customer_asked",
            ])
            .describe(
              "Why the handover is happening. Use not_in_approved_material when the approved website, product or terms material did not clearly answer their question.",
            ),
          customer_name: z.string().nullable(),
          customer_email: z.string().nullable(),
          customer_phone: z.string().nullable(),
          registration: z.string().nullable(),
          cover_summary: z.string().nullable().describe("Term, claim limit, excess and labour rate discussed"),
          quoted_price: z.number().nullable(),
        }),
        execute: async (args) => {
          const state = availability();
          if (!state.is_open) {
            return toolResultText({
              ok: false,
              is_open: false,
              ...state,
              note: "The team is closed — capture the lead with capture_lead instead and keep helping the customer yourself.",
            });
          }
          const { data, error } = await admin
            .from("ai_sandbox_handovers")
            .insert({
              thread_id: threadId,
              created_by: user.id,
              kind: "live_handover",
              reason: args.reason,
              customer_name: args.customer_name,
              customer_email: args.customer_email,
              customer_phone: args.customer_phone,
              registration: args.registration,
              cover_summary: args.cover_summary,
              quoted_price: args.quoted_price,
              transcript: messages,
              status: "waiting",
            })
            .select("id")
            .single();

          if (error) {
            console.error("[ai-sandbox-chat] handover insert failed", error);
            return toolResultText({
              ok: false,
              note: "The handover could not be created. Offer the team's number 0330 229 5040 instead.",
            });
          }

          await logEvent({
            event_type: "handover",
            topic: args.reason ?? null,
            registration: args.registration ?? null,
            quoted_price: args.quoted_price ?? null,
            detail: args.cover_summary ?? null,
          });

          return toolResultText({
            ok: true,
            handover_id: data.id,
            status: "waiting",
            note: "A warranty specialist has been alerted and can see the full chat. Tell the customer a human is joining and stay quiet unless they ask you something directly.",
          });
        },
      }),

      capture_lead: tool({
        description:
          "Capture the customer's details as a lead so a warranty specialist can pick it up at the next opening time. Use this outside opening hours, or when the customer prefers a callback.",
        inputSchema: z.object({
          customer_name: z.string().nullable(),
          customer_email: z.string().nullable(),
          customer_phone: z.string().nullable(),
          registration: z.string().nullable(),
          cover_summary: z.string().nullable(),
          quoted_price: z.number().nullable(),
          notes: z.string().nullable().describe("Anything the specialist should know before calling"),
        }),
        execute: async (args) => {
          if (!args.customer_email && !args.customer_phone) {
            return toolResultText({
              ok: false,
              note: "Ask for a phone number (or an email) first — a name is optional.",
            });
          }
          const state = availability();
          const { data, error } = await admin
            .from("ai_sandbox_handovers")
            .insert({
              thread_id: threadId,
              created_by: user.id,
              kind: state.is_open ? "callback_request" : "out_of_hours_lead",
              reason: args.notes ?? "lead_capture",
              customer_name: args.customer_name,
              customer_email: args.customer_email,
              customer_phone: args.customer_phone,
              registration: args.registration,
              cover_summary: args.cover_summary,
              quoted_price: args.quoted_price,
              transcript: messages,
              status: "waiting",
            })
            .select("id")
            .single();

          if (error) {
            console.error("[ai-sandbox-chat] lead insert failed", error);
            return toolResultText({ ok: false, note: "The lead could not be saved." });
          }

          const pipeline = await createRealLead(args);

          await logEvent({
            event_type: "lead_captured",
            topic: state.is_open ? "callback_request" : "out_of_hours_lead",
            detail: args.cover_summary ?? null,
            customer_wording: args.notes ?? null,
            registration: args.registration ?? null,
            quoted_price: args.quoted_price ?? null,
            metadata: {
              has_name: Boolean(args.customer_name),
              has_email: Boolean(args.customer_email),
              has_phone: Boolean(args.customer_phone),
              pipeline,
            },
          });


          return toolResultText({
            ok: true,
            lead_id: data.id,
            pipeline_lead: pipeline,
            next_open: state.next_open,
            note: "Lead saved. Confirm to the customer when a specialist will be in touch and offer to finish the purchase now with a test payment link.",
          });
        },

      }),
    };


    const now = availability();
    const onlineNow = await specialistsOnline();
    const liveContext = `\n\nRight now: ${now.local_time}. The warranty specialists are ${
      now.is_open ? "OPEN and available for a live handover" : `CLOSED (they reopen ${now.next_open})`
    }. Opening hours are ${now.opening_hours}. Specialists ONLINE RIGHT NOW in live chat: ${onlineNow}${
      onlineNow > 0
        ? " — a real person can pick this chat up within seconds, so offer that whenever the customer hesitates or wants to buy."
        : " — nobody is sat in live chat this second, so do not promise an instant human; offer a callback or keep helping yourself."
    }.\nIf a message in the conversation begins with "(Warranty specialist)" a human has joined this chat — stay out of the way and only reply if the customer asks you directly.`;


    const modelMessages = await convertToModelMessages(
      messages.filter((m: any) => m && typeof m === "object" && Array.isArray(m.parts)),
    );
    if (!Array.isArray(modelMessages) || modelMessages.length === 0) {
      return new Response(JSON.stringify({ error: "No messages to send" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = streamText({
      model: gateway(MODEL),
      system: SYSTEM_PROMPT + liveContext,
      messages: modelMessages,
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
