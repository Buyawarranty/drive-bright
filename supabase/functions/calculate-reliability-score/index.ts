import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface MOTTest {
  completedDate: string;
  testResult: string;
  expiryDate?: string;
  odometerValue?: number;
  odometerUnit?: string;
  defects?: Array<{
    text: string;
    type: string;
    dangerous?: boolean;
  }>;
}

interface ReliabilityResult {
  score: number;
  tier: number;
  tierLabel: string;
  failureRate: number;
  criticalFailures: number;
  mileageFactor: number;
  totalTests: number;
  failedTests: number;
  pricing: {
    '12months': number;
    '24months': number;
    '36months': number;
  };
}

// Define critical failure categories
const CRITICAL_DEFECT_TYPES = ['MAJOR', 'DANGEROUS'];

// Tier definitions
const TIER_DEFINITIONS = [
  { tier: 1, label: 'Exceptional Reliability', minScore: 95, maxScore: 100 },
  { tier: 2, label: 'Excellent Reliability', minScore: 90, maxScore: 94 },
  { tier: 3, label: 'Very Good Reliability', minScore: 85, maxScore: 89 },
  { tier: 4, label: 'Good Reliability', minScore: 80, maxScore: 84 },
  { tier: 5, label: 'Moderate Reliability', minScore: 70, maxScore: 79 },
  { tier: 6, label: 'Low Reliability', minScore: 60, maxScore: 69 },
  { tier: 7, label: 'Poor Reliability', minScore: 0, maxScore: 59 },
];

// Tier pricing mapping (12M, 24M, 36M totals)
const TIER_PRICING = {
  1: { '12months': 359, '24months': 649, '36months': 869 },
  2: { '12months': 409, '24months': 739, '36months': 989 },
  3: { '12months': 459, '24months': 829, '36months': 1109 },
  4: { '12months': 509, '24months': 919, '36months': 1229 },
  5: { '12months': 559, '24months': 1009, '36months': 1349 },
  6: { '12months': 609, '24months': 1099, '36months': 1469 },
  7: { '12months': 659, '24months': 1189, '36months': 1589 },
};

function calculateReliabilityScore(motData: any, vehicleMileage?: number): ReliabilityResult {
  const motTests: MOTTest[] = motData.mot_tests || [];
  
  if (motTests.length === 0) {
    // New vehicle or no MOT data - assume best tier
    return {
      score: 98,
      tier: 1,
      tierLabel: 'Exceptional Reliability',
      failureRate: 0,
      criticalFailures: 0,
      mileageFactor: 0,
      totalTests: 0,
      failedTests: 0,
      pricing: TIER_PRICING[1],
    };
  }

  // Calculate failure rate
  const totalTests = motTests.length;
  const failedTests = motTests.filter(test => test.testResult?.toLowerCase() === 'failed').length;
  const failureRate = totalTests > 0 ? (failedTests / totalTests) * 100 : 0;

  // Calculate critical failures
  let criticalFailures = 0;
  motTests.forEach(test => {
    if (test.defects) {
      criticalFailures += test.defects.filter(defect => 
        CRITICAL_DEFECT_TYPES.includes(defect.type?.toUpperCase()) || defect.dangerous === true
      ).length;
    }
  });

  // Calculate mileage factor
  let mileageFactor = 0;
  if (vehicleMileage && motData.manufacture_date) {
    const manufactureYear = new Date(motData.manufacture_date).getFullYear();
    const currentYear = new Date().getFullYear();
    const vehicleAge = Math.max(currentYear - manufactureYear, 1); // Minimum 1 year to avoid division by zero
    mileageFactor = vehicleMileage / vehicleAge;
  } else if (motTests.length > 0) {
    // Use latest MOT test mileage if vehicle mileage not provided
    const latestTest = motTests.sort((a, b) => 
      new Date(b.completedDate).getTime() - new Date(a.completedDate).getTime()
    )[0];
    
    if (latestTest.odometerValue && motData.manufacture_date) {
      const manufactureYear = new Date(motData.manufacture_date).getFullYear();
      const testYear = new Date(latestTest.completedDate).getFullYear();
      const ageAtTest = Math.max(testYear - manufactureYear, 1);
      
      // Convert mileage to miles if needed
      let mileageInMiles = latestTest.odometerValue;
      if (latestTest.odometerUnit?.toLowerCase() === 'km') {
        mileageInMiles = latestTest.odometerValue * 0.621371; // Convert km to miles
      }
      
      mileageFactor = mileageInMiles / ageAtTest;
    }
  }

  // Calculate reliability score using the formula
  const rawScore = 100 - (
    failureRate * 0.4 +
    criticalFailures * 5 +
    (mileageFactor / 1000) * 2
  );

  // Cap score between 0 and 100
  const score = Math.max(0, Math.min(100, Math.round(rawScore)));

  // Determine tier based on score
  const tierInfo = TIER_DEFINITIONS.find(t => score >= t.minScore && score <= t.maxScore) || TIER_DEFINITIONS[6];

  return {
    score,
    tier: tierInfo.tier,
    tierLabel: tierInfo.label,
    failureRate,
    criticalFailures,
    mileageFactor,
    totalTests,
    failedTests,
    pricing: TIER_PRICING[tierInfo.tier as keyof typeof TIER_PRICING],
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { registration, mileage } = await req.json();
    
    if (!registration) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Registration number is required' 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    console.log(`Calculating reliability score for registration: ${registration}`);

    // First try to get existing MOT data
    const { data: existingMotData, error: motError } = await supabase
      .from('mot_history')
      .select('*')
      .eq('registration', registration.toUpperCase())
      .maybeSingle();

    if (motError) {
      console.error('Database error:', motError);
      throw motError;
    }

    let motDataToUse = existingMotData;

    // If no existing data, try to fetch fresh data
    if (!motDataToUse) {
      console.log('No cached MOT data found, fetching fresh data...');
      
      try {
        const { data: fetchResult, error: invokeError } = await supabase.functions.invoke('fetch-mot-history', {
          body: { registration, customer_id: null }
        });

        console.log('Fetch MOT result:', { success: fetchResult?.success, error: invokeError, hasData: !!fetchResult?.data });

        if (fetchResult?.success && fetchResult?.data) {
          motDataToUse = fetchResult.data;
          console.log('Got fresh MOT data from API:', {
            make: motDataToUse.make,
            model: motDataToUse.model,
            testCount: motDataToUse.mot_tests?.length || 0
          });
        } else {
          console.log('Failed to fetch MOT data:', { 
            fetchResult, 
            invokeError,
            reason: fetchResult?.error || 'Unknown error'
          });
        }
      } catch (fetchError) {
        console.error('Error invoking fetch-mot-history:', fetchError);
      }
    }

    if (!motDataToUse || !motDataToUse.mot_tests || motDataToUse.mot_tests.length === 0) {
      console.log(`No MOT test data available for ${registration}, using default score`);
      const defaultResult = calculateReliabilityScore({ mot_tests: [] }, mileage);
      
      return new Response(JSON.stringify({ 
        success: true, 
        data: defaultResult,
        debug: { dataFound: false, registration }
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    console.log(`Found MOT data for ${registration}:`, {
      make: motDataToUse.make,
      model: motDataToUse.model,
      totalTests: motDataToUse.mot_tests?.length || 0,
      manufactureDate: motDataToUse.manufacture_date,
      sampleTest: motDataToUse.mot_tests?.[0]
    });

    // Calculate reliability score
    const reliabilityResult = calculateReliabilityScore(motDataToUse, mileage);

    console.log('Reliability calculation result:', {
      registration,
      score: reliabilityResult.score,
      tier: reliabilityResult.tier,
      tierLabel: reliabilityResult.tierLabel,
      totalTests: reliabilityResult.totalTests,
      failedTests: reliabilityResult.failedTests,
    });

    return new Response(JSON.stringify({ 
      success: true, 
      data: reliabilityResult
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    console.error("Error calculating reliability score:", error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});