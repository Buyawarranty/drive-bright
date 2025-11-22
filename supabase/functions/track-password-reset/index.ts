import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function logStep(step: string, details?: any) {
  const timestamp = new Date().toISOString();
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[TRACK-PASSWORD-RESET] ${timestamp} ${step}${detailsStr}`);
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { email } = await req.json();

    if (!email) {
      return new Response(
        JSON.stringify({ 
          error: 'Email is required',
          success: false 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    logStep("Tracking password reset for user", { email });

    // Update all welcome_emails records for this user to mark password as reset by user
    const { data: updateResult, error: updateError } = await supabase
      .from('welcome_emails')
      .update({ 
        password_reset_by_user: true,
        created_at: new Date().toISOString() // Update timestamp to track when they reset
      })
      .eq('email', email);

    if (updateError) {
      logStep("Error updating welcome_emails", updateError);
      throw updateError;
    }

    logStep("Successfully marked password as reset by user", { 
      email, 
      updatedRecords: updateResult 
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Password reset tracked successfully',
        email: email
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in track-password-reset", { message: errorMessage });
    return new Response(
      JSON.stringify({ 
        error: 'Failed to track password reset',
        success: false 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});