import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const generateRandomPassword = (): string => {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let password = '';
  for (let i = 0; i < 12; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[RESET-ADMIN-PASSWORD] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    logStep("Function started");

    const { userId, email } = await req.json();
    logStep("Request data", { userId, email });

    if (!userId || !email) {
      throw new Error("User ID and email are required");
    }

    // Verify the user exists in admin_users table
    const { data: adminUser, error: adminError } = await supabaseClient
      .from('admin_users')
      .select('*')
      .eq('id', userId)
      .eq('email', email)
      .single();

    if (adminError || !adminUser) {
      throw new Error(`Admin user not found: ${adminError?.message || 'No admin user data'}`);
    }

    logStep("Admin user found", { 
      email: adminUser.email, 
      name: `${adminUser.first_name} ${adminUser.last_name}`.trim() 
    });

    // Generate new temporary password
    const tempPassword = generateRandomPassword();
    logStep("Generated temporary password");

    // Get user from auth.users to reset password
    const { data: authUsers, error: getUserError } = await supabaseClient.auth.admin.listUsers();
    
    if (getUserError) {
      throw new Error(`Failed to get auth users: ${getUserError.message}`);
    }

    const authUser = authUsers.users.find(u => u.email === email);
    
    if (!authUser) {
      throw new Error(`Auth user not found for email: ${email}`);
    }

    // Update password in Supabase Auth
    const { error: updateError } = await supabaseClient.auth.admin.updateUserById(
      authUser.id,
      { 
        password: tempPassword,
        email_confirm: true // Ensure email is confirmed
      }
    );

    if (updateError) {
      throw new Error(`Failed to update password: ${updateError.message}`);
    }

    logStep("Password updated in auth system");

    // Send email with new credentials
    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Password Reset - Buy A Warranty Admin</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f5f5f5;">
    <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 0;">
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); color: white; padding: 30px 20px; text-align: center;">
            <h1 style="margin: 0; font-size: 28px; font-weight: bold;">🔐 Password Reset</h1>
            <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">Buy A Warranty Admin Dashboard</p>
        </div>

        <!-- Main Content -->
        <div style="padding: 30px 20px;">
            <h2 style="color: #1e40af; margin: 0 0 20px 0; font-size: 22px;">Hello ${adminUser.first_name || 'Admin User'},</h2>
            
            <p style="margin: 0 0 20px 0; font-size: 16px;">
                Your admin dashboard password has been reset. You can now log in using the temporary password below.
            </p>

            <!-- Login Details -->
            <div style="background-color: #f8fafc; border-left: 4px solid #1e40af; padding: 20px; margin: 20px 0; border-radius: 6px;">
                <h3 style="color: #1e40af; margin: 0 0 15px 0; font-size: 18px;">Login Details</h3>
                <div style="font-family: monospace; background-color: white; padding: 15px; border-radius: 4px; border: 1px solid #e2e8f0;">
                    <div style="margin-bottom: 10px;">
                        <strong>Email:</strong> ${email}
                    </div>
                    <div style="margin-bottom: 10px;">
                        <strong>Temporary Password:</strong> <span style="color: #dc2626; font-weight: bold;">${tempPassword}</span>
                    </div>
                    <div>
                        <strong>Dashboard URL:</strong> <a href="https://pricing.buyawarranty.co.uk/admin" style="color: #1e40af;">https://pricing.buyawarranty.co.uk/admin</a>
                    </div>
                </div>
            </div>

            <!-- Security Notice -->
            <div style="background-color: #fef3c7; border: 1px solid #fbbf24; padding: 20px; margin: 20px 0; border-radius: 6px;">
                <h3 style="color: #92400e; margin: 0 0 15px 0; font-size: 18px;">⚠️ Important Security Notice</h3>
                <ul style="color: #92400e; font-size: 14px; margin: 0; padding-left: 20px;">
                    <li>This is a temporary password. Please change it after logging in.</li>
                    <li>Do not share this password with anyone.</li>
                    <li>If you didn't request this reset, please contact an administrator immediately.</li>
                </ul>
            </div>
        </div>

        <!-- Footer -->
        <div style="background-color: #1f2937; color: #d1d5db; padding: 25px 20px; text-align: center;">
            <p style="margin: 0 0 15px 0; font-size: 16px; font-weight: bold;">Kind regards,</p>
            <p style="margin: 0 0 15px 0; font-size: 16px; font-weight: bold;">Buy A Warranty</p>
            <p style="margin: 0 0 15px 0; font-size: 14px;">IT Administration Team</p>
            
            <div style="border-top: 1px solid #374151; padding-top: 15px; margin-top: 20px; font-size: 12px; color: #9ca3af;">
                <p style="margin: 0 0 5px 0;">© Buy A Warranty. All rights reserved.</p>
                <p style="margin: 0;">This is an automated system email.</p>
            </div>
        </div>
    </div>
</body>
</html>`;

    const textVersion = `Password Reset - Buy A Warranty Admin Dashboard

Hello ${adminUser.first_name || 'Admin User'},

Your admin dashboard password has been reset. You can now log in using the temporary password below.

Login Details:
Email: ${email}
Temporary Password: ${tempPassword}
Dashboard URL: https://pricing.buyawarranty.co.uk/admin

IMPORTANT SECURITY NOTICE:
- This is a temporary password. Please change it after logging in.
- Do not share this password with anyone.
- If you didn't request this reset, please contact an administrator immediately.

Kind regards,
Buy A Warranty IT Administration Team`;

    const emailResponse = await resend.emails.send({
      from: "Buy A Warranty <support@buyawarranty.co.uk>",
      to: [email],
      subject: "🔐 Admin Password Reset - Buy A Warranty",
      html: emailHtml,
      text: textVersion,
      headers: {
        'X-Entity-Ref-ID': `admin-password-reset-${userId}`,
        'X-Priority': '1',
        'X-MSMail-Priority': 'High',
        'Importance': 'High',
      },
      tags: [
        { name: 'category', value: 'admin-password-reset' },
        { name: 'user-id', value: userId }
      ]
    });

    logStep("Password reset email sent", { emailId: emailResponse.data?.id });

    // Log the password reset action
    const { error: logError } = await supabaseClient
      .from('email_logs')
      .insert({
        recipient_email: email,
        subject: '🔐 Admin Password Reset - Buy A Warranty',
        status: 'sent',
        metadata: {
          user_id: userId,
          email_type: 'admin_password_reset',
          temp_password_generated: true
        }
      });

    if (logError) {
      console.error('Error logging email:', logError);
    }

    return new Response(JSON.stringify({ 
      success: true, 
      message: "Password reset successfully",
      tempPassword: tempPassword,
      emailSent: true
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in reset-admin-password", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});