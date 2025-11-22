import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TestEmailRequest {
  email?: string;
  warranty_number?: string;
  customer_name?: string;
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

function renderWelcomeHTML(data: { name: string; warranty: string }): string {
  return `
    <h1>Welcome ${data.name}!</h1>
    <p>This is a test email. Your warranty number is: <strong>${data.warranty}</strong></p>
    <p>Test PDF document is attached to this email.</p>
    <p>If you received this, the email system is working correctly!</p>
  `;
}

const handler = async (req: Request): Promise<Response> => {
  const rid = crypto.randomUUID();
  const t0 = Date.now();
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log(JSON.stringify({ evt: "test-email.start", rid }));
    
    // Check environment variables
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    const resendFrom = 'Buy A Warranty <support@buyawarranty.co.uk>';
    
    console.log(JSON.stringify({ 
      evt: "env.check", 
      rid,
      hasResendKey: !!resendApiKey,
      hasFrom: !!resendFrom
    }));
    
    if (!resendApiKey) {
      return new Response(JSON.stringify({ 
        ok: false, 
        rid, 
        code: 'MISSING_ENV', 
        error: 'RESEND_API_KEY not configured' 
      }), {
        status: 500,
        headers: { "content-type": "application/json", ...corsHeaders },
      });
    }

    // Parse request body with defaults
    const body: TestEmailRequest = await req.json().catch(() => ({}));
    const email = body.email || 'test@example.com';
    const warrantyNumber = body.warranty_number || 'W-TEST-001';
    const customerName = body.customer_name || 'Test Customer';
    
    console.log(JSON.stringify({ evt: "request.parsed", rid, email, warrantyNumber, customerName }));

    // Create a small test PDF (base64 encoded tiny PDF)
    const testPdfBase64 = "JVBERi0xLjMKJcTl8uXrp/Og0MTGCjQgMCBvYmoKPDwKL0xlbmd0aCA5NDEKL0ZpbHRlciBbL0ZsYXRlRGVjb2RlXQo+PgpzdHJlYW0KeAFdjkEOwjAMRK8S+QdqJ3FTcx1WCBZChUAFFGhpobmAdUKBCp1+fG2J5Y8wGY2eAPjcl5PtQXcaOI5NxmGCaYXJGy2dVS2V6zHNX7WGAYfBTKPPO8xS+qWsj3sDn2s8rJeJ+fVYXFNHC2Y4Y6TcKvQ1VQqVl2VeFwMmS1zNtdNmGnl2ej9bgUrCjwagSYcPmTNcYhZfNWjJ+lN5u8TnMLWDhtOcUNLt5UKFKu5MZz9lKFyOQ9cqCWFhq5KqU0ek6SkkdYi1FwTz3JJKNjPFZgP8+w/iU/+4CmVuZHN0cmVhbQplbmRvYmoKCjEgMCBvYmoKPDwKL1R5cGUgL0NhdGFsb2cKL091dGxpbmVzIDIgMCBSCi9QYWdlcyAzIDAgUgo+PgplbmRvYmoKCjIgMCBvYmoKPDwKL1R5cGUgL091dGxpbmVzCi9Db3VudCAwCj4+CmVuZG9iagoKMyAwIG9iago8PAovVHlwZSAvUGFnZXMKL0NvdW50IDEKL0tpZHMgWzQgMCBSXQo+PgplbmRvYmoKCjQgMCBvYmoKPDwKL1R5cGUgL1BhZ2UKL1BhcmVudCAzIDAgUgovUmVzb3VyY2VzIDw8Ci9Gb250IDw8Ci9GMSAxMyAwIFIKPj4KPj4KL01lZGlhQm94IFswIDAgNjEyIDc5Ml0KL0NvbnRlbnRzIDQgMCBSCj4+CmVuZG9iagoKNSAwIG9iago8PAovVHlwZSAvRm9udAovU3VidHlwZSAvVHlwZTEKL0Jhc2VGb250IC9UaW1lcy1Sb21hbgo+PgplbmRvYmoKCnhyZWYKMCA2CjAwMDAwMDAwMDAgNjU1MzUgZiAKMDAwMDAwMDI1NiAwMDAwMCBuIAowMDAwMDAwMzE2IDAwMDAwIG4gCjAwMDAwMDAzNjYgMDAwMDAgbiAKMDAwMDAwMDQyMyAwMDAwMCBuIAowMDAwMDAwNjEzIDAwMDAwIG4gCnRyYWlsZXIKPDwKL1NpemUgNgovUm9vdCAxIDAgUgo+PgpzdGFydHhyZWYKNzAxCiUlRU9G";
    
    // Send test email via Resend REST API
    const emailPayload = {
      from: resendFrom,
      to: [email],
      subject: `Test Email — Warranty ${warrantyNumber}`,
      html: renderWelcomeHTML({ name: customerName, warranty: warrantyNumber }),
      attachments: [{
        filename: `test-warranty-${warrantyNumber}.pdf`,
        content: testPdfBase64,
        type: 'application/pdf'
      }]
    };

    console.log(JSON.stringify({ 
      evt: "email.sending", 
      rid, 
      to: email,
      hasAttachment: true 
    }));

    const emailResponse = await timedFetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'authorization': `Bearer ${resendApiKey}`,
        'content-type': 'application/json'
      },
      body: JSON.stringify(emailPayload)
    });

    const responseText = await emailResponse.text();
    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = { raw_response: responseText.substring(0, 256) };
    }

    console.log(JSON.stringify({ 
      evt: "resend.response", 
      rid, 
      status: emailResponse.status,
      preview: responseText.substring(0, 256) 
    }));

    if (!emailResponse.ok) {
      return new Response(JSON.stringify({ 
        ok: false, 
        rid,
        code: 'EMAIL_SEND_FAILED', 
        error: responseData.message || 'Email send failed',
        details: {
          status: emailResponse.status,
          response: responseData
        }
      }), {
        status: 500,
        headers: { "content-type": "application/json", ...corsHeaders },
      });
    }

    console.log(JSON.stringify({ evt: "test-email.success", rid, resendId: responseData.id }));
    
    return new Response(JSON.stringify({ 
      ok: true, 
      rid,
      id: responseData.id,
      message: 'Test email sent successfully',
      email,
      warrantyNumber,
      customerName
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