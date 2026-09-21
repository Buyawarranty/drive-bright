---
name: Quote emails send from the agent's own work address
description: send-admin-quote sends from the logged-in sales agent's registered @buyawarranty.co.uk address, falling back to info@ only when it isn't on the verified domain
type: feature
---

Customer quote / follow-up emails (`send-admin-quote`) send **from the logged-in agent's registered work email** — the same person who owns the lead — so replies land with them.

- Sender = `agentCopyEmail` (resolved from the signed-in admin user) when it ends in the verified sending domain (`VERIFIED_SENDER_DOMAIN`, default `buyawarranty.co.uk`).
- Otherwise falls back to `info@buyawarranty.co.uk`.
- From name stays `<Agent> at Buyawarranty`; `reply_to` remains the agent's address.
- Internal copies and logging behaviour unchanged.
