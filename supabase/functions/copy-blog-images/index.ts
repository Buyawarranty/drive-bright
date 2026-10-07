import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const FILES = [
  'tesla-warranty-uk-2026.jpg',
  'tesla-touchscreen-repair-cost.jpg',
  'petrol-diesel-vehicle-warranty-cover-uk.jpg',
];

const SAFE_NAME = /^[a-z0-9-]+\.(jpg|webp|png)$/;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // Optional body: { name, source } — copy one image from a Google Docs image URL.
  let items: { name: string; src: string }[] = FILES.map((name) => ({
    name,
    src: `https://drive-bright.lovable.app/blog/${name}`,
  }));
  if (req.method === 'POST') {
    try {
      const body = await req.json();
      if (body?.name && body?.source) {
        const src = String(body.source);
        if (!SAFE_NAME.test(body.name) || !src.startsWith('https://lh7-rt.googleusercontent.com/')) {
          return new Response(JSON.stringify({ error: 'invalid input' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        items = [{ name: body.name, src }];
      }
    } catch { /* no body */ }
  }

  const results: Record<string, string> = {};
  for (const { name, src } of items) {
    const res = await fetch(src);
    if (!res.ok) {
      results[name] = `fetch failed ${res.status}`;
      continue;
    }
    const bytes = new Uint8Array(await res.arrayBuffer());
    const { error } = await supabase.storage
      .from('policy-documents')
      .upload(`blog-images/${name}`, bytes, { contentType: 'image/jpeg', upsert: true });
    results[name] = error
      ? `upload failed: ${error.message}`
      : supabase.storage.from('policy-documents').getPublicUrl(`blog-images/${name}`).data.publicUrl;
  }

  return new Response(JSON.stringify({ results }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
