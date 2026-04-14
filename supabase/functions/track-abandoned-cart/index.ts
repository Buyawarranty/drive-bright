import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface AbandonedCartData {
  full_name?: string;
  email: string;
  phone?: string;
  vehicle_reg?: string;
  vehicle_make?: string;
  vehicle_model?: string;
  vehicle_year?: string;
  mileage?: string;
  plan_id?: string;
  plan_name?: string;
  payment_type?: string;
  step_abandoned: number;
  vehicle_type?: string;
  // Pricing details for email restoration
  total_price?: number;
  voluntary_excess?: number;
  claim_limit?: number;
  labour_rate?: number;
  boost_addon?: boolean;
  // Address for shipping/contact
  address?: {
    flat_number?: string;
    building_name?: string;
    building_number?: string;
    street?: string;
    town?: string;
    county?: string;
    postcode?: string;
    country?: string;
  };
  // Protection add-ons
  protection_addons?: {
    breakdown?: boolean;
    motFee?: boolean;
    motRepair?: boolean;
    wearTear?: boolean;
    tyre?: boolean;
    european?: boolean;
    rental?: boolean;
    transfer?: boolean;
    lostKey?: boolean;
    consequential?: boolean;
  };
  // Facebook/Google ad attribution
  fbclid?: string;
  gclid?: string;
  fb_referrer?: string;
}

async function triggerWhatsAppMessage(supabase: any, supabaseUrl: string, supabaseServiceKey: string, cartData: AbandonedCartData) {
  try {
    console.log(`📱 Triggering WhatsApp welcome message for: ${cartData.phone}`);
    
    const isValidVehicle = (val: string | undefined) => val && val.trim() !== '' && val.trim().toLowerCase() !== 'unknown';
    let resolvedMake = isValidVehicle(cartData.vehicle_make) ? cartData.vehicle_make! : '';
    let resolvedModel = isValidVehicle(cartData.vehicle_model) ? cartData.vehicle_model! : '';
    
    if (!resolvedMake || !resolvedModel) {
      console.log('🔍 Vehicle make/model empty/unknown, looking up from sales_leads...');
      const { data: leadData } = await supabase
        .from('sales_leads')
        .select('vehicle_make, vehicle_model')
        .eq('email', cartData.email.toLowerCase())
        .not('vehicle_make', 'is', null)
        .neq('vehicle_make', '')
        .neq('vehicle_make', 'Unknown')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (leadData) {
        resolvedMake = resolvedMake || leadData.vehicle_make || '';
        resolvedModel = resolvedModel || leadData.vehicle_model || '';
        console.log(`✅ Found vehicle from sales_leads: ${resolvedMake} ${resolvedModel}`);
      }
    }
    
    if ((!resolvedMake || !resolvedModel) && cartData.vehicle_reg) {
      console.log('🔍 Still missing vehicle data, looking up by vehicle_reg in abandoned_carts...');
      const { data: cartHistory } = await supabase
        .from('abandoned_carts')
        .select('vehicle_make, vehicle_model')
        .eq('vehicle_reg', cartData.vehicle_reg)
        .not('vehicle_make', 'is', null)
        .neq('vehicle_make', '')
        .neq('vehicle_make', 'Unknown')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (cartHistory) {
        resolvedMake = resolvedMake || cartHistory.vehicle_make || '';
        resolvedModel = resolvedModel || cartHistory.vehicle_model || '';
        console.log(`✅ Found vehicle from abandoned_carts history: ${resolvedMake} ${resolvedModel}`);
      }
    }
    
    const whatsappPayload = {
      phone: cartData.phone,
      email: cartData.email,
      firstName: cartData.full_name?.split(' ')[0] || 'there',
      vehicleMake: resolvedMake,
      vehicleModel: resolvedModel,
      abandonedCartId: null
    };

    fetch(`${supabaseUrl}/functions/v1/send-uchat-whatsapp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`
      },
      body: JSON.stringify(whatsappPayload)
    }).then(response => {
      console.log(`📱 WhatsApp trigger response status: ${response.status}`);
    }).catch(err => {
      console.error('📱 WhatsApp trigger error (non-blocking):', err);
    });
  } catch (whatsappError) {
    console.error('Error triggering WhatsApp message (non-blocking):', whatsappError);
  }
}

async function hydrateIdentityFromHistory(supabase: any, cartData: AbandonedCartData) {
  if (!cartData.email) return;

  const isBlank = (value?: string | null) => !value || value.trim() === '';
  const needsPhone = isBlank(cartData.phone);
  const needsName = isBlank(cartData.full_name);

  if (!needsPhone && !needsName) return;

  try {
    let historicalPhone: string | undefined;
    let historicalName: string | undefined;

    const { data: cartHistory } = await supabase
      .from('abandoned_carts')
      .select('phone, full_name, created_at')
      .eq('email', cartData.email)
      .order('created_at', { ascending: false })
      .limit(20);

    if (cartHistory && cartHistory.length > 0) {
      for (const row of cartHistory) {
        if (!historicalPhone && !isBlank(row.phone)) historicalPhone = row.phone;
        if (!historicalName && !isBlank(row.full_name)) historicalName = row.full_name;
        if (historicalPhone && historicalName) break;
      }
    }

    if (!historicalPhone || !historicalName) {
      const { data: leadHistory } = await supabase
        .from('sales_leads')
        .select('phone, first_name, created_at')
        .eq('email', cartData.email)
        .order('created_at', { ascending: false })
        .limit(20);

      if (leadHistory && leadHistory.length > 0) {
        for (const row of leadHistory) {
          if (!historicalPhone && !isBlank(row.phone)) historicalPhone = row.phone;
          if (!historicalName && !isBlank(row.first_name)) historicalName = row.first_name;
          if (historicalPhone && historicalName) break;
        }
      }
    }

    if (needsPhone && historicalPhone) {
      cartData.phone = historicalPhone;
      console.log(`📞 Hydrated missing phone from history for: ${cartData.email}`);
    }

    if (needsName && historicalName) {
      cartData.full_name = historicalName;
      console.log(`👤 Hydrated missing name from history for: ${cartData.email}`);
    }
  } catch (historyError) {
    console.error('Identity hydration failed (non-blocking):', historyError);
  }
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false }
    });

    const cartData: AbandonedCartData = await req.json();

    // Normalize email to lowercase to prevent case-mismatch dedup issues
    if (cartData.email) {
      cartData.email = cartData.email.trim().toLowerCase();
    }

    // Normalize phone: never persist empty string (prevents wiping existing valid phones)
    if (typeof cartData.phone === 'string') {
      const normalizedPhone = cartData.phone.trim();
      cartData.phone = normalizedPhone === '' ? undefined : normalizedPhone;
    }

    // Track if we have at least an email or vehicle registration
    // For abandoned cart tracking, we accept any identifier including vehicle reg
    if (!cartData.email || cartData.email === '') {
      return new Response(
        JSON.stringify({ error: "Email or identifier is required for abandoned cart tracking" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Server-side identity hydration: recover phone/name from historical records when Step 3/4 payloads omit them
    await hydrateIdentityFromHistory(supabase, cartData);

    console.log(`📊 Tracking abandoned cart for: ${cartData.email} at step ${cartData.step_abandoned}`);

    // Check if we already have a recent abandoned cart entry for this email (any step)
    const { data: existingCart, error: checkError } = await supabase
      .from('abandoned_carts')
      .select('id, created_at, step_abandoned')
      .eq('email', cartData.email)
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // Last 24 hours
      .order('created_at', { ascending: false })
      .limit(1);

    if (checkError) {
      console.error('Error checking existing cart:', checkError);
    }

    // If we have a recent entry, update it instead of creating a new one
    if (existingCart && existingCart.length > 0) {
      // CRITICAL SAFEGUARD: Build update payload carefully.
      // Only include phone/full_name if the new value is non-empty.
      // This prevents Step 3 (which doesn't collect phone) from wiping Step 2 data.
      const updatePayload: Record<string, any> = {
        vehicle_reg: cartData.vehicle_reg,
        vehicle_make: cartData.vehicle_make,
        vehicle_model: cartData.vehicle_model,
        vehicle_year: cartData.vehicle_year,
        mileage: cartData.mileage,
        plan_id: cartData.plan_id,
        plan_name: cartData.plan_name,
        payment_type: cartData.payment_type,
        vehicle_type: cartData.vehicle_type,
        step_abandoned: cartData.step_abandoned,
        cart_metadata: {
          total_price: cartData.total_price,
          voluntary_excess: cartData.voluntary_excess,
          claim_limit: cartData.claim_limit,
          labour_rate: cartData.labour_rate,
          boost_addon: cartData.boost_addon,
          address: cartData.address,
          protection_addons: cartData.protection_addons,
          ...(cartData.fbclid ? { fbclid: cartData.fbclid } : {}),
          ...(cartData.gclid ? { gclid: cartData.gclid } : {}),
          ...(cartData.fb_referrer ? { fb_referrer: cartData.fb_referrer } : {}),
        },
        updated_at: new Date().toISOString()
      };

      // ONLY include phone if the new value is non-empty — never wipe existing phone
      if (cartData.phone && cartData.phone.trim() !== '') {
        updatePayload.phone = cartData.phone;
      }
      // ONLY include full_name if the new value is non-empty — never wipe existing name
      if (cartData.full_name && cartData.full_name.trim() !== '') {
        updatePayload.full_name = cartData.full_name;
      }

      const { error: updateError } = await supabase
        .from('abandoned_carts')
        .update(updatePayload)
        .eq('id', existingCart[0].id);

      if (updateError) {
        console.error('Error updating abandoned cart:', updateError);
        throw updateError;
      }

      console.log(`Updated existing abandoned cart entry for: ${cartData.email} (step ${existingCart[0].step_abandoned} → ${cartData.step_abandoned})`);
      
      // Also trigger WhatsApp for updated carts with phone numbers
      if (cartData.phone && cartData.phone.trim() !== '') {
        await triggerWhatsAppMessage(supabase, supabaseUrl, supabaseServiceKey, cartData);
      }
    } else {
      // Create new abandoned cart entry with extended metadata
      const { error: insertError } = await supabase
        .from('abandoned_carts')
        .insert([{
          ...cartData,
          cart_metadata: {
            total_price: cartData.total_price,
            voluntary_excess: cartData.voluntary_excess,
            claim_limit: cartData.claim_limit,
            labour_rate: cartData.labour_rate,
            boost_addon: cartData.boost_addon,
            address: cartData.address,
            protection_addons: cartData.protection_addons,
            ...(cartData.fbclid ? { fbclid: cartData.fbclid } : {}),
            ...(cartData.gclid ? { gclid: cartData.gclid } : {}),
            ...(cartData.fb_referrer ? { fb_referrer: cartData.fb_referrer } : {}),
          }
        }]);

      if (insertError) {
        console.error('Error inserting abandoned cart:', insertError);
        throw insertError;
      }

      console.log('Created new abandoned cart entry for:', cartData.email);

      // Trigger WhatsApp welcome message for new cart entries with phone numbers
      if (cartData.phone && cartData.phone.trim() !== '') {
        await triggerWhatsAppMessage(supabase, supabaseUrl, supabaseServiceKey, cartData);
      }
    }

    return new Response(
      JSON.stringify({ success: true, message: "Abandoned cart tracked successfully" }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );

  } catch (error: any) {
    console.error("Error in track-abandoned-cart function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);