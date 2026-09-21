import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const FILES = [
  'tesla-warranty-uk-2026.jpg',
  'tesla-touchscreen-repair-cost.jpg',
  'petrol-diesel-vehicle-warranty-cover-uk.jpg',
];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const results: Record<string, string> = {};
  for (const name of FILES) {
    const src = `https://drive-bright.lovable.app/blog/${name}`;
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
