import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    const newEmail = 'info@buyawarranty.co.uk';
    const newPassword = 'Poland333!';

    console.log('Looking for existing admin user...');

    // Find existing admin user (could be admin@example.com or any user with admin role)
    const { data: existingUsers, error: searchError } = await supabase.auth.admin.listUsers();
    
    if (searchError) {
      console.error('Error listing users:', searchError);
      throw searchError;
    }

    // Find user with admin@example.com or check for existing admin role
    let adminUserId: string | null = null;
    const oldAdminUser = existingUsers.users.find(u => u.email === 'admin@example.com');
    
    if (oldAdminUser) {
      adminUserId = oldAdminUser.id;
      console.log('Found admin@example.com user:', adminUserId);
    } else {
      // Check if info@buyawarranty.co.uk already exists
      const newAdminUser = existingUsers.users.find(u => u.email === newEmail);
      if (newAdminUser) {
        adminUserId = newAdminUser.id;
        console.log('Found existing info@buyawarranty.co.uk user:', adminUserId);
      }
    }

    if (adminUserId) {
      // Update existing user
      console.log('Updating existing admin user...');
      
      const { data: updateData, error: updateError } = await supabase.auth.admin.updateUserById(
        adminUserId,
        {
          email: newEmail,
          password: newPassword,
          email_confirm: true,
          user_metadata: {
            first_name: 'Admin',
            last_name: 'User'
          }
        }
      );

      if (updateError) {
        console.error('Error updating user:', updateError);
        throw updateError;
      }

      console.log('Admin user updated successfully');

      // Ensure admin role exists
      const { error: roleError } = await supabase
        .from('user_roles')
        .upsert({ 
          user_id: adminUserId, 
          role: 'admin' 
        }, { 
          onConflict: 'user_id,role' 
        });

      if (roleError) {
        console.error('Error setting admin role:', roleError);
      }

      // Ensure admin_users record exists
      const { error: adminUserError } = await supabase
        .from('admin_users')
        .upsert({
          user_id: adminUserId,
          email: newEmail,
          first_name: 'Admin',
          last_name: 'User',
          role: 'admin',
          is_active: true
        }, {
          onConflict: 'user_id'
        });

      if (adminUserError) {
        console.error('Error updating admin_users:', adminUserError);
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Admin credentials updated successfully',
          userId: adminUserId,
          email: newEmail
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      // Create new admin user
      console.log('Creating new admin user...');
      
      const { data: createData, error: createError } = await supabase.auth.admin.createUser({
        email: newEmail,
        password: newPassword,
        email_confirm: true,
        user_metadata: {
          first_name: 'Admin',
          last_name: 'User'
        }
      });

      if (createError) {
        console.error('Error creating user:', createError);
        throw createError;
      }

      const newUserId = createData.user.id;
      console.log('New admin user created:', newUserId);

      // Add admin role
      await supabase
        .from('user_roles')
        .insert({ 
          user_id: newUserId, 
          role: 'admin' 
        });

      // Add to admin_users
      await supabase
        .from('admin_users')
        .insert({
          user_id: newUserId,
          email: newEmail,
          first_name: 'Admin',
          last_name: 'User',
          role: 'admin',
          is_active: true
        });

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'New admin user created successfully',
          userId: newUserId,
          email: newEmail
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  } catch (error: any) {
    console.error('Error in update-admin-credentials:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
