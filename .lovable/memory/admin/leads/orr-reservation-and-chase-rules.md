---
name: Open Round Robin reservation and chase rules
description: Held-for-you reservations, No answer attempt counting, 7 contact days, 3-hour gaps, weekday/weekend windows, staggered release
type: feature
---
**Reservation (temporary, current attempt only)**
- A new lead is unowned. Round Robin gives one eligible available salesperson a reservation for the CURRENT call attempt only — never permanent ownership.
- Time to Lead cell shows a compact green card: 🔒 Held for you → countdown "1m 23sec left to call" → "Lead arrived Xago · Day X of 7 · Call X of 2 today" → optional "Previous: No answer" → thin progress bar. No manager alert box, no "Not offered yet", "Next available agent", "Still yours", "Call first" or "AutoProtect" wording anywhere.
- Reservation lapsing with no call: release immediately back to the pool, do NOT count an attempt, no priority for that salesperson next time.

**No answer (a real call that didn't connect)**
- Counts as ONE genuine attempt. Lead leaves the salesperson's active queue (never stays assigned), enters a waiting state, then re-enters Open Round Robin at its next eligible time; normal rotation picks whoever is next — no preference for the previous salesperson.
- Confirmation wording: "✓ No answer logged / Day X of 7 · Call X of 2 complete / Back in Round Robin from …". Lead stays searchable in history, never deleted.

**Ownership boundary**
- Dialling never creates ownership. Before contact the state is **"Open Round Robin · Reserved for this attempt"**.
- No answer, voicemail, or busy clears the reservation and both agent ownership fields. The state is **"Not owned · Returns to retry pool"**.
- Only confirmed customer contact creates ownership. The state is **"Connected · Assigned to [agent]"**, after which normal quotes, callbacks and follow-up stay with that salesperson.
- The 7-contact-day journey belongs to the lead, not to any salesperson. Different eligible agents may make different attempts until one connects.

**Cadence**
- Chase = 7 CONTACT days (not calendar days). Weekdays 09:00–18:00; weekends ad-hoc staffed window ~10:00–13:00.
- Up to 2 genuine attempts a full weekday, normally 1 per weekend day. Minimum 3 hours between attempts, computed from the ACTUAL previous attempt time (09:15 → 12:15), never a fixed clock time. If +3h lands at/after close, move to the next staffed window.
- Wording is "Back in Round Robin from…" / "Next attempt eligible from…", never "Next call at…".
- Waiting leads are fed back progressively (oldest/due first, a couple per sweep) — never one big 09:00/10:00 batch.

**UI**
- One outcome control only: the Status dropdown (no duplicate No answer button in Actions). Actions = equal-sized icon buttons: Call, Notes, Email, Reminder, Quote, More.
- Activity wording: "Last activity" / "No activity yet" — never "Last touched". Customer Activity describes customer behaviour ("Viewed quote page · 3h ago").
- Chase finishing may display "Chase complete · 7 contact days completed" but must NOT auto-archive, recycle, close or reassign. No invented permanent ownership after successful contact.
