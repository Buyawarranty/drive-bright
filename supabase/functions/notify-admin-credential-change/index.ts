import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.2';
import { Resend } from 'npm:resend@2.0.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const resend = new Resend(Deno.env.get('RESEND_API_KEY'));

interface NotificationRequest {
  adminEmail: string;
  changeType: 'password' | 'email';
  changedAt: string;
}

const logStep = (step: string, details?: any) => {
  console.log(`[NOTIFY-ADMIN-CHANGE] ${step}`, details ? JSON.stringify(details, null, 2) : '');
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep('Starting notification process');
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { 
          status: 401, 
          headers: { 'Content-Type': 'application/json', ...corsHeaders } 
        }
      );
    }

    // Verify the user is authenticated
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);

    if (authError || !user) {
      logStep('Authentication failed', { authError });
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { 
          status: 401, 
          headers: { 'Content-Type': 'application/json', ...corsHeaders } 
        }
      );
    }

    const { adminEmail, changeType, changedAt }: NotificationRequest = await req.json();
    logStep('Request data', { adminEmail, changeType, changedAt });

    if (!adminEmail || !changeType) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: adminEmail, changeType' }),
        { 
          status: 400, 
          headers: { 'Content-Type': 'application/json', ...corsHeaders } 
        }
      );
    }

    // Send notification email to info@buyawarranty.co.uk
    const emailSubject = `Admin Credential Change Alert - ${changeType === 'password' ? 'Password' : 'Email'} Updated`;
    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #f97316; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background-color: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
          .alert-box { background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; }
          .info-row { margin: 10px 0; }
          .label { font-weight: bold; color: #666; }
          .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; text-align: center; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin: 0;">🔐 Admin Credential Change Alert</h1>
          </div>
          <div class="content">
            <div class="alert-box">
              <strong>⚠️ Security Notice:</strong> An admin user has changed their credentials.
            </div>
            
            <h2>Change Details:</h2>
            <div class="info-row">
              <span class="label">Admin Email:</span> ${adminEmail}
            </div>
            <div class="info-row">
              <span class="label">Change Type:</span> ${changeType === 'password' ? 'Password Updated' : 'Email Address Updated'}
            </div>
            <div class="info-row">
              <span class="label">Changed At:</span> ${new Date(changedAt).toLocaleString('en-GB', { 
                timeZone: 'Europe/London',
                dateStyle: 'full',
                timeStyle: 'long'
              })}
            </div>
            
            <p style="margin-top: 20px;">
              If you did not authorize this change or if this activity seems suspicious, please investigate immediately.
            </p>
            
            <div class="footer">
              <p>This is an automated security notification from BuyAWarranty.co.uk Admin System</p>
              <p>© ${new Date().getFullYear()} Buy a Warranty. All rights reserved.</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    const emailText = `
      Admin Credential Change Alert
      
      An admin user has changed their credentials.
      
      Change Details:
      - Admin Email: ${adminEmail}
      - Change Type: ${changeType === 'password' ? 'Password Updated' : 'Email Address Updated'}
      - Changed At: ${new Date(changedAt).toLocaleString('en-GB', { timeZone: 'Europe/London' })}
      
      If you did not authorize this change or if this activity seems suspicious, please investigate immediately.
      
      This is an automated security notification from BuyAWarranty.co.uk Admin System
    `;

    logStep('Sending notification email');
    const emailResponse = await resend.emails.send({
      from: 'BuyAWarranty Admin <support@buyawarranty.co.uk>',
      to: ['info@buyawarranty.co.uk'],
      subject: emailSubject,
      html: emailHtml,
      text: emailText,
    });

    if (emailResponse.error) {
      logStep('Email sending failed', emailResponse.error);
      return new Response(
        JSON.stringify({ error: 'Failed to send notification email', details: emailResponse.error }),
        { 
          status: 500, 
          headers: { 'Content-Type': 'application/json', ...corsHeaders } 
        }
      );
    }

    logStep('Notification email sent successfully', { emailId: emailResponse.data?.id });

    // Log the notification in email_logs table
    await supabaseClient
      .from('email_logs')
      .insert({
        recipient_email: 'info@buyawarranty.co.uk',
        subject: emailSubject,
        content: emailHtml,
        status: 'sent',
        delivery_status: 'sent',
        metadata: {
          admin_email: adminEmail,
          change_type: changeType,
          changed_at: changedAt
        }
      });

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Notification sent successfully',
        emailId: emailResponse.data?.id
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      }
    );

  } catch (error) {
    logStep('Unexpected error', error);
    console.error('Error in notify-admin-credential-change function:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { 
        status: 500, 
        headers: { 'Content-Type': 'application/json', ...corsHeaders } 
      }
    );
  }
});
