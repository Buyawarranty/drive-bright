import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

interface ResendInviteRequest {
  userId: string;
  email: string;
}

function generateRandomPassword(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let password = '';
  for (let i = 0; i < 12; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { userId, email }: ResendInviteRequest = await req.json();

    // Get user details from admin_users table
    const { data: adminUser, error: fetchError } = await supabaseClient
      .from('admin_users')
      .select('*')
      .eq('id', userId)
      .single();

    if (fetchError || !adminUser) {
      throw new Error('Admin user not found');
    }

    // Generate new temporary password
    const tempPassword = generateRandomPassword();

    // Update user password in Supabase Auth
    const { data: authUsers, error: listError } = await supabaseClient.auth.admin.listUsers();
    if (listError) throw listError;

    const authUser = authUsers.users.find(u => u.email === email);
    if (!authUser) {
      throw new Error('User not found in auth system');
    }

    const { error: passwordError } = await supabaseClient.auth.admin.updateUserById(
      authUser.id,
      { password: tempPassword }
    );

    if (passwordError) throw passwordError;

    // Create invitation link
    const invitationLink = `https://pricing.buyawarranty.co.uk/auth`;

    // Send invitation email
    const emailResult = await resend.emails.send({
      from: "Buy A Warranty Admin <support@buyawarranty.co.uk>",
      to: [email],
      subject: "Admin Account Invitation Resent - Buy A Warranty",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
          <div style="background-color: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <h1 style="color: #333; margin-bottom: 20px;">Admin Account Invitation Resent</h1>
            
            <p style="color: #666; margin-bottom: 20px;">Hello ${adminUser.first_name || ''},</p>
            
            <p style="color: #666; margin-bottom: 20px;">
              Your admin account invitation has been resent. You can now access the Buy A Warranty admin dashboard.
            </p>
            
            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 6px; margin: 20px 0;">
              <h3 style="color: #333; margin-top: 0;">Login Credentials:</h3>
              <p style="margin: 5px 0;"><strong>Email:</strong> ${email}</p>
              <p style="margin: 5px 0;"><strong>Temporary Password:</strong> <code style="background-color: #e9ecef; padding: 2px 6px; border-radius: 4px;">${tempPassword}</code></p>
            </div>
            
            <div style="margin: 30px 0;">
              <a href="${invitationLink}" 
                 style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
                Access Admin Dashboard
              </a>
            </div>
            
            <p style="color: #666; font-size: 14px; margin-top: 20px;">
              Or you can log in directly at: 
              <a href="${invitationLink}" style="color: #007bff;">${invitationLink}</a>
            </p>
            
            <p style="color: #666; font-size: 14px; margin-top: 30px;">
              Please change your password after your first login for security purposes.
            </p>
            
            <p style="color: #666; font-size: 14px; margin-top: 20px;">
              If you have any questions, please contact support at info@buyawarranty.co.uk
            </p>
          </div>
        </div>
      `,
      text: `
        Admin Account Invitation Resent - Buy A Warranty
        
        Hello ${adminUser.first_name || ''},
        
        Your admin account invitation has been resent. You can now access the Buy A Warranty admin dashboard.
        
        Login Credentials:
        Email: ${email}
        Temporary Password: ${tempPassword}
        
        Access the admin dashboard at: ${invitationLink}
        
        Please change your password after your first login for security purposes.
        
        If you have any questions, please contact support at info@buyawarranty.co.uk
      `
    });

    // Log the email
    await supabaseClient
      .from('email_logs')
      .insert({
        recipient_email: email,
        subject: 'Admin Account Invitation Resent - Buy A Warranty',
        status: 'sent',
        metadata: { 
          resend_message_id: emailResult.data?.id,
          user_id: userId,
          action: 'resend_invite'
        }
      });

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Invitation resent successfully',
        tempPassword: tempPassword
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );

  } catch (error: any) {
    console.error("Error resending invitation:", error);
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