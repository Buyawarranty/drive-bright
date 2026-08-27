import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const timestamp = new Date().toISOString();
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[API-CONNECTIVITY-TEST] ${timestamp} ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Starting comprehensive API connectivity test");
    
    const testResults: {
      timestamp: string;
      bumper: { status: string; details: any };
      warranties2000: { status: string; details: any };
      stripe: { status: string; details: any };
      environment: any;
    } = {
      timestamp: new Date().toISOString(),
      bumper: { status: 'unknown', details: null },
      warranties2000: { status: 'unknown', details: null },
      stripe: { status: 'unknown', details: null },
      environment: {
        hasStripKey: !!Deno.env.get("STRIPE_SECRET_KEY"),
        hasBumperKey: !!Deno.env.get("BUMPER_API_KEY"),
        hasBumperSecret: !!Deno.env.get("BUMPER_SECRET_KEY"),
        hasWarrantiesUser: !!Deno.env.get("WARRANTIES_2000_USERNAME"),
        hasWarrantiesPass: !!Deno.env.get("WARRANTIES_2000_PASSWORD"),
      }
    };

    logStep("Environment check", testResults.environment);

    // Test Bumper API Connectivity
    try {
      const bumperApiKey = Deno.env.get("BUMPER_API_KEY");
      const bumperSecretKey = Deno.env.get("BUMPER_SECRET_KEY");
      
      if (bumperApiKey && bumperSecretKey) {
        logStep("Testing Bumper API connectivity");
        
        // Updated payload with all required fields from Bumper documentation
        const testPayload = {
          amount: "1.00",
          preferred_product_type: "paylater",
          api_key: bumperApiKey,
          success_url: "https://buyawarranty.com/test-success",
          failure_url: "https://buyawarranty.com/test-failure",
          currency: "GBP",
          order_reference: "TEST-001",
          invoice_number: `INV-${Date.now()}`,
          user_email: "test@buyawarranty.co.uk",
          first_name: "Test",
          last_name: "Customer",
          email: "test@buyawarranty.co.uk",
          mobile: "07123456789",
          vehicle_reg: "TEST123",
          instalments: "1",
          // Address fields directly (not nested in object)
          flat_number: "",
          building_name: "",
          building_number: "123",
          street: "Test Street",
          town: "London",
          county: "Greater London",
          postcode: "SW1A 1AA",
          country: "UK",
          // product_description as array of objects
          product_description: [{
            item: "Vehicle Warranty Test",
            quantity: "1",
            price: "1.00"
          }]
        };
        
        // Generate signature
        const signature = await generateSignature(testPayload, bumperSecretKey);
        (testPayload as any).signature = signature;

        logStep("Bumper test payload being sent", testPayload);

        const bumperResponse = await fetch("https://api.bumper.co/v2/apply/", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(testPayload)
        });

        const bumperText = await bumperResponse.text();
        logStep("Bumper API response", { 
          status: bumperResponse.status, 
          ok: bumperResponse.ok,
          hasRedirectUrl: bumperText.includes('redirect_url')
        });

        testResults.bumper = {
          status: bumperResponse.ok ? 'working' : 'error',
          details: {
            status: bumperResponse.status,
            statusText: bumperResponse.statusText,
            responsePreview: bumperText.substring(0, 200)
          }
        };
      } else {
        testResults.bumper = {
          status: 'missing_credentials',
          details: 'BUMPER_API_KEY or BUMPER_SECRET_KEY not configured'
        };
      }
    } catch (bumperError) {
      const errorMessage = bumperError instanceof Error ? bumperError.message : String(bumperError);
      logStep("Bumper API test failed", { error: errorMessage });
      testResults.bumper = {
        status: 'error',
        details: errorMessage
      };
    }

    // Warranties 2000 (Warranties Register) API — PERMANENTLY SWITCHED OFF.
    // Do NOT reinstate this call. No data of any kind may be sent to them.
    testResults.warranties2000 = {
      status: 'permanently_off',
      details: 'Integration permanently disabled. No requests are made to Warranties 2000.'
    };

    // Test Stripe API Connectivity
    try {
      const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
      
      if (stripeKey) {
        logStep("Testing Stripe API connectivity");
        
        // Just test retrieving account info - no actual charge
        const stripeResponse = await fetch('https://api.stripe.com/v1/account', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${stripeKey}`,
          },
        });

        const stripeData = await stripeResponse.json();
        logStep("Stripe API response", { 
          status: stripeResponse.status, 
          ok: stripeResponse.ok,
          hasAccount: !!stripeData.id
        });

        testResults.stripe = {
          status: stripeResponse.ok ? 'working' : 'error',
          details: {
            status: stripeResponse.status,
            accountId: stripeData.id || 'unknown',
            livemode: stripeData.livemode
          }
        };
      } else {
        testResults.stripe = {
          status: 'missing_credentials',
          details: 'STRIPE_SECRET_KEY not configured'
        };
      }
    } catch (stripeError) {
      const errorMessage = stripeError instanceof Error ? stripeError.message : String(stripeError);
      logStep("Stripe API test failed", { error: errorMessage });
      testResults.stripe = {
        status: 'error',
        details: errorMessage
      };
    }

    logStep("API connectivity test completed", testResults);

    return new Response(JSON.stringify(testResults), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in API connectivity test", { message: errorMessage });
    
    return new Response(JSON.stringify({ 
      success: false,
      error: errorMessage,
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});

// Generate signature exactly like the WordPress plugin
async function generateSignature(payload: any, secretKey: string): Promise<string> {
  // Keys to exclude from signature (from WordPress plugin)
  const excludedKeys = [
    'api_key',
    'signature', 
    'product_description',
    'preferred_product_type',
    'additional_data'
  ];

  // Filter payload to exclude those keys
  const filteredPayload: any = {};
  for (const [key, value] of Object.entries(payload)) {
    if (!excludedKeys.includes(key)) {
      filteredPayload[key] = value;
    }
  }

  // Sort keys alphabetically
  const sortedKeys = Object.keys(filteredPayload).sort();

  // Build signature string
  let signatureString = '';
  for (const key of sortedKeys) {
    signatureString += key.toUpperCase() + '=' + filteredPayload[key] + '&';
  }

  // Generate HMAC SHA-256 signature
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secretKey);
  const data = encoder.encode(signatureString);
  
  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign('HMAC', key, data);
  
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}