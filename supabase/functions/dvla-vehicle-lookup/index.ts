
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.2';

// Vehicle validation logic
const EXCLUDED_MAKES = [
  'aston martin',
  'bentley', 
  'ferrari',
  'lamborghini',
  'lotus',
  'maserati',
  'maybach',
  'mclaren',
  'morgan',
  'rolls-royce',
  'rolls royce',
  'tvr'
];

const MODEL_EXCLUSIONS = {
  'audi': [
    'rs2', 'rs2 avant', 'rs3', 'rs4', 'rs4 avant', 'rs5', 'rs6', 'rs6 avant', 
    'rs7', 'rs7 sportback', 'rs q3', 'rs q5', 'rs q8', 'rs e-tron', 'rs e-tron gt', 
    'tt rs', 'tts', 'r8', 'r8 v8', 'r8 v10', 'r8 v10 plus', 'r8 spyder', 'r8 gt', 'r8 lms',
    's2', 's2 coupé', 's2 coupe', 's2 avant', 's2 sedan', 's3', 's4', 's5', 's6', 's7', 's8',
    'sq5', 'sq7', 'sq8', 's e-tron', 's e-tron gt'
  ],
  'bmw': [
    'm1', '1m coupé', '1m coupe', 'm2', 'm2 competition', 'm2 cs', 'm3', 'm4',
    'm4 competition', 'm4 csl', 'm4 gts', 'm5', 'm6', 'm8',
    'm roadster', 'm coupe', 'm3 csl', 'm3 crt', 'm3 gts',
    'm4 kith edition', 'm5 cs', '3.0 csl', 'x3 m', 'x4 m', 'x5 m',
    'x6 m', 'xm', 'z3 m roadster', 'z3 m coupe', 'z4 m roadster', 'z4 m coupe'
  ],
  'mercedes': [
    'c 36 amg', 'c 43 amg', 'c 55 amg', 'c 63 amg', 'e 36 amg',
    'e 50 amg', 'e 55 amg', 'e 63 amg', 's 55 amg', 's 63 amg',
    's 65 amg', 's 70 amg', 'cl 55 amg', 'cl 63 amg', 'cl 65 amg',
    'sl 55 amg', 'sl 60 amg', 'sl 63 amg', 'sl 65 amg', 'sl 73 amg',
    'clk 55 amg', 'clk 63 amg', 'clk dtm amg', 'cls 55 amg', 'cls 63 amg',
    'amg gt', 'amg sl', 'amg one', 'ml 55 amg', 'ml 63 amg', 'g 36 amg',
    'g 55 amg', 'g 63 amg', 'g 65 amg', 'gl 63 amg', 'gle 63 amg',
    'gls 63 amg', 'r 63 amg', 'e-class amg estates', 'amg', 'mercedes-amg'
  ]
};

const EXCLUSION_ERROR_MESSAGE = "Thanks for your interest! Unfortunately, we're not able to offer warranty cover for this vehicle. This is down to factors like specialist parts or limited access to suitable repair centres.";

// High-performance models that are not covered by warranty
const HIGH_PERFORMANCE_MODELS = [
  // BMW
  "BMW M135i xDrive", "BMW M240i Coupé", "BMW M235i xDrive Gran Coupé", "BMW M2 Coupé", "BMW M2 CS",
  "BMW M340i xDrive Sedan", "BMW M340d xDrive Sedan", "BMW M340i xDrive Touring", "BMW M340d xDrive Touring",
  "BMW M3 Sedan", "BMW M3 Competition Sedan", "BMW M3 CS", "BMW M3 Competition Touring",
  "BMW M440i xDrive Coupé", "BMW M440d xDrive Coupé", "BMW M440i xDrive Convertible", "BMW M440d xDrive Convertible",
  "BMW M440i xDrive Gran Coupé", "BMW M4 Coupé", "BMW M4 Competition Coupé", "BMW M4 CS", 
  "BMW M4 Competition Convertible", "BMW M4 CS Edition VR46", "BMW M550i xDrive Sedan", "BMW M5 Sedan",
  "BMW M5 Competition", "BMW M5 CS", "BMW M5 Touring", "BMW M760e xDrive", "BMW M760Li xDrive",
  "BMW M850i xDrive Coupé", "BMW M850i xDrive Convertible", "BMW M850i xDrive Gran Coupé", "BMW M8 Coupé",
  "BMW M8 Competition Coupé", "BMW M8 Convertible", "BMW M8 Competition Convertible", "BMW M8 Gran Coupé",
  "BMW M8 Competition Gran Coupé", "BMW M850i Edition M Heritage", "BMW i4 M60 xDrive", "BMW i5 M60 Sedan",
  "BMW i5 M60 Touring", "BMW i7 M70", "BMW iX M70", "BMW X1 M35i", "BMW X2 M35i", "BMW X3 M40i",
  "BMW X3 M40d", "BMW X3 M", "BMW X3 M Competition", "BMW X4 M40i", "BMW X4 M40d", "BMW X4 M",
  "BMW X4 M Competition", "BMW X5 M60i", "BMW X5 M", "BMW X5 M Competition", "BMW X6 M60i", "BMW X6 M",
  "BMW X6 M Competition", "BMW X7 M60i", "BMW XM", "BMW XM Label", "BMW XM 50e", "BMW XM by Kith", "BMW Z4 M40i",

  // Audi
  "Audi RS 3 Sportback", "Audi RS 3 Sedan", "Audi RS 4 Avant", "Audi RS 5 Coupé", "Audi RS 5 Sportback",
  "Audi RS 6 Avant", "Audi RS 6 Avant Performance", "Audi RS 7 Sportback", "Audi RS Q3", "Audi RS Q3 Sportback",
  "Audi RS Q5", "Audi RS Q8", "Audi RS e-tron GT", "Audi TT RS Coupé", "Audi TT RS Roadster",
  "Audi R8 Coupé", "Audi R8 Spyder",

  // Mercedes-AMG
  "Mercedes-AMG A 35", "Mercedes-AMG A 45 S", "Mercedes-AMG CLA 35", "Mercedes-AMG CLA 45 S",
  "Mercedes-AMG C 43", "Mercedes-AMG C 63 S", "Mercedes-AMG E 53", "Mercedes-AMG E 63 S", "Mercedes-AMG S 63",
  "Mercedes-AMG GT 43 4-Door", "Mercedes-AMG GT 53 4-Door", "Mercedes-AMG GT 63 4-Door", "Mercedes-AMG EQE",
  "Mercedes-AMG C 43 Estate", "Mercedes-AMG C 63 S Estate", "Mercedes-AMG E 53 Estate", "Mercedes-AMG E 63 S Estate",
  "Mercedes-AMG CLE 53", "Mercedes-AMG CLE 63", "Mercedes-AMG C 43 Coupé", "Mercedes-AMG C 63 S Coupé",
  "Mercedes-AMG E 53 Coupé", "Mercedes-AMG GT Coupé", "Mercedes-AMG SL 43", "Mercedes-AMG SL 55",
  "Mercedes-AMG SL 63", "Mercedes-AMG One", "Mercedes-AMG GLA 35", "Mercedes-AMG GLA 45", "Mercedes-AMG GLB 35",
  "Mercedes-AMG GLC 43", "Mercedes-AMG GLC 63", "Mercedes-AMG GLC 43 Coupé", "Mercedes-AMG GLC 63 Coupé",
  "Mercedes-AMG GLE 53", "Mercedes-AMG GLE 63", "Mercedes-AMG GLE 53 Coupé", "Mercedes-AMG GLE 63 Coupé",
  "Mercedes-AMG GLS 63", "Mercedes-AMG G 63", "Mercedes-AMG EQE SUV", "Mercedes-AMG EQS SUV",

  // Ford
  "Ford Fiesta ST", "Ford Focus ST", "Ford Focus RS", "Ford Puma ST", "Ford Mustang GT", "Ford Mustang Mach 1",
  "Ford Mustang Mach-E GT", "Ford GT", "Ford Ranger Raptor",

  // Vauxhall
  "Vauxhall Corsa VXR", "Vauxhall Astra VXR", "Vauxhall Astra GTC VXR", "Vauxhall Insignia VXR",
  "Vauxhall Vectra VXR", "Vauxhall Zafira VXR", "Vauxhall Meriva VXR", "Vauxhall VX220 VXR",
  "Vauxhall Monaro VXR", "Vauxhall VXR8", "Vauxhall GSi",

  // MINI
  "MINI JCW 3-Door Hatch", "MINI JCW Convertible", "MINI JCW Clubman", "MINI JCW Countryman", "MINI JCW Electric",

  // Land Rover
  "Range Rover Sport SVR", "Range Rover Sport SV", "Range Rover SVAutobiography Dynamic", "Defender V8",
  "Defender V8 Carpathian Edition", "Range Rover Velar SVAutobiography Dynamic Edition", "Range Rover SV Black",
  "Range Rover SV Carbon"
];

/**
 * Check if a vehicle model is a high-performance model that cannot be covered
 */
function isHighPerformanceModel(make: string, model: string): boolean {
  if (!make || !model) return false;
  
  const normalizedMake = make.trim().toUpperCase();
  const normalizedModel = model.trim().toUpperCase();
  const fullModelName = `${normalizedMake} ${normalizedModel}`;
  
  return HIGH_PERFORMANCE_MODELS.some(blockedModel => 
    blockedModel.toUpperCase() === fullModelName
  );
}

// Manual overrides for registrations where DVSA data is missing but we still need to show details
const MANUAL_OVERRIDES: Record<string, { make: string; model?: string; fuelType?: string; colour?: string; year?: number }> = {
  'WA57FOC': { make: 'Bentley' },
  'NK59AGY': { make: 'Bentley' },
  'KM68HLD': { make: 'Audi', model: 'S8' },
};

function validateVehicleEligibility(vehicleData: any): { isValid: boolean; errorMessage?: string } {
  const make = vehicleData.make?.toLowerCase().trim() || '';
  const model = vehicleData.model?.toLowerCase().trim() || '';

  // Check if this is a high-performance model
  if (isHighPerformanceModel(make, model)) {
    return {
      isValid: false,
      errorMessage: EXCLUSION_ERROR_MESSAGE
    };
  }

  // Check excluded makes
  if (EXCLUDED_MAKES.includes(make)) {
    return {
      isValid: false,
      errorMessage: EXCLUSION_ERROR_MESSAGE
    };
  }
  
  // Check specific model exclusions
  if ((MODEL_EXCLUSIONS as any)[make]) {
    const excludedModels = (MODEL_EXCLUSIONS as any)[make];
    const isExcluded = excludedModels.some((excludedModel: any) => {
      // Normalize both model strings for comparison
      const normalizedModel = model.replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
      const normalizedExcludedModel = excludedModel.replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
      
      // Check for exact match or if the model starts with the excluded model
      return normalizedModel === normalizedExcludedModel || 
             normalizedModel.startsWith(normalizedExcludedModel + ' ') ||
             normalizedModel.includes(' ' + normalizedExcludedModel + ' ') ||
             normalizedModel.includes(' ' + normalizedExcludedModel);
    });
    
    if (isExcluded) {
      return {
        isValid: false,
        errorMessage: EXCLUSION_ERROR_MESSAGE
      };
    }
  }
  
  return { isValid: true };
}

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
  motTestNumber?: string;
  defects?: Array<{
    text: string;
    type: string;
    dangerous?: boolean;
  }>;
}

interface DVSAVehicleResponse {
  make?: string;
  model?: string;
  primaryColour?: string;
  fuelType?: string;
  motTests?: MOTTest[];
  dvlaId?: string;
  registrationDate?: string;
  manufactureDate?: string;
  engineCapacity?: number;
  co2Emissions?: number;
  euroStatus?: string;
  realDrivingEmissions?: string;
  markedForExport?: boolean;
  colour?: string;
  typeApproval?: string;
  wheelplan?: string;
  revenueWeight?: number;
  dateOfLastV5CIssued?: string;
}

// Helper function to determine approximate year from UK registration
function getRegistrationYear(registration: string): number | null {
  const reg = registration.toUpperCase().replace(/\s/g, '');
  
  // Modern format (2001+): AB12 ABC or AB61 ABC  
  if (/^[A-Z]{2}\d{2}[A-Z]{3}$/.test(reg)) {
    const ageIdentifier = parseInt(reg.substring(2, 4));
    if (ageIdentifier <= 50) {
      return 2000 + ageIdentifier;
    } else {
      return 2000 + ageIdentifier - 50;
    }
  }
  
  // Prefix format (1983-2001): A123 ABC
  if (/^[A-Z]\d{3}[A-Z]{3}$/.test(reg)) {
    const letter = reg.charAt(0);
    const yearMap: { [key: string]: number } = {
      'A': 1983, 'B': 1984, 'C': 1985, 'D': 1986, 'E': 1987, 'F': 1988,
      'G': 1989, 'H': 1990, 'J': 1991, 'K': 1992, 'L': 1993, 'M': 1994,
      'N': 1995, 'P': 1996, 'R': 1997, 'S': 1998, 'T': 1999, 'V': 1999,
      'W': 2000, 'X': 2000, 'Y': 2001
    };
    return yearMap[letter] || null;
  }
  
  return null;
}

async function getAccessToken(): Promise<string> {
  const clientId = Deno.env.get('MOT_CLIENT_ID');
  const clientSecret = Deno.env.get('MOT_CLIENT_SECRET');
  const tokenUrl = Deno.env.get('MOT_TOKEN_URL');
  const scopeUrl = Deno.env.get('MOT_SCOPE_URL');

  if (!clientId || !clientSecret || !tokenUrl || !scopeUrl) {
    throw new Error('Missing MOT API configuration');
  }

  const params = new URLSearchParams();
  params.append('client_id', clientId);
  params.append('client_secret', clientSecret);
  params.append('scope', scopeUrl);
  params.append('grant_type', 'client_credentials');

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params,
  });

  if (!response.ok) {
    console.error('Token request failed:', await response.text());
    throw new Error('Failed to get access token');
  }

  const tokenData = await response.json();
  return tokenData.access_token;
}

async function fetchDVSAVehicleData(registration: string, accessToken: string): Promise<DVSAVehicleResponse> {
  const apiKey = Deno.env.get('MOT_API_KEY');
  
  if (!apiKey) {
    throw new Error('Missing MOT API key');
  }

  const response = await fetch(`https://history.mot.api.gov.uk/v1/trade/vehicles/registration/${registration.toUpperCase()}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'X-API-Key': apiKey,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('Vehicle not found');
    }
    console.error('DVSA API request failed:', response.status, await response.text());
    throw new Error('Failed to fetch vehicle data');
  }

  return await response.json();
}

// DVLA Vehicle Enquiry Service fallback - fetch minimal details when DVSA is missing data
async function fetchDVLAFallback(registration: string): Promise<{ make?: string; model?: string; fuelType?: string; colour?: string; yearOfManufacture?: number } | null> {
  const dvlaKey = Deno.env.get('DVLA_API_KEY');
  if (!dvlaKey) {
    console.warn('DVLA_API_KEY not set - skipping DVLA fallback');
    return null;
  }
  try {
    const res = await fetch('https://driver-vehicle-licensing.api.gov.uk/vehicle-enquiry/v1/vehicles', {
      method: 'POST',
      headers: {
        'x-api-key': dvlaKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ registrationNumber: registration.toUpperCase() })
    });
    if (!res.ok) {
      console.error('DVLA VES request failed:', res.status, await res.text());
      return null;
    }
    const dvla: any = await res.json();
    return {
      make: dvla.make,
      model: dvla.model,
      fuelType: dvla.fuelType || dvla.fueltype,
      colour: dvla.colour || dvla.color,
      yearOfManufacture: dvla.yearOfManufacture || dvla.yearofmanufacture
    };
  } catch (e) {
    console.error('DVLA VES fallback error:', e);
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { registrationNumber } = await req.json();
    
    if (!registrationNumber) {
      throw new Error("Registration number is required");
    }

    console.log(`Looking up vehicle: ${registrationNumber}`);
    
    // Check if this registration might be from a premium excluded brand based on age/format
    // UK registration format can give clues about the vehicle age and type
    const regYear = getRegistrationYear(registrationNumber);
    console.log(`Registration ${registrationNumber} appears to be from year: ${regYear}`);

    // Get access token for DVSA API
    const accessToken = await getAccessToken();
    
    // Call DVSA API with retry logic
    let vehicleData;
    let lastError;
    const maxRetries = 3;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`DVSA API attempt ${attempt} for ${registrationNumber}`);
        
        vehicleData = await fetchDVSAVehicleData(registrationNumber, accessToken);
        break; // Success, exit retry loop
      } catch (error) {
        lastError = error;
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`DVSA API attempt ${attempt} failed:`, errorMessage);
        
        if (errorMessage === 'Vehicle not found') {
          console.log(`Vehicle ${registrationNumber} not found in DVSA database - attempting DVLA fallback`);

          const regUpper = registrationNumber.toUpperCase();

          // 1) Try DVLA VES fallback to fetch at least make/model
          const dvla = await fetchDVLAFallback(registrationNumber);
          if (dvla?.make) {
            console.log('DVLA fallback returned data:', { make: dvla.make, model: dvla.model });
            const validation = validateVehicleEligibility({ make: dvla.make, model: dvla.model || '', regNumber: registrationNumber });
            const blocked = !validation.isValid;
            return new Response(JSON.stringify({
              found: true,
              blocked,
              blockReason: blocked ? validation.errorMessage : undefined,
              registrationNumber: regUpper,
              make: dvla.make,
              model: dvla.model || null,
              fuelType: dvla.fuelType || null,
              colour: dvla.colour || null,
              yearOfManufacture: dvla.yearOfManufacture || null,
              vehicleType: 'car'
            }), {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
              status: 200,
            });
          }

          // 2) Check manual overrides for known registrations
          const override = MANUAL_OVERRIDES[regUpper];
          if (override) {
            console.log(`Using manual override for ${regUpper}:`, override);
            return new Response(JSON.stringify({
              found: true,
              blocked: true,
              blockReason: EXCLUSION_ERROR_MESSAGE,
              registrationNumber: regUpper,
              make: override.make,
              model: override.model || null,
              fuelType: override.fuelType || null,
              colour: override.colour || null,
              yearOfManufacture: override.year || null,
              vehicleType: 'car'
            }), {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
              status: 200,
            });
          }
          
          // 3) Pattern-based precautionary block for premium vehicles
          const premiumRegPatterns = [
            /^WA\d{2}[A-Z]{3}$/i,
            /^[A-Z]{2}0[0-9][A-Z]{3}$/i,
          ];
          const isPotentialPremium = premiumRegPatterns.some(pattern => pattern.test(registrationNumber));
          if (isPotentialPremium) {
            console.log(`Registration ${registrationNumber} matches premium vehicle pattern - blocking as precaution`);
            return new Response(JSON.stringify({
              found: true,
              blocked: true,
              blockReason: EXCLUSION_ERROR_MESSAGE,
              registrationNumber: regUpper,
              make: "Premium Vehicle",
              model: "Unknown Model"
            }), {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
              status: 200,
            });
          }

          // 4) Otherwise, return not found
          return new Response(JSON.stringify({
            found: false,
            error: "Vehicle not found in DVSA database",
            registrationNumber: regUpper
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
          });
        }
        
        if (attempt < maxRetries) {
          // Wait before retrying (exponential backoff)
          const waitTime = Math.pow(2, attempt - 1) * 1000;
          console.log(`Waiting ${waitTime}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }
    }
    
    if (!vehicleData) {
      const errorMessage = lastError instanceof Error ? lastError.message : String(lastError);
      throw new Error(`DVSA API failed after ${maxRetries} attempts: ${errorMessage}`);
    }

    console.log('DVSA API response:', vehicleData);

    // Extract vehicle information from DVSA response
    let make = vehicleData.make;
    let model = vehicleData.model;
    let fuelType = vehicleData.fuelType;
    let colour = vehicleData.primaryColour || vehicleData.colour;
    
    // Calculate year of manufacture from registration or manufacture date
    let yearOfManufacture;
    if (vehicleData.manufactureDate) {
      yearOfManufacture = new Date(vehicleData.manufactureDate).getFullYear();
    } else if (vehicleData.registrationDate) {
      yearOfManufacture = new Date(vehicleData.registrationDate).getFullYear();
    }

    // DVLA fallback for missing/incorrect make/model data
    if (!make || !model) {
      console.log('Primary DVSA data missing make/model - attempting DVLA fallback');
      const dvla = await fetchDVLAFallback(registrationNumber);
      if (dvla?.make) {
        make = dvla.make;
        model = dvla.model || model;
        fuelType = dvla.fuelType || fuelType;
        colour = dvla.colour || colour;
        yearOfManufacture = dvla.yearOfManufacture || yearOfManufacture;
      }
    }

    // Apply manual overrides by registration (ensures correct make/model, e.g., Audi S8 cases)
    {
      const regUpper = registrationNumber.toUpperCase();
      const overrideFinal = MANUAL_OVERRIDES[regUpper];
      if (overrideFinal) {
        console.log(`Applying manual override after lookup for ${regUpper}:`, overrideFinal);
        make = overrideFinal.make || make;
        model = overrideFinal.model || model;
        fuelType = overrideFinal.fuelType || fuelType;
        colour = overrideFinal.colour || colour;
        if (overrideFinal.year) yearOfManufacture = overrideFinal.year;
      }
    }

    // Determine vehicle type based on DVSA data
    let vehicleType = 'car'; // Default to car
    const fuelTypeLower = fuelType?.toLowerCase() || '';
    const typeApproval = vehicleData.typeApproval?.toLowerCase() || '';
    const wheelplan = vehicleData.wheelplan?.toLowerCase() || '';
    const engineCapacity = vehicleData.engineCapacity || 0;
    const revenueWeight = vehicleData.revenueWeight || 0;
    const makeLower = make?.toLowerCase() || '';
    const modelLower = model?.toLowerCase() || '';
    
    console.log(`🔍 Vehicle classification data:`, {
      make: makeLower,
      model: modelLower,
      typeApproval,
      wheelplan,
      fuelType: fuelTypeLower,
      engineCapacity,
      revenueWeight
    });
    
    // First check for electric/hybrid vehicles (these can be cars, vans, or motorbikes)
    const isElectric = fuelTypeLower.includes('electricity') || fuelTypeLower === 'electric';
    const isHybrid = fuelTypeLower.includes('hybrid') || fuelTypeLower.includes('petrol/electric') || fuelTypeLower.includes('plug-in hybrid');
    
    // CRITICAL: Enhanced commercial vehicle detection with explicit logging
    const isCommercialVehicle = (
      // Type approval based
      typeApproval.startsWith('n1') || 
      typeApproval.includes('commercial') ||
      wheelplan.includes('van') ||
      wheelplan.includes('commercial') ||
      // Weight-based detection for vans (typically heavier than cars)
      (revenueWeight > 2000 && revenueWeight <= 3500) ||
      // Make/model based detection for common van manufacturers - ENHANCED LOGGING
      (['ford', 'mercedes', 'mercedes-benz', 'volkswagen', 'renault', 'peugeot', 'citroen', 'fiat', 'iveco', 'nissan'].includes(makeLower) &&
       ['transit', 'sprinter', 'crafter', 'master', 'boxer', 'ducato', 'daily', 'nv200', 'nv300', 'nv400'].some(vanModel => {
         const modelContains = modelLower.includes(vanModel);
         console.log(`🔍 Checking van model '${vanModel}' in '${modelLower}': ${modelContains}`);
         return modelContains;
       })) ||
      // Explicit model pattern matching for common commercial vehicles
      /\btransit\b/i.test(modelLower) ||
      /\bsprinter\b/i.test(modelLower) ||
      /\bcrafter\b/i.test(modelLower) ||
      /\bmaster\b/i.test(modelLower) ||
      /\bmovano\b/i.test(modelLower) ||
      /\bvivaro\b/i.test(modelLower) ||
      /\bducato\b/i.test(modelLower) ||
      /\bconnect\b/i.test(modelLower) ||
      /\bcustom\b/i.test(modelLower)
    );
    
    console.log(`🔍 Commercial vehicle detection for ${makeLower} ${modelLower}:`, {
      makeInList: ['ford', 'mercedes', 'mercedes-benz', 'volkswagen', 'renault', 'peugeot', 'citroen', 'fiat', 'iveco', 'nissan'].includes(makeLower),
      modelHasVanPattern: ['transit', 'sprinter', 'crafter', 'master', 'boxer', 'ducato', 'daily', 'nv200', 'nv300', 'nv400'].some(vanModel => modelLower.includes(vanModel)),
      regexTests: {
        transit: /\btransit\b/i.test(modelLower),
        sprinter: /\bsprinter\b/i.test(modelLower),
        crafter: /\bcrafter\b/i.test(modelLower)
      },
      isCommercialVehicle
    });
    
    if (isCommercialVehicle) {
      console.log('🚐 DETECTED: Commercial vehicle (van)');
      if (isElectric) {
        vehicleType = 'EV'; // Electric van
      } else if (isHybrid) {
        vehicleType = 'PHEV'; // Hybrid van
      } else {
        vehicleType = 'van';
      }
    }
    // Enhanced Motorcycle detection with better coverage
    else if (
      // Must have explicit motorcycle type approval (L category for motorcycles in EU)
      (typeApproval.startsWith('l') && (typeApproval.includes('motorcycle') || typeApproval.includes('moped'))) ||
      // OR explicit motorcycle wheelplan
      (wheelplan.includes('2 wheels') && wheelplan.includes('motorcycle')) ||
      // OR dedicated motorcycle manufacturers (always motorcycles regardless of model)
      (['yamaha', 'kawasaki', 'ducati', 'ktm', 'harley-davidson', 'harley davidson', 'triumph', 'aprilia', 'husqvarna', 'mv agusta', 'benelli', 'moto guzzi', 'indian', 'royal enfield', 'norton', 'zero', 'energica'].includes(makeLower) &&
       // Safety check - make sure it's not a commercial vehicle model
       !['transit', 'sprinter', 'crafter', 'master', 'boxer', 'ducato', 'daily', 'connect', 'custom', 'van', 'commercial'].some(commercial => modelLower.includes(commercial))) ||
      // OR mixed manufacturers with strong motorcycle model patterns
      (['honda', 'bmw', 'suzuki'].includes(makeLower) && (
        // Honda motorcycle models
        (/\bcbr\b/i.test(modelLower) || /\bcb\d/i.test(modelLower) || /\bvfr\b/i.test(modelLower) || /\bfireblade\b/i.test(modelLower) || /\bhornet\b/i.test(modelLower)) ||
        // BMW motorcycle models  
        (/\bg\s?\d{3}/i.test(modelLower) || /\bs\s?\d{3}/i.test(modelLower) || /\br\s?\d{3}/i.test(modelLower) || /\bf\s?\d{3}/i.test(modelLower) || /\bk\s?\d{3}/i.test(modelLower) || 
         /\badventure\b/i.test(modelLower) || /\bgs\b/i.test(modelLower) || /\brt\b/i.test(modelLower) || /\brr\b/i.test(modelLower)) ||
        // Suzuki motorcycle models
        (/\bgsxr\b/i.test(modelLower) || /\bgsx\b/i.test(modelLower) || /\bsv\d/i.test(modelLower) || /\bdr\d/i.test(modelLower) || /\bhayabusa\b/i.test(modelLower) || /\bbandit\b/i.test(modelLower))
      ) && 
       // Safety check - make sure it's not a commercial vehicle model
       !['transit', 'sprinter', 'crafter', 'master', 'boxer', 'ducato', 'daily', 'connect', 'custom', 'van', 'commercial'].some(commercial => modelLower.includes(commercial))) ||
      // OR general motorcycle model patterns (any manufacturer)
      ((/\bmotorbike\b/i.test(modelLower) || /\bmotorcycle\b/i.test(modelLower) || /\bscooter\b/i.test(modelLower) || /\bmoped\b/i.test(modelLower) || 
        /\bninja\b/i.test(modelLower) || /\bpanigale\b/i.test(modelLower) || /\bmonster\b/i.test(modelLower) || /\bstreetfighter\b/i.test(modelLower)) &&
       // Safety check - make sure it's not a commercial vehicle model
       !['transit', 'sprinter', 'crafter', 'master', 'boxer', 'ducato', 'daily', 'connect', 'custom', 'van', 'commercial'].some(commercial => modelLower.includes(commercial)))
    ) {
      
      console.log('🏍️ DETECTED: Motorcycle with strict criteria');
      console.log('🏍️ Motorcycle detection details:', {
        typeApproval,
        wheelplan,
        engineCapacity,
        make: makeLower,
        model: modelLower
      });
      
      if (isElectric) {
        vehicleType = 'EV'; // Electric motorcycle
      } else if (isHybrid) {
        vehicleType = 'PHEV'; // Hybrid motorcycle (rare but possible)
      } else {
        vehicleType = 'MOTORBIKE';
      }
    }
    // Car detection - M1 category (passenger cars) or default case
    else {
      if (isElectric) {
        vehicleType = 'EV';
      } else if (isHybrid) {
        vehicleType = 'PHEV';
      } else {
        vehicleType = 'car';
      }
    }
    
    console.log(`🔧 FINAL vehicle type determination: ${vehicleType} for ${makeLower} ${modelLower}`);
    console.log(`🔧 Detection summary:`, {
      isCommercialVehicle: isCommercialVehicle,
      passedMotorcycleChecks: (
        (typeApproval.startsWith('l') && (typeApproval.includes('motorcycle') || typeApproval.includes('moped'))) ||
        (wheelplan.includes('2 wheels') && wheelplan.includes('motorcycle')) ||
        (engineCapacity > 0 && engineCapacity <= 800 && 
         ['yamaha', 'kawasaki', 'ducati', 'ktm', 'harley-davidson', 'triumph', 'aprilia', 'husqvarna', 'mv agusta'].includes(makeLower))
      ),
      finalVehicleType: vehicleType
    });

    // Validate vehicle eligibility (check blocked makes/models)
    const vehicleValidation = validateVehicleEligibility({
      make: make,
      model: model,
      vehicleType: vehicleType,
      regNumber: registrationNumber
    });
    const isBlocked = !vehicleValidation.isValid;
    const blockReason = vehicleValidation.errorMessage;
    if (isBlocked) {
      console.log(`Vehicle ${registrationNumber} blocked - ${blockReason} (returning details with notice)`);
    }

    // Check vehicle age (must be 15 years or newer)
    const currentYear = new Date().getFullYear();
    const vehicleAge = yearOfManufacture ? currentYear - yearOfManufacture : 0;
    
    if (yearOfManufacture && vehicleAge > 15) {
      console.log(`Vehicle ${registrationNumber} is ${vehicleAge} years old - too old for warranty`);
      return new Response(JSON.stringify({
        found: false,
        error: "We cannot offer warranties for vehicles over 15 years of age"
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Process MOT test data from DVSA response
    let motVerified = 'unknown';
    let motStatus = 'Unknown';
    let motExpiryDate = null;
    let taxStatus = 'Unknown'; // DVSA doesn't provide tax status, keep as unknown

    if (vehicleData.motTests && Array.isArray(vehicleData.motTests) && vehicleData.motTests.length > 0) {
      // Get the latest MOT test
      const latestTest = vehicleData.motTests
        .sort((a: MOTTest, b: MOTTest) => new Date(b.completedDate).getTime() - new Date(a.completedDate).getTime())[0];
      
      if (latestTest) {
        const testResult = latestTest.testResult?.toLowerCase();
        const hasCurrentMOT = latestTest.expiryDate && new Date(latestTest.expiryDate) > new Date();
        
        motExpiryDate = latestTest.expiryDate;
        motStatus = testResult === 'passed' ? 'Valid' : testResult === 'failed' ? 'Invalid' : 'Unknown';
        
        // Check if MOT is valid (passed and not expired)
        if (testResult === 'passed' && hasCurrentMOT) {
          motVerified = 'verified';
        } else if (testResult === 'failed' || !hasCurrentMOT) {
          motVerified = 'invalid';
        } else {
          motVerified = 'unknown';
        }
        
        console.log(`MOT status determined: ${motVerified} (test result: ${testResult}, has current MOT: ${hasCurrentMOT})`);
      }
    } else {
      // No MOT tests found - could be new vehicle
      if (yearOfManufacture) {
        const currentYear = new Date().getFullYear();
        const vehicleAge = currentYear - yearOfManufacture;
        
        if (vehicleAge < 3) {
          // New vehicles don't need MOT for first 3 years
          motVerified = 'verified';
          motStatus = 'Not Required';
          console.log('New vehicle - MOT not required yet');
        } else {
          motVerified = 'invalid';
          motStatus = 'No Tests Found';
          console.log('No MOT tests found for vehicle over 3 years old');
        }
      }
    }

    // Store MOT history data in database for future reference
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    try {
      // Calculate MOT expiry date from latest test
      let motExpiryDateForStorage = null;
      if (vehicleData.motTests && vehicleData.motTests.length > 0) {
        const latestTest = vehicleData.motTests
          .filter(test => test.expiryDate)
          .sort((a, b) => new Date(b.completedDate).getTime() - new Date(a.completedDate).getTime())[0];
        
        if (latestTest && latestTest.expiryDate) {
          motExpiryDateForStorage = latestTest.expiryDate;
        }
      }

      // Store in database
      const motHistoryData = {
        registration: registrationNumber.toUpperCase(),
        customer_id: null,
        make: vehicleData.make,
        model: vehicleData.model,
        primary_colour: vehicleData.primaryColour,
        fuel_type: vehicleData.fuelType,
        mot_tests: vehicleData.motTests || [],
        dvla_id: vehicleData.dvlaId,
        registration_date: vehicleData.registrationDate ? new Date(vehicleData.registrationDate).toISOString().split('T')[0] : null,
        manufacture_date: vehicleData.manufactureDate ? new Date(vehicleData.manufactureDate).toISOString().split('T')[0] : null,
        engine_capacity: vehicleData.engineCapacity,
        co2_emissions: vehicleData.co2Emissions,
        euro_status: vehicleData.euroStatus,
        real_driving_emissions: vehicleData.realDrivingEmissions,
        marked_for_export: vehicleData.markedForExport || false,
        colour: vehicleData.colour,
        type_approval: vehicleData.typeApproval,
        wheelplan: vehicleData.wheelplan,
        revenue_weight: vehicleData.revenueWeight,
        date_of_last_v5c_issued: vehicleData.dateOfLastV5CIssued ? new Date(vehicleData.dateOfLastV5CIssued).toISOString().split('T')[0] : null,
        mot_expiry_date: motExpiryDateForStorage ? new Date(motExpiryDateForStorage).toISOString().split('T')[0] : null,
      };

      console.log('Attempting to store MOT history for:', registrationNumber.toUpperCase());
      console.log('MOT history data to store:', {
        registration: motHistoryData.registration,
        make: motHistoryData.make,
        model: motHistoryData.model,
        testCount: motHistoryData.mot_tests?.length || 0,
        sampleTest: motHistoryData.mot_tests?.[0]
      });

      const { data, error } = await supabase
        .from('mot_history')
        .upsert(motHistoryData, { onConflict: 'registration' })
        .select()
        .single();

      if (error) {
        console.error('Database error storing MOT history:', error);
        console.error('Error details:', {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint
        });
        throw error;
      }

      if (!data) {
        console.error('No data returned from upsert operation');
        throw new Error('Failed to store MOT history - no data returned');
      }

      console.log('MOT history stored successfully:', {
        id: data.id,
        registration: data.registration,
        testCount: data.mot_tests?.length || 0
      });
    } catch (error) {
      console.error('Error storing MOT history:', error);
      // Continue with response even if storage fails
    }

    return new Response(JSON.stringify({
      found: true,
      blocked: typeof isBlocked !== 'undefined' ? isBlocked : false,
      blockReason: (typeof isBlocked !== 'undefined' && isBlocked) ? blockReason : undefined,
      make: make,
      model: model || null,
      fuelType: fuelType,
      transmission: null, // DVSA doesn't provide transmission data
      yearOfManufacture: yearOfManufacture,
      colour: colour,
      engineCapacity: vehicleData.engineCapacity,
      vehicleType: vehicleType,
      motStatus: motStatus,
      motExpiryDate: motExpiryDate,
      taxStatus: taxStatus,
      motVerified: motVerified
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    console.error('Error in DVSA lookup:', error);
    const errorMessage = error instanceof Error ? error.message : "Failed to lookup vehicle";
    return new Response(JSON.stringify({
      found: false,
      error: errorMessage
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  }
});
