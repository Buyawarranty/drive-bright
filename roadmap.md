# Roadmap

- [x] Chatbot data: show every live-chat request still awaiting a human reply in one all-time pending list
- [x] Customer Management: replace confusing split source/path tags with clear labels such as Google lead and Google direct sale
- [x] Direct-sale notifications: reliably email every completed website sale and name the channel clearly in the subject
- [x] Recontact leads: default the date filter to All time so 60-day-old assigned leads do not open as a blank list
- [x] Daily CRM survey: hyper-focused blue/orange agent and manager views with one-tap answers, progress, today's completion and urgent-problem visibility
- [x] Discounts given: de-duplicate repeated manual price override rows (same agent/customer/price seconds apart)
- [x] Discounts given: agent filter must also filter the manual price overrides table
- [x] Discounts given: stop showing all-zero cards/bands/detail table on the 1st of a new month — land on the latest month that has sales and explain empty ranges
- [x] New Leads: date quick links + date selector must work for sales agents (moved links outside popover; picked date window now overrides the 60-day feed trim)
- [x] New Leads: fetch each sales/sales_lead agent's complete selected date range directly by owner, using the indexed created date and a date-preserving fallback so timeouts cannot reduce a month to the latest 500-row slice
- [x] New lead pop-ups: agents missed their own brand-new leads because rows with a NULL assigned_at fell outside the 50-row window ordered by assigned_at — now read both orderings and merge
- [x] GCLID: store the Google Click ID on each lead (sales_leads.gclid), auto-filled from the visitor's basket/customer record, backfilled for existing leads, and shown in the lead source tooltip
- [x] CRM reliability: fix the shared request starvation behind missing new-lead pop-ups and slow/non-loading tabs for James, Freddie and Thomas; alert reads now use the urgent lane, retain the last queue on transient failure, retry during heavy-tab loads, and scope dismissals per agent
- [x] Website chat "speak to a human": during opening hours the request must always ring every manager/staff member in the CRM (handover alert popup mounted in the dashboard), never answer with a reopen time
- [x] CRM: live-chat banner at the top of the whole dashboard during opening hours (9am-6pm Mon-Sat), visible to claims staff too
- [x] Unsubscribe tab: sales agents' `?tab=unsubscribe` links did nothing because the dashboard only read the tab param on mount — now follows URL changes, and the Unsubscribe quick link keeps the rest of the query string
- [x] Banners must never be cut off: top CRM banners are inset by the fixed sidebar width on desktop and the struggle/failed-payment bar wraps instead of truncating
- [x] Chatbot pop-up permission: "Customer waiting for a specialist" ring/pop-up is now permission-gated (`tab_chatbot-popup`) — default ON for admin, super admin and claims only; anyone else needs it switched on in User Permissions
- [x] Chatbot pop-up mute is a clear Mute/Muted toggle and now persists (localStorage), so muting really stops the ring
- [x] Chatbot Data dashboard: remove the duplicate audio listener, cancel scheduled ring bursts immediately on mute, and stop all alert polling/audio when pop-up access is denied
- [ ] Renewals → New Leads: policies 60 days from expiry become real new leads owned by the original selling agent, else normal round robin
- [ ] Renewal eligibility: exclude anyone ever cancelled or refunded, unresolved complaints/disputes/chargebacks, fraud flags and contact restrictions; declined claims alone must NOT block renewal
- [ ] Renewal cadence: 60d create lead + light notice, 30d main contact, 14d reminder, 7d stronger reminder, 1-2d optional final — stop the cadence once renewed or declined
- [x] Stripe charge.dispute.created/updated webhook tags the customer "Payment Disputed" (blocks renewal + repurchase)
- [x] Claims action "Flag as misrepresented — do not cover" applies "Misrepresentation – Do Not Cover" across all of a customer's records
- [x] Checkout (Stripe + Payment Assist) blocked for flagged customers with a call-us message
- [x] Claims row action: shield icon to mark a claim as misrepresented (labels customer, excludes from renewals)
- [x] Claims list: up/down sort arrows on Submitted, SLA and Days On Risk, default newest submitted first
- [x] Chatbot pop-up: sales and sales_lead are hard-blocked from the "customer waiting" pop-up AND the live-chat top bar, even if the permission is toggled on
- [x] Claims staff no longer see the "stuck on checkout" struggle alert bar (sales/management only)
- [x] Claims Appeals section restyled from dark navy to light amber/orange
- [x] Public appeal form at /appeals/ built to the same design as /complaints/, with submit-appeal function feeding the Appeals inbox
- [x] /appeals/ is public request-only ("Warranty appeals" in footer); full appeal form gated behind emailed secure link (?token=) or signed-in customer dashboard
- [x] Appeals independent inspection: add Worldpay £140 payment link when customer chooses "Yes please", explaining ACE/Scotia selection and that payment covers the independent inspection visit
- [x] /appeals/: "Not sure yet" renamed "Not sure / speak to an expert"
- [x] /appeals/: Worldpay £140 payment link shown inside the "What happens next" panel (live link when opened from a secure appeal link)
- [x] /appeals/: appeal only needs a name plus EITHER registration or warranty number — email/phone/last name optional, email looked up from the customer record
- [x] Appeals: instant acknowledgement email on submission, promising a proper response within 2 working days and warning inspections can take up to 3 weeks
- [x] Claims tab: merge the separate Appeals section into the main claims list with a big "APPEAL MADE" tag on the claim row
- [x] Claims row action: send the appeal-invite email (secure link) with an on-screen preview before sending
- [ ] Customers edit dialog: add a "Paused" status that records the pause date and shows how much cover remains if restarted

- [ ] Appeals form: drop email/phone fields, enforce registration validation
- [ ] Independent inspection page: allow either garage details OR home address
- [ ] Inspection payment page: remove SSL / engineer / FCA trust row and card logos
- [ ] Inspection page: "Approximate turnaround 7-21 working days" wording
- [ ] Inspection page: bold + compulsory ACE acceptance checkbox (7-14 working days)
- [ ] Step 4 Change vehicle dialog: standard square-ish modal size with padding (not full width)
- [ ] Payment Assist monthly checkout fails for S17DRW: PA API rejects telephone (invalid telephone) — normalise UK phone before send
- [x] Renewals tab: New Leads column order + previous-warranty hover popover (price, duration, excess, claim limit, add-ons); latest note moved into the note popover
## Open
- [x] Test phone 07960 111131: allow it throughout the website and chat, but show a TEST tag in New Leads
- [x] Miles chatbot: simplify opening view to four actions, reveal registration only after Get a quote, and remove duplicate top callback action
- [x] WhatsApp Leads: Import leads first, Send message second, with split tabs and slight dividers
- [x] Renewals assignment order: seller-first confirmed in DB function; preview panel added
- [x] Sandbox mockup: RenewalAssignmentFlowPanel in Engine & settings
- [ ] Payment Assist browser-flow verification (S17DRW / RV19OWW)

## Renewals queue (Sep 2026)
- [ ] Sync renewal assignment with selected distribution mode (round robin / open round robin); never leave a renewal unassigned
- [ ] Clear "Renewal" tag on every renewal row
- [ ] Sync New Leads activity (notes, calls, status, owner) into the renewals row

- [x] Blank "Warranty Cancellation Request - undefined" email: add field validation to submit-cancellation
- [x] Open Round Robin practice "overnight leads" panel restyled to match New Leads table (columns, badges, status dropdown, action buttons, phone/email/reg styling)
- [x] Open Round Robin Team Blue practice header: "Your turn" column moved next to "Agent" column
- [x] Stop 20% off marketing reminders going to customers who already hold active warranty cover (Jenny Beaumont)
- [ ] Renewals: 90-day window, feed every 2h into Renewals + New Leads
- [ ] Open Round Robin: plan safe merge into New Leads (sandbox only, no live impact)

## Chatbot answer library (Sep 11)
- [x] Managers write/approve answers in Chatbot data tab; Miles reuses them for same/similar questions
