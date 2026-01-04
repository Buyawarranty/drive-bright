import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface UpgradeChange {
  from: number;
  to: number;
}

interface UpgradeRequest {
  customerEmail: string;
  customerName: string;
  registrationPlate: string;
  changes: {
    claimLimit?: UpgradeChange | null;
    labourRate?: UpgradeChange | null;
    excess?: UpgradeChange | null;
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY not configured");
    }

    const resend = new Resend(resendApiKey);
    const { customerEmail, customerName, registrationPlate, changes }: UpgradeRequest = await req.json();

    console.log(`Sending warranty upgrade notification to ${customerEmail}`);

    // Build the changes HTML
    const changesHtml: string[] = [];
    
    if (changes.claimLimit) {
      changesHtml.push(`
        <tr>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">
            <strong>Claim Limit</strong>
          </td>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-decoration: line-through; color: #9ca3af;">
            £${changes.claimLimit.from.toLocaleString()}
          </td>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; color: #059669; font-weight: bold;">
            £${changes.claimLimit.to.toLocaleString()}
          </td>
        </tr>
      `);
    }
    
    if (changes.labourRate) {
      changesHtml.push(`
        <tr>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">
            <strong>Labour Rate</strong>
          </td>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-decoration: line-through; color: #9ca3af;">
            £${changes.labourRate.from}/hr
          </td>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; color: #059669; font-weight: bold;">
            £${changes.labourRate.to}/hr
          </td>
        </tr>
      `);
    }
    
    if (changes.excess) {
      changesHtml.push(`
        <tr>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">
            <strong>Voluntary Excess</strong>
          </td>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-decoration: line-through; color: #9ca3af;">
            £${changes.excess.from}
          </td>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; color: #059669; font-weight: bold;">
            £${changes.excess.to}
          </td>
        </tr>
      `);
    }

    const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f9fafb;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; padding: 40px 20px;">
        <tr>
          <td align="center">
            <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
              <!-- Header -->
              <tr>
                <td style="background: linear-gradient(135deg, #f59e0b 0%, #ea580c 100%); padding: 30px; text-align: center;">
                  <h1 style="color: #ffffff; margin: 0; font-size: 24px;">✨ Your Warranty Has Been Upgraded</h1>
                </td>
              </tr>
              
              <!-- Content -->
              <tr>
                <td style="padding: 40px 30px;">
                  <p style="font-size: 16px; color: #374151; margin-bottom: 20px;">
                    Dear ${customerName || 'Valued Customer'},
                  </p>
                  
                  <p style="font-size: 16px; color: #374151; margin-bottom: 20px;">
                    Great news! We've made some upgrades to your warranty for vehicle <strong>${registrationPlate}</strong>. 
                    Here's a summary of the changes:
                  </p>
                  
                  <!-- Changes Table -->
                  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; border-radius: 8px; margin: 20px 0;">
                    <tr>
                      <th style="padding: 12px; text-align: left; background-color: #374151; color: #ffffff; border-radius: 8px 0 0 0;">Detail</th>
                      <th style="padding: 12px; text-align: left; background-color: #374151; color: #ffffff;">Previous</th>
                      <th style="padding: 12px; text-align: left; background-color: #374151; color: #ffffff; border-radius: 0 8px 0 0;">New Value</th>
                    </tr>
                    ${changesHtml.join('')}
                  </table>
                  
                  <p style="font-size: 16px; color: #374151; margin-bottom: 20px;">
                    These changes are effective immediately. You can view your updated warranty details in your customer portal.
                  </p>
                  
                  <div style="text-align: center; margin: 30px 0;">
                    <a href="https://pricing.buyawarranty.co.uk/customer-dashboard" 
                       style="display: inline-block; background: linear-gradient(135deg, #f59e0b 0%, #ea580c 100%); color: #ffffff; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: bold;">
                      View My Warranty
                    </a>
                  </div>
                  
                  <p style="font-size: 14px; color: #6b7280; margin-top: 30px;">
                    If you have any questions about these changes, please don't hesitate to contact us.
                  </p>
                </td>
              </tr>
              
              <!-- Footer -->
              <tr>
                <td style="background-color: #f9fafb; padding: 20px 30px; text-align: center; border-top: 1px solid #e5e7eb;">
                  <p style="font-size: 12px; color: #9ca3af; margin: 0;">
                    © ${new Date().getFullYear()} BuyAWarranty.co.uk | All rights reserved
                  </p>
                  <p style="font-size: 12px; color: #9ca3af; margin: 5px 0 0 0;">
                    <a href="https://buyawarranty.co.uk" style="color: #f59e0b; text-decoration: none;">Visit our website</a>
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
    `;

    const { data, error } = await resend.emails.send({
      from: "Buyawarranty Customer Care <noreply@buyawarranty.co.uk>",
      to: [customerEmail],
      subject: `✨ Your Warranty for ${registrationPlate} Has Been Upgraded`,
      html: htmlContent,
    });

    if (error) {
      console.error("Resend error:", error);
      throw error;
    }

    console.log("Upgrade notification sent successfully:", data);

    return new Response(JSON.stringify({ success: true, messageId: data?.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Error sending upgrade notification:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
