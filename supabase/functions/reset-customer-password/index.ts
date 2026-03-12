import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ResetPasswordRequest {
  email: string;
  newPassword: string;
}

const logStep = (step: string, details?: any) => {
  console.log(`[RESET PASSWORD] ${step}`, details ? JSON.stringify(details, null, 2) : '');
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);
    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user: requestUser }, error: userError } = await authClient.auth.getUser();
    if (userError || !requestUser) {
      return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { data: roleRows } = await supabaseClient
      .from('user_roles')
      .select('role')
      .eq('user_id', requestUser.id);

    const allowedRoles = new Set(['super_admin', 'admin', 'member', 'sales_lead', 'sales']);
    const isAuthorized = (roleRows || []).some(r => allowedRoles.has(r.role));

    if (!isAuthorized) {
      return new Response(JSON.stringify({ success: false, error: 'Forbidden' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const payload: ResetPasswordRequest = await req.json();
    const email = payload.email?.trim()?.toLowerCase();
    const newPassword = payload.newPassword;

    logStep('Password reset request received', { email });

    if (!email || !newPassword) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Email and new password are required' 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Find the user by email (paginate to avoid missing users beyond first 1000)
    let targetUser: { id: string; email?: string | null } | undefined;
    let page = 1;
    const perPage = 1000;

    while (!targetUser && page <= 20) {
      const { data: users, error: findError } = await supabaseClient.auth.admin.listUsers({
        page,
        perPage
      });

      if (findError) {
        logStep('Error finding users', findError);
        throw findError;
      }

      const batch = users?.users ?? [];
      targetUser = batch.find(u => u.email?.toLowerCase() === email);

      if (batch.length < perPage) {
        break;
      }

      page += 1;
    }
    
    if (!targetUser) {
      logStep('User not found', { email });
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'User not found' 
        }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    logStep('User found, updating password', { userId: targetUser.id, email });

    // Update the user's password
    const { data: updateData, error: updateError } = await supabaseClient.auth.admin.updateUserById(
      targetUser.id,
      { password: newPassword }
    );

    if (updateError) {
      logStep('Error updating password', updateError);
      throw updateError;
    }

    logStep('Password updated successfully', { email });

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Password updated successfully',
        email: email
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    logStep('Password reset error', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: 'Internal server error' 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});