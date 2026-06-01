import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const { path, base64, plan_type, document_name } = await req.json();
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { error } = await sb.storage.from("policy-documents").upload(path, bytes, {
      contentType: "application/pdf",
      upsert: true,
    });
    if (error) throw error;
    const { data: pub } = sb.storage.from("policy-documents").getPublicUrl(path);
    const { error: insErr } = await sb.from("customer_documents").insert({
      plan_type,
      document_name,
      file_url: pub.publicUrl,
      file_name: path.split("/").pop(),
    });
    if (insErr) throw insErr;
    return new Response(JSON.stringify({ ok: true, url: pub.publicUrl }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
