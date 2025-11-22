import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import Stripe from "https://esm.sh/stripe@14.21.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const timestamp = new Date().toISOString();
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[RECONCILE-ORDERS] ${timestamp} ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Starting order reconciliation");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
      apiVersion: "2023-10-16",
    });

    const results: {
      stripeResults: any;
      bumperResults: any;
      missingOrders: any[];
      processedOrders: any[];
      errors: string[];
      summary?: any;
    } = {
      stripeResults: {},
      bumperResults: {},
      missingOrders: [],
      processedOrders: [],
      errors: []
    };

    // Get recent orders from our database (last 14 days to cast a wider net)
    const since = new Date();
    since.setDate(since.getDate() - 14);

    logStep("Fetching existing orders from database", { since: since.toISOString() });

    const { data: existingCustomers, error: dbError } = await supabaseClient
      .from('customers')
      .select('*')
      .gte('created_at', since.toISOString());

    if (dbError) {
      logStep("Database query error", { error: dbError });
      const errorMessage = dbError instanceof Error ? dbError.message : String(dbError);
      results.errors.push(`Database error: ${errorMessage}`);
    }

    const existingEmails = new Set(existingCustomers?.map(c => c.email) || []);
    const existingStripeIds = new Set(existingCustomers?.map(c => c.stripe_session_id).filter(Boolean) || []);
    const existingBumperIds = new Set(existingCustomers?.map(c => c.bumper_order_id).filter(Boolean) || []);

    logStep("Existing database records", { 
      customerCount: existingCustomers?.length || 0,
      emails: existingEmails.size,
      stripeIds: existingStripeIds.size,
      bumperIds: existingBumperIds.size
    });

    // Check Stripe for recent completed sessions
    try {
      logStep("Querying Stripe API for recent sessions");
      
      const stripeSessions = await stripe.checkout.sessions.list({
        created: { gte: Math.floor(since.getTime() / 1000) },
        status: 'complete',
        limit: 100,
        expand: ['data.customer', 'data.line_items']
      });

      logStep("Stripe sessions retrieved", { count: stripeSessions.data.length });

      const missingStripeSessions = stripeSessions.data.filter((session: any) => 
        session.customer_details?.email && 
        !existingStripeIds.has(session.id) &&
        !existingEmails.has(session.customer_details.email)
      );

      results.stripeResults = {
        totalSessions: stripeSessions.data.length,
        missingSessions: missingStripeSessions.length,
        missingSessionIds: missingStripeSessions.map((s: any) => ({
          id: s.id,
          email: s.customer_details?.email,
          amount: s.amount_total,
          created: new Date(s.created * 1000).toISOString()
        }))
      };

      logStep("Stripe analysis complete", results.stripeResults);

    } catch (stripeError) {
      const errorMessage = stripeError instanceof Error ? stripeError.message : String(stripeError);
      logStep("Stripe API error", { error: errorMessage });
      results.errors.push(`Stripe error: ${errorMessage}`);
    }

    // Check Bumper API for recent applications
    try {
      logStep("Querying Bumper API for recent applications");
      
      const bumperApiKey = Deno.env.get("BUMPER_API_KEY");
      const bumperSecretKey = Deno.env.get("BUMPER_SECRET_KEY");

      if (!bumperApiKey || !bumperSecretKey) {
        throw new Error("Bumper API credentials not configured");
      }

      // Note: Bumper doesn't have a standard "list applications" endpoint
      // This would need to be implemented based on Bumper's actual API
      // For now, we'll create a placeholder structure
      
      results.bumperResults = {
        note: "Bumper API reconciliation requires custom implementation based on their API endpoints",
        suggestion: "Check Bumper dashboard manually for recent applications",
        missingApplications: []
      };

      logStep("Bumper reconciliation noted", results.bumperResults);

    } catch (bumperError) {
      const errorMessage = bumperError instanceof Error ? bumperError.message : String(bumperError);
      logStep("Bumper API error", { error: errorMessage });
      results.errors.push(`Bumper error: ${errorMessage}`);
    }

    // Summary
    results.summary = {
      totalExistingCustomers: existingCustomers?.length || 0,
      potentialMissingStripeOrders: (results.stripeResults as any).missingSessions || 0,
      potentialMissingBumperOrders: 0, // Would be populated with real Bumper API
      totalErrors: results.errors.length,
      lastChecked: new Date().toISOString()
    };

    logStep("Reconciliation complete", results.summary);

    return new Response(JSON.stringify({
      success: true,
      results
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in reconciliation", { message: errorMessage });
    
    return new Response(JSON.stringify({ 
      success: false, 
      error: errorMessage 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});