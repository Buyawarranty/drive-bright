---
name: Prerendered crawler content for SPA routes
description: Crawlers see build-time HTML from scripts/prerender-routes.ts + prerender-body-content.ts, not the React page — every new route needs an entry
type: feature
---

The site is a Vite SPA, so search engines and AI crawlers read the build-time
HTML emitted by `scripts/vite-plugin-prerender-meta.ts`, not the rendered React
page. Any route missing from `scripts/prerender-routes.ts` falls back to the
homepage shell (generic title + generic H1), which is what caused Semrush's
"poor heading hierarchy" / duplicate-content flags on `/warranty-types/*`.

Rules for every new public page:
1. Add a `PRERENDER_ROUTES` entry (path with trailing slash, unique title < 60
   chars, description < 160 chars).
2. Add unique UK-specific body copy to `scripts/prerender-body-content.ts` so
   the crawler HTML has a valid outline (one H1 -> H2 sections -> H3 points ->
   H2 "Frequently asked questions" -> H3 questions) plus FAQPage JSON-LD.
3. Add the URL to `public/sitemap.xml` and the static list in
   `supabase/functions/generate-sitemap/index.ts`.
4. Copy must be original, UK-only (MOT/DVLA/£/VAT-registered garages) and never
   reused verbatim between pages or lifted from competitors.
