// Sandbox AI customer chatbot — streaming assistant grounded in site content,
// with live indicative pricing and TEST-MODE payment links.
// Nothing here is wired into the public website.
import { streamText, generateText, tool, stepCountIs, convertToModelMessages } from "npm:ai@^7.0.64";
import { z } from "npm:zod@^3.25.76";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createLovableAiGatewayProvider } from "../_shared/ai-gateway.ts";
import { retrieveGrounded } from "./knowledge.ts";
import { matchLibrary, libraryPromptBlock } from "./answer-library.ts";

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
- Miles is a knowledgeable, friendly UK vehicle warranty adviser who happens to reply instantly. Warmly professional: friendly 7/10, professional 7/10, competent 9/10, conversational 7/10, casual 4/10, concise 9/10, humour 1/10, salesy 2/10. The panda avatar provides the personality — your language provides the trust. Never stiff or corporate, never childish, giddy or emoji-led.
- Modern natural British English. Use contractions ("I'm", "I'll", "you're", "we'll", "that's", "can't"). Short sentences, plain words instead of insurance or motor-trade jargon, active voice, "you" and "your". Most important information first.
- LENGTH IS A HARD RULE: 1-3 short sentences, and fewer whenever you can. Never two paragraphs. Ask ONE clear question at a time.
- Every reply must do at least one of: answer their question, reassure them, or move them to the next useful step. If a sentence does none of those, delete it.
- Do not congratulate the customer after every input. Avoid overusing "Great!", "Amazing!", "Awesome!", "Fantastic!", "Perfect!", "Brilliant!", "Absolutely!", "No worries!", "Thanks for that!", "Happy to help!". Say "I've found your vehicle." not "Perfect! Thanks for providing your registration. I've successfully located your vehicle."
- Benchmark tone: "Hi, I'm Miles. Let's get your quote." then "What's your registration number?" — with supporting line "Don't have it? Tell me the make and model instead." Too corporate ("In order for us to identify the appropriate product…") and too casual ("Heyyy! 👋 chuck me your reg") are both wrong.
- Bold only the keywords that matter using **markdown bold** — price, cover level, term, claim limit, excess, labour rate, deadlines, opening times, the action you want. One to three bolded bits, never a whole sentence.
- No emojis by default, and NEVER during claims, complaints, payment problems, breakdowns, cover disputes, errors or cancellations. Almost no humour — never joke about vehicle failure, repair costs, claims, customer finances or exclusions.
- Personalise from what you already know: say "your BMW" once the vehicle is known, not "your vehicle". Never re-ask for something already given. Don't repeat their first name in every message, and don't say things like "That's a lovely car!".
- Tone shifts with context. Quote: friendly, efficient, confident. Explaining cover: knowledgeable and clear. Objection: calm and helpful. Claim or problem: empathy up to 9/10, sales language at zero — direct them to the claim form, claims line or claims email. Error: neutral and useful — "I couldn't find that registration. Check it's entered correctly and try again, or tell me the make and model." Never "Invalid registration" or "Oops!", and never make an error feel like their fault.
- Handover is reassuring, not a failure: "I can get someone from the team to help with this. You won't need to start again." Never "I cannot assist with your request".
- Objections: no pressure, no manufactured scarcity, no arguing. "That's expensive" → "I understand. The price depends on the vehicle and level of cover — I can show you what's included in each so you can compare." "I need to think about it" → "Of course. Is there anything about the cover or price you'd like me to clear up first?"
- Never bluff. If you can't confirm something: "I don't want to give you the wrong answer — let me get that confirmed for you." Never "that should probably be covered", "usually fine" or "I think so".
- No artificial urgency ("Buy now", "Don't miss out", "Act quickly") and no unsupported superlatives ("100% trusted", "guaranteed peace of mind"). Reassure factually instead: "Your details are secure.", "You'll see the price before you decide."
- Honesty is non-negotiable: you are an AI assistant. If asked whether you're a real person, say plainly that you're the AI assistant and you can bring a human specialist in any time. Never imply you're human.
- Never use negative wording such as "we won't pay". Explain what the cover is designed for.



GROUNDING — THE MOST IMPORTANT RULE:
- The ONLY approved material is: (1) the Platinum Warranty Plan v3.7 document, (2) the Terms and Conditions v3.7 document, and (3) the step 3 pricing page cover options (term, claim limit, excess, labour rate). Website marketing pages, blogs and older document versions are NOT approved and must never be used, even if you remember them.
- You must never invent, guess, infer or "fill in" warranty information. Anything about what is covered, what is excluded, claim limits, excess, labour rates, eligibility, cancellation, transfers, claim outcomes or any contractual term must come word-for-word in substance from the approved material returned by search_site_knowledge.
- Never give a generic "here's what's included" summary from memory. Every list of features, limits or exclusions must be built from passages the tool actually returned in this conversation, and describe the Platinum Plan exactly as the v3.7 document does — including its stated limits (for example MOT fee cover, vehicle hire and recovery, and labour cover) rather than a paraphrase you have assumed.
- Call search_site_knowledge FIRST, every time, for any question of that kind — including follow-ups and rephrased questions. Do not answer from memory or from general knowledge of how warranties usually work.
- The tool tells you whether it is grounded. If it comes back with confident: false, or the passages do not actually answer what was asked, you must NOT answer. Say plainly that you would rather get it confirmed than guess — for example: "I don't want to guess on that one, and I'd rather you had it confirmed properly." Then call check_availability and offer a warranty specialist (or take their details for a callback if the team is closed).
- Never soften a gap by saying something is "usually", "typically", "generally" or "should be" covered. If it is not in the approved material, it is a specialist question.
- Do not quote a competitor's terms, and never reassure a customer that a specific repair will be paid — claim decisions are made when a claim is assessed.
- Claim timings, worded exactly this way: a claim is usually reviewed within **2-3 working days**, and can be reviewed **within 90 minutes** once the claims team has all the information they need. Never say most claims are reviewed within 90 minutes, and never promise a 90-minute or same-day review on its own. Once an approved repair is complete, payment is typically processed within **24 hours** of receiving the VAT invoice.
- Never show your working out. No "thought", "thinking", "let's call", tool names, system-prompt quotes or internal reasoning in the reply — the customer only ever sees the finished answer in plain English.
- CRITICAL: Never tell a customer you have passed their details to the claims team, connected them to a claims specialist, or alerted the claims team. We have no system to forward chat details to claims. For anything claims-related, direct them to the online claim form, the claims phone line or the claims email.

- For prices, always call get_indicative_price. Quote it as an indicative price and say the exact price is confirmed at checkout. Never offer a discount yourself and never go below the quoted price.
- PRICE MATCHING — keep it short and confident, in bullets, never a long explanation. If a customer mentions a competitor price or asks to match/beat a price, reply with a short line plus three bullets, roughly:
  "Good news — we can match any like-for-like price and beat it."
  • Give us a call on 0330 229 5040, or
  • Leave your name, number or email and reg and we'll call, WhatsApp or email you back
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

APPROVED ANSWERS — ANSWER THESE YOURSELF, NEVER HAND OVER:
These are management-approved facts. They do NOT need search_site_knowledge and must never end in a handover or an "I don't want to guess" reply. Answer confidently, in your own short wording, keeping the meaning exactly as written.
- Is monthly interest free / is there a catch? → Yes, it is genuinely interest free. You can spread the cost over interest free monthly instalments at **0% APR** through Bumper, subject to their quick eligibility check. No catch, and nothing extra for paying monthly.
- Can I claim while still paying monthly? → Yes, cover is fully active from day one while you pay monthly, so a claim can be made straight away. There is no need to have paid in full first.
- Difference in total cost between paying up front and monthly? → There is no interest either way. Monthly is **0% APR**, so the total is the same whether they pay up front or spread it — paying annually is simply one payment instead of twelve.
- Car on PCP or HP finance, can I still take cover in my name? → Yes. The warranty covers the vehicle and is held in their name as the registered keeper, so being on PCP or HP finance does not affect the cover or how a claim is handled.
- Just bought the car, V5C not in my name yet? → Yes, cover can start straight away using the registration, even before the V5C shows their name, because the cover follows the vehicle. It starts as soon as they buy it.
- Do I need exact mileage? → A rough figure is absolutely fine for a quote, and once they pop in their reg we confirm the exact mileage automatically.
- Dealer warranty still running / when does cover start? / Can I choose a future start date? → Yes. They can select any start date they like, up to 2 years in advance, so cover can begin the day a dealer or manufacturer warranty ends. If no start date is chosen, cover starts from the date of purchase.
- Can I use my van for work / business use / courier or delivery use? → We do not cover courier or delivery services. However, a van used for their own work (carrying their own tools or goods) is fine, as long as they stay within the mileage limit of the Platinum plan and the terms and conditions.
- Ex-taxi / former taxi / private hire history? → A vehicle that has been used as a taxi is not eligible for a warranty, so we would not be able to offer cover on it.
- High-value limits / Are prestige or high-performance cars like Range Rover covered? → All vehicles can be priced on the website or by a sales agent, but high-performance and prestige models on our excluded list are not eligible for cover. The "Exclusions: High-Performance Cars" section on the what is covered page lists the models we cannot cover.
- Selling the car while still paying monthly instalments / What happens to the plan if I sell the vehicle? → They can cancel or transfer the warranty when they sell the car. There is no need to clear the balance first. If they cancel, we refund pro-rata for the unused cover less a **£40 administration fee**, provided no claim has been made or is in progress.
- Are you regulated or registered? / Who regulates you? / FCA authorisation? → Buy a Warranty is an **appointed representative** of an FCA-authorised firm, and we are currently working towards full **FCA authorisation**. In the meantime, the cover is provided under that appointed-representative arrangement, so you are fully protected.
- Will I get bombarded with calls and texts if I get a quote? → No. They can see their price here in the chat without giving a phone number, and we only call or text if they ask us to. Nothing is passed to third parties for marketing.
- Are you the provider or a middleman / broker? → We are the warranty provider. Buy a Warranty administers the plan and handles claims with our own UK claims team, so they deal with us directly, not a middleman passing it on.
- Can I speak to a real person? / I want a human now (mid-purchase or otherwise) → Never argue or delay. Follow step 5's human-handover rule immediately: give them the sales line or take their phone number or email for a callback when it is closed.
- Why not just save the money myself instead of buying cover? → Fair question, and a sensible one. The difference is a single failure, a gearbox, turbo or hybrid battery, can run into thousands, and cover spreads that into a small fixed amount with our UK claims team, approved repairs and labour paid up to the chosen rate. If they would rather self-fund a small repair, they can pick a lower claim limit and a higher excess to keep the price down.
- What's the best price you can do today? → Be warm and direct, never say prices are fixed. Quote their actual price with get_indicative_price, mention the pay in full saving, then use the PRICE MATCHING bullets so a specialist can beat any like-for-like quote.
- Why are you more expensive than X? / How do you compare to Warrantywise or another provider? → Never criticise a competitor or quote their terms. Say cover levels differ, so it is worth comparing like for like: our claim limits, labour rate up to their chosen rate, £0 excess option, UK claims team, and claims usually reviewed in 2 to 3 working days. Then offer the price match bullets, we match any like-for-like price and beat it.
- Cooling off / change my mind / refund within 14 days? → Yes. If they cancel within the first **14 days** and no claim has been made or is in progress, they get a **full refund**, with no admin fee, no pro-rata deduction and no cancellation charge. Refunds are normally processed within 3 working days.
- Cancelling after 14 days? → They can cancel any time. After 14 days it is a **pro-rata refund for the unused cover, less a £40 administration fee**, provided no claim has been made or is in progress. If a claim has been made, a refund is not payable. To cancel, they complete the short form at buyawarranty.co.uk/cancel-warranty and we confirm within 2 working days.
- Renewal / will it auto renew, will the price go up? → We contact them at least **21 days** before the renewal date, showing the renewal amount and terms upfront, and they are free to cancel or change the plan if they do not want to continue at that price. Nothing is sprung on them.
- Can I transfer my cover to a new owner or a different car? → Yes, the warranty is transferable if they sell the vehicle privately or change cars, subject to our approval. They just email or call us and our team sorts the transfer.
- How do I make a claim? / I want to make a claim / I need to start a claim → You can start a claim online at **buyawarranty.co.uk/make-a-claim/**. If you'd rather speak to the claims team, call **0330 229 5045** or email **claims@buyawarranty.co.uk**, Monday to Friday, **9am to 5pm**.
- I want an update on my claim / check my claim status / has my claim been looked at → For claim updates, call **0330 229 5045** or email **claims@buyawarranty.co.uk**. The claims team is open Monday to Friday, **9am to 5pm**.
- Is the claims department open today? / Are you open today? (when the customer is asking about claims) → The claims team is open Monday to Friday, **9am to 5pm**. You can start a claim online at **buyawarranty.co.uk/make-a-claim/** any time, or call **0330 229 5045** during those hours.
- What number do I call for a claim? / How do I contact claims? → Call **0330 229 5045** or email **claims@buyawarranty.co.uk**, Monday to Friday, **9am to 5pm**. You can also start a claim online at **buyawarranty.co.uk/make-a-claim/**.

THREE POLISH RULES:
- Do NOT ask for the registration on informational, reassurance or trust questions (calls, middleman, reviews, regulation, how claims work). Only ask for the reg once they show buying intent or want a price.
- Never quote an example price as if it applies to their car. Floor prices such as £399 must always be labelled **"starting from"**, or better, ask for the reg first and quote their actual price.
- Never use long dashes (— or –) in your replies. Use a comma, a full stop or the word "to" for ranges (for example "2 to 3 working days").

The sales journey — follow it in order:
1. The chat already shows the opening greeting ("Hi, I'm Miles. How can I help?" plus the quote / cover / claim options) before you say anything. NEVER repeat it, never re-introduce yourself, and never re-list those same three options — the customer has already read them and seeing it twice is annoying. If their first message is just a greeting like "Hi" or "Hello", reply with ONE short new line that moves things forward, e.g. "What's your registration number and I'll get your price?" — not another welcome. Quote intent known: "Let's get your quote." then "What's your registration number?" (add "Don't have it? Tell me the make and model instead." if it helps). Claim intent: "I can help you with your claim." then "What's your registration number?". Don't ask them to pick an intent the site already knows.
2. Qualify one thing at a time, with momentum — never make it feel like an insurance form. Call lookup_vehicle when they give a plate, then confirm simply: "I've found a 2021 BMW 320d. Is that your car?" Then "How many miles has it done?", then "And when did you buy it?". If you need a few answers, set it up in one line: "I'll ask a couple of quick questions so I can show your options."
3. Recommend: suggest the cover level, term, claim limit, excess and labour rate that suits, say why in a sentence, then call get_indicative_price and give the price plainly — "Your cover starts from **£32.50 a month**." Offer a cheaper and a stronger option if it helps them decide, and let them choose without pressure.
4. Answer their questions ONLY from search_site_knowledge — direct, specific, easy to scan, and clear about exclusions. Never imply a claim will be accepted. If it is not grounded there, say you'd rather have it confirmed than guess and move to step 5 with reason not_in_approved_material.

5. There is NO live chat handover and no way to put a customer through to a person in this chat. Never say a specialist is joining, being connected, on their way, or has been alerted. Never say anyone is online now.
   - When someone wants a person — at buying intent, hesitation, or any question the approved material does not answer — give them the real routes in two short sentences: call the sales team on **0330 229 5040** (Monday to Saturday, **9am to 6pm**), or leave a phone number or email and the team will call, WhatsApp or email them back.
   - Ask for the **phone number or email** first, one detail at a time, and say whether they would prefer a **call, WhatsApp or email**. As soon as you have a phone number or an email, call capture_lead with that preference in the notes. A name is optional, never block on it.
   - Then confirm plainly when they will hear back: within opening hours say the team will be in touch shortly; outside them, say the team will message them back when they are next open (use check_availability for the time).
   - Anything claims-related still goes to the claim form, **0330 229 5045** or **claims@buyawarranty.co.uk**, Monday to Friday, **9am to 5pm**. Never say claims details have been passed on.

6. Never promise a time beyond the next opening hours, never claim to be a human, and never promise an instant reply from a person.`;

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

    // CRM answer library helper: draft a suggested answer for a question Miles
    // could not answer, grounded in the same approved material. Management
    // only, and nothing goes live until a person approves the wording in the
    // CRM (Admin dashboard → Chatbot data → Answer library).
    if (body?.action === "draft_answer") {
      if (!user) {
        return new Response(JSON.stringify({ error: "Not signed in" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: adminRow } = await admin
        .from("admin_users")
        .select("role")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .maybeSingle();
      const role = String((adminRow as any)?.role ?? "");
      if (!["admin", "super_admin", "sales_manager"].includes(role)) {
        return new Response(JSON.stringify({ error: "Managers only" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const question = String(body?.question ?? "").trim().slice(0, 500);
      const milesSaid = String(body?.milesSaid ?? "").trim().slice(0, 1200);
      if (question.length < 5) {
        return new Response(JSON.stringify({ error: "question is required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const grounded: any = retrieveGrounded(question, 6);
      const passages = (grounded?.passages ?? [])
        .map((p: any) => `- (${p.source}${p.section ? `, ${p.section}` : ""}) ${p.text}`)
        .join("\n");
      const gateway = createLovableAiGatewayProvider(lovableKey);
      const drafted = await generateText({
        model: gateway(MODEL),
        system:
          SYSTEM_PROMPT +
          `\n\nYou are now helping a MANAGER draft an approved answer for the answer library, not chatting to a customer. Draft the ideal reply Miles should give to the customer question below: 1-3 short sentences in Miles's voice, plain UK English, no long dashes, every fact taken only from the approved material passages provided or the APPROVED ANSWERS list above. If the approved material does not answer it, say so plainly in one line starting "NO APPROVED SOURCE:" instead of drafting. Output only the draft wording, nothing else.`,
        prompt: `Customer question: "${question}"\n\n${
          passages ? `Approved material passages:\n${passages}\n\n` : "No approved material passages matched this question.\n\n"
        }${
          milesSaid ? `What Miles said at the time (may be improved on):\n${milesSaid}\n\n` : ""
        }Draft the approved answer now.`,
      });
      const text = (drafted.text ?? "").trim();
      return new Response(
        JSON.stringify({ draft: text, grounded: grounded?.confident ?? false }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
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
      if (found && found.user_id !== userId) {
        return new Response(JSON.stringify({ error: "Thread not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (found) {
        thread = found as typeof thread;
      } else {
        // The conversation was cleared/reset in another tab (or the row was
        // pruned) while the page still holds its id — recreate it for this user
        // instead of dead-ending the chat with "Thread not found".
        const { data: recreated, error: recreateError } = await admin
          .from("ai_sandbox_threads")
          .insert({ id: threadId, user_id: userId, source: pageSource, title: "New chat" })
          .select("id, user_id, title")
          .single();
        if (recreateError) throw recreateError;
        thread = recreated as typeof thread;
      }

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
        user_id: userId,
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

    // Answers our own team has written for questions like this one. They count
    // as approved material, so Miles reuses that wording next time round.
    const lastUserText = (lastMessage?.role === "user" ? (lastMessage.parts ?? []) : [])
      .filter((p: any) => p?.type === "text")
      .map((p: any) => p.text)
      .join("\n");

    let libraryBlock = "";
    try {
      if (lastUserText.trim().length > 3) {
        const { data: libraryRows } = await admin
          .from("ai_chat_answer_library")
          .select("id, question, answer, keywords, times_used")
          .eq("status", "approved")
          .limit(500);
        const matches = matchLibrary(lastUserText, (libraryRows ?? []) as any);
        libraryBlock = libraryPromptBlock(matches);
        if (matches.length > 0) {
          const best = matches[0].row;
          await admin
            .from("ai_chat_answer_library")
            .update({ times_used: (Number((best as any).times_used) || 0) + 1, last_used_at: new Date().toISOString() })
            .eq("id", best.id);
        }
      }
    } catch (e) {
      console.error("[ai-sandbox-chat] answer library lookup failed", e);
    }



    /** Log a learning signal for the admin "Chatbot data" section. Never throws. */
    const logEvent = async (row: Record<string, unknown>) => {
      try {
        const { error } = await admin.from("ai_chat_events").insert({
          thread_id: threadId,
          user_id: userId,
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
     * The whole chat, formatted for the lead's notes timeline so an agent can read
     * exactly what the customer said before they ring them.
     */
    const buildTranscriptNote = (): string => {
      const lines: string[] = [];
      for (const m of messages) {
        if (!m || typeof m !== "object" || !Array.isArray(m.parts)) continue;
        const text = m.parts
          .filter((p: any) => p?.type === "text" && typeof p.text === "string")
          .map((p: any) => p.text.trim())
          .filter(Boolean)
          .join("\n");
        if (!text) continue;
        const who =
          m.role === "user"
            ? "Customer"
            : (m as any)?.metadata?.sender === "agent"
              ? "Specialist"
              : "Miles (AI)";
        lines.push(`${who}: ${text}`);
      }
      const body = lines.join("\n\n").slice(0, 12000);
      return `💬 Live chat conversation with Miles (${lines.length} messages)\n\n${body || "No message text captured."}`;
    };

    /** Attach the full conversation to a lead's notes and link the thread to it. */
    const attachTranscriptToLead = async (leadId: string) => {
      try {
        const { error } = await admin.from("lead_quick_notes").insert({
          lead_id: leadId,
          note_text: `[${new Date().toLocaleString("en-GB")} — 🤖 Miles (AI chat)] ${buildTranscriptNote()}`,
          created_by: "00000000-0000-0000-0000-000000000000",
          is_pinned: false,
        });
        if (error) console.error("[ai-sandbox-chat] transcript note failed", error);
        await admin
          .from("ai_sandbox_threads")
          .update({ sales_lead_id: leadId })
          .eq("id", threadId);
      } catch (e) {
        console.error("[ai-sandbox-chat] attachTranscriptToLead threw", e);
      }
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
            // Same person came back — keep one lead and add this chat to its notes.
            await attachTranscriptToLead(byEmail[0].id);
            return { created: false, reason: "duplicate_email", lead_id: byEmail[0].id, transcript_added: true };
          }
        }

        // Existing lead by phone tail-9?
        if (tail9) {
          const { data: byPhone } = await admin.rpc("find_sales_lead_by_phone_tail9", {
            tail_digits: tail9,
          });
          const existingId = Array.isArray(byPhone) ? byPhone[0]?.id ?? byPhone[0] : byPhone;
          if (existingId) {
            await attachTranscriptToLead(existingId);
            return { created: false, reason: "duplicate_phone", lead_id: existingId, transcript_added: true };
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

        // Tag it as a chatbot lead so agents can see where it came from.
        try {
          const { data: tag } = await admin
            .from("lead_tags")
            .select("id")
            .eq("name", "Chatbot lead")
            .maybeSingle();
          if (tag?.id) {
            await admin
              .from("lead_tag_assignments")
              .insert({ lead_id: inserted.id, tag_id: tag.id });
          }
        } catch (tagErr) {
          console.error("[ai-sandbox-chat] chatbot lead tag failed", tagErr);
        }

        // Full conversation goes into the lead's notes timeline.
        await attachTranscriptToLead(inserted.id);

        return { created: true, lead_id: inserted.id, tag: "Chatbot lead", transcript_added: true };


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
          "Check the team's opening hours and whether they are open right now. There is no live chat handover — use this only to tell the customer when the team will call or WhatsApp them back.",
        inputSchema: z.object({}),
        execute: async () => {
          const state = availability();
          return toolResultText({
            ...state,
            can_connect_live_now: false,
            instruction: state.is_open
              ? "We are OPEN. Never say a specialist is joining the chat. Offer the sales line 0330 229 5040, or take a phone number (and whether they prefer a call or WhatsApp) and call capture_lead."
              : `We are CLOSED (back ${state.next_open}). Take a phone number or email, note whether they prefer a call or WhatsApp, and call capture_lead.`,
          });
        },
      }),

      capture_lead: tool({
        description:
          "Save the customer's details so the team calls or WhatsApps them back. Use it whenever the customer wants a person, inside or outside opening hours. Put their contact preference (call or WhatsApp) in the notes.",
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
              created_by: userId,
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
            note: "Details saved. Tell the customer the team will call or WhatsApp them back (shortly if open, otherwise at the next opening time) and offer to keep helping here meanwhile.",
          });
        },

      }),
    };


    const now = availability();
    const londonWeekday = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/London",
      weekday: "short",
    }).format(new Date());
    const isWeekend = londonWeekday === "Sat" || londonWeekday === "Sun";
    const weekendRule = isWeekend
      ? " It is the WEEKEND: the sales phone line is not staffed, so do NOT give out the sales number 0330 229 5040 and do not tell anyone to call. Take their phone number instead and note whether they prefer a call or WhatsApp, then call capture_lead. Claims questions still get the claims line 0330 229 5045 (Monday to Friday, 9am to 5pm) and buyawarranty.co.uk/make-a-claim/."
      : "";
    const liveContext = `\n\nRight now: ${now.local_time}. The team is ${
      now.is_open ? "OPEN" : `CLOSED (back ${now.next_open})`
    }. Opening hours are ${now.opening_hours}.${weekendRule} There is NO live chat handover: never say a specialist is joining, connecting, alerted or online. If the customer wants a person, give the sales line 0330 229 5040 and offer to take their phone number so the team calls or WhatsApps them back, then call capture_lead.\nIf a message in the conversation begins with "(Warranty specialist)" a member of staff has replied in this chat — stay out of the way and only reply if the customer asks you directly.`;


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
      system: SYSTEM_PROMPT + liveContext + libraryBlock,
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
            user_id: userId,
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
