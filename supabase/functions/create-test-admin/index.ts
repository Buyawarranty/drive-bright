import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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
    const testEmail = "admin@test.com";
    const testPassword = "admin123";

    console.log("Creating test admin user...");

    // First, delete any existing user with this email
    const { data: existingUsers } = await supabaseClient.auth.admin.listUsers();
    const existingUser = existingUsers.users?.find(user => user.email === testEmail);
    
    if (existingUser) {
      console.log("Deleting existing user:", existingUser.id);
      await supabaseClient.auth.admin.deleteUser(existingUser.id);
    }

    // Delete any existing admin records
    await supabaseClient
      .from('admin_users')
      .delete()
      .eq('email', testEmail);

    await supabaseClient
      .from('user_roles')
      .delete()
      .eq('user_id', existingUser?.id || '00000000-0000-0000-0000-000000000000');

    console.log("Creating new auth user...");
    
    // Create the auth user with explicit email confirmation
    const { data: authData, error: authError } = await supabaseClient.auth.admin.createUser({
      email: testEmail,
      password: testPassword,
      email_confirm: true,
      user_metadata: {
        name: "Test Admin"
      }
    });

    if (authError) {
      console.error("Auth creation error:", authError);
      throw authError;
    }

    if (!authData.user) {
      throw new Error("Failed to create user - no user data returned");
    }

    console.log("Auth user created successfully:", authData.user.id);

    // Create admin user record
    const { error: adminError } = await supabaseClient
      .from('admin_users')
      .insert({
        user_id: authData.user.id,
        email: testEmail,
        first_name: "Test",
        last_name: "Admin",
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

    if (adminError) {
      console.error("Admin user creation error:", adminError);
      throw new Error(`Admin user creation failed: ${adminError.message}`);
    }

    // Create user role
    const { error: roleError } = await supabaseClient
      .from('user_roles')
      .insert({
        user_id: authData.user.id,
        role: "admin"
      });

    if (roleError) {
      console.error("Role creation error:", roleError);
      throw new Error(`Role creation failed: ${roleError.message}`);
    }

    console.log("Test admin created successfully");

    // Verify the user can actually sign in
    const { data: signInTest, error: signInError } = await supabaseClient.auth.signInWithPassword({
      email: testEmail,
      password: testPassword
    });

    if (signInError) {
      console.error("Sign in test failed:", signInError);
      throw new Error(`Created user but sign in test failed: ${signInError.message}`);
    }

    console.log("Sign in test successful");

    // Sign out the test session
    await supabaseClient.auth.signOut();

    return new Response(JSON.stringify({
      success: true,
      message: "Test admin created and verified successfully",
      credentials: {
        email: testEmail,
        password: testPassword
      },
      auth_user_id: authData.user.id
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    console.error('Error creating test admin:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Failed to create test admin",
      details: error
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});