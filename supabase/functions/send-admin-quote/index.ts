import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { logCustomerEmail } from '../_shared/log-email.ts';
import { requireAdmin } from '../_shared/admin-auth.ts';

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));


const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const sanitizeEmail = (value: unknown): string =>
  typeof value === "string"
    ? value.trim().replace(/^[<("'\s]+/, '').replace(/[>)"'\s.,;]+$/, '').toLowerCase()
    : '';

const isValidEmail = (email: unknown): email is string =>
  typeof email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });

const escapeHtml = (value: unknown): string =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const getSafeQuoteLink = (value: string): string | null => {
  try {
    const url = new URL(value);
    const allowedHosts = new Set(['buyawarranty.co.uk', 'www.buyawarranty.co.uk']);
    if (!['https:', 'http:'].includes(url.protocol) || !allowedHosts.has(url.hostname)) {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
};

const getMailboxProvider = (email: string): string => email.split('@').pop()?.toLowerCase() || 'unknown';

const STRICT_MAILBOX_PROVIDERS = new Set([
  'icloud.com',
  'me.com',
  'mac.com',
  'gmail.com',
  'googlemail.com',
  'outlook.com',
  'hotmail.com',
  'live.com',
  'yahoo.com',
  'aol.com',
]);

interface QuoteEmailRequest {
  to: string;
  cc?: string | string[];
  bcc?: string | string[];
  agentCopyEmail?: string | null;
  agentName?: string | null;
  copyRecipients?: string[];

  subject: string;
  quoteLink: string;
  customerName: string;
  vehicleData: {
    regNumber: string;
    mileage: string;
    make?: string;
    model?: string;
    year?: string;
  };
  quoteDetails: {
    plan: string;
    paymentType: string;
    totalPrice: number;
    price?: number;
    monthlyPrice: number;
    payInFullPrice?: number;
    savings?: number;
    includePayInFullDiscount?: boolean;
    excessAmount: number;
    claimLimit: number;
    labourRate?: number;
    boostAddon?: boolean;
    coverMonths: number;
    bonusMonths: number;
  };
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Require an authenticated admin caller — this endpoint sends
    // branded quote emails to customers and must not be exposed publicly.
    const auth = await requireAdmin(req);
    if (!auth.ok) return auth.response;

    const requestBody = await req.json().catch(() => null) as QuoteEmailRequest | null;


    if (!requestBody) {
      return jsonResponse({ error: "Invalid JSON body" }, 400);
    }

    const {
      cc,
      bcc,
      agentCopyEmail,
      agentName,
      copyRecipients,
      subject,
      quoteLink,
      customerName,
      vehicleData,
      quoteDetails,
    } = requestBody;

    // Sanitize the primary recipient — sales agents occasionally paste emails
    // with trailing punctuation ("foo@bar.com)") which Resend then rejects.
    const to = sanitizeEmail(requestBody.to);
    if (!isValidEmail(to)) {
      return jsonResponse({ error: `A valid customer email is required (received: ${String(requestBody.to)})` }, 400);
    }

    if (!subject || typeof subject !== "string") {
      return jsonResponse({ error: "Email subject is required" }, 400);
    }

    if (!quoteLink || typeof quoteLink !== "string") {
      return jsonResponse({ error: "Quote link is required" }, 400);
    }

    const safeQuoteLink = getSafeQuoteLink(quoteLink);
    if (!safeQuoteLink) {
      return jsonResponse({ error: "Quote link must be a valid Buy A Warranty link" }, 400);
    }

    if (!vehicleData?.regNumber || !quoteDetails) {
      return jsonResponse({ error: "Vehicle and quote details are required" }, 400);
    }

    const safeSubject = subject.replace(/[\r\n]+/g, ' ').trim().slice(0, 140);

    console.log("Sending quote email to:", to);
    console.log("CC:", cc, "BCC:", bcc, "Agent copy:", agentCopyEmail, "Extra copies:", copyRecipients);
    console.log("Quote link:", quoteLink);
    console.log("Quote details received:", JSON.stringify(quoteDetails, null, 2));
    console.log("Vehicle data received:", JSON.stringify(vehicleData, null, 2));

    const mailboxProvider = getMailboxProvider(to);
    const isStrictMailboxProvider = STRICT_MAILBOX_PROVIDERS.has(mailboxProvider);
    const plainFirstName = (customerName || 'there').trim().split(/\s+/)[0] || 'there';
    const firstName = escapeHtml(plainFirstName);
    const plainVehicleDisplay = `${vehicleData.make || ''} ${vehicleData.model || ''}`.trim() || 'Your vehicle';
    const vehicleDisplay = escapeHtml(plainVehicleDisplay);
    const plainPlanDisplay = quoteDetails.plan || 'Platinum';
    const planDisplay = escapeHtml(plainPlanDisplay);
    const vehicleRegDisplay = escapeHtml(vehicleData.regNumber || '');
    const coverMonths = Number(quoteDetails.coverMonths) || 12;
    const bonusMonths = Number(quoteDetails.bonusMonths) || 0;
    const totalMonths = coverMonths + bonusMonths;
    const mileageDisplay = Number(String(vehicleData.mileage || '0').replace(/,/g, '')) || 0;
    const sanitizedAgentName = (agentName || '').replace(/[<>",]/g, '').trim();
    const claimLimitDisplay = Number(quoteDetails.claimLimit) || 2000;
    const excessAmountDisplay = Number(quoteDetails.excessAmount) || 0;
    const labourRateDisplay = Number(quoteDetails.labourRate) || 70;
    
    // Cover period display
    const coverPeriodDisplay = bonusMonths > 0 
      ? `${coverMonths} months plus ${bonusMonths} months FREE`
      : `${coverMonths} months`;

    const totalPrice = Number(quoteDetails.totalPrice ?? quoteDetails.price) || 0;
    const monthlyPrice = Number(quoteDetails.monthlyPrice) || Math.round((totalPrice / Math.max(coverMonths, 1)) * 100) / 100;
    const payInFullPrice = Number(quoteDetails.payInFullPrice) || (
      quoteDetails.includePayInFullDiscount ? Math.floor(totalPrice * 0.9) : totalPrice
    );
    const savings = Number(quoteDetails.savings) || Math.max(totalPrice - payInFullPrice, 0);
    const payInFullLabel = savings > 0
      ? `£${payInFullPrice} upfront · save £${savings}`
      : `£${payInFullPrice} upfront`;
    const payInFullHeading = savings > 0 ? 'Pay in full · Save 10%' : 'Pay in full';

    // Branded, transactional-friendly quote email that matches the "peach price card"
    // design. One template for all mailbox providers.
    const brandedHtml = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Your ${vehicleDisplay} warranty quote</title></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;line-height:1.5;color:#0f172a;margin:0;padding:0;background-color:#ffffff;-webkit-font-smoothing:antialiased;">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">Your ${vehicleDisplay} warranty quote from Buyawarranty.&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#ffffff;"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #E8ECF0;">
  <tr><td align="center" style="padding:28px 24px 12px 24px;">
    <a href="https://buyawarranty.co.uk" target="_blank" style="text-decoration:none;">
      <img src="https://buyawarranty.co.uk/lovable-uploads/baw-logo-new-2025.png" alt="buyawarranty" width="160" style="display:block;width:160px;max-width:100%;height:auto;border:0;" />
    </a>
  </td></tr>
  <tr><td style="padding:16px 32px 4px 32px;">
    <p style="font-size:12px;color:#64748b;margin:0 0 6px 0;text-transform:uppercase;letter-spacing:1.2px;font-weight:600;">Hi ${firstName} — your quote</p>
    <h1 style="font-size:24px;font-weight:700;color:#0f172a;margin:0 0 20px 0;line-height:1.25;">${vehicleDisplay} · ${planDisplay} cover</h1>
  </td></tr>
  <tr><td style="padding:0 32px 8px 32px;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#FFE9D6;border-radius:10px;">
      <tr>
        <td style="padding:22px 24px;" valign="middle">
          <p style="font-size:12px;color:#c2410c;margin:0 0 4px 0;font-weight:700;letter-spacing:1px;">FROM</p>
          <p style="margin:0;font-size:40px;line-height:1;font-weight:800;color:#ea580c;">£${monthlyPrice}<span style="font-size:18px;font-weight:700;color:#ea580c;">/mo</span></p>
          <p style="margin:8px 0 0 0;font-size:14px;color:#7c2d12;">or £${payInFullPrice} upfront${savings > 0 ? ` · <strong>save £${savings}</strong>` : ''}</p>
        </td>
        <td align="right" style="padding:22px 24px;" valign="middle">
          <a href="${safeQuoteLink}" style="display:inline-block;background:#ea580c;color:#ffffff;padding:16px 26px;text-decoration:none;border-radius:8px;font-weight:700;font-size:16px;">Activate &nbsp;&rarr;</a>
        </td>
      </tr>
    </table>
    <p style="text-align:center;font-size:13px;color:#64748b;margin:12px 0 4px 0;">🔒 Takes 2 minutes</p>
  </td></tr>
  <tr><td style="padding:20px 32px 8px 32px;">
    <p style="font-size:12px;color:#64748b;margin:0 0 10px 0;text-transform:uppercase;letter-spacing:1.2px;font-weight:700;">Your cover</p>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border:1px solid #E8ECF0;border-radius:10px;">
      <tr><td style="padding:14px 18px;border-bottom:1px solid #E8ECF0;font-size:14px;color:#475569;">Vehicle</td><td align="right" style="padding:14px 18px;border-bottom:1px solid #E8ECF0;font-size:14px;color:#0f172a;font-weight:600;">${vehicleRegDisplay} · ${mileageDisplay.toLocaleString()} mi</td></tr>
      <tr><td style="padding:14px 18px;border-bottom:1px solid #E8ECF0;font-size:14px;color:#475569;">Cover period</td><td align="right" style="padding:14px 18px;border-bottom:1px solid #E8ECF0;font-size:14px;color:#0f172a;font-weight:600;">${escapeHtml(coverPeriodDisplay)}</td></tr>
      <tr><td style="padding:14px 18px;border-bottom:1px solid #E8ECF0;font-size:14px;color:#475569;">Claim limit</td><td align="right" style="padding:14px 18px;border-bottom:1px solid #E8ECF0;font-size:14px;color:#0f172a;font-weight:600;">£${claimLimitDisplay.toLocaleString()} per claim</td></tr>
      <tr><td style="padding:14px 18px;border-bottom:1px solid #E8ECF0;font-size:14px;color:#475569;">Excess</td><td align="right" style="padding:14px 18px;border-bottom:1px solid #E8ECF0;font-size:14px;color:#0f172a;font-weight:600;">£${excessAmountDisplay}</td></tr>
      <tr><td style="padding:14px 18px;font-size:14px;color:#475569;">Labour rate</td><td align="right" style="padding:14px 18px;font-size:14px;color:#0f172a;font-weight:600;">£${labourRateDisplay}/hr</td></tr>
    </table>
  </td></tr>
  <tr><td style="padding:20px 32px 28px 32px;">
    <p style="font-size:14px;color:#475569;margin:0;">Need a hand? Call <a href="tel:03302295040" style="color:#ea580c;text-decoration:none;font-weight:600;">0330 229 5040</a> (Mon–Fri) or reply to this email.</p>
    <p style="font-size:14px;color:#475569;margin:14px 0 0 0;">Kind regards,<br><strong style="color:#0f172a;">${escapeHtml(sanitizedAgentName || 'Buyawarranty Customer Care')}</strong></p>
  </td></tr>
</table>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:600px;"><tr><td align="center" style="padding:16px 16px 8px 16px;">
  <p style="font-size:11px;color:#94a3b8;margin:0;line-height:1.5;">Buyawarranty.co.uk is a trading name of Buy A Warranty Limited. Company number 10314863.<br>Registered address: Warranty House, 62 Berkhamsted Ave, Wembley, HA9 6DT, England.</p>
</td></tr></table>
</td></tr></table></body></html>`;

    const finalHtml = brandedHtml;

    // Normalize copy recipients (accept string or array, dedupe, drop the primary recipient)
    const normalize = (v: string | string[] | undefined): string[] | undefined => {
      if (!v) return undefined;
      const arr = (Array.isArray(v) ? v : [v])
        .map((e) => (e || "").trim())
        .filter((e) => isValidEmail(e) && e.toLowerCase() !== to.toLowerCase());
      const unique = Array.from(new Set(arr.map((e) => e.toLowerCase())))
        .map((lc) => arr.find((e) => e.toLowerCase() === lc)!) as string[];
      return unique.length ? unique : undefined;
    };
    const copyInput = [
      ...(agentCopyEmail ? [agentCopyEmail] : []),
      ...(Array.isArray(copyRecipients) ? copyRecipients : []),
      ...(Array.isArray(bcc) ? bcc : bcc ? [bcc] : []),
      ...(Array.isArray(cc) ? cc : cc ? [cc] : []),
    ];
    const internalCopyRecipients = normalize(copyInput);

    console.log("Resolved recipients →", { to, internalCopies: internalCopyRecipients });

    // sanitizedAgentName defined above (needed by HTML templates)
    const agentEmailClean = (agentCopyEmail || '').trim();
    const useAgentReplyTo = isValidEmail(agentEmailClean);
    const replyToAddress = useAgentReplyTo ? agentEmailClean : "support@buyawarranty.co.uk";
    const fromName = sanitizedAgentName
      ? `${sanitizedAgentName} at Buyawarranty`
      : "Buyawarranty Customer Care";
    // Send customer quotes from support@ (established sender reputation).
    // quotes@ was newer and being scored as a marketing subdomain by Gmail/iCloud.
    const fromHeader = `${fromName} <support@buyawarranty.co.uk>`;

    // Build plain-text alternative for deliverability
    const plainText = [
      `Hi ${plainFirstName},`,
      ``,
      `Here is your ${plainVehicleDisplay} ${plainPlanDisplay} cover quote:`,
      `- From £${monthlyPrice}/month (${coverPeriodDisplay})`,
      `- Or ${payInFullLabel}`,
      `- Vehicle: ${vehicleData.regNumber} · ${mileageDisplay.toLocaleString()} miles`,
      `- Claim limit: £${claimLimitDisplay.toLocaleString()} per claim`,
      `- Excess: £${excessAmountDisplay} · Labour up to £${labourRateDisplay}/hr`,
      ``,
      `View your quote here: ${safeQuoteLink}`,
      ``,
      `Need a hand? Call 0330 229 5040 (Mon–Fri) or reply to this email.`,
      ``,
      `Buyawarranty · https://buyawarranty.co.uk`,
    ].join('\n');

    // NOTE: intentionally NO List-Unsubscribe header on 1:1 quote emails.
    // That header signals bulk/marketing to Gmail & iCloud and pushes the
    // message to Promotions/Spam. Quotes are individually requested = transactional.
    const deliverabilityHeaders: Record<string, string> = {
      'X-Entity-Ref-ID': crypto.randomUUID(),
    };

    const emailResponse = await resend.emails.send({
      from: fromHeader,
      to: [to],
      subject: safeSubject,
      html: finalHtml,
      text: plainText,
      reply_to: replyToAddress,
      headers: deliverabilityHeaders,
      tags: [
        { name: 'template', value: 'admin_quote' },
        { name: 'source', value: 'admin_dashboard' },
        { name: 'mailbox', value: mailboxProvider.replace(/[^a-z0-9_-]/g, '_').slice(0, 40) },
        { name: 'strict_mailbox', value: isStrictMailboxProvider ? 'true' : 'false' },
      ],
    });


    if (emailResponse.error) {
      console.error("Customer quote email rejected by provider:", emailResponse.error);
      await logCustomerEmail({
        recipient_email: to,
        recipient_name: customerName,
        subject: safeSubject,
        template_name: 'admin_quote',
        source_function: 'send-admin-quote',
        status: 'failed',
        error_message: emailResponse.error.message || 'Email provider rejected the customer email',
        registration_plate: vehicleData.regNumber,
        metadata: { quote_link: safeQuoteLink, plan: plainPlanDisplay, provider_error: emailResponse.error, mailbox_provider: mailboxProvider },
      });
      throw new Error(emailResponse.error.message || "Email provider rejected the customer email");
    }

    console.log("Customer quote email accepted:", emailResponse.data);

    const copyResults: Array<{ email: string; id?: string; delivery: 'separate_copy'; error?: string }> = [];
    for (const copyEmail of internalCopyRecipients || []) {
      const copySubject = `[Internal] Quote sent — ${vehicleData.regNumber} → ${to}`;

      // Simple plain-text-style HTML summary (no marketing template) to avoid
      // spam filtering of near-duplicate content in staff inboxes.
      const copyHtml = `<!DOCTYPE html><html><body style="font-family:-apple-system,Segoe UI,Arial,sans-serif;font-size:14px;color:#111;line-height:1.5;margin:0;padding:16px;">
<p style="margin:0 0 12px 0;"><strong>Internal notification — quote sent to customer.</strong></p>
<table cellpadding="4" cellspacing="0" border="0" style="font-size:14px;">
<tr><td style="color:#555;">Customer</td><td>${escapeHtml(customerName || '')} &lt;${escapeHtml(to)}&gt;</td></tr>
<tr><td style="color:#555;">Vehicle</td><td>${vehicleRegDisplay} · ${vehicleDisplay}</td></tr>
<tr><td style="color:#555;">Plan</td><td>${planDisplay} · ${escapeHtml(coverPeriodDisplay)}</td></tr>
<tr><td style="color:#555;">Monthly</td><td>£${monthlyPrice}</td></tr>
<tr><td style="color:#555;">Pay in full</td><td>£${payInFullPrice}${savings > 0 ? ` (save £${savings})` : ''}</td></tr>
<tr><td style="color:#555;">Claim limit</td><td>£${claimLimitDisplay.toLocaleString()}</td></tr>
<tr><td style="color:#555;">Excess</td><td>£${excessAmountDisplay}</td></tr>
<tr><td style="color:#555;">Sent by</td><td>${escapeHtml(sanitizedAgentName || 'System')}</td></tr>
<tr><td style="color:#555;">Customer msg ID</td><td>${escapeHtml(emailResponse.data?.id || '')}</td></tr>
</table>
<p style="margin:12px 0 0 0;">Quote link: <a href="${safeQuoteLink}">${escapeHtml(safeQuoteLink)}</a></p>
<p style="margin:12px 0 0 0;color:#777;font-size:12px;">This is an internal system copy. Do not forward to the customer.</p>
</body></html>`;

      const copyText = [
        `Internal notification — quote sent to customer.`,
        ``,
        `Customer: ${customerName || ''} <${to}>`,
        `Vehicle: ${vehicleData.regNumber} · ${plainVehicleDisplay}`,
        `Plan: ${plainPlanDisplay} · ${coverPeriodDisplay}`,
        `Monthly: £${monthlyPrice}`,
        `Pay in full: £${payInFullPrice}${savings > 0 ? ` (save £${savings})` : ''}`,
        `Claim limit: £${claimLimitDisplay.toLocaleString()}`,
        `Excess: £${excessAmountDisplay}`,
        `Sent by: ${sanitizedAgentName || 'System'}`,
        `Customer message ID: ${emailResponse.data?.id || ''}`,
        ``,
        `Quote link: ${safeQuoteLink}`,
      ].join('\n');

      // Distinct From (notifications subdomain sender) + Auto-Submitted so
      // Google/Outlook treat the internal copy differently from the customer
      // marketing email and don't dedupe/spam-filter it.
      const copyFromHeader = `Buyawarranty CRM <notifications@buyawarranty.co.uk>`;

      const copyResponse = await resend.emails.send({
        from: copyFromHeader,
        to: [copyEmail],
        subject: copySubject,
        html: copyHtml,
        text: copyText,
        reply_to: replyToAddress,
        headers: {
          'Auto-Submitted': 'auto-generated',
          'X-Auto-Response-Suppress': 'All',
          'X-Entity-Ref-ID': crypto.randomUUID(),
          'X-BAW-Internal-Copy': 'true',
          'X-BAW-Customer-Message-Id': emailResponse.data?.id || '',
        },
        tags: [
          { name: 'template', value: 'admin_quote_copy' },
          { name: 'source', value: 'admin_dashboard' },
        ],
      });

      if (copyResponse.error) {
        console.error("Internal quote copy rejected by provider:", { copyEmail, error: copyResponse.error });
        copyResults.push({ email: copyEmail, delivery: 'separate_copy', error: copyResponse.error.message });
        await logCustomerEmail({
          recipient_email: copyEmail,
          subject: copySubject,
          template_name: 'admin_quote_copy',
          source_function: 'send-admin-quote',
          status: 'failed',
          error_message: copyResponse.error.message || 'Email provider rejected the internal copy',
          registration_plate: vehicleData.regNumber,
          metadata: { customer_recipient: to, quote_link: safeQuoteLink, customer_provider_message_id: emailResponse.data?.id, delivery: 'separate_copy' },
        });
        continue;
      }

      console.log("Internal quote copy sent separately:", { copyEmail, messageId: copyResponse.data?.id });
      copyResults.push({ email: copyEmail, id: copyResponse.data?.id, delivery: 'separate_copy' });
      await logCustomerEmail({
        recipient_email: copyEmail,
        subject: copySubject,
        template_name: 'admin_quote_copy',
        source_function: 'send-admin-quote',
        status: 'sent',
        registration_plate: vehicleData.regNumber,
        metadata: { customer_recipient: to, quote_link: safeQuoteLink, provider_message_id: copyResponse.data?.id, customer_provider_message_id: emailResponse.data?.id, delivery: 'separate_copy' },
      });
    }


    await logCustomerEmail({
      recipient_email: to,
      recipient_name: customerName,
      subject: safeSubject,
      template_name: 'admin_quote',
      source_function: 'send-admin-quote',
      status: 'sent',
      registration_plate: vehicleData.regNumber,
        metadata: { copy_recipients: internalCopyRecipients, copy_results: copyResults, quote_link: safeQuoteLink, plan: plainPlanDisplay, provider_message_id: emailResponse.data?.id, mailbox_provider: mailboxProvider, strict_mailbox_provider: isStrictMailboxProvider }
    });

    return jsonResponse({
      customerMessageId: emailResponse.data?.id,
      copyResults,
    });
  } catch (error: any) {
    console.error("Error in send-admin-quote function:", error);
    return jsonResponse({ error: error.message }, 500);
  }
};

serve(handler);
