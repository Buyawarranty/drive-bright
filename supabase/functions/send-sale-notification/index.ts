import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { sendInternalNotification } from "../_shared/send-internal-notification.ts";
import { sourceLetterFromLeadSource, saleSubjectKind, saleSubjectPrefix } from "../_shared/saleSubjectPrefix.ts";
import { formatClaimLimit } from "../_shared/claim-limit-display.ts";


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
      agentId, agentName: providedAgentName, saleSource, durationMonths
    } = await req.json();

    if (!customerEmail) throw new Error("customerEmail is required");

    const saleValueDisplay = saleValue ? `£${Number(saleValue).toFixed(2)}` : 'N/A';
    const reg = regPlate || 'Unknown';
    const plan = planName || 'Unknown';
    const prettyPayment = (v: any): string => {
      const s = String(v || '').trim();
      if (!s) return 'Unknown';
      const k = s.toLowerCase().replace(/[\s-]+/g, '_');
      const map: Record<string, string> = {
        payment_assist: 'Payment Assist',
        bumper: 'Bumper (Pay Monthly)',
        stripe: 'Stripe (Paid in Full)',
        card: 'Card',
        bank_transfer: 'Bank transfer',
        cash: 'Cash',
      };
      return map[k] || s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    };
    const payment = prettyPayment(paymentMethod);
    const name = customerName || 'Unknown';
    const phone = customerPhone || 'N/A';
    const warranty = warrantyReference || 'Pending';


    // Fetch the full customer/sale record so managers get every sale + vehicle field.
    // Scoped by registration plate first (one customer can hold several vehicles).
    let saleExtras: Record<string, any> = {};
    try {
      const normalizedReg = String(regPlate || '').toUpperCase().replace(/\s/g, '');
      const cols = 'claim_limit, voluntary_excess, labour_rate, payment_type, plan_type, mileage, vehicle_make, vehicle_model, vehicle_year, vehicle_fuel_type, vehicle_transmission, registration_plate, signup_date, discount_code, discount_amount, original_amount, final_amount, sale_quoted_total, sale_discount_amount, sale_discount_pct, price_match_applied, price_match_competitor, price_match_competitor_price, price_match_our_price, warranty_number, warranty_reference_number, purchase_source, acquisition_source, seasonal_bonus_months, deposit_amount, balance_due_amount, payment_status, tyre_cover, wear_tear, europe_cover, transfer_cover, breakdown_recovery, vehicle_rental, mot_fee, mot_repair, lost_key, consequential, flat_number, building_name, building_number, street, town, county, postcode, country, first_name, last_name, phone';
      let custRow: any = null;
      if (normalizedReg) {
        // Plates are stored both with and without spaces, so match either.
        const spaced = normalizedReg.length > 4
          ? `${normalizedReg.slice(0, normalizedReg.length - 3)} ${normalizedReg.slice(-3)}`
          : normalizedReg;
        const { data } = await supabase
          .from('customers')
          .select(cols)
          .or(`registration_plate.eq.${normalizedReg},registration_plate.eq.${spaced}`)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        custRow = data;
      }
      if (!custRow && customerEmail) {
        const { data } = await supabase
          .from('customers')
          .select(cols)
          .ilike('email', customerEmail)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        custRow = data;
      }
      // Last resort: pull the cover details off the policy record.
      if (!custRow && customerEmail) {
        const { data: pol } = await supabase
          .from('customer_policies')
          .select('plan_type, payment_type, payment_amount, warranty_number, claim_limit, voluntary_excess')
          .ilike('email', customerEmail)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (pol) custRow = pol;
      }
      if (custRow) saleExtras = custRow as any;

    } catch (_) { /* ignore */ }
    const claimLimitDisplay = saleExtras.claim_limit ? formatClaimLimit(saleExtras.claim_limit) : 'Not set';
    const excessDisplay = saleExtras.voluntary_excess != null ? `£${Number(saleExtras.voluntary_excess).toFixed(2)}` : 'Not set';
    const labourRateDisplay = saleExtras.labour_rate ? `£${Number(saleExtras.labour_rate).toFixed(2)}/hr` : 'Not set';
    const durationDisplay = durationLabel(durationMonths, saleExtras.payment_type, plan);

    const money = (v: any) => (v == null || v === '' ? null : `£${Number(v).toFixed(2)}`);
    const orDash = (v: any) => (v == null || v === '' ? '—' : String(v));
    const mileageDisplay = saleExtras.mileage != null && saleExtras.mileage !== ''
      ? `${Number(String(saleExtras.mileage).replace(/[^0-9]/g, '') || 0).toLocaleString()} miles`
      : '—';
    const addressDisplay = [
      saleExtras.flat_number, saleExtras.building_name, saleExtras.building_number,
      saleExtras.street, saleExtras.town, saleExtras.county, saleExtras.postcode, saleExtras.country,
    ].filter(Boolean).join(', ') || '—';
    const addOns = ([
      ['Tyre cover', saleExtras.tyre_cover],
      ['Wear & tear', saleExtras.wear_tear],
      ['Europe cover', saleExtras.europe_cover],
      ['Transfer cover', saleExtras.transfer_cover],
      ['Breakdown recovery', saleExtras.breakdown_recovery],
      ['Vehicle rental', saleExtras.vehicle_rental],
      ['MOT fee', saleExtras.mot_fee],
      ['MOT repair', saleExtras.mot_repair],
      ['Lost key', saleExtras.lost_key],
      ['Consequential', saleExtras.consequential],
    ] as [string, any][]).filter(([, on]) => !!on).map(([l]) => l);
    const addOnsDisplay = addOns.length ? addOns.join(', ') : 'None';
    // Quotes & Orders reference price (frozen at point of sale) + discount given
    const quotedTotal = saleExtras.sale_quoted_total ?? saleExtras.original_amount ?? null;
    const soldTotal = saleValue != null ? Number(saleValue) : (saleExtras.final_amount ?? null);
    const discountAmt = saleExtras.sale_discount_amount ?? saleExtras.discount_amount ??
      (quotedTotal != null && soldTotal != null ? Number(quotedTotal) - Number(soldTotal) : null);
    const discountPct = saleExtras.sale_discount_pct != null
      ? Number(saleExtras.sale_discount_pct)
      : (quotedTotal ? Math.round((Number(discountAmt || 0) / Number(quotedTotal)) * 1000) / 10 : null);
    const isPriceMatch = !!saleExtras.price_match_applied;

    const row = (label: string, value: string, highlight = false) =>
      `<tr><td style="padding: 8px; background: ${highlight ? '#fde68a' : '#f3f4f6'};"><strong>${label}:</strong></td><td style="padding: 8px;${highlight ? ' font-weight: 700;' : ''}">${value}</td></tr>`;


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

    // Get the MOST RECENT lead submission for this email (the one tied to this purchase journey)
    let leadCreatedAt = '';
    try {
      const { data: latestLead } = await supabase
        .from('sales_leads')
        .select('created_at')
        .ilike('email', customerEmail)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (latestLead?.created_at) {
        leadCreatedAt = new Date(latestLead.created_at).toLocaleString('en-GB', { timeZone: 'Europe/London', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
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
      saleType = sourceLetterFromLeadSource(leadSource);
    } else {
      // Normalize provided saleSource (Web -> WEB, quote -> QUOTE)
      const s = String(saleSource).toLowerCase();
      if (s === 'quote' || s === 'live_quote') saleType = 'Q';
      else if (s === 'web' || s === 'website' || s === 'organic') saleType = sourceLetterFromLeadSource(leadSource);
      else saleType = sourceLetterFromLeadSource(saleSource);
    }

    // Build standard sale email
    const salesEmailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #16a34a; border-bottom: 2px solid #16a34a; padding-bottom: 10px;">🎉 New Sale</h2>
        ${isAgentSale ? `
        <div style="margin-top: 16px; padding: 14px 20px; background: #eff6ff; border: 2px solid #3b82f6; border-radius: 8px;">
          <div style="font-size: 13px; text-transform: uppercase; letter-spacing: 1px; color: #1e40af;">Agent sale</div>
          <div style="font-size: 20px; font-weight: 800; color: #1e3a8a;">${resolvedAgentName || 'Unknown Agent'}</div>
        </div>` : ''}
        ${isPriceMatch ? `
        <div style="margin-top: 16px; padding: 14px 20px; background: #fff7ed; border: 2px solid #f97316; border-radius: 8px;">
          <div style="font-size: 13px; text-transform: uppercase; letter-spacing: 1px; color: #c2410c;">Price match applied</div>
          <div style="font-size: 14px; color: #7c2d12;">
            ${saleExtras.price_match_competitor ? `Competitor: <strong>${saleExtras.price_match_competitor}</strong>` : 'Competitor: —'}
            ${saleExtras.price_match_competitor_price != null ? ` · Their price: <strong>${money(saleExtras.price_match_competitor_price)}</strong>` : ''}
            ${saleExtras.price_match_our_price != null ? ` · Our matched price: <strong>${money(saleExtras.price_match_our_price)}</strong>` : ''}
          </div>
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
          ${row('Name', name)}
          ${row('Email', customerEmail)}
          ${row('Phone', phone || orDash(saleExtras.phone))}
          ${row('Address', addressDisplay)}
        </table>
        <h3 style="color: #333; margin-top: 20px;">Sale Details</h3>
        <table style="width: 100%; border-collapse: collapse;">
          ${row('Warranty', warranty)}
          ${row('Warranty number', orDash(saleExtras.warranty_number || saleExtras.warranty_reference_number))}
          ${row('Plan', plan || orDash(saleExtras.plan_type))}
          ${row('Warranty Duration', durationDisplay, true)}
          ${saleExtras.seasonal_bonus_months ? row('Bonus months', `+${saleExtras.seasonal_bonus_months}`) : ''}
          ${row('Payment', payment)}
          ${row('Payment status', orDash(saleExtras.payment_status))}
          ${row('Sale Amount', saleValueDisplay, true)}
          ${row('Price match', isPriceMatch ? `Yes${saleExtras.price_match_competitor ? ` — ${saleExtras.price_match_competitor}` : ''}${saleExtras.price_match_competitor_price != null ? ` at ${money(saleExtras.price_match_competitor_price)}` : ''}` : 'No', isPriceMatch)}
          ${quotedTotal != null ? row('Quotes &amp; Orders price', money(quotedTotal) || '—') : ''}
          ${saleExtras.final_amount != null ? row('Final amount charged', money(saleExtras.final_amount) || '—') : ''}
          ${discountAmt ? row('Discount given', `${money(discountAmt)}${discountPct != null ? ` (${discountPct}%)` : ''}`, discountPct != null && discountPct > 30) : row('Discount given', 'None')}
          ${saleExtras.discount_code ? row('Discount code', String(saleExtras.discount_code)) : ''}
          ${saleExtras.deposit_amount ? row('Deposit taken', money(saleExtras.deposit_amount) || '—') : ''}
          ${saleExtras.balance_due_amount ? row('Balance outstanding', money(saleExtras.balance_due_amount) || '—', true) : ''}
          ${row('Claim Limit', claimLimitDisplay)}
          ${row('Voluntary Excess', excessDisplay)}
          ${row('Labour Rate', labourRateDisplay)}
          ${row('Add-ons', addOnsDisplay)}
          ${row('Purchase source', orDash(saleExtras.purchase_source || saleExtras.acquisition_source))}
        </table>
        <h3 style="color: #333; margin-top: 20px;">Vehicle Details</h3>
        <table style="width: 100%; border-collapse: collapse;">
          ${row('Registration', reg)}
          ${row('Make', vehicleMake || orDash(saleExtras.vehicle_make))}
          ${row('Model', vehicleModel || orDash(saleExtras.vehicle_model))}
          ${row('Year', orDash(saleExtras.vehicle_year))}
          ${row('Mileage', mileageDisplay, true)}
          ${row('Fuel type', orDash(saleExtras.vehicle_fuel_type))}
          ${row('Transmission', orDash(saleExtras.vehicle_transmission))}
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

    // Send main sale notification — unified subject format:
    // "New Sale <SOURCE>: <REG> - £<AMOUNT> via <PAYMENT>"
    // Quote-link sales keep the marketing channel visible: "Q/G" / "S-Q/F".
    const isQuoteSale = saleType === 'Q';
    const rawChannel = saleExtras.acquisition_source || saleExtras.purchase_source;
    const channelLetter = isQuoteSale
      ? (rawChannel ? sourceLetterFromLeadSource(rawChannel) : 'Q')
      : ((saleType as any) || 'O');
    const subjectSource = saleSubjectPrefix({
      letter: channelLetter,
      isAgentSale: !!isAgentSale,
      isQuote: isQuoteSale,
    });

    // Use the dedicated notify.buyawarranty.co.uk sender so mail to
    // @buyawarranty.co.uk mailboxes isn't dropped by same-domain anti-spoof.
    const agentSubjectPart = isAgentSale ? ` — Agent: ${resolvedAgentName || 'Unknown Agent'}` : '';
    const priceMatchSubjectPart = isPriceMatch ? ' [Price match]' : '';
    const subjectKind = saleSubjectKind({ letter: channelLetter, isAgentSale: !!isAgentSale, isQuote: isQuoteSale });
    const subject = `New ${subjectKind}: ${reg} - ${saleValueDisplay} via ${payment}${agentSubjectPart}${priceMatchSubjectPart}`;
    const notifyResult = await sendInternalNotification({
      to: ["info@buyawarranty.co.uk", "accounts@buyawarranty.co.uk"],
      subject,
      html: salesEmailHtml,
      template: "sale_notification",
      sourceFunction: "send-sale-notification",
      metadata: {
        registration_plate: reg,
        sale_type: subjectSource,
        customer_email: customerEmail,
        is_agent_sale: isAgentSale,
      },
    });

    console.log("Sale notification result:", { subject, notifyResult });

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
