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
  firstName?: string | null,
  lastName?: string | null,
  postcode?: string | null,
): Promise<Array<Record<string, unknown>>> {
  const ids: Array<Record<string, unknown>> = [];
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
  // Name + postcode raise Google's match rate for enhanced conversions.
  const fn = (firstName || '').trim().toLowerCase();
  const ln = (lastName || '').trim().toLowerCase();
  const pc = (postcode || '').replace(/\s+/g, '').toLowerCase();
  if (fn && ln) {
    const addressInfo: Record<string, string> = {
      hashedFirstName: await sha256Hex(fn),
      hashedLastName: await sha256Hex(ln),
      countryCode: 'GB',
    };
    if (pc) addressInfo.postalCode = pc;
    ids.push({ addressInfo });
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
  clickIdentifier: ClickIdentifier | null,
  conversionDateTime: string,
  conversionValue: number,
  userIdentifiers: Array<Record<string, unknown>>,
  orderId?: string | null,
  currencyCode: string = 'GBP',
) {
  const url = `https://googleads.googleapis.com/v22/customers/${customerId}:uploadClickConversions`;

  const conversion: Record<string, unknown> = {
    conversionAction: `customers/${customerId}/conversionActions/${conversionActionId}`,
    conversionDateTime: conversionDateTime,
    conversionValue: conversionValue,
    currencyCode: currencyCode,
  };
  if (clickIdentifier) {
    conversion[clickIdentifier.field] = clickIdentifier.value;
  }
  if (orderId) {
    // Order id lets Google de-duplicate re-uploads of the same sale.
    conversion.orderId = orderId;
  }
  if (userIdentifiers.length > 0) {
    // Note: userIdentifierSource is NOT a field on ClickConversion in Google Ads
    // API v21+. FIRST_PARTY is the default for enhanced conversions, so we omit it.
    // With no click id, these hashed identifiers are the only match signal
    // (enhanced conversions), so Google matches the sale back to the ad click.
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
        .select('id, customer_data, vehicle_data')
        .is('gclid', null)
        .eq('status', 'completed')
        .gte('updated_at', cutoffISO)
        .limit(500);

      for (const b of (noGclidBumper || []) as any[]) {
        const bEmail: string | null = b.customer_data?.email || b.customer_data?.first_name_email || null;
        const bReg: string | null = b.vehicle_data?.registration_plate || b.vehicle_data?.regNumber || null;
        let cartGclid: string | null = null;
        if (bEmail) {
          const { data: cart } = await supabase
            .from('abandoned_carts')
            .select('cart_metadata')
            .ilike('email', bEmail)
            .not('cart_metadata->>gclid', 'is', null)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          cartGclid = (cart?.cart_metadata as any)?.gclid || null;
        }
        if (!cartGclid && bReg) {
          const { data: cart } = await supabase
            .from('abandoned_carts')
            .select('cart_metadata')
            .eq('vehicle_reg', bReg)
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

    // Query sales that haven't been uploaded yet. Rows WITHOUT a Google click id are
    // included too: they go up as enhanced conversions (hashed email/phone/name), so a
    // lost gclid no longer means a missing conversion.
    // Prefer signup_date for the conversion timestamp: it represents the actual purchase/sign-up
    // moment more reliably than created_at on restored/reconciled records.
    const { data: pendingCustomers, error: customersError } = await supabase
      .from('customers')
      .select('id, gclid, final_amount, created_at, signup_date, email, phone, status, first_name, last_name, name, postcode, warranty_number')
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
      .select('id, gclid, final_amount, created_at, updated_at, status, customer_data')
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
        const cd = ((b as any).customer_data || {}) as Record<string, any>;
        return {
          ...b,
          email: enrich.email || cd.email || null,
          phone: enrich.phone || cd.phone || cd.mobile || null,
          first_name: cd.first_name || cd.firstName || null,
          last_name: cd.last_name || cd.lastName || null,
          postcode: cd.postcode || null,
          source: 'bumper_transactions' as const,
        };
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
    let uploadedEnhanced = 0;
    let failed = 0;
    let skippedNoMatchData = 0;
    let withIdentifiers = 0;
    const errors: string[] = [];

    for (const record of allPending) {
      try {
        const clickIdentifier = getClickIdentifier(record.gclid);

        const conversionTimestamp =
          record.source === 'customers'
            ? ((record as any).signup_date || record.created_at)
            : ((record as any).updated_at || record.created_at);
        const conversionDate = formatDateForGoogle(conversionTimestamp);
        const value = record.final_amount || 0;
        const nameParts = String((record as any).name || '').trim().split(/\s+/);
        const firstName = (record as any).first_name || nameParts[0] || null;
        const lastName =
          (record as any).last_name || (nameParts.length > 1 ? nameParts[nameParts.length - 1] : null);
        const userIdentifiers = await buildUserIdentifiers(
          (record as any).email,
          (record as any).phone,
          firstName,
          lastName,
          (record as any).postcode,
        );
        if (userIdentifiers.length > 0) withIdentifiers++;

        // No click id AND no hashed identifiers means Google has nothing to match on.
        if (!clickIdentifier && userIdentifiers.length === 0) {
          await supabase
            .from(record.source)
            .update({
              google_ads_conversion_status: 'skipped: no click id and no email/phone to match on',
            })
            .eq('id', record.id);
          skippedNoMatchData++;
          continue;
        }

        const orderId =
          (record as any).warranty_number || `${record.source}:${record.id}`;

        logStep(`Uploading conversion`, {
          id: record.id,
          mode: clickIdentifier ? 'click' : 'enhanced',
          clickIdType: clickIdentifier?.field || null,
          clickIdPrefix: clickIdentifier?.value.substring(0, 12) || null,
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
          orderId,
        );

        // Check for partial failures
        const hasError = result?.partialFailureError?.details?.length > 0;

        if (status === 200 && !hasError) {
          // Mark as uploaded
          await supabase
            .from(record.source)
            .update({
              google_ads_conversion_uploaded_at: new Date().toISOString(),
              google_ads_conversion_status: clickIdentifier ? 'uploaded' : 'uploaded_enhanced',
            })
            .eq('id', record.id);

          uploaded++;
          if (!clickIdentifier) uploadedEnhanced++;
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
      uploadedEnhanced,
      failed,
      skippedNoMatchData,
      withIdentifiers,
      backfilledCustomers,
      backfilledBumper,
      errors: errors.slice(0, 10), // Only first 10 errors
    };


    logStep('Upload complete', summary);

    // ─── STALL ALERT ──────────────────────────────────────────────────────────
    // If every sale in this run failed, or sales have been sitting unsent for
    // more than 6 hours, email the team once per day so a silent stop (e.g. a
    // stale deployment) can never go unnoticed again.
    try {
      const nothingGotThrough = allPending.length > 0 && uploaded === 0;
      const { count: staleCount } = await supabase
        .from('customers')
        .select('id', { count: 'exact', head: true })
        .is('google_ads_conversion_uploaded_at', null)
        .in('status', ['active', 'Active'])
        .eq('is_deleted', false)
        .gte('created_at', cutoffISO)
        .lte('created_at', new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString());

      const stalled = nothingGotThrough || (staleCount || 0) >= 3;
      const hourUTC = new Date().getUTCHours();
      const resendKey = Deno.env.get('RESEND_API_KEY');

      if (stalled && hourUTC === 9 && resendKey) {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${resendKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'BuyaWarranty Team <support@buyawarranty.co.uk>',
            to: ['support@buyawarranty.co.uk'],
            subject: 'Google Ads sales upload looks stalled',
            html: `<p>The hourly Google Ads sales upload is not getting sales through.</p>
                   <ul>
                     <li>Sales attempted this run: ${allPending.length}</li>
                     <li>Sent successfully: ${uploaded}</li>
                     <li>Failed: ${failed}</li>
                     <li>Sales waiting over 6 hours: ${staleCount || 0}</li>
                   </ul>
                   <p>First errors:</p><pre>${(errors.slice(0, 5).join('\n') || 'none').replace(/</g, '&lt;')}</pre>`,
          }),
        });
        logStep('Stall alert email sent');
      }
    } catch (e) {
      logStep('Warning: stall alert failed', (e as Error).message);
    }

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
