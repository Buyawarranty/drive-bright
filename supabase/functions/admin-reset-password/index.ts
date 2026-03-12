import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { email, newPassword } = await req.json();

    if (!email || !newPassword) {
      return new Response(JSON.stringify({ success: false, error: 'Missing email or password' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Find user by email
    let targetUser: any;
    let page = 1;
    while (!targetUser && page <= 20) {
      const { data } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
      const batch = data?.users ?? [];
      targetUser = batch.find((u: any) => u.email?.toLowerCase() === email.toLowerCase().trim());
      if (batch.length < 1000) break;
      page++;
    }

    if (!targetUser) {
      return new Response(JSON.stringify({ success: false, error: 'User not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { error } = await supabase.auth.admin.updateUserById(targetUser.id, { password: newPassword });
    if (error) throw error;

    return new Response(JSON.stringify({ success: true, userId: targetUser.id }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
