import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface SurveySubmission {
  policyNumber: string;
  reasonsChosen: string[];
  otherReason: string;
  easeRating: string;
  easeExplanation: string;
  suggestions: string;
  submittedAt: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const surveyData: SurveySubmission = await req.json();

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Insert survey response into database
    const { data, error } = await supabase
      .from('customer_surveys')
      .insert([
        {
          policy_number: surveyData.policyNumber,
          reasons_chosen: surveyData.reasonsChosen,
          other_reason: surveyData.otherReason,
          ease_rating: surveyData.easeRating,
          ease_explanation: surveyData.easeExplanation,
          suggestions: surveyData.suggestions,
          submitted_at: surveyData.submittedAt,
        }
      ])
      .select();

    if (error) {
      throw error;
    }

    console.log("Survey submitted successfully:", data);

    return new Response(
      JSON.stringify({ success: true, data }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
  } catch (error: any) {
    console.error("Error submitting survey:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
