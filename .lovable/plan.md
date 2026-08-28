# Stop Miles jumping to "Build your price" when the customer only asked about cover

## Problem

When a customer asks "what's covered?" and gives their registration, Miles looks up the vehicle — and the moment the lookup happens, the **Build your price** panel appears and the conversation is steered to pricing, even though the customer never asked for a price. The coverage question they actually asked is effectively abandoned.

## Root cause (confirmed)

1. In `src/components/ai-sandbox/SandboxChatWindow.tsx`, `hasPriceQuote` is set to true when **either** `tool-get_indicative_price` **or** `tool-lookup_vehicle` has run. A vehicle lookup alone is enough to mount the price panel — that's why entering the reg triggers pricing.
2. In `supabase/functions/ai-sandbox-chat/index.ts`, the conversation flow tells Miles that after identifying the vehicle he should recommend cover and call `get_indicative_price` — with no distinction between a customer who asked for a quote and one who asked a cover question.

## Changes

### 1. Chat window — only show the price panel on real pricing intent
`src/components/ai-sandbox/SandboxChatWindow.tsx`
- Change `hasPriceQuote` so the panel appears only when `tool-get_indicative_price` has run (an actual price was quoted) — drop the `tool-lookup_vehicle` trigger.
- The "Continue to checkout" hand-off keeps using the detected reg/mileage as before; only the panel trigger changes.

### 2. System prompt — answer the question asked before selling
`supabase/functions/ai-sandbox-chat/index.ts` (prompt block around lines 49–83)
- Add a rule: after a vehicle lookup, **answer the customer's actual question first** (e.g. cover questions answered from the approved material). Only move to recommending cover/price when the customer asked for a quote or price, or after their question has been answered and they show buying intent.
- Adjust flow step 3 (Recommend) so it applies to quote/price intent, not to coverage or claims questions.
- Redeploy the `ai-sandbox-chat` edge function.

## Verification

- Typecheck/build.
- Browser test on `/used-car-warranty-uk/`: ask "what's covered?", enter a reg, confirm Miles answers the cover question and **no price panel appears**; then ask "how much would it cost?" and confirm the panel appears after a price is quoted.
- Chat stays only on `/used-car-warranty-uk/` — no other pages touched.

## Technical details

- Files: `src/components/ai-sandbox/SandboxChatWindow.tsx`, `supabase/functions/ai-sandbox-chat/index.ts`
- No database changes. No changes to the quote-journey pages or pricing engine.
