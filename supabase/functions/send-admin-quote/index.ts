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

    // Plain, 1-to-1 style email — avoids Gmail Promotions signals:
    //   - no coloured price banner, no big CTA button, no hero image, no emoji
    //   - plain paragraphs, single text link, black-on-white typography
    //   - reads like a personal reply from the agent
    const senderNameForSignoff = escapeHtml(sanitizedAgentName || 'Buyawarranty Customer Care');
    const brandedHtml = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Your ${vehicleDisplay} warranty quote</title></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;font-size:15px;line-height:1.55;color:#111111;margin:0;padding:0;background:#ffffff;">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">Your ${vehicleDisplay} warranty quote — details inside.</div>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td align="left" style="padding:24px 20px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:620px;">
  <tr><td style="padding:0 0 12px 0;font-size:15px;color:#111111;">
    <p style="margin:0 0 14px 0;">Hi ${firstName},</p>
    <p style="margin:0 0 14px 0;">Thanks for your interest — here's the warranty quote for your ${vehicleDisplay} (${vehicleRegDisplay}):</p>
    <p style="margin:0 0 6px 0;">&bull; Plan: ${planDisplay}</p>
    <p style="margin:0 0 6px 0;">&bull; Cover period: ${escapeHtml(coverPeriodDisplay)}</p>
    <p style="margin:0 0 6px 0;">&bull; From £${monthlyPrice} per month, or £${payInFullPrice} paid upfront${savings > 0 ? ` (saves £${savings})` : ''}</p>
    <p style="margin:0 0 6px 0;">&bull; Claim limit: £${claimLimitDisplay.toLocaleString()} per claim</p>
    <p style="margin:0 0 6px 0;">&bull; Excess: £${excessAmountDisplay}</p>
    <p style="margin:0 0 6px 0;">&bull; Labour rate: up to £${labourRateDisplay}/hr</p>
    <p style="margin:0 0 6px 0;">&bull; Mileage on file: ${mileageDisplay.toLocaleString()}</p>
    <p style="margin:18px 0 14px 0;">You can review the full details and activate your cover here:<br><a href="${safeQuoteLink}" style="color:#0a58ca;text-decoration:underline;">${safeQuoteLink}</a></p>
    <p style="margin:0 0 14px 0;">If you have any questions, just reply to this email or give me a call on 0330 229 5040 (Mon&ndash;Fri).</p>
    <p style="margin:0 0 4px 0;">Kind regards,</p>
    <p style="margin:0 0 4px 0;">${senderNameForSignoff}<br>Buyawarranty</p>
  </td></tr>
  <tr><td style="padding:22px 0 0 0;border-top:1px solid #eeeeee;font-size:11px;color:#888888;line-height:1.5;">
    Buyawarranty.co.uk is a trading name of Buy A Warranty Limited. Company number 10314863. Registered address: Warranty House, 62 Berkhamsted Ave, Wembley, HA9 6DT, England.
  </td></tr>
</table>
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

    const copyResults: Array<{ email: string; id?: string; delivery: 'agent_copy'; error?: string }> = [];
    for (const copyEmail of internalCopyRecipients || []) {
      // Send the EXACT same branded quote email to the agent/admin so they get
      // an identical copy of what the customer received — no separate "internal
      // summary" template. Use the same warm sender (support@) for good
      // deliverability, one recipient per send (no CC/BCC) so each message has
      // its own DKIM signature, and a distinct subject prefix so Gmail doesn't
      // collapse it into the customer's thread. Reply-to points at the customer
      // so replying goes to them.
      const copySubject = `[Your copy] ${safeSubject}`.slice(0, 140);

      const copyResponse = await resend.emails.send({
        from: fromHeader,
        to: [copyEmail],
        subject: copySubject,
        html: finalHtml,
        text: plainText,
        reply_to: to,
        headers: {
          'X-Entity-Ref-ID': crypto.randomUUID(),
          'X-BAW-Agent-Copy': 'true',
          'X-BAW-Customer-Message-Id': emailResponse.data?.id || '',
        },
        tags: [
          { name: 'template', value: 'admin_quote_agent_copy' },
          { name: 'source', value: 'admin_dashboard' },
        ],
      });

      if (copyResponse.error) {
        console.error("Agent quote copy rejected by provider:", { copyEmail, error: copyResponse.error });
        copyResults.push({ email: copyEmail, delivery: 'agent_copy', error: copyResponse.error.message });
        await logCustomerEmail({
          recipient_email: copyEmail,
          subject: copySubject,
          template_name: 'admin_quote_agent_copy',
          source_function: 'send-admin-quote',
          status: 'failed',
          error_message: copyResponse.error.message || 'Email provider rejected the agent copy',
          registration_plate: vehicleData.regNumber,
          metadata: { customer_recipient: to, quote_link: safeQuoteLink, customer_provider_message_id: emailResponse.data?.id, delivery: 'agent_copy' },
        });
        continue;
      }

      console.log("Agent quote copy sent (branded):", { copyEmail, messageId: copyResponse.data?.id });
      copyResults.push({ email: copyEmail, id: copyResponse.data?.id, delivery: 'agent_copy' });
      await logCustomerEmail({
        recipient_email: copyEmail,
        subject: copySubject,
        template_name: 'admin_quote_agent_copy',
        source_function: 'send-admin-quote',
        status: 'sent',
        registration_plate: vehicleData.regNumber,
        metadata: { customer_recipient: to, quote_link: safeQuoteLink, provider_message_id: copyResponse.data?.id, customer_provider_message_id: emailResponse.data?.id, delivery: 'agent_copy' },
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
