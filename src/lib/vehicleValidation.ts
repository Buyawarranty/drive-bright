// Vehicle validation and pricing adjustment utilities

export interface VehicleData {
  make?: string;
  model?: string;
  vehicleType?: string;
  regNumber: string;
  year?: string;
  mileage?: string | number;
  manufactureDate?: string; // Full manufacture date (ISO format) for precise age calculation
}

export interface PriceAdjustment {
  isValid: boolean;
  errorMessage?: string;
  adjustmentAmount: number;
  adjustmentType: string;
  breakdown: {
    baseAdjustment: number;
    adjustmentReason: string;
  }[];
}

// Excluded vehicle makes (entire brands)
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

// Specific model exclusions by make
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

const EXCLUSION_ERROR_MESSAGE = "The following vehicle manufacturers are not eligible for our warranty coverage due to specialist parts, high repair costs, or limited repair network availability.";

// Motorbike detection - known motorbike manufacturers
const MOTORBIKE_MAKES = [
  'honda', 'yamaha', 'suzuki', 'kawasaki', 'ducati', 'bmw', 'ktm', 
  'harley-davidson', 'harley davidson', 'triumph', 'aprilia', 'mv agusta',
  'benelli', 'moto guzzi', 'indian', 'husqvarna', 'beta', 'sherco',
  'gas gas', 'royal enfield', 'norton', 'zero', 'energica'
];

// Motorbike model identifiers
const MOTORBIKE_MODEL_PATTERNS = [
  'gsx', 'gsxr', 'cbr', 'cb', 'yzf', 'r1', 'r6', 'r3', 'r125', 'mt', 'fz',
  'ninja', 'zx', 'z', 'er', 'klx', 'kx', 'versys', 'vulcan', 'w',
  'panigale', 'monster', 'multistrada', 'streetfighter', 'supersport',
  'street', 'sportster', 'road', 'touring', 'softail', 'dyna',
  'bonneville', 'tiger', 'speed', 'rocket', 'scrambler', 'thruxton',
  'rsv', 'tuono', 'sr', 'shiver', 'dorsoduro', 'caponord',
  'duke', 'rc', 'adventure', 'super duke', 'enduro', 'sx', 'exc',
  'continental', 'interceptor', 'himalayan', 'meteor', 'classic'
];

/**
 * Enhanced motorbike detection using make, model, and vehicle type
 */
function checkIfMotorbike(make: string, model: string, vehicleType: string): boolean {
  const makeLC = make?.toLowerCase().trim() || '';
  const modelLC = model?.toLowerCase().trim() || '';
  const vehicleTypeLC = vehicleType?.toLowerCase().trim() || '';
  
  console.log('=== MOTORBIKE DETECTION DEBUG ===');
  console.log('🔍 Input values:', { make, model, vehicleType });
  console.log('🔍 Lowercase values:', { makeLC, modelLC, vehicleTypeLC });

  // CRITICAL: Explicit exclusion for ALL non-motorbike vehicle types FIRST
  if (vehicleTypeLC && ['van', 'truck', 'lorry', 'bus', 'coach', 'trailer', 'caravan', 'car', 'suv', 'estate', 'hatchback', 'saloon', 'coupe', 'convertible', 'phev', 'hybrid', 'electric', 'ev'].includes(vehicleTypeLC)) {
    console.log('🚗 Vehicle type indicates non-motorbike:', vehicleTypeLC);
    return false;
  }

  // CRITICAL: Explicit exclusion for ALL commercial vehicle manufacturers and models
  const commercialVehicleChecks = [
    // Mercedes commercial vehicles
    (makeLC === 'mercedes-benz' || makeLC === 'mercedes') && 
    (modelLC.includes('sprinter') || modelLC.includes('vito') || modelLC.includes('citan') || modelLC.includes('metris')),
    
    // Ford commercial vehicles  
    makeLC === 'ford' && 
    (modelLC.includes('transit') || modelLC.includes('connect') || modelLC.includes('courier') || modelLC.includes('custom')),
    
    // Volkswagen commercial vehicles
    makeLC === 'volkswagen' && 
    (modelLC.includes('crafter') || modelLC.includes('caddy') || modelLC.includes('transporter')),
    
    // Other major commercial vehicle brands
    makeLC === 'renault' && (modelLC.includes('master') || modelLC.includes('trafic')),
    makeLC === 'peugeot' && (modelLC.includes('boxer') || modelLC.includes('partner')),
    makeLC === 'citroen' && (modelLC.includes('jumper') || modelLC.includes('berlingo')),
    makeLC === 'fiat' && (modelLC.includes('ducato') || modelLC.includes('doblo')),
    makeLC === 'iveco' && modelLC.includes('daily'),
    makeLC === 'nissan' && (modelLC.includes('nv200') || modelLC.includes('nv300') || modelLC.includes('nv400')),
    
    // Pattern-based commercial vehicle detection
    /\btransit\b/i.test(modelLC),
    /\bsprinter\b/i.test(modelLC),
    /\bcrafter\b/i.test(modelLC),
    /\bmaster\b/i.test(modelLC),
    /\bmovano\b/i.test(modelLC),
    /\bvivaro\b/i.test(modelLC),
    /\btrafic\b/i.test(modelLC),
    /\bducato\b/i.test(modelLC),
    /\bberlingo\b/i.test(modelLC),
    /\bpartner\b/i.test(modelLC),
    /\bdaily\b/i.test(modelLC),
    /\bconnect\b/i.test(modelLC),
    /\bcourrier\b/i.test(modelLC),
    /\bcaddy\b/i.test(modelLC),
    /\bamarok\b/i.test(modelLC),
    /\bcustom\b/i.test(modelLC)
  ];

  if (commercialVehicleChecks.some(check => check)) {
    console.log('🚐 Commercial vehicle detected (NOT MOTORBIKE):', makeLC, modelLC);
    return false;
  }

  // Check for explicit motorbike indicator in vehicle type OR strong manufacturer/model evidence
  const hasExplicitMotorbikeType = vehicleTypeLC && ['motorbike', 'motorcycle', 'moped', 'scooter', 'bike'].includes(vehicleTypeLC);
  
  // For known motorbike manufacturers with strong model patterns, allow detection even without explicit vehicle type
  const isKnownMotorbikeManufacturer = ['yamaha', 'kawasaki', 'ducati', 'ktm', 'harley-davidson', 'harley davidson', 
    'triumph', 'aprilia', 'mv agusta', 'benelli', 'moto guzzi', 'indian', 
    'husqvarna', 'beta', 'sherco', 'gas gas', 'royal enfield', 'norton', 
    'zero', 'energica'].includes(makeLC);
  
  const hasStrongMotorbikeModel = MOTORBIKE_MODEL_PATTERNS.some(pattern => 
    modelLC.startsWith(pattern) || modelLC === pattern || modelLC.includes(pattern)
  );
  
  // Allow detection if explicit type OR (known manufacturer AND strong model pattern)
  if (!hasExplicitMotorbikeType && !(isKnownMotorbikeManufacturer && hasStrongMotorbikeModel)) {
    // For mixed manufacturers (Honda, BMW, Suzuki), require very strong evidence
    if (['honda', 'bmw', 'suzuki'].includes(makeLC) && hasStrongMotorbikeModel) {
      console.log('✅ Mixed manufacturer with strong motorbike model evidence:', makeLC, modelLC);
    } else if (!hasExplicitMotorbikeType) {
      console.log('🚗 No explicit motorbike type or strong manufacturer/model evidence, returning false');
      return false;
    }
  }

  // Log detection method
  if (hasExplicitMotorbikeType) {
    console.log('✅ Vehicle type explicitly indicates motorbike:', vehicleTypeLC);
  } else {
    console.log('✅ Motorbike detected via manufacturer/model pattern:', makeLC, modelLC);
  }

  console.log('🏍️ Confirmed motorbike detection:', makeLC, modelLC, vehicleTypeLC);
  return true;
}

/**
 * Check if a vehicle is excluded from coverage
 * Blocking criteria:
 * - Vehicles 15 years and 1 day old or older (using precise manufactureDate when available)
 * - Vehicles with mileage over 150,000 miles
 * - Excluded makes/models
 */
export function validateVehicleEligibility(vehicleData: VehicleData): { isValid: boolean; errorMessage?: string } {
  const make = vehicleData.make?.toLowerCase().trim() || '';
  const model = vehicleData.model?.toLowerCase().trim() || '';
  
  // Standard error message for age/mileage exclusions
  const AGE_MILEAGE_ERROR = 'Sorry, we only cover vehicles under 150,000 miles and less than 15 years old';
  
  // Check mileage - block if over 150,000 miles
  const mileage = typeof vehicleData.mileage === 'string' 
    ? parseInt(vehicleData.mileage.replace(/[^0-9]/g, '')) 
    : vehicleData.mileage;
  
  if (mileage && mileage > 150000) {
    console.log('❌ Vehicle blocked: Mileage over 150,000 miles', { mileage });
    return {
      isValid: false,
      errorMessage: AGE_MILEAGE_ERROR
    };
  }
  
  // Check vehicle age using precise manufactureDate if available
  const now = new Date();
  let vehicleAgePrecise: number | null = null;
  
  // Try to use manufactureDate for precise age calculation
  if (vehicleData.manufactureDate) {
    const manufactureDate = new Date(vehicleData.manufactureDate);
    if (!isNaN(manufactureDate.getTime())) {
      const ageInMs = now.getTime() - manufactureDate.getTime();
      const msPerYear = 365.25 * 24 * 60 * 60 * 1000; // Account for leap years
      vehicleAgePrecise = ageInMs / msPerYear;
      
      console.log('🔍 Precise age calculation:', {
        manufactureDate: vehicleData.manufactureDate,
        vehicleAgePrecise: vehicleAgePrecise.toFixed(4),
        threshold: '> 15 years'
      });
      
      // Block if over 15 years (15 years and 1 day or older)
      if (vehicleAgePrecise > 15) {
        console.log('❌ Vehicle blocked: Over 15 years old (precise)', { vehicleAgePrecise });
        return {
          isValid: false,
          errorMessage: AGE_MILEAGE_ERROR
        };
      }
    }
  }
  
  // Fallback to year-based calculation if no manufactureDate
  if (vehicleAgePrecise === null && vehicleData.year) {
    const currentYear = now.getFullYear();
    const vehicleYear = parseInt(vehicleData.year);
    const vehicleAge = currentYear - vehicleYear;
    
    console.log('🔍 Year-based age calculation (fallback):', {
      year: vehicleData.year,
      vehicleAge,
      threshold: '> 15 years'
    });
    
    if (vehicleAge > 15) {
      console.log('❌ Vehicle blocked: Over 15 years old (year-based)', { vehicleAge });
      return {
        isValid: false,
        errorMessage: AGE_MILEAGE_ERROR
      };
    }
  }
  
  // Check excluded makes
  if (EXCLUDED_MAKES.includes(make)) {
    return {
      isValid: false,
      errorMessage: EXCLUSION_ERROR_MESSAGE
    };
  }
  
  // Check specific model exclusions
  if (MODEL_EXCLUSIONS[make]) {
    const excludedModels = MODEL_EXCLUSIONS[make];
    const isExcluded = excludedModels.some(excludedModel => {
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

/**
 * Determine vehicle category for pricing adjustments
 */
function getVehicleCategory(vehicleData: VehicleData): string {
  const make = vehicleData.make?.toLowerCase().trim() || '';
  const model = vehicleData.model?.toLowerCase().trim() || '';
  const vehicleType = vehicleData.vehicleType?.toLowerCase().trim() || '';
  
  console.log('🔍 Vehicle Category Debug:', {
    originalVehicleData: vehicleData,
    make,
    model,
    vehicleType
  });
  
  // Enhanced motorbike detection
  const isMotorbike = checkIfMotorbike(make, model, vehicleType);
  if (isMotorbike) {
    console.log('🏍️ Detected: Motorbike');
    return 'motorbike';
  }
  
  // Check for Land Rover, Jaguar, Tesla, and Porsche (highest price adjustment)
  if (make === 'land rover' || make.startsWith('jaguar') || make === 'porsche' || make === 'tesla') {
    console.log('🚗 Detected: Land Rover / Jaguar / Porsche / Tesla');
    return 'range_rover';
  }
  
  // Check for special variants (same as SUV pricing)
  if (make === 'audi' && (model.includes('s-line') || model.includes('sline'))) {
    console.log('🚗 Detected: Audi S-Line');
    return 'special_variant';
  }
  if (make === 'bmw' && (model.includes('m-sport') || model.includes('msport'))) {
    console.log('🚗 Detected: BMW M-Sport');
    return 'special_variant';
  }
  if (make === 'mercedes' && (model.includes('amg-line') || model.includes('amgline'))) {
    console.log('🚗 Detected: Mercedes AMG-Line');
    return 'special_variant';
  }
  
  // Check for SUV/Van
  if (vehicleType.includes('suv') || vehicleType.includes('van') || 
      model.includes('suv') || model.includes('van')) {
    console.log('🚙 Detected: SUV/Van');
    return 'suv_van';
  }
  
  console.log('🚗 Detected: Standard vehicle');
  return 'standard';
}

/**
 * Calculate price adjustments based on vehicle type and duration
 */
export function calculateVehiclePriceAdjustment(
  vehicleData: VehicleData, 
  warrantyDurationYears: number
): PriceAdjustment {
  // First validate eligibility
  const eligibility = validateVehicleEligibility(vehicleData);
  if (!eligibility.isValid) {
    return {
      isValid: false,
      errorMessage: eligibility.errorMessage,
      adjustmentAmount: 0,
      adjustmentType: 'exclusion',
      breakdown: []
    };
  }
  
  const category = getVehicleCategory(vehicleData);
  let adjustmentAmount = 0;
  let adjustmentType = 'standard';
  const breakdown: { baseAdjustment: number; adjustmentReason: string }[] = [];
  
  console.log('💸 Price Adjustment Calculation:', {
    vehicleData,
    warrantyDurationYears,
    category
  });
  
  switch (category) {
    case 'motorbike':
      // 50% discount on base price - this will be applied as negative adjustment
      adjustmentAmount = -0.5; // 50% discount (will be applied as percentage)
      adjustmentType = 'motorbike_discount';
      breakdown.push({
        baseAdjustment: -0.5,
        adjustmentReason: 'Motorbike 50% discount applied'
      });
      break;
      
    case 'range_rover':
      if (warrantyDurationYears === 1) adjustmentAmount = 300;
      else if (warrantyDurationYears === 2) adjustmentAmount = 500;
      else if (warrantyDurationYears === 3) adjustmentAmount = 700;
      adjustmentType = 'range_rover_premium';
      breakdown.push({
        baseAdjustment: adjustmentAmount,
        adjustmentReason: `Premium vehicle (Range Rover/Jaguar/Porsche/Tesla): +£${adjustmentAmount} for ${warrantyDurationYears} year warranty`
      });
      break;
      
    case 'special_variant':
    case 'suv_van':
    default:
      // All non-premium, non-motorbike vehicles get standard pricing (no surcharge)
      adjustmentType = 'standard';
      breakdown.push({
        baseAdjustment: 0,
        adjustmentReason: 'Standard vehicle - no adjustment applied'
      });
  }
  
  // Mileage and age surcharges with tiered amounts (non-stacking)
  
  // Calculate mileage-based premium for vehicles between 120,001 and 150,000 miles
  // Boundary: 120,001 triggers, 120,000 does NOT. 150,000 triggers, 150,001 does NOT.
  const mileage = typeof vehicleData.mileage === 'string' 
    ? parseInt(vehicleData.mileage.replace(/[^0-9]/g, '')) 
    : vehicleData.mileage;
  
  const mileageQualifies = mileage && mileage > 120000 && mileage <= 150000;
  
  console.log('🔍 Mileage Check:', { mileage, mileageQualifies, threshold: '120,001 - 150,000' });
  
  // Calculate age-based premium for vehicles strictly > 12 years old AND <= 15 years old
  // Uses precise age from manufactureDate if available, otherwise falls back to year calculation
  // Boundary: 12 years 1 day triggers, exactly 12 years does NOT. 15 years triggers, 15 years 1 day does NOT.
  let vehicleAgePrecise: number | null = null;
  let vehicleAgeYears: number | null = null;
  const now = new Date();
  
  // Try to use manufactureDate for precise age calculation (in years as decimal)
  if (vehicleData.manufactureDate) {
    const manufactureDate = new Date(vehicleData.manufactureDate);
    if (!isNaN(manufactureDate.getTime())) {
      const ageInMs = now.getTime() - manufactureDate.getTime();
      const msPerYear = 365.25 * 24 * 60 * 60 * 1000; // Account for leap years
      vehicleAgePrecise = ageInMs / msPerYear;
      vehicleAgeYears = Math.floor(vehicleAgePrecise); // Full years for display
    }
  }
  
  // Fallback to year-based calculation if no manufactureDate
  if (vehicleAgePrecise === null && vehicleData.year) {
    const year = typeof vehicleData.year === 'string' ? parseInt(vehicleData.year) : vehicleData.year;
    if (!isNaN(year)) {
      const currentYear = now.getFullYear();
      vehicleAgeYears = currentYear - year;
      vehicleAgePrecise = vehicleAgeYears; // Use whole years as fallback
    }
  }
  
  // Age qualifies if strictly > 12 years (12.0001+) AND <= 15 years
  const ageQualifies = vehicleAgePrecise !== null && vehicleAgePrecise > 12 && vehicleAgePrecise <= 15;
  
  console.log('🔍 Age Check (Precise):', { 
    'vehicleData.manufactureDate': vehicleData.manufactureDate,
    'vehicleData.year': vehicleData.year, 
    vehicleAgePrecise: vehicleAgePrecise?.toFixed(4),
    vehicleAgeYears,
    ageQualifies, 
    threshold: '>12.0 and <=15.0 years',
    currentDate: now.toISOString()
  });
  
  // Surcharge tiers by warranty duration
  // Both age and mileage use the same rates: +£100/£150/£200
  // Non-stacking: if both qualify, only one surcharge is applied
  const getAgeSurcharge = (years: number): number => {
    if (years === 1) return 100;
    if (years === 2) return 150;
    if (years === 3) return 200;
    return 0;
  };
  const getMileageSurcharge = (years: number): number => {
    if (years === 1) return 100;
    if (years === 2) return 150;
    if (years === 3) return 200;
    return 0;
  };

  // NON-STACKING: If both qualify, apply only the higher mileage surcharge once.
  // If only age qualifies, apply the lower age surcharge.
  // If only mileage qualifies, apply the mileage surcharge.
  if (mileageQualifies) {
    // Mileage qualifies (with or without age) → apply full mileage surcharge
    const surcharge = getMileageSurcharge(warrantyDurationYears);
    adjustmentAmount += surcharge;

    let reasonParts: string[] = [`high mileage (${mileage?.toLocaleString()} miles)`];
    if (ageQualifies) {
      reasonParts.push(`older vehicle (${vehicleAgeYears} years old)`);
    }
    breakdown.push({
      baseAdjustment: surcharge,
      adjustmentReason: `Premium for ${reasonParts.join(' and ')}: +£${surcharge} for ${warrantyDurationYears} year warranty`
    });
    console.log('💰 Mileage Surcharge Applied:', { mileage, vehicleAgeYears, surcharge, warrantyDurationYears });
  } else if (ageQualifies) {
    // Only age qualifies → apply lower age surcharge
    const surcharge = getAgeSurcharge(warrantyDurationYears);
    adjustmentAmount += surcharge;
    breakdown.push({
      baseAdjustment: surcharge,
      adjustmentReason: `Older vehicle premium (${vehicleAgeYears} years old): +£${surcharge} for ${warrantyDurationYears} year warranty`
    });
    console.log('💰 Age Surcharge Applied:', { vehicleAgeYears, surcharge, warrantyDurationYears });
  }
  
  const result = {
    isValid: true,
    adjustmentAmount,
    adjustmentType,
    breakdown
  };
  
  console.log('✅ Final Price Adjustment Result:', result);
  
  return result;
}

/**
 * Apply price adjustment to a base price
 */
export function applyPriceAdjustment(basePrice: number, adjustment: PriceAdjustment): number {
  if (!adjustment.isValid) return basePrice;
  
  // Handle percentage adjustments (motorbike discount)
  if (adjustment.adjustmentAmount < 0 && adjustment.adjustmentAmount > -1) {
    return Math.floor(basePrice * (1 + adjustment.adjustmentAmount));
  }
  
  // Handle fixed amount adjustments - use floor for consistent financial calculations
  return Math.floor(basePrice + adjustment.adjustmentAmount);
}