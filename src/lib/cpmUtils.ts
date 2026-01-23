/**
 * Cost Per Month (CPM) Utility Functions
 * 
 * These functions calculate the "Cost per month of cover" with a guardrail
 * to ensure the CPM is trust-reinforcing and doesn't appear cheaper than
 * the actual monthly instalment.
 * 
 * Guardrail Rule: CPM × years >= monthly instalment
 * If not satisfied, CPM is increased by £1 until true.
 */

/**
 * Calculate Cost Per Month of Cover with guardrail logic
 * 
 * @param totalCost - The total cost of the warranty
 * @param coverMonths - Total months of cover (12, 24, or 36)
 * @param monthlyInstalment - The monthly payment amount (total / 12)
 * @returns The adjusted CPM that satisfies the guardrail
 */
export function calculateCPMWithGuardrail(
  totalCost: number,
  coverMonths: number,
  monthlyInstalment: number
): number {
  const years = coverMonths / 12;
  
  // Base CPM calculation (rounded to nearest pound)
  let cpm = Math.round(totalCost / coverMonths);
  
  // Guardrail: CPM × years must be >= monthly instalment
  // This ensures the representative CPM never looks cheaper than the actual payment
  // e.g., for 2-year: £38 × 2 = £76 >= £75 ✓
  // e.g., for 3-year: £36 × 3 = £108 >= £107 ✓
  while (cpm * years < monthlyInstalment) {
    cpm += 1;
  }
  
  return cpm;
}

/**
 * Get the number of years from payment type
 */
export function getYearsFromPaymentType(paymentType: string): number {
  switch (paymentType) {
    case '12months':
      return 1;
    case '24months':
      return 2;
    case '36months':
      return 3;
    default:
      return 1;
  }
}

/**
 * Get cover months from payment type
 */
export function getCoverMonthsFromPaymentType(paymentType: string): number {
  return getYearsFromPaymentType(paymentType) * 12;
}
