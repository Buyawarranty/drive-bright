/**
 * Vehicle Make & Model Normalisation Utility
 * 
 * Clusters free-text vehicle makes and models into a 3-level hierarchy:
 * Manufacturer → Model Family → Variant
 * 
 * Handles common spelling variants, abbreviations, and DVLA inconsistencies.
 */

// Canonical make mappings (handles common variants)
const MAKE_ALIASES: Record<string, string> = {
  'merc': 'Mercedes-Benz',
  'mercedes': 'Mercedes-Benz',
  'mercedes benz': 'Mercedes-Benz',
  'mercedes-benz': 'Mercedes-Benz',
  'mb': 'Mercedes-Benz',
  'bmw': 'BMW',
  'vw': 'Volkswagen',
  'volkswagen': 'Volkswagen',
  'land rover': 'Land Rover',
  'landrover': 'Land Rover',
  'range rover': 'Land Rover',
  'rangerover': 'Land Rover',
  'vauxhall': 'Vauxhall',
  'audi': 'Audi',
  'ford': 'Ford',
  'toyota': 'Toyota',
  'honda': 'Honda',
  'nissan': 'Nissan',
  'hyundai': 'Hyundai',
  'kia': 'Kia',
  'peugeot': 'Peugeot',
  'citroen': 'Citroën',
  'citroën': 'Citroën',
  'renault': 'Renault',
  'fiat': 'Fiat',
  'seat': 'SEAT',
  'skoda': 'Škoda',
  'škoda': 'Škoda',
  'volvo': 'Volvo',
  'jaguar': 'Jaguar',
  'porsche': 'Porsche',
  'mini': 'MINI',
  'mazda': 'Mazda',
  'subaru': 'Subaru',
  'suzuki': 'Suzuki',
  'mitsubishi': 'Mitsubishi',
  'lexus': 'Lexus',
  'alfa romeo': 'Alfa Romeo',
  'alfa': 'Alfa Romeo',
  'ds': 'DS',
  'cupra': 'CUPRA',
  'mg': 'MG',
  'dacia': 'Dacia',
  'tesla': 'Tesla',
  'jeep': 'Jeep',
  'dodge': 'Dodge',
  'chrysler': 'Chrysler',
  'chevrolet': 'Chevrolet',
  'chevy': 'Chevrolet',
};

// Model family groupings (model variant → family)
const MODEL_FAMILIES: Record<string, Record<string, string>> = {
  'BMW': {
    '1 series': '1 Series', '116': '1 Series', '118': '1 Series', '120': '1 Series', '125': '1 Series', '130': '1 Series', '135': '1 Series', 'm135': '1 Series', 'm140': '1 Series',
    '2 series': '2 Series', '218': '2 Series', '220': '2 Series', '225': '2 Series', '228': '2 Series', '230': '2 Series', 'm235': '2 Series', 'm240': '2 Series',
    '3 series': '3 Series', '316': '3 Series', '318': '3 Series', '320': '3 Series', '325': '3 Series', '328': '3 Series', '330': '3 Series', '335': '3 Series', '340': '3 Series', 'm340': '3 Series',
    '4 series': '4 Series', '418': '4 Series', '420': '4 Series', '425': '4 Series', '428': '4 Series', '430': '4 Series', '435': '4 Series', '440': '4 Series', 'm440': '4 Series',
    '5 series': '5 Series', '518': '5 Series', '520': '5 Series', '525': '5 Series', '528': '5 Series', '530': '5 Series', '535': '5 Series', '540': '5 Series', 'm550': '5 Series',
    'x1': 'X1', 'x2': 'X2', 'x3': 'X3', 'x4': 'X4', 'x5': 'X5', 'x6': 'X6', 'x7': 'X7',
    'z4': 'Z4', 'i3': 'i3', 'i4': 'i4', 'ix': 'iX', 'ix3': 'iX3',
    'm2': 'M2', 'm3': 'M3', 'm4': 'M4', 'm5': 'M5', 'm8': 'M8',
  },
  'Mercedes-Benz': {
    'a class': 'A-Class', 'a-class': 'A-Class', 'a180': 'A-Class', 'a200': 'A-Class', 'a220': 'A-Class', 'a250': 'A-Class', 'a35': 'A-Class', 'a45': 'A-Class',
    'b class': 'B-Class', 'b-class': 'B-Class', 'b180': 'B-Class', 'b200': 'B-Class',
    'c class': 'C-Class', 'c-class': 'C-Class', 'c180': 'C-Class', 'c200': 'C-Class', 'c220': 'C-Class', 'c250': 'C-Class', 'c300': 'C-Class', 'c350': 'C-Class', 'c43': 'C-Class', 'c63': 'C-Class',
    'e class': 'E-Class', 'e-class': 'E-Class', 'e200': 'E-Class', 'e220': 'E-Class', 'e250': 'E-Class', 'e300': 'E-Class', 'e350': 'E-Class', 'e400': 'E-Class', 'e43': 'E-Class', 'e53': 'E-Class', 'e63': 'E-Class',
    's class': 'S-Class', 's-class': 'S-Class',
    'gla': 'GLA', 'glb': 'GLB', 'glc': 'GLC', 'gle': 'GLE', 'gls': 'GLS',
    'cla': 'CLA', 'cls': 'CLS',
    'v class': 'V-Class', 'v-class': 'V-Class', 'vito': 'Vito', 'sprinter': 'Sprinter',
    'eqa': 'EQA', 'eqb': 'EQB', 'eqc': 'EQC', 'eqe': 'EQE', 'eqs': 'EQS',
  },
  'Land Rover': {
    'range rover': 'Range Rover', 'range rover sport': 'Range Rover Sport', 'range rover evoque': 'Range Rover Evoque', 'range rover velar': 'Range Rover Velar',
    'discovery': 'Discovery', 'discovery sport': 'Discovery Sport',
    'defender': 'Defender', 'freelander': 'Freelander',
  },
  'Audi': {
    'a1': 'A1', 'a3': 'A3', 'a4': 'A4', 'a5': 'A5', 'a6': 'A6', 'a7': 'A7', 'a8': 'A8',
    'q2': 'Q2', 'q3': 'Q3', 'q4': 'Q4', 'q5': 'Q5', 'q7': 'Q7', 'q8': 'Q8',
    'tt': 'TT', 'r8': 'R8', 'rs3': 'RS3', 'rs4': 'RS4', 'rs5': 'RS5', 'rs6': 'RS6', 'rs7': 'RS7',
    's3': 'S3', 's4': 'S4', 's5': 'S5', 's6': 'S6',
    'e-tron': 'e-tron', 'etron': 'e-tron', 'q4 e-tron': 'Q4 e-tron',
  },
  'Volkswagen': {
    'golf': 'Golf', 'polo': 'Polo', 'up': 'Up!', 'tiguan': 'Tiguan', 'touareg': 'Touareg', 'touran': 'Touran',
    'passat': 'Passat', 'arteon': 'Arteon', 'scirocco': 'Scirocco', 'beetle': 'Beetle',
    't-roc': 'T-Roc', 'troc': 'T-Roc', 't-cross': 'T-Cross', 'tcross': 'T-Cross',
    'id.3': 'ID.3', 'id3': 'ID.3', 'id.4': 'ID.4', 'id4': 'ID.4', 'id.5': 'ID.5',
    'transporter': 'Transporter', 'caddy': 'Caddy', 'crafter': 'Crafter', 'caravelle': 'Caravelle',
  },
  'Ford': {
    'fiesta': 'Fiesta', 'focus': 'Focus', 'mondeo': 'Mondeo', 'kuga': 'Kuga', 'puma': 'Puma', 'ecosport': 'EcoSport',
    'mustang': 'Mustang', 'mustang mach-e': 'Mustang Mach-E', 'ranger': 'Ranger', 'transit': 'Transit',
    'transit custom': 'Transit Custom', 'transit connect': 'Transit Connect', 'galaxy': 'Galaxy', 's-max': 'S-MAX',
    'explorer': 'Explorer', 'edge': 'Edge',
  },
  'Vauxhall': {
    'corsa': 'Corsa', 'astra': 'Astra', 'insignia': 'Insignia', 'mokka': 'Mokka', 'crossland': 'Crossland',
    'grandland': 'Grandland', 'vivaro': 'Vivaro', 'combo': 'Combo', 'movano': 'Movano',
  },
  'Toyota': {
    'yaris': 'Yaris', 'corolla': 'Corolla', 'camry': 'Camry', 'rav4': 'RAV4', 'rav 4': 'RAV4',
    'c-hr': 'C-HR', 'chr': 'C-HR', 'hilux': 'Hilux', 'land cruiser': 'Land Cruiser',
    'prius': 'Prius', 'aygo': 'Aygo', 'gt86': 'GT86', 'supra': 'Supra', 'highlander': 'Highlander',
    'bz4x': 'bZ4X',
  },
};

export interface NormalisedVehicle {
  make: string;
  modelFamily: string;
  variant: string;
  originalMake: string;
  originalModel: string;
}

export interface VehicleTaxonomy {
  make: string;
  families: {
    family: string;
    variants: {
      variant: string;
      count: number;
      totalCost: number;
      paidCount: number;
    }[];
    count: number;
    totalCost: number;
    paidCount: number;
  }[];
  count: number;
  totalCost: number;
  paidCount: number;
}

export function normaliseMake(rawMake: string): string {
  if (!rawMake) return 'Unknown';
  const key = rawMake.toLowerCase().trim();
  return MAKE_ALIASES[key] || rawMake.trim().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
}

export function normaliseModelFamily(make: string, rawModel: string): string {
  if (!rawModel) return 'Unknown';
  const modelLower = rawModel.toLowerCase().trim();
  
  const families = MODEL_FAMILIES[make];
  if (families) {
    // Try exact match first
    if (families[modelLower]) return families[modelLower];
    
    // Try partial match (model starts with known key)
    for (const [key, family] of Object.entries(families)) {
      if (modelLower.startsWith(key)) return family;
    }
    
    // Try if any key is contained in the model
    for (const [key, family] of Object.entries(families)) {
      if (key.length >= 3 && modelLower.includes(key)) return family;
    }
  }
  
  // Fallback: use first significant word(s) as family
  const words = rawModel.trim().split(/\s+/);
  return words.slice(0, 2).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
}

export function normaliseVehicle(rawMake: string | null, rawModel: string | null): NormalisedVehicle {
  const make = normaliseMake(rawMake || '');
  const modelFamily = normaliseModelFamily(make, rawModel || '');
  const variant = rawModel?.trim() || 'Unknown';
  
  return {
    make,
    modelFamily,
    variant,
    originalMake: rawMake || '',
    originalModel: rawModel || '',
  };
}

export interface ClaimWithVehicle {
  id: string;
  status: string;
  payment_amount?: number;
  created_at: string;
  vehicle_registration?: string;
}

export interface VehicleClaimRecord {
  normalised: NormalisedVehicle;
  claimCount: number;
  totalCost: number;
  paidCount: number;
  claims: ClaimWithVehicle[];
}

export function buildVehicleTaxonomy(
  records: { make: string; model: string; claimCount: number; totalCost: number; paidCount: number }[]
): VehicleTaxonomy[] {
  const makeMap = new Map<string, Map<string, { variants: Map<string, { count: number; totalCost: number; paidCount: number }>; count: number; totalCost: number; paidCount: number }>>();

  records.forEach(r => {
    const normMake = normaliseMake(r.make);
    const normFamily = normaliseModelFamily(normMake, r.model);
    const variant = r.model || 'Unknown';

    if (!makeMap.has(normMake)) makeMap.set(normMake, new Map());
    const families = makeMap.get(normMake)!;
    
    if (!families.has(normFamily)) families.set(normFamily, { variants: new Map(), count: 0, totalCost: 0, paidCount: 0 });
    const fam = families.get(normFamily)!;
    
    fam.count += r.claimCount;
    fam.totalCost += r.totalCost;
    fam.paidCount += r.paidCount;
    
    if (!fam.variants.has(variant)) fam.variants.set(variant, { count: 0, totalCost: 0, paidCount: 0 });
    const v = fam.variants.get(variant)!;
    v.count += r.claimCount;
    v.totalCost += r.totalCost;
    v.paidCount += r.paidCount;
  });

  return Array.from(makeMap.entries())
    .map(([make, families]) => {
      const familyArr = Array.from(families.entries()).map(([family, data]) => ({
        family,
        variants: Array.from(data.variants.entries())
          .map(([variant, vd]) => ({ variant, ...vd }))
          .sort((a, b) => b.count - a.count),
        count: data.count,
        totalCost: data.totalCost,
        paidCount: data.paidCount,
      })).sort((a, b) => b.count - a.count);

      return {
        make,
        families: familyArr,
        count: familyArr.reduce((s, f) => s + f.count, 0),
        totalCost: familyArr.reduce((s, f) => s + f.totalCost, 0),
        paidCount: familyArr.reduce((s, f) => s + f.paidCount, 0),
      };
    })
    .filter(m => m.make !== 'Unknown')
    .sort((a, b) => b.count - a.count);
}
