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

    const { registration_plate, voluntary_excess } = await req.json();
    
    console.log(`Updating voluntary excess for ${registration_plate} to ${voluntary_excess}`);
    
    // Update the customer record
    const { data, error } = await supabase
      .from('customers')
      .update({ voluntary_excess: voluntary_excess })
      .eq('registration_plate', registration_plate)
      .select();

    if (error) {
      throw error;
    }

    console.log('Customer updated successfully:', data);

    return new Response(JSON.stringify({ 
      success: true, 
      data: data,
      message: `Updated voluntary excess for ${registration_plate} to £${voluntary_excess}`
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