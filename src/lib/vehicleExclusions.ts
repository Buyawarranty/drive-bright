/**
 * Excluded vehicle matrix — the single source of truth for vehicles we cannot cover.
 *
 * Two layers:
 *  1) EXCLUDED_MAKES — the whole brand is excluded (Ferrari, Bentley, TVR, kit cars...).
 *  2) EXCLUDED_MODEL_RULES — make + model combinations only. The rest of the make stays
 *     coverable: a BMW 320d or Mercedes C 220 is fine, an M5 or C 63 is not.
 */

export const EXCLUSION_MESSAGE =
  "Thanks for your interest! Unfortunately, we're not able to offer warranty cover for this vehicle. This is down to factors like specialist parts or limited access to suitable repair centres.";

/** Entire brands we never cover. */
export const EXCLUDED_MAKES: string[] = [
  // Supercars & hypercars
  'bugatti',
  'koenigsegg',
  'pagani',
  'rimac',
  'hennessey',
  // Luxury & exotic sports
  'ferrari',
  'lamborghini',
  'mclaren',
  'aston martin',
  'astonmartin',
  // Ultra-luxury marques
  'rolls-royce',
  'rolls royce',
  'rollsroyce',
  'bentley',
  'maybach',
  // Other specialist marques
  'maserati',
  'lotus',
  // Kit cars, low-volume specialist
  'tvr',
  'morgan',
  'ariel',
  'bac',
  'caterham',
  'westfield',
  'mev',
  'ultima',
  'radical',
  'noble',
  'ginetta',
];

type ModelRule = {
  /** Make aliases this rule applies to (lowercase, normalised). */
  makes: string[];
  /** Patterns tested against the normalised model (and "make model"). */
  patterns: RegExp[];
  label: string;
};

const BMW = ['bmw'];
const MERC = ['mercedes', 'mercedes-benz', 'mercedes benz', 'mercedesbenz', 'mercedes-amg', 'mercedes amg', 'amg'];
const AUDI = ['audi'];
const PORSCHE = ['porsche'];
const FORD = ['ford'];
const VAUXHALL = ['vauxhall', 'opel'];
const MINI = ['mini'];
const LR = ['land rover', 'landrover', 'range rover', 'rangerover', 'jaguar land rover'];

/**
 * Make + model exclusions. Patterns are deliberately anchored on performance
 * badges so standard models of the same make remain coverable.
 */
export const EXCLUDED_MODEL_RULES: ModelRule[] = [
  // ── BMW M-Series ──
  {
    makes: BMW,
    label: 'BMW M-Series',
    patterns: [
      /\bm[2345678]\b/, // M2, M3, M4, M5, M6, M7, M8 and variants (Competition, CS, Touring…)
      /\b1m\b/,
      /\bm1\b/,
      /\bx[3456]\s*m\b/, // X3 M, X4 M, X5 M, X6 M (+ Competition)
      /\bxm\b/,
      /\bz[34]\s*m\b/,
      /\bm\s*roadster\b/,
      /\bm\s*coupe\b/,
      /\b3\.0\s*csl\b/,
    ],
  },
  // ── Mercedes-AMG (high output) ──
  {
    makes: MERC,
    label: 'Mercedes-AMG',
    patterns: [
      /\bamg\s*gt\b/,
      /\b(a|cla|gla)\s*45\b/,
      /\b(c|e|cls|s|sl|clk|cl|ml|gl|gle|gls|glc|g|r)\s*6[35]\b/, // 63 / 65 badges
      /\bs\s*70\b/,
      /\bsl\s*7[03]\b/,
      /\b(c|e|s|cls|sl|clk|cl|ml|g)\s*5[05]\s*amg\b/,
      /\b(c|e)\s*3[6]\s*amg\b/,
      /\bamg\s*one\b/,
      /\beq[se]\s*53\b/,
      /\bamg\s*eq[se]\b/,
      /\bcle\s*63\b/,
      /\bgt\s*(43|53|63)\b/,
    ],
  },
  // ── Audi RS & R8 ──
  {
    makes: AUDI,
    label: 'Audi RS / R8',
    patterns: [
      /\brs\s*[234567]\b/,
      /\brs\s*q[3578]\b/,
      /\brs\s*e-?\s*tron\b/,
      /\btt\s*rs\b/,
      /\br8\b/,
    ],
  },
  // ── Porsche high-performance ──
  {
    makes: PORSCHE,
    label: 'Porsche high-performance',
    patterns: [
      /\bgt[23]\b/, // 911 GT2 / GT3 (+ RS)
      /\bgt4\b/, // 718 Cayman GT4 / GT4 RS
      /\b911\b.*\bturbo\b/,
      /\bturbo\s*s\b/,
      /\bturbo\s*gt\b/,
      /\b(911|carrera)\b.*\bgts\b/,
      /\b(panamera|cayenne|taycan|macan)\b.*\bturbo\b/,
      /\b718\b.*\bspyder\b/,
      /\bboxster\s*spyder\b/,
      /\bcarrera\s*gt\b/,
      /\b918\b/,
    ],
  },
  // ── Ford performance ──
  {
    makes: FORD,
    label: 'Ford Performance',
    patterns: [
      /\b(fiesta|focus|puma)\s*(st|rs)\b/,
      /\bmustang\b.*\b(gt|mach\s*1|mach-?e\s*gt|shelby|gt350|gt500)\b/,
      /\bshelby\b/,
      /^gt$/,
      /\branger\s*raptor\b/,
      /\braptor\b/,
    ],
  },
  // ── Vauxhall performance ──
  {
    makes: VAUXHALL,
    label: 'Vauxhall Performance',
    patterns: [/\bvxr\b/, /\bvxr8\b/, /\bgsi\b/, /\bopc\b/],
  },
  // ── MINI JCW ──
  {
    makes: MINI,
    label: 'MINI John Cooper Works',
    patterns: [/\bjcw\b/, /\bjohn\s*cooper\s*works\b/],
  },
  // ── Land Rover / Range Rover performance ──
  {
    makes: LR,
    label: 'Land Rover Performance',
    patterns: [
      /\bsvr\b/,
      /\bsvx\b/,
      /\bsvautobiography\b/,
      /\bsv\s*(black|carbon|bespoke)\b/,
      /\bsport\s*sv\b/,
      /\bdefender\b.*\bv8\b/,
    ],
  },
  // ── Nissan ──
  { makes: ['nissan'], label: 'Nissan GT-R', patterns: [/\bgt-?r\b/, /\bskyline\b/] },
  // ── Toyota ──
  {
    makes: ['toyota'],
    label: 'Toyota GR performance',
    patterns: [/\bgr\s*(supra|yaris|corolla|86)\b/, /\bsupra\b/],
  },
  // ── Lexus ──
  { makes: ['lexus'], label: 'Lexus performance', patterns: [/\blc\s*500\b/, /\blfa\b/, /\brc\s*f\b/, /\bgs\s*f\b/] },
  // ── Chevrolet ──
  { makes: ['chevrolet', 'chevy'], label: 'Chevrolet Corvette', patterns: [/\bcorvette\b/, /\bcamaro\s*zl1\b/] },
  // ── Dodge ──
  {
    makes: ['dodge', 'srt'],
    label: 'Dodge SRT performance',
    patterns: [/\bhellcat\b/, /\bdemon\b/, /\bredeye\b/, /\bviper\b/, /\bsrt\b/],
  },
  // ── Jaguar ──
  { makes: ['jaguar'], label: 'Jaguar F-Type SVR', patterns: [/\bf-?type\b.*\bsvr\b/, /\bsvr\b/, /\bproject\s*8\b/] },
  // ── Alfa Romeo ──
  {
    makes: ['alfa romeo', 'alfa'],
    label: 'Alfa Romeo Quadrifoglio',
    patterns: [/\bquadrifoglio\b/, /\bqv\b/, /\b\bgta\b/],
  },
  // ── Tesla ──
  { makes: ['tesla'], label: 'Tesla Plaid', patterns: [/\bplaid\b/, /\broadster\b/] },
  // ── BMW electric M performance handled above (i4 M60 etc. via \bm[2-8]\b guard) ──
  {
    makes: BMW,
    label: 'BMW electric M performance',
    patterns: [/\bi[457x]\s*m\s*\d+\b/, /\bm\s*(50|60|70)\b/],
  },
];

/** Generic model keywords that mean "kit car / grey import" whatever the make. */
const UNIVERSAL_MODEL_PATTERNS: RegExp[] = [
  /\bkit\s*car\b/,
  /\breplica\b/,
  /\bgrey\s*import\b/,
  /\bimport\b.*\bnon-?uk\b/,
];

const normalise = (value?: string | null): string =>
  (value || '')
    .toLowerCase()
    .replace(/[^\w\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Cosmetic trim badges that look like performance names but are standard cars:
 * Audi "S line", Mercedes "AMG Line" / "AMG Premium" and friends. These are
 * stripped before exclusion matching so an A4 S line or A 200 AMG Line quotes
 * normally, while a genuine RS 4 or C 63 stays excluded.
 */
const COSMETIC_TRIM_PATTERNS: RegExp[] = [
  /\bs[\s-]?line\b/g,
  /\bsport[\s-]?line\b/g,
  /\bamg[\s-]?line\b/g,
  /\bamg\s*(premium|premium\s*plus|plus|night|night\s*edition|sport|styling|advanced|executive|edition)\b/g,
];

/** Performance badges that mean an "AMG" mention is a real AMG, not a trim. */
const REAL_AMG_BADGE = /\b(35|43|45|53|55|63|65|70|73)\b|\bgt\b|\bone\b|\bblack\s*series\b/;

/** Remove cosmetic trim wording from an already-normalised model string. */
export const stripCosmeticTrims = (model?: string | null): string => {
  let out = normalise(model);
  for (const p of COSMETIC_TRIM_PATTERNS) out = out.replace(p, ' ');
  out = out.replace(/\s+/g, ' ').trim();
  // A leftover bare "amg" with no performance badge is trim wording only.
  if (/\bamg\b/.test(out) && !REAL_AMG_BADGE.test(out.replace(/\bamg\b/g, ' '))) {
    out = out.replace(/\bamg\b/g, ' ').replace(/\s+/g, ' ').trim();
  }
  return out;
};

/** True when the whole brand is excluded. */
export const isExcludedMake = (make?: string | null): boolean => {
  const m = normalise(make);
  if (!m) return false;
  return EXCLUDED_MAKES.some((excluded) => m === excluded || m.startsWith(`${excluded} `));
};

/** True when this specific make + model combination is excluded. */
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


/** Full matrix check: brand-level or make + model level. */
export const isVehicleExcluded = (make?: string | null, model?: string | null): boolean =>
  isExcludedMake(make) || isExcludedModel(make, model);

/** Which rule matched, for admin display / debugging. */
export const getExclusionReason = (make?: string | null, model?: string | null): string | null => {
  if (isExcludedMake(make)) return `${(make || '').trim()} — make not covered`;
  const m = normalise(make);
  const mod = stripCosmeticTrims(model);
  const combined = `${m} ${mod}`.trim();
  const rule = EXCLUDED_MODEL_RULES.find(
    (r) =>
      r.makes.some((alias) => m === alias || m.startsWith(`${alias} `) || m.includes(alias)) &&
      r.patterns.some((p) => p.test(mod) || p.test(combined))
  );
  return rule ? `${rule.label} — model not covered` : null;
};
