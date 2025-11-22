import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[RESEND-WELCOME-EMAIL] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    logStep("Function started");

    const { customerEmail } = await req.json();
    logStep("Request data", { customerEmail });

    if (!customerEmail) {
      throw new Error("Customer email is required");
    }

    // Get customer data
    const { data: customer, error: customerError } = await supabaseClient
      .from('customers')
      .select('*')
      .eq('email', customerEmail)
      .maybeSingle();

    if (customerError) {
      logStep("Error fetching customer", { error: customerError.message });
      throw new Error(`Error fetching customer: ${customerError.message}`);
    }

    if (!customer) {
      logStep("Customer not found", { email: customerEmail });
      throw new Error(`Customer not found for email: ${customerEmail}`);
    }

    logStep("Customer found", { 
      name: customer.name, 
      planType: customer.plan_type,
      registrationPlate: customer.registration_plate 
    });

    // Get the latest policy for this customer
    const { data: policy, error: policyError } = await supabaseClient
      .from('customer_policies')
      .select('id, policy_number')
      .eq('email', customerEmail)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (policyError || !policy) {
      logStep("Warning: No policy found, using warranty reference number", policyError);
    }

    const policyNumber = policy?.policy_number || customer.warranty_reference_number || 'Policy number not available';

    // Call the send-welcome-email-manual function with customer data
    const { data: emailResult, error: emailError } = await supabaseClient.functions.invoke('send-welcome-email-manual', {
      body: {
        policyId: policy?.id,
        customerId: customer.id,
        forceResend: true
      }
    });

    if (emailError) {
      throw emailError;
    }

    logStep("Welcome email resent successfully", emailResult);

    return new Response(JSON.stringify({ 
      success: true, 
      message: "Welcome email resent successfully",
      customerName: customer.name,
      registrationPlate: customer.registration_plate,
      policyNumber: policyNumber
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in resend-welcome-email", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});