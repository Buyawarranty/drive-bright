/**
 * Single source of truth for prices used in structured data (JSON-LD).
 *
 * WHY THIS EXISTS
 * Landing pages used to hardcode schema prices ("price": "19", "29", …).
 * Every time the pricing grid was updated those numbers drifted away from the
 * prices actually shown on the page, and Google / Semrush flag that mismatch
 * as invalid Product markup (the Offer price must match the visible price).
 *
 * This module DERIVES the advertised "from" price from the published net price
 * floor. It is read-only with respect to pricing logic — it never sets, changes
 * or overrides a price, it only reports the lowest advertised figure so the
 * markup follows the pricing engine automatically.
 */
import { NET_FLOOR_BY_PERIOD } from '@/lib/pricing/netFloor';

export const SEO_PRICE_CURRENCY = 'GBP';

/** Lowest 12-month total a customer can actually buy for, on the website. */
export const SEO_FROM_ANNUAL_PRICE = NET_FLOOR_BY_PERIOD['12months'];

/** Lowest advertised monthly figure (12 interest-free instalments). */
export const SEO_FROM_MONTHLY_PRICE = Math.ceil(SEO_FROM_ANNUAL_PRICE / 12);

/** e.g. "£29-£95/month" for LocalBusiness/Service priceRange. */
export const SEO_PRICE_RANGE = `£${SEO_FROM_MONTHLY_PRICE}-£${SEO_FROM_MONTHLY_PRICE * 4}/month`;

/**
 * Offers block for a Product/Service schema.
 * `priceValidUntil` is kept short-dated so a stale price is never advertised
 * as valid indefinitely.
 */
export function buildOfferSchema(url: string) {
  return {
    '@type': 'Offer',
    priceCurrency: SEO_PRICE_CURRENCY,
    price: String(SEO_FROM_MONTHLY_PRICE),
    priceValidUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0],
    availability: 'https://schema.org/InStock',
    url,
    seller: {
      '@type': 'Organization',
      name: 'Buy A Warranty',
    },
    itemCondition: 'https://schema.org/NewCondition',
    priceSpecification: {
      '@type': 'UnitPriceSpecification',
      price: String(SEO_FROM_MONTHLY_PRICE),
      priceCurrency: SEO_PRICE_CURRENCY,
      unitText: 'month',
      billingIncrement: 1,
    },
  };
}
