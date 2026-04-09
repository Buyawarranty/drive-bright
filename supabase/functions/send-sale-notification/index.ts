import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DEFAULT_SUPPORT_ID = 'e39499b8-f88c-4963-9f0d-63e1addb3025';

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) throw new Error("RESEND_API_KEY not configured");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const {
      customerName, customerEmail, customerPhone,
      regPlate, planName, saleValue, paymentMethod,
      warrantyReference, vehicleMake, vehicleModel,
      agentId, agentName: providedAgentName, saleSource
    } = await req.json();

    if (!customerEmail) throw new Error("customerEmail is required");

    const saleValueDisplay = saleValue ? `£${Number(saleValue).toFixed(2)}` : 'N/A';
    const reg = regPlate || 'Unknown';
    const plan = planName || 'Unknown';
    const payment = paymentMethod || 'Unknown';
    const name = customerName || 'Unknown';
    const phone = customerPhone || 'N/A';
    const warranty = warrantyReference || 'Pending';

    // Determine sale type (G/F/Web/S)
    // Check if there's an agent assigned via sales_leads
    let resolvedAgentName = providedAgentName || null;
    let resolvedAgentId = agentId || null;
    let saleType = saleSource || 'Web';

    // Look up when the lead first came in
    const { data: matchedLead } = await supabase
      .from('sales_leads')
      .select('id, assigned_to, lead_source, created_at')
      .ilike('email', customerEmail)
      .not('assigned_to', 'is', null)
      .neq('assigned_to', DEFAULT_SUPPORT_ID)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    // Also get the earliest lead date
    let leadCreatedAt = '';
    try {
      const { data: earliestLead } = await supabase
        .from('sales_leads')
        .select('created_at')
        .ilike('email', customerEmail)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      if (earliestLead?.created_at) {
        leadCreatedAt = new Date(earliestLead.created_at).toLocaleString('en-GB', { timeZone: 'Europe/London', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
      }
    } catch (e) { /* ignore */ }
    const paymentTime = new Date().toLocaleString('en-GB', { timeZone: 'Europe/London', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

    const isAgentSale = !!(matchedLead?.assigned_to) || (resolvedAgentId && resolvedAgentId !== DEFAULT_SUPPORT_ID);
    const effectiveAgentId = resolvedAgentId || matchedLead?.assigned_to;

    if (isAgentSale && effectiveAgentId && !resolvedAgentName) {
      const { data: agentData } = await supabase
        .from('admin_users')
        .select('first_name, last_name, email')
        .eq('id', effectiveAgentId)
        .maybeSingle();
      
      if (agentData) {
        resolvedAgentName = [agentData.first_name, agentData.last_name].filter(Boolean).join(' ') || agentData.email;
      }
    }

    // Determine source prefix
    const leadSource = matchedLead?.lead_source || 'unknown';
    if (!saleSource) {
      if (leadSource === 'google_ad') saleType = 'G';
      else if (leadSource === 'social_ad') saleType = 'F';
      else saleType = 'Web';
    }

    // Build standard sale email
    const salesEmailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #16a34a; border-bottom: 2px solid #16a34a; padding-bottom: 10px;">🎉 New Sale</h2>
        ${isAgentSale ? `
        <div style="margin-top: 16px; padding: 12px 20px; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px;">
          <div style="font-size: 14px; color: #1e40af;"><strong>Converted by:</strong> ${resolvedAgentName || 'Unknown Agent'}</div>
        </div>` : ''}
        <div style="margin-top: 16px; padding: 16px 24px; background: #fef9c3; border: 2px solid #eab308; border-radius: 8px; text-align: center;">
          <div style="font-size: 28px; font-weight: 900; color: #000000; letter-spacing: 2px; font-family: 'Arial Black', Arial, sans-serif;">${reg}</div>
        </div>
        <div style="margin-top: 16px; padding: 20px; background: linear-gradient(135deg, #16a34a 0%, #15803d 100%); border-radius: 8px; color: white;">
          <div style="font-size: 14px; opacity: 0.9;">Sale Value</div>
          <div style="font-size: 32px; font-weight: bold; margin: 5px 0;">${saleValueDisplay}</div>
          <div style="font-size: 14px; opacity: 0.9;">Payment: <strong>${payment}</strong></div>
        </div>
        <h3 style="color: #333; margin-top: 20px;">Customer Details</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <tr><td style="padding: 8px; background: #f3f4f6;"><strong>Name:</strong></td><td style="padding: 8px;">${name}</td></tr>
          <tr><td style="padding: 8px; background: #f3f4f6;"><strong>Email:</strong></td><td style="padding: 8px;">${customerEmail}</td></tr>
          <tr><td style="padding: 8px; background: #f3f4f6;"><strong>Phone:</strong></td><td style="padding: 8px;">${phone}</td></tr>
        </table>
        <h3 style="color: #333; margin-top: 20px;">Sale Details</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <tr><td style="padding: 8px; background: #f3f4f6;"><strong>Warranty:</strong></td><td style="padding: 8px;">${warranty}</td></tr>
          <tr><td style="padding: 8px; background: #f3f4f6;"><strong>Plan:</strong></td><td style="padding: 8px;">${plan}</td></tr>
          <tr><td style="padding: 8px; background: #f3f4f6;"><strong>Payment:</strong></td><td style="padding: 8px;">${payment}</td></tr>
          <tr><td style="padding: 8px; background: #f3f4f6;"><strong>Amount:</strong></td><td style="padding: 8px;">${saleValueDisplay}</td></tr>
        </table>
        <h3 style="color: #333; margin-top: 20px;">Vehicle Details</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <tr><td style="padding: 8px; background: #f3f4f6;"><strong>Registration:</strong></td><td style="padding: 8px;">${reg}</td></tr>
          <tr><td style="padding: 8px; background: #f3f4f6;"><strong>Make:</strong></td><td style="padding: 8px;">${vehicleMake || 'Unknown'}</td></tr>
          <tr><td style="padding: 8px; background: #f3f4f6;"><strong>Model:</strong></td><td style="padding: 8px;">${vehicleModel || 'Unknown'}</td></tr>
        </table>
        <h3 style="color: #333; margin-top: 20px;">⏱️ Timing</h3>
        <table style="width: 100%; border-collapse: collapse;">
          ${leadCreatedAt ? `<tr><td style="padding: 8px; background: #f3f4f6;"><strong>Lead Submitted:</strong></td><td style="padding: 8px;">${leadCreatedAt}</td></tr>` : ''}
          <tr><td style="padding: 8px; background: #f3f4f6;"><strong>Payment Made:</strong></td><td style="padding: 8px;">${paymentTime}</td></tr>
        </table>
        <div style="margin-top: 30px; padding: 15px; background: #dcfce7; border-left: 4px solid #16a34a; border-radius: 5px;">
          <p style="margin: 0; color: #166534;"><strong>✓ ${isAgentSale ? `Lead converted to sale by ${resolvedAgentName}` : 'Sale completed'}</strong></p>
        </div>
      </div>
    `;

    const resend = new Resend(resendApiKey);

    // Send main sale notification
    const subjectPrefix = isAgentSale 
      ? `New Sale S${leadSource === 'google_ad' ? '-G' : leadSource === 'social_ad' ? '-F' : ''}`
      : `New Sale ${saleType}`;

    await resend.emails.send({
      from: "BuyaWarranty Team <notifications@buyawarranty.co.uk>",
      to: ["info@buyawarranty.co.uk", "accounts@buyawarranty.co.uk"],
      subject: `${subjectPrefix}: ${reg} - ${plan} - ${saleValueDisplay} via ${payment}${isAgentSale ? ` - Converted by ${resolvedAgentName}` : ''}`,
      html: salesEmailHtml,
    });

    console.log("Sale notification sent:", { customerEmail, saleType: subjectPrefix, isAgentSale });

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Error sending sale notification:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
