import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { subject, content } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const systemPrompt = `You are an expert email marketing consultant. Analyze email campaigns and provide actionable suggestions to improve performance.

Your task is to:
1. Generate 3 alternative subject lines that are more compelling and likely to increase open rates
2. Provide specific content improvements to increase engagement and click-through rates
3. Suggest the optimal send time based on email marketing best practices

Keep suggestions practical, actionable, and specific to warranty/insurance industry.`;

    const userPrompt = `Current email campaign:

Subject: ${subject || 'No subject yet'}

Content:
${content || 'No content yet'}

Please provide suggestions to improve this email campaign.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        tools: [{
          type: "function",
          function: {
            name: "provide_email_suggestions",
            description: "Provide suggestions for improving an email campaign",
            parameters: {
              type: "object",
              properties: {
                subject_lines: {
                  type: "array",
                  items: { type: "string" },
                  description: "3 alternative subject line suggestions"
                },
                content_improvements: {
                  type: "string",
                  description: "Improved email content with better engagement"
                },
                best_send_time: {
                  type: "string",
                  description: "Recommended send time with explanation"
                }
              },
              required: ["subject_lines", "content_improvements", "best_send_time"],
              additionalProperties: false
            }
          }
        }],
        tool_choice: { type: "function", function: { name: "provide_email_suggestions" } }
      }),
    });

    if (response.status === 429) {
      return new Response(
        JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (response.status === 402) {
      return new Response(
        JSON.stringify({ error: "Payment required. Please add credits to your workspace." }),
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!response.ok) {
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const data = await response.json();
    const toolCall = data.choices[0]?.message?.tool_calls?.[0];
    
    if (!toolCall) {
      throw new Error("No suggestions generated");
    }

    const args = JSON.parse(toolCall.function.arguments);

    return new Response(
      JSON.stringify({
        success: true,
        suggestions: {
          subject: args.subject_lines,
          content: args.content_improvements,
          sendTime: args.best_send_time
        }
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error: any) {
    console.error("Error in generate-email-suggestions:", error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
