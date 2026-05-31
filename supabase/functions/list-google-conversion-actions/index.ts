// One-shot helper: lists all Google Ads conversion actions for the configured customer.
// Call: GET /functions/v1/list-google-conversion-actions
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function getAccessToken(): Promise<string> {
  const clientId = Deno.env.get('GOOGLE_ADS_CLIENT_ID')!;
  const clientSecret = Deno.env.get('GOOGLE_ADS_CLIENT_SECRET')!;
  const refreshToken = Deno.env.get('GOOGLE_ADS_REFRESH_TOKEN')!;
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  const d = await r.json();
  if (!d.access_token) throw new Error(`Token error: ${JSON.stringify(d)}`);
  return d.access_token;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const developerToken = Deno.env.get('GOOGLE_ADS_DEVELOPER_TOKEN')!;
    const customerId = Deno.env.get('GOOGLE_ADS_CUSTOMER_ID')!;
    if (!developerToken || !customerId) throw new Error('Missing GOOGLE_ADS_DEVELOPER_TOKEN or GOOGLE_ADS_CUSTOMER_ID');

    const accessToken = await getAccessToken();

    const url = `https://googleads.googleapis.com/v21/customers/${customerId}/googleAds:searchStream`;
    const query = `
      SELECT
        conversion_action.id,
        conversion_action.name,
        conversion_action.status,
        conversion_action.type,
        conversion_action.category,
        conversion_action.counting_type,
        conversion_action.primary_for_goal,
        conversion_action.resource_name
      FROM conversion_action
      ORDER BY conversion_action.name
    `;

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'developer-token': developerToken,
        'login-customer-id': customerId,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query }),
    });

    const text = await res.text();
    let parsed: any;
    try { parsed = JSON.parse(text); } catch { parsed = text; }

    // Flatten to a friendly list
    const actions: any[] = [];
    if (Array.isArray(parsed)) {
      for (const chunk of parsed) {
        for (const row of chunk?.results ?? []) {
          actions.push(row.conversionAction);
        }
      }
    }

    return new Response(JSON.stringify({
      status: res.status,
      customerId,
      count: actions.length,
      actions,
      raw: actions.length === 0 ? parsed : undefined,
    }, null, 2), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
