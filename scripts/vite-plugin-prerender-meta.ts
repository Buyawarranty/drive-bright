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

function buildStaticBody(route: RouteMeta): string {
  const h1 = escapeHtmlText(deriveH1(route));
  const intro = escapeHtmlText(route.intro ?? route.description);
  const links = [
    ["/", "Get an instant warranty quote"],
    ["/what-is-covered/", "What's covered"],
    ["/warranty-plan/", "Warranty plans and pricing"],
    ["/warranty-types/", "Cover by vehicle and make"],
    ["/thewarrantyhub/", "The Warranty Hub guides"],
    ["/faq/", "Frequently asked questions"],
    ["/make-a-claim/", "Make a claim"],
    ["/contact-us/", "Contact our UK team"],
  ]
    .filter(([href]) => href !== route.path)
    .map(([href, label]) => `<li><a href="${href}">${escapeHtmlText(label)}</a></li>`)
    .join("");

  return [
    `<div id="prerender-content">`,
    `<h1>${h1}</h1>`,
    `<p>${intro}</p>`,
    `<p>Buy A Warranty arranges extended warranty cover for cars, vans, motorbikes, hybrids and electric vehicles across the UK. Choose your claim limit, voluntary excess, labour rate and cover length, then get an instant online price using just your registration and mileage. Repairs are carried out by VAT-registered garages, and our UK-based team handles claims and questions by phone, email or WhatsApp.</p>`,
    `<nav aria-label="Main sections"><ul>${links}</ul></nav>`,
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

      // The homepage keeps its own head tags, but its #root is empty too, so give
      // crawlers the same static heading + intro block.
      const homeRoute: RouteMeta = {
        path: "/",
        title: "Car, Van, EV & Motorbike Warranty Cover UK",
        description:
          "Compare and buy extended warranty cover for your car, van, motorbike, hybrid or electric vehicle. Instant online quote from your registration and mileage, flexible claim limits and UK-based claims support.",
      };
      const homeHtml = setStaticBody(template, homeRoute);
      if (homeHtml !== template) {
        await fs.writeFile(indexPath, homeHtml, "utf8");
      }

      console.log(
        `[prerender-meta] Generated ${written} route HTML files with route-specific meta tags.`,
      );
    },
  };
}
