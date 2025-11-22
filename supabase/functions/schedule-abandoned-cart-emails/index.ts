import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

    console.log('Processing abandoned cart emails...');

    // Get abandoned carts that need emails sent (exclude converted carts)
    const { data: abandonedCarts, error: cartsError } = await supabase
      .from('abandoned_carts')
      .select('*')
      .eq('is_converted', false) // Only get unconverted carts
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // Last 24 hours
      .order('created_at', { ascending: false });

    if (cartsError) {
      console.error('Error fetching abandoned carts:', cartsError);
      throw cartsError;
    }

    if (!abandonedCarts || abandonedCarts.length === 0) {
      console.log('No abandoned carts found');
      return new Response(JSON.stringify({ 
        success: true, 
        message: "No abandoned carts to process" 
      }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    console.log(`Found ${abandonedCarts.length} abandoned carts to process`);

    let emailsSent = 0;
    let errorsCount = 0;

    // Process each abandoned cart
    for (const cart of abandonedCarts) {
      try {
        // Skip if email is not valid (might be a vehicle reg used as identifier)
        if (!cart.email || !cart.email.includes('@')) {
          console.log(`Skipping cart ${cart.id} - invalid email format:`, cart.email);
          continue;
        }
        
        // Check if ANY email has already been sent for this cart
        const { data: anyExistingEmails, error: checkAnyError } = await supabase
          .from('triggered_emails_log')
          .select('*')
          .eq('cart_id', cart.id)
          .limit(1);

        if (checkAnyError) {
          console.error('Error checking existing emails:', checkAnyError);
          continue;
        }

        if (anyExistingEmails && anyExistingEmails.length > 0) {
          console.log(`Email already sent for cart ${cart.id}, skipping all triggers for this cart`);
          continue;
        }

        // Determine trigger type based on step - send only ONE email per cart
        let triggerType: 'pricing_page_view' | 'plan_selected' | 'pricing_page_view_24h' | 'pricing_page_view_72h' | null = null;
        
        if (cart.step_abandoned === 3) {
          triggerType = 'pricing_page_view';
        } else if (cart.step_abandoned === 4) {
          triggerType = 'plan_selected';
        } else {
          continue; // Skip if not a step we want to send emails for
        }

        // Process only the single trigger type for this cart
        try {
          // Get the template to check delay time
          const { data: template, error: templateError } = await supabase
            .from('abandoned_cart_email_templates')
            .select('send_delay_minutes')
            .eq('trigger_type', triggerType)
            .eq('is_active', true)
            .single();

          if (templateError || !template) {
            console.log(`No template found for trigger type: ${triggerType}`);
            continue;
          }

          // Check if enough time has passed since cart was abandoned
          const cartTime = new Date(cart.created_at).getTime();
          const delayMs = template.send_delay_minutes * 60 * 1000;
          const shouldSendAt = cartTime + delayMs;
          
          if (Date.now() < shouldSendAt) {
            console.log(`Not yet time to send ${triggerType} email for cart ${cart.id}`);
            continue;
          }

            // Send the email
            const emailPayload = {
              cartId: cart.id, // Include cart ID to track individual carts
              email: cart.email,
              firstName: cart.full_name?.split(' ')[0] || 'there',
              lastName: cart.full_name?.split(' ').slice(1).join(' ') || '', // Get last name from full name
              phone: cart.phone || '',
              vehicleReg: cart.vehicle_reg,
              vehicleMake: cart.vehicle_make,
              vehicleModel: cart.vehicle_model,
              vehicleYear: cart.vehicle_year || '',
              vehicleType: cart.vehicle_type, // Include vehicle type for special vehicles
              mileage: cart.mileage || '0',
              fuelType: '', // Not stored in abandoned carts, will be empty
              transmission: '', // Not stored in abandoned carts, will be empty
              triggerType,
              planName: cart.plan_name,
              paymentType: cart.payment_type
            };

            console.log('Sending abandoned cart email for:', emailPayload);

            const emailResponse = await supabase.functions.invoke('send-abandoned-cart-email', {
              body: emailPayload
            });

          if (emailResponse.error) {
            console.error('Error sending email:', emailResponse.error);
            errorsCount++;
          } else {
            console.log('Email sent successfully for cart:', cart.id);
            emailsSent++;
          }
        } catch (innerError) {
          console.error('Error processing cart:', cart.id, innerError);
          errorsCount++;
        }

      } catch (error) {
        console.error('Error processing cart:', cart.id, error);
        errorsCount++;
      }
    }

    return new Response(JSON.stringify({
      success: true,
      message: `Processed ${abandonedCarts.length} abandoned carts`,
      emailsSent,
      errors: errorsCount
    }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });

  } catch (error: any) {
    console.error("Error in schedule-abandoned-cart-emails function:", error);
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