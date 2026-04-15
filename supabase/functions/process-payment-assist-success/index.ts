import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

console.log("[PROCESS-PAYMENT-ASSIST-SUCCESS] Function loaded");

const logStep = (step: string, details?: any) => {
  try {
    const timestamp = new Date().toISOString();
    const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
    console.log(`[PROCESS-PAYMENT-ASSIST-SUCCESS] ${timestamp} ${step}${detailsStr}`);
  } catch (e) {
    console.log(`[PROCESS-PAYMENT-ASSIST-SUCCESS] ${new Date().toISOString()} ${step}`);
  }
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const url = new URL(req.url);
    const transactionId = url.searchParams.get('tx');

    logStep("Received transaction ID", { transactionId });

    if (!transactionId) {
      logStep("No transaction ID provided");
      return new Response(null, {
        status: 302,
        headers: {
          ...corsHeaders,
          "Location": "https://buyawarranty.co.uk/payment-fallback?error=no_transaction"
        }
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Fetch the transaction
    const { data: transaction, error: fetchError } = await supabase
      .from('bumper_transactions')
      .select('*')
      .eq('transaction_id', transactionId)
      .single();

    if (fetchError || !transaction) {
      logStep("Transaction not found", { error: fetchError?.message, transactionId });
      return new Response(null, {
        status: 302,
        headers: {
          ...corsHeaders,
          "Location": "https://buyawarranty.co.uk/payment-fallback?error=transaction_not_found"
        }
      });
    }

    logStep("Transaction found", { 
      id: transaction.id, 
      status: transaction.status,
      email: transaction.customer_data?.email 
    });

    // Check if already processed
    if (transaction.status === 'completed') {
      logStep("Transaction already completed, redirecting to thank you");
      return new Response(null, {
        status: 302,
        headers: {
          ...corsHeaders,
          "Location": transaction.redirect_url || "https://buyawarranty.co.uk/thank-you"
        }
      });
    }

    // Update transaction status
    const { error: updateError } = await supabase
      .from('bumper_transactions')
      .update({ 
        status: 'completed',
        conversion_status: 'completed',
        conversion_fired_at: new Date().toISOString()
      })
      .eq('id', transaction.id);

    if (updateError) {
      logStep("Failed to update transaction status", { error: updateError.message });
    }

    // Create customer record
    const customerData = transaction.customer_data || {};
    const vehicleData = transaction.vehicle_data || {};
    const protectionAddOns = transaction.protection_addons || {};

    const customerInsertData = {
      name: `${customerData.first_name || ''} ${customerData.last_name || ''}`.trim() || customerData.email,
      first_name: customerData.first_name || null,
      last_name: customerData.last_name || null,
      email: customerData.email,
      phone: customerData.phone || customerData.mobile || null,
      registration_plate: vehicleData.regNumber || customerData.vehicle_reg || null,
      vehicle_make: vehicleData.make || customerData.vehicle_make || null,
      vehicle_model: vehicleData.model || customerData.vehicle_model || null,
      vehicle_year: vehicleData.year || customerData.vehicle_year || null,
      vehicle_fuel_type: vehicleData.fuelType || customerData.vehicle_fuel_type || null,
      vehicle_transmission: vehicleData.transmission || customerData.vehicle_transmission || null,
      mileage: vehicleData.mileage || customerData.vehicle_mileage || null,
      plan_type: transaction.plan_id,
      payment_type: transaction.payment_type || 'monthly',
      status: 'active',
      final_amount: transaction.final_amount,
      discount_code: transaction.discount_code || null,
      claim_limit: transaction.claim_limit || 1250,
      voluntary_excess: protectionAddOns.voluntaryExcess || 0,
      labour_rate: protectionAddOns.labourRate || 70,
      // Protection add-ons
      tyre_cover: protectionAddOns.tyre || false,
      wear_tear: protectionAddOns.wearAndTear || protectionAddOns.wearTear || false,
      europe_cover: protectionAddOns.european || false,
      breakdown_recovery: protectionAddOns.breakdown || false,
      vehicle_rental: protectionAddOns.rental || false,
      transfer_cover: protectionAddOns.transfer || false,
      mot_fee: protectionAddOns.motFee || false,
      mot_repair: protectionAddOns.motRepair || false,
      // Address fields
      flat_number: customerData.flat_number || null,
      building_name: customerData.building_name || null,
      building_number: customerData.building_number || null,
      street: customerData.address_line_1 || customerData.street || null,
      town: customerData.city || customerData.town || null,
      county: customerData.county || null,
      postcode: customerData.postcode || null,
      country: customerData.country || 'United Kingdom',
      // Seasonal bonus
      seasonal_bonus_months: protectionAddOns.seasonalBonusMonths || 0,
      // Customer date of birth for identity verification
      customer_dob: customerData.customer_dob || null
    };

    // CRITICAL: Check for duplicate by email + reg plate before inserting
    const regPlateForCheck = vehicleData?.registrationNumber || vehicleData?.registration_plate;
    const normalizedReg = regPlateForCheck ? regPlateForCheck.toUpperCase().replace(/\s/g, '') : '';
    const normalizedEmail = customerData.email.toLowerCase().trim();
    
    if (normalizedReg && normalizedEmail) {
      const { data: existingByEmailReg } = await supabase
        .from('customers')
        .select('id, email, registration_plate')
        .ilike('email', normalizedEmail)
        .or('is_deleted.is.null,is_deleted.eq.false')
        .in('status', ['Active', 'Pending']);
      
      const matchingRecord = existingByEmailReg?.find(r => {
        const existingReg = (r.registration_plate || '').toUpperCase().replace(/\s/g, '');
        return existingReg === normalizedReg;
      });
      
      if (matchingRecord) {
        logStep("DUPLICATE DETECTED by email + reg plate, skipping insert", { existingId: matchingRecord.id });
        return new Response(null, {
          status: 302,
          headers: { ...corsHeaders, "Location": `${Deno.env.get('SITE_URL') || 'https://drive-bright.lovable.app'}/thank-you?duplicate=true` },
        });
      }
    }

    // CRITICAL: Check if customer already exists by email before inserting
    // This prevents duplicate customer profiles for returning customers
    const existingEmail = customerData.email.toLowerCase().trim();
    const { data: existingCustomerByEmail } = await supabase
      .from('customers')
      .select('id, email, warranty_reference_number')
      .ilike('email', existingEmail)
      .or('is_deleted.is.null,is_deleted.eq.false')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    let customer: any = null;
    let customerError: any = null;

    if (existingCustomerByEmail) {
      // UPDATE existing customer instead of creating a duplicate
      logStep("Existing customer found - updating instead of creating new", { 
        existingId: existingCustomerByEmail.id 
      });
      
      const { data: updatedCustomer, error: updateError } = await supabase
        .from('customers')
        .update({
          ...customerInsertData,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingCustomerByEmail.id)
        .select()
        .single();
      
      customer = updatedCustomer;
      customerError = updateError;
      
      if (updateError) {
        logStep("Failed to update existing customer", { error: updateError.message });
      } else {
        logStep("Customer updated successfully (existing customer)", { customerId: customer?.id });
      }
    } else {
      // No existing customer - create new record
      logStep("No existing customer found - creating new record", { email: customerData.email });

      const { data: newCustomer, error: insertError } = await supabase
        .from('customers')
        .insert(customerInsertData)
        .select()
        .single();

      customer = newCustomer;
      customerError = insertError;

      if (insertError) {
        // Handle unique constraint violation (race condition / double-click)
        if (insertError.code === '23505') {
          logStep("Duplicate insert blocked by unique index, fetching existing record");
          const { data: existingDup } = await supabase
            .from('customers')
            .select('*')
            .ilike('email', customerData.email)
            .or('is_deleted.is.null,is_deleted.eq.false')
            .order('created_at', { ascending: false })
            .limit(1)
            .single();
          customer = existingDup;
        } else {
          logStep("Failed to create customer", { error: insertError.message });
        }
      } else {
        logStep("Customer created successfully (new customer)", { customerId: customer?.id });
      }
    }

    // Send sale notification email
    try {
      const resendApiKey = Deno.env.get("RESEND_API_KEY");
      if (resendApiKey) {
        const resend = new Resend(resendApiKey);
        const customerName = customer?.name || `${customerData.first_name || ''} ${customerData.last_name || ''}`.trim() || 'Unknown';
        const userEmail = customerData.email;
        const regPlate = vehicleData?.regNumber || vehicleData?.registration || customerData?.vehicle_reg || 'Unknown';
        const planName = transaction.plan_id || 'Unknown';
        const saleValue = transaction.final_amount ? `£${Number(transaction.final_amount).toFixed(2)}` : 'N/A';
        const paymentMethod = 'Payment Assist';

        // Detect ad source from tracking data
        const gclid = transaction.gclid || null;
        const cartMeta = transaction.customer_data?.cart_metadata || {};
        const fbclid = cartMeta?.fbclid || null;
        let saleType = 'Web';
        if (gclid) saleType = 'G';
        else if (fbclid) saleType = 'F';
        // Get timing info
        let leadCreatedAt = '';
        try {
          const { data: earliestLead } = await supabase
            .from('sales_leads')
            .select('created_at')
            .ilike('email', userEmail)
            .order('created_at', { ascending: true })
            .limit(1)
            .maybeSingle();
          if (earliestLead?.created_at) {
            leadCreatedAt = new Date(earliestLead.created_at).toLocaleString('en-GB', { timeZone: 'Europe/London', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
          }
        } catch (e) { /* ignore */ }
        const paymentTime = new Date().toLocaleString('en-GB', { timeZone: 'Europe/London', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

        const salesEmailHtml = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #16a34a; border-bottom: 2px solid #16a34a; padding-bottom: 10px;">🎉 New Sale - Payment Assist</h2>
            <div style="margin-top: 16px; padding: 16px 24px; background: #fef9c3; border: 2px solid #eab308; border-radius: 8px; text-align: center;">
              <div style="font-size: 28px; font-weight: 900; color: #000000; letter-spacing: 2px; font-family: 'Arial Black', Arial, sans-serif;">${regPlate}</div>
            </div>
            <div style="margin-top: 16px; padding: 20px; background: linear-gradient(135deg, #16a34a 0%, #15803d 100%); border-radius: 8px; color: white;">
              <div style="font-size: 14px; opacity: 0.9;">Sale Value</div>
              <div style="font-size: 32px; font-weight: bold; margin: 5px 0;">${saleValue}</div>
              <div style="font-size: 14px; opacity: 0.9;">Payment: <strong>${paymentMethod}</strong></div>
            </div>
            <h3 style="color: #333; margin-top: 20px;">Customer Details</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr><td style="padding: 8px; background: #f3f4f6;"><strong>Name:</strong></td><td style="padding: 8px;">${customerName}</td></tr>
              <tr><td style="padding: 8px; background: #f3f4f6;"><strong>Email:</strong></td><td style="padding: 8px;">${userEmail}</td></tr>
              <tr><td style="padding: 8px; background: #f3f4f6;"><strong>Phone:</strong></td><td style="padding: 8px;">${customerData.phone || customerData.mobile || 'N/A'}</td></tr>
            </table>
            <h3 style="color: #333; margin-top: 20px;">Sale Details</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr><td style="padding: 8px; background: #f3f4f6;"><strong>Plan:</strong></td><td style="padding: 8px;">${planName}</td></tr>
              <tr><td style="padding: 8px; background: #f3f4f6;"><strong>Payment Type:</strong></td><td style="padding: 8px;">${paymentMethod}</td></tr>
              <tr><td style="padding: 8px; background: #f3f4f6;"><strong>Amount:</strong></td><td style="padding: 8px;">${saleValue}</td></tr>
            </table>
            <h3 style="color: #333; margin-top: 20px;">Vehicle Details</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr><td style="padding: 8px; background: #f3f4f6;"><strong>Registration:</strong></td><td style="padding: 8px;">${regPlate}</td></tr>
              <tr><td style="padding: 8px; background: #f3f4f6;"><strong>Make:</strong></td><td style="padding: 8px;">${vehicleData?.make || 'Unknown'}</td></tr>
              <tr><td style="padding: 8px; background: #f3f4f6;"><strong>Model:</strong></td><td style="padding: 8px;">${vehicleData?.model || 'Unknown'}</td></tr>
            </table>
            <h3 style="color: #333; margin-top: 20px;">⏱️ Timing</h3>
            <table style="width: 100%; border-collapse: collapse;">
              ${leadCreatedAt ? `<tr><td style="padding: 8px; background: #f3f4f6;"><strong>Lead Submitted:</strong></td><td style="padding: 8px;">${leadCreatedAt}</td></tr>` : ''}
              <tr><td style="padding: 8px; background: #f3f4f6;"><strong>Payment Made:</strong></td><td style="padding: 8px;">${paymentTime}</td></tr>
            </table>
            <div style="margin-top: 30px; padding: 15px; background: #dcfce7; border-left: 4px solid #16a34a; border-radius: 5px;">
              <p style="margin: 0; color: #166534;"><strong>✓ Payment Assist sale completed</strong></p>
            </div>
          </div>
        `;

        await resend.emails.send({
          from: 'BuyaWarranty Team <notifications@buyawarranty.co.uk>',
          to: ['info@buyawarranty.co.uk', 'accounts@buyawarranty.co.uk'],
          subject: `New Sale ${saleType}: ${regPlate} - ${planName} - ${saleValue} via ${paymentMethod}`,
          html: salesEmailHtml,
        });
        logStep("Sale notification email sent successfully");

        // Check for agent-attributed sale (New Sale S)
        const defaultSupportId = 'e39499b8-f88c-4963-9f0d-63e1addb3025';
        const { data: matchedLead } = await supabase
          .from('sales_leads')
          .select('id, assigned_to, full_name, phone, vehicle_reg, lead_source')
          .ilike('email', userEmail)
          .not('assigned_to', 'is', null)
          .neq('assigned_to', defaultSupportId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (matchedLead && matchedLead.assigned_to) {
          const { data: agentData } = await supabase
            .from('admin_users')
            .select('first_name, last_name, email')
            .eq('id', matchedLead.assigned_to)
            .maybeSingle();

          const agentName = agentData
            ? [agentData.first_name, agentData.last_name].filter(Boolean).join(' ') || agentData.email
            : 'Unknown Agent';

          // Update customer to reflect agent assignment
          if (customer?.id) {
            await supabase.from('customers').update({ assigned_to: matchedLead.assigned_to }).eq('id', customer.id);
          }
          // Mark lead as converted
          await supabase.from('sales_leads').update({ status: 'converted', updated_at: new Date().toISOString() }).eq('id', matchedLead.id);

          const leadSource = matchedLead.lead_source || 'unknown';
          let sourcePrefix = 'S';
          if (leadSource === 'google_ad') sourcePrefix = 'S-G';
          else if (leadSource === 'social_ad') sourcePrefix = 'S-F';

          const agentSaleHtml = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #16a34a; border-bottom: 2px solid #16a34a; padding-bottom: 10px;">🎯 New Agent Sale - Lead Converted</h2>
              <div style="margin-top: 16px; padding: 12px 20px; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px;">
                <div style="font-size: 14px; color: #1e40af;"><strong>Converted by:</strong> ${agentName}</div>
              </div>
              <div style="margin-top: 16px; padding: 16px 24px; background: #fef9c3; border: 2px solid #eab308; border-radius: 8px; text-align: center;">
                <div style="font-size: 28px; font-weight: 900; color: #000000; letter-spacing: 2px;">${regPlate}</div>
              </div>
              <div style="margin-top: 16px; padding: 20px; background: linear-gradient(135deg, #16a34a 0%, #15803d 100%); border-radius: 8px; color: white;">
                <div style="font-size: 14px; opacity: 0.9;">Sale Value</div>
                <div style="font-size: 32px; font-weight: bold; margin: 5px 0;">${saleValue}</div>
                <div style="font-size: 14px; opacity: 0.9;">Payment: <strong>${paymentMethod}</strong></div>
              </div>
              <h3 style="color: #333; margin-top: 20px;">Customer Details</h3>
              <table style="width: 100%; border-collapse: collapse;">
                <tr><td style="padding: 8px; background: #f3f4f6;"><strong>Name:</strong></td><td style="padding: 8px;">${customerName}</td></tr>
                <tr><td style="padding: 8px; background: #f3f4f6;"><strong>Email:</strong></td><td style="padding: 8px;">${userEmail}</td></tr>
                <tr><td style="padding: 8px; background: #f3f4f6;"><strong>Phone:</strong></td><td style="padding: 8px;">${customerData.phone || customerData.mobile || 'N/A'}</td></tr>
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

          await resend.emails.send({
            from: 'BuyaWarranty Team <notifications@buyawarranty.co.uk>',
            to: ['info@buyawarranty.co.uk', 'accounts@buyawarranty.co.uk'],
            subject: `New Sale ${sourcePrefix}: ${regPlate} - ${planName} - ${saleValue} - Converted by ${agentName}`,
            html: agentSaleHtml,
          });
          logStep("Agent sale notification (New Sale S) sent", { agent: agentName });
        }
      } else {
        logStep("Warning: RESEND_API_KEY not configured, skipping sale notification");
      }
    } catch (emailError) {
      logStep("Warning: Failed to send sale notification", { error: emailError instanceof Error ? emailError.message : emailError });
    }

    logStep("Redirecting to thank you page");

    return new Response(null, {
      status: 302,
      headers: {
        ...corsHeaders,
        "Location": transaction.redirect_url || "https://buyawarranty.co.uk/thank-you"
      }
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logStep("Error processing payment success", { error: errorMessage });
    return new Response(null, {
      status: 302,
      headers: {
        ...corsHeaders,
        "Location": "https://buyawarranty.co.uk/payment-fallback?error=processing_failed"
      }
    });
  }
});
