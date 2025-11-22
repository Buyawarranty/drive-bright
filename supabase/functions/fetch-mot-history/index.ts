import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface MOTTest {
  completedDate: string;
  testResult: string;
  expiryDate?: string;
  odometerValue?: number;
  odometerUnit?: string;
  motTestNumber?: string;
  defects?: Array<{
    text: string;
    type: string;
    dangerous?: boolean;
  }>;
}

interface MOTHistoryResponse {
  make?: string;
  model?: string;
  primaryColour?: string;
  fuelType?: string;
  motTests?: MOTTest[];
  dvlaId?: string;
  registrationDate?: string;
  manufactureDate?: string;
  engineCapacity?: number;
  co2Emissions?: number;
  euroStatus?: string;
  realDrivingEmissions?: string;
  markedForExport?: boolean;
  colour?: string;
  typeApproval?: string;
  wheelplan?: string;
  revenueWeight?: number;
  dateOfLastV5CIssued?: string;
}

async function getAccessToken(): Promise<string> {
  const clientId = Deno.env.get('MOT_CLIENT_ID');
  const clientSecret = Deno.env.get('MOT_CLIENT_SECRET');
  const tokenUrl = Deno.env.get('MOT_TOKEN_URL');
  const scopeUrl = Deno.env.get('MOT_SCOPE_URL');

  if (!clientId || !clientSecret || !tokenUrl || !scopeUrl) {
    throw new Error('Missing MOT API configuration');
  }

  const params = new URLSearchParams();
  params.append('client_id', clientId);
  params.append('client_secret', clientSecret);
  params.append('scope', scopeUrl);
  params.append('grant_type', 'client_credentials');

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params,
  });

  if (!response.ok) {
    console.error('Token request failed:', await response.text());
    throw new Error('Failed to get access token');
  }

  const tokenData = await response.json();
  return tokenData.access_token;
}

async function fetchMOTHistory(registration: string, accessToken: string): Promise<MOTHistoryResponse> {
  const apiKey = Deno.env.get('MOT_API_KEY');
  
  if (!apiKey) {
    throw new Error('Missing MOT API key');
  }

  const response = await fetch(`https://history.mot.api.gov.uk/v1/trade/vehicles/registration/${registration.toUpperCase()}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'X-API-Key': apiKey,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('Vehicle not found');
    }
    console.error('MOT API request failed:', response.status, await response.text());
    throw new Error('Failed to fetch MOT history');
  }

  return await response.json();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { registration, customer_id } = await req.json();
    
    if (!registration) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Registration number is required' 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    console.log(`Fetching MOT history for registration: ${registration}`);

    // Check if we already have recent data for this registration
    const { data: existingData } = await supabase
      .from('mot_history')
      .select('*')
      .eq('registration', registration.toUpperCase())
      .gte('updated_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // Last 24 hours
      .single();

    if (existingData) {
      console.log('Using cached MOT data');
      return new Response(JSON.stringify({ 
        success: true, 
        data: existingData,
        cached: true
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Get access token
    const accessToken = await getAccessToken();
    
    // Fetch MOT history
    const motData = await fetchMOTHistory(registration, accessToken);
    
    // Calculate MOT expiry date from latest test
    let motExpiryDate = null;
    if (motData.motTests && motData.motTests.length > 0) {
      const latestTest = motData.motTests
        .filter(test => test.expiryDate)
        .sort((a, b) => new Date(b.completedDate).getTime() - new Date(a.completedDate).getTime())[0];
      
      if (latestTest && latestTest.expiryDate) {
        motExpiryDate = latestTest.expiryDate;
      }
    }

    // Store in database
    const motHistoryData = {
      registration: registration.toUpperCase(),
      customer_id: customer_id || null,
      make: motData.make,
      model: motData.model,
      primary_colour: motData.primaryColour,
      fuel_type: motData.fuelType,
      mot_tests: motData.motTests || [],
      dvla_id: motData.dvlaId,
      registration_date: motData.registrationDate ? new Date(motData.registrationDate).toISOString().split('T')[0] : null,
      manufacture_date: motData.manufactureDate ? new Date(motData.manufactureDate).toISOString().split('T')[0] : null,
      engine_capacity: motData.engineCapacity,
      co2_emissions: motData.co2Emissions,
      euro_status: motData.euroStatus,
      real_driving_emissions: motData.realDrivingEmissions,
      marked_for_export: motData.markedForExport || false,
      colour: motData.colour,
      type_approval: motData.typeApproval,
      wheelplan: motData.wheelplan,
      revenue_weight: motData.revenueWeight,
      date_of_last_v5c_issued: motData.dateOfLastV5CIssued ? new Date(motData.dateOfLastV5CIssued).toISOString().split('T')[0] : null,
      mot_expiry_date: motExpiryDate ? new Date(motExpiryDate).toISOString().split('T')[0] : null,
    };

    const { data, error } = await supabase
      .from('mot_history')
      .upsert(motHistoryData, { onConflict: 'registration' })
      .select()
      .single();

    if (error) {
      console.error('Database error:', error);
      throw error;
    }

    console.log('MOT history stored successfully');

    return new Response(JSON.stringify({ 
      success: true, 
      data: data,
      cached: false
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    console.error("Error fetching MOT history:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: errorMessage 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});