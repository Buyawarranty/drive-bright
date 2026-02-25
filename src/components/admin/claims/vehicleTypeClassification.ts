/**
 * Classifies a vehicle into a body-type category based on make, model name,
 * and fuel type.  The classification follows a priority order:
 *   1. EV / PHEV (from fuel type)
 *   2. Van / Pickup / Motorbike (from model keywords or make)
 *   3. SUV / Crossover
 *   4. Estate / Coupe / Convertible / MPV
 *   5. Hatchback / Saloon
 *   6. Fallback → "Car"
 */

const MOTORCYCLE_MAKES = new Set([
  'yamaha', 'kawasaki', 'ducati', 'ktm', 'harley-davidson', 'harley davidson',
  'triumph', 'aprilia', 'husqvarna', 'mv agusta', 'benelli', 'moto guzzi',
  'indian', 'royal enfield', 'norton', 'zero', 'energica',
]);

const VAN_MODELS = [
  'transit', 'sprinter', 'crafter', 'master', 'boxer', 'ducato', 'daily',
  'nv200', 'nv300', 'nv400', 'vivaro', 'movano', 'trafic', 'expert',
  'dispatch', 'relay', 'proace', 'berlingo van', 'partner van', 'caddy van',
  'transporter', 'connect', 'custom', 'e-transit', 'e-nv200', 'combo cargo',
  'promaster', 'savana', 'express',
];

const PICKUP_MODELS = [
  'ranger', 'hilux', 'l200', 'navara', 'amarok', 'isuzu d-max', 'd-max',
  'musso', 'fullback', 'actyon', 'pickup', 'pick-up',
];

const SUV_MODELS = [
  // Popular SUVs / crossovers
  'sportage', 'tucson', 'qashqai', 'x-trail', 'rav4', 'rav 4', 'cr-v', 'crv',
  'hr-v', 'hrv', 'cx-3', 'cx-5', 'cx-30', 'cx-60', 'cx-90',
  'tiguan', 'touareg', 't-roc', 't-cross', 'taos',
  'x1', 'x2', 'x3', 'x4', 'x5', 'x6', 'x7', 'ix1', 'ix3',
  'q2', 'q3', 'q5', 'q7', 'q8', 'e-tron',
  'gla', 'glb', 'glc', 'gle', 'gls', 'eqa', 'eqb', 'eqc', 'eqe suv', 'eqs suv',
  'range rover', 'evoque', 'velar', 'discovery', 'defender', 'freelander',
  'f-pace', 'e-pace', 'i-pace',
  'macan', 'cayenne',
  'ux', 'nx', 'rx', 'lx', 'rz',
  'xc40', 'xc60', 'xc90', 'ex30', 'ex90',
  'korando', 'rexton', 'tivoli',
  'karoq', 'kodiaq', 'kamiq', 'enyaq',
  'ateca', 'tarraco', 'arona', 'formentor',
  'captur', 'kadjar', 'koleos', 'austral',
  'puma', 'kuga', 'ecosport', 'explorer', 'mustang mach-e',
  'mokka', 'grandland', 'crossland', 'frontera',
  'juke', 'kicks', 'ariya', 'pathfinder',
  'c-hr', 'highlander', 'land cruiser', 'yaris cross',
  'forester', 'outback', 'xv', 'crosstrek', 'solterra',
  'vitara', 'jimny', 's-cross', 'across',
  'outlander', 'asx', 'eclipse cross', 'shogun',
  'niro', 'sorento', 'stonic', 'seltos', 'ev6', 'ev9',
  'kona', 'bayon', 'santa fe', 'ioniq 5', 'ioniq 7',
  'cupra ateca', 'cupra formentor',
  'born', 'id.4', 'id.5',
  'enyaq', 'elroq',
  'countryman', 'paceman',
  'trax', 'equinox', 'blazer',
  'renegade', 'compass', 'cherokee', 'wrangler', 'avenger',
  'duster', 'spring',
  '2008', '3008', '5008', 'e-2008', 'e-3008', 'e-5008',
  'c3 aircross', 'c4 x', 'c5 aircross',
  'model x', 'model y',
  'atto 3', 'tang', 'yuan plus',
  'mg zs', 'mg hs', 'marvel r',
  'u5', 'u6',
  'suv', 'crossover', '4x4',
];

const ESTATE_MODELS = [
  'estate', 'touring', 'avant', 'sportback', 'tourer', 'wagon', 'sw',
  'sportwagon', 'shooting brake', 'alltrack', 'allroad', 'combi',
  'variant', 'break',
];

const COUPE_MODELS = [
  'coupe', 'coupé', 'gt', 'gran turismo', 'granturismo',
  'tt', 'z4', 'supra', '86', 'brz', 'cayman',
  'rc', 'lc',
];

const CONVERTIBLE_MODELS = [
  'convertible', 'cabriolet', 'cabrio', 'roadster', 'spyder', 'spider',
  'boxster', 'mx-5', 'mx5', 'miata', 'z4 roadster', 'sl',
];

const MPV_MODELS = [
  'touran', 'sharan', 'alhambra', 'galaxy', 's-max', 'zafira',
  'scenic', 'grand scenic', 'c4 picasso', 'c4 spacetourer', 'berlingo',
  'partner', 'rifter', 'combo life', 'proace city verso', 'verso',
  'mpv', 'minivan', 'people carrier',
];

const HATCHBACK_MODELS = [
  'golf', 'polo', 'up!', 'corsa', 'astra', 'adam', 'fiesta', 'focus',
  'ka', 'ka+', 'clio', 'megane', 'zoe', '208', '308', 'c3', 'c4',
  'fabia', 'scala', 'rapid', 'octavia hatch', 'leon', 'ibiza',
  'i10', 'i20', 'i30', 'picanto', 'rio', 'ceed', 'proceed',
  'swift', 'baleno', 'ignis', 'yaris', 'aygo', 'corolla hatch',
  'civic', 'jazz', 'fit', 'honda e', 'mazda2', 'mazda3',
  'micra', 'leaf', 'note', 'pulsar',
  '1 series', '2 series', 'a-class', 'a class',
  'model 3', 'id.3', 'born',
  'hatchback', 'hatch',
];

const SALOON_MODELS = [
  '3 series', '5 series', '7 series', 'c-class', 'e-class', 's-class',
  'a4', 'a6', 'a8', 'passat', 'arteon', 'superb', 'mondeo', 'insignia',
  'accord', 'camry', 'avensis', 'mazda6', 'malibu', 'talisman',
  'saloon', 'sedan', 'limousine',
  'model s', 'is', 'es', 'gs', 'ls', 's60', 's90',
];

function matchesList(model: string, list: string[]): boolean {
  return list.some(keyword => {
    const kw = keyword.toLowerCase();
    // Exact match or word boundary match
    return model === kw ||
      model.includes(` ${kw} `) ||
      model.startsWith(`${kw} `) ||
      model.endsWith(` ${kw}`) ||
      model.includes(`-${kw}`) ||
      model.includes(`${kw}-`);
  });
}

export type VehicleBodyType =
  | 'SUV'
  | 'Van'
  | 'Pickup'
  | 'Estate'
  | 'Coupe'
  | 'Convertible'
  | 'MPV'
  | 'Hatchback'
  | 'Saloon'
  | 'EV'
  | 'PHEV'
  | 'Motorbike'
  | 'Car';

export function classifyVehicleType(
  make: string | null | undefined,
  model: string | null | undefined,
  fuelType: string | null | undefined,
): VehicleBodyType {
  const makeLower = (make || '').toLowerCase().trim();
  const modelLower = (model || '').toLowerCase().trim();
  const fuelLower = (fuelType || '').toLowerCase().trim();

  // EV / PHEV first
  const isElectric =
    fuelLower.includes('electricity') ||
    fuelLower === 'electric' ||
    fuelLower === 'battery electric';
  const isHybrid =
    fuelLower.includes('hybrid') ||
    fuelLower.includes('petrol/electric') ||
    fuelLower.includes('plug-in');

  // Motorbike
  if (MOTORCYCLE_MAKES.has(makeLower)) return 'Motorbike';

  // Van
  if (matchesList(modelLower, VAN_MODELS)) return 'Van';

  // Pickup
  if (matchesList(modelLower, PICKUP_MODELS)) return 'Pickup';

  // EV / PHEV (after van/pickup so electric vans stay Van)
  if (isElectric) return 'EV';
  if (isHybrid) return 'PHEV';

  // SUV
  if (matchesList(modelLower, SUV_MODELS)) return 'SUV';

  // Estate
  if (matchesList(modelLower, ESTATE_MODELS)) return 'Estate';

  // Convertible (before Coupe so "roadster" doesn't match GT)
  if (matchesList(modelLower, CONVERTIBLE_MODELS)) return 'Convertible';

  // Coupe
  if (matchesList(modelLower, COUPE_MODELS)) return 'Coupe';

  // MPV
  if (matchesList(modelLower, MPV_MODELS)) return 'MPV';

  // Hatchback
  if (matchesList(modelLower, HATCHBACK_MODELS)) return 'Hatchback';

  // Saloon
  if (matchesList(modelLower, SALOON_MODELS)) return 'Saloon';

  return 'Car';
}
