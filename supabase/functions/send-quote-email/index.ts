import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.2';
import { logCustomerEmail } from '../_shared/log-email.ts';
import { renderBrandedQuoteEmail } from '../_shared/quote-email-template.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Latest customer-facing warranty documents.
// IMPORTANT: whenever a newer versioned PDF is added to /public (e.g.
// Terms-and-Conditions-v2.4.pdf or Platinum-Warranty-Plan-v2.5.pdf), bump
// these two constants so the automatic customer quote email always attaches
// the newest version.
const LATEST_TERMS_PDF = 'Terms-and-Conditions-v2.3.pdf';
const LATEST_PLATINUM_PLAN_PDF = 'Platinum-Warranty-Plan-v2.4.pdf';
const PUBLIC_ASSET_BASE = 'https://buyawarranty.co.uk';

async function fetchPdfAttachment(filename: string): Promise<{ filename: string; content: string } | null> {
  try {
    const res = await fetch(`${PUBLIC_ASSET_BASE}/${filename}`);
    if (!res.ok) {
      console.error(`[SEND-QUOTE-EMAIL] Failed to fetch attachment ${filename}: ${res.status}`);
      return null;
    }
    const buf = new Uint8Array(await res.arrayBuffer());
    // base64 encode
    let binary = '';
    const chunk = 0x8000;
    for (let i = 0; i < buf.length; i += chunk) {
      binary += String.fromCharCode(...buf.subarray(i, i + chunk));
    }
    return { filename, content: btoa(binary) };
  } catch (err) {
    console.error(`[SEND-QUOTE-EMAIL] Error fetching attachment ${filename}:`, err);
    return null;
  }
}

const logStep = (step: string, data?: any) => {
  console.log(`[SEND-QUOTE-EMAIL] ${step}`, data ? JSON.stringify(data) : '');
};

interface QuoteEmailRequest {
  email: string;
  firstName?: string;
  lastName?: string;
  vehicleData: {
    regNumber: string;
    make?: string;
    model?: string;
    year?: string;
    mileage: string;
    fuelType?: string;
    transmission?: string;
    vehicleType?: string;
  };
  isInitialQuote?: boolean;
  selectedPlan?: {
    name: string;
    price: number;
    paymentType: string;
    claimLimit?: number;
    labourRate?: number;
    voluntaryExcess?: number;
    boostAddon?: boolean;
    addOns?: string[];
  };
  quoteId?: string;
}

const formatPaymentType = (paymentType: string): string => {
  switch (paymentType) {
    case 'monthly': return 'Monthly';
    case 'yearly': return 'Annual';
    case 'twoYear': return '2 Year';
    case 'threeYear': return '3 Year';
    default: return paymentType;
  }
};

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep('Function started');
    
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) {
      throw new Error('RESEND_API_KEY environment variable is not set');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseServiceRoleKey) {
      throw new Error('Missing Supabase environment variables');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
    const data: QuoteEmailRequest = await req.json();
    
    logStep('Sending quote email', { email: data.email, vehicle: data.vehicleData.regNumber, requestHeaders: Object.fromEntries(req.headers.entries()) });

    const resend = new Resend(resendApiKey);
    
    // Generate unique quote ID
    const quoteId = `QUO-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
    
    // Always use production URL for email links
    const baseUrl = 'https://buyawarranty.co.uk';
    
    logStep('Email URL generation', { baseUrl, quoteId, email: data.email });
    
    // Build complete quote link with proper parameters for restoration
    const quoteLink = `${baseUrl}/?quote=${quoteId}&email=${encodeURIComponent(data.email)}&step=3`;
    logStep('Generated quote link', { quoteLink });
    
    // Store quote data in database for restoration
    try {
      const { error: insertError } = await supabase
        .from('quote_data')
        .insert({
          quote_id: quoteId,
          customer_email: data.email,
          vehicle_data: data.vehicleData,
          plan_data: data.selectedPlan || null,
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days from now
        });

      if (insertError) {
        console.error('Error storing quote data:', insertError);
        logStep('Error storing quote data', insertError);
      } else {
        logStep('Quote data stored successfully', { quoteId });
      }
    } catch (error) {
      console.error('Error storing quote data:', error);
      logStep('Exception storing quote data', error);
    }

    const vehicleDisplay = `${data.vehicleData.make || ''} ${data.vehicleData.model || ''}`.trim() || 'Your Vehicle';
    const paymentTypeStr = data.selectedPlan?.paymentType || 'monthly';
    const coverMonths = paymentTypeStr === 'threeYear' ? 36 : paymentTypeStr === 'twoYear' ? 24 : paymentTypeStr === 'yearly' ? 12 : 12;
    const htmlContent = renderBrandedQuoteEmail({
      firstName: data.firstName || null,
      vehicleDisplay,
      vehicleReg: data.vehicleData.regNumber || '',
      planName: data.selectedPlan?.name || 'Platinum',
      coverPeriodDisplay: `${coverMonths} months`,
      monthlyPrice: paymentTypeStr === 'monthly' ? data.selectedPlan?.price ?? null : null,
      payInFullPrice: paymentTypeStr !== 'monthly' ? data.selectedPlan?.price ?? null : null,
      savings: null,
      claimLimit: data.selectedPlan?.claimLimit ?? null,
      excessAmount: data.selectedPlan?.voluntaryExcess ?? null,
      labourRate: data.selectedPlan?.labourRate ?? null,
      mileage: Number(String(data.vehicleData.mileage || '0').replace(/,/g, '')) || null,
      quoteLink: `${baseUrl}/?quote=${quoteId}&email=${encodeURIComponent(data.email)}&step=3`,
      senderName: null,
      customerEmail: data.email,
      attachmentsNote: "I've also attached our latest Terms &amp; Conditions and the full Platinum plan document so you have everything in one place &mdash; feel free to have a read whenever suits you.",
    });
    // Subject line optimized for Primary inbox - conversational, no promotional language
    const customerName = data.firstName && data.firstName.trim() ? data.firstName.trim() : '';
    const emailSubject = customerName
      ? `${customerName}, your warranty details`
      : `Your warranty details`;
    const textContent = [
      customerName ? `Hi ${customerName},` : 'Hi,',
      '',
      `Thanks for the details on your ${vehicleDisplay}${data.vehicleData.regNumber ? ` (${data.vehicleData.regNumber})` : ''}. I have included the summary for your records.`,
      data.selectedPlan?.price ? `From £${Number(data.selectedPlan.price).toFixed(2)} ${formatPaymentType(data.selectedPlan.paymentType || '').toLowerCase()}.` : '',
      '',
      "I've also attached our latest Terms & Conditions and the full Platinum plan document so you have everything in one place — feel free to have a read whenever suits you.",
      '',
      `Details link: ${quoteLink}`,
      '',
      "If anything doesn't look right, reply to this email. You can also call us on 0330 229 5040 (Mon-Fri).",
      '',
      'Kind regards,',
      'Buyawarranty Customer Care',
    ].filter(Boolean).join('\n');
    
    // Fetch the latest T&Cs and Platinum plan PDFs so we can attach them.
    const [termsAttachment, planAttachment] = await Promise.all([
      fetchPdfAttachment(LATEST_TERMS_PDF),
      fetchPdfAttachment(LATEST_PLATINUM_PLAN_PDF),
    ]);
    const attachments = [termsAttachment, planAttachment].filter(Boolean) as { filename: string; content: string }[];
    logStep('Prepared attachments', { count: attachments.length, files: attachments.map(a => a.filename) });

    // Use info@ for quote/order mails to match the welcome email Primary-inbox reputation.
    const emailResponse = await resend.emails.send({
      from: 'Buyawarranty Customer Care <info@buyawarranty.co.uk>',
      to: [data.email],
      reply_to: 'support@buyawarranty.co.uk',
      subject: emailSubject,
      html: htmlContent,
      text: textContent,
      attachments,
    });

    logStep('Email sent successfully', emailResponse);
    await logCustomerEmail({
      recipient_email: data.email,
      recipient_name: customerName || data.firstName || null,
      subject: emailSubject,
      template_name: 'customer_quote',
      source_function: 'send-quote-email',
      status: emailResponse?.error ? 'failed' : 'sent',
      error_message: emailResponse?.error ? String((emailResponse.error as any)?.message || emailResponse.error) : null,
      registration_plate: data.vehicleData?.regNumber,
      metadata: { quote_id: quoteId, vehicle: vehicleDisplay, resend_message_id: (emailResponse as any)?.data?.id },
    });


    // Log the customer quote email to abandoned_cart_emails table
    try {
      // First, try to find the abandoned cart for this email
      const { data: cartData } = await supabase
        .from('abandoned_carts')
        .select('id')
        .eq('email', data.email)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      const { error: logError } = await supabase
        .from('abandoned_cart_emails')
        .insert({
          abandoned_cart_id: cartData?.id || null,
          customer_email: data.email,
          email_type: 'customer_quote',
          subject: emailSubject,
          vehicle_reg: data.vehicleData.regNumber,
          plan_name: data.selectedPlan?.name || null,
          price_amount: data.selectedPlan?.price || null,
        });

      if (logError) {
        console.error('Error logging quote email:', logError);
      } else {
        logStep('Quote email logged to abandoned_cart_emails');
      }
    } catch (logErr) {
      console.error('Exception logging quote email:', logErr);
    }

    logStep('Quote email sent and logged successfully');

    return new Response(JSON.stringify({ success: true, emailId: emailResponse.data?.id }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error('Error in send-quote-email function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  }
};

serve(handler);