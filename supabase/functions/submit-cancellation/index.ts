import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface CancellationRequest {
  registrationPlate: string;
  fullName: string;
  reason: string;
  feedback?: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      registrationPlate, 
      fullName, 
      reason, 
      feedback 
    }: CancellationRequest = await req.json();

    console.log("Processing cancellation request for:", registrationPlate);

    // Send email to support team
    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "Buy a Warranty <noreply@buyawarranty.co.uk>",
        to: ["support@buyawarranty.co.uk"],
        subject: `Warranty Cancellation Request - ${registrationPlate}`,
        html: `
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <style>
                body {
                  font-family: Arial, sans-serif;
                  line-height: 1.6;
                  color: #333;
                  max-width: 600px;
                  margin: 0 auto;
                  padding: 20px;
                }
                .header {
                  background-color: #ff6b35;
                  color: white;
                  padding: 20px;
                  text-align: center;
                  border-radius: 8px 8px 0 0;
                }
                .content {
                  background-color: #f9f9f9;
                  padding: 30px;
                  border-radius: 0 0 8px 8px;
                }
                .info-row {
                  margin: 15px 0;
                  padding: 10px;
                  background-color: white;
                  border-left: 4px solid #ff6b35;
                }
                .label {
                  font-weight: bold;
                  color: #ff6b35;
                }
                .feedback-box {
                  background-color: white;
                  padding: 15px;
                  margin-top: 20px;
                  border-radius: 5px;
                  border: 1px solid #ddd;
                }
              </style>
            </head>
            <body>
              <div class="header">
                <h1>⚠️ Warranty Cancellation Request</h1>
              </div>
              <div class="content">
                <p>A customer has submitted a warranty cancellation request:</p>
                
                <div class="info-row">
                  <span class="label">Registration Plate:</span><br>
                  ${registrationPlate}
                </div>
                
                <div class="info-row">
                  <span class="label">Full Name:</span><br>
                  ${fullName}
                </div>
                
                <div class="info-row">
                  <span class="label">Reason for Cancellation:</span><br>
                  ${reason}
                </div>
                
                ${feedback ? `
                  <div class="feedback-box">
                    <span class="label">Customer Feedback:</span><br>
                    <p>${feedback.replace(/\n/g, '<br>')}</p>
                  </div>
                ` : ''}
                
                <p style="margin-top: 30px; padding-top: 20px; border-top: 2px solid #ddd;">
                  <strong>Next Steps:</strong><br>
                  1. Review the cancellation request<br>
                  2. Process refund within 2-3 working days<br>
                  3. Update customer records
                </p>
              </div>
            </body>
          </html>
        `,
      }),
    });

    if (!emailResponse.ok) {
      const errorText = await emailResponse.text();
      console.error("Resend API error:", errorText);
      throw new Error(`Failed to send email: ${errorText}`);
    }

    const emailData = await emailResponse.json();
    console.log("Email sent successfully:", emailData);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Cancellation request submitted successfully",
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
  } catch (error: any) {
    console.error("Error in submit-cancellation function:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
