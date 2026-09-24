import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: corsHeaders });

  const body = await req.json();
  const name = typeof body?.name === 'string' ? body.name : '';
  const base64 = typeof body?.base64 === 'string' ? body.base64 : '';
  const allowed = new Set([
    'land-rover-warranty-cost-uk-2026.jpg',
    'land-rover-repair-costs-warranty-uk.jpg',
  ]);
  if (!allowed.has(name) || !base64) return new Response('Invalid image', { status: 400, headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );
  const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
  const { data, error } = await supabase.storage
    .from('policy-documents')
    .upload(`blog-images/${name}`, bytes, { contentType: 'image/jpeg', upsert: true });
  if (error) return new Response(error.message, { status: 500, headers: corsHeaders });
  return Response.json({ path: data.path }, { headers: corsHeaders });
});