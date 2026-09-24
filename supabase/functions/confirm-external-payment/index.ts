import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { requireAdmin } from "../_shared/admin-auth.ts";


const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CONFIRM-EXTERNAL-PAYMENT] ${step}${detailsStr}`);
};

// Generate warranty reference using the same BAW format as online payments
const generateWarrantyReference = async (supabase: any): Promise<string> => {
  const { data, error } = await supabase.rpc('generate_warranty_number');
  if (error) throw error;
  return data;
};

// Calculate policy end date
const calculatePolicyEndDate = (startDate: Date, durationMonths: number, bonusMonths: number = 0): Date => {
  const endDate = new Date(startDate);
  endDate.setMonth(endDate.getMonth() + durationMonths + bonusMonths);
  return endDate;
};

// Generate policy number
const generatePolicyNumber = (): string => {
  const now = new Date();
  const datePart = now.toISOString().slice(0, 10).replace(/-/g, '');
  const randomPart = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `POL-${datePart}-${randomPart}`;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const auth = await requireAdmin(req, { allowedRoles: ["admin", "super_admin", "sales_manager", "sales_lead", "sales"] });
  if (!auth.ok) return auth.response;

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );


  try {
    logStep("Function started");

    const body = await req.json();
    const {
      customerName,
      customerFirstName,
      customerLastName,
      customerEmail,
      customerPhone,
      vehicleReg,
      vehicleMake,
      vehicleModel,
      vehicleYear,
      vehicleFuelType,
      vehicleTransmission,
      mileage,
      paymentType,
      claimLimit,
      labourRate,
      excessAmount,
      boostAddon,
      finalAmount,
      paymentSource,
      assigneeId,         // admin_users.id for assigned_to FK
      warrantyStartDate,
      durationMonths,
      bonusMonths = 0,
      sendToW2k,
      sendWelcomeEmail,
      skipAddressDetails,
      address,
      liveQuoteId,
      gclid: submittedGclid,
    } = body;

    logStep("Request data", { 
      customerEmail, 
      vehicleReg, 
      paymentType, 
      assigneeId,
      durationMonths,
      finalAmount 
    });

    // CRITICAL: assigneeId is required for sales attribution
    if (!assigneeId) {
      throw new Error("Sales agent assignment is required before confirming payment");
    }

    // A confirmed sale can ONLY be credited to a sales agent. Back-office
    // logins (accounts@, support@, info@) and managers often confirm on an
    // agent's behalf — they must never take the sale.
    {
      const { data: assignee } = await supabase
        .from('admin_users')
        .select('id, role, email')
        .eq('id', assigneeId)
        .maybeSingle();
      const role = assignee?.role || null;
      if (role !== 'sales' && role !== 'sales_lead') {
        throw new Error(
          "This sale must be credited to a sales agent. Admin, accounts, support and manager logins cannot hold a sale — select the sales agent who converted it.",
        );
      }
    }

    // Check for existing customer by email AND registration plate
    const incomingReg = (vehicleReg || '').toUpperCase().replace(/\s/g, '');
    const { data: existingCustomer } = await supabase
      .from('customers')
      .select('id, email, registration_plate, gclid')
      .ilike('email', customerEmail)
      .maybeSingle();

    // CRM confirmations happen after the original website visit, often through
    // Bumper, Payment Assist or a card terminal. Recover the original Google
    // click id before saving the sale so the hourly offline upload can attribute it.
    let recoveredGclid = String(submittedGclid || existingCustomer?.gclid || '').trim() || null;
    if (!recoveredGclid) {
      const regCompact = (vehicleReg || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();

      if (customerEmail) {
        const { data: lead } = await supabase
          .from('sales_leads')
          .select('gclid')
          .ilike('email', customerEmail)
          .not('gclid', 'is', null)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        recoveredGclid = String(lead?.gclid || '').trim() || null;
      }

      if (!recoveredGclid && regCompact) {
        const { data: leads } = await supabase
          .from('sales_leads')
          .select('gclid, vehicle_reg')
          .not('gclid', 'is', null)
          .order('created_at', { ascending: false })
          .limit(100);
        const lead = (leads || []).find((row: any) =>
          String(row.vehicle_reg || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase() === regCompact
        );
        recoveredGclid = String(lead?.gclid || '').trim() || null;
      }

      if (!recoveredGclid && (customerEmail || regCompact)) {
        let cartQuery = supabase
          .from('abandoned_carts')
          .select('cart_metadata, email, vehicle_reg')
          .order('created_at', { ascending: false })
          .limit(30);
        if (customerEmail) cartQuery = cartQuery.ilike('email', customerEmail);
        const { data: carts } = await cartQuery;
        const matchingCart = (carts || []).find((row: any) => {
          const rowReg = String(row.vehicle_reg || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
          return !regCompact || !rowReg || rowReg === regCompact;
        });
        recoveredGclid = String(
          matchingCart?.cart_metadata?.gclid_any || matchingCart?.cart_metadata?.gclid || ''
        ).trim() || null;
      }
    }

    logStep('Google Ads attribution resolved', { hasGclid: !!recoveredGclid });

    let customerId: string;
    let customerCreated = false;

    // Calculate effective claim limit (with boost if applicable)
    const effectiveClaimLimit = boostAddon ? claimLimit + 1000 : claimLimit;

    // Determine payment type label
    const paymentTypeLabel = paymentType === '12months' ? 'yearly' 
      : paymentType === '24months' ? '2-Year'
      : paymentType === '36months' ? '3-Year'
      : paymentType;

    // CRITICAL: Determine if this is the same vehicle or a different one
    const existingReg = existingCustomer ? (existingCustomer.registration_plate || '').toUpperCase().replace(/\s/g, '') : '';
    const isSameVehicle = existingCustomer && incomingReg && existingReg && incomingReg === existingReg;
    const isDifferentVehicle = existingCustomer && incomingReg && existingReg && incomingReg !== existingReg;

    // Check for existing policy for same customer + same vehicle reg
    let existingPolicy: any = null;
    if (existingCustomer && !isDifferentVehicle) {
      const { data: policies } = await supabase
        .from('customer_policies')
        .select('id, warranty_number, policy_number')
        .eq('customer_id', existingCustomer.id)
        .not('is_deleted', 'eq', true)
        .order('created_at', { ascending: false })
        .limit(5);

      if (policies && policies.length > 0) {
        // Use the most recent policy for this customer
        existingPolicy = policies[0];
        logStep("Found existing policy for customer", { 
          policyId: existingPolicy.id, 
          existingWarrantyNumber: existingPolicy.warranty_number 
        });
      }
    }

    // Only generate new references if no existing policy found
    const warrantyReference = existingPolicy?.warranty_number || await generateWarrantyReference(supabase);
    const policyNumber = existingPolicy?.policy_number || generatePolicyNumber();
    const startDate = warrantyStartDate ? new Date(warrantyStartDate) : new Date();
    const endDate = calculatePolicyEndDate(startDate, durationMonths, bonusMonths);

    logStep("Using references", { 
      warrantyReference, 
      policyNumber, 
      startDate, 
      endDate, 
      reusedExisting: !!existingPolicy 
    });

    // Create or update customer record
    if (existingCustomer && !isDifferentVehicle) {
      logStep("Updating existing customer (same vehicle)", { customerId: existingCustomer.id, existingReg, incomingReg });
      
      const { error: updateError } = await supabase
        .from('customers')
        .update({
          name: customerName,
          first_name: customerFirstName,
          last_name: customerLastName,
          phone: customerPhone,
          registration_plate: vehicleReg?.toUpperCase(),
          vehicle_make: vehicleMake,
          vehicle_model: vehicleModel,
          vehicle_year: vehicleYear,
          vehicle_fuel_type: vehicleFuelType,
          vehicle_transmission: vehicleTransmission,
          mileage: mileage,
          plan_type: 'Platinum',
          payment_type: paymentTypeLabel,
          claim_limit: effectiveClaimLimit,
          labour_rate: labourRate,
          voluntary_excess: excessAmount,
          final_amount: finalAmount,
          status: 'Active',
          payment_verified: true,
          is_manual_entry: true,
          assigned_to: assigneeId,
          payment_confirmed_by: assigneeId,
          warranty_reference_number: warrantyReference,
          ...(recoveredGclid && {
            gclid: recoveredGclid,
            acquisition_source: 'google_ads',
            google_ads_conversion_uploaded_at: null,
            google_ads_conversion_status: null,
          }),
          // Auto-restore soft-deleted customers when a new active policy is created
          is_deleted: false,
          deleted_at: null,
          deleted_by: null,
          ...(address && !skipAddressDetails && {
            building_number: address.buildingNumber,
            street: address.street,
            town: address.town,
            county: address.county,
            postcode: address.postcode,
          }),
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingCustomer.id);

      if (updateError) throw updateError;
      customerId = existingCustomer.id;
    } else {
      logStep("Creating new customer record");
      
      const { data: newCustomer, error: createError } = await supabase
        .from('customers')
        .insert({
          name: customerName,
          first_name: customerFirstName,
          last_name: customerLastName,
          email: customerEmail,
          phone: customerPhone,
          registration_plate: vehicleReg?.toUpperCase(),
          vehicle_make: vehicleMake,
          vehicle_model: vehicleModel,
          vehicle_year: vehicleYear,
          vehicle_fuel_type: vehicleFuelType,
          vehicle_transmission: vehicleTransmission,
          mileage: mileage,
          plan_type: 'Platinum',
          payment_type: paymentTypeLabel,
          claim_limit: effectiveClaimLimit,
          labour_rate: labourRate,
          voluntary_excess: excessAmount,
          final_amount: finalAmount,
          status: 'Active',
          payment_verified: true,
          is_manual_entry: true,
          assigned_to: assigneeId,
          payment_confirmed_by: assigneeId,
          warranty_reference_number: warrantyReference,
          signup_date: startDate.toISOString(),
          purchase_source: recoveredGclid ? 'google_ads' : 'admin_external',
          acquisition_source: recoveredGclid ? 'google_ads' : 'website',
          gclid: recoveredGclid,
          ...(address && !skipAddressDetails && {
            building_number: address.buildingNumber,
            street: address.street,
            town: address.town,
            county: address.county,
            postcode: address.postcode,
          }),
        })
        .select('id')
        .single();

      if (createError) {
        // Handle unique constraint violation (race condition / double-click)
        if (createError.code === '23505') {
          logStep("Duplicate insert blocked by unique index, fetching existing record");
          const { data: existingDup } = await supabase
            .from('customers')
            .select('id')
            .ilike('email', customerEmail)
            .eq('registration_plate', vehicleReg?.toUpperCase())
            .or('is_deleted.is.null,is_deleted.eq.false')
            .limit(1)
            .single();
          if (existingDup) {
            customerId = existingDup.id;
          } else {
            throw createError;
          }
        } else {
          throw createError;
        }
      } else {
        customerId = newCustomer.id;
        customerCreated = true;
      }
    }

    logStep("Customer record processed", { customerId, created: customerCreated });

    // Create or update policy record
    let policyId: string;
    let policyCreated = false;

    if (existingPolicy) {
      // Update existing policy instead of creating a duplicate
      logStep("Updating existing policy", { policyId: existingPolicy.id });
      
      const { error: policyUpdateError } = await supabase
        .from('customer_policies')
        .update({
          customer_id: customerId,
          email: customerEmail,
          customer_full_name: customerName,
          plan_type: 'Platinum',
          payment_type: paymentTypeLabel,
          policy_start_date: startDate.toISOString(),
          policy_end_date: endDate.toISOString(),
          claim_limit: effectiveClaimLimit,
          voluntary_excess: excessAmount,
          payment_amount: finalAmount,
          payment_verified: true,
          seasonal_bonus_months: bonusMonths,
          status: 'active',
          ...(address && !skipAddressDetails && {
            address: {
              building_number: address.buildingNumber,
              street: address.street,
              town: address.town,
              county: address.county,
              postcode: address.postcode,
            }
          }),
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingPolicy.id);

      if (policyUpdateError) throw policyUpdateError;
      policyId = existingPolicy.id;
      logStep("Existing policy updated", { policyId });
    } else {
      // Create new policy
      const { data: policyData, error: policyError } = await supabase
        .from('customer_policies')
        .insert({
          customer_id: customerId,
          email: customerEmail,
          customer_full_name: customerName,
          plan_type: 'Platinum',
          payment_type: paymentTypeLabel,
          policy_number: policyNumber,
          warranty_number: warrantyReference,
          policy_start_date: startDate.toISOString(),
          policy_end_date: endDate.toISOString(),
          claim_limit: effectiveClaimLimit,
          voluntary_excess: excessAmount,
          payment_amount: finalAmount,
          payment_verified: true,
          is_manual_entry: true,
          seasonal_bonus_months: bonusMonths,
          status: 'active',
          ...(address && !skipAddressDetails && {
            address: {
              building_number: address.buildingNumber,
              street: address.street,
              town: address.town,
              county: address.county,
              postcode: address.postcode,
            }
          }),
        })
        .select('id')
        .single();

      if (policyError) throw policyError;
      policyId = policyData.id;
      policyCreated = true;
      logStep("New policy created", { policyId });
    }

    const liveQuotePayload = {
      customer_name: customerName,
      customer_email: customerEmail,
      customer_phone: customerPhone,
      vehicle_reg: vehicleReg?.toUpperCase(),
      vehicle_make: vehicleMake,
      vehicle_model: vehicleModel,
      vehicle_year: vehicleYear,
      vehicle_mileage: mileage,
      claim_limit: effectiveClaimLimit,
      labour_rate: labourRate,
      excess_amount: excessAmount,
      boost_addon: boostAddon,
      upfront_price: finalAmount,
      monthly_price: Math.round(finalAmount / durationMonths * 100) / 100,
      duration_months: durationMonths,
      bonus_months: bonusMonths,
      payment_method: liveQuoteId ? paymentSource : 'external',
      payment_source: paymentSource,
      status: 'paid_externally',
      paid_at: new Date().toISOString(),
      payment_confirmed_at: new Date().toISOString(),
      policy_number: policyNumber,
      payment_confirmed_by: assigneeId,
      additional_notes: body.additionalNotes || null,
    };

    if (liveQuoteId) {
      const { error: quoteUpdateError } = await supabase
        .from('live_quotes')
        .update(liveQuotePayload)
        .eq('id', liveQuoteId);

      if (quoteUpdateError) {
        logStep("Warning: Failed to update existing live quote", quoteUpdateError);
      } else {
        logStep("Existing live quote finalized after manual confirmation", { liveQuoteId });
      }
    } else {
      const { error: quoteError } = await supabase
        .from('live_quotes')
        .insert(liveQuotePayload);

      if (quoteError) {
        logStep("Warning: Failed to create live_quotes record", quoteError);
      }
    }

    // Warranties Register integration permanently removed.


    // Always send welcome email and create dashboard login for external payments
    // This ensures external payment customers get the same experience as website buyers
    // CRITICAL: Use send-welcome-email-manual which reads from DB for accurate data
    let emailSent = false;
    let loginVerified = false;
    let emailError: string | null = null;

    if (!customerEmail || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(customerEmail))) {
      emailError = 'No valid customer email on the order, so no welcome email or login could be sent';
      logStep("Skipping welcome email — invalid customer email", { customerEmail });
    } else {
      // One retry: a transient failure must not leave the customer without logins
      for (let attempt = 1; attempt <= 2 && !emailSent; attempt++) {
        try {
          logStep("Sending welcome email with dashboard credentials", { attempt });
          const { data: emailData, error: invokeError } = await supabase.functions.invoke(
            'send-welcome-email-manual',
            { body: { policyId, customerId } }
          );

          if (!invokeError && emailData?.ok !== false) {
            emailSent = true;
            loginVerified = !!emailData?.loginVerified;
            emailError = null;
            await supabase
              .from('customer_policies')
              .update({ email_sent_status: 'sent' })
              .eq('id', policyId);
            logStep("Welcome email sent successfully", { loginVerified });
          } else {
            emailError = invokeError?.message || emailData?.error || 'Welcome email failed';
            logStep("Warning: Welcome email failed", { attempt, emailError });
          }
        } catch (emailErr: any) {
          emailError = emailErr?.message || String(emailErr);
          logStep("Warning: Welcome email threw", { attempt, emailError });
        }

        if (!emailSent && attempt === 1) {
          await new Promise((r) => setTimeout(r, 1500));
        }
      }

      if (!emailSent) {
        await supabase
          .from('customer_policies')
          .update({ email_sent_status: 'failed' })
          .eq('id', policyId);
      }
    }


    // Now that the payment is verified, send the full agent sale notification to
    // managers (amount, warranty number, cover details all populated). Earlier the
    // only email managers got was the "awaiting payment" heads-up.
    try {
      const regCompact = (vehicleReg || '').replace(/\s/g, '').toUpperCase();
      let matchedLead: { id: string; assigned_to: string | null } | null = null;

      if (customerEmail) {
        const { data } = await supabase
          .from('sales_leads')
          .select('id, assigned_to')
          .ilike('email', customerEmail)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        matchedLead = data as any;
      }
      if (!matchedLead && regCompact) {
        const { data } = await supabase
          .from('sales_leads')
          .select('id, assigned_to')
          .ilike('vehicle_reg', `%${regCompact}%`)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        matchedLead = data as any;
      }

      // Managers get the full sale email on EVERY confirmed payment, with or
      // without a matching lead — subject reads "Confirmed payment".
      await supabase.functions.invoke('send-agent-sale-notification', {
        body: {
          leadId: matchedLead?.id ?? null,
          agentId: assigneeId || matchedLead?.assigned_to || null,
          paymentConfirmed: true,
          customerId,
          paymentSource,
          address: skipAddressDetails ? null : address,
          customerOverride: {
            firstName: customerFirstName,
            lastName: customerLastName,
            email: customerEmail,
            phone: customerPhone,
            vehicleReg,
            vehicleMake,
            vehicleModel,
            vehicleYear,
            mileage,
            planType: 'Platinum',
            paymentType,
            claimLimit,
            voluntaryExcess: excessAmount,
            labourRate,
            durationMonths,
            finalAmount,
            warrantyNumber: policyNumber,
            leadSource: matchedLead ? undefined : 'phone',
          },
        },
      });
      logStep('Confirmed-payment sale notification sent', { leadId: matchedLead?.id ?? null });
    } catch (notifyErr) {
      logStep('Warning: agent sale notification failed', notifyErr);
    }

    logStep("Confirm external payment completed successfully");


    return new Response(JSON.stringify({
      success: true,
      customerId,
      policyId,
      policyNumber,
      warrantyReference,
      customerCreated,
      policyCreated,
      policyUpdated: !!existingPolicy,
      
      emailSent,
      loginVerified,
      emailError,

    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error: any) {
    logStep("Error", { message: error.message, stack: error.stack });
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
