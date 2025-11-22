import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Starting return discount reminder scheduling...");

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get all customers who made their first purchase 9 or 29 days ago
    const now = new Date();
    const nineDaysAgo = new Date(now);
    nineDaysAgo.setDate(nineDaysAgo.getDate() - 9);
    const twentyNineDaysAgo = new Date(now);
    twentyNineDaysAgo.setDate(twentyNineDaysAgo.getDate() - 29);

    // Format dates for SQL comparison (YYYY-MM-DD)
    const nineDaysAgoStr = nineDaysAgo.toISOString().split('T')[0];
    const twentyNineDaysAgoStr = twentyNineDaysAgo.toISOString().split('T')[0];

    console.log('Checking for customers at day 21 and day 29:', { nineDaysAgoStr, twentyNineDaysAgoStr });

    // Get customers with policies created 9 days ago (Day 21 reminder) or 29 days ago (Final reminder)
    const { data: eligiblePolicies, error: policiesError } = await supabase
      .from('customer_policies')
      .select('email, customer_full_name, policy_start_date, customers(first_name, last_name)')
      .or(`policy_start_date.eq.${nineDaysAgoStr},policy_start_date.eq.${twentyNineDaysAgoStr}`)
      .order('policy_start_date', { ascending: false });

    if (policiesError) {
      console.error('Error fetching eligible policies:', policiesError);
      throw policiesError;
    }

    console.log(`Found ${eligiblePolicies?.length || 0} eligible policies`);

    if (!eligiblePolicies || eligiblePolicies.length === 0) {
      return new Response(
        JSON.stringify({ message: "No eligible customers found", count: 0 }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Group by email to avoid sending multiple reminders
    const emailMap = new Map<string, { 
      email: string; 
      name: string; 
      policyDate: string;
      reminderType: 'urgency' | 'final';
    }>();

    for (const policy of eligiblePolicies) {
      if (!emailMap.has(policy.email)) {
        const policyDate = new Date(policy.policy_start_date);
        const daysSince = Math.floor((now.getTime() - policyDate.getTime()) / (1000 * 60 * 60 * 24));
        
        const reminderType = daysSince >= 28 ? 'final' : 'urgency';
        const customerName = policy.customer_full_name || 
                           (policy.customers?.[0]?.first_name || '') + ' ' + (policy.customers?.[0]?.last_name || '') ||
                           'Valued Customer';

        emailMap.set(policy.email, {
          email: policy.email,
          name: customerName.trim(),
          policyDate: policy.policy_start_date,
          reminderType
        });
      }
    }

    console.log(`Sending reminders to ${emailMap.size} unique customers`);

    // Send reminders
    const results = [];
    for (const [email, customerInfo] of emailMap) {
      try {
        // Check if we've already sent this reminder
        const { data: existingReminder } = await supabase
          .from('email_logs')
          .select('id')
          .eq('recipient_email', email)
          .eq('subject', customerInfo.reminderType === 'urgency' 
            ? 'Only 9 days left to save 20%' 
            : 'Final chance: 20% off ends tomorrow')
          .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // Last 24 hours
          .limit(1);

        if (existingReminder && existingReminder.length > 0) {
          console.log(`Skipping ${email} - reminder already sent in last 24h`);
          continue;
        }

        // Get or create discount code
        let discountCode = `RETURN20-${Date.now().toString(36).toUpperCase()}`;
        
        // Check if customer already has a return discount code
        const { data: existingCode } = await supabase
          .from('discount_codes')
          .select('code')
          .eq('campaign_source', 'return_customer')
          .like('code', `RETURN20-%`)
          .eq('active', true)
          .order('created_at', { ascending: false })
          .limit(1);

        if (existingCode && existingCode.length > 0) {
          discountCode = existingCode[0].code;
        }

        const daysRemaining = customerInfo.reminderType === 'urgency' ? 9 : 1;

        // Call the send reminder function
        const { error: sendError } = await supabase.functions.invoke('send-return-discount-reminder', {
          body: {
            email,
            customerName: customerInfo.name,
            discountCode,
            daysRemaining,
            reminderType: customerInfo.reminderType
          }
        });

        if (sendError) {
          console.error(`Error sending reminder to ${email}:`, sendError);
          results.push({ email, success: false, error: sendError.message });
        } else {
          console.log(`✓ Sent ${customerInfo.reminderType} reminder to ${email}`);
          results.push({ email, success: true, reminderType: customerInfo.reminderType });
        }
      } catch (error: any) {
        console.error(`Error processing ${email}:`, error);
        results.push({ email, success: false, error: error.message });
      }
    }

    const successCount = results.filter(r => r.success).length;

    return new Response(
      JSON.stringify({
        message: `Sent ${successCount} out of ${results.length} reminders`,
        results,
        totalEligible: emailMap.size
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in schedule-return-discount-reminders:", error);
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
