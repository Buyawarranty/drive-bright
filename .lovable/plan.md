# Open Round Robin attempt-based ownership

## Goal
Make Open Round Robin treat an agent assignment as a temporary reservation until the customer is actually reached. An unanswered attempt returns the lead to the shared retry pool, where any eligible available agent may receive the next attempt.

## Changes

### 1. Make the database the source of truth
- Update the live Open Round Robin outcome function so **No answer**, **Voicemail**, and **Line busy**:
  - record the genuine attempt against the lead;
  - clear the temporary agent reservation and both ownership fields;
  - place the lead in the shared retry/waiting state until its next eligible contact time;
  - preserve the lead’s 7-contact-day journey and prior call history.
- Make **Spoken to / Connected** the ownership boundary:
  - assign both current ownership fields to the agent who reached the customer;
  - remove the lead from Open Round Robin retry circulation;
  - retain normal quote, callback, follow-up, and conversion behaviour.
- Keep wrong-number and terminal outcomes following their existing specialist/closed paths.
- Ensure the picker selects due retry leads from the shared pool, not only retries previously associated with the same agent.

### 2. Match the supplied lead-desk layout
- Add a clear current-lead area above the existing merged lead table, using the project’s current controls and styling rather than a separate page.
- Show the current Open Round Robin reservation with customer details, call/email/quote/note actions, status control, and the countdown.
- Use the exact ownership language:
  - **Open Round Robin · Reserved for this attempt** before contact;
  - **Not owned · Returns to retry pool** after an unanswered attempt;
  - **Connected · Assigned to [agent]** after customer contact.
- Keep Round Robin and Open Round Robin leads together in the same table. Preserve the existing agreed column order, with Time to Lead as the only ORR-specific column.

### 3. Remove misleading ownership wording
- Replace messages such as “lead claimed”, “call in time and the lead stays with you”, and “saved for your next attempt”.
- Update confirmation messages and tooltips so agents cannot confuse dialling with ownership.
- Keep the existing disabled ORR pop-up disabled; this work does not re-enable or replace it.

### 4. Validate safely
- Verify an unanswered attempt clears the temporary salesperson and becomes available to another eligible agent only when due.
- Verify a connected outcome assigns the lead permanently to the caller.
- Verify repeated unanswered attempts continue the same lead-level 7-day journey.
- Run the project type-check and inspect the updated lead desk at desktop and mobile widths.

## Technical notes
- Schema changes will be applied through a Supabase migration by replacing the relevant SECURITY DEFINER functions; no new table is required.
- Existing call logs, audit rows, reservation cleanup, RLS, and realtime cleanup remain in place.
- The sandbox remains read-only and mirrors the wording/state model without writing to live leads.
