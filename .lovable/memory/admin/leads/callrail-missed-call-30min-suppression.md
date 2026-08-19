---
name: CallRail missed call 30-min suppression
description: A CallRail missed call only becomes a lead if no agent dialled that number via Zoiper/Dial 9 within 30 minutes
type: feature
---
`auto_create_lead_from_callrail_call` skips lead creation and the "Call back urgent" tag when a `phone_events` row (Zoiper / Dial 9 click-to-dial) exists for the same phone tail-9 within ±30 minutes of the missed call time.

Rationale: if an agent already rang the customer around that time, the missed call is already handled and must not clutter New Leads.
