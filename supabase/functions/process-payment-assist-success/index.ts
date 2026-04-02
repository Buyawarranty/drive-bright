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
      seasonal_bonus_months: protectionAddOns.seasonalBonusMonths || 0
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

    // TODO: Call Warranties 2000 registration (same as Bumper flow)
    // TODO: Send welcome email
    // TODO: Fire conversion tracking

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
