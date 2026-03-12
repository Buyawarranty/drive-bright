import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');

    if (!supabaseAnonKey) {
      throw new Error('SUPABASE_ANON_KEY is not configured');
    }
    
    // Use anon key for signInWithPassword (correct auth flow)
    // Service key is only for admin lookups (roles, customer data)
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey);
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const rawBody = await req.json();
    const email = rawBody.email?.trim()?.toLowerCase();
    const password = rawBody.password;

    if (!email || !password) {
      return new Response(
        JSON.stringify({ 
          error: 'Email and password are required',
          success: false 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('Customer login attempt for:', email);

    // Sign in the user - with retry logic for race conditions
    let authData, authError;
    let attempts = 0;
    const maxAttempts = 3;
    
    while (attempts < maxAttempts) {
      const result = await supabaseAuth.auth.signInWithPassword({
        email,
        password,
      });
      
      authData = result.data;
      authError = result.error;
      
      // If successful or error is not "Invalid login credentials", break
      if (!authError || authError.message !== 'Invalid login credentials') {
        break;
      }
      
      // Wait briefly before retry (in case password update is still processing)
      if (attempts < maxAttempts - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      attempts++;
      console.log(`Login retry attempt ${attempts} for:`, email);
    }

    if (authError) {
      console.error('Authentication failed after', attempts, 'attempts:', authError);
      
      // Provide more specific error messages
      let errorMessage = authError.message;
      if (authError.message === 'Invalid login credentials') {
        errorMessage = 'Invalid email or password. Please check your credentials and try again. If you just received your welcome email, please wait a moment and try again.';
      }
      
      return new Response(
        JSON.stringify({ 
          error: errorMessage,
          success: false 
        }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    if (!authData?.user || !authData?.session) {
      return new Response(
        JSON.stringify({ 
          error: 'Login failed - no user data returned',
          success: false 
        }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Check if user has a customer role (optional - for role-based access)
    const { data: roleData } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', authData.user.id)
      .maybeSingle();

    // Get customer data if exists
    const { data: customerData } = await supabaseAdmin
      .from('customers')
      .select('*')
      .eq('email', email)
      .maybeSingle();

    console.log('Customer login successful for:', email);

    return new Response(
      JSON.stringify({
        success: true,
        user: authData.user,
        session: authData.session,
        role: roleData?.role || 'customer',
        customer: customerData,
        message: 'Login successful'
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Customer login error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        success: false 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});