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
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { registration_plate, voluntary_excess, claim_limit, labour_rate, sync_policy } = await req.json();
    
    console.log(`Updating customer ${registration_plate}:`, { voluntary_excess, claim_limit, labour_rate, sync_policy });
    
    // Build update object with only provided fields
    const customerUpdate: Record<string, any> = {};
    if (voluntary_excess !== undefined) customerUpdate.voluntary_excess = voluntary_excess;
    if (claim_limit !== undefined) customerUpdate.claim_limit = claim_limit;
    if (labour_rate !== undefined) customerUpdate.labour_rate = labour_rate;
    
    // Update the customer record
    const { data, error } = await supabase
      .from('customers')
      .update(customerUpdate)
      .eq('registration_plate', registration_plate)
      .select();

    if (error) {
      throw error;
    }

    console.log('Customer updated successfully:', data);

    // Sync to active policies if requested
    let policySyncResult = null;
    if (sync_policy && data && data.length > 0) {
      const customerId = data[0].id;
      
      // Build policy update (only fields that exist in customer_policies)
      const policyUpdate: Record<string, any> = {};
      if (voluntary_excess !== undefined) policyUpdate.voluntary_excess = voluntary_excess;
      if (claim_limit !== undefined) policyUpdate.claim_limit = claim_limit;
      // Note: labour_rate doesn't exist in customer_policies table
      
      if (Object.keys(policyUpdate).length > 0) {
        const { data: policyData, error: policyError } = await supabase
          .from('customer_policies')
          .update(policyUpdate)
          .eq('customer_id', customerId)
          .eq('status', 'active')
          .select('id, claim_limit, voluntary_excess');
        
        if (policyError) {
          console.error('Policy sync error:', policyError);
        } else {
          console.log('Policy synced:', policyData);
          policySyncResult = policyData;
        }
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      data: data,
      policySynced: policySyncResult,
      message: `Updated customer ${registration_plate}`
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    console.error("Error updating customer:", error);
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
