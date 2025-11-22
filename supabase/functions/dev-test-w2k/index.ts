import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TestW2KRequest {
  warranty_number?: string;
  customer_email?: string;
  customer_name?: string;
  registration_plate?: string;
}

// Timeout wrapper for fetch
async function timedFetch(url: string, options: RequestInit, timeoutMs = 15000): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

const handler = async (req: Request): Promise<Response> => {
  const rid = crypto.randomUUID();
  const t0 = Date.now();
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log(JSON.stringify({ evt: "test-w2k.start", rid }));
    
    // Check environment variables
    const w2kApiUrl = Deno.env.get('W2K_API_URL') || 'https://warranties-epf.co.uk/api.php';
    const w2kUsername = Deno.env.get('WARRANTIES_2000_USERNAME');
    const w2kPassword = Deno.env.get('WARRANTIES_2000_PASSWORD');
    
    console.log(JSON.stringify({ 
      evt: "env.check", 
      rid,
      hasUrl: !!w2kApiUrl,
      hasUsername: !!w2kUsername,
      hasPassword: !!w2kPassword
    }));
    
    if (!w2kUsername || !w2kPassword) {
      return new Response(JSON.stringify({ 
        ok: false, 
        rid,
        code: 'MISSING_CREDENTIALS', 
        error: 'WARRANTIES_2000_USERNAME or WARRANTIES_2000_PASSWORD not configured' 
      }), {
        status: 500,
        headers: { "content-type": "application/json", ...corsHeaders },
      });
    }

    // Parse request body with defaults
    const body: TestW2KRequest = await req.json().catch(() => ({}));
    const warrantyNumber = body.warranty_number || 'W-TEST-001';
    const customerEmail = body.customer_email || 'test@example.com';
    const customerName = body.customer_name || 'Test Customer';
    const registrationPlate = body.registration_plate || 'TEST123';
    
    console.log(JSON.stringify({ 
      evt: "request.parsed", 
      rid, 
      warrantyNumber, 
      customerEmail, 
      customerName, 
      registrationPlate 
    }));

    // Test data matching exact API specification
    const testData = {
      Title: 'Mr',
      First: customerName.split(' ')[0] || 'Test',
      Surname: customerName.split(' ').slice(1).join(' ') || 'Customer',
      Addr1: '123 Test Street',
      Addr2: '',
      Town: 'Test Town',
      PCode: 'TE1 1ST',
      Tel: '01234567890',
      Mobile: '07123456789',
      EMail: customerEmail,
      PurDate: new Date().toISOString().split('T')[0],
      Make: 'Ford',
      Model: 'Focus',
      RegNum: registrationPlate,
      Mileage: '50000', // Whole number as string
      EngSize: '', // Pass empty string as requested
      PurPrc: '15000',
      RegDate: '2020-01-01',
      WarType: 'BBASIC', // Must be from predefined list
      Month: '12', // Duration in months
      MaxClm: '500', // Full amount as string (£500)
      Notes: 'Test registration via dev-test-w2k',
      Ref: warrantyNumber,
      MOTDue: '2025-12-31'
    };

    console.log(JSON.stringify({ evt: "w2k.payload.prepared", rid }));

    // Send to Warranties 2000 API with basic auth
    const basicAuth = btoa(`${w2kUsername}:${w2kPassword}`);

    const w2kResponse = await timedFetch(w2kApiUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'authorization': `Basic ${basicAuth}`,
        'idempotency-key': warrantyNumber
      },
      body: JSON.stringify(testData)
    });

    const responseText = await w2kResponse.text();
    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = { raw_response: responseText.substring(0, 256) };
    }

    console.log(JSON.stringify({ 
      evt: "w2k.response", 
      rid, 
      status: w2kResponse.status,
      preview: responseText.substring(0, 256) 
    }));

    if (!w2kResponse.ok) {
      return new Response(JSON.stringify({ 
        ok: false, 
        rid,
        code: 'W2K_API_ERROR', 
        error: `Warranties 2000 API error: ${responseData.message || responseData.Response || 'Unknown error'}`,
        details: {
          status: w2kResponse.status,
          response: responseData
        }
      }), {
        status: 500,
        headers: { "content-type": "application/json", ...corsHeaders },
      });
    }

    console.log(JSON.stringify({ evt: "test-w2k.success", rid, referenceId: responseData.id || 'unknown' }));
    
    return new Response(JSON.stringify({ 
      ok: true, 
      rid,
      id: responseData.id || responseData.reference || 'unknown',
      message: 'Test request to Warranties 2000 successful',
      warrantyNumber,
      customerEmail,
      warranties2000Response: responseData
    }), {
      status: 200,
      headers: { "content-type": "application/json", ...corsHeaders },
    });

  } catch (error: any) {
    const msg = error instanceof Error ? error.message : String(error);
    console.log(JSON.stringify({ evt: "error", rid, error: msg }));
    
    return new Response(JSON.stringify({ 
      ok: false, 
      rid,
      code: 'UNHANDLED_ERROR', 
      error: msg 
    }), {
      status: 500,
      headers: { "content-type": "application/json", ...corsHeaders },
    });
  } finally {
    console.log(JSON.stringify({ evt: "edge.done", rid, ms: Date.now() - t0 }));
  }
};

serve(handler);