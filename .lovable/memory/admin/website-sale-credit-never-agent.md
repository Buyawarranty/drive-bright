---
name: Website/ad self-serve sales stay with Website
description: Non-manual customer records from website/Google/Facebook/Bing never inherit the lead agent as owner
type: feature
---
A customer record created by the website checkout (`is_manual_entry = false`) with an online acquisition source (`website`, `direct`, `google_ads`, `facebook_ads`, `bing_ad`, `social_ad`) or a `gclid` is a self-serve sale and is credited to **Website** — `customers.assigned_to` must stay NULL.

- Enforced in the `sync_owner_from_lead_on_customer` trigger: it returns early with `assigned_to = NULL` for these rows instead of copying the earlier enquiry lead's agent.
- Sales an agent entered themselves (`is_manual_entry = true`) keep their agent, even if the acquisition source is an ad channel — the source describes where the enquiry came from, not who closed it.
- Matching rule on leads: `auto_reassign_google_ad_conversion` nulls `assigned_to` when a website/ad lead flips to `converted`; `guard_website_sale_owner_locked` blocks non-management from assigning an agent to it.
