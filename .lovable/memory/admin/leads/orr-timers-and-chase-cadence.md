---
name: ORR timers and chase cadence
description: Open Round Robin day-one rhythm — 2-min browsing window, 2-min reservation, 15-min same-agent second try, hold until 1pm, then twice daily for 7 days
type: feature
---
**Two separate clocks**
- Customer browsing window: 2 minutes after submission before any agent is offered the lead (they may still be on pricing/checkout).
- Agent reservation window: 2 minutes to START the call. UI: "Reserved for you — 01:58 / Start the call before this timer expires". Lapsing releases to the next available agent and does NOT count an attempt.

**Day one**
- Attempt 1 happens as soon as the browsing window passes.
- No answer / voicemail / busy on attempt 1 → the SAME agent gets the lead back 15 minutes later (`orr_retry_preferred_agent`), held exclusively for them for 10 minutes, then open to any eligible agent.
- Second miss → lead is blocked until **1pm the same working day** (or the next working slot if 1pm has passed).

**Thereafter**
- Twice a day, 09:30 and 15:30 Europe/London on working days, for 7 days = 14 attempts max, then `shark_tank_settings.no_answer_final_action` (default lost → nurture_queue).

**Ownership**
- Dialling never creates ownership. Only confirmed customer contact makes the lead the caller's.

**Implemented in:** `open_pool_get_next`, `open_pool_log_outcome`, `open_pool_next_call_slot`, `sales_leads.orr_retry_preferred_agent`, `src/components/admin/leads/OpenLeadPoolBar.tsx`, `src/hooks/useSharkTank.ts`.

Watch total delay (submission → first ring ~2 min) and compare conversion against faster variants.
