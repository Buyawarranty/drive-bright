import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function logStep(step: string, data?: any) {
  console.log(`[Google Ads Conversion] ${step}`, data ? JSON.stringify(data) : '');
}

// Refresh OAuth2 access token using the refresh token
async function getAccessToken(): Promise<string> {
  const clientId = Deno.env.get('GOOGLE_ADS_CLIENT_ID');
  const clientSecret = Deno.env.get('GOOGLE_ADS_CLIENT_SECRET');
  const refreshToken = Deno.env.get('GOOGLE_ADS_REFRESH_TOKEN');

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('Missing Google OAuth2 credentials');
  }

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  const data = await response.json();
  if (!data.access_token) {
    throw new Error(`Failed to get access token: ${JSON.stringify(data)}`);
  }

  return data.access_token;
}

// Upload a single conversion to Google Ads API
async function uploadConversion(
  accessToken: string,
  customerId: string,
  conversionActionId: string,
  developerToken: string,
  gclid: string,
  conversionDateTime: string,
  conversionValue: number,
  currencyCode: string = 'GBP'
) {
  const url = `https://googleads.googleapis.com/v18/customers/${customerId}:uploadClickConversions`;

  const body = {
    conversions: [
      {
        gclid: gclid,
        conversionAction: `customers/${customerId}/conversionActions/${conversionActionId}`,
        conversionDateTime: conversionDateTime, // Format: yyyy-MM-dd HH:mm:ss+00:00
        conversionValue: conversionValue,
        currencyCode: currencyCode,
      },
    ],
    partialFailure: true,
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'developer-token': developerToken,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const result = await response.json();
  return { status: response.status, result };
}

// Format date for Google Ads API: yyyy-MM-dd HH:mm:ss+00:00
function formatDateForGoogle(dateStr: string): string {
  const d = new Date(dateStr);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mi = String(d.getUTCMinutes()).padStart(2, '0');
  const ss = String(d.getUTCSeconds()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}+00:00`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const developerToken = Deno.env.get('GOOGLE_ADS_DEVELOPER_TOKEN');
    const customerId = Deno.env.get('GOOGLE_ADS_CUSTOMER_ID');
    const conversionActionId = Deno.env.get('GOOGLE_ADS_CONVERSION_ACTION_ID');

    if (!developerToken || !customerId || !conversionActionId) {
      throw new Error('Missing Google Ads configuration. Required: GOOGLE_ADS_DEVELOPER_TOKEN, GOOGLE_ADS_CUSTOMER_ID, GOOGLE_ADS_CONVERSION_ACTION_ID');
    }

    logStep('Starting conversion upload', { customerId, conversionActionId });

    // Get OAuth2 access token
    const accessToken = await getAccessToken();
    logStep('Got access token');

    // Connect to Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Query customers with GCLID that haven't been uploaded yet
    const { data: pendingCustomers, error: customersError } = await supabase
      .from('customers')
      .select('id, gclid, final_amount, created_at, email, status')
      .not('gclid', 'is', null)
      .is('google_ads_conversion_uploaded_at', null)
      .in('status', ['active', 'Active'])
      .eq('is_deleted', false)
      .order('created_at', { ascending: true })
      .limit(200);

    if (customersError) {
      throw new Error(`Failed to query customers: ${customersError.message}`);
    }

    // Also query bumper transactions
    const { data: pendingBumper, error: bumperError } = await supabase
      .from('bumper_transactions')
      .select('id, gclid, final_amount, created_at, status')
      .not('gclid', 'is', null)
      .is('google_ads_conversion_uploaded_at', null)
      .eq('status', 'completed')
      .order('created_at', { ascending: true })
      .limit(200);

    if (bumperError) {
      logStep('Warning: Failed to query bumper transactions', bumperError.message);
    }

    const allPending = [
      ...(pendingCustomers || []).map(c => ({ ...c, source: 'customers' as const })),
      ...(pendingBumper || []).map(b => ({ ...b, source: 'bumper_transactions' as const })),
    ];

    logStep(`Found ${allPending.length} pending conversions`, {
      customers: pendingCustomers?.length || 0,
      bumper: pendingBumper?.length || 0,
    });

    if (allPending.length === 0) {
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'No pending conversions to upload',
        uploaded: 0 
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    let uploaded = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const record of allPending) {
      try {
        const conversionDate = formatDateForGoogle(record.created_at);
        const value = record.final_amount || 0;

        logStep(`Uploading conversion`, {
          id: record.id,
          gclid: record.gclid,
          value,
          date: conversionDate,
          source: record.source,
        });

        const { status, result } = await uploadConversion(
          accessToken,
          customerId,
          conversionActionId,
          developerToken,
          record.gclid!,
          conversionDate,
          value
        );

        // Check for partial failures
        const hasError = result?.partialFailureError?.details?.length > 0;

        if (status === 200 && !hasError) {
          // Mark as uploaded
          await supabase
            .from(record.source)
            .update({
              google_ads_conversion_uploaded_at: new Date().toISOString(),
              google_ads_conversion_status: 'uploaded',
            })
            .eq('id', record.id);

          uploaded++;
          logStep(`✅ Uploaded conversion for ${record.id}`);
        } else {
          const errorMsg = hasError 
            ? JSON.stringify(result.partialFailureError) 
            : `HTTP ${status}: ${JSON.stringify(result)}`;
          
          // Mark as failed
          await supabase
            .from(record.source)
            .update({
              google_ads_conversion_status: `failed: ${errorMsg.substring(0, 200)}`,
            })
            .eq('id', record.id);

          failed++;
          errors.push(`${record.id}: ${errorMsg.substring(0, 100)}`);
          logStep(`❌ Failed conversion for ${record.id}`, errorMsg);
        }
      } catch (err) {
        failed++;
        errors.push(`${record.id}: ${err.message}`);
        logStep(`❌ Error uploading ${record.id}`, err.message);
      }
    }

    const summary = {
      success: true,
      total: allPending.length,
      uploaded,
      failed,
      errors: errors.slice(0, 10), // Only first 10 errors
    };

    logStep('Upload complete', summary);

    return new Response(JSON.stringify(summary), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    logStep('Fatal error', error.message);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
