import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.2';
import React from 'npm:react@18.3.1';
import { renderAsync } from 'npm:@react-email/components@0.0.22';
import { AbandonedCartEmail } from './_templates/abandoned-cart.tsx';

// Utility functions for retrying fetch requests
const timedFetch = (url: string, options: RequestInit, timeout = 30000): Promise<Response> => {
  return Promise.race([
    fetch(url, options),
    new Promise<Response>((_, reject) =>
      setTimeout(() => reject(new Error('Request timeout')), timeout)
    ),
  ]);
};

const retryFetch = async (
  url: string,
  options: RequestInit,
  maxRetries = 3
): Promise<Response> => {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await timedFetch(url, options);
      
      // Don't retry on client errors (4xx), only server errors (5xx) and timeouts
      if (response.status >= 200 && response.status < 500) {
        return response;
      }

      lastError = new Error(`HTTP ${response.status}: ${response.statusText}`);
      
      if (attempt < maxRetries - 1) {
        const backoffTime = Math.pow(2, attempt) * 1000;
        console.log(`Attempt ${attempt + 1} failed, retrying in ${backoffTime}ms...`);
        await new Promise(resolve => setTimeout(resolve, backoffTime));
      }
    } catch (error) {
      lastError = error as Error;
      
      if (attempt < maxRetries - 1) {
        const backoffTime = Math.pow(2, attempt) * 1000;
        console.log(`Attempt ${attempt + 1} failed with error: ${error}, retrying in ${backoffTime}ms...`);
        await new Promise(resolve => setTimeout(resolve, backoffTime));
      }
    }
  }

  throw lastError || new Error('Max retries exceeded');
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SendEmailRequest {
  cartId: string; // Track individual cart
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  vehicleReg?: string;
  vehicleMake?: string;
  vehicleModel?: string;
  vehicleYear?: string;
  vehicleType?: string; // Added for special vehicles (EV, PHEV, MOTORBIKE)
  mileage?: string;
  fuelType?: string;
  transmission?: string;
  triggerType: 'pricing_page_view' | 'plan_selected' | 'pricing_page_view_24h' | 'pricing_page_view_72h';
  planName?: string;
  paymentType?: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false }
    });

    const emailRequest: SendEmailRequest = await req.json();
    console.log('Sending abandoned cart email:', emailRequest);

    // Check if we've already sent this type of email for this specific cart
    const { data: recentEmails, error: checkError } = await supabase
      .from('triggered_emails_log')
      .select('*')
      .eq('cart_id', emailRequest.cartId)
      .eq('trigger_type', emailRequest.triggerType)
      .limit(1);

    if (checkError) {
      console.error('Error checking recent emails:', checkError);
    }

    // If we already sent this type of email for this cart, skip
    if (recentEmails && recentEmails.length > 0) {
      console.log(`Skipping email - already sent ${emailRequest.triggerType} email for cart ${emailRequest.cartId}`);
      return new Response(JSON.stringify({ 
        success: true, 
        message: "Email already sent for this cart" 
      }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Get the email template
    const { data: template, error: templateError } = await supabase
      .from('abandoned_cart_email_templates')
      .select('*')
      .eq('trigger_type', emailRequest.triggerType)
      .eq('is_active', true)
      .single();

    if (templateError || !template) {
      console.error('Error fetching email template:', templateError);
      throw new Error('Email template not found');
    }

    // Generate URLs based on vehicle registration and type
    const baseUrl = 'https://buyawarranty.co.uk';
    const encodedReg = encodeURIComponent(emailRequest.vehicleReg || '');
    
    let continueUrl = `${baseUrl}`;
    let checkoutUrl = `${baseUrl}`;

    // If we have vehicle registration, create a state parameter to restore the flow
    if (emailRequest.vehicleReg) {
      // Map trigger types to correct steps:
      // - pricing_page_view, pricing_page_view_24h, pricing_page_view_72h → step 2 (quote page)
      // - plan_selected → step 3 (plan selection)
      let targetStep = 2; // Default to quote page
      if (emailRequest.triggerType === 'plan_selected') {
        targetStep = 3; // Plan was selected, return to plan selection
      }
      
      const stateParam = btoa(JSON.stringify({
        regNumber: emailRequest.vehicleReg,
        email: emailRequest.email,
        firstName: emailRequest.firstName || '',
        lastName: emailRequest.lastName || '',
        phone: emailRequest.phone || '',
        make: emailRequest.vehicleMake || '',
        model: emailRequest.vehicleModel || '',
        year: emailRequest.vehicleYear || '',
        vehicleType: emailRequest.vehicleType || 'car',
        fuelType: emailRequest.fuelType || '',
        transmission: emailRequest.transmission || '',
        step: targetStep,
        planName: emailRequest.planName,
        paymentType: emailRequest.paymentType,
        mileage: emailRequest.mileage || '0',
        address: ''
      }));
      continueUrl = `${baseUrl}?restore=${encodeURIComponent(stateParam)}`;
      checkoutUrl = continueUrl;
    }

    // Render React Email template
    const htmlContent = await renderAsync(
      React.createElement(AbandonedCartEmail, {
        firstName: emailRequest.firstName || 'there',
        vehicleReg: emailRequest.vehicleReg || '',
        vehicleMake: emailRequest.vehicleMake || '',
        vehicleModel: emailRequest.vehicleModel || '',
        planName: emailRequest.planName || '',
        continueUrl,
        triggerType: emailRequest.triggerType
      })
    );

    // Get subject from template or use dynamic based on trigger
    let subject = template.subject;
    const variables = {
      firstName: emailRequest.firstName || 'there',
      vehicleReg: emailRequest.vehicleReg || '',
      vehicleMake: emailRequest.vehicleMake || '',
      vehicleModel: emailRequest.vehicleModel || ''
    };
    
    // Replace variables in subject
    Object.entries(variables).forEach(([key, value]) => {
      const placeholder = `{{${key}}}`;
      subject = subject.replace(new RegExp(placeholder, 'g'), value);
    });

    // Send email using Resend with retry logic
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY is not set");
    }

    const emailPayload = {
      from: "Buy A Warranty <info@buyawarranty.co.uk>",
      to: [emailRequest.email],
      subject: subject,
      html: htmlContent,
      headers: {
        'X-Entity-Ref-ID': `cart-${emailRequest.cartId}`,
        'List-Unsubscribe': `<mailto:unsubscribe@buyawarranty.co.uk?subject=unsubscribe>`,
      },
      tags: [
        { name: 'category', value: 'transactional' },
        { name: 'type', value: 'abandoned-cart' },
        { name: 'vehicle-reg', value: (emailRequest.vehicleReg || 'unknown').replace(/\s+/g, '-') }
      ]
    };

    console.log("Sending email via Resend with retry logic...");
    
    const emailResponse = await retryFetch(
      "https://api.resend.com/emails",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${resendApiKey}`,
        },
        body: JSON.stringify(emailPayload),
      }
    );

    if (!emailResponse.ok) {
      const errorText = await emailResponse.text();
      throw new Error(`Resend API error: ${emailResponse.status} - ${errorText}`);
    }

    const emailResult = await emailResponse.json();
    console.log("Email sent successfully:", emailResult);

    // Log the sent email
    const { error: logError } = await supabase
      .from('triggered_emails_log')
      .insert([{
        cart_id: emailRequest.cartId,
        email: emailRequest.email,
        trigger_type: emailRequest.triggerType,
        template_id: template.id,
        vehicle_reg: emailRequest.vehicleReg,
        email_status: 'sent'
      }]);

    if (logError) {
      console.error('Error logging email:', logError);
    }

    return new Response(JSON.stringify({
      success: true,
      message: "Abandoned cart email sent successfully",
      emailId: emailResult.id
    }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });

  } catch (error: any) {
    console.error("Error in send-abandoned-cart-email function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);