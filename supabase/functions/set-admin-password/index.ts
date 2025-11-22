import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SetPasswordRequest {
  userId: string;
  email: string;
  password: string;
}

const logStep = (step: string, details?: any) => {
  console.log(`[SET-PASSWORD] ${step}`, details ? JSON.stringify(details, null, 2) : '');
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep('Starting password set process');
    
    // Initialize Supabase client with service role key
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    const { userId, email, password }: SetPasswordRequest = await req.json();
    logStep('Request data', { userId, email, passwordLength: password?.length });

    if (!userId || !email || !password) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: userId, email, password' }),
        { 
          status: 400, 
          headers: { 'Content-Type': 'application/json', ...corsHeaders } 
        }
      );
    }

    // Verify admin user exists
    logStep('Verifying admin user exists');
    const { data: adminUser, error: adminError } = await supabaseClient
      .from('admin_users')
      .select('user_id, email, is_active')
      .eq('user_id', userId)
      .eq('email', email)
      .single();

    if (adminError || !adminUser) {
      logStep('Admin user not found', { adminError, adminUser });
      return new Response(
        JSON.stringify({ error: 'Admin user not found' }),
        { 
          status: 404, 
          headers: { 'Content-Type': 'application/json', ...corsHeaders } 
        }
      );
    }

    if (!adminUser.is_active) {
      logStep('Admin user is not active');
      return new Response(
        JSON.stringify({ error: 'Admin user is not active' }),
        { 
          status: 403, 
          headers: { 'Content-Type': 'application/json', ...corsHeaders } 
        }
      );
    }

    logStep('Admin user verified', adminUser);

    // Update password in Supabase Auth
    logStep('Updating password in Supabase Auth');
    const { data: updateData, error: updateError } = await supabaseClient.auth.admin.updateUserById(
      userId,
      { password: password }
    );

    if (updateError) {
      logStep('Failed to update password', updateError);
      return new Response(
        JSON.stringify({ error: `Failed to update password: ${updateError.message}` }),
        { 
          status: 500, 
          headers: { 'Content-Type': 'application/json', ...corsHeaders } 
        }
      );
    }

    logStep('Password updated successfully', { userId: updateData.user?.id });

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Password updated successfully for ${email}`,
        userId: userId
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      }
    );

  } catch (error) {
    logStep('Unexpected error', error);
    console.error('Error in set-admin-password function:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { 'Content-Type': 'application/json', ...corsHeaders } 
      }
    );
  }
});