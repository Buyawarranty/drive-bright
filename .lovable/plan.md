

## Problem

The canonical tag is not visible in the production site's page source. Two root causes:

1. **`SEOHead` component uses raw DOM manipulation** (`document.createElement` in `useEffect`) instead of `react-helmet-async`. Tags injected this way don't appear in "View Source" and are less reliably crawled by search engines.

2. **Dual system conflict**: Brand warranty pages use `<Helmet>` from `react-helmet-async` (correct approach), while ~39 other pages use the old `SEOHead` component (broken approach). The `HelmetProvider` is already wrapping the app in `main.tsx`.

## Plan

### Step 1: Rewrite `SEOHead` to use `react-helmet-async`

Convert the component from raw DOM manipulation (`useEffect` + `document.createElement`) to rendering a `<Helmet>` component with all the same meta tags, canonical link, and OG tags as JSX children. This is the single change that fixes every page using `SEOHead`.

**Key change**: Replace the entire `useEffect` body with a `return <Helmet>...</Helmet>` containing all the meta tags, the canonical `<link>`, and the `<title>`.

### Step 2: Remove the hardcoded canonical from `index.html`

Remove line 20 (`<link rel="canonical" href="https://buyawarranty.co.uk/" />`) from `index.html` to avoid conflicts with the dynamic canonical set by `SEOHead` via Helmet. The React component will now be the single source of truth for all pages including the homepage.

### What stays unchanged
- All 39+ pages that use `<SEOHead />` — no changes needed, they'll automatically benefit from the fix
- All brand warranty pages that already use `<Helmet>` directly — untouched
- All props and API of `SEOHead` — identical interface, just different internal implementation
- No changes to any page component files

### Technical detail
`react-helmet-async` manages `<head>` tags through React's rendering pipeline rather than imperative DOM manipulation. This means tags appear in the rendered DOM immediately (not after a useEffect tick) and are properly visible to Google's crawler. Since `HelmetProvider` already wraps the app, this is a drop-in fix.

