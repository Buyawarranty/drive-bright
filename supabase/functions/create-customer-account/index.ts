import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Create Supabase client with service role key for admin operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { email, password, firstName, lastName, customerId } = await req.json();

    if (!email || !password) {
      return new Response(
        JSON.stringify({ error: 'Email and password are required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('Creating customer account for:', email);

    // First, try to find if user already exists
    const { data: existingUsers } = await supabase.auth.admin.listUsers();
    const existingUser = existingUsers?.users.find(u => u.email?.toLowerCase() === email.toLowerCase());

    let userId: string;
    
    if (existingUser) {
      console.log('User already exists, updating password for:', email);
      
      // Update existing user's password
      const { data: updateData, error: updateError } = await supabase.auth.admin.updateUserById(
        existingUser.id,
        {
          password: password,
          email_confirm: true,
          user_metadata: {
            first_name: firstName || existingUser.user_metadata?.first_name || '',
            last_name: lastName || existingUser.user_metadata?.last_name || ''
          }
        }
      );

      if (updateError) {
        console.error('Error updating user:', updateError);
        throw updateError;
      }

      userId = existingUser.id;
      console.log('User password updated successfully:', userId);
    } else {
      console.log('Creating new user:', email);
      
      // Create new user account
      const { data: authData, error: signUpError } = await supabase.auth.admin.createUser({
        email: email,
        password: password,
        email_confirm: true,
        user_metadata: {
          first_name: firstName || '',
          last_name: lastName || ''
        }
      });

      if (signUpError) {
        console.error('Error creating user:', signUpError);
        throw signUpError;
      }

      userId = authData.user.id;
      console.log('User created successfully:', userId);
    }

    // Log credentials in admin note if customerId provided
    if (customerId) {
      const { error: noteError } = await supabase
        .from('admin_notes')
        .insert({
          customer_id: customerId,
          note: `Dashboard credentials ${existingUser ? 'updated' : 'created'}:\nEmail: ${email}\nPassword: ${password}\nUser ID: ${userId}`
        });

      if (noteError) {
        console.error('Error creating admin note:', noteError);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        userId: userId,
        email: email,
        action: existingUser ? 'updated' : 'created'
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error in create-customer-account function:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error occurred' 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});