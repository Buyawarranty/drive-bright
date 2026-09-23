/**
 * Vite plugin: emits a static <route>/index.html for each entry in
 * PRERENDER_ROUTES, with route-specific <title>, <meta description>,
 * canonical, Open Graph and Twitter tags injected.
 *
 * Body content is unchanged — React Router hydrates the SPA as normal.
 * The point is purely to give social scrapers and crawlers correct meta tags.
 */

import type { Plugin } from "vite";
import { promises as fs } from "node:fs";
import path from "node:path";
import {
  PRERENDER_ROUTES,
  SITE_URL,
  DEFAULT_OG_IMAGE_URL,
  type RouteMeta,
} from "./prerender-routes";
import { getPageBody, PRERENDER_LINKS, type PageBody } from "./prerender-body-content";

function escapeHtmlAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeHtmlText(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Replace meta tags by attribute name (e.g. og:title) or basic name attr.
 * Falls back to inserting a fresh tag if not present.
 */
function setMeta(
  html: string,
  matcher: { kind: "name" | "property"; key: string },
  content: string,
): string {
  const safeContent = escapeHtmlAttr(content);
  const attr = matcher.kind;
  const pattern = new RegExp(
    `<meta\\s+${attr}=["']${matcher.key}["'][^>]*>`,
    "i",
  );
  const replacement = `<meta ${attr}="${matcher.key}" content="${safeContent}" />`;
  if (pattern.test(html)) {
    return html.replace(pattern, replacement);
  }
  // Insert before </head>
  return html.replace(/<\/head>/i, `    ${replacement}\n  </head>`);
}

function setTitle(html: string, title: string): string {
  return html.replace(
    /<title>[\s\S]*?<\/title>/i,
    `<title>${escapeHtmlText(title)}</title>`,
  );
}

function setCanonical(html: string, url: string): string {
  const safe = escapeHtmlAttr(url);
  const tag = `<link rel="canonical" href="${safe}" />`;
  if (/<link\s+rel=["']canonical["'][^>]*>/i.test(html)) {
    return html.replace(/<link\s+rel=["']canonical["'][^>]*>/i, tag);
  }
  return html.replace(/<\/head>/i, `    ${tag}\n  </head>`);
}

/**
 * Static body content for crawlers.
 *
 * The SPA mounts into #root and React replaces this markup on hydration, so
 * real visitors never see it. Crawlers and text-only fetches (which is what
 * Semrush measures for "low text-HTML ratio", "missing h1" and "low word
 * count") get a heading, an intro paragraph and the site's main links instead
 * of an empty container. The copy is derived from the same title/description
 * the page itself renders, so it never differs from the live page.
 */
function deriveH1(route: RouteMeta): string {
  if (route.h1) return route.h1;
  // Drop the brand suffix: "Ford Extended Warranty UK | Instant Quote | Buy A Warranty"
  const [first] = route.title.split("|");
  return (first || route.title).replace(/\s*[-–—]\s*$/, "").trim();
}

function buildLinkList(routePath: string): string {
  const links = PRERENDER_LINKS.filter(([href]) => href !== routePath)
    .map(([href, label]) => `<li><a href="${href}">${escapeHtmlText(label)}</a></li>`)
    .join("");
  return `<h2>More about our UK warranty cover</h2><nav aria-label="Main sections"><ul>${links}</ul></nav>`;
}

/** FAQPage JSON-LD so AI answer engines can lift Q&A pairs directly. */
function buildFaqJsonLd(body: PageBody): string {
  const json = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: body.faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };
  return `<script type="application/ld+json">${JSON.stringify(json).replace(/</g, "\\u003c")}</script>`;
}

function buildStaticBody(route: RouteMeta): string {
  const body = getPageBody(route.path);

  if (body) {
    const parts: string[] = [
      `<div id="prerender-content">`,
      `<h1>${escapeHtmlText(body.h1)}</h1>`,
      `<p>${escapeHtmlText(body.intro)}</p>`,
    ];

    body.sections.forEach((section) => {
      parts.push(`<h2>${escapeHtmlText(section.h2)}</h2>`);
      section.paras.forEach((p) => parts.push(`<p>${escapeHtmlText(p)}</p>`));
      (section.points ?? []).forEach((point) => {
        parts.push(`<h3>${escapeHtmlText(point.h3)}</h3>`);
        parts.push(`<p>${escapeHtmlText(point.text)}</p>`);
      });
    });

    parts.push(`<h2>Frequently asked questions</h2>`);
    body.faqs.forEach((faq) => {
      parts.push(`<h3>${escapeHtmlText(faq.q)}</h3>`);
      parts.push(`<p>${escapeHtmlText(faq.a)}</p>`);
    });

    parts.push(buildLinkList(route.path));
    parts.push(buildFaqJsonLd(body));
    parts.push(`</div>`);
    return parts.join("");
  }

  const h1 = escapeHtmlText(deriveH1(route));
  const intro = escapeHtmlText(route.intro ?? route.description);

  return [
    `<div id="prerender-content">`,
    `<h1>${h1}</h1>`,
    `<p>${intro}</p>`,
    `<h2>Extended warranty cover across the UK</h2>`,
    `<p>Buy A Warranty arranges extended warranty cover for cars, vans, motorbikes, hybrids and electric vehicles across the UK. Choose your claim limit, voluntary excess, labour rate and cover length, then get an instant online price using just your registration and mileage. Repairs are carried out by VAT-registered garages, and our UK-based team handles claims and questions by phone, email or WhatsApp.</p>`,
    buildLinkList(route.path),
    `</div>`,
  ].join("");
}

function setStaticBody(html: string, route: RouteMeta): string {
  return html.replace(
    /<div id="root">\s*<\/div>/i,
    `<div id="root">${buildStaticBody(route)}</div>`,
  );
}

function buildHtmlForRoute(template: string, route: RouteMeta): string {
  const canonical = `${SITE_URL}${route.path}`;
  const ogImage = route.ogImage ?? DEFAULT_OG_IMAGE_URL;

  let html = template;
  html = setTitle(html, route.title);
  html = setCanonical(html, canonical);

  // Description
  html = setMeta(html, { kind: "name", key: "description" }, route.description);

  // Open Graph
  html = setMeta(html, { kind: "property", key: "og:title" }, route.title);
  html = setMeta(
    html,
    { kind: "property", key: "og:description" },
    route.description,
  );
  html = setMeta(html, { kind: "property", key: "og:url" }, canonical);
  html = setMeta(html, { kind: "property", key: "og:image" }, ogImage);
  html = setMeta(
    html,
    { kind: "property", key: "og:type" },
    route.ogType ?? (route.path.startsWith("/thewarrantyhub/") ? "article" : "website"),
  );

  html = setMeta(
    html,
    { kind: "property", key: "og:site_name" },
    "Buy A Warranty",
  );

  // Twitter
  html = setMeta(
    html,
    { kind: "name", key: "twitter:card" },
    "summary_large_image",
  );
  html = setMeta(html, { kind: "name", key: "twitter:title" }, route.title);
  html = setMeta(
    html,
    { kind: "name", key: "twitter:description" },
    route.description,
  );
  html = setMeta(html, { kind: "name", key: "twitter:image" }, ogImage);
  html = setMeta(html, { kind: "name", key: "twitter:image:alt" }, route.title);
  html = setMeta(html, { kind: "name", key: "twitter:site" }, "@buyawarranty");

  // Indexing directives for search + AI answer engines
  html = setMeta(
    html,
    { kind: "name", key: "robots" },
    "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1",
  );
  html = setMeta(
    html,
    { kind: "name", key: "googlebot" },
    "index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1",
  );
  html = setMeta(
    html,
    { kind: "name", key: "bingbot" },
    "index, follow, max-snippet:-1, max-image-preview:large",
  );

  // The homepage hero preload only helps the homepage; on every other route it
  // is an unused ~34KB download competing with that page's real LCP element.
  if (route.path !== "/") {
    html = html.replace(
      /\s*<link\s+rel=["']preload["'][^>]*extended_warranty_uk-car-trustworthy-reviews\.webp[^>]*>/i,
      "",
    );
  }

  html = setStaticBody(html, route);

  return html;
}


function normalizeRoutePath(p: string): string {
  // Drop leading slash, ensure no trailing slash for path joins
  let out = p.replace(/^\/+/, "");
  out = out.replace(/\/+$/, "");
  return out;
}

export function prerenderMetaPlugin(): Plugin {
  let outDir = "dist";
  return {
    name: "prerender-meta",
    apply: "build",
    configResolved(config) {
      outDir = config.build.outDir || "dist";
    },
    async closeBundle() {
      const distDir = path.resolve(process.cwd(), outDir);
      const indexPath = path.join(distDir, "index.html");

      let template: string;
      try {
        template = await fs.readFile(indexPath, "utf8");
      } catch (err) {
        // Build may have failed earlier; nothing to do.
        console.warn(
          `[prerender-meta] Skipping: ${indexPath} not found.`,
          err,
        );
        return;
      }

      let written = 0;
      for (const route of PRERENDER_ROUTES) {
        const rel = normalizeRoutePath(route.path);
        if (!rel) continue; // skip "/" — that's the homepage (already correct)

        const targetDir = path.join(distDir, rel);
        const targetFile = path.join(targetDir, "index.html");

        const html = buildHtmlForRoute(template, route);

        await fs.mkdir(targetDir, { recursive: true });
        await fs.writeFile(targetFile, html, "utf8");
        written += 1;
      }

      // NOTE: dist/index.html is intentionally left untouched here.
      //
      // It used to be patched with the same static heading + intro block the
      // per-route pages get, on the theory that "React replaces it on
      // hydration so real visitors never see it." That's only true when the
      // JS bundle actually mounts successfully. index.html is also the SPA
      // fallback shell for every route that ISN'T one of PRERENDER_ROUTES —
      // checkout, the customer dashboard, admin, all of it — so if React's
      // initial render ever throws before it can replace #root's children
      // (a real-world case: a customer returning to a mid-checkout step from
      // an external payment provider with unexpected/missing state), the
      // stale SEO fallback markup was left on screen instead. It looked
      // exactly like a different, broken site: bare unstyled headings and a
      // links list, with no error and no way to tell what happened.
      //
      // Crawlers hitting "/" already get correct <title>/description/OG tags
      // from index.html's own <head> (set at build time / via SEOHead), so
      // the only thing lost by not injecting body text here is a minor,
      // homepage-only text-scraping nicety — not worth the app-wide crash
      // risk. RootErrorBoundary (src/main.tsx) is the actual safety net for
      // a genuine render failure now.

      console.log(
        `[prerender-meta] Generated ${written} route HTML files with route-specific meta tags.`,
      );
    },
  };
}
