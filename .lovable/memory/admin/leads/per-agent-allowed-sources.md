---
name: Per-agent allowed lead sources apply to both rotations
description: agent_distribution_caps.allowed_sources ("Sources they handle") restricts an agent to e.g. Meta-only leads in Round Robin AND Open Round Robin
type: feature
---
`agent_distribution_caps.allowed_sources` (set per agent in the Lead Allocation "Sources they handle" column) is the single per-agent source restriction. NULL or empty = every source.

Honoured by:
- Round Robin: `pick_agent_for_distribution` / `pick_agent_for_distribution_legacy`.
- Open Round Robin (added Sep 2026): `orr_offer_lead_to_next`, `orr_next_retry_lead(_agent)`, `orr_claim_pool_lead`, `orr_assign_attempt_one`, `orr_assign_retry`, `orr_agent_next_work` — all via helper `public.agent_accepts_lead_source(agent, source)`, which tolerates legacy stored spellings through `public.lead_source_aliases()` (website/organic/direct, social_ad/facebook/meta, google_ad/google, bing_ad/bing/microsoft, tiktok_ad/tiktok).

Rules:
- Pushing/assigning a lead from a disallowed source returns reason `source_not_allowed`.
- `orr_next_retry_lead` takes an optional agent so each agent's "top of queue" is their own eligible top — never a lead they cannot take.
- Restricted agents look permanently "furthest behind" in ORR's fairness order; that is expected, they simply get their eligible leads first.
