# Appeals: "how to appeal" email + a dedicated Appeals section

## Recommendation on layout

Keep the **tag on the active claims row** (so nobody loses sight of the claim), and add a **separate "Appeals" section at the bottom of the Claims tab** for the processing work. That gives the best of both:

- Active claims stay a clean list — the row just carries an "Appeal made" / "Appeal back" tag you can click.
- The appeals workflow (stages, inspector, decision, customer updates) lives in its own panel, so appeal stages never mix with claim statuses.

Customer experience: one appeal page they return to, plus a clear email at each stage — "here's how to appeal", "we've received it", "inspector booked", "final decision".

## 1. Fix the appeal email (invitation, not acknowledgement)

The gavel button currently sends wording that reads like the appeal was already received. Change it to an **invitation to appeal**:

- Subject: "How to appeal the decision on your claim [REG]"
- Body: what an appeal is, the 3 steps (complete the form, optional independent inspection at the stated fee, we review and decide), the deadline, and the secure appeal-form button.
- Appeal record is created with stage `invited` — no "we have received your appeal" language anywhere until the customer actually submits.
- The separate acknowledgement email stays, but only fires when the customer submits the form on `/appeals/`.

## 2. Appeal stages

Add stage tracking to the existing appeal record (`claim_appeals.status`, plus small columns for inspection/decision dates and notes):

```text
invited  →  submitted  →  under review  →  inspector booked
         →  inspection complete  →  final decision  →  closed
```

Each stage change:
- shows in the Appeals section and on the claim row tag,
- optionally sends the customer an "update on your appeal" email (previewed before sending, same pattern as claim status emails),
- posts a note in the customer's profile so they always see the latest position.

## 3. New "Appeals" section at the bottom of the Claims tab

A collapsible panel below active claims, sorted oldest first, showing per appeal:
- customer, registration, claim reference, days since appeal opened
- current stage badge + "Appeal back" flag when the customer has responded
- inspection fee paid / not required
- actions: change stage, book inspector (date + inspector), record final decision (upheld / partially upheld / declined + amount), send update email, open the claim, close the appeal

Counts on the section header and the existing top-of-tab banner keep pointing at appeals that need attention.

## Technical notes

- Migration: add `stage`, `inspector_name`, `inspection_booked_at`, `inspection_completed_at`, `decision`, `decision_notes`, `decided_at` to `claim_appeals` (with grants preserved).
- `src/lib/appealEmailTemplate.ts` — rewrite as the "how to appeal" invitation; add an "appeal update" template.
- `ClaimAppealDialog.tsx` — relabel to "Invite customer to appeal", keep the preview-then-send flow.
- New `ClaimAppealsSection.tsx` rendered at the bottom of `ClaimsTab.tsx`; reuses `useClaimAppealStates` for row tags.
- `submit-appeal` edge function sets stage `submitted` and sends the acknowledgement.
- No change to active-claims queries, statuses, filters or amount editing.
