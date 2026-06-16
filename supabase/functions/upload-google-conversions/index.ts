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

// SHA-256 hash, lowercase hex — required by Google for Enhanced Conversions
async function sha256Hex(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const hashBuf = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hashBuf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// Normalize phone to E.164 (assume UK if no country code)
function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/[^\d+]/g, '');
  if (!digits) return null;
  if (digits.startsWith('+')) return digits;
  if (digits.startsWith('00')) return '+' + digits.slice(2);
  if (digits.startsWith('0')) return '+44' + digits.slice(1);
  if (digits.startsWith('44')) return '+' + digits;
  return '+' + digits;
}

async function buildUserIdentifiers(
  email?: string | null,
  phone?: string | null,
): Promise<Array<Record<string, string>>> {
  const ids: Array<Record<string, string>> = [];
  if (email) {
    const normalized = email.trim().toLowerCase();
    if (normalized.includes('@')) {
      ids.push({ hashedEmail: await sha256Hex(normalized) });
    }
  }
  if (phone) {
    const e164 = normalizePhone(phone);
    if (e164) {
      ids.push({ hashedPhoneNumber: await sha256Hex(e164) });
    }
  }
  return ids;
}

// Upload a single conversion to Google Ads API
type ClickIdentifier = {
  field: 'gclid' | 'gbraid' | 'wbraid';
  value: string;
};

function getClickIdentifier(rawClickId: string | null | undefined): ClickIdentifier | null {
  const value = (rawClickId || '').trim();
  if (!value) return null;

  // Google iOS App/Safari traffic can produce GBRAID/WBRAID instead of a classic GCLID.
  // Historic rows stored all three values in the `gclid` column, so infer the API field here.
  // GBRAID values commonly start with "0A" and are much shorter than classic GCLIDs.
  if (value.startsWith('0A') || (value.length <= 45 && !value.startsWith('Cj') && !value.startsWith('EAI'))) {
    return { field: 'gbraid', value };
  }

  return { field: 'gclid', value };
}

type UploadErrorCategory = 'conversionPrecedesClick' | 'braidCountingBlocked' | 'invalidClickId' | 'other';

function classifyUploadError(message: string): UploadErrorCategory {
  if (message.includes('CONVERSION_PRECEDES_EVENT') || message.includes('conversion_date_time that precedes the click')) {
    return 'conversionPrecedesClick';
  }
  if (message.includes('ONE_PER_CLICK_CONVERSION_ACTION_NOT_PERMITTED_WITH_BRAID') || message.includes("one-per-click counting can't be used with gbraid")) {
    return 'braidCountingBlocked';
  }
  if (message.includes('gclid could not be decoded')) {
    return 'invalidClickId';
  }
  return 'other';
}

async function uploadConversion(
  accessToken: string,
  customerId: string,
  conversionActionId: string,
  developerToken: string,
  clickIdentifier: ClickIdentifier,
  conversionDateTime: string,
  conversionValue: number,
  userIdentifiers: Array<Record<string, string>>,
  currencyCode: string = 'GBP',
) {
  const url = `https://googleads.googleapis.com/v21/customers/${customerId}:uploadClickConversions`;

  const conversion: Record<string, unknown> = {
    [clickIdentifier.field]: clickIdentifier.value,
    conversionAction: `customers/${customerId}/conversionActions/${conversionActionId}`,
    conversionDateTime: conversionDateTime,
    conversionValue: conversionValue,
    currencyCode: currencyCode,
  };
  if (userIdentifiers.length > 0) {
    // Note: userIdentifierSource is NOT a field on ClickConversion in Google Ads
    // API v21+. FIRST_PARTY is the default for enhanced conversions, so we omit it.
    conversion.userIdentifiers = userIdentifiers;
  }

  const body = { conversions: [conversion], partialFailure: true };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'developer-token': developerToken,
      'login-customer-id': customerId,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const text = await response.text();
  let result: any;
  try {
    result = JSON.parse(text);
  } catch {
    result = { rawHtml: text.substring(0, 500), parseError: true };
  }
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
    // Offline conversion action (separate from the online/website purchase conversion,
    // which is fired client-side via gtag and is unaffected by this env var).
    // Prefer the explicit OFFLINE secret; fall back to the legacy name for compatibility.
    const conversionActionId =
      Deno.env.get('GOOGLE_ADS_OFFLINE_CONVERSION_ACTION_ID') ||
      Deno.env.get('GOOGLE_ADS_CONVERSION_ACTION_ID');

    if (!developerToken || !customerId || !conversionActionId) {
      throw new Error('Missing Google Ads configuration. Required: GOOGLE_ADS_DEVELOPER_TOKEN, GOOGLE_ADS_CUSTOMER_ID, GOOGLE_ADS_OFFLINE_CONVERSION_ACTION_ID');
    }

    logStep('Starting conversion upload', { customerId, conversionActionId });

    // Get OAuth2 access token
    const accessToken = await getAccessToken();
    logStep('Got access token');

    // Connect to Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Google Ads click-through conversion window is at most 90 days. Skip anything
    // older than 60 days so we never get "Identifiers or iOS URL parameters are too old".
    const cutoffISO = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();

    // ─── RECONCILIATION / BACKFILL ────────────────────────────────────────────
    // Sales completed via Bumper Portal, Stripe dashboard, or Payment Assist
    // sometimes lose customers.gclid even though the visitor originally clicked
    // a Google ad and had a cart with a gclid stored in cart_metadata. Copy that
    // gclid onto the customer/bumper record so the normal upload path picks it up.
    let backfilledCustomers = 0;
    let backfilledBumper = 0;
    try {
      const { data: noGclidCustomers } = await supabase
        .from('customers')
        .select('id, email, registration_plate')
        .is('gclid', null)
        .eq('is_deleted', false)
        .in('status', ['active', 'Active'])
        .gte('created_at', cutoffISO)
        .limit(500);

      for (const c of (noGclidCustomers || []) as any[]) {
        if (!c.email && !c.registration_plate) continue;
        let cartGclid: string | null = null;

        if (c.email) {
          const { data: cart } = await supabase
            .from('abandoned_carts')
            .select('cart_metadata')
            .ilike('email', c.email)
            .not('cart_metadata->>gclid', 'is', null)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          cartGclid = (cart?.cart_metadata as any)?.gclid || null;
        }
        if (!cartGclid && c.registration_plate) {
          const { data: cart } = await supabase
            .from('abandoned_carts')
            .select('cart_metadata')
            .eq('vehicle_reg', c.registration_plate)
            .not('cart_metadata->>gclid', 'is', null)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          cartGclid = (cart?.cart_metadata as any)?.gclid || null;
        }

        if (cartGclid) {
          await supabase.from('customers').update({ gclid: cartGclid }).eq('id', c.id);
          backfilledCustomers++;
        }
      }

      const { data: noGclidBumper } = await supabase
        .from('bumper_transactions')
        .select('id, customer_email, vehicle_reg')
        .is('gclid', null)
        .eq('status', 'completed')
        .gte('updated_at', cutoffISO)
        .limit(500);

      for (const b of (noGclidBumper || []) as any[]) {
        let cartGclid: string | null = null;
        if (b.customer_email) {
          const { data: cart } = await supabase
            .from('abandoned_carts')
            .select('cart_metadata')
            .ilike('email', b.customer_email)
            .not('cart_metadata->>gclid', 'is', null)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          cartGclid = (cart?.cart_metadata as any)?.gclid || null;
        }
        if (!cartGclid && b.vehicle_reg) {
          const { data: cart } = await supabase
            .from('abandoned_carts')
            .select('cart_metadata')
            .eq('vehicle_reg', b.vehicle_reg)
            .not('cart_metadata->>gclid', 'is', null)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          cartGclid = (cart?.cart_metadata as any)?.gclid || null;
        }
        if (cartGclid) {
          await supabase.from('bumper_transactions').update({ gclid: cartGclid }).eq('id', b.id);
          backfilledBumper++;
        }
      }
      logStep('Backfill complete', { backfilledCustomers, backfilledBumper });
    } catch (e) {
      logStep('Warning: backfill failed', (e as Error).message);
    }
    // ──────────────────────────────────────────────────────────────────────────

    // Query customers with Google click IDs that haven't been uploaded yet.
    // Prefer signup_date for the conversion timestamp: it represents the actual purchase/sign-up
    // moment more reliably than created_at on restored/reconciled records.
    const { data: pendingCustomers, error: customersError } = await supabase
      .from('customers')
      .select('id, gclid, final_amount, created_at, signup_date, email, phone, status')
      .not('gclid', 'is', null)
      .is('google_ads_conversion_uploaded_at', null)
      .in('status', ['active', 'Active'])
      .eq('is_deleted', false)
      .gte('created_at', cutoffISO)
      .order('created_at', { ascending: true })
      .limit(200);

    if (customersError) {
      throw new Error(`Failed to query customers: ${customersError.message}`);
    }

    // Also query bumper transactions
    // For Bumper, created_at is the finance application start; updated_at is set when payment
    // succeeds. Use updated_at as the conversion time to avoid "conversion precedes click" errors.
    const { data: pendingBumper, error: bumperError } = await supabase
      .from('bumper_transactions')
      .select('id, gclid, final_amount, created_at, updated_at, status')
      .not('gclid', 'is', null)
      .is('google_ads_conversion_uploaded_at', null)
      .eq('status', 'completed')
      .gte('updated_at', cutoffISO)
      .order('created_at', { ascending: true })
      .limit(200);

    if (bumperError) {
      logStep('Warning: Failed to query bumper transactions', bumperError.message);
    }

    // Try to enrich bumper rows with email/phone from the matching customer record (by gclid)
    const bumperGclids = (pendingBumper || []).map((b) => b.gclid).filter(Boolean) as string[];
    let bumperContactByGclid = new Map<string, { email: string | null; phone: string | null }>();
    if (bumperGclids.length > 0) {
      const { data: bumperCustomers } = await supabase
        .from('customers')
        .select('gclid, email, phone')
        .in('gclid', bumperGclids);
      for (const c of bumperCustomers || []) {
        if (c.gclid) bumperContactByGclid.set(c.gclid, { email: c.email, phone: c.phone });
      }
    }

    const allPending = [
      ...(pendingCustomers || []).map((c) => ({ ...c, source: 'customers' as const })),
      ...(pendingBumper || []).map((b) => {
        const enrich = bumperContactByGclid.get(b.gclid as string) || { email: null, phone: null };
        return { ...b, email: enrich.email, phone: enrich.phone, source: 'bumper_transactions' as const };
      }),
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
    let withIdentifiers = 0;
    const errors: string[] = [];

    for (const record of allPending) {
      try {
        const clickIdentifier = getClickIdentifier(record.gclid);
        if (!clickIdentifier) {
          throw new Error('Missing Google click identifier');
        }

        const conversionTimestamp =
          record.source === 'customers'
            ? ((record as any).signup_date || record.created_at)
            : ((record as any).updated_at || record.created_at);
        const conversionDate = formatDateForGoogle(conversionTimestamp);
        const value = record.final_amount || 0;
        const userIdentifiers = await buildUserIdentifiers(
          (record as any).email,
          (record as any).phone,
        );
        if (userIdentifiers.length > 0) withIdentifiers++;

        logStep(`Uploading conversion`, {
          id: record.id,
          clickIdType: clickIdentifier.field,
          clickIdPrefix: clickIdentifier.value.substring(0, 12),
          value,
          date: conversionDate,
          source: record.source,
          identifiers: userIdentifiers.length,
        });

        const { status, result } = await uploadConversion(
          accessToken,
          customerId,
          conversionActionId,
          developerToken,
          clickIdentifier,
          conversionDate,
          value,
          userIdentifiers,
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
          const errorCategory = classifyUploadError(errorMsg);
          const storedStatus =
            errorCategory === 'braidCountingBlocked'
              ? 'config_required: set Google Ads offline conversion action counting to MANY_PER_CLICK for gbraid/wbraid uploads'
              : errorCategory === 'conversionPrecedesClick'
                ? 'not_uploadable: conversion timestamp is before the Google click time'
                : `failed: ${errorMsg.substring(0, 200)}`;
          
          // Mark as failed
          await supabase
            .from(record.source)
            .update({
              google_ads_conversion_status: storedStatus,
            })
            .eq('id', record.id);

          failed++;
          errors.push(`${record.id}: ${errorMsg.substring(0, 100)}`);
          logStep(`❌ Failed conversion for ${record.id}`, errorMsg);
        }
      } catch (err) {
        const msg = (err as Error)?.message ?? String(err);
        failed++;
        errors.push(`${record.id}: ${msg}`);
        logStep(`❌ Error uploading ${record.id}`, msg);
      }
    }

    const summary = {
      success: true,
      total: allPending.length,
      uploaded,
      failed,
      withIdentifiers,
      errors: errors.slice(0, 10), // Only first 10 errors
    };

    logStep('Upload complete', summary);

    return new Response(JSON.stringify(summary), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const errMsg = (error as Error)?.message ?? String(error);
    logStep('Fatal error', errMsg);
    return new Response(JSON.stringify({ success: false, error: errMsg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
