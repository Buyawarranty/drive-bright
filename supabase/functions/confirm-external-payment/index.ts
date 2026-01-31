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

// Generate warranty reference
const generateWarrantyReference = async (supabase: any): Promise<string> => {
  const { data, error } = await supabase.rpc('get_next_warranty_serial');
  if (error) throw error;
  const datePart = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' }).replace('/', '');
  return `BAW-${datePart}-${String(data).padStart(6, '0')}`;
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

    // Generate references
    const warrantyReference = await generateWarrantyReference(supabase);
    const policyNumber = generatePolicyNumber();
    const startDate = warrantyStartDate ? new Date(warrantyStartDate) : new Date();
    const endDate = calculatePolicyEndDate(startDate, durationMonths, bonusMonths);

    logStep("Generated references", { warrantyReference, policyNumber, startDate, endDate });

    // Check for existing customer by email
    const { data: existingCustomer } = await supabase
      .from('customers')
      .select('id, email')
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

    // Create or update customer record
    if (existingCustomer) {
      logStep("Updating existing customer", { customerId: existingCustomer.id });
      
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
          assigned_to: assigneeId,                    // admin_users.id for FK
          payment_confirmed_by: assigneeId,           // Track who confirmed
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
          assigned_to: assigneeId,                    // admin_users.id for FK
          payment_confirmed_by: assigneeId,           // Track who confirmed
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

      if (createError) throw createError;
      customerId = newCustomer.id;
      customerCreated = true;
    }

    logStep("Customer record processed", { customerId, created: customerCreated });

    // Create policy record
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
    logStep("Policy record created", { policyId: policyData.id });

    // Create live_quotes record for tracking
    const { error: quoteError } = await supabase
      .from('live_quotes')
      .insert({
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
        payment_method: 'external',
        payment_source: paymentSource,
        status: 'paid_externally',
        paid_at: new Date().toISOString(),
        policy_number: policyNumber,
        payment_confirmed_by: assigneeId,
      });

    if (quoteError) {
      logStep("Warning: Failed to create live_quotes record", quoteError);
    }

    // Send to Warranties 2000 if requested
    let w2kSent = false;
    if (sendToW2k) {
      try {
        const { error: w2kError } = await supabase.functions.invoke('send-to-warranties-2000', {
          body: {
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
          await supabase
            .from('customer_policies')
            .update({ warranties_2000_status: 'sent' })
            .eq('id', policyData.id);
        }
      } catch (w2kErr) {
        logStep("Warning: W2K submission failed", w2kErr);
      }
    }

    // Send welcome email if requested
    let emailSent = false;
    if (sendWelcomeEmail) {
      try {
        const { error: emailError } = await supabase.functions.invoke('send-welcome-email', {
          body: {
            customerEmail,
            customerName,
            vehicleReg: vehicleReg?.toUpperCase(),
            policyNumber,
            warrantyReference,
          }
        });
        
        if (!emailError) {
          emailSent = true;
          await supabase
            .from('customer_policies')
            .update({ email_sent_status: 'sent' })
            .eq('id', policyData.id);
        }
      } catch (emailErr) {
        logStep("Warning: Welcome email failed", emailErr);
      }
    }

    // Create customer auth account
    try {
      await supabase.functions.invoke('create-customer-account', {
        body: {
          email: customerEmail,
          customerName,
          customerId,
        }
      });
      logStep("Customer account created/updated");
    } catch (accountErr) {
      logStep("Warning: Customer account creation failed", accountErr);
    }

    logStep("Confirm external payment completed successfully");

    return new Response(JSON.stringify({
      success: true,
      customerId,
      policyId: policyData.id,
      policyNumber,
      warrantyReference,
      customerCreated,
      policyCreated: true,
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
