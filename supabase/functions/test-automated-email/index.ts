import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Immediate logging to verify function is loading
console.log("[TEST-AUTOMATED-EMAIL] Function loaded and starting...");

const logStep = (step: string, details?: any) => {
  try {
    const timestamp = new Date().toISOString();
    const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
    console.log(`[${timestamp}] [TEST-AUTOMATED-EMAIL] ${step}${detailsStr}`);
  } catch (e) {
    console.log(`[${new Date().toISOString()}] [TEST-AUTOMATED-EMAIL] ${step} - [JSON stringify failed]`);
  }
};

serve(async (req) => {
  // Immediate request logging
  console.log(`[${new Date().toISOString()}] [TEST-AUTOMATED-EMAIL] === REQUEST RECEIVED ===`);
  console.log(`[${new Date().toISOString()}] [TEST-AUTOMATED-EMAIL] Method: ${req.method}`);
  console.log(`[${new Date().toISOString()}] [TEST-AUTOMATED-EMAIL] URL: ${req.url}`);
  
  if (req.method === "OPTIONS") {
    console.log(`[${new Date().toISOString()}] [TEST-AUTOMATED-EMAIL] Handling CORS preflight`);
    return new Response(null, { headers: corsHeaders });
  }

  let supabaseClient;
  try {
    console.log(`[TEST-AUTOMATED-EMAIL] Creating Supabase client...`);
    supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );
    console.log(`[TEST-AUTOMATED-EMAIL] Supabase client created successfully`);
  } catch (clientError) {
    console.error(`[TEST-AUTOMATED-EMAIL] Failed to create Supabase client:`, clientError);
    return new Response(JSON.stringify({ 
      success: false, 
      error: "Failed to initialize Supabase client",
      details: clientError instanceof Error ? clientError.message : String(clientError)
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }

  try {
    logStep("Test automated email function started");

    let requestBody;
    try {
      requestBody = await req.json();
      logStep("Request body parsed", { body: requestBody });
    } catch (parseError) {
      console.error(`[TEST-AUTOMATED-EMAIL] Failed to parse request body:`, parseError);
      return new Response(JSON.stringify({ 
        success: false, 
        error: "Invalid JSON in request body" 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    const { testEmail, planType = "basic", paymentType = "monthly" } = requestBody;
    
    if (!testEmail) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: "testEmail is required" 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    // Ensure test email is safe (contains "test" or uses a test domain)
    const safeTestPatterns = ['test', '@example.com', '@test.com', '+test@', '@mailinator.com'];
    const isSafeEmail = safeTestPatterns.some(pattern => testEmail.toLowerCase().includes(pattern));
    
    if (!isSafeEmail) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: "For safety, test email must contain 'test' or use a known test domain",
        allowedPatterns: safeTestPatterns 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    logStep("Using test email", { testEmail, planType, paymentType });

    // Generate test warranty reference
    const testWarrantyRef = `TEST-${Date.now()}`;
    
    // Create test customer record
    const testCustomer = {
      name: "Test Customer",
      email: testEmail,
      phone: "01234567890",
      first_name: "Test",
      last_name: "Customer",
      street: "123 Test Street",
      town: "Test Town",
      postcode: "TE5T 1NG",
      country: "United Kingdom",
      plan_type: planType,
      payment_type: paymentType,
      stripe_session_id: `test_${Date.now()}`,
      registration_plate: "TEST123",
      vehicle_make: "TEST",
      vehicle_model: "Test Model",
      vehicle_year: "2020",
      status: "Active",
      warranty_reference_number: testWarrantyRef
    };

    logStep("Creating test customer", { email: testEmail });

    const { data: customerData, error: customerError } = await supabaseClient
      .from('customers')
      .upsert(testCustomer, { onConflict: 'email' })
      .select()
      .maybeSingle();

    if (customerError) {
      logStep("Customer upsert error", customerError);
      return new Response(JSON.stringify({ 
        success: false, 
        error: `Failed to create test customer: ${customerError.message}`,
        details: customerError 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }

    if (!customerData) {
      logStep("No customer data returned from upsert");
      return new Response(JSON.stringify({ 
        success: false, 
        error: "Customer upsert succeeded but no data returned" 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }

    logStep("Test customer created", { customerId: customerData.id });

    // Wait a moment to ensure database consistency
    await new Promise(resolve => setTimeout(resolve, 100));

    // Create test policy record
    const testPolicy = {
      customer_id: customerData.id,
      email: testEmail,
      plan_type: planType.toLowerCase(),
      payment_type: paymentType,
      policy_number: testWarrantyRef,
      policy_start_date: new Date().toISOString(),
      policy_end_date: calculatePolicyEndDate(paymentType),
      status: 'active',
      email_sent_status: 'pending'
    };

    const { data: policyData, error: policyError } = await supabaseClient
      .from('customer_policies')
      .upsert(testPolicy, { onConflict: 'policy_number' })
      .select()
      .maybeSingle();

    if (policyError) {
      logStep("Policy upsert error", policyError);
      return new Response(JSON.stringify({ 
        success: false, 
        error: `Failed to create test policy: ${policyError.message}`,
        details: policyError 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }

    if (!policyData) {
      logStep("No policy data returned from upsert");
      return new Response(JSON.stringify({ 
        success: false, 
        error: "Policy upsert succeeded but no data returned" 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }

    logStep("Test policy created", { policyId: policyData.id });

    // Wait another moment for consistency
    await new Promise(resolve => setTimeout(resolve, 100));

    // Now test the automated email system by calling send-welcome-email-manual
    logStep("Testing automated email system", { 
      customerId: customerData.id, 
      policyId: policyData.id 
    });

    const emailPayload = {
      customerId: customerData.id,
      policyId: policyData.id
    };

    let emailResult, emailError;
    try {
      logStep("Invoking send-welcome-email function", emailPayload);
      
      const response = await supabaseClient.functions.invoke('send-welcome-email', {
        body: {
          email: testEmail,
          planType: planType,
          paymentType: paymentType,
          policyNumber: testWarrantyRef,
          registrationPlate: "TEST123",
          customerName: "Test Customer"
        }
      });
      
      emailResult = response.data;
      emailError = response.error;
      
      logStep("Email function response received", { 
        hasData: !!emailResult, 
        hasError: !!emailError,
        errorType: emailError?.name || 'none',
        errorMessage: emailError?.message || 'none',
        resultSuccess: emailResult?.success,
        statusCode: emailError?.status || 'unknown'
      });
      
      // Log the full error details for debugging
      if (emailError) {
        console.log('[TEST-AUTOMATED-EMAIL] Full error object:', JSON.stringify(emailError, null, 2));
      }
      
    } catch (invokeError) {
      logStep("Email function invoke failed", invokeError);
      emailError = {
        message: invokeError instanceof Error ? invokeError.message : String(invokeError),
        type: 'invoke_error',
        stack: invokeError instanceof Error ? invokeError.stack : undefined
      };
    }

    if (emailError) {
      logStep("Email test failed", emailError);
      
      // Update policy to reflect failure
      await supabaseClient
        .from('customer_policies')
        .update({ email_sent_status: 'failed' })
        .eq('id', policyData.id);
        
      return new Response(JSON.stringify({ 
        success: false, 
        error: "Email test failed",
        details: emailError,
        customerId: customerData.id,
        policyId: policyData.id,
        testEmail: testEmail,
        warrantyNumber: testWarrantyRef
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,  // Return 200 but with success: false for failed email
      });
    }

    logStep("Email test successful", emailResult);

    // Update policy to reflect success
    await supabaseClient
      .from('customer_policies')
      .update({ 
        email_sent_status: 'sent',
        email_sent_at: new Date().toISOString()
      })
      .eq('id', policyData.id);

    return new Response(JSON.stringify({ 
      success: true, 
      message: "Automated email test completed successfully",
      testResults: {
        customerId: customerData.id,
        policyId: policyData.id,
        testEmail: testEmail,
        warrantyNumber: testWarrantyRef,
        emailResult: emailResult
      }
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    logStep("CRITICAL ERROR in test-automated-email", { 
      message: errorMessage, 
      stack: errorStack,
      error: error 
    });
    
    return new Response(JSON.stringify({ 
      success: false, 
      error: errorMessage,
      stack: errorStack,
      type: 'critical_error'
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});

function calculatePolicyEndDate(paymentType: string): string {
  const now = new Date();
  switch (paymentType) {
    case 'monthly':
      now.setMonth(now.getMonth() + 1);
      break;
    case 'yearly':
      now.setFullYear(now.getFullYear() + 1);
      break;
    case 'two_yearly':
      now.setFullYear(now.getFullYear() + 2);
      break;
    case 'three_yearly':
      now.setFullYear(now.getFullYear() + 3);
      break;
    default:
      now.setMonth(now.getMonth() + 1);
  }
  return now.toISOString();
}