---
name: SEO work is visual/structural only
description: During SEO work, changes must be purely visual/structural/wording — never touch pricing, APIs, integrations, or tracking
type: constraint
---

During SEO work, all changes must be purely visual, structural, or wording.

**What's off-limits:**
- Pricing logic, calculations, matrices, floors, surcharges
- API calls, request/response formats, integrations (Stripe, Bumper, Trustpilot, Dial 9, etc.)
- Google Ads conversion tracking, GA4 tags, Meta Pixel, gclid/fbclid capture
- Any backend flows, edge functions, or database logic

**What's allowed:**
- Layout, spacing/padding, typography, wording, visual presentation
- Mobile and desktop responsive optimisation (mobile padding especially)
- Semantic HTML, meta tags, structured data, canonical tags

**Why:** User explicitly scoped SEO changes to visual/structural only. Violating this risks breaking pricing or payment flows.

**How to apply:** Every file edit during SEO work must be reviewed against this list before saving. If a change touches a value that feeds pricing or a tracking call, abort and use visual-only approaches.
