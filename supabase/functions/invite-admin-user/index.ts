import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const resendApiKey = Deno.env.get('RESEND_API_KEY')!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);
const resend = new Resend(resendApiKey);

interface InviteUserRequest {
  email: string;
  firstName: string;
  lastName: string;
  password?: string;
  role: 'admin' | 'member' | 'viewer' | 'guest' | 'blog_writer' | 'sales';
  permissions: Record<string, boolean>;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, firstName, lastName, password, role, permissions }: InviteUserRequest = await req.json();

    // Generate invitation token and password (use provided password or generate one)
    const invitationToken = crypto.randomUUID();
    const tempPassword = password && password.trim().length >= 6 ? password.trim() : await generatePassword();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    // Get the inviter info
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Try to create user in auth.users
    let userId: string;
    let isExistingUser = false;
    
    const { data: newUser, error: createUserError } = await supabase.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: {
        first_name: firstName,
        last_name: lastName,
        invited_by: user.id
      }
    });

    if (createUserError) {
      // Check if the error is because user already exists
      if (createUserError.message.includes('already been registered')) {
        console.log('User already exists, fetching existing user...');
        
        // Get the existing user by email using per_page limit
        const { data: existingUsers, error: listError } = await supabase.auth.admin.listUsers({
          page: 1,
          perPage: 1000
        });
        
        if (listError) {
          console.error('Error listing users:', listError);
          return new Response(JSON.stringify({ error: 'Failed to find existing user' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        console.log('Total users found:', existingUsers?.users?.length);
        
        const existingUser = existingUsers.users.find(u => u.email?.toLowerCase() === email.toLowerCase());
        
        if (!existingUser) {
          console.error('User not found in list for email:', email);
          return new Response(JSON.stringify({ error: 'User exists but could not be found' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        userId = existingUser.id;
        isExistingUser = true;
        console.log('Found existing user with ID:', userId);
        
        // Update user password so they can login with the temp password
        const { error: updateError } = await supabase.auth.admin.updateUserById(userId, {
          password: tempPassword,
          user_metadata: {
            ...existingUser.user_metadata,
            first_name: firstName,
            last_name: lastName,
            invited_by: user.id
          }
        });
        
        if (updateError) {
          console.error('Error updating existing user:', updateError);
          return new Response(JSON.stringify({ error: 'Failed to update user: ' + updateError.message }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        console.log('Successfully updated existing user:', userId);
      } else {
        console.error('User creation failed:', createUserError.message);
        return new Response(JSON.stringify({ error: createUserError.message }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    } else if (newUser?.user) {
      userId = newUser.user.id;
      console.log('Created new user:', userId);
    } else {
      console.error('Failed to create user - no user returned');
      return new Response(JSON.stringify({ error: 'Failed to create user' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Add user to admin_users table (upsert to handle existing admin users)
    const { error: adminUserError } = await supabase
      .from('admin_users')
      .upsert({
        user_id: userId,
        email,
        first_name: firstName,
        last_name: lastName,
        role,
        permissions,
        invited_by: user.id,
        is_active: true
      }, { onConflict: 'user_id' });

    if (adminUserError) {
      console.error('Error creating admin user:', adminUserError);
      // Only cleanup if we created a new user
      if (!isExistingUser) {
        await supabase.auth.admin.deleteUser(userId);
      }
      
      return new Response(JSON.stringify({ error: adminUserError.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Add user role with upsert
    const { error: roleError } = await supabase
      .from('user_roles')
      .upsert({
        user_id: userId,
        role
      }, { onConflict: 'user_id,role' });

    if (roleError) {
      console.error('Error creating user role:', roleError);
    }

    // Store invitation
    const { error: invitationError } = await supabase
      .from('admin_invitations')
      .insert({
        email,
        role,
        permissions,
        invited_by: user.id,
        invitation_token: invitationToken,
        expires_at: expiresAt.toISOString()
      });

    if (invitationError) {
      console.error('Error storing invitation:', invitationError);
    }

    // Send invitation email
    try {
      await resend.emails.send({
        from: 'Buyawarranty Customer Care <noreply@buyawarranty.co.uk>',
        to: [email],
        subject: 'You\'ve been invited to the BuyaWarranty Admin Dashboard',
        html: `
          <h1>Welcome to Buy a Warranty Admin Dashboard</h1>
          <p>Hello ${firstName},</p>
          <p>You've been invited to join the Buy a Warranty admin dashboard with ${role} access.</p>
          
          <div style="background-color: #f5f5f5; padding: 20px; margin: 20px 0; border-radius: 8px;">
            <h3>Your Login Credentials:</h3>
            <p><strong>Email:</strong> ${email}</p>
            <p><strong>Temporary Password:</strong> ${tempPassword}</p>
          </div>
          
          <p>
            <a href="https://buyawarranty.co.uk/auth" 
               style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block; font-weight: bold;">
               Accept Invitation & Access Dashboard
            </a>
          </p>
          
          <p style="margin-top: 16px;">
            Or you can log in directly at: 
            <a href="https://buyawarranty.co.uk/auth" style="color: #007bff;">
              https://buyawarranty.co.uk/auth
            </a>
          </p>
          
          <p><small>This invitation expires in 7 days.</small></p>
          <p><small>Please change your password after your first login.</small></p>
          
          <p>Best regards,<br>The Buy a Warranty Team</p>
        `
      });
    } catch (emailError) {
      console.error('Error sending invitation email:', emailError);
    }

    return new Response(JSON.stringify({ 
      success: true, 
      message: 'User invited successfully',
      tempPassword 
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in invite-admin-user function:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

async function generatePassword(): Promise<string> {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  let password = '';
  for (let i = 0; i < 12; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}