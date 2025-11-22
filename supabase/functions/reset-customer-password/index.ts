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
    
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

    const { email, newPassword }: ResetPasswordRequest = await req.json();
    
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

    // Find the user by email
    const { data: users, error: findError } = await supabaseClient.auth.admin.listUsers({
      page: 1,
      perPage: 1000
    });

    if (findError) {
      logStep('Error finding users', findError);
      throw findError;
    }

    const user = users.users.find(u => u.email === email);
    
    if (!user) {
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

    logStep('User found, updating password', { userId: user.id, email });

    // Update the user's password
    const { data: updateData, error: updateError } = await supabaseClient.auth.admin.updateUserById(
      user.id,
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