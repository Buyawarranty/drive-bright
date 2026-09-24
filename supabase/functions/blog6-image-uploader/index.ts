import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: corsHeaders });

  const authHeader = req.headers.get('Authorization') ?? '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );
  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) return new Response('Unauthorized', { status: 401, headers: corsHeaders });

  const { data: staff } = await supabase
    .from('admin_users')
    .select('id')
    .eq('id', user.id)
    .maybeSingle();
  if (!staff) return new Response('Forbidden', { status: 403, headers: corsHeaders });

  const body = await req.json();
  const name = typeof body?.name === 'string' ? body.name : '';
  const base64 = typeof body?.base64 === 'string' ? body.base64 : '';
  if (!/^[a-z0-9-]+\.jpg$/.test(name) || !base64) {
    return new Response('Invalid image', { status: 400, headers: corsHeaders });
  }

  const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
  const { data, error } = await supabase.storage
    .from('policy-documents')
    .upload(`blog-images/${name}`, bytes, { contentType: 'image/jpeg', upsert: true });
  if (error) return new Response(error.message, { status: 500, headers: corsHeaders });

  return Response.json({ path: data.path }, { headers: corsHeaders });
});