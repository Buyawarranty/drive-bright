## Fix admin "Send Quote" flow — email design, form persistence, agent copy

Two problems, three fixes.

### 1. Customer email uses the wrong template (image 1 instead of image 2)

`supabase/functions/send-admin-quote/index.ts` currently picks `simpleHtml` (plain-text-style, matches the ugly image 1) for every Gmail / iCloud / Outlook / Yahoo recipient — which is basically every customer. The existing `marketingHtml` is also not the branded card shown in image 2.

**Replace both templates with one branded HTML that matches image 2:**

- White outer bg, centered rounded white card (max 600px), 1px `#E8ECF0` border.
- Header: centered `buyawarranty` logo (existing `baw-logo-new-2025.png`, 160px).
- Eyebrow: `HI {FIRSTNAME} — YOUR QUOTE` (uppercase, muted slate).
- H1: `{MAKE MODEL} · {PLAN} cover` (bold, dark).
- Peach price card (`#FFE9D6` bg, rounded 8px, 24px padding):
  - Left column: `FROM` label (orange 12px), then `£{monthlyPrice}/mo` (orange 40px bold), then `or £{payInFullPrice} upfront` (muted 14px). Show a `save £{savings}` line only when savings > 0.
  - Right column: solid orange `Activate →` button (bg `#EA580C`, white text, rounded 6px, 16/24 padding) → `safeQuoteLink`.
- Centered lock icon + `Takes 2 minutes` line under the price card.
- `YOUR COVER` section header (uppercase muted 12px + letter-spacing).
- Cover table (single-column card with 1px dividers, rows label left / value right):
  - Vehicle → `{REG} · {mileage} mi`
  - Cover period → `{coverMonths} months` (append ` + {bonusMonths} months FREE` when bonusMonths > 0)
  - Claim limit → `£{claimLimit} per claim`
  - Excess → `£{excessAmount}`
  - Labour rate → `£{labourRate}/hr`
- Footer inside card: `Need a hand? Call 0330 229 5040 or reply to this email.`
- Outside card: existing plain-text company/registered address block, no unsubscribe link (transactional 1:1 quote, keep out for deliverability).
- Keep the current plain-text alternative, `X-Entity-Ref-ID` header, no `List-Unsubscribe`, and `from: "{agent} at Buyawarranty <support@buyawarranty.co.uk>"`.

Drop the `isStrictMailboxProvider` branching; send the branded HTML to every recipient.

### 2. Form data vanishes after send

In `src/components/admin/GetQuoteTab.tsx` `handleSendEmail` (lines ~1200–1223), remove the automatic reset:

- Delete `setShowEmailDialog(false)` and the `setStep(1)` / `setRegNumber('')` / `setMileage('')` / `setVehicleData(null)` / `setCustomerEmail('')` / … / `setQuoteGenerated(false)` block.
- Keep the toast + `loadSentQuotesHistory()` call.
- Add local state `quoteSent` (boolean). Flip to `true` in the success path; clear it whenever any input changes or the dialog opens.
- The agent stays on Step 3 of the form with every field intact until they close the dialog or click the existing `Cancel` / start-a-new-quote control. Closing the dialog is the only trigger that resets the form (extract the current reset block into a `resetForm()` helper wired to `Dialog onOpenChange` when `open === false`).

### 3. Sales agents don't reliably get a copy

The current `agentCopyEmail` path sends an `[Internal] Quote sent — …` email from `notifications@buyawarranty.co.uk` — different sender, subject, and body than what the customer sees, which is what agents are complaining about (either spam-filtered or ignored because it's not "a copy of the quote").

**Add a dedicated "Send a copy to my email" button.**

- Rendered inside the Send-Quote dialog next to the existing `Send Email` button, disabled until `quoteSent === true` (so it appears after the customer send succeeds).
- On click, invokes `send-admin-quote` again with:
  - `to: adminEmail` (the logged-in agent's email from `admin_users`)
  - `agentCopyEmail: undefined`, `copyRecipients: undefined`
  - Same `subject` (prefixed `[Your copy] `), `quoteLink`, `customerName`, `vehicleData`, `quoteDetails` used for the customer send.
- Agent receives the exact same branded email in their own inbox, from `support@buyawarranty.co.uk`, so it lands with normal deliverability and looks identical to what the customer got.
- Show inline confirmation `✓ Copy sent to {adminEmail}` under the button. Handle `adminEmail` missing with a clear error toast (`We couldn't find your admin email — please refresh and try again`).

Leave the existing internal-copy path in place for backward compatibility (audit trail from `notifications@`), but the new button is the primary way agents get their copy.

### Technical notes

- Only files touched: `supabase/functions/send-admin-quote/index.ts` (template rewrite, no schema change) and `src/components/admin/GetQuoteTab.tsx` (state + button + dialog reset wiring).
- No DB migration, no new edge function, no route changes.
- After editing the edge function, deploy it.
- `send-quote-email` (public customer-self-serve quote) is out of scope — the admin dashboard uses `send-admin-quote`.
