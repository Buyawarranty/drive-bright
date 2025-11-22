import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

interface Warranties2000Request {
  policyId?: string;
  customerId?: string;
  force?: boolean;
}

interface Warranties2000Registration {
  Title: string;
  First: string; 
  Surname: string;
  Addr1: string;
  Addr2?: string;
  Town: string;
  PCode: string;
  Tel: string;
  Mobile: string;
  EMail: string;
  PurDate: string; // yyyy-mm-dd
  Make: string;
  Model: string;
  RegNum: string;
  Mileage: string;
  EngSize: string;
  PurPrc: string;
  RegDate: string; // yyyy-mm-dd
  WarType: string; // Must be from predefined list
  Month: string; // Coverage period in months
  MaxClm: string; // Must be from predefined list (full amounts)
  VolEx?: string; // Voluntary excess amount
  Notes?: string;
  Ref?: string; // Your reference
  MOTDue?: string; // yyyy-mm-dd
  // Add-ons using boolean values as per working registration function
  mot_fee?: boolean;
  tyre_cover?: boolean;
  wear_tear?: boolean;
  europe_cover?: boolean;
  transfer_cover?: boolean;
  breakdown_recovery?: boolean;
  vehicle_rental?: boolean;
  mot_repair?: boolean;
  lost_key?: boolean;  
  consequential?: boolean;
}

// Timeout wrapper for fetch
async function timedFetch(url: string, options: RequestInit, timeoutMs = 15000): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

// Retry wrapper with exponential backoff
async function retryFetch(url: string, options: RequestInit, maxRetries = 2): Promise<Response> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await timedFetch(url, options);
      
      // Only retry on 5xx or 429 status codes
      if (response.ok || (response.status < 500 && response.status !== 429)) {
        return response;
      }
      
      if (attempt === maxRetries) {
        return response; // Return the response even if not ok on final attempt
      }
      
      // Exponential backoff: 1s, 2s, 4s
      const delay = Math.pow(2, attempt) * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
      
    } catch (error) {
      lastError = error as Error;
      if (attempt === maxRetries) {
        throw lastError;
      }
      
      // Exponential backoff for network errors too
      const delay = Math.pow(2, attempt) * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError || new Error('Max retries exceeded');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const body: Warranties2000Request = await req.json();
  const { policyId, customerId, force = false } = body;
  
  console.log(`[WARRANTIES-2000] Function started with:`, { 
    policyId, 
    customerId,
    hasPolicyId: !!policyId,
    hasCustomerId: !!customerId,
    force
  });

  // Check for duplicate submissions unless forced
  if (!force && policyId) {
    console.log(`[WARRANTIES-2000] Checking for duplicate submission`);
    const { data: existingPolicy } = await supabase
      .from('customer_policies')
      .select('warranties_2000_status')
      .eq('id', policyId)
      .single();

    if (existingPolicy?.warranties_2000_status === 'sent') {
      console.log('⚠️ [WARRANTIES-2000] Warranty already sent to W2000, preventing duplicate');
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'Warranty already sent to Warranties 2000',
        duplicate_prevented: true
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      });
    }
  }
  
  try {
    let policy = null;
    let customer = null;

    // Enhanced data fetching with better error handling (using same pattern as working manual function)
    if (policyId) {
      console.log(`[WARRANTIES-2000] Fetching policy by ID: ${policyId}`);
      const { data: policyData, error: policyError } = await supabase
        .from('customer_policies')
        .select(`
          *,
          customers!customer_id (
            id, name, email, first_name, last_name, phone,
            registration_plate, vehicle_make, vehicle_model, vehicle_year,
            mileage, flat_number, building_name, building_number,
            street, town, county, postcode, country, plan_type, payment_type,
            final_amount, warranty_reference_number, voluntary_excess
          )
        `)
        .eq('id', policyId)
        .single();

      if (policyError) {
        console.error(`[WARRANTIES-2000] Policy fetch error:`, policyError);
        throw new Error(`Failed to fetch policy: ${policyError.message}`);
      }

      policy = policyData;
      customer = policyData.customers;
      console.log(`[WARRANTIES-2000] Found policy:`, { 
        policyNumber: policy?.policy_number,
        customerEmail: customer?.email,
        planType: policy?.plan_type
      });
    } else if (customerId) {
      console.log(`[WARRANTIES-2000] Fetching customer by ID: ${customerId}`);
      
      // Get customer first
      const { data: customerData, error: customerError } = await supabase
        .from('customers')
        .select('*')
        .eq('id', customerId)
        .single();

      if (customerError) {
        console.error(`[WARRANTIES-2000] Customer fetch error:`, customerError);
        throw new Error(`Failed to fetch customer: ${customerError.message}`);
      }

      customer = customerData;

      // Then get their most recent policy
      const { data: policyData, error: policyError } = await supabase
        .from('customer_policies')
        .select('*')
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (policyError) {
        console.log(`[WARRANTIES-2000] No policy found for customer, using customer data only:`, policyError);
        // Continue without policy data - use customer data only
      } else {
        policy = policyData;
      }
      
      console.log(`[WARRANTIES-2000] Found customer:`, { 
        customerEmail: customer?.email,
        policyNumber: policy?.policy_number || 'No policy',
        planType: policy?.plan_type || customer?.plan_type
      });
    } else {
      throw new Error('Either policyId or customerId must be provided');
    }

    if (!customer) {
      throw new Error('Customer data not found');
    }

    console.log(`[WARRANTIES-2000] Data validation passed:`, {
      hasPolicy: !!policy,
      hasCustomer: !!customer,
      customerName: customer.name || customer.first_name || 'Unknown',
      registrationPlate: customer.registration_plate || 'N/A'
    });

    // Get environment variables
    const warrantiesUsername = Deno.env.get('WARRANTIES_2000_USERNAME');
    const warrantiesPassword = Deno.env.get('WARRANTIES_2000_PASSWORD');

    if (!warrantiesUsername || !warrantiesPassword) {
      throw new Error('Warranties 2000 credentials not configured');
    }

    // Map plan types to warranty types (exact API values) - ALL NOW PLATINUM
    const warrantyTypeMapping: Record<string, string> = {
      'basic': 'B-PLATINUM',
      'gold': 'B-PLATINUM', 
      'platinum': 'B-PLATINUM',
      'premium': 'B-PLATINUM', // Premium plan maps to B-PLATINUM
      'electric': 'B-EV',
      'ev': 'B-EV',
      'electric vehicle ev extended warranty': 'B-EV',
      'phev': 'B-PHEV',
      'hybrid': 'B-PHEV',
      'phev hybrid extended warranty': 'B-PHEV',
      'motorbike': 'B-MOTORBIKE',
      'motorcycle': 'B-MOTORBIKE',
      'motorbike extended warranty': 'B-MOTORBIKE'
    };

    // Use policy data if available, otherwise fall back to customer data
    let planType = (policy?.plan_type || customer.plan_type || 'basic').toLowerCase();
    
    // CRITICAL FIX: Override incorrect plan types based on actual vehicle type
    // If plan type says "motorbike" but vehicle is clearly not a motorbike, correct it
    const vehicleMake = customer.vehicle_make?.toLowerCase() || '';
    const vehicleModel = customer.vehicle_model?.toLowerCase() || '';
    
    // Check if this is actually a motorbike/motorcycle
    const isActualMotorbike = vehicleMake.includes('yamaha') || vehicleMake.includes('honda') || 
                             vehicleMake.includes('kawasaki') || vehicleMake.includes('suzuki') ||
                             vehicleMake.includes('ducati') || vehicleMake.includes('bmw') ||
                             vehicleMake.includes('harley') || vehicleMake.includes('triumph') ||
                             vehicleModel.includes('bike') || vehicleModel.includes('scooter');
    
    // Check if this is a commercial vehicle (should use premium/gold)
    const isCommercialVehicle = vehicleMake.includes('mercedes') || vehicleMake.includes('ford') ||
                               vehicleMake.includes('transit') || vehicleMake.includes('sprinter') ||
                               vehicleModel.includes('transit') || vehicleModel.includes('sprinter') ||
                               vehicleModel.includes('van') || vehicleModel.includes('commercial');
    
    // Override incorrect plan types
    if (planType.includes('motorbike') && !isActualMotorbike) {
      console.log(`[WARRANTIES-2000] CORRECTING: Vehicle ${vehicleMake} ${vehicleModel} incorrectly classified as motorbike, changing to premium`);
      planType = 'premium'; // Default commercial vehicles to premium plan
    }
    
    console.log(`[WARRANTIES-2000] Plan type determination:`, {
      originalPlanType: policy?.plan_type || customer.plan_type,
      correctedPlanType: planType,
      vehicleMake: vehicleMake,
      vehicleModel: vehicleModel,
      isActualMotorbike,
      isCommercialVehicle
    });

    const warrantyType = warrantyTypeMapping[planType] || 'B-PLATINUM'; // Default to B-PLATINUM for all plans

    // Calculate coverage months using the master function from warrantyDurationUtils
    const paymentType = policy?.payment_type || customer.payment_type || 'yearly';
    
    // Use the same logic as the frontend for consistency
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
          console.warn(`[WARRANTIES-2000] Unknown payment type: ${paymentType}, defaulting to 12 months`);
          return 12;
      }
    }
    
    const coverageMonths = getWarrantyDurationInMonths(paymentType).toString();
    
    console.log(`[WARRANTIES-2000] DURATION CALCULATION DEBUG:`, {
      originalPaymentType: paymentType,
      normalizedPaymentType: paymentType?.toLowerCase().replace(/[_-]/g, '').trim(),
      calculatedMonths: getWarrantyDurationInMonths(paymentType),
      coverageMonthsString: coverageMonths,
      warrantyType: warrantyType
    });

    // Get claim limit from policy or customer data
    // Valid claim limits are 750, 1250, 2000
    const policyClaimLimit = policy?.claim_limit;
    const customerClaimLimit = customer?.claim_limit;
    const finalClaimLimit = policyClaimLimit ?? customerClaimLimit ?? 1250;
    
    // Get voluntary excess from policy or customer data - EXACT same pattern as claim limit
    const policyVoluntaryExcess = policy?.voluntary_excess;
    const customerVoluntaryExcess = customer?.voluntary_excess;
    const finalVoluntaryExcess = policyVoluntaryExcess ?? customerVoluntaryExcess ?? 0;
    
    console.log(`[WARRANTIES-2000] Claim limit processing: Policy: ${policyClaimLimit}, Customer: ${customerClaimLimit}, Final: ${finalClaimLimit}`);
    console.log(`[WARRANTIES-2000] Voluntary excess processing: Policy: ${policyVoluntaryExcess}, Customer: ${customerVoluntaryExcess}, Final: ${finalVoluntaryExcess}`);
    
    console.log(`[WARRANTIES-2000] Plan type determination: {
      originalPlanType: "${policy?.plan_type || customer.plan_type}",
      correctedPlanType: "${planType}",
      vehicleMake: "${vehicleMake}",
      vehicleModel: "${vehicleModel}",
      isActualMotorbike: ${isActualMotorbike},
      isCommercialVehicle: ${isCommercialVehicle}
    }`);

    // Enhanced addon debugging - check both policy and customer tables
    console.log(`[WARRANTIES-2000] Enhanced add-on debug:`, {
      policyData: policy ? {
        id: policy.id,
        tyre_cover: policy.tyre_cover,
        wear_tear: policy.wear_tear,
        europe_cover: policy.europe_cover,
        transfer_cover: policy.transfer_cover,
        breakdown_recovery: policy.breakdown_recovery,
        vehicle_rental: policy.vehicle_rental,
        mot_fee: policy.mot_fee,
        mot_repair: policy.mot_repair,
        lost_key: policy.lost_key,
        consequential: policy.consequential
      } : null,
      customerData: {
        id: customer.id,
        tyre_cover: customer.tyre_cover,
        wear_tear: customer.wear_tear,
        europe_cover: customer.europe_cover,
        transfer_cover: customer.transfer_cover,
        breakdown_recovery: customer.breakdown_recovery,
        vehicle_rental: customer.vehicle_rental,
        mot_fee: customer.mot_fee,
        mot_repair: customer.mot_repair,
        lost_key: customer.lost_key,
        consequential: customer.consequential
      },
      finalAddonDecisions: {
        Recovery: (policy?.breakdown_recovery === true || customer?.breakdown_recovery === true),
        MOTRepair: (policy?.mot_repair === true || customer?.mot_repair === true),
        TyreCover: (policy?.tyre_cover === true || customer?.tyre_cover === true),
        WearTear: (policy?.wear_tear === true || customer?.wear_tear === true),
        LostKey: (policy?.lost_key === true || customer?.lost_key === true),
        MOTFee: (policy?.mot_fee === true || customer?.mot_fee === true),
        EuroCover: (policy?.europe_cover === true || customer?.europe_cover === true),
        Rental: (policy?.vehicle_rental === true || customer?.vehicle_rental === true),
        Consequential: (policy?.consequential === true || customer?.consequential === true),
        Transfer: (policy?.transfer_cover === true || customer?.transfer_cover === true)
      }
    });

    // Build the registration data with proper address and data mapping
    const registrationData: Warranties2000Registration = {
      Title: "Mr",
      First: customer.first_name || customer.name?.split(' ')[0] || "Customer",
      Surname: customer.last_name || customer.name?.split(' ').slice(1).join(' ') || "Name",
      // Fix address mapping - handle all address field combinations properly
      Addr1: (() => {
        let address1 = "";
        if (customer.building_number && customer.street) {
          address1 = `${customer.building_number} ${customer.street}`;
        } else if (customer.street) {
          address1 = customer.street;
        } else if (customer.building_name) {
          address1 = customer.building_name;
        } else {
          address1 = "Address Line 1";
        }
        return address1;
      })(),
      Addr2: (() => {
        // Use flat number, building name, or leave empty if already used in Addr1
        if (customer.flat_number && customer.building_name && !customer.street) {
          return `${customer.flat_number}, ${customer.building_name}`;
        } else if (customer.flat_number) {
          return customer.flat_number;
        } else if (customer.building_name && customer.street) {
          return customer.building_name;
        }
        return "";
      })(),
      Town: customer.town || "Town",
      PCode: customer.postcode && customer.postcode.trim() ? customer.postcode.trim() : "UNKNOWN",
      // Fix phone mapping - ensure phone number is properly sent
      Tel: customer.phone && customer.phone.trim() ? customer.phone.trim() : "N/A",
      Mobile: customer.phone && customer.phone.trim() ? customer.phone.trim() : "N/A", 
      EMail: customer.email,
      PurDate: new Date().toISOString().split('T')[0], // Today's date
      // Fix vehicle data mapping - ensure make/model are properly sent
      Make: customer.vehicle_make && customer.vehicle_make.trim() ? customer.vehicle_make.trim() : "UNKNOWN",
      Model: customer.vehicle_model && customer.vehicle_model.trim() ? customer.vehicle_model.trim() : "UNKNOWN",
      RegNum: customer.registration_plate || "UNKNOWN",
      Mileage: (() => {
        // Strip non-numeric characters from mileage (e.g., "100001+" -> "100001")
        const rawMileage = customer.mileage || "50000";
        const numericMileage = String(rawMileage).replace(/[^\d]/g, '');
        return numericMileage || "50000";
      })(),
      EngSize: "1968", // Default engine size
      PurPrc: "1", // Default purchase price - actual price kept private on admin dashboard
      RegDate: customer.vehicle_year ? `${customer.vehicle_year}-01-01` : "2020-01-01",
      WarType: warrantyType,
      Month: coverageMonths,
      MaxClm: String(finalClaimLimit),
      MOTDue: (() => {
        const nextYear = new Date();
        nextYear.setFullYear(nextYear.getFullYear() + 1);
        return nextYear.toISOString().split('T')[0];
      })(),
      Ref: policy?.policy_number || policy?.warranty_number || customer.warranty_reference_number || `REF-${Date.now()}`,
      VolEx: String(finalVoluntaryExcess),
      Notes: (() => {
        let notes = `Plan: ${policy?.plan_type || customer.plan_type || 'N/A'} | Payment: ${paymentType || 'N/A'} | ClaimLimit: ${finalClaimLimit} | VolExcess: ${finalVoluntaryExcess}`;
        
        // Add seasonal bonus information if present
        const bonusMonths = policy?.seasonal_bonus_months || customer?.seasonal_bonus_months || 0;
        if (bonusMonths > 0) {
          notes += ` | PROMOTION: ${bonusMonths} Months FREE Bonus - Total ${parseInt(coverageMonths) + bonusMonths} months coverage`;
        }
        
        return notes;
      })()
      // Note: Add-ons are only sent when actually selected to avoid W2000 API validation errors
    };

    // Auto-include addons for multi-year plans if not already set
    const autoIncludedAddons = getAutoIncludedAddonsForDuration(coverageMonths);
    
    // W2000 API requires add-on fields to match the registration API format
    // Priority: 1. Policy data (from handle-successful-payment), 2. Customer data, 3. Auto-inclusion for duration
    registrationData.mot_fee = (policy?.mot_fee === true || customer?.mot_fee === true || autoIncludedAddons.includes('motFee')); 
    registrationData.tyre_cover = (policy?.tyre_cover === true || customer?.tyre_cover === true || autoIncludedAddons.includes('tyre'));
    registrationData.wear_tear = (policy?.wear_tear === true || customer?.wear_tear === true); 
    registrationData.europe_cover = (policy?.europe_cover === true || customer?.europe_cover === true); 
    registrationData.transfer_cover = (policy?.transfer_cover === true || customer?.transfer_cover === true); 
    
    // Additional add-ons with auto-inclusion support
    registrationData.breakdown_recovery = (policy?.breakdown_recovery === true || customer?.breakdown_recovery === true || autoIncludedAddons.includes('breakdown'));
    registrationData.vehicle_rental = (policy?.vehicle_rental === true || customer?.vehicle_rental === true || autoIncludedAddons.includes('rental'));
    registrationData.mot_repair = (policy?.mot_repair === true || customer?.mot_repair === true); 
    registrationData.lost_key = (policy?.lost_key === true || customer?.lost_key === true); 
    registrationData.consequential = (policy?.consequential === true || customer?.consequential === true);

    // Helper function to get auto-included addons based on coverage duration
    function getAutoIncludedAddonsForDuration(months: string): string[] {
      const monthsNum = parseInt(months);
      switch (monthsNum) {
        case 24:
          return ['breakdown', 'motFee']; // 2-Year: Vehicle recovery, MOT test fee
        case 36:
          return ['breakdown', 'motFee', 'rental', 'tyre']; // 3-Year: All above + Rental, Tyre
        default:
          return []; // 12-month plans have no auto-included add-ons
      }
    }

    console.log(`[WARRANTIES-2000] Final registration data sent to W2000:`, {
      regNum: registrationData.RegNum,
      warType: registrationData.WarType,
      customerEmail: registrationData.EMail,
      ref: registrationData.Ref,
      claimLimit: registrationData.MaxClm,
      voluntaryExcess: registrationData.VolEx,
      coverage: registrationData.Month,
      addOns: {
        "Recovery": registrationData.breakdown_recovery ? "Y" : "N",
        "MOTRepair": registrationData.mot_repair ? "Y" : "N",
        "TyreCover": registrationData.tyre_cover ? "Y" : "N",
        "WearTear": registrationData.wear_tear ? "Y" : "N",
        "LostKey": registrationData.lost_key ? "Y" : "N",
        "MOTFee": registrationData.mot_fee ? "Y" : "N",
        "EuroCover": registrationData.europe_cover ? "Y" : "N",
        "Rental": registrationData.vehicle_rental ? "Y" : "N",
        "Consequential": registrationData.consequential ? "Y" : "N",
        "Transfer": registrationData.transfer_cover ? "Y" : "N"
      }
    });

    // Create basic auth header (same as working warranties-2000-registration function)
    const credentials = btoa(`${warrantiesUsername}:${warrantiesPassword}`);

    const apiUrl = Deno.env.get('W2K_API_URL') || 'https://warranties-epf.co.uk/api.php';

    console.log(`[WARRANTIES-2000] COMPLETE API PAYLOAD DEBUG:`, {
      apiUrl,
      Month: registrationData.Month,
      WarType: registrationData.WarType,
      MaxClm: registrationData.MaxClm,
      VolEx: registrationData.VolEx,
      paymentTypeUsed: paymentType,
      calculatedMonths: getWarrantyDurationInMonths(paymentType),
      w2000AddOns: {
        "Recovery": registrationData.breakdown_recovery ? "Y" : "N",
        "MOTRepair": registrationData.mot_repair ? "Y" : "N",
        "TyreCover": registrationData.tyre_cover ? "Y" : "N", 
        "WearTear": registrationData.wear_tear ? "Y" : "N",
        "LostKey": registrationData.lost_key ? "Y" : "N",
        "MOTFee": registrationData.mot_fee ? "Y" : "N",
        "EuroCover": registrationData.europe_cover ? "Y" : "N",
        "Rental": registrationData.vehicle_rental ? "Y" : "N",
        "Consequential": registrationData.consequential ? "Y" : "N",
        "Transfer": registrationData.transfer_cover ? "Y" : "N"
      }
    });

    console.log(`[WARRANTIES-2000] Making API call to: ${apiUrl}`);

    // Convert boolean add-on values to Y/N strings for W2000 API with correct field names
    const w2000Data = {
      ...registrationData,
      // W2000 API field names (capitalized without spaces as requested)
      "Recovery": registrationData.breakdown_recovery ? "Y" : "N",
      "MOTRepair": registrationData.mot_repair ? "Y" : "N",
      "TyreCover": registrationData.tyre_cover ? "Y" : "N",
      "WearTear": registrationData.wear_tear ? "Y" : "N",
      "LostKey": registrationData.lost_key ? "Y" : "N",
      "MOTFee": registrationData.mot_fee ? "Y" : "N",
      "EuroCover": registrationData.europe_cover ? "Y" : "N",
      "Rental": registrationData.vehicle_rental ? "Y" : "N",
      "Consequential": registrationData.consequential ? "Y" : "N",
      "Transfer": registrationData.transfer_cover ? "Y" : "N",
      // Remove the old field names to avoid confusion
      mot_fee: undefined,
      tyre_cover: undefined,
      wear_tear: undefined,
      europe_cover: undefined,
      transfer_cover: undefined,
      breakdown_recovery: undefined,
      vehicle_rental: undefined,
      mot_repair: undefined,
      lost_key: undefined,
      consequential: undefined
    };

    const response = await retryFetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${credentials}`,
        'User-Agent': 'BuyAWarranty-Integration/1.0',
        'Accept': 'application/json, text/plain, */*',
      },
      body: JSON.stringify(w2000Data),
    });

    const responseText = await response.text();
    console.log(`[WARRANTIES-2000] API Response:`, {
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers),
      body: responseText
    });

    // Update the customer_policies table with warranty registration status
    if (policy?.id) {
      const updateData = {
        warranties_2000_sent_at: new Date().toISOString(),
        warranties_2000_status: response.ok ? 'sent' : 'failed',
        warranties_2000_response: {
          status: response.status,
          response: responseText,
          timestamp: new Date().toISOString()
        }
      };

      const { error: updateError } = await supabase
        .from('customer_policies')
        .update(updateData)
        .eq('id', policy.id);

      if (updateError) {
        console.error(`[WARRANTIES-2000] Failed to update policy status:`, updateError);
      } else {
        console.log(`[WARRANTIES-2000] Updated policy status successfully`);
      }
      
      // Create audit log entry
      const { data: { user } } = await supabase.auth.getUser();
      const actionType = force ? 'manual_resend' : 'initial_send';
      
      const { error: auditError } = await supabase
        .from('warranties_2000_audit_log')
        .insert({
          policy_id: policy.id,
          customer_id: customer.id,
          admin_user_id: user?.id || null,
          admin_email: user?.email || 'system',
          action_type: actionType,
          data_sent: registrationData,
          w2k_response: {
            status: response.status,
            response: responseText,
            timestamp: new Date().toISOString()
          },
          notes: force ? 'Manual resend by admin' : 'Initial warranty registration'
        });
      
      if (auditError) {
        console.error(`[WARRANTIES-2000] Failed to create audit log:`, auditError);
      } else {
        console.log(`[WARRANTIES-2000] Audit log created successfully for ${actionType}`);
      }
    }

    if (!response.ok) {
      console.error(`[WARRANTIES-2000] API call failed:`, {
        status: response.status,
        response: responseText
      });
      
      return new Response(JSON.stringify({
        success: false,
        error: `Warranties 2000 API error: ${response.status} ${response.statusText}`,
        response: responseText,
        registrationData: registrationData
      }), {
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`[WARRANTIES-2000] Registration successful`);

    return new Response(JSON.stringify({
      success: true,
      message: 'Warranty registered successfully with Warranties 2000',
      registrationData: registrationData,
      response: responseText
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error(`[WARRANTIES-2000] Error:`, error);
    
    // Update policy status on error if we have a policy ID
    if (body.policyId) {
      try {
        await supabase
          .from('customer_policies')
          .update({
            warranties_2000_sent_at: new Date().toISOString(),
            warranties_2000_status: 'failed',
            warranties_2000_response: {
              error: error instanceof Error ? error.message : String(error),
              timestamp: new Date().toISOString()
            }
          })
          .eq('id', body.policyId);
      } catch (updateError) {
        console.error(`[WARRANTIES-2000] Failed to update error status:`, updateError);
      }
    }
    
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      details: error
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});