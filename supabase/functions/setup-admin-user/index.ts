import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SetupAdminRequest {
  email: string;
  password: string;
}

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
    const { email, password } = await req.json() as SetupAdminRequest;

    if (!email || !password) {
      throw new Error("Email and password are required");
    }

    console.log(`Setting up admin user for: ${email}`);

    // Find the auth user
    const { data: { users }, error: listError } = await supabaseClient.auth.admin.listUsers();
    
    if (listError) {
      console.error("Error listing users:", listError);
      throw new Error(`Failed to list users: ${listError.message}`);
    }

    let authUser = users?.find(u => u.email === email);

    // If auth user doesn't exist, create it
    if (!authUser) {
      console.log("Creating new auth user...");
      const { data: authData, error: authError } = await supabaseClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          name: "Admin User"
        }
      });

      if (authError) {
        console.error("Auth creation error:", authError);
        throw new Error(`Failed to create auth user: ${authError.message}`);
      }

      if (!authData.user) {
        throw new Error("Failed to create user - no user data returned");
      }

      authUser = authData.user;
      console.log("Auth user created:", authUser.id);
    } else {
      // User exists, update password
      console.log("Updating password for existing user...");
      const { error: updateError } = await supabaseClient.auth.admin.updateUserById(
        authUser.id,
        { password }
      );

      if (updateError) {
        console.error("Password update error:", updateError);
        throw new Error(`Failed to update password: ${updateError.message}`);
      }
      console.log("Password updated successfully");
    }

    // Check if admin_users record exists
    const { data: adminData, error: adminCheckError } = await supabaseClient
      .from('admin_users')
      .select('id')
      .eq('user_id', authUser.id)
      .maybeSingle();

    if (adminCheckError && adminCheckError.code !== 'PGRST116') {
      console.error("Error checking admin_users:", adminCheckError);
      throw new Error(`Failed to check admin record: ${adminCheckError.message}`);
    }

    // Create admin_users record if it doesn't exist
    if (!adminData) {
      console.log("Creating admin_users record...");
      const { error: insertAdminError } = await supabaseClient
        .from('admin_users')
        .insert({
          user_id: authUser.id,
          email: email,
          first_name: "Admin",
          last_name: "User",
          role: "admin",
          is_active: true,
          permissions: {
            view_customers: true,
            manage_plans: true,
            view_analytics: true,
            manage_emails: true,
            manage_users: true,
            manage_documents: true,
            manage_pricing: true,
            manage_special_vehicles: true
          }
        });

      if (insertAdminError) {
        console.error("Admin user creation error:", insertAdminError);
        throw new Error(`Failed to create admin record: ${insertAdminError.message}`);
      }
      console.log("Admin record created");
    }

    // Create user_roles record if it doesn't exist
    const { error: roleError } = await supabaseClient
      .from('user_roles')
      .insert({
        user_id: authUser.id,
        role: "admin"
      });

    if (roleError && roleError.code !== '23505') { // Ignore duplicate key errors
      console.error("Role creation error:", roleError);
      throw new Error(`Failed to create role: ${roleError.message}`);
    }

    console.log("Admin user setup completed successfully");

    return new Response(JSON.stringify({
      success: true,
      message: "Admin user setup completed successfully",
      userId: authUser.id
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    console.error('Error setting up admin user:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Failed to setup admin user",
      details: error
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
