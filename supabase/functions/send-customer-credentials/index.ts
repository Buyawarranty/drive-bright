import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    
    if (!RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY not configured');
    }

    const { email, password, customerName } = await req.json();

    if (!email || !password) {
      return new Response(
        JSON.stringify({ success: false, error: 'Email and password are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[SEND-CREDENTIALS] Sending credentials to:', email);

    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Dashboard Login Details</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 0;">
        <table role="presentation" style="width: 600px; max-width: 100%; border-collapse: collapse; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 30px 40px; background-color: #1a365d; border-radius: 8px 8px 0 0;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px;">Buy A Warranty</h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 20px 0; color: #333333; font-size: 22px;">Your Dashboard Login Details</h2>
              
              <p style="margin: 0 0 20px 0; color: #666666; font-size: 16px; line-height: 1.5;">
                Hello ${customerName || 'Customer'},
              </p>
              
              <p style="margin: 0 0 20px 0; color: #666666; font-size: 16px; line-height: 1.5;">
                As requested, here are your login details for your customer dashboard where you can view your warranty information:
              </p>
              
              <!-- Credentials Box -->
              <div style="background-color: #f8f9fa; border: 1px solid #e9ecef; border-radius: 8px; padding: 24px; margin: 24px 0;">
                <table role="presentation" style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 8px 0;">
                      <strong style="color: #333;">Email:</strong>
                      <span style="color: #1a365d; font-family: monospace; margin-left: 10px;">${email}</span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0;">
                      <strong style="color: #333;">Password:</strong>
                      <span style="color: #1a365d; font-family: monospace; font-size: 18px; margin-left: 10px; background-color: #e8f4f8; padding: 4px 12px; border-radius: 4px;">${password}</span>
                    </td>
                  </tr>
                </table>
              </div>
              
              <!-- Login Button -->
              <div style="text-align: center; margin: 32px 0;">
                <a href="https://buyawarranty.co.uk/customer-dashboard/" style="display: inline-block; background-color: #e07a3a; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 6px; font-size: 16px; font-weight: bold;">
                  Log In to Your Dashboard
                </a>
              </div>
              
              <p style="margin: 20px 0 0 0; color: #666666; font-size: 14px; line-height: 1.5;">
                If you didn't request this email or have any questions, please contact our support team.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 24px 40px; background-color: #f8f9fa; border-radius: 0 0 8px 8px; border-top: 1px solid #e9ecef;">
              <p style="margin: 0; color: #999999; font-size: 12px; text-align: center;">
                Buy A Warranty Ltd | support@buyawarranty.co.uk | 0800 093 4456
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Buy A Warranty <noreply@buyawarranty.co.uk>',
        to: [email],
        subject: 'Your Buy A Warranty Dashboard Login Details',
        html: emailHtml,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('[SEND-CREDENTIALS] Resend API error:', result);
      throw new Error(result.message || 'Failed to send email');
    }

    console.log('[SEND-CREDENTIALS] Email sent successfully:', result.id);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Credentials email sent successfully',
        emailId: result.id
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    console.error('[SEND-CREDENTIALS] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
