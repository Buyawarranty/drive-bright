import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const log = (step: string, details?: any) => {
  console.log(`[SEND-ADMIN-LOGIN] ${step}`, details ? JSON.stringify(details) : '');
};

function generatePassword(len = 14) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let pw = '';
  for (let i = 0; i < len; i++) pw += chars.charAt(Math.floor(Math.random() * chars.length));
  return pw;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    if (!RESEND_API_KEY) throw new Error('RESEND_API_KEY not configured');

    // Authenticate caller (must be a logged-in admin)
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const token = authHeader.replace('Bearer ', '');
    const { data: { user: caller }, error: authError } = await admin.auth.getUser(token);
    if (authError || !caller) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Verify caller is an active admin
    const { data: callerAdmin } = await admin
      .from('admin_users')
      .select('id, role, is_active')
      .eq('user_id', caller.id)
      .maybeSingle();

    if (!callerAdmin || !callerAdmin.is_active || !['super_admin', 'admin'].includes(callerAdmin.role)) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { userId, email, name, password: providedPassword, loginUrl: providedLoginUrl, role: providedRole } = await req.json();
    if (!userId || !email) {
      return new Response(JSON.stringify({ error: 'userId and email are required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    log('Resetting password', { userId, email, usingProvided: !!providedPassword });

    // Use caller-supplied password when present (so the UI can show + email the same value),
    // otherwise generate a fresh one.
    const newPassword = (typeof providedPassword === 'string' && providedPassword.length >= 6)
      ? providedPassword
      : generatePassword(14);
    const { error: updateErr } = await admin.auth.admin.updateUserById(userId, {
      password: newPassword,
    });
    if (updateErr) throw updateErr;

    // Resolve correct gateway. Only super_admin / admin go to /auth (debug-enabled).
    // All other staff use the clean /sales-login gateway.
    let role = providedRole as string | undefined;
    if (!role) {
      const { data: targetAdmin } = await admin
        .from('admin_users')
        .select('role')
        .eq('user_id', userId)
        .maybeSingle();
      role = targetAdmin?.role;
    }
    const isAdminTier = role === 'super_admin' || role === 'admin';
    const loginUrl = (typeof providedLoginUrl === 'string' && providedLoginUrl.startsWith('http'))
      ? providedLoginUrl
      : (isAdminTier ? 'https://buyawarranty.co.uk/auth' : 'https://buyawarranty.co.uk/sales-login');
    const gatewayCode = 'SmashSales2026!!';
    const displayName = name || 'Team Member';

    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#f4f4f4;">
  <table role="presentation" style="width:100%;border-collapse:collapse;">
    <tr><td align="center" style="padding:40px 0;">
      <table role="presentation" style="width:600px;max-width:100%;background:#fff;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,0.1);">
        <tr><td style="padding:30px 40px;background:#1a365d;border-radius:8px 8px 0 0;">
          <h1 style="margin:0;color:#fff;font-size:24px;">Buy A Warranty Admin</h1>
        </td></tr>
        <tr><td style="padding:40px;">
          <h2 style="margin:0 0 20px;color:#333;font-size:22px;">Your admin login details</h2>
          <p style="margin:0 0 20px;color:#666;font-size:16px;line-height:1.5;">Hello ${displayName},</p>
          <p style="margin:0 0 20px;color:#666;font-size:16px;line-height:1.5;">
            Your admin dashboard login details have been reset. Please use the credentials below to sign in:
          </p>
          <div style="background:#f8f9fa;border:1px solid #e9ecef;border-radius:8px;padding:24px;margin:24px 0;">
            <p style="margin:8px 0;color:#333;"><strong>Login URL:</strong>
              <a href="${loginUrl}" style="color:#1a365d;font-family:monospace;margin-left:10px;">${loginUrl}</a></p>
            <p style="margin:8px 0;color:#333;"><strong>Gateway code:</strong>
              <span style="color:#1a365d;font-family:monospace;margin-left:10px;background:#e8f4f8;padding:4px 12px;border-radius:4px;">${gatewayCode}</span></p>
            <p style="margin:8px 0;color:#333;"><strong>Email:</strong>
              <span style="color:#1a365d;font-family:monospace;margin-left:10px;">${email}</span></p>
            <p style="margin:8px 0;color:#333;"><strong>Password:</strong>
              <span style="color:#1a365d;font-family:monospace;font-size:18px;margin-left:10px;background:#e8f4f8;padding:4px 12px;border-radius:4px;">${newPassword}</span></p>
          </div>
          <p style="margin:0 0 16px;color:#666;font-size:14px;line-height:1.5;">
            On the gateway page enter the <strong>gateway code</strong> above first, then sign in with your email and password.
          </p>
          <div style="text-align:center;margin:32px 0;">
            <a href="${loginUrl}" style="display:inline-block;background:#e07a3a;color:#fff;text-decoration:none;padding:14px 32px;border-radius:6px;font-size:16px;font-weight:bold;">
              Open login page
            </a>
          </div>
          <p style="margin:20px 0 0;color:#666;font-size:14px;line-height:1.5;">
            For security, please change your password after logging in. If you didn't expect this email, contact support immediately.
          </p>
        </td></tr>
        <tr><td style="padding:24px 40px;background:#f8f9fa;border-radius:0 0 8px 8px;border-top:1px solid #e9ecef;">
          <p style="margin:0;color:#999;font-size:12px;text-align:center;">
            Buy A Warranty Ltd | support@buyawarranty.co.uk | 0800 093 4456
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Buy A Warranty <noreply@buyawarranty.co.uk>',
        to: [email],
        subject: 'Your Buy A Warranty admin login details',
        html,
      }),
    });

    const result = await resp.json();
    if (!resp.ok) {
      log('Resend error', result);
      throw new Error(result.message || 'Failed to send email');
    }

    log('Email sent', { id: result.id });

    return new Response(JSON.stringify({ success: true, emailId: result.id }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (err: any) {
    console.error('[SEND-ADMIN-LOGIN] Error:', err);
    return new Response(JSON.stringify({ success: false, error: err.message || 'Internal error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
