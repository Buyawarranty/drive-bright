import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
    const apiKey = Deno.env.get('GETADDRESS_API_KEY');
    if (!apiKey) {
      console.error('GETADDRESS_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { action, postcode, term, id } = await req.json();
    console.log('getaddress-lookup called with action:', action);

    let url: string;
    let response: Response;

    switch (action) {
      case 'find':
        // Find addresses by postcode
        if (!postcode) {
          return new Response(
            JSON.stringify({ error: 'Postcode is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        const cleanPostcode = postcode.replace(/\s+/g, '').toUpperCase();
        url = `https://api.getaddress.io/find/${encodeURIComponent(cleanPostcode)}?api-key=${apiKey}&expand=true`;
        console.log('Calling getaddress.io find endpoint for postcode:', cleanPostcode);
        
        response = await fetch(url);
        break;

      case 'autocomplete':
        // Autocomplete as user types
        if (!term) {
          return new Response(
            JSON.stringify({ error: 'Search term is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        url = `https://api.getaddress.io/autocomplete/${encodeURIComponent(term)}?api-key=${apiKey}&all=true`;
        console.log('Calling getaddress.io autocomplete endpoint for term:', term);
        
        response = await fetch(url);
        break;

      case 'get':
        // Get full address by ID
        if (!id) {
          return new Response(
            JSON.stringify({ error: 'Address ID is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        url = `https://api.getaddress.io/get/${encodeURIComponent(id)}?api-key=${apiKey}`;
        console.log('Calling getaddress.io get endpoint for id:', id);
        
        response = await fetch(url);
        break;

      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action. Use: find, autocomplete, or get' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error('getaddress.io API error:', response.status, errorText);
      
      // Handle specific error codes
      if (response.status === 404) {
        return new Response(
          JSON.stringify({ addresses: [], message: 'No addresses found' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: `API error: ${response.status}` }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    console.log('getaddress.io response received, addresses count:', data.addresses?.length || 0);

    return new Response(
      JSON.stringify(data),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in getaddress-lookup:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
