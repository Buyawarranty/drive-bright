/**
 * Discount recorded ON the order itself.
 *
 * When an agent confirms a payment they took outside the website (bank transfer,
 * card over the phone, Stripe dashboard, Bumper portal…) they are also confirming
 * the discount they gave. At that moment we know both numbers exactly:
 *   - the grid/quoted price the agent was looking at  -> customers.original_amount
 *   - the amount they actually collected              -> customers.final_amount
 * The gap is stored in customers.discount_amount, so the discount never has to be
 * reverse-engineered from a later price change.
 *
 * Reporting surfaces (Discounts given, Customer management) should always prefer
 * this recorded figure and only fall back to the pricing-matrix estimate when a
 * legacy order has nothing stored.
 */
export interface OrderDiscountRecord {
  final_amount?: number | null;
  original_amount?: number | null;
  discount_amount?: number | null;
  /** Quoted total recorded at the point of sale (preferred over everything else). */
  sale_quoted_total?: number | null;
  sale_discount_amount?: number | null;
  sale_discount_pct?: number | null;
}

export interface RecordedOrderDiscount {
  /** Price quoted at the point of sale. */
  quoted: number;
  /** Amount collected. */
  paid: number;
  /** Money given away (0 when sold at or above the quote). */
  amount: number;
  /** Discount as a percentage of the quoted price. */
  pct: number;
}

export const getRecordedOrderDiscount = (
  order?: OrderDiscountRecord | null,
): RecordedOrderDiscount | null => {
  if (!order) return null;

  const paid = Number(order.final_amount) || 0;
  const storedDiscount = Number(order.discount_amount) || 0;
  const storedOriginalRaw = Number(order.original_amount) || 0;
  const saleQuoted = Number(order.sale_quoted_total) || 0;

  // Externally confirmed payments (bank transfer, Stripe dashboard, Bumper,
  // Payment Assist…) often had the amount COLLECTED copied into original_amount.
  // That is the agent's own figure, not the price the pricing logic quoted on the
  // day, so treating it as the quote invents a "No discount given" record. Only
  // trust original_amount when it is a genuinely higher quoted price.
  const originalIsMirroredPaid =
    storedOriginalRaw > 0 && paid > 0 && Math.abs(storedOriginalRaw - paid) <= 0.5;
  const storedOriginal = originalIsMirroredPaid ? 0 : storedOriginalRaw;

  // Prefer the quote recorded at the point of sale, then a real original amount,
  // otherwise rebuild it from paid + discount.
  const quoted =
    saleQuoted > 0
      ? saleQuoted
      : storedOriginal > 0
        ? storedOriginal
        : storedDiscount > 0
          ? paid + storedDiscount
          : 0;
  if (quoted <= 0 || paid <= 0) return null;

  const amount = Math.round((quoted - paid) * 100) / 100;
  if (amount <= 0.5) return { quoted, paid, amount: 0, pct: 0 };

  return {
    quoted,
    paid,
    amount,
    pct: Math.round((amount / quoted) * 1000) / 10,
  };
};

/** Colour band shared with Discounts given: <20% fine, 20–30% watch, 30%+ breach. */
export const discountBandClass = (pct: number): string => {
  if (pct <= 0) return 'border-muted text-muted-foreground';
  if (pct < 20) return 'border-green-300 text-green-700 bg-green-50';
  if (pct < 30) return 'border-orange-300 text-orange-700 bg-orange-50';
  return 'border-red-300 text-red-700 bg-red-50';
};
