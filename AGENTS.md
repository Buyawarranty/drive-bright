# Project architecture rules
- SEO Audit reuses the Agentic Assistant chat, conversation storage and access permissions in a dedicated SEO-focused view; no second AI service or automatic site mutations are introduced.
- Careers contact/experience requirements use a shared pure validator in the form and submission function, with strict server schemas, so bypassing browser controls cannot admit an ineligible application.
- Careers rejection deadlines are stamped from dedicated settings in the database; postponement uses an access-checked RPC and the sweep uses an atomic dedicated lease, because admin_config only stores booleans. CV previews use short-lived signed storage links and render Word files as plain text.
- New pricing versions mark `websiteDiscountMode: single` and apply the one website percentage to the completed total; legacy versions keep their original rules so historical prices and unpublished live settings are not rewritten.
- Published document blogs may supply exact article HTML and schema through route metadata so crawler output preserves the same approved content as the database article without altering existing page schemas.
- Reuse CallMeBackPanel and sandbox-callback-request for optional chat phone capture, so submitted numbers follow existing chatbot lead and admin-alert delivery.
- Use the shared sale-subject formatter for manager direct-sale email source labels in both subject and body; keep existing attribution and delivery logic unchanged to avoid affecting payment flows.
- Render ORR controls through the dedicated sandbox view (legacy ORR URLs reuse it); Lead Allocation shows only a read-only mirror of the same section, so there is one editable ORR.

- Store company-wide monthly Analytics revenue goals in `monthly_revenue_targets`; keep them separate from per-agent `sales_targets` because they measure different scopes.
- Multi-year Quotes & Orders offers only 12 monthly instalments or BAW PayLater; PayLater records and credits one yearly payment at collection because uncollected future years are not revenue.
- A manual Quotes & Orders total is the final BAW PayLater term total; split it across yearly collections without adding the standard 10% uplift again.
- Route renewal leads only to active agents with the Renewals workstream; prefer the original seller, otherwise use longest-waiting rotation so new starters never receive catch-up batches.
- Auto-create renewal leads only when there is no claim, cancellation, or refund history; claim/cancel/refund renewals wait in Renewal approval and enter New Leads only after a recorded management approval, because management decides whether to re-offer cover.
- Keep the sales phone availability rule separate from live-chat presence: phone calls are offered Mon–Fri 9am–6pm and Sat 12pm–4pm UK time, with callback/WhatsApp outside those hours.
- Date of birth is collected on Bumper's own page, not in our Step 4; Step 4 hands straight to Bumper after validation so payment pricing and provider logic stay shared.
- The CRM Agentic Assistant is read-only; super admins get every part, other staff only the parts granted via tab_growth-* permissions (checked server-side + RLS); it suggests actions but must never get tools that change data or send messages, so nothing happens without a person acting.
- Lead count tab: visibility = admin/super_admin or tab_lead-count grant, never sales roles; data via get_lead_count_report RPC (checks server-side) using locked daily snapshots.
