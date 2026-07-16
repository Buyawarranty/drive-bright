// Batch hero-image validator using Lovable AI Gateway vision (gpt-5.5)
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const SYSTEM_PROMPT = `You are a strict QA reviewer for blog hero images on a UK car warranty website.

Evaluate the supplied image against these rules and return JSON only:
1. complete_car: If a car is shown, it must be ONE complete vehicle — no cut-off/missing sections, no chimeric parts stitched together, no obviously wrong or missing wheels/doors/lights. If no car is shown, complete_car = true.
2. blank_plates: Any visible UK number plate MUST be blank (empty white/yellow rectangle). Any letters, digits, logos or text on a plate = fail.
3. single_image: The image must be a single unified photograph — NOT a split/diptych/collage (no visible vertical or horizontal seam dividing two scenes, no side-by-side compositions).
4. realistic: The image must look like a plausible real photograph, not obviously warped, melted, or with impossible geometry.

Return strictly this JSON shape:
{"pass": boolean, "complete_car": boolean, "blank_plates": boolean, "single_image": boolean, "realistic": boolean, "issues": [string], "notes": string}
issues lists short human-readable failure reasons (empty array if pass=true).`;

async function validateOne(url: string) {
  const res = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'openai/gpt-5.5',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Evaluate this hero image. Respond with JSON only.' },
            { type: 'image_url', image_url: { url } },
          ],
        },
      ],
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`AI ${res.status}: ${text.slice(0, 200)}`);
  }
  const data = await res.json();
  const raw = data?.choices?.[0]?.message?.content ?? '{}';
  try {
    return JSON.parse(raw);
  } catch {
    return { pass: false, issues: ['Malformed AI response'], notes: raw.slice(0, 300) };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { postIds } = await req.json().catch(() => ({}));
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

    let q = supabase
      .from('blog_posts')
      .select('id, slug, title, featured_image_url, status')
      .not('featured_image_url', 'is', null)
      .neq('featured_image_url', '');
    if (Array.isArray(postIds) && postIds.length) q = q.in('id', postIds);

    const { data: posts, error } = await q;
    if (error) throw error;

    const CONCURRENCY = 4;
    const results: any[] = [];
    let i = 0;
    async function worker() {
      while (i < posts!.length) {
        const idx = i++;
        const p = posts![idx];
        const base = { id: p.id, slug: p.slug, title: p.title, url: p.featured_image_url, status: p.status };
        try {
          // resolve relative /__l5e/ URLs to absolute preview URL
          const abs = p.featured_image_url.startsWith('http')
            ? p.featured_image_url
            : `https://drive-bright.lovable.app${p.featured_image_url}`;
          const verdict = await validateOne(abs);
          results.push({ ...base, ...verdict });
        } catch (e: any) {
          results.push({ ...base, pass: false, issues: [`Error: ${e.message}`], notes: '' });
        }
      }
    }
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
