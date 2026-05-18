// One-off seeder: uploads a base64 file to staff-hub bucket and inserts row.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { title, description, category, file_name, mime_type, base64 } = await req.json();
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    const storage_path = `${category}/${Date.now()}-${file_name}`;

    const { error: upErr } = await supabase.storage
      .from("staff-hub")
      .upload(storage_path, bytes, { contentType: mime_type, upsert: false });
    if (upErr) throw upErr;

    const { data, error: insErr } = await supabase
      .from("staff_hub_documents")
      .insert({
        title,
        description,
        category,
        storage_path,
        file_name,
        file_size: bytes.byteLength,
        mime_type,
      })
      .select()
      .single();
    if (insErr) throw insErr;

    return new Response(JSON.stringify({ ok: true, doc: data }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e?.message ?? e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
