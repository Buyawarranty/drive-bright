/**
 * Single source of truth for the business identity used in JSON-LD structured data.
 *
 * Google's LocalBusiness rich-result guidelines require a full PostalAddress, and
 * merchant/product listings require an absolute image URL. Keeping both here means
 * every page emits the same valid values.
 */

export const SITE_URL = 'https://buyawarranty.co.uk';

export const BUSINESS_POSTAL_ADDRESS = {
  '@type': 'PostalAddress',
  streetAddress: 'Warranty House, 62 Berkhamsted Avenue',
  addressLocality: 'Wembley',
  addressRegion: 'London',
  postalCode: 'HA9 6DT',
  addressCountry: 'GB',
} as const;

export const BUSINESS_TELEPHONE = '+44-330-229-5040';

/** Absolute 1200x630 brand image — valid for Product / MerchantListing "image". */
export const DEFAULT_PRODUCT_IMAGE_URL = `${SITE_URL}/extended_warranty_uk-car-trustworthy-reviews.png`;
