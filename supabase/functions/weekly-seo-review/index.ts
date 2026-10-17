import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { z } from 'npm:zod@3';
import * as cheerio from 'npm:cheerio@1.0.0';
import { inspectHtml, verifiedProperties, SITE, type Proposal } from './audit.ts';

const schema = z.discriminatedUnion('action', [z.object({ action: z.literal('scheduled') }).strict(), z.object({ action: z.literal('properties') }).strict()]);
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
// This is the project's public browser key, not a privileged credential.
const CALLBACK_PUBLIC_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im16bHB1eHp3eXJjeXJncm9uZ2ViIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA4ODc0MjUsImV4cCI6MjA2NjQ2MzQyNX0.bFu0Zj4ic61GN0LwipkINg9YJtgd8RnMgEmzE139MPU';

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'POST required' }, 405);
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: 'Invalid review request' }, 400);
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const anon = Deno.env.get('SUPABASE_ANON_KEY');
  if (!supabaseUrl || !service || !anon) return json({ error: 'Review service configuration missing' }, 503);
  const db = createClient(supabaseUrl, service, { auth: { persistSession: false } });
  let runId: string | null = null;
  try {
    if (parsed.data.action === 'properties') {
      const token = (req.headers.get('Authorization') || '').replace(/^Bearer /, '');
      const { data, error } = await db.auth.getUser(token);
      if (error || !data.user) return json({ error: 'Sign in required' }, 401);
      const { data: caller } = await db.from('admin_users').select('role').eq('user_id', data.user.id).eq('is_active', true).is('archived_at', null).maybeSingle();
      if (caller?.role !== 'super_admin') return json({ error: 'Super-admin access required' }, 403);
      const candidates = await getProperties();
      return json({ candidates });
    }
    // Public publishable-key callbacks can only consume a due job queued by the
    // database schedule. Clients cannot insert jobs or choose URLs/run IDs.
    if (req.headers.get('apikey') !== CALLBACK_PUBLIC_KEY) return json({ error: 'Invalid callback' }, 401);
    const { data: claimed, error: claimError } = await db.rpc('claim_weekly_seo_run');
    if (claimError) throw claimError;
    if (!claimed) return json({ skipped: 'No scheduled review due' });
    runId = claimed;
    const { data: settings, error: settingsError } = await db.from('seo_review_settings').select('site_url').eq('id', true).single();
    if (settingsError) throw settingsError;
    const gaps: string[] = [];
    const pages: unknown[] = [];
    const proposals: Proposal[] = [];
    const fetchPage = async (url: string) => {
      if (new URL(url).origin !== new URL(SITE).origin) throw new Error('Only the approved public site may be checked');
      const started = performance.now();
      const response = await fetch(url, { signal: AbortSignal.timeout(12000), redirect: 'manual', headers: { 'User-Agent': 'BuyawarrantyWeeklySeoReview/1.0' } });
      const text = (await response.text()).slice(0, 1500000);
      return { status: response.status, text, responseMs: Math.round(performance.now() - started), location: response.headers.get('location') };
    };
    const sitemap = await fetchPage(`${SITE}sitemap.xml`);
    if (sitemap.status !== 200) throw new Error(`Sitemap fetch returned HTTP ${sitemap.status}`);
    const xml = cheerio.load(sitemap.text, { xmlMode: true });
    const allUrls = [...new Set(xml('url > loc').map((_, el) => xml(el).text().trim()).get())];
    const urls = allUrls.filter(url => { try { return new URL(url).origin === new URL(SITE).origin; } catch { return false; } }).slice(0, 250);
    if (!urls.length) throw new Error('No same-origin page URLs in the sitemap; sitemap indexes require a separate review');
    if (allUrls.length > 250) gaps.push('Crawl limited to 250 sitemap pages; remaining pages not checked.');
    if (allUrls.some(url => !urls.includes(url))) gaps.push('Some sitemap URLs were excluded because of origin or crawl limits.');
    const visited = new Map<string, number>();
    const internalLinks = new Set<string>();
    // Six simultaneous reads, bounded by the approved sitemap inventory.
    for (let offset = 0; offset < urls.length; offset += 6) {
      await Promise.all(urls.slice(offset, offset + 6).map(async url => {
        try {
          const response = await fetchPage(url);
          visited.set(url, response.status);
          if (response.status !== 200) {
            pages.push({ url, status: response.status, responseMs: response.responseMs, location: response.location });
            proposals.push({ category: 'Page delivery', page_url: url, title: 'Sitemap page needs delivery review', evidence: `HTTP ${response.status}${response.location ? ` → ${response.location}` : ''}`, proposed_change: 'Investigate the published page and routing before proposing a minimal correction; redirects are observations, not automatically broken pages.', verification: 'Confirm the approved URL serves the expected public page.', priority: 'High' });
            return;
          }
          const checked = inspectHtml(url, response.text);
          pages.push({ ...checked.page, status: response.status, responseMs: response.responseMs });
          proposals.push(...checked.proposals);
          checked.links.forEach(link => internalLinks.add(link));
        } catch (error) { gaps.push(`${url}: ${error instanceof Error ? error.message : 'Fetch failed'}`); }
      }));
    }
    for (const link of internalLinks) {
      if ((visited.get(link) || 0) >= 400) proposals.push({ category: 'Internal links', page_url: link, title: 'Internal link target returned an error', evidence: `Linked sitemap target returned HTTP ${visited.get(link)}`, proposed_change: 'Identify the referring pages and propose the approved replacement link after checking the target.', verification: 'Click the approved internal links and confirm the intended page loads.', priority: 'High' });
    }
    const robots = await fetchPage(`${SITE}robots.txt`).catch(() => null);
    let google: unknown = null;
    try {
      const candidates = await getProperties();
      const selected = settings.site_url;
      if (!selected && candidates.length !== 1) gaps.push(candidates.length ? 'Search Console property selection required in weekly review settings.' : 'No covering verified Search Console property.');
      else {
        const property = selected || candidates[0];
        if (!candidates.includes(property)) gaps.push('Selected Search Console property is no longer verified; Google checks paused.');
        else {
          const end = new Date(); end.setUTCDate(end.getUTCDate() - 3);
          const start = new Date(end); start.setUTCDate(start.getUTCDate() - 27);
          const search = await gateway('google_search_console', `/webmasters/v3/sites/${encodeURIComponent(property)}/searchAnalytics/query`, { startDate: start.toISOString().slice(0, 10), endDate: end.toISOString().slice(0, 10), dimensions: ['page'], rowLimit: 250 });
          const sitemaps = await gateway('google_search_console', `/webmasters/v3/sites/${encodeURIComponent(property)}/sitemaps`);
          google = { property, startDate: start.toISOString().slice(0, 10), endDate: end.toISOString().slice(0, 10), search, sitemaps };
        }
      }
    } catch (error) { gaps.push(`Google data unavailable: ${error instanceof Error ? error.message : 'Request failed'}`); }
    let backlinks: unknown = null;
    try { backlinks = await gateway('semrush', '/backlinks/backlinks_overview?target=buyawarranty.co.uk&target_type=root_domain'); }
    catch (error) { gaps.push(`Semrush backlinks unavailable: ${error instanceof Error ? error.message : 'Request failed'}`); }
    const limitations = ['Checks read published HTML, not browser-rendered images or JavaScript content.', 'Empty alt attributes can be intentional decoration; no automatic alt text or filename changes.', 'Response times are fetch timings, not Core Web Vitals or a full speed audit.', 'AI citation frequency and social rankings are unmeasured; crawler access is not proof of AI visibility.', 'Internal-link delivery is checked only for targets also fetched in the sitemap.', 'Search Analytics is not an indexing inventory; sitemap error counts do not establish their causes.', 'No sitemap resubmission, website edits, schema changes, tracking changes or publication is performed.'];
    const report = { site: SITE, checkedAt: new Date().toISOString(), pages, google, backlinks, robots: robots ? { status: robots.status, text: robots.text } : null, gaps, limitations, checkedPages: pages.length, sitemapPages: urls.length, proposalCount: proposals.length };
    if (proposals.length) {
      const { error } = await db.from('seo_review_proposals').insert(proposals.map(proposal => ({ ...proposal, run_id: runId })));
      if (error) throw error;
    }
    const { error } = await db.from('seo_review_runs').update({ status: gaps.length ? 'partial' : 'complete', report, lease_until: null }).eq('id', runId);
    if (error) throw error;
    return json({ success: true, runId, checkedPages: pages.length, proposals: proposals.length, gaps: gaps.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('weekly-seo-review:', message);
    if (runId) await db.from('seo_review_runs').update({ status: 'failed', report: { checkedAt: new Date().toISOString(), gaps: [message] }, lease_until: null }).eq('id', runId);
    return json({ error: message }, 500);
  }
});

async function gateway(connector: 'google_search_console' | 'semrush', path: string, body?: unknown) {
  const key = Deno.env.get('LOVABLE_API_KEY');
  const connection = Deno.env.get(connector === 'semrush' ? 'SEMRUSH_API_KEY' : 'GOOGLE_SEARCH_CONSOLE_API_KEY');
  if (!key || !connection) throw new Error(`${connector} connection is not configured`);
  const response = await fetch(`https://connector-gateway.lovable.dev/${connector}${path}`, { method: body ? 'POST' : 'GET', headers: { Authorization: `Bearer ${key}`, 'X-Connection-Api-Key': connection, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(15000) });
  if (!response.ok) { const details = await response.text(); console.error(`SEO provider [${response.status}]: ${details}`); throw new Error(`Provider request failed [${response.status}]: ${details}`); }
  return response.json();
}
async function getProperties(): Promise<string[]> {
  const response = await gateway('google_search_console', '/webmasters/v3/sites');
  return verifiedProperties(response.siteEntry || []);
}