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
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Create Supabase clients for admin operations and caller auth validation
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: userError } = await authClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: roleRows } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    const allowedRoles = new Set(['super_admin', 'admin', 'member', 'sales_lead', 'sales']);
    const isAuthorized = (roleRows || []).some(r => allowedRoles.has(r.role));

    if (!isAuthorized) {
      return new Response(
        JSON.stringify({ error: 'Forbidden' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const payload = await req.json();
    const email = payload.email?.trim()?.toLowerCase();
    const password = payload.password;
    const firstName = payload.firstName;
    const lastName = payload.lastName;
    const customerId = payload.customerId;

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

    // First, try to find if user already exists (paginate to avoid missing users beyond first 1000)
    let existingUser: { id: string; email?: string | null; user_metadata?: Record<string, any> } | undefined;
    let page = 1;
    const perPage = 1000;

    while (!existingUser && page <= 20) {
      const { data: existingUsers, error: listError } = await supabase.auth.admin.listUsers({ page, perPage });

      if (listError) {
        console.error('Error listing users:', listError);
        throw listError;
      }

      const batch = existingUsers?.users ?? [];
      existingUser = batch.find(u => u.email?.toLowerCase() === email);

      if (batch.length < perPage) {
        break;
      }

      page += 1;
    }

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