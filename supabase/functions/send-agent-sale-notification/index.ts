import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { sendInternalNotification } from "../_shared/send-internal-notification.ts";
import { sourceLetterFromLeadSource, saleSubjectKind, saleSubjectPrefix } from "../_shared/saleSubjectPrefix.ts";
import { formatClaimLimit } from "../_shared/claim-limit-display.ts";


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

    const body = await req.json();
    const {
      leadId,
      agentId,
      // Set by Confirm External Payment: the money is already verified, so the
      // email must be the full sale email with "Confirmed payment" in the subject.
      paymentConfirmed = false,
      customerId = null,
      paymentSource = null,
      address = null,
      // Used when no lead exists for the sale (walk-in / phone sale confirmed
      // straight through Confirm External Payment).
      customerOverride = null,
    } = body ?? {};

    if (!leadId && !customerId && !customerOverride) {
      throw new Error("leadId, customerId or customerOverride is required");
    }

    // Fetch lead details (optional — confirmed payments may have no lead row)
    let lead: any = null;
    if (leadId) {
      const { data, error: leadError } = await supabase
        .from("sales_leads")
        .select("*")
        .eq("id", leadId)
        .maybeSingle();
      if (leadError) console.error("Lead lookup failed:", leadError);
      lead = data;
    }

    if (!lead) {
      // Synthesise the minimum lead shape from the confirmation payload so the
      // whole template below keeps working.
      const o = customerOverride ?? {};
      lead = {
        id: null,
        first_name: o.firstName ?? null,
        last_name: o.lastName ?? null,
        email: o.email ?? null,
        phone: o.phone ?? null,
        vehicle_reg: o.vehicleReg ?? null,
        vehicle_make: o.vehicleMake ?? null,
        vehicle_model: o.vehicleModel ?? null,
        vehicle_year: o.vehicleYear ?? null,
        plan_interest: o.planType ?? null,
        lead_source: o.leadSource ?? "phone",
        created_at: null,
        assigned_to: agentId ?? null,
      };
    }

    // Fetch agent details
    let agentName = "Unknown Agent";
    let agentEmail: string | null = null;
    if (agentId || lead.assigned_to) {
      const { data: agent } = await supabase
        .from("admin_users")
        .select("first_name, last_name, email")
        .eq("id", agentId || lead.assigned_to)
        .maybeSingle();

      if (agent) {
        agentName = [agent.first_name, agent.last_name].filter(Boolean).join(" ") || agent.email;
        agentEmail = agent.email || null;
      }
    }


    // Find the customer record. The agent may convert the lead before (or
    // shortly after) the payment webhook lands, and the customer email on
    // file may differ from the lead email. So look up by email first, then
    // fall back to registration plate and phone.
    const normalisedReg = (lead.vehicle_reg || "").replace(/\s/g, "").toUpperCase();
    const normalisedPhone = (lead.phone || "").replace(/\D/g, "");
    const customerSelect = "*, name, first_name, last_name, plan_type, final_amount, payment_type, registration_plate, vehicle_make, vehicle_model, phone, email, claim_limit, voluntary_excess, labour_rate";

    let customer: any = null;
    if (customerId) {
      const { data } = await supabase
        .from("customers").select(customerSelect)
        .eq("id", customerId).maybeSingle();
      customer = data;
    }
    if (!customer && lead.email) {
      const { data } = await supabase
        .from("customers").select(customerSelect)
        .ilike("email", lead.email)
        .order("created_at", { ascending: false }).limit(1).maybeSingle();
      customer = data;
    }
    if (!customer && normalisedReg) {
      const { data } = await supabase
        .from("customers").select(customerSelect)
        .ilike("registration_plate", `%${normalisedReg}%`)
        .order("created_at", { ascending: false }).limit(1).maybeSingle();
      customer = data;
    }
    if (!customer && normalisedPhone.length >= 10) {
      const { data } = await supabase
        .from("customers").select(customerSelect)
        .ilike("phone", `%${normalisedPhone.slice(-10)}%`)
        .order("created_at", { ascending: false }).limit(1).maybeSingle();
      customer = data;
    }

    // If no customer record exists yet, auto-create a pending stub so the sale
    // shows up in the Customers tab with the ⏳ Confirm Payment button for a
    // manager to verify once payment lands.
    if (!customer && !paymentConfirmed) {
      const fullName = [lead.first_name, lead.last_name].filter(Boolean).join(" ").trim()
        || lead.email
        || "Pending customer";
      const stubPayload: Record<string, unknown> = {
        name: fullName,
        first_name: lead.first_name || fullName.split(" ")[0] || null,
        last_name: lead.last_name || null,
        email: (lead.email || `pending-${leadId}@buyawarranty.co.uk`).toLowerCase().trim(),
        phone: lead.phone || null,
        registration_plate: (lead.vehicle_reg || "").toUpperCase() || null,
        vehicle_make: lead.vehicle_make || null,
        vehicle_model: lead.vehicle_model || null,
        vehicle_year: lead.vehicle_year || null,
        plan_type: lead.plan_interest || "Pending review",
        status: "pending",
        is_manual_entry: true,
        payment_verified: false,
        purchase_source: "external",
        signup_date: new Date().toISOString(),
        assigned_to: agentId || lead.assigned_to || null,
        payment_confirmed_by: null,
      };
      const { data: created, error: createErr } = await supabase
        .from("customers")
        .insert(stubPayload)
        .select(customerSelect)
        .maybeSingle();
      if (createErr) {
        console.error("Failed to auto-create pending customer stub:", createErr);
      } else if (created) {
        customer = created;
        console.log("Created pending customer stub for lead", leadId, "→", (created as any).id);
      }
    }

    let policy: any = null;
    if (lead.email) {
      const { data } = await supabase
        .from("customer_policies")
        .select("warranty_number, plan_type, payment_amount, payment_type, email")
        .ilike("email", lead.email)
        .order("created_at", { ascending: false }).limit(1).maybeSingle();
      policy = data;
    }

    const leadFullName = [lead.first_name, lead.last_name].filter(Boolean).join(" ").trim();
    const customerFullName = customer
      ? (customer.name || [customer.first_name, customer.last_name].filter(Boolean).join(" ") || "").trim()
      : "";

    const o = customerOverride ?? {};
    const regPlate = lead.vehicle_reg || customer?.registration_plate || o.vehicleReg || "Unknown";
    const planName = lead.plan_interest || customer?.plan_type || policy?.plan_type || o.planType || "Pending review";
    const saleValue = customer?.final_amount || policy?.payment_amount || o.finalAmount || lead.cart_value || lead.quote_amount;
    const isPaymentPending = paymentConfirmed ? false : !customer?.payment_verified;
    const saleValueDisplay = saleValue ? `£${Number(saleValue).toFixed(2)}` : "Amount TBC";
    const paymentType = customer?.payment_type || policy?.payment_type || o.paymentType || "Pending payment confirmation";
    const warrantyNumber = policy?.warranty_number || o.warrantyNumber || "Pending";
    const customerName = leadFullName || customerFullName || [o.firstName, o.lastName].filter(Boolean).join(" ") || "Not provided";
    const customerEmail = lead.email || customer?.email || o.email || "Not provided";
    const customerPhone = lead.phone || customer?.phone || o.phone || "Not provided";
    const claimLimitRaw = customer?.claim_limit ?? o.claimLimit;
    const excessRaw = customer?.voluntary_excess ?? o.voluntaryExcess;
    const labourRaw = customer?.labour_rate ?? o.labourRate;
    const claimLimitDisplay = claimLimitRaw ? formatClaimLimit(claimLimitRaw) : "Not set";
    const excessDisplay = excessRaw != null ? `£${Number(excessRaw).toFixed(2)}` : "Not set";
    const labourRateDisplay = labourRaw ? `£${Number(labourRaw).toFixed(2)}/hr` : "Not set";
    const durationDisplay = durationLabel(customer?.duration_months, o.durationMonths, customer?.payment_type, policy?.payment_type, planName);
    const mileageDisplay = customer?.mileage || o.mileage || "Not provided";
    const vehicleYearDisplay = lead.vehicle_year || customer?.vehicle_year || o.vehicleYear || "Unknown";
    const paymentSourceDisplay = paymentSource || customer?.payment_source || "Not provided";
    const addressDisplay = (() => {
      const a = address || {};
      const parts = [
        a.flatNumber, a.buildingName, a.buildingNumber, a.street,
        a.town, a.county, a.postcode,
      ].filter(Boolean);
      if (parts.length) return parts.join(", ");
      const fallback = [
        customer?.building_number, customer?.street, customer?.town,
        customer?.county, customer?.postcode,
      ].filter(Boolean);
      return fallback.length ? fallback.join(", ") : "Not provided";
    })();
    const leadSourceDisplay = lead.lead_source || customer?.lead_source || o.leadSource || "Unknown";

    // Get timing info
    const leadCreatedAt = lead.created_at 
      ? new Date(lead.created_at).toLocaleString('en-GB', { timeZone: 'Europe/London', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
      : '';
    const paymentTime = new Date().toLocaleString('en-GB', { timeZone: 'Europe/London', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

    // When the agent flags a lead as converted before the payment has actually
    // landed we have no amount, warranty number, duration or excess yet. Sending
    // the full "sale" template in that state produced emails full of
    // "Amount TBC" / "Not set" placeholders, so we send a short, honest
    // heads-up instead. The full sale email goes out once payment is confirmed.
    const pendingHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #b45309; border-bottom: 2px solid #f59e0b; padding-bottom: 10px;">🕒 Lead marked as converted — awaiting payment</h2>

        <div style="margin-top: 16px; padding: 12px 20px; background: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; color: #92400e; font-size: 14px;">
          No payment has been confirmed for this lead yet, so there are no sale figures to report.
          A full sale notification with the amount, warranty number and cover details will be sent
          automatically once the payment is confirmed.
        </div>

        <div style="margin-top: 16px; padding: 12px 20px; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px;">
          <div style="font-size: 14px; color: #1e40af;"><strong>Marked converted by:</strong> ${agentName}</div>
        </div>

        <div style="margin-top: 16px; padding: 16px 24px; background: #fef9c3; border: 2px solid #eab308; border-radius: 8px; text-align: center;">
          <div style="font-size: 28px; font-weight: 900; color: #000000; letter-spacing: 2px; font-family: 'Arial Black', Arial, sans-serif;">${regPlate}</div>
        </div>

        <h3 style="color: #333; margin-top: 20px;">Customer</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <tr><td style="padding: 8px; background: #f3f4f6;"><strong>Name:</strong></td><td style="padding: 8px;">${customerName}</td></tr>
          <tr><td style="padding: 8px; background: #f3f4f6;"><strong>Email:</strong></td><td style="padding: 8px;">${customerEmail}</td></tr>
          <tr><td style="padding: 8px; background: #f3f4f6;"><strong>Phone:</strong></td><td style="padding: 8px;">${customerPhone}</td></tr>
          <tr><td style="padding: 8px; background: #f3f4f6;"><strong>Vehicle:</strong></td><td style="padding: 8px;">${lead.vehicle_make || customer?.vehicle_make || 'Unknown'} ${lead.vehicle_model || customer?.vehicle_model || ''}</td></tr>
          <tr><td style="padding: 8px; background: #f3f4f6;"><strong>Plan discussed:</strong></td><td style="padding: 8px;">${planName}</td></tr>
          ${leadCreatedAt ? `<tr><td style="padding: 8px; background: #f3f4f6;"><strong>Lead came in:</strong></td><td style="padding: 8px;">${leadCreatedAt}</td></tr>` : ''}
          <tr><td style="padding: 8px; background: #f3f4f6;"><strong>Marked converted:</strong></td><td style="padding: 8px;">${paymentTime}</td></tr>
        </table>

        <div style="margin-top: 24px; padding: 15px; background: #fffbeb; border-left: 4px solid #f59e0b; border-radius: 5px;">
          <p style="margin: 0; color: #92400e;"><strong>Action:</strong> confirm the payment in Customer Management to complete this sale.</p>
        </div>
      </div>
    `;



    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #16a34a; border-bottom: 2px solid #16a34a; padding-bottom: 10px;">${paymentConfirmed ? '✅ Confirmed payment — new sale' : '🎯 New Agent Sale - Lead Converted'}</h2>
        
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
          <tr><td style="padding: 8px; background: #f3f4f6;"><strong>Address:</strong></td><td style="padding: 8px;">${addressDisplay}</td></tr>
        </table>


        <h3 style="color: #333; margin-top: 20px;">Sale Details</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <tr><td style="padding: 8px; background: #f3f4f6;"><strong>Warranty Number:</strong></td><td style="padding: 8px;">${warrantyNumber}</td></tr>
          <tr><td style="padding: 8px; background: #f3f4f6;"><strong>Plan:</strong></td><td style="padding: 8px;">${planName}</td></tr>
          <tr><td style="padding: 8px; background: #fde68a;"><strong>Warranty Duration:</strong></td><td style="padding: 8px; font-weight: 700;">${durationDisplay}</td></tr>
          <tr><td style="padding: 8px; background: #f3f4f6;"><strong>Payment Type:</strong></td><td style="padding: 8px;">${paymentType}</td></tr>
          <tr><td style="padding: 8px; background: #f3f4f6;"><strong>Sale Amount:</strong></td><td style="padding: 8px; font-weight: 700; font-size: 16px;">${saleValueDisplay}${isPaymentPending ? ' <span style="color:#92400e;font-weight:600;">(confirmation pending)</span>' : ''}</td></tr>
          <tr><td style="padding: 8px; background: #f3f4f6;"><strong>Claim Limit:</strong></td><td style="padding: 8px;">${claimLimitDisplay}</td></tr>
          <tr><td style="padding: 8px; background: #f3f4f6;"><strong>Voluntary Excess:</strong></td><td style="padding: 8px;">${excessDisplay}</td></tr>
          <tr><td style="padding: 8px; background: #f3f4f6;"><strong>Labour Rate:</strong></td><td style="padding: 8px;">${labourRateDisplay}</td></tr>
          <tr><td style="padding: 8px; background: #f3f4f6;"><strong>Payment Source:</strong></td><td style="padding: 8px;">${paymentSourceDisplay}</td></tr>
          <tr><td style="padding: 8px; background: #f3f4f6;"><strong>Lead Source:</strong></td><td style="padding: 8px;">${leadSourceDisplay}</td></tr>
        </table>

        <h3 style="color: #333; margin-top: 20px;">Vehicle Details</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <tr><td style="padding: 8px; background: #f3f4f6;"><strong>Registration:</strong></td><td style="padding: 8px;">${regPlate}</td></tr>
          <tr><td style="padding: 8px; background: #f3f4f6;"><strong>Make:</strong></td><td style="padding: 8px;">${lead.vehicle_make || customer?.vehicle_make || 'Unknown'}</td></tr>
          <tr><td style="padding: 8px; background: #f3f4f6;"><strong>Model:</strong></td><td style="padding: 8px;">${lead.vehicle_model || customer?.vehicle_model || 'Unknown'}</td></tr>
          <tr><td style="padding: 8px; background: #f3f4f6;"><strong>Year:</strong></td><td style="padding: 8px;">${vehicleYearDisplay}</td></tr>
          <tr><td style="padding: 8px; background: #f3f4f6;"><strong>Mileage:</strong></td><td style="padding: 8px;">${mileageDisplay}</td></tr>
        </table>

        <h3 style="color: #333; margin-top: 20px;">⏱️ Timing</h3>
        <table style="width: 100%; border-collapse: collapse;">
          ${leadCreatedAt ? `<tr><td style="padding: 8px; background: #f3f4f6;"><strong>Lead came in time:</strong></td><td style="padding: 8px;">${leadCreatedAt}</td></tr>` : ''}
          <tr><td style="padding: 8px; background: #f3f4f6;"><strong>Payment Made:</strong></td><td style="padding: 8px;">${paymentTime}</td></tr>
        </table>

        <div style="margin-top: 30px; padding: 15px; background: #dcfce7; border-left: 4px solid #16a34a; border-radius: 5px;">
          <p style="margin: 0; color: #166534;"><strong>✓ Lead converted to sale by ${agentName}</strong></p>
        </div>
      </div>
    `;

    // Determine source prefix. Quote-link sales keep the marketing channel
    // visible ("S-Q/G" = agent quote link from a Google lead).
    const leadSource = lead.lead_source || "unknown";
    const letter = sourceLetterFromLeadSource(leadSource);
    const isQuoteSale = letter === 'Q';
    const rawChannel = (lead as any).acquisition_source || (lead as any).utm_source || (customer as any)?.acquisition_source;
    const channelLetter = isQuoteSale
      ? (rawChannel ? sourceLetterFromLeadSource(rawChannel) : 'Q')
      : letter;
    const sourcePrefix = saleSubjectPrefix({ letter: channelLetter, isAgentSale: true, isQuote: isQuoteSale });
    const subjectKind = saleSubjectKind({ letter: channelLetter, isAgentSale: true, isQuote: isQuoteSale });

    const amountPart = saleValue ? ` - ${saleValueDisplay}` : '';
    const paymentPart = paymentType ? ` via ${paymentType}` : '';
    const subject = isPaymentPending
      ? `Lead converted — awaiting payment ${sourcePrefix}: ${regPlate} (${agentName})`
      : paymentConfirmed
        ? `Confirmed payment — ${subjectKind}: ${regPlate}${amountPart}${paymentPart} (${agentName})`
        : `New ${subjectKind}: ${regPlate}${amountPart}${paymentPart}`;
    // The sales agent who converted the lead is always copied in, alongside
    // the internal ops mailboxes.
    const recipients = ["info@buyawarranty.co.uk", "accounts@buyawarranty.co.uk"];
    if (agentEmail && !recipients.some(r => r.toLowerCase() === agentEmail!.toLowerCase())) {
      recipients.push(agentEmail);
    }
    const notifyResult = await sendInternalNotification({
      to: recipients,

      subject,
      html: isPaymentPending ? pendingHtml : emailHtml,

      template: "agent_sale_notification",
      sourceFunction: "send-agent-sale-notification",
      metadata: {
        lead_id: leadId,
        registration_plate: regPlate,
        agent_name: agentName,
        source_prefix: sourcePrefix,
      },
    });

    console.log("Agent sale notification result:", { leadId, notifyResult });

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

// Work out the warranty length (12 / 24 / 36 months) from whatever field carries it.
function durationLabel(...vals: any[]): string {
  for (const v of vals) {
    if (v == null) continue;
    const n = typeof v === 'number' ? v : Number(String(v).replace(/[^0-9]/g, ''));
    const s = String(v).toLowerCase();
    if (s.includes('three') || s.includes('3 year') || s.includes('3-year') || n === 36 || n === 3) return '3 Years (36 months)';
    if (s.includes('two') || s.includes('2 year') || s.includes('2-year') || n === 24 || n === 2) return '2 Years (24 months)';
    if (s.includes('one') || s.includes('1 year') || s.includes('1-year') || s.includes('year') || s.includes('month') || n === 12 || n === 1) return '1 Year (12 months)';
  }
  return 'Not set';
}
