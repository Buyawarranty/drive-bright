// Dealer multi-step checkout: handles "Pay Now" (Stripe) and "Add to Invoice" (direct insert).
// Either path produces a single row in `customers` tagged with dealer_id + purchase_source='dealer'.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import Stripe from 'https://esm.sh/stripe@14.21.0?target=denonext';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface VehiclePayload {
  reg: string;
  make?: string;
  model?: string;
  year?: string;
  mileage?: string;
}

interface CustomerPayload {
  name: string;
  email: string;
  phone: string;
  address_line1: string;
  address_line2?: string;
  town: string;
  postcode: string;
}

interface PlanPayload {
  plan_type: 'basic' | 'gold' | 'platinum';
  duration_months: number;
  retail_price: number;
  dealer_price: number;
}

interface RequestBody {
  dealer_id: string;
  payment_method: 'pay_now' | 'invoice';
  vehicle: VehiclePayload;
  customer: CustomerPayload;
  plan: PlanPayload;
  discount_pct: number;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const STRIPE_KEY = Deno.env.get('STRIPE_SECRET_KEY');

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate the calling user
    const userClient = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body: RequestBody = await req.json();
    const { dealer_id, payment_method, vehicle, customer, plan, discount_pct } = body;

    // Basic validation
    if (!dealer_id || !payment_method || !vehicle?.reg || !customer?.email || !plan?.plan_type) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!['pay_now', 'invoice'].includes(payment_method)) {
      return new Response(JSON.stringify({ error: 'Invalid payment_method' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify dealer belongs to this user
    const adminClient = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: dealer, error: dealerErr } = await adminClient
      .from('dealers')
      .select('id, user_id, company_name, email, name')
      .eq('id', dealer_id)
      .maybeSingle();

    if (dealerErr || !dealer || dealer.user_id !== user.id) {
      return new Response(JSON.stringify({ error: 'Dealer not authorized' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Build the customer row payload (shared by both paths)
    const startDate = new Date();
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + plan.duration_months);

    const customerRow = {
      name: customer.name,
      email: customer.email.toLowerCase().trim(),
      phone: customer.phone,
      first_name: customer.name.split(' ')[0] || customer.name,
      last_name: customer.name.split(' ').slice(1).join(' ') || null,
      street: customer.address_line1,
      building_name: customer.address_line2 || null,
      town: customer.town,
      postcode: customer.postcode.toUpperCase(),
      country: 'United Kingdom',
      registration_plate: vehicle.reg.toUpperCase(),
      vehicle_make: vehicle.make || null,
      vehicle_model: vehicle.model || null,
      vehicle_year: vehicle.year || null,
      mileage: vehicle.mileage ? parseInt(vehicle.mileage, 10) : null,
      plan_type: plan.plan_type,
      payment_type: String(plan.duration_months),
      final_amount: plan.dealer_price,
      original_amount: plan.retail_price,
      discount_amount: +(plan.retail_price - plan.dealer_price).toFixed(2),
      status: payment_method === 'invoice' ? 'active' : 'pending',
      payment_status: payment_method === 'invoice' ? 'invoice_pending' : 'pending',
      purchase_source: 'dealer',
      dealer_id: dealer.id,
      signup_date: startDate.toISOString(),
      warranty_start_date: startDate.toISOString().slice(0, 10),
      policy_end_date: endDate.toISOString().slice(0, 10),
      is_manual_entry: false,
      payment_verified: payment_method === 'invoice', // invoice = trusted; stripe = wait for webhook
    } as Record<string, unknown>;

    // === INVOICE PATH ===
    if (payment_method === 'invoice') {
      const { data: inserted, error: insertErr } = await adminClient
        .from('customers')
        .insert(customerRow)
        .select('id')
        .single();

      if (insertErr) {
        console.error('Invoice insert error', insertErr);
        return new Response(JSON.stringify({ error: insertErr.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ customer_id: inserted.id, method: 'invoice' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // === PAY NOW PATH (Stripe) ===
    if (!STRIPE_KEY) {
      return new Response(
        JSON.stringify({ error: 'Stripe is not configured. Add STRIPE_SECRET_KEY to enable Pay Now.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const stripe = new Stripe(STRIPE_KEY, { apiVersion: '2024-11-20.acacia' });

    // Insert customer row as 'pending' first so we have an id to reference
    const { data: pendingCustomer, error: pendingErr } = await adminClient
      .from('customers')
      .insert(customerRow)
      .select('id')
      .single();

    if (pendingErr) {
      console.error('Pending customer insert error', pendingErr);
      return new Response(JSON.stringify({ error: pendingErr.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const origin = req.headers.get('origin') || 'https://buyawarranty.co.uk';
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      customer_email: dealer.email,
      line_items: [
        {
          price_data: {
            currency: 'gbp',
            product_data: {
              name: `Dealer Warranty · ${plan.plan_type.toUpperCase()} · ${plan.duration_months}mo`,
              description: `${vehicle.reg} for ${customer.name}`,
            },
            unit_amount: Math.round(plan.dealer_price * 100),
          },
          quantity: 1,
        },
      ],
      success_url: `${origin}/dealer-portal/quote/confirmation?id=${pendingCustomer.id}&method=pay_now&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/dealer-portal/quote/checkout`,
      metadata: {
        dealer_id: dealer.id,
        customer_id: pendingCustomer.id,
        plan_type: plan.plan_type,
        plan_id: plan.plan_type, // Required: plan_id = plan_type
        duration_months: String(plan.duration_months),
        purchase_source: 'dealer',
        discount_pct: String(discount_pct),
      },
    });

    return new Response(
      JSON.stringify({
        checkout_url: session.url,
        customer_id: pendingCustomer.id,
        session_id: session.id,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err: any) {
    console.error('dealer-create-checkout error', err);
    return new Response(JSON.stringify({ error: err?.message || 'Internal error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
