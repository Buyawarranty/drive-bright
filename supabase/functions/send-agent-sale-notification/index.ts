import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY not configured");
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { leadId, agentId } = await req.json();

    if (!leadId) {
      throw new Error("leadId is required");
    }

    // Fetch lead details
    const { data: lead, error: leadError } = await supabase
      .from("sales_leads")
      .select("*")
      .eq("id", leadId)
      .maybeSingle();

    if (leadError || !lead) {
      console.error("Lead not found:", leadError);
      throw new Error("Lead not found");
    }

    // Fetch agent details
    let agentName = "Unknown Agent";
    if (agentId || lead.assigned_to) {
      const { data: agent } = await supabase
        .from("admin_users")
        .select("first_name, last_name, email")
        .eq("id", agentId || lead.assigned_to)
        .maybeSingle();

      if (agent) {
        agentName = [agent.first_name, agent.last_name].filter(Boolean).join(" ") || agent.email;
      }
    }

    // Check for customer record to get more details
    const { data: customer } = await supabase
      .from("customers")
      .select("*, plan_type, final_amount, payment_type, registration_plate, vehicle_make, vehicle_model")
      .ilike("email", lead.email)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // Check for policy to get warranty number
    const { data: policy } = await supabase
      .from("customer_policies")
      .select("warranty_number, plan_type, payment_amount, payment_type")
      .eq("email", lead.email)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const regPlate = lead.vehicle_reg || customer?.registration_plate || "Unknown";
    const planName = lead.plan_name || customer?.plan_type || policy?.plan_type || "Unknown";
    const saleValue = customer?.final_amount || policy?.payment_amount || lead.cart_value || lead.quote_amount;
    const saleValueDisplay = saleValue ? `£${Number(saleValue).toFixed(2)}` : "N/A";
    const paymentType = lead.payment_type || customer?.payment_type || policy?.payment_type || "Unknown";
    const warrantyNumber = policy?.warranty_number || "Pending";
    const customerName = lead.full_name || customer?.name || "Unknown";
    const customerEmail = lead.email;
    const customerPhone = lead.phone || customer?.phone || "N/A";

    // Get timing info
    const leadCreatedAt = lead.created_at 
      ? new Date(lead.created_at).toLocaleString('en-GB', { timeZone: 'Europe/London', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
      : '';
    const paymentTime = new Date().toLocaleString('en-GB', { timeZone: 'Europe/London', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #16a34a; border-bottom: 2px solid #16a34a; padding-bottom: 10px;">🎯 New Agent Sale - Lead Converted</h2>
        
        <!-- Agent Banner -->
        <div style="margin-top: 16px; padding: 12px 20px; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px;">
          <div style="font-size: 14px; color: #1e40af;"><strong>Converted by:</strong> ${agentName}</div>
        </div>

        <!-- Reg Plate Banner -->
        <div style="margin-top: 16px; padding: 16px 24px; background: #fef9c3; border: 2px solid #eab308; border-radius: 8px; text-align: center;">
          <div style="font-size: 28px; font-weight: 900; color: #000000; letter-spacing: 2px; font-family: 'Arial Black', Arial, sans-serif;">${regPlate}</div>
        </div>
        
        <!-- Sale Summary Banner -->
        <div style="margin-top: 16px; padding: 20px; background: linear-gradient(135deg, #16a34a 0%, #15803d 100%); border-radius: 8px; color: white;">
          <div style="font-size: 14px; opacity: 0.9;">Sale Value</div>
          <div style="font-size: 32px; font-weight: bold; margin: 5px 0;">${saleValueDisplay}</div>
          <div style="font-size: 14px; opacity: 0.9;">Payment: <strong>${paymentType}</strong></div>
        </div>
        
        <h3 style="color: #333; margin-top: 20px;">Customer Details</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <tr><td style="padding: 8px; background: #f3f4f6;"><strong>Name:</strong></td><td style="padding: 8px;">${customerName}</td></tr>
          <tr><td style="padding: 8px; background: #f3f4f6;"><strong>Email:</strong></td><td style="padding: 8px;">${customerEmail}</td></tr>
          <tr><td style="padding: 8px; background: #f3f4f6;"><strong>Phone:</strong></td><td style="padding: 8px;">${customerPhone}</td></tr>
        </table>

        <h3 style="color: #333; margin-top: 20px;">Sale Details</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <tr><td style="padding: 8px; background: #f3f4f6;"><strong>Warranty Number:</strong></td><td style="padding: 8px;">${warrantyNumber}</td></tr>
          <tr><td style="padding: 8px; background: #f3f4f6;"><strong>Plan:</strong></td><td style="padding: 8px;">${planName}</td></tr>
          <tr><td style="padding: 8px; background: #f3f4f6;"><strong>Payment Type:</strong></td><td style="padding: 8px;">${paymentType}</td></tr>
          <tr><td style="padding: 8px; background: #f3f4f6;"><strong>Amount:</strong></td><td style="padding: 8px;">${saleValueDisplay}</td></tr>
        </table>

        <h3 style="color: #333; margin-top: 20px;">Vehicle Details</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <tr><td style="padding: 8px; background: #f3f4f6;"><strong>Registration:</strong></td><td style="padding: 8px;">${regPlate}</td></tr>
          <tr><td style="padding: 8px; background: #f3f4f6;"><strong>Make:</strong></td><td style="padding: 8px;">${lead.vehicle_make || customer?.vehicle_make || 'Unknown'}</td></tr>
          <tr><td style="padding: 8px; background: #f3f4f6;"><strong>Model:</strong></td><td style="padding: 8px;">${lead.vehicle_model || customer?.vehicle_model || 'Unknown'}</td></tr>
        </table>

        <h3 style="color: #333; margin-top: 20px;">⏱️ Timing</h3>
        <table style="width: 100%; border-collapse: collapse;">
          ${leadCreatedAt ? `<tr><td style="padding: 8px; background: #f3f4f6;"><strong>Lead Submitted:</strong></td><td style="padding: 8px;">${leadCreatedAt}</td></tr>` : ''}
          <tr><td style="padding: 8px; background: #f3f4f6;"><strong>Payment Made:</strong></td><td style="padding: 8px;">${paymentTime}</td></tr>
        </table>

        <div style="margin-top: 30px; padding: 15px; background: #dcfce7; border-left: 4px solid #16a34a; border-radius: 5px;">
          <p style="margin: 0; color: #166534;"><strong>✓ Lead converted to sale by ${agentName}</strong></p>
        </div>
      </div>
    `;

    // Determine source prefix
    const leadSource = lead.lead_source || "unknown";
    let sourcePrefix = "S"; // S for Sales agent
    if (leadSource === "google_ad") sourcePrefix = "S-G";
    else if (leadSource === "social_ad") sourcePrefix = "S-F";

    const resend = new Resend(resendApiKey);
    await resend.emails.send({
      from: "BuyaWarranty Team <notifications@buyawarranty.co.uk>",
      to: ["info@buyawarranty.co.uk", "accounts@buyawarranty.co.uk"],
      subject: `New Sale ${sourcePrefix}: ${regPlate} - ${planName} - ${saleValueDisplay} - Converted by ${agentName}`,
      html: emailHtml,
    });

    console.log("Agent sale notification sent successfully for lead:", leadId);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Error sending agent sale notification:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
