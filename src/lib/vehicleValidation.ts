// Vehicle validation and pricing adjustment utilities

export interface VehicleData {
  make?: string;
  model?: string;
  vehicleType?: string;
  regNumber: string;
  year?: string;
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
 */
export function validateVehicleEligibility(vehicleData: VehicleData): { isValid: boolean; errorMessage?: string } {
  const make = vehicleData.make?.toLowerCase().trim() || '';
  const model = vehicleData.model?.toLowerCase().trim() || '';
  
  // Check vehicle age (must be 15 years or newer)
  if (vehicleData.year) {
    const currentYear = new Date().getFullYear();
    const vehicleYear = parseInt(vehicleData.year);
    const vehicleAge = currentYear - vehicleYear;
    
    if (vehicleAge > 15) {
      return {
        isValid: false,
        errorMessage: 'We cannot offer warranties for vehicles over 15 years old. This applies to all vehicle types including cars, vans, SUVs, motorbikes, and special vehicles.'
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
  
  // Check for Range Rover (highest price adjustment)
  if (make === 'land rover' && model.includes('range rover')) {
    console.log('🚗 Detected: Range Rover');
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
      if (warrantyDurationYears === 1) adjustmentAmount = 200;
      else if (warrantyDurationYears === 2) adjustmentAmount = 400;
      else if (warrantyDurationYears === 3) adjustmentAmount = 600;
      adjustmentType = 'range_rover_premium';
      breakdown.push({
        baseAdjustment: adjustmentAmount,
        adjustmentReason: `Range Rover premium: +£${adjustmentAmount} for ${warrantyDurationYears} year warranty`
      });
      break;
      
    case 'special_variant':
    case 'suv_van':
      // SUV & Van Vehicles: +£100 for 1-year, +£200 for 2-year, +£300 for 3-year
      // Special Variant Vehicles: Same increase as SUV/Vans
      if (warrantyDurationYears === 1) adjustmentAmount = 100;
      else if (warrantyDurationYears === 2) adjustmentAmount = 200;
      else if (warrantyDurationYears === 3) adjustmentAmount = 300;
      adjustmentType = category === 'special_variant' ? 'special_variant_premium' : 'suv_van_premium';
      const vehicleTypeLabel = category === 'special_variant' ? 'Special variant' : 'SUV/Van';
      breakdown.push({
        baseAdjustment: adjustmentAmount,
        adjustmentReason: `${vehicleTypeLabel} premium: +£${adjustmentAmount} for ${warrantyDurationYears} year warranty`
      });
      break;
      
    default:
      adjustmentType = 'standard';
      breakdown.push({
        baseAdjustment: 0,
        adjustmentReason: 'Standard vehicle - no adjustment applied'
      });
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
    return Math.round(basePrice * (1 + adjustment.adjustmentAmount));
  }
  
  // Handle fixed amount adjustments
  return Math.round(basePrice + adjustment.adjustmentAmount);
}