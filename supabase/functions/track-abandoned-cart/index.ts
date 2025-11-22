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
  // Pricing details for email
  total_price?: number;
  voluntary_excess?: number;
  claim_limit?: number;
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

    // Track if we have at least an email or vehicle registration
    // For abandoned cart tracking, we accept any identifier including vehicle reg
    if (!cartData.email || cartData.email.trim() === '') {
      return new Response(
        JSON.stringify({ error: "Email or identifier is required for abandoned cart tracking" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

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
      const { error: updateError } = await supabase
        .from('abandoned_carts')
        .update({
          full_name: cartData.full_name,
          phone: cartData.phone,
          vehicle_reg: cartData.vehicle_reg,
          vehicle_make: cartData.vehicle_make,
          vehicle_model: cartData.vehicle_model,
          vehicle_year: cartData.vehicle_year,
          mileage: cartData.mileage,
          plan_id: cartData.plan_id,
          plan_name: cartData.plan_name,
          payment_type: cartData.payment_type,
          vehicle_type: cartData.vehicle_type,
          step_abandoned: cartData.step_abandoned, // Update to the latest step reached
          // Store extended data in metadata JSON
          cart_metadata: {
            total_price: cartData.total_price,
            voluntary_excess: cartData.voluntary_excess,
            claim_limit: cartData.claim_limit,
            address: cartData.address,
            protection_addons: cartData.protection_addons
          },
          updated_at: new Date().toISOString()
        })
        .eq('id', existingCart[0].id);

      if (updateError) {
        console.error('Error updating abandoned cart:', updateError);
        throw updateError;
      }

      console.log(`Updated existing abandoned cart entry for: ${cartData.email} (step ${existingCart[0].step_abandoned} → ${cartData.step_abandoned})`);
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
            address: cartData.address,
            protection_addons: cartData.protection_addons
          }
        }]);

      if (insertError) {
        console.error('Error inserting abandoned cart:', insertError);
        throw insertError;
      }

      console.log('Created new abandoned cart entry for:', cartData.email);
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