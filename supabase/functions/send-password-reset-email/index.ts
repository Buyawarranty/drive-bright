import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.2'
import { Resend } from "https://esm.sh/resend@4.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ResetPasswordRequest {
  email: string;
}

const resend = new Resend(Deno.env.get('RESEND_API_KEY') as string);

const logStep = (step: string, details?: any) => {
  console.log(`[PASSWORD RESET EMAIL] ${step}`, details ? JSON.stringify(details, null, 2) : '');
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

    const { email }: ResetPasswordRequest = await req.json();
    
    logStep('Password reset email request received', { email });

    if (!email) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Email is required' 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Check if user exists
    const { data: users, error: findError } = await supabaseClient.auth.admin.listUsers({
      page: 1,
      perPage: 1000
    });

    if (findError) {
      logStep('Error finding users', findError);
      throw findError;
    }

    const user = users.users.find(u => u.email === email);
    
    if (!user) {
      // Don't reveal whether email exists or not for security
      logStep('User not found, but returning success for security', { email });
      return new Response(
        JSON.stringify({ 
          success: true,
          message: 'If an account with that email exists, a password reset link has been sent.' 
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Generate password reset link using Supabase Auth
    const { data: resetData, error: resetError } = await supabaseClient.auth.admin.generateLink({
      type: 'recovery',
      email: email,
      options: {
        redirectTo: 'https://buyawarranty.co.uk/reset-password'
      }
    });

    if (resetError) {
      logStep('Error generating reset link', resetError);
      throw resetError;
    }

    logStep('Generated reset link successfully', { hasActionLink: !!resetData?.properties?.action_link });

    // Use the generated action link for the reset
    const resetLink = resetData?.properties?.action_link || `https://mzlpuxzwyrcyrgrongeb.supabase.co/auth/v1/recover?email=${encodeURIComponent(email)}&redirect_to=${encodeURIComponent('https://buyawarranty.co.uk/reset-password')}`;
    
    // Send branded email
    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Reset Your Password - Buy-A-Warranty</title>
      </head>
      <body style="margin: 0; padding: 0; background-color: #f8f9fa; font-family: Arial, sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8f9fa; padding: 20px 0;">
          <tr>
            <td align="center">
              <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); overflow: hidden;">
                
                <!-- Header -->
                <tr>
                  <td style="background: linear-gradient(135deg, #2563eb 0%, #f97316 100%); padding: 30px; text-align: center;">
                    <img src="https://buyawarranty.co.uk/lovable-uploads/baw-logo-new-2025.png" alt="Buy-A-Warranty" style="height: 60px; width: auto;">
                  </td>
                </tr>

                <!-- Content -->
                <tr>
                  <td style="padding: 40px 30px;">
                    <h1 style="color: #1f2937; font-size: 28px; margin: 0 0 20px 0; text-align: center;">Password Reset Request</h1>
                    
                    <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                      Hello,
                    </p>
                    
                    <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0 0 25px 0;">
                      We received a request to reset the password for your Buy-A-Warranty customer portal account associated with <strong>${email}</strong>.
                    </p>
                    
                    <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">
                      To reset your password, please click the button below. This link will expire in 24 hours for your security.
                    </p>

                    <!-- Reset Button -->
                    <div style="text-align: center; margin: 30px 0;">
                      <a href="${resetLink}" 
                         style="display: inline-block; background: linear-gradient(135deg, #2563eb 0%, #f97316 100%); color: #ffffff; text-decoration: none; padding: 16px 32px; border-radius: 6px; font-weight: 600; font-size: 16px;">
                        Reset Your Password
                      </a>
                    </div>
                    
                    <p style="color: #6b7280; font-size: 14px; line-height: 1.5; margin: 30px 0 20px 0; border-top: 1px solid #e5e7eb; padding-top: 20px;">
                      If the button doesn't work, you can copy and paste this link into your browser:
                    </p>
                    
                    <p style="color: #6b7280; font-size: 12px; word-break: break-all; background-color: #f3f4f6; padding: 10px; border-radius: 4px;">
                      ${resetLink}
                    </p>
                    
                    <p style="color: #6b7280; font-size: 14px; line-height: 1.5; margin: 20px 0;">
                      If you didn't request this password reset, please ignore this email. Your password will remain unchanged.
                    </p>
                    
                    <p style="color: #6b7280; font-size: 14px; line-height: 1.5; margin: 20px 0 0 0;">
                      If you need assistance, please contact our customer support team.
                    </p>
                  </td>
                </tr>

                <!-- Footer -->
                <tr>
                  <td style="background-color: #f8f9fa; padding: 25px 30px; text-align: center; border-top: 1px solid #e5e7eb;">
                    <p style="color: #2563eb; font-size: 18px; font-weight: 600; margin: 0 0 8px 0;">buyawarranty.co.uk</p>
                    <p style="color: #6b7280; font-size: 14px; margin: 0 0 15px 0;">Your trusted warranty partner</p>
                    
                    <div style="color: #6b7280; font-size: 13px; line-height: 1.6;">
                      <div style="margin-bottom: 5px;">
                        <strong>Claims line:</strong> 0330 229 5045 | claims@buyawarranty.co.uk
                      </div>
                      <div>
                        <strong>Customer support:</strong> 0330 229 5040 | support@buyawarranty.co.uk
                      </div>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    try {
      await resend.emails.send({
        from: 'Buy-A-Warranty <noreply@buyawarranty.co.uk>',
        to: [email],
        subject: 'Reset Your Buy-A-Warranty Portal Password',
        html: emailHtml,
      });

      logStep('Password reset email sent successfully', { email });
    } catch (emailError) {
      logStep('Error sending email', emailError);
      // Continue anyway as the Supabase system might also send an email
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'If an account with that email exists, a password reset link has been sent.'
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    logStep('Password reset email error', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: 'Internal server error' 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});