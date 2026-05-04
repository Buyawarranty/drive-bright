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
  html = setMeta(html, { kind: "property", key: "og:type" }, "website");
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

      console.log(
        `[prerender-meta] Generated ${written} route HTML files with route-specific meta tags.`,
      );
    },
  };
}
