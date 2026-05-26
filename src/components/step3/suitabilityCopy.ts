// Suitability copy for selector cards — shown as a small "Suitable for…" line.
// Keep phrasing positive and explanatory (no negative wording).

export const CLAIM_LIMIT_SUITABILITY: Record<number, string> = {
  750: 'Ideal for common repairs on older or lower-value cars',
  1250: 'Suitable for most everyday repairs',
  2000: 'Recommended for most modern petrol & diesel cars',
  3000: 'Suitable for higher-value engines and gearboxes',
  5000: 'Recommended for premium vehicles & complex repairs',
};

export const LABOUR_RATE_SUITABILITY: Record<number, string> = {
  50: 'Best for local independent garages',
  70: 'Most customers choose £70/hr',
  100: 'Recommended for approved garage networks',
  200: 'Recommended for main dealers & specialists',
};

export const EXCESS_SUITABILITY: Record<number, string> = {
  0: 'No excess',
  50: 'Low excess',
  100: 'Balanced cover',
  150: 'Best balance',
  250: 'Lower monthly',
  500: 'Lowest monthly',
};

