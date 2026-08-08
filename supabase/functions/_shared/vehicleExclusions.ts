/**
 * Excluded vehicle matrix (Deno / edge function copy).
 * Keep in sync with src/lib/vehicleExclusions.ts
 *
 * Whole-brand exclusions plus make + model combinations only — a standard BMW or
 * Mercedes remains coverable, the M / AMG performance version does not.
 */

export const EXCLUDED_MAKES: string[] = [
  'bugatti', 'koenigsegg', 'pagani', 'rimac', 'hennessey',
  'ferrari', 'lamborghini', 'mclaren', 'aston martin', 'astonmartin',
  'rolls-royce', 'rolls royce', 'rollsroyce', 'bentley', 'maybach',
  'maserati', 'lotus',
  'tvr', 'morgan', 'ariel', 'bac', 'caterham', 'westfield', 'mev', 'ultima',
  'radical', 'noble', 'ginetta',
];

type ModelRule = { makes: string[]; patterns: RegExp[]; label: string };

const BMW = ['bmw'];
const MERC = ['mercedes', 'mercedes-benz', 'mercedes benz', 'mercedesbenz', 'mercedes-amg', 'mercedes amg', 'amg'];
const LR = ['land rover', 'landrover', 'range rover', 'rangerover', 'jaguar land rover'];

export const EXCLUDED_MODEL_RULES: ModelRule[] = [
  { makes: BMW, label: 'BMW M-Series', patterns: [/\bm[2345678]\b/, /\b1m\b/, /\bm1\b/, /\bx[3456]\s*m\b/, /\bxm\b/, /\bz[34]\s*m\b/, /\bm\s*roadster\b/, /\bm\s*coupe\b/, /\b3\.0\s*csl\b/] },
  { makes: BMW, label: 'BMW electric M performance', patterns: [/\bi[457x]\s*m\s*\d+\b/, /\bm\s*(50|60|70)\b/] },
  { makes: MERC, label: 'Mercedes-AMG', patterns: [/\bamg\s*gt\b/, /\b(a|cla|gla)\s*45\b/, /\b(c|e|cls|s|sl|clk|cl|ml|gl|gle|gls|glc|g|r)\s*6[35]\b/, /\bs\s*70\b/, /\bsl\s*7[03]\b/, /\b(c|e|s|cls|sl|clk|cl|ml|g)\s*5[05]\s*amg\b/, /\b(c|e)\s*36\s*amg\b/, /\bamg\s*one\b/, /\beq[se]\s*53\b/, /\bamg\s*eq[se]\b/, /\bcle\s*63\b/, /\bgt\s*(43|53|63)\b/] },
  { makes: ['audi'], label: 'Audi RS / R8', patterns: [/\brs\s*[234567]\b/, /\brs\s*q[3578]\b/, /\brs\s*e-?\s*tron\b/, /\btt\s*rs\b/, /\br8\b/] },
  { makes: ['porsche'], label: 'Porsche high-performance', patterns: [/\bgt[23]\b/, /\bgt4\b/, /\b911\b.*\bturbo\b/, /\bturbo\s*s\b/, /\bturbo\s*gt\b/, /\b(911|carrera)\b.*\bgts\b/, /\b(panamera|cayenne|taycan|macan)\b.*\bturbo\b/, /\b718\b.*\bspyder\b/, /\bboxster\s*spyder\b/, /\bcarrera\s*gt\b/, /\b918\b/] },
  { makes: ['ford'], label: 'Ford Performance', patterns: [/\b(fiesta|focus|puma)\s*(st|rs)\b/, /\bmustang\b.*\b(gt|mach\s*1|mach-?e\s*gt|shelby|gt350|gt500)\b/, /\bshelby\b/, /^gt$/, /\branger\s*raptor\b/, /\braptor\b/] },
  { makes: ['vauxhall', 'opel'], label: 'Vauxhall Performance', patterns: [/\bvxr\b/, /\bvxr8\b/, /\bgsi\b/, /\bopc\b/] },
  { makes: ['mini'], label: 'MINI John Cooper Works', patterns: [/\bjcw\b/, /\bjohn\s*cooper\s*works\b/] },
  { makes: LR, label: 'Land Rover Performance', patterns: [/\bsvr\b/, /\bsvx\b/, /\bsvautobiography\b/, /\bsv\s*(black|carbon|bespoke)\b/, /\bsport\s*sv\b/, /\bdefender\b.*\bv8\b/] },
  { makes: ['nissan'], label: 'Nissan GT-R', patterns: [/\bgt-?r\b/, /\bskyline\b/] },
  { makes: ['toyota'], label: 'Toyota GR performance', patterns: [/\bgr\s*(supra|yaris|corolla|86)\b/, /\bsupra\b/] },
  { makes: ['lexus'], label: 'Lexus performance', patterns: [/\blc\s*500\b/, /\blfa\b/, /\brc\s*f\b/, /\bgs\s*f\b/] },
  { makes: ['chevrolet', 'chevy'], label: 'Chevrolet Corvette', patterns: [/\bcorvette\b/, /\bcamaro\s*zl1\b/] },
  { makes: ['dodge', 'srt'], label: 'Dodge SRT performance', patterns: [/\bhellcat\b/, /\bdemon\b/, /\bredeye\b/, /\bviper\b/, /\bsrt\b/] },
  { makes: ['jaguar'], label: 'Jaguar F-Type SVR', patterns: [/\bf-?type\b.*\bsvr\b/, /\bsvr\b/, /\bproject\s*8\b/] },
  { makes: ['alfa romeo', 'alfa'], label: 'Alfa Romeo Quadrifoglio', patterns: [/\bquadrifoglio\b/, /\bqv\b/, /\bgta\b/] },
  { makes: ['tesla'], label: 'Tesla Plaid', patterns: [/\bplaid\b/, /\broadster\b/] },
];

const UNIVERSAL_MODEL_PATTERNS: RegExp[] = [/\bkit\s*car\b/, /\breplica\b/, /\bgrey\s*import\b/, /\bimport\b.*\bnon-?uk\b/];

const normalise = (value?: string | null): string =>
  (value || '').toLowerCase().replace(/[^\w\s-]/g, ' ').replace(/\s+/g, ' ').trim();

/** Cosmetic trims (Audi "S line", Mercedes "AMG Line") — standard cars, not performance models. */
const COSMETIC_TRIM_PATTERNS: RegExp[] = [
  /\bs[\s-]?line\b/g,
  /\bsport[\s-]?line\b/g,
  /\bamg[\s-]?line\b/g,
  /\bamg\s*(premium|premium\s*plus|plus|night|night\s*edition|sport|styling|advanced|executive|edition)\b/g,
];
const REAL_AMG_BADGE = /\b(35|43|45|53|55|63|65|70|73)\b|\bgt\b|\bone\b|\bblack\s*series\b/;

export const stripCosmeticTrims = (model?: string | null): string => {
  let out = normalise(model);
  for (const p of COSMETIC_TRIM_PATTERNS) out = out.replace(p, ' ');
  out = out.replace(/\s+/g, ' ').trim();
  if (/\bamg\b/.test(out) && !REAL_AMG_BADGE.test(out.replace(/\bamg\b/g, ' '))) {
    out = out.replace(/\bamg\b/g, ' ').replace(/\s+/g, ' ').trim();
  }
  return out;
};

export const isExcludedMake = (make?: string | null): boolean => {
  const m = normalise(make);
  if (!m) return false;
  return EXCLUDED_MAKES.some((excluded) => m === excluded || m.startsWith(`${excluded} `));
};

export const isExcludedModel = (make?: string | null, model?: string | null): boolean => {
  const m = normalise(make);
  const mod = stripCosmeticTrims(model);
  if (!mod) return false;
  if (UNIVERSAL_MODEL_PATTERNS.some((p) => p.test(mod))) return true;
  const combined = `${m} ${mod}`.trim();
  return EXCLUDED_MODEL_RULES.some((rule) => {
    const makeMatches = rule.makes.some((alias) => m === alias || m.startsWith(`${alias} `) || m.includes(alias));
    if (!makeMatches) return false;
    return rule.patterns.some((p) => p.test(mod) || p.test(combined));
  });
};


export const isVehicleExcluded = (make?: string | null, model?: string | null): boolean =>
  isExcludedMake(make) || isExcludedModel(make, model);
