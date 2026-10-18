# Roadmap

- [x] Legacy semrush-seo page now opens Agentic SEO recommendations using the existing assistant and saved conversations, dated audit and accessible weekly Google/site evidence; no Semrush API required for recommendations, no public-page changes. Eight evidence/access tests pass; build OK. Preview-only.
- [ ] Verify a signed-in SEO recommendation response: external Supabase does not provide a managed test session; authenticated end-to-end remains unverified. Publication remains on hold.

- [x] Homepage image sizes: Unlimited Claims, Easy Options / Flexible Warranty Plans and High Mileage pictures reduced by 20% (348px desktop, 261px phone). Each cap now sits on the image's wrapper because a mobile media query forces `img { max-width: 100% !important }`, which overrode image-level size classes. Verified at 1280 and 393 widths with the real files loaded; build OK; nothing published.

- [x] Homepage Unlimited Claims image: homepage-only swap to the newly supplied picture as unlimited-claims-car-warranty-panda-quote-tablet.png with a 960×720 webp copy (111 KB), transparent background preserved, accurate alt text and the section label marked up as a heading; the previous homepage picture and all other pages are untouched. Publication remains on hold.

- [x] Homepage Easy Options / Flexible Warranty Plans image: homepage-only swap to the newly supplied picture as car-warranty-payment-options-monthly-yearly-3-years.png with a 960×720 webp copy (120 KB), transparent background preserved and accurate alt text; HomepageB and brand landing pages keep the old image. Publication remains on hold.


- [x] Homepage High Mileage, No Problem! image: homepage-only swap to the newly supplied picture as high-mileage-electric-car-warranty-uk.png with a 960×720 webp copy (88 KB), transparent background preserved and accurate alt text; the previous homepage picture and all other pages are untouched. Publication remains on hold.


- [x] Compress five replacement pictures: homepage WebP copies at 960×720 and FAQs copy at 384×288, preserving transparency, approved descriptions and descriptive filename stems; originals retained for earlier deployments. Publication remains on hold.

- [x] Homepage Complete Car Warranty image: replaced only this homepage placement with the supplied branded panda; descriptive car-warranty-used-older-car.png filename and accurate alt text on both layouts. Publication remains on hold.
- [x] Homepage Unlimited Claims image: homepage-only swap to used-car-warranty-unlimited-claims-panda-orange-hatchback.png with accurate alt text; other pages keep the old image.
- [x] Homepage Flexible Warranty Plans (Easy Options) image: homepage-only swap to lowest-cheapest-extended-warranty-uk.png with accurate alt text; HomepageB and brand landing pages keep the old image. Publication remains on hold.
- [x] Homepage High Mileage, No Problem! image: homepage-only swap to ev-hybrid-extended-car-warranty-uk.png with accurate alt text; HomepageB and brand landing pages keep the old image. Publication remains on hold.

- [x] FAQs page: replaced the old savings panda with the uploaded branded panda, preserving its supplied filename, existing size, desktop-only placement, questions and schema. Preview-only.
- [x] Weekly SEO optimisation reviews: scheduled Mondays 09:00 UTC; first deployed review checked 107 pages, stored 14 proposals and created two super-admin reminders. Two function tests pass; build OK. Private evidence and super-admin authorisation controls added; no automatic edits or publication. Authenticated staff UI remains unverified on external Supabase; frontend unpublished.
- [ ] Weekly SEO setup: whole-domain Google property verified and saved. seo@buyawarranty.co.uk has no staff or sign-in account yet, so recipient access awaits account creation. Semrush reconnect was interrupted and remains incomplete (expired authorisation). Reminders currently reach super admins only; backlink evidence remains incomplete.

- [x] Image SEO wave: inspected 116 rendered preview routes / 1,028 image instances / 300 sources; no missing alt attributes, 35 decorative van icons. Article cards and related images reuse approved photo descriptions; verified seven real published card photos, two related images and both clarified mascot descriptions. Filename review preserved already-descriptive names and stable URLs. Twelve SEO/access tests pass; build OK. Evidence and six observed delivery failures recorded in SEO Audit; no schema, tracking or imagery changes. Unpublished; signed-in admin report unverified on external Supabase.

- [x] Lead count: distinct blue/gold/magenta received chart, contrasting source colours, all current statuses, callbacks booked, overlapping paid/hot/awaiting/reminder/return/checkout activity, source comparisons and CSV. Private access-checked aggregate preserves locked snapshots; migration checks actual cohort total and signed-out denial. Eight tests and isolated browser table/download checks pass; build OK. Signed-in end-to-end unavailable on external Supabase; unpublished. Existing unrelated security findings remain unchanged.

- [x] Abandoned Carts: list and every export use a fail-closed, active-staff-checked history filter covering all customer records (including deleted/cancelled/refunded), policies, claims, purchased quotes and completed provider payments, matched by normalised email, UK phone or registration. Exports recheck history before downloading. Eight tests pass; database evidence confirms customer, policy and claim matches; preview build OK. Signed-in staff flow cannot be verified on external Supabase. Frontend remains unpublished; checkout and outreach unchanged.

- [x] Continue prioritised SEO improvements: shared social-image metadata preserves approved descriptions and removes unverified custom dimensions; duplicate cancellation inventory removed without changing effective output; footer link variants normalised. Audit evidence extended. Twelve tests pass; browser confirms FAQ default dimensions, Blog 15 approved alt with no invented dimensions, contact/transfer pages rendered and no uncaught errors. Build OK; pricing, tracking and schema unchanged. Publication remains on hold.

- [x] Public-site technical SEO audit: 116 public URLs and 41 published articles recorded in SEO Audit with Google Search Console evidence, prioritised actions and assistant context. Added missing metadata/sitemap routes, corrected social-image metadata and transfer URL, and noindexed missing articles. Eight tests and preview checks pass; isolated report filtering/download verified. Authenticated staff view unavailable on external Supabase. Unpublished; schema, tracking and pricing unchanged.
- [ ] Remaining SEO checks: factual/contractual article review needs approved content decisions; primary-domain delivery needs explicit publication and deployment access; full speed/link and AI/social visibility measurement needs further audit evidence. These gaps are listed in SEO Audit, not represented as completed checks.

- [x] SEO Audit: dedicated admin section reusing Agentic Assistant and its permissions for on-demand SEO suggestions and saved conversations; existing AI service, integrations, pricing, tracking and schema unchanged. Build and access tests pass. Staff-session AI response verification unavailable on external Supabase; not published. Full-site crawling and scheduled audits are not included.

- [x] Careers public page: required email/phone and warranty-sales confirmation, relevant sales recruitment wording and revised short-note prompts. Seven rule tests pass; browser controls and deployed server rejection verified. Existing Careers storage/email delivery unchanged; successful submission/email receipt not re-tested. Website not published.

- [x] Careers Applications: default All view restores 39 stored rejected applicants; bulk actions, PDF/Word CV preview/download, configurable five-working-day rejection and delay controls; applicant pop-up removed. Rule tests and build pass. Staff-session verification unavailable on external Supabase; page changes not published.

- [x] Customer Management: "All direct (every source)" filter added to the Source dropdown — counts every customer who bought on the website themselves (Google/Meta/TikTok/Bing/organic), works on historic data. Build OK, preview-only.
- [ ] ORR Live + Overnight brief: Phase 1 migration + backfill done (23,618 leads stamped ROUND_ROBIN/LIVE). Next: Phases 2-10 per .lovable/plan.md (sandbox routing, allocator, retry engine, staffing, agent/manager UI, test controls, go-live). ORR stays sandbox-only.
