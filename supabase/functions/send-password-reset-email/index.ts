import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.2'
import { Resend } from "https://esm.sh/resend@4.0.0";
import { resolveBrand, brandFrom } from "../_shared/brand.ts";

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

    const body: ResetPasswordRequest & { brand?: string } = await req.json();
    const { email } = body;
    const brand = resolveBrand(req, { brand: body?.brand });

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

    // Check if user exists (paginate — the account may not be on the first page)
    const normalizedEmail = String(email).trim().toLowerCase();
    let user: { email?: string | null } | undefined;
    for (let page = 1; page <= 20; page++) {
      const { data: users, error: findError } = await supabaseClient.auth.admin.listUsers({
        page,
        perPage: 1000
      });

      if (findError) {
        logStep('Error finding users', findError);
        throw findError;
      }

      user = users.users.find(u => (u.email || '').toLowerCase() === normalizedEmail);
      if (user || users.users.length < 1000) break;
    }

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
        redirectTo: `${brand.siteUrl}/reset-password`
      }
    });

    if (resetError) {
      logStep('Error generating reset link', resetError);
      throw resetError;
    }

    logStep('Generated reset link successfully', { hasHashedToken: !!resetData?.properties?.hashed_token });

    // Build a link directly to our reset-password page using the hashed_token,
    // instead of sending Supabase's own action_link (which points at
    // /auth/v1/verify on the Supabase domain).
    //
    // Why this matters: /auth/v1/verify is a plain GET endpoint that consumes
    // the (single-use) recovery token on its FIRST hit — including a hit from
    // an email provider's automated "safe links" scanner, which prefetches
    // every link in an email before the customer ever opens it. Production
    // auth logs showed this happening on essentially every reset request: the
    // scanner's GET to /verify succeeds and burns the token, then the
    // customer's own click gets back "One-time token not found" / "Email
    // link is invalid or has expired" — the reset link simply never works.
    //
    // Our own link only consumes the token when our /reset-password page
    // calls verifyOtp() client-side, which a non-JS prefetch never triggers.
    const siteUrl = brand.siteUrl.replace('https://www.', 'https://');
    const hashedToken = resetData?.properties?.hashed_token;
    const resetLink = hashedToken
      ? `${siteUrl}/reset-password?token_hash=${encodeURIComponent(hashedToken)}&type=recovery`
      : resetData?.properties?.action_link || `${siteUrl}/reset-password`;

    // Send branded email
    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Reset Your Password - ${brand.name}</title>
      </head>
      <body style="margin: 0; padding: 0; background-color: #f8f9fa; font-family: Arial, sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8f9fa; padding: 20px 0;">
          <tr>
            <td align="center">
              <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); overflow: hidden;">

                <!-- Header -->
                <tr>
                  <td style="background: ${brand.accentColor}; padding: 30px; text-align: center;">
                    <img src="${brand.logoUrl}" alt="${brand.name}" style="height: 60px; width: auto;">
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
                      We received a request to reset the password for your ${brand.name} customer portal account associated with <strong>${email}</strong>.
                    </p>

                    <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">
                      To reset your password, please click the button below. This link will expire in 24 hours for your security.
                    </p>

                    <!-- Reset Button -->
                    <div style="text-align: center; margin: 30px 0;">
                      <a href="${resetLink}"
                         style="display: inline-block; background: ${brand.accentColor}; color: #ffffff; text-decoration: none; padding: 16px 32px; border-radius: 6px; font-weight: 600; font-size: 16px;">
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
                    <p style="color: #2563eb; font-size: 18px; font-weight: 600; margin: 0 0 8px 0;">${brand.domain}</p>
                    <p style="color: #6b7280; font-size: 14px; margin: 0 0 15px 0;">Your trusted warranty partner</p>

                    <div style="color: #6b7280; font-size: 13px; line-height: 1.6;">
                      <div style="margin-bottom: 5px;">
                        <strong>Claims line:</strong> ${brand.claimsPhone} | ${brand.claimsEmail}
                      </div>
                      <div>
                        <strong>Customer support:</strong> ${brand.quotePhone} | ${brand.supportEmail}
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
        from: brandFrom(brand, 'Customer Care', 'noreply'),
        to: [email],
        subject: `Reset Your ${brand.name} Portal Password`,
        html: emailHtml,
      });

      logStep('Password reset email sent successfully', { email });
    } catch (emailError) {
      logStep('Error sending email', emailError);
      throw new Error('Unable to send password reset email');
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
    const message = error instanceof Error ? error.message : String(error);
    logStep('Password reset email error', { message });
    return new Response(
      JSON.stringify({
        success: false,
        error: message || 'Internal server error'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
