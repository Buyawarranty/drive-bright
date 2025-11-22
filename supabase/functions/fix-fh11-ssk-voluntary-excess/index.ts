import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Updating FH11 SSK voluntary excess to £50');
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    
    // Update the customer record for FH11 SSK
    const { data, error } = await supabase
      .from('customers')
      .update({ voluntary_excess: 50 })
      .eq('registration_plate', 'FH11 SSK')
      .select();

    if (error) {
      console.error('Update error:', error);
      throw error;
    }

    console.log('Customer updated successfully:', data);

    // Also need to re-send to Warranties 2000 with correct voluntary excess
    if (data && data.length > 0) {
      const customer = data[0];
      console.log('Re-sending to Warranties 2000 with correct voluntary excess');
      
      // Get the policy for this customer
      const { data: policyData, error: policyError } = await supabase
        .from('customer_policies')
        .select('id')
        .eq('customer_id', customer.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (!policyError && policyData) {
        console.log('Found policy, checking W2000 status:', policyData.id);
        
        // Check if warranty has already been sent to W2000 to prevent duplicates
        const { data: existingPolicy } = await supabase
          .from('customer_policies')
          .select('warranties_2000_status')
          .eq('id', policyData.id)
          .single();

        if (existingPolicy?.warranties_2000_status === 'sent') {
          console.log('Warranty already sent to W2000, forcing re-send due to voluntary excess fix');
        }
        
        const { data: w2kData, error: w2kError } = await supabase.functions.invoke('send-to-warranties-2000', {
          body: { 
            policyId: policyData.id,
            customerId: customer.id,
            force: true // Force re-send for this specific fix
          }
        });

        if (w2kError) {
          console.error('Warranties 2000 update error:', w2kError);
        } else {
          console.log('Warranties 2000 updated successfully:', w2kData);
        }
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      data: data,
      message: 'Updated FH11 SSK voluntary excess to £50 and re-sent to Warranties 2000'
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    console.error("Error:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: errorMessage 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});