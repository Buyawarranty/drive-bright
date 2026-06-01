import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Expose-Headers": "*",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const path = req.headers.get("x-path")!;
    const plan_type = req.headers.get("x-plan-type")!;
    const document_name = req.headers.get("x-document-name")!;
    const bytes = new Uint8Array(await req.arrayBuffer());
    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { error } = await sb.storage.from("policy-documents").upload(path, bytes, {
      contentType: "application/pdf",
      upsert: true,
    });
    if (error) throw new Error("storage: " + (error.message || JSON.stringify(error)));
    const { data: pub } = sb.storage.from("policy-documents").getPublicUrl(path);
    const { error: insErr } = await sb.from("customer_documents").insert({
      plan_type,
      document_name,
      file_url: pub.publicUrl,
      file_size: bytes.byteLength,
    });
    if (insErr) throw new Error("db: " + (insErr.message || JSON.stringify(insErr)));
    return new Response(JSON.stringify({ ok: true, url: pub.publicUrl }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
