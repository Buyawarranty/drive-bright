import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface PricingRow {
  "Plan type": string;
  "Labour up to £ p/hr": string;
  "Voluntary Excess Amount": string;
  "12 month Warranty in 12 installments": string;
  "12 month warranty original price": string;
  "24 month warranty in 12 installments": string;
  "24 month warranty with 10% off": string;
  "24 month warranty You Save Amount": string;
  "24 month warranty original price": string;
  "36 month warranty in 12 installments": string;
  "36 month warranty with 20% off": string;
  "36 month warranty You Save Amount": string;
  "36 month warranty  original price": string;
}

interface UpdateRequest {
  pricingData: PricingRow[];
}

function logStep(step: string, details?: any) {
  console.log(`[BULK-PRICING] ${step}`, details ? JSON.stringify(details) : '');
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Starting bulk pricing update");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { pricingData }: UpdateRequest = await req.json();
    logStep("Received pricing data", { count: pricingData.length });

    const results = {
      success: 0,
      errors: [] as string[]
    };

    // Process each pricing row
    for (let i = 0; i < pricingData.length; i++) {
      const row = pricingData[i];
      const rowNum = i + 1;
      
      try {
        logStep(`Processing row ${rowNum}`, row);

        const planType = row["Plan type"];
        const labourRate = row["Labour up to £ p/hr"];
        const voluntaryExcess = row["Voluntary Excess Amount"];
        
        // Helper function to parse price values, treating 0 as valid
        const parsePrice = (priceStr: string): number => {
          if (!priceStr) return 0;
          const cleanStr = priceStr.replace(/[£,]/g, '').trim();
          if (cleanStr === '' || cleanStr === '0') return 0;
          const parsed = parseFloat(cleanStr);
          return isNaN(parsed) ? 0 : parsed;
        };

        // Extract monthly price (12 month warranty in 12 installments)
        const monthlyPrice = parsePrice(row["12 month Warranty in 12 installments"]);
        
        // Extract yearly price (24 month warranty with 10% off)
        const yearlyPrice = parsePrice(row["24 month warranty with 10% off"]);
        
        // Extract 3-year price (36 month warranty with 20% off)
        const threeYearPrice = parsePrice(row["36 month warranty with 20% off"]);

        // Determine which table to update based on plan type
        const isSpecialVehicle = ['PHEV', 'EV', 'MOTORBIKE'].includes(planType);
        const tableName = isSpecialVehicle ? 'special_vehicle_plans' : 'plans';
        
        // Build update object with pricing matrix, handling 0 amounts properly
        const pricingMatrix = {
          "12": {
            "0": { "price": monthlyPrice, "excess": "No Contribution" },
            "50": { "price": monthlyPrice, "excess": "£50" },
            "100": { "price": monthlyPrice, "excess": "£100" },
            "150": { "price": monthlyPrice, "excess": "£150" }
          },
          "24": {
            "0": { "price": yearlyPrice, "excess": "No Contribution" },
            "50": { "price": yearlyPrice, "excess": "£50" },
            "100": { "price": yearlyPrice, "excess": "£100" },
            "150": { "price": yearlyPrice, "excess": "£150" }
          },
          "36": {
            "0": { "price": threeYearPrice, "excess": "No Contribution" },
            "50": { "price": threeYearPrice, "excess": "£50" },
            "100": { "price": threeYearPrice, "excess": "£100" },
            "150": { "price": threeYearPrice, "excess": "£150" }
          }
        };

        const updateData: any = {
          monthly_price: monthlyPrice,
          yearly_price: yearlyPrice,
          three_yearly_price: threeYearPrice,
          pricing_matrix: pricingMatrix,
          updated_at: new Date().toISOString()
        };

        // Build query conditions
        let query = supabaseClient
          .from(tableName)
          .update(updateData)
          .eq('name', planType);

        // Add vehicle_type condition for special vehicles
        if (isSpecialVehicle) {
          query = query.eq('vehicle_type', planType.toLowerCase());
        }

        const { data, error } = await query;

        if (error) {
          logStep(`Error updating row ${rowNum}`, error);
          results.errors.push(`Row ${rowNum}: ${error.message}`);
          continue;
        }

        // Check if any rows were actually updated
        const checkQuery = supabaseClient
          .from(tableName)
          .select('*', { count: 'exact', head: true })
          .eq('name', planType);
          
        if (isSpecialVehicle) {
          checkQuery.eq('vehicle_type', planType.toLowerCase());
        }
        
        const { count } = await checkQuery;

        if (count === 0) {
          results.errors.push(`Row ${rowNum}: Plan "${planType}" not found in ${tableName}`);
          continue;
        }

        results.success++;
        logStep(`Successfully updated row ${rowNum}`);

      } catch (rowError: any) {
        logStep(`Exception processing row ${rowNum}`, rowError);
        results.errors.push(`Row ${rowNum}: ${rowError.message}`);
      }
    }

    logStep("Bulk pricing update completed", results);

    return new Response(
      JSON.stringify(results),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );

  } catch (error: any) {
    logStep("Error in bulk pricing update", error);
    return new Response(
      JSON.stringify({ 
        success: 0,
        errors: [`Failed to process bulk pricing update: ${error.message}`]
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);