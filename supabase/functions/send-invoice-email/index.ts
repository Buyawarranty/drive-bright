import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface InvoiceData {
  customerId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  customerAddress: string;
  invoiceNumber: string;
  invoiceDate: string;
  purchaseDate: string;
  planType: string;
  vehicleMake: string;
  vehicleModel: string;
  registrationPlate: string;
  paymentType: string;
  amount: number;
  warrantyNumber: string;
  invoiceHtml: string;
}

interface SendInvoiceRequest {
  recipientEmail: string;
  invoices: InvoiceData[];
  subject: string;
}

const logStep = (step: string, details?: unknown) => {
  console.log(`[send-invoice-email] ${step}`, details ? JSON.stringify(details, null, 2) : '');
};

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP'
  }).format(amount || 0);
};

const generateEmailHTML = (invoices: InvoiceData[]): string => {
  const totalAmount = invoices.reduce((sum, inv) => sum + (inv.amount || 0), 0);
  const invoiceCount = invoices.length;
  
  const invoiceSummaryRows = invoices.map(inv => `
    <tr>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; font-size: 14px;">${inv.invoiceNumber}</td>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; font-size: 14px;">${inv.customerName}</td>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; font-size: 14px;">${inv.registrationPlate}</td>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; font-size: 14px;">${inv.planType}</td>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; font-size: 14px; text-align: right;">${formatCurrency(inv.amount)}</td>
    </tr>
  `).join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 700px; margin: 0 auto; padding: 20px;">
      <div style="text-align: center; margin-bottom: 30px; border-bottom: 3px solid #f97316; padding-bottom: 20px;">
        <img src="https://buyawarranty.co.uk/lovable-uploads/e4a0c8c7-1d74-4e55-a556-1b513ba12cc8.png" alt="Buy A Warranty" style="max-width: 200px; height: auto;" />
      </div>
      
      <h1 style="color: #f97316; font-size: 24px; margin-bottom: 20px;">Invoice${invoiceCount > 1 ? 's' : ''} Attached</h1>
      
      <p style="font-size: 14px; color: #666; margin-bottom: 20px;">
        Please find attached ${invoiceCount} invoice${invoiceCount > 1 ? 's' : ''} from Buy A Warranty.
      </p>
      
      <div style="background: #f9fafb; border-radius: 8px; padding: 20px; margin-bottom: 30px;">
        <h3 style="color: #f97316; margin-top: 0; font-size: 16px;">Invoice Summary</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="background: #f97316;">
              <th style="padding: 12px; text-align: left; color: white; font-size: 12px;">Invoice #</th>
              <th style="padding: 12px; text-align: left; color: white; font-size: 12px;">Customer</th>
              <th style="padding: 12px; text-align: left; color: white; font-size: 12px;">Registration</th>
              <th style="padding: 12px; text-align: left; color: white; font-size: 12px;">Plan</th>
              <th style="padding: 12px; text-align: right; color: white; font-size: 12px;">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${invoiceSummaryRows}
          </tbody>
          <tfoot>
            <tr style="background: #f3f4f6;">
              <td colspan="4" style="padding: 12px; font-weight: bold; font-size: 14px;">Total</td>
              <td style="padding: 12px; font-weight: bold; font-size: 14px; text-align: right; color: #f97316;">${formatCurrency(totalAmount)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      
      <p style="font-size: 14px; color: #666; margin-bottom: 20px;">
        The individual invoice${invoiceCount > 1 ? 's are' : ' is'} attached to this email in HTML format. You can open ${invoiceCount > 1 ? 'them' : 'it'} in your browser and print to PDF for your records.
      </p>
      
      <div style="background: #fef3c7; border-radius: 8px; padding: 15px; margin-bottom: 30px;">
        <p style="margin: 0; font-size: 13px; color: #92400e;">
          <strong>Note:</strong> All invoices are issued in UK format (GBP, DD/MM/YYYY).
        </p>
      </div>
      
      <div style="border-top: 1px solid #e5e7eb; padding-top: 20px; text-align: center; color: #666; font-size: 12px;">
        <p style="margin: 5px 0;"><strong>Buy A Warranty</strong></p>
        <p style="margin: 5px 0;">www.buyawarranty.co.uk</p>
        <p style="margin: 5px 0;">support@buyawarranty.co.uk | 0330 229 5040</p>
      </div>
    </body>
    </html>
  `;
};

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Starting send-invoice-email function");
    
    const { recipientEmail, invoices, subject }: SendInvoiceRequest = await req.json();
    
    logStep("Received request", { 
      recipientEmail, 
      invoiceCount: invoices?.length,
      subject 
    });

    if (!recipientEmail || !invoices || invoices.length === 0) {
      throw new Error("Missing required fields: recipientEmail and invoices");
    }

    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY is not configured");
    }

    // Generate email HTML
    const emailHtml = generateEmailHTML(invoices);
    
    // Create attachments from invoice HTML using btoa for base64 encoding
    const attachments = invoices.map(invoice => ({
      filename: `${invoice.invoiceNumber}_${invoice.customerName.replace(/[^a-zA-Z0-9]/g, '_')}.html`,
      content: btoa(unescape(encodeURIComponent(invoice.invoiceHtml))),
    }));

    logStep("Sending email with attachments", { 
      attachmentCount: attachments.length,
      recipientEmail 
    });

    // Send email using Resend API directly
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "BuyaWarranty Team <invoices@buyawarranty.co.uk>",
        to: [recipientEmail],
        subject: subject || `Invoice from BuyaWarranty`,
        html: emailHtml,
        attachments: attachments.map(att => ({
          filename: att.filename,
          content: att.content
        }))
      }),
    });

    const emailResponse = await response.json();

    if (!response.ok) {
      logStep("Resend API error", emailResponse);
      throw new Error(emailResponse.message || "Failed to send email");
    }

    logStep("Email sent successfully", emailResponse);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `${invoices.length} invoice(s) sent successfully`,
        emailId: emailResponse.id 
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    logStep("Error sending invoice email", { error: errorMessage });
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage 
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
