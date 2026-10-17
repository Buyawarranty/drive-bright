import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PRERENDER_ROUTES } from './prerender-routes';

describe('Public SEO route coverage', () => {
  const sitemap = readFileSync(new URL('../public/sitemap.xml', import.meta.url), 'utf8');
  const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => new URL(match[1]));
  const renderedPaths = new Set(PRERENDER_ROUTES.map(route => route.path));

  it('provides build-time metadata for every non-homepage sitemap entry', () => {
    const missing = urls.filter(url => url.pathname !== '/' && !renderedPaths.has(url.pathname));
    expect(missing.map(url => url.pathname)).toEqual([]);
  });

  it('includes all 41 currently published articles, including the four recovered gaps', () => {
    const articles = urls.filter(url => url.pathname.startsWith('/thewarrantyhub/') && url.pathname !== '/thewarrantyhub/');
    expect(articles).toHaveLength(41);
    for (const slug of ['audi-a6-vs-bmw-5-series-uk-reliability-and-value-2026', 'motorcycle-extended-warranty-cost-uk-2026-prices-repair-costs', 'motorcycle-extended-warranty-uk-what-does-it-cover-how-does-it-work', 'land-rover-extended-warranty-uk-what-does-it-cover-how-does-it-work']) {
      expect(articles.some(url => url.pathname === `/thewarrantyhub/${slug}/`)).toBe(true);
    }
  });

  it('does not expose staff, account or payment routes through the public sitemap', () => {
    const internal = urls.filter(url => /^\/(admin|dealer-portal|customer-dashboard|checkout|thank-you|payment|sales-login|reset-password)/.test(url.pathname));
    expect(internal.map(url => url.pathname)).toEqual([]);
  });
});