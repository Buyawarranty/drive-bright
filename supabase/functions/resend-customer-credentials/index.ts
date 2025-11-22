import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function logStep(step: string, details?: any) {
  const timestamp = new Date().toISOString();
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[RESEND-CREDENTIALS] ${timestamp} ${step}${detailsStr}`);
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { email } = await req.json();

    if (!email) {
      return new Response(
        JSON.stringify({ 
          error: 'Email is required',
          success: false 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    logStep("Resending credentials for", { email });

    // Check if customer exists
    const { data: customer } = await supabase
      .from('customers')
      .select('*')
      .eq('email', email)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!customer) {
      return new Response(
        JSON.stringify({ 
          error: 'No customer found with this email address',
          success: false 
        }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Get the latest welcome email record
    const { data: welcomeEmail } = await supabase
      .from('welcome_emails')
      .select('*')
      .eq('email', email)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!welcomeEmail) {
      return new Response(
        JSON.stringify({ 
          error: 'No login credentials found. Please contact support.',
          success: false 
        }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Get customer policy for context
    const { data: policy } = await supabase
      .from('customer_policies')
      .select('*')
      .eq('customer_id', customer.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    // Prepare email content
    const loginUrl = "https://buyawarranty.co.uk/customer-dashboard";
    const supportEmail = "support@buyawarranty.co.uk";
    
    const emailHtml = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <title>Your Customer Dashboard Login Details</title>
        <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #2563eb; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; background: #f9fafb; }
            .credentials { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #2563eb; }
            .button { display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 10px 0; }
            .footer { padding: 20px; font-size: 12px; color: #666; text-align: center; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>Customer Dashboard Login Details</h1>
            </div>
            <div class="content">
                <h2>Hello ${customer.first_name || 'Customer'},</h2>
                
                <p>Here are your login details to access your warranty customer dashboard:</p>
                
                <div class="credentials">
                    <h3>Login Information:</h3>
                    <p><strong>Website:</strong> <a href="${loginUrl}">${loginUrl}</a></p>
                    <p><strong>Email:</strong> ${email}</p>
                    <p><strong>Password:</strong> <code style="background: #f3f4f6; padding: 4px 8px; border-radius: 4px; font-family: monospace; font-size: 14px;">${welcomeEmail.temporary_password}</code></p>
                </div>
                
                <a href="${loginUrl}" class="button">Access Your Dashboard</a>
                
                <p><strong>What you can do in your dashboard:</strong></p>
                <ul>
                    <li>View your warranty details and coverage</li>
                    <li>Download your policy documents</li>
                    <li>Update your contact information</li>
                </ul>
                
                ${policy ? `
                <p><strong>Your Policy Details:</strong></p>
                <ul>
                    <li>Warranty Number: ${policy.warranty_number}</li>
                    <li>Plan Type: ${policy.plan_type}</li>
                    <li>Vehicle: ${customer.registration_plate}</li>
                </ul>
                ` : ''}
                
                <p><strong>Important:</strong> For security reasons, we recommend changing your password after your first login.</p>
                
                <p>If you continue to experience login issues, please contact our support team at <a href="mailto:${supportEmail}">${supportEmail}</a>.</p>
            </div>
            <div class="footer">
                <p>© 2025 Buy-A-Warranty. All rights reserved.</p>
                <p>This email was sent because you requested your login credentials.</p>
            </div>
        </div>
    </body>
    </html>
    `;

    // Send email using Resend
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    
    if (!resendApiKey) {
      throw new Error('RESEND_API_KEY not configured');
    }

    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Buy-A-Warranty <noreply@buyawarranty.co.uk>',
        to: [email],
        subject: 'Your Customer Dashboard Login Details',
        html: emailHtml,
      }),
    });

    if (!emailResponse.ok) {
      const errorText = await emailResponse.text();
      throw new Error(`Failed to send email: ${errorText}`);
    }

    const emailResult = await emailResponse.json();
    logStep("Login credentials email sent successfully", { emailId: emailResult.id });

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Login credentials have been sent to your email address',
        loginUrl,
        email: email
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in resend-customer-credentials", { message: errorMessage });
    return new Response(
      JSON.stringify({ 
        error: 'Failed to resend login credentials. Please contact support.',
        success: false 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});