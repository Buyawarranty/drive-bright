import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

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

    // Check for existing customer by email AND registration plate
    const incomingReg = (vehicleReg || '').toUpperCase().replace(/\s/g, '');
    const { data: existingCustomer } = await supabase
      .from('customers')
      .select('id, email, registration_plate')
      .ilike('email', customerEmail)
      .maybeSingle();

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
          status: 'active',
          payment_verified: true,
          is_manual_entry: true,
          assigned_to: assigneeId,
          payment_confirmed_by: assigneeId,
          warranty_reference_number: warrantyReference,
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
          status: 'active',
          payment_verified: true,
          is_manual_entry: true,
          assigned_to: assigneeId,
          payment_confirmed_by: assigneeId,
          warranty_reference_number: warrantyReference,
          signup_date: startDate.toISOString(),
          purchase_source: 'admin_external',
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

    // Send to Warranties 2000 if requested
    let w2kSent = false;
    if (sendToW2k) {
      try {
        // Pre-check to prevent duplicate W2000 submissions (defensive check)
        const { data: freshPolicy } = await supabase
          .from('customer_policies')
          .select('warranties_2000_status')
          .eq('id', policyId)
          .single();
        
        if (freshPolicy?.warranties_2000_status === 'sent') {
          logStep("DUPLICATE PREVENTED: Policy already sent to W2000", { policyId });
          w2kSent = true; // Already sent, treat as success
        } else {
          // Pass policyId to enable duplicate prevention in send-to-warranties-2000
          const { error: w2kError } = await supabase.functions.invoke('send-to-warranties-2000', {
            body: {
              policyId,
              customerId,
              customerName,
              customerFirstName,
              customerLastName,
              customerEmail,
              customerPhone,
              vehicleReg: vehicleReg?.toUpperCase(),
              vehicleMake,
              vehicleModel,
              vehicleYear,
              vehicleFuelType,
              vehicleTransmission,
              mileage,
              claimLimit: effectiveClaimLimit,
              labourRate,
              excessAmount,
              policyNumber,
              warrantyReference,
              startDate: startDate.toISOString(),
              endDate: endDate.toISOString(),
              address: !skipAddressDetails ? address : null,
            }
          });
          
          if (!w2kError) {
            w2kSent = true;
            // Note: send-to-warranties-2000 now updates status internally when policyId is passed
          }
        }
      } catch (w2kErr) {
        logStep("Warning: W2K submission failed", w2kErr);
      }
    }

    // Always send welcome email and create dashboard login for external payments
    // This ensures external payment customers get the same experience as website buyers
    // CRITICAL: Use send-welcome-email-manual which reads from DB for accurate data
    let emailSent = false;
    try {
      logStep("Sending welcome email with dashboard credentials via send-welcome-email-manual");
      const { error: emailError } = await supabase.functions.invoke('send-welcome-email-manual', {
        body: {
          policyId,
          customerId,
        }
      });
      
      if (!emailError) {
        emailSent = true;
        await supabase
          .from('customer_policies')
          .update({ email_sent_status: 'sent' })
          .eq('id', policyId);
        logStep("Welcome email sent successfully");
      } else {
        logStep("Warning: Welcome email failed", emailError);
      }
    } catch (emailErr) {
      logStep("Warning: Welcome email failed", emailErr);
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
      w2kSent,
      emailSent,
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
