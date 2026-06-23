import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.2";

serve(async () => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const userId = "ff652f10-f975-4b5f-b6b1-11a6ae5d2ed9";
  const { error } = await supabase.auth.admin.updateUserById(userId, {
    password: "Happyhappy@26",
    email_confirm: true,
  });
  return new Response(JSON.stringify({ ok: !error, error: error?.message }), {
    headers: { "Content-Type": "application/json" },
  });
});
