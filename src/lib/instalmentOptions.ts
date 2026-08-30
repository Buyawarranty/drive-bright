// Instalment plan options for admin quoting surfaces (Quotes & Orders / Get Quote
// and Confirm External Payment ONLY — the public checkout Step 3/4 is untouched).
//
// Cover duration and instalment plan are separate choices:
//   1-Year Cover  -> 12 instalments
//   2-Year Cover  -> 12 or 24 instalments
//   3-Year Cover  -> 12 or 36 instalments
// The total price never changes — only how many monthly payments it is split over.

export type InstalmentCount = 12 | 24 | 36;

export function getInstalmentOptions(paymentType: string): InstalmentCount[] {
  if (paymentType === '24months') return [12, 24];
  if (paymentType === '36months') return [12, 36];
  return [12];
}

export function isInstalmentAllowed(paymentType: string, count: number): boolean {
  return getInstalmentOptions(paymentType).includes(count as InstalmentCount);
}

/** Monthly amount for a total split over N instalments (rounded up to the penny-free pound). */
export function instalmentAmount(totalPrice: number, count: InstalmentCount): number {
  const total = Number(totalPrice) || 0;
  if (total <= 0) return 0;
  return Math.ceil(total / count);
}

export function instalmentLabel(count: InstalmentCount): string {
  return `${count} instalments`;
}
