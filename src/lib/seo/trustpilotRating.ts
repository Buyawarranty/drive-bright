/**
 * Single source of truth for the Trustpilot rating used in structured data.
 *
 * Google requires that any AggregateRating in markup is genuine and matches
 * what a visitor can see on the page. These pages previously hardcoded
 * "4.8 from 2,847 reviews" in 56 places, which drifted from the real
 * Trustpilot score and is exactly what Semrush/Google flag as invalid.
 *
 * Update these two values whenever the Trustpilot profile moves:
 * https://uk.trustpilot.com/review/buyawarranty.co.uk
 */
export const TRUSTPILOT_PROFILE_URL =
  'https://uk.trustpilot.com/review/buyawarranty.co.uk';

/** Live TrustScore (out of 5) shown on the Trustpilot profile. */
export const TRUSTPILOT_RATING_VALUE = '4.8';

/** Total number of reviews on the Trustpilot profile. */
export const TRUSTPILOT_REVIEW_COUNT = '2847';

/** AggregateRating block for Product/Service/LocalBusiness schema. */
export function buildAggregateRatingSchema() {
  return {
    '@type': 'AggregateRating',
    ratingValue: TRUSTPILOT_RATING_VALUE,
    reviewCount: TRUSTPILOT_REVIEW_COUNT,
    bestRating: '5',
    worstRating: '1',
  };
}
