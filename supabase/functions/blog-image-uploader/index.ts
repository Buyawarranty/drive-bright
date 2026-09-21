import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

interface UploadFile {
  name: string;
  contentType: string;
  base64: string;
}

const decodeBase64 = (value: string) => {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(JSON.stringify({ error: 'Missing Supabase configuration' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const { files } = await req.json() as { files?: UploadFile[] };
  if (!Array.isArray(files) || files.length === 0) {
    return new Response(JSON.stringify({ error: 'No files supplied' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const results: Record<string, string> = {};

  for (const file of files) {
    if (!file.name || !file.base64 || !file.contentType) {
      results[file?.name || 'unknown'] = 'missing fields';
      continue;
    }
    const bytes = decodeBase64(file.base64);
    const path = `blog-images/${file.name}`;
    const { error } = await supabase.storage
      .from('policy-documents')
      .upload(path, bytes, { contentType: file.contentType, upsert: true });

    results[file.name] = error
      ? `upload failed: ${error.message}`
      : supabase.storage.from('policy-documents').getPublicUrl(path).data.publicUrl;
  }

  return new Response(JSON.stringify({ results }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
