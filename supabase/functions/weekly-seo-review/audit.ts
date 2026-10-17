import * as cheerio from 'npm:cheerio@1.0.0';

export const SITE = 'https://buyawarranty.co.uk/';
export type Proposal = { category: string; page_url: string; title: string; evidence: string; proposed_change: string; verification: string; priority: string };
export function inspectHtml(url: string, html: string) {
  const $ = cheerio.load(html);
  const proposals: Proposal[] = [];
  const add = (category: string, title: string, evidence: string, proposed_change: string, priority = 'Medium') => proposals.push({ category, page_url: url, title, evidence, proposed_change, priority, verification: 'Recheck the published HTML and working page after separately approved implementation and publication.' });
  const title = $('title').first().text().trim();
  const description = $('meta[name="description"]').attr('content')?.trim() || '';
  const canonical = $('link[rel="canonical"]').attr('href') || '';
  const h1 = $('h1').map((_, el) => $(el).text().trim()).get();
  const noindex = /noindex/i.test($('meta[name="robots"]').attr('content') || '');
  if (!noindex) {
    if (!title || /^(Lovable App|Lovable Generated Project)$/i.test(title)) add('Metadata', 'Page title needs review', `Published title: ${title || '(missing)'}`, 'Draft a unique, accurate title for this page for approval; preserve its URL and existing schema.', 'High');
    if (!description) add('Metadata', 'Missing page description', 'No description in the published HTML.', 'Draft an accurate page-specific description for approval.');
    if (!canonical) add('Discoverability', 'Missing canonical', 'No canonical link in the published HTML.', `Propose a canonical to ${url}, after confirming this is the approved URL.`, 'High');
    if (h1.length !== 1) add('Headings', 'Heading outline needs review', `${h1.length} H1 headings in published HTML.`, 'Review the page outline and propose a single descriptive main heading without changing the working page layout.');
  }
  for (const name of ['og:title', 'og:description', 'og:image']) {
    if (!$(`meta[property="${name}"]`).attr('content')) add('Social sharing', `Missing ${name}`, `${name} is absent from published HTML.`, 'Propose the missing sharing metadata using the approved title, description or existing image.');
  }
  const images = $('img').map((_, el) => ({ src: $(el).attr('src') || '', alt: $(el).attr('alt'), decorative: $(el).attr('role') === 'presentation' || $(el).attr('aria-hidden') === 'true' })).get();
  images.filter(img => img.alt === undefined && !img.decorative).forEach(img => add('Image descriptions', 'Image missing an alt attribute', `Image: ${img.src}`, 'Inspect the actual image, then propose an accurate description using approved photo information; keep decorative images empty.'));
  // Opaque names are review opportunities, not automatic rename instructions.
  const opaque = images.filter(img => /\/(?:[a-f\d-]{25,}|\d{10,})\.(?:png|jpe?g|webp)(?:\?|$)/i.test(img.src));
  if (opaque.length) add('Image filenames', 'Review opaque image filenames', opaque.map(img => img.src).join('\n'), 'Check every consumer before proposing descriptive filenames and redirects. Preserve stable URLs until a migration is explicitly approved.', 'Low');
  const links = $('a[href]').map((_, el) => $(el).attr('href') || '').get().flatMap(href => { try { const target = new URL(href, url); return target.origin === new URL(SITE).origin ? [target.href.split('#')[0].split('?')[0]] : []; } catch { return []; } });
  return { page: { url, title, description, canonical, h1, noindex, images: images.length, emptyAlt: images.filter(img => img.alt === '').length }, proposals, links };
}

export function verifiedProperties(entries: { siteUrl: string; permissionLevel?: string }[], target = SITE) {
  const url = new URL(target);
  return entries.filter(entry => {
    if (entry.permissionLevel === 'siteUnverifiedUser') return false;
    if (entry.siteUrl.startsWith('sc-domain:')) {
      const domain = entry.siteUrl.slice(10).toLowerCase();
      return url.hostname === domain || url.hostname.endsWith(`.${domain}`);
    }
    try { return url.href.startsWith(new URL(entry.siteUrl).href); } catch { return false; }
  }).map(entry => entry.siteUrl);
}