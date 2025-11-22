
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

// Import addons utility functions
const getAutoIncludedAddOns = (paymentType: string, planType?: string): string[] => {
  const normalizedType = paymentType?.toLowerCase().replace(/[^a-z0-9]/g, '');
  
  const mapping: { [key: string]: string } = {
    '12months': '12months',
    'monthly': '12months',
    '1year': '12months',
    'yearly': '12months',
    '24months': '24months',
    '2year': '24months',
    'twoyearly': '24months',
    '36months': '36months',
    '3year': '36months',
    'threeyearly': '36months'
  };
  
  const normalized = mapping[normalizedType] || '12months';
  
  // For EV plans, always include MOT fee regardless of payment type
  const isEVPlan = planType?.toLowerCase().includes('ev') || planType?.toLowerCase().includes('electric');
  let autoIncluded: string[] = [];
  
  switch (normalized) {
    case '24months':
      autoIncluded = ['breakdown', 'motFee']; // 2-Year: Vehicle recovery, MOT test fee
      break;
    case '36months':
      autoIncluded = ['breakdown', 'motFee', 'rental', 'tyre']; // 3-Year: All above + Rental, Tyre
      break;
    default:
      autoIncluded = []; // 12-month plans have no auto-included add-ons by default
  }
  
  // For EV plans, always include MOT fee
  if (isEVPlan && !autoIncluded.includes('motFee')) {
    autoIncluded.push('motFee');
  }
  
  return autoIncluded;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[HANDLE-PAYMENT] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    logStep("Function started");

    const { planId, paymentType, userEmail, userId, stripeSessionId, vehicleData, customerData, skipEmail, metadata, protectionAddOns, claimLimit, voluntaryExcess, seasonalBonusMonths = 0 } = await req.json();
    logStep("Request data", { planId, paymentType, userEmail, userId, stripeSessionId, skipEmail, hasMetadata: !!metadata, hasProtectionAddOns: !!protectionAddOns, claimLimit, voluntaryExcess, seasonalBonusMonths });

    if (!planId || !paymentType || !userEmail) {
      throw new Error("Missing required parameters");
    }

    // CRITICAL: Check for duplicate payment to prevent double-charging and duplicate records
    // Check if this exact payment has already been processed
    const paymentIdentifier = metadata?.bumper_order_id || stripeSessionId;
    
    if (paymentIdentifier) {
      logStep("Checking for duplicate payment", { paymentIdentifier, type: metadata?.bumper_order_id ? 'bumper' : 'stripe' });
      
      // Check if customer already exists with this payment identifier
      const duplicateCheck = metadata?.bumper_order_id 
        ? { bumper_order_id: metadata.bumper_order_id }
        : { stripe_session_id: stripeSessionId };
      
      const { data: existingCustomer, error: checkError } = await supabaseClient
        .from('customers')
        .select('id, email, warranty_number, created_at')
        .match(duplicateCheck)
        .maybeSingle();
      
      if (existingCustomer) {
        logStep("DUPLICATE DETECTED: Payment already processed", {
          existingCustomerId: existingCustomer.id,
          existingEmail: existingCustomer.email,
          warrantyNumber: existingCustomer.warranty_number,
          originalProcessedAt: existingCustomer.created_at,
          attemptedDuplicateFrom: metadata?.source || 'unknown'
        });
        
        // Get the policy data for this customer
        const { data: existingPolicy } = await supabaseClient
          .from('customer_policies')
          .select('id, warranty_number')
          .eq('customer_id', existingCustomer.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        
        // Return existing data instead of creating duplicates
        return new Response(JSON.stringify({
          success: true,
          message: "Payment already processed - duplicate prevented",
          customerId: existingCustomer.id,
          policyNumber: existingPolicy?.warranty_number || existingCustomer.warranty_number,
          policyId: existingPolicy?.id,
          isDuplicate: true
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }
      
      logStep("No duplicate found, proceeding with payment processing");
    }

    // Validate vehicle age (must be 15 years or newer)
    const vehicleYear = vehicleData?.year || metadata?.vehicle_year;
    if (vehicleYear) {
      const currentYear = new Date().getFullYear();
      const yearInt = parseInt(vehicleYear);
      const vehicleAge = currentYear - yearInt;
      
      if (vehicleAge > 15) {
        logStep("Vehicle age validation failed", { vehicleYear, vehicleAge });
        throw new Error(`We cannot offer warranties for vehicles over 15 years old. This vehicle is ${vehicleAge} years old.`);
      }
      logStep("Vehicle age validation passed", { vehicleYear, vehicleAge });
    }

    // Generate BAW warranty reference number for Warranties 2000
    const warrantyReference = await generateWarrantyReference();
    logStep("Generated warranty reference", { warrantyReference });

    // Create or update customer record in database
    const customerName = `${customerData?.first_name || ''} ${customerData?.last_name || ''}`.trim() || 
                        customerData?.fullName || vehicleData?.fullName || 'Unknown Customer';
    
    // Fetch plan name from database instead of using UUID
    let planName = planId; // fallback to planId if fetch fails
    
    try {
      console.log(`[HANDLE-PAYMENT] Fetching plan name for planId: ${planId}`);
      
      // First try special_vehicle_plans
      let { data: planData, error: planError } = await supabaseClient
        .from('special_vehicle_plans')
        .select('name')
        .eq('id', planId)
        .single();
      
      if (planError || !planData) {
        console.log(`[HANDLE-PAYMENT] Plan not found in special_vehicle_plans, trying plans table`);
        // Try regular plans table
        const { data: regularPlanData, error: regularPlanError } = await supabaseClient
          .from('plans')
          .select('name')
          .eq('id', planId)
          .single();
          
        if (regularPlanError || !regularPlanData) {
          console.log(`[HANDLE-PAYMENT] Plan not found in either table, using planId as fallback: ${planId}`);
        } else {
          planName = regularPlanData.name;
          console.log(`[HANDLE-PAYMENT] Found plan name in plans table: ${planName}`);
        }
      } else {
        planName = planData.name;
        console.log(`[HANDLE-PAYMENT] Found plan name in special_vehicle_plans: ${planName}`);
      }
    } catch (error) {
      console.log(`[HANDLE-PAYMENT] Error fetching plan name, using planId: ${error}`);
    }
    
    // Process addons early to ensure consistent data throughout
    let userSelectedAddOns: any = {};
    
    if (protectionAddOns && typeof protectionAddOns === 'object') {
      // Check if it's the new database format (from Bumper flow)
      if ('vehicle_rental' in protectionAddOns || 'mot_fee' in protectionAddOns || 'breakdown_recovery' in protectionAddOns) {
        // New format - use directly
        userSelectedAddOns = {
          tyre_cover: protectionAddOns.tyre_cover || false,
          wear_tear: protectionAddOns.wear_tear || false,
          europe_cover: protectionAddOns.europe_cover || false,
          transfer_cover: protectionAddOns.transfer_cover || false,
          breakdown_recovery: protectionAddOns.breakdown_recovery || false,
          vehicle_rental: protectionAddOns.vehicle_rental || false,
          mot_fee: protectionAddOns.mot_fee || false,
          mot_repair: protectionAddOns.mot_repair || false,
          lost_key: protectionAddOns.lost_key || false,
          consequential: protectionAddOns.consequential || false
        };
      } else {
        // Old format - map from legacy keys
        userSelectedAddOns = {
          tyre_cover: protectionAddOns.tyre || false,
          wear_tear: protectionAddOns.wearAndTear || protectionAddOns.wearTear || false,
          europe_cover: protectionAddOns.european || false, 
          transfer_cover: protectionAddOns.transfer || false,
          breakdown_recovery: protectionAddOns.breakdown || false,
          vehicle_rental: protectionAddOns.rental || false,
          mot_fee: protectionAddOns.motFee || false,
          mot_repair: protectionAddOns.motRepair || false,
          lost_key: protectionAddOns.lostKey || false,
          consequential: protectionAddOns.consequential || false
        };
      }
    } else {
      userSelectedAddOns = {
        tyre_cover: metadata?.addon_tyre_cover === 'true',
        wear_tear: metadata?.addon_wear_tear === 'true',
        europe_cover: metadata?.addon_europe_cover === 'true', 
        transfer_cover: metadata?.addon_transfer_cover === 'true',
        breakdown_recovery: metadata?.addon_breakdown_recovery === 'true',
        vehicle_rental: metadata?.addon_vehicle_rental === 'true',
        mot_fee: metadata?.addon_mot_fee === 'true',
        mot_repair: metadata?.addon_mot_repair === 'true',
        lost_key: metadata?.addon_lost_key === 'true',
        consequential: metadata?.addon_consequential === 'true'
      };
    }
    
    // Get auto-included add-ons for the payment type
    const autoIncludedAddOns = getAutoIncludedAddOnsForPayment(paymentType);
    const autoIncludedMap = {
      tyre_cover: autoIncludedAddOns.includes('tyre'),
      breakdown_recovery: autoIncludedAddOns.includes('breakdown'), 
      vehicle_rental: autoIncludedAddOns.includes('rental'),
      mot_fee: autoIncludedAddOns.includes('motFee')
    };
    
    // Use USER SELECTIONS as priority - only auto-include if user didn't make an explicit choice
    // This ensures user's actual choices are respected, not overridden by defaults
    const finalAddOnsForCustomer = {
      // For each add-on, use user selection if available, otherwise check auto-included
      tyre_cover: userSelectedAddOns.tyre_cover || autoIncludedMap.tyre_cover,
      wear_tear: userSelectedAddOns.wear_tear,
      europe_cover: userSelectedAddOns.europe_cover,
      transfer_cover: userSelectedAddOns.transfer_cover,
      breakdown_recovery: userSelectedAddOns.breakdown_recovery || autoIncludedMap.breakdown_recovery,
      vehicle_rental: userSelectedAddOns.vehicle_rental || autoIncludedMap.vehicle_rental,
      mot_fee: userSelectedAddOns.mot_fee || autoIncludedMap.mot_fee,
      mot_repair: userSelectedAddOns.mot_repair,
      lost_key: userSelectedAddOns.lost_key,
      consequential: userSelectedAddOns.consequential
    };

    logStep("Early addon processing", { 
      userSelected: userSelectedAddOns,
      finalCombined: finalAddOnsForCustomer
    });
    
    const customerRecord = {
      name: customerName,
      email: userEmail,
      phone: customerData?.mobile || customerData?.phone || vehicleData?.phone || '',
      first_name: customerData?.first_name || extractFirstName(customerName),
      last_name: customerData?.last_name || extractSurname(customerName),
      flat_number: customerData?.flat_number || '',
      building_name: customerData?.building_name || '',
      building_number: customerData?.building_number || '',
      street: customerData?.street || customerData?.address_line_1 || extractStreet(customerData?.address || vehicleData?.address || ''),
      town: customerData?.town || customerData?.city || extractTown(customerData?.address || vehicleData?.address || ''),
      county: customerData?.county || '',
      postcode: customerData?.postcode || extractPostcode(customerData?.address || vehicleData?.address || ''),
      country: customerData?.country || 'United Kingdom',
      plan_type: planName, // Use the actual plan name, not UUID
      payment_type: paymentType,
      stripe_session_id: stripeSessionId,
      bumper_order_id: metadata?.bumper_order_id, // Store Bumper order ID if present
      registration_plate: vehicleData?.regNumber || customerData?.vehicle_reg || metadata?.vehicle_reg || 'Unknown',
      vehicle_make: vehicleData?.make || metadata?.vehicle_make || 'Unknown',
      vehicle_model: vehicleData?.model || metadata?.vehicle_model || 'Unknown',
      vehicle_year: vehicleData?.year || metadata?.vehicle_year || '',
      vehicle_fuel_type: vehicleData?.fuelType || metadata?.vehicle_fuel_type || '',
      vehicle_transmission: vehicleData?.transmission || metadata?.vehicle_transmission || '',
      mileage: vehicleData?.mileage || metadata?.vehicle_mileage || '',
      status: 'Active',
      discount_code: customerData?.discount_code || null,
      discount_amount: customerData?.discount_amount || 0,
      original_amount: customerData?.original_amount || null,
      final_amount: customerData?.final_amount || null,
      voluntary_excess: getStandardizedVoluntaryExcess(metadata, customerData, vehicleData, voluntaryExcess),
      claim_limit: parseInt(metadata?.claim_limit || customerData?.claimLimit || claimLimit || protectionAddOns?.claimLimit || '1250'), // User-selected claim limit
      warranty_reference_number: warrantyReference,
      seasonal_bonus_months: seasonalBonusMonths, // Store seasonal bonus
      // Store final combined add-ons in customer record (user selections + auto-inclusions)
      ...finalAddOnsForCustomer
    };

    // Debug addon metadata parsing
    logStep("Addon metadata debug", {
      rawMetadata: metadata,
      addonFields: {
        addon_tyre_cover: metadata?.addon_tyre_cover,
        addon_wear_tear: metadata?.addon_wear_tear,
        addon_europe_cover: metadata?.addon_europe_cover,
        addon_transfer_cover: metadata?.addon_transfer_cover,
        addon_breakdown_recovery: metadata?.addon_breakdown_recovery,
        addon_vehicle_rental: metadata?.addon_vehicle_rental,
        addon_mot_fee: metadata?.addon_mot_fee,
        addon_mot_repair: metadata?.addon_mot_repair,
        addon_lost_key: metadata?.addon_lost_key,
        addon_consequential: metadata?.addon_consequential
      },
      parsedValues: {
        tyre_cover: metadata?.addon_tyre_cover === 'true',
        wear_tear: metadata?.addon_wear_tear === 'true',
        europe_cover: metadata?.addon_europe_cover === 'true',
        transfer_cover: metadata?.addon_transfer_cover === 'true',
        breakdown_recovery: metadata?.addon_breakdown_recovery === 'true',
        vehicle_rental: metadata?.addon_vehicle_rental === 'true',
        mot_fee: metadata?.addon_mot_fee === 'true',
        mot_repair: metadata?.addon_mot_repair === 'true',
        lost_key: metadata?.addon_lost_key === 'true',
        consequential: metadata?.addon_consequential === 'true'
      }
    });

    logStep("Creating customer record", customerRecord);

    const { data: customerData2, error: customerError } = await supabaseClient
      .from('customers')
      .insert(customerRecord)
      .select()
      .single();

    if (customerError) {
      logStep("Warning: Customer record creation failed", customerError);
    } else {
      logStep("Customer record created successfully", { customerId: customerData2.id });
      
      // Track referral conversion if discount code was used
      if (customerData?.discount_code) {
        try {
          logStep("Checking if discount code is a referral code", { code: customerData.discount_code });
          
          // Check if this discount code is a referral code
          const { data: discountCodeData, error: dcError } = await supabaseClient
            .from('discount_codes')
            .select('id, is_referral_code, code, used_count')
            .eq('code', customerData.discount_code.toUpperCase())
            .single();
          
          if (!dcError && discountCodeData?.is_referral_code) {
            logStep("Discount code is a referral code, marking referral as converted", {
              discountCodeId: discountCodeData.id
            });
            
            // Mark the referral as converted
            const { error: referralUpdateError } = await supabaseClient
              .from('referrals')
              .update({
                status: 'converted',
                converted_at: new Date().toISOString()
              })
              .eq('discount_code_id', discountCodeData.id)
              .eq('friend_email', userEmail);
            
            if (referralUpdateError) {
              logStep("Warning: Failed to mark referral as converted", referralUpdateError);
            } else {
              logStep("Successfully marked referral as converted");
            }
            
            // Record discount code usage
            const { error: usageError } = await supabaseClient
              .from('discount_code_usage')
              .insert({
                discount_code_id: discountCodeData.id,
                customer_email: userEmail,
                discount_amount: customerData.discount_amount || 0,
                order_amount: customerData.final_amount || 0,
                stripe_session_id: stripeSessionId
              });
            
            if (usageError) {
              logStep("Warning: Failed to record discount code usage", usageError);
            } else {
              // Increment used_count for the discount code
              const { error: countError } = await supabaseClient
                .from('discount_codes')
                .update({ used_count: (discountCodeData.used_count || 0) + 1 })
                .eq('id', discountCodeData.id);
              
              if (countError) {
                logStep("Warning: Failed to increment discount code usage count", countError);
              } else {
                logStep("Successfully recorded discount code usage and incremented count");
              }
            }
          }
        } catch (referralError) {
          logStep("Error tracking referral conversion", referralError);
        }
      }
      
      // Mark any abandoned carts for this email as converted
      try {
        const { error: cartUpdateError } = await supabaseClient
          .from('abandoned_carts')
          .update({ 
            is_converted: true,
            converted_at: new Date().toISOString()
          })
          .eq('email', userEmail)
          .eq('is_converted', false);
        
        if (cartUpdateError) {
          logStep("Warning: Failed to mark abandoned carts as converted", cartUpdateError);
        } else {
          logStep("Successfully marked abandoned carts as converted for email", { userEmail });
        }
      } catch (cartError) {
        logStep("Error updating abandoned cart status", cartError);
      }
      
      // Use the same final addon data that was calculated earlier
      const finalAddOnsData = finalAddOnsForCustomer;
      
      logStep("Using previously calculated addon data for policy record", { 
        finalAddOns: finalAddOnsData
      });

      // Create policy record
      const policyRecord = {
        customer_id: customerData2.id,
        user_id: userId,
        email: userEmail,
        plan_type: planName.toLowerCase(), // Use the actual plan name in lowercase for customer_policies table
        payment_type: paymentType,
        policy_number: warrantyReference,
        policy_start_date: new Date().toISOString(),
        policy_end_date: calculatePolicyEndDate(paymentType),
        status: 'active',
        claim_limit: parseInt(metadata?.claim_limit || customerData?.claimLimit || claimLimit || protectionAddOns?.claimLimit || '1250'), // User-selected claim limit
        voluntary_excess: getStandardizedVoluntaryExcess(metadata, customerData, vehicleData, voluntaryExcess), // Fixed field name
        seasonal_bonus_months: seasonalBonusMonths, // Store seasonal bonus
        bumper_order_id: metadata?.bumper_order_id, // Store Bumper order ID if present
        stripe_session_id: stripeSessionId,
        // Include final combined add-ons in policy record
        ...finalAddOnsData
      };

      const { error: policyError } = await supabaseClient
        .from('customer_policies')
        .insert(policyRecord);

      // Update customer record with final addon values is no longer needed since they're set correctly from the start
    }

  // Send welcome email using the manual system (unless skipEmail is true)
  let policy = null;
  if (customerData2?.id && !skipEmail) {
    const { data: policyData } = await supabaseClient
      .from('customer_policies')
      .select('id')
      .eq('customer_id', customerData2.id)
      .single();
    policy = policyData;
        
      if (policy?.id) {
        logStep("Attempting to send welcome email", { 
          customerId: customerData2.id, 
          policyId: policy.id,
          customerEmail: userEmail,
          planType: planId
        });
        
        // Send welcome email using proper Supabase function invocation
        try {
          console.log(`[AUTOMATED-EMAIL-DEBUG] Sending welcome email for policy:`, {
            customerId: customerData2.id,
            policyId: policy.id,
            userEmail,
            planId
          });

          // Send welcome email with documents using send-welcome-email-manual which handles PDF attachments
          const emailPayload = {
            policyId: policy.id,
            customerId: customerData2.id,
            forceResend: false
          };

          // Use send-welcome-email-manual which properly handles PDF attachments
          const { data: emailResult, error: emailError } = await supabaseClient.functions.invoke('send-welcome-email-manual', {
            body: emailPayload
          });
          
          console.log(`[AUTOMATED-EMAIL-DEBUG] Function invoke response:`, {
            data: emailResult,
            error: emailError
          });

          if (emailError) {
            logStep("ERROR: Welcome email failed via function invoke", emailError);
            
            // Update policy status to reflect email failure
            await supabaseClient
              .from('customer_policies')
              .update({ email_sent_status: 'failed' })
              .eq('id', policy.id);
          } else {
            logStep("SUCCESS: Welcome email sent successfully via function invoke", emailResult);
            
            // Update policy status to reflect email success
            await supabaseClient
              .from('customer_policies')
              .update({ 
                email_sent_status: 'sent',
                email_sent_at: new Date().toISOString()
              })
              .eq('id', policy.id);
          }

        } catch (emailError) {
          logStep("Function invoke error", {
            error: emailError,
            message: emailError instanceof Error ? emailError.message : String(emailError),
            stack: emailError instanceof Error ? emailError.stack : undefined
          });
          
          // Update policy status to reflect email failure
          await supabaseClient
            .from('customer_policies')
            .update({ email_sent_status: 'failed' })
            .eq('id', policy.id);
        }
      } else {
        logStep("WARNING: No policy found for welcome email", { customerId: customerData2.id });
      }
    } else if (skipEmail) {
      logStep("Skipping email sending as requested", { skipEmail: true });
    } else {
      logStep("WARNING: No customer ID available for welcome email");
    }

    // Register warranty with Warranties 2000 if vehicle data is available and customer/policy created
    if (vehicleData && vehicleData.regNumber && customerData2?.id) {
      logStep("Attempting warranty registration with Warranties 2000");
      
      try {
        // Get the policy ID that was just created
        const { data: policyData } = await supabaseClient
          .from('customer_policies')
          .select('id')
          .eq('customer_id', customerData2.id)
          .eq('policy_number', warrantyReference)
          .single();
          
        if (policyData?.id) {
          logStep("Found policy for warranty registration", { policyId: policyData.id });

          // Check if warranty has already been sent to W2000 to prevent duplicates
          const { data: existingPolicy } = await supabaseClient
            .from('customer_policies')
            .select('warranties_2000_status')
            .eq('id', policyData.id)
            .single();

          if (existingPolicy?.warranties_2000_status === 'sent') {
            logStep("Warranty already sent to W2000, skipping duplicate call", { policyId: policyData.id });
          } else {
            const { data: warrantyData, error: warrantyError } = await supabaseClient.functions.invoke('send-to-warranties-2000', {
              body: { policyId: policyData.id, customerId: customerData2.id }
            });

            if (warrantyError) {
              logStep("Warning: Warranty registration failed", warrantyError);
            } else {
              logStep("Warranty registration successful", warrantyData);
            }
          }
        } else {
          logStep("Warning: Could not find policy ID for warranty registration");
        }
      } catch (warrantyRegError) {
        logStep("Warning: Warranty registration error", { error: warrantyRegError });
        // Don't fail the payment process if warranty registration fails
      }
    } else {
      logStep("Skipping warranty registration", { 
        hasVehicleData: !!vehicleData,
        hasRegNumber: !!vehicleData?.regNumber,
        hasCustomerId: !!customerData2?.id
      });
    }

    // Send sales notification to sales manager
    if (customerData2?.id && policy?.id) {
      try {
        logStep("Sending sales notification to sales manager");
        
        const Resend = (await import('npm:resend@2.0.0')).Resend;
        const resend = new Resend(Deno.env.get('RESEND_API_KEY'));
        
        const paymentTypeDisplay = getPaymentTypeDisplay(paymentType);
        const addOnsList = Object.entries(finalAddOnsForCustomer)
          .filter(([_, value]) => value === true)
          .map(([key, _]) => {
            const displayNames: Record<string, string> = {
              tyre_cover: 'Tyre Cover',
              wear_tear: 'Wear & Tear',
              europe_cover: 'European Cover',
              transfer_cover: 'Transfer Cover',
              breakdown_recovery: 'Breakdown Recovery',
              vehicle_rental: 'Vehicle Rental',
              mot_fee: 'MOT Test Fee',
              mot_repair: 'MOT Repair',
              lost_key: 'Lost Key Cover',
              consequential: 'Consequential Loss'
            };
            return displayNames[key] || key;
          })
          .join(', ') || 'None';

        const salesEmailHtml = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2563eb; border-bottom: 2px solid #2563eb; padding-bottom: 10px;">New Warranty Sale</h2>
            
            <h3 style="color: #333; margin-top: 20px;">Customer Details</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr><td style="padding: 8px; background: #f3f4f6;"><strong>Name:</strong></td><td style="padding: 8px;">${customerName}</td></tr>
              <tr><td style="padding: 8px; background: #f3f4f6;"><strong>Email:</strong></td><td style="padding: 8px;">${userEmail}</td></tr>
              <tr><td style="padding: 8px; background: #f3f4f6;"><strong>Phone:</strong></td><td style="padding: 8px;">${customerData?.mobile || customerData?.phone || vehicleData?.phone || 'N/A'}</td></tr>
              <tr><td style="padding: 8px; background: #f3f4f6;"><strong>Address:</strong></td><td style="padding: 8px;">${customerData?.street || ''} ${customerData?.town || ''} ${customerData?.postcode || ''}</td></tr>
            </table>

            <h3 style="color: #333; margin-top: 20px;">Warranty Details</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr><td style="padding: 8px; background: #f3f4f6;"><strong>Policy Number:</strong></td><td style="padding: 8px;">${warrantyReference}</td></tr>
              <tr><td style="padding: 8px; background: #f3f4f6;"><strong>Plan Type:</strong></td><td style="padding: 8px;">${planName}</td></tr>
              <tr><td style="padding: 8px; background: #f3f4f6;"><strong>Payment Type:</strong></td><td style="padding: 8px;">${paymentTypeDisplay}</td></tr>
              <tr><td style="padding: 8px; background: #f3f4f6;"><strong>Voluntary Excess:</strong></td><td style="padding: 8px;">£${customerRecord.voluntary_excess || 0}</td></tr>
              <tr><td style="padding: 8px; background: #f3f4f6;"><strong>Claim Limit:</strong></td><td style="padding: 8px;">£${customerRecord.claim_limit || 1250}</td></tr>
            </table>

            <h3 style="color: #333; margin-top: 20px;">Vehicle Details</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr><td style="padding: 8px; background: #f3f4f6;"><strong>Registration:</strong></td><td style="padding: 8px;">${vehicleData?.regNumber || 'Unknown'}</td></tr>
              <tr><td style="padding: 8px; background: #f3f4f6;"><strong>Make:</strong></td><td style="padding: 8px;">${vehicleData?.make || 'Unknown'}</td></tr>
              <tr><td style="padding: 8px; background: #f3f4f6;"><strong>Model:</strong></td><td style="padding: 8px;">${vehicleData?.model || 'Unknown'}</td></tr>
              <tr><td style="padding: 8px; background: #f3f4f6;"><strong>Year:</strong></td><td style="padding: 8px;">${vehicleData?.year || 'Unknown'}</td></tr>
              <tr><td style="padding: 8px; background: #f3f4f6;"><strong>Fuel Type:</strong></td><td style="padding: 8px;">${vehicleData?.fuelType || 'Unknown'}</td></tr>
              <tr><td style="padding: 8px; background: #f3f4f6;"><strong>Mileage:</strong></td><td style="padding: 8px;">${vehicleData?.mileage || 'Unknown'}</td></tr>
            </table>

            <h3 style="color: #333; margin-top: 20px;">Add-Ons Included</h3>
            <p style="padding: 10px; background: #f3f4f6; border-radius: 5px;">${addOnsList}</p>

            ${customerData?.discount_code ? `
            <h3 style="color: #333; margin-top: 20px;">Discount Applied</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr><td style="padding: 8px; background: #f3f4f6;"><strong>Code:</strong></td><td style="padding: 8px;">${customerData.discount_code}</td></tr>
              <tr><td style="padding: 8px; background: #f3f4f6;"><strong>Amount:</strong></td><td style="padding: 8px;">£${customerData.discount_amount || 0}</td></tr>
              <tr><td style="padding: 8px; background: #f3f4f6;"><strong>Original:</strong></td><td style="padding: 8px;">£${customerData.original_amount || 'N/A'}</td></tr>
              <tr><td style="padding: 8px; background: #f3f4f6;"><strong>Final:</strong></td><td style="padding: 8px;">£${customerData.final_amount || 'N/A'}</td></tr>
            </table>
            ` : ''}

            <div style="margin-top: 30px; padding: 15px; background: #dcfce7; border-left: 4px solid #16a34a; border-radius: 5px;">
              <p style="margin: 0; color: #166534;"><strong>✓ Status:</strong> Policy created and sent to Warranties 2000</p>
            </div>
          </div>
        `;

        await resend.emails.send({
          from: 'Buy a Warranty <notifications@buyawarranty.co.uk>',
          to: ['info@buyawarranty.co.uk'],
          subject: `New Sale: ${planName} - ${warrantyReference}`,
          html: salesEmailHtml
        });

        logStep("Sales notification sent successfully");
      } catch (emailError) {
        logStep("Warning: Failed to send sales notification", { error: emailError });
        // Don't fail the payment process if notification fails
      }
    }

    return new Response(JSON.stringify({
      success: true, 
      message: "Payment processed successfully",
      policyNumber: warrantyReference,
      customerId: customerData2?.id,
      policyId: policy?.id
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in handle-successful-payment", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});

// Generate BAW warranty reference number in format: BAW-[YYMM]-[SERIAL]
async function generateWarrantyReference(): Promise<string> {
  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  const date = new Date();
  const year = String(date.getFullYear()).slice(-2); // Last 2 digits of year
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const dateCode = `${year}${month}`;

  try {
    // Get the next serial number from the database
    const { data, error } = await supabaseClient.rpc('get_next_warranty_serial');
    
    if (error) {
      console.error('Error getting warranty serial:', error);
      // Fallback to timestamp-based serial if database call fails
      const fallbackSerial = 400000 + Date.now() % 100000;
      return `BAW-${dateCode}-${fallbackSerial}`;
    }

    const serialNumber = data || 400001;
    return `BAW-${dateCode}-${serialNumber}`;
  } catch (error) {
    console.error('Error in generateWarrantyReference:', error);
    // Fallback to timestamp-based serial
    const fallbackSerial = 400000 + Date.now() % 100000;
    return `BAW-${dateCode}-${fallbackSerial}`;
  }
}

// Helper functions for warranty registration
function getWarrantyDuration(paymentType: string): string {
  const normalizedPaymentType = paymentType?.toLowerCase().replace(/[_-]/g, '').trim();
  
  switch (normalizedPaymentType) {
    case 'monthly':
    case '1month':
    case 'month':
      return '12'; // Monthly payments still provide 12 months minimum coverage
    case 'yearly':
    case 'annual':
    case '12months':
    case '12month':
    case 'year':
      return '12';
    case 'twoyearly':
    case '2yearly':
    case '24months':
    case '24month':
    case '2years':
    case '2year':
    case 'two_yearly':
      return '24';
    case 'threeyearly':
    case '3yearly':
    case '36months':
    case '36month':
    case '3years':
    case '3year':
    case 'three_yearly':
      return '36';
    case 'fouryearly':
    case '4yearly':
    case '48months':
    case '48month':
    case '4years':
    case '4year':
    case 'four_yearly':
      return '48';
    case 'fiveyearly':
    case '5yearly':
    case '60months':
    case '60month':
    case '5years':
    case '5year':
    case 'five_yearly':
      return '60';
    default:
      console.warn(`Unknown payment type: ${paymentType}, defaulting to 12 months`);
      return '12';
  }
}

function getStandardizedVoluntaryExcess(metadata: any, customerData: any, vehicleData: any, directValue?: number): number {
  // Priority: directValue > metadata > customerData > vehicleData > default 0
  // Use ?? to properly handle 0 values (|| treats 0 as falsy)
  const excessValue = directValue ?? 
                     metadata?.voluntary_excess ?? 
                     customerData?.voluntaryExcess ?? 
                     customerData?.voluntary_excess ??
                     vehicleData?.voluntaryExcess ?? 
                     vehicleData?.voluntary_excess ??
                     0; // Default to 0, not 150
  
  return typeof excessValue === 'number' ? excessValue : parseInt(excessValue.toString());
}

function normalizeDuration(paymentType: string): string {
  const normalized = paymentType?.toLowerCase() || '';
  
  // Standardize all variations to consistent format
  if (normalized === '12months' || normalized === '12month' || normalized === 'yearly' || normalized === 'monthly') {
    return '12months';
  }
  if (normalized === '24months' || normalized === '24month' || normalized === 'two_yearly' || normalized === 'twoyearly' || normalized === 'twoyear') {
    return '24months';
  }
  if (normalized === '36months' || normalized === '36month' || normalized === 'three_yearly' || normalized === 'threeyearly' || normalized === 'threeyear' || normalized === 'three_year') {
    return '36months';
  }
  
  return paymentType; // Return original if no match
}

function getMaxClaimAmount(planId: string, paymentType?: string): string {
  // Return default claim limit of 1250 - user selection should override this
  // Valid claim limits are 750, 1250, 2000
  return '1250';
}

function getWarrantyType(planId: string): string {
  const normalizedPlan = planId.toLowerCase();
  
  // Handle special vehicle types
  if (normalizedPlan.includes('phev') || normalizedPlan.includes('hybrid')) {
    return 'B-PHEV';
  } else if (normalizedPlan.includes('electric') || normalizedPlan.includes('ev')) {
    return 'B-EV';
  } else if (normalizedPlan.includes('motorbike') || normalizedPlan.includes('motorcycle')) {
    return 'B-MOTORBIKE';
  }
  
  // Handle standard plan types - ALL NOW PLATINUM
  if (normalizedPlan.includes('basic')) {
    return 'B-PLATINUM';
  } else if (normalizedPlan.includes('gold')) {
    return 'B-PLATINUM';
  } else if (normalizedPlan.includes('platinum')) {
    return 'B-PLATINUM';
  }
  
  return 'B-PLATINUM'; // Default fallback
}

function extractTitle(fullName: string): string {
  const name = fullName.toLowerCase();
  if (name.includes('mr.') || name.includes('mr ')) return 'Mr';
  if (name.includes('mrs.') || name.includes('mrs ')) return 'Mrs';
  if (name.includes('ms.') || name.includes('ms ')) return 'Ms';
  if (name.includes('miss') || name.includes('miss ')) return 'Miss';
  if (name.includes('dr.') || name.includes('dr ')) return 'Dr';
  return 'Mr'; // Default
}

function extractFirstName(fullName: string): string {
  const parts = fullName.trim().split(' ');
  if (parts.length >= 2) {
    // Skip title if present
    const firstPart = parts[0].toLowerCase();
    if (['mr', 'mrs', 'ms', 'miss', 'dr', 'mr.', 'mrs.', 'ms.', 'dr.'].includes(firstPart)) {
      return parts[1] || 'Unknown';
    }
    return parts[0] || 'Unknown';
  }
  return fullName || 'Unknown';
}

function extractSurname(fullName: string): string {
  const parts = fullName.trim().split(' ');
  if (parts.length >= 2) {
    // Skip title if present
    const firstPart = parts[0].toLowerCase();
    if (['mr', 'mrs', 'ms', 'miss', 'dr', 'mr.', 'mrs.', 'ms.', 'dr.'].includes(firstPart)) {
      return parts.slice(2).join(' ') || parts[1] || 'Unknown';
    }
    return parts.slice(1).join(' ') || 'Unknown';
  }
  return 'Unknown';
}

function extractTown(address: string): string {
  // Try to extract town from address - this is a simple implementation
  const parts = address.split(',');
  if (parts.length >= 2) {
    return parts[parts.length - 2].trim();
  }
  return address || 'Unknown';
}

function extractPostcode(address: string): string {
  // Try to extract UK postcode from address
  const postcodeRegex = /([A-Z]{1,2}[0-9][A-Z0-9]? ?[0-9][A-Z]{2})/gi;
  const match = address.match(postcodeRegex);
  return match ? match[0] : ''; // Return empty string instead of fallback postcode
}

function calculatePurchasePrice(planId: string, paymentType: string): number {
  const pricingMap: { [key: string]: { [key: string]: number } } = {
    basic: {
      monthly: 31, yearly: 381, two_yearly: 725, three_yearly: 1050
    },
    gold: {
      monthly: 34, yearly: 409, two_yearly: 777, three_yearly: 1125
    },
    platinum: {
      monthly: 36, yearly: 437, two_yearly: 831, three_yearly: 1200
    }
  };

  return pricingMap[planId]?.[paymentType] || 31;
}

// Helper function to extract street from address
function extractStreet(address: string): string {
  const parts = address.split(',');
  return parts[0]?.trim() || address || 'Unknown';
}

// Use centralized warranty duration utilities for consistency
function getWarrantyDurationInMonths(paymentType: string): number {
  const normalizedPaymentType = paymentType?.toLowerCase().replace(/[_-]/g, '').trim();
  
  switch (normalizedPaymentType) {
    case 'monthly':
    case '1month':
    case 'month':
    case '12months':
    case '12month':
    case 'yearly':
    case '1year':
    case 'year':
      return 12;
    case '24months':
    case '24month':
    case 'twomonthly':
    case '2monthly':
    case 'twoyearly':
    case '2year':
    case 'twoyear':
      return 24;
    case '36months':
    case '36month':
    case 'threemonthly':
    case '3monthly':
    case 'threeyearly':
    case '3year':
    case 'threeyear':
      return 36;
    case '48months':
    case '48month':
    case 'fourmonthly':
    case '4monthly':
      return 48;
    case '60months':
    case '60month':
    case 'fivemonthly':
    case '5monthly':
      return 60;
    default:
      console.warn(`[HANDLE-PAYMENT] Unknown payment type: ${paymentType}, defaulting to 12 months`);
      return 12;
  }
}
// Helper function to calculate policy end date using centralized logic
function calculatePolicyEndDate(paymentType: string): string {
  const months = getWarrantyDurationInMonths(paymentType);
  const now = new Date();
  now.setMonth(now.getMonth() + months);
  return now.toISOString();
}

// Helper function to convert payment type to user-friendly display format
function getPaymentTypeDisplay(paymentType: string): string {
  const months = getWarrantyDurationInMonths(paymentType);
  return `${months} months`;
}

// Map frontend add-on keys to database/W2000 field names with "Y"/"N" values for Stripe metadata
function mapAddOnsToFields(protectionAddOns: { [key: string]: boolean }): any {
  const result = {
    // Map frontend keys to backend field names
    breakdown_recovery: protectionAddOns.breakdown ? "Y" : "N",
    mot_fee: protectionAddOns.motFee ? "Y" : "N", 
    tyre_cover: protectionAddOns.tyre ? "Y" : "N",
    wear_tear: protectionAddOns.wearAndTear || protectionAddOns.wearTear ? "Y" : "N", // Handle both variants
    europe_cover: protectionAddOns.european ? "Y" : "N",
    transfer_cover: protectionAddOns.transfer ? "Y" : "N",
    vehicle_rental: protectionAddOns.rental ? "Y" : "N",
    mot_repair: protectionAddOns.motRepair ? "Y" : "N",
    lost_key: protectionAddOns.lostKey ? "Y" : "N",
    consequential: protectionAddOns.consequential ? "Y" : "N"
  };
  
  console.log('[HANDLE-PAYMENT] Add-on mapping debug:', {
    inputProtectionAddOns: protectionAddOns,
    mappedFields: result
  });
  
  return result;
}

// Helper function to get auto-included add-ons for payment type (consistent with frontend)
function getAutoIncludedAddOnsForPayment(paymentType: string): string[] {
  const normalizedType = paymentType?.toLowerCase().replace(/[_-]/g, '').trim();
  
  // Handle various payment type formats from all sources (Stripe, Bumper, manual entry)
  switch (normalizedType) {
    case 'monthly':
    case '12months':
    case 'yearly':
    case '1year':
    case 'year':
      return []; // 12-month plans have no auto-included add-ons
    case '24months':
    case '2year':
    case 'twoyear':
    case 'twoyearly':
    case 'twomonthly':
    case '2monthly':
      return ['breakdown', 'motFee']; // 2-Year: Vehicle recovery, MOT test fee
    case '36months':
    case '3year':
    case 'threeyear':
    case 'threeyearly':
    case 'threemonthly':
    case '3monthly':
      return ['breakdown', 'motFee', 'rental', 'tyre']; // 3-Year: All above + Rental, Tyre
    default:
      console.warn(`[HANDLE-PAYMENT] Unknown payment type for auto-addons: ${paymentType}, defaulting to no auto-addons`);
      return []; // Default to no auto-addons for unknown payment types
  }
}
