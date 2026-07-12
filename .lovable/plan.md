## Open Lead Pool — reservation → calling → outcome workflow

Reshape the Open Lead Pool from a single "60s to finish" countdown into a three-phase state machine that matches how real calls actually run. Renames "Release lead" → "Cancel lead" throughout.

### New state machine (per reservation)

```text
RESERVED (120s countdown)
  ├─ Call started  → CALLING (no countdown, slot occupied)
  └─ Timer expires → auto-cancel, lead returns to pool

CALLING
  ├─ Spoken to  → SPOKEN_OUTCOME (slot stays occupied until sub-outcome picked)
  └─ No answer  → NO_ANSWER (slot freed; 15-min first-retry rights held)

SPOKEN_OUTCOME  (agent picks: Callback requested / Quote sent / Interested / Not interested / Converted / Other)
NO_ANSWER       (agent picks: Voicemail left / Busy / Try again 15m / Wrong number)

Idle guard while CALLING:
  10 min → "Outcome still required" nudge
  15 min → "Are you still working this lead?" (Still working +10m / Log outcome)
  Ignored → auto-release with system note "Automatically released — no outcome recorded"
```

### Files touched

**Reservation store** — `src/hooks/useOpenLeadPoolReservation.ts`
- Add `phase: 'reserved' | 'calling'` and `callStartedAt: number | null`.
- Add `markCallStarted()` and `extendCalling(ms)` helpers.
- Countdown hook only ticks in `phase === 'reserved'`; in `calling` it returns elapsed since `callStartedAt` instead.

**Top bar** — `src/components/admin/leads/OpenLeadPoolBar.tsx`
- Two visual states:
  - Reserved: "Reserved for you · m:ss — Start the call or cancel the lead" · buttons `Call` (primary) + `Cancel lead`.
  - Calling: "Call in progress — Log the outcome when the call finishes" · button `Cancel lead` only; no short countdown, show `Working for m:ss` subtly.
- Rename all "Release" copy → "Cancel". Auto-expiry toast for reserved phase reads "Lead cancelled — no call was started before the reservation expired."

**Quick log panel** — `src/components/admin/leads/notes/UnifiedNotesPanel.tsx`
- Replace flat chip list with a two-step chooser:
  - Step A (default): two equal primary buttons `Spoken to` (emerald) + `No answer` (orange), with matching sub-labels ("Connected with the customer" / "Customer did not answer").
  - Step B: after choice, reveal the matching sub-outcome chips only. A small "Change" link returns to Step A.
- `Spoken to` → keeps lead until sub-outcome chosen. Sub-outcomes: Callback requested, Quote sent, Interested / thinking, Not interested, Converted, Other.
- `No answer` → immediately frees the active slot (clears reservation) and marks the lead with 15-min protected retry. Sub-outcomes (Voicemail / Busy / Try again 15m / Wrong number) log an extra note but do not re-block the agent.
- Existing outcomes (`voicemail_left`, `callback_requested`, `not_interested`, `wrong_number`, `quote_sent`, `spoke_to_customer`) are reused; sub-outcomes without a dedicated enum log as notes plus the closest existing outcome.

**Idle guard (Calling phase only)** — small hook inside `OpenLeadPoolBar.tsx` or new `useCallingIdleGuard.ts`
- At 10 min: toast "Outcome still required" (once).
- At 15 min: modal "Are you still working this lead?" with `Still working` (+10 min) and `Log outcome` (scrolls to quick-log). Track extensions in state.
- If ignored 60s after the 15-min prompt: auto-cancel with `lead_activities` note "Automatically released — no outcome recorded".

### Copy changes

- Top-bar main line (reserved): **"Reserved for you · 1:55 — Start the call within this window. Once started, take the time needed and record the outcome when finished."**
- Top-bar main line (calling): **"Call in progress — Log the outcome when the call finishes."**
- Any button labelled "Release lead" / "Release" → **"Cancel lead"**.
- Expired reserved: **"Lead cancelled — no call was started before the reservation expired."**
- Auto-release after ignored idle prompt: **"Automatically released — no outcome recorded"**.

### Out of scope (deliberately)

- No DB/RPC schema change. The existing `open_pool_get_next` / `open_pool_log_outcome` RPCs stay as-is; the phase/idle guard state lives in the client reservation store plus `lead_activities` notes. If a durable server-side "calling" flag is later needed we can add it, but this refactor keeps behaviour reversible.
- No changes to `useRenewalPoolReservation` (renewals unaffected).
- Phone integration remains stubbed — clicking `Call` counts as call started, as specified.

### Verification

- Reserve a lead → bar shows 2:00 countdown + `Call` / `Cancel lead`.
- Wait past 120s without clicking `Call` → auto-cancelled with the "no call was started" toast.
- Click `Call` → countdown disappears; bar reads "Call in progress"; quick log shows two equal buttons.
- Click `No answer` → sub-outcomes appear; slot is released so `Take next lead` re-enables immediately.
- Click `Spoken to` → sub-outcomes appear; slot remains occupied until one is chosen.
- Leave `Calling` state idle 10 min then 15 min → nudge then modal fires; `Still working` adds 10 min.
