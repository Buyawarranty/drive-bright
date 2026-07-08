import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { logCustomerEmail } from '../_shared/log-email.ts';
import { requireAdmin } from '../_shared/admin-auth.ts';
import { renderBrandedQuoteEmail } from '../_shared/quote-email-template.ts';

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
    if (!['https:', 'http:'].includes(url.protocol)) return null;
    const host = url.hostname.toLowerCase();
    const allowedExact = new Set(['buyawarranty.co.uk', 'www.buyawarranty.co.uk']);
    const allowedSuffixes = ['.lovable.app', '.lovable.dev', '.lovableproject.com'];
    const ok = allowedExact.has(host) || allowedSuffixes.some((s) => host.endsWith(s));
    if (!ok) return null;
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
  copyOnly?: boolean;
  originalRecipientEmail?: string | null;
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
      copyOnly,
      originalRecipientEmail,
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
      ? `${coverMonths} months plus ${bonusMonths} additional months included`
      : `${coverMonths} months`;

    const totalPrice = Number(quoteDetails.totalPrice ?? quoteDetails.price) || 0;
    const monthlyPrice = Number(quoteDetails.monthlyPrice) || Math.round((totalPrice / Math.max(coverMonths, 1)) * 100) / 100;
    const payInFullPrice = Number(quoteDetails.payInFullPrice) || (
      quoteDetails.includePayInFullDiscount ? Math.floor(totalPrice * 0.9) : totalPrice
    );
    const savings = Number(quoteDetails.savings) || Math.max(totalPrice - payInFullPrice, 0);
    const payInFullLabel = savings > 0
      ? `£${payInFullPrice} upfront`
      : `£${payInFullPrice} upfront`;

    // Branded, Primary-inbox-friendly template (single CTA, no promo code, no urgency).
    const brandedHtml = renderBrandedQuoteEmail({
      firstName: plainFirstName,
      vehicleDisplay: plainVehicleDisplay,
      vehicleReg: vehicleData.regNumber || '',
      planName: plainPlanDisplay,
      coverPeriodDisplay,
      monthlyPrice,
      payInFullPrice,
      savings,
      claimLimit: claimLimitDisplay,
      excessAmount: excessAmountDisplay,
      labourRate: labourRateDisplay,
      mileage: mileageDisplay,
      quoteLink: safeQuoteLink,
      senderName: sanitizedAgentName || null,
    });

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
    // Match send-welcome-email exactly — that sender/domain combo lands in
    // the Primary inbox. Use noreply@ (established reputation) rather than
    // support@ or quotes@, and keep the "Customer Care" display name.
    const fromName = sanitizedAgentName
      ? `${sanitizedAgentName} at Buyawarranty`
      : "Buyawarranty Customer Care";
    const fromHeader = `${fromName} <noreply@buyawarranty.co.uk>`;

    // Build plain-text alternative for deliverability
    const plainText = [
      `Hi ${plainFirstName},`,
      ``,
      `Here are the quote details for your ${plainVehicleDisplay} ${plainPlanDisplay} cover:`,
      `- From £${monthlyPrice}/month (${coverPeriodDisplay})`,
      `- Or ${payInFullLabel}`,
      `- Vehicle: ${vehicleData.regNumber} · ${mileageDisplay.toLocaleString()} miles`,
      `- Claim limit: £${claimLimitDisplay.toLocaleString()} per claim`,
      `- Excess: £${excessAmountDisplay} · Labour up to £${labourRateDisplay}/hr`,
      ``,
      `Quote details link: ${safeQuoteLink}`,
      ``,
      `Need a hand? Call 0330 229 5040 (Mon–Fri) or reply to this email.`,
      ``,
      `Buyawarranty · https://buyawarranty.co.uk`,
    ].join('\n');

    // NOTE: intentionally NO List-Unsubscribe header on 1:1 quote emails.
    // That header signals bulk/marketing to Gmail & iCloud and pushes the
    // message to Promotions/Spam. Quotes are individually requested = transactional.
    const deliverabilityHeaders: Record<string, string> = {};

    if (copyOnly === true) {
      const originalRecipient = sanitizeEmail(originalRecipientEmail);
      const copySubject = safeSubject.startsWith('[Your copy]')
        ? safeSubject
        : `[Your copy] ${safeSubject}`.slice(0, 140);

      const copyResponse = await resend.emails.send({
        from: fromHeader,
        to: [to],
        subject: copySubject,
        html: finalHtml,
        text: plainText,
        reply_to: isValidEmail(originalRecipient) ? originalRecipient : replyToAddress,
        headers: {
          'X-BAW-Agent-Copy': 'true',
        },
        tags: [
          { name: 'template', value: 'admin_quote_agent_copy' },
          { name: 'source', value: 'admin_dashboard' },
        ],
      });

      if (copyResponse.error) {
        console.error("Agent-only quote copy rejected by provider:", { to, error: copyResponse.error });
        await logCustomerEmail({
          recipient_email: to,
          subject: copySubject,
          template_name: 'admin_quote_agent_copy',
          source_function: 'send-admin-quote',
          status: 'failed',
          error_message: copyResponse.error.message || 'Email provider rejected the agent copy',
          registration_plate: vehicleData.regNumber,
          metadata: { customer_recipient: originalRecipient || null, quote_link: safeQuoteLink, delivery: 'agent_copy_only' },
        });
        throw new Error(copyResponse.error.message || "Email provider rejected the agent copy");
      }

      console.log("Agent-only quote copy sent (branded):", { copyEmail: to, messageId: copyResponse.data?.id });
      await logCustomerEmail({
        recipient_email: to,
        subject: copySubject,
        template_name: 'admin_quote_agent_copy',
        source_function: 'send-admin-quote',
        status: 'sent',
        registration_plate: vehicleData.regNumber,
        metadata: { customer_recipient: originalRecipient || null, quote_link: safeQuoteLink, provider_message_id: copyResponse.data?.id, delivery: 'agent_copy_only' },
      });

      return jsonResponse({
        customerMessageId: null,
        copyResults: [{ email: to, id: copyResponse.data?.id, delivery: 'agent_copy' }],
      });
    }

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
