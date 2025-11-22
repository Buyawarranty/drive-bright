// Centralized warranty duration utilities to ensure consistency across all systems
// This should be the single source of truth for warranty duration calculations

export interface PaymentDuration {
  months: number;
  displayText: string;
  paymentFrequency: string;
}

/**
 * Get warranty duration in months based on payment type
 * This is the MASTER function for warranty duration calculation
 */
export function getWarrantyDurationInMonths(paymentType: string): number {
  const normalizedPaymentType = paymentType?.toLowerCase().replace(/[_-]/g, '').trim();
  
  switch (normalizedPaymentType) {
    case 'monthly':
    case '1month':
    case 'month':
    case '12months':
    case '12month':
    case 'yearly':
      return 12;
    case '24months':
    case '24month':
    case 'twomonthly':
    case '2monthly':
    case 'twoyearly':
      return 24;
    case '36months':
    case '36month':
    case 'threemonthly':
    case '3monthly':
    case 'threeyearly':
      return 36;
    case '48months':
    case '48month':
    case 'fourmonthly':
    case '4monthly':
      return 48;
    case '60months':
    case '60month':
    case 'fivemonthly':
    case '5monthly':
      return 60;
    default:
      console.warn(`Unknown payment type: ${paymentType}, defaulting to 12 months`);
      return 12;
  }
}

/**
 * Get warranty duration display text
 */
export function getWarrantyDurationDisplay(paymentType: string): string {
  const months = getWarrantyDurationInMonths(paymentType);
  if (months === 12) return '12 months';
  if (months === 24) return '24 months';
  if (months === 36) return '36 months';
  if (months === 48) return '48 months';
  if (months === 60) return '60 months';
  return `${months} months`;
}

/**
 * Get payment type display name
 */
export function getPaymentTypeDisplay(paymentType: string): string {
  const normalizedPaymentType = paymentType?.toLowerCase().replace(/[_-]/g, '').trim();
  
  switch (normalizedPaymentType) {
    case 'monthly':
    case '1month':
    case 'month':
    case '12months':
    case '12month':
    case 'yearly':
      return '12 months';
    case '24months':
    case '24month':
    case 'twomonthly':
    case '2monthly':
    case 'twoyearly':
      return '24 months';
    case '36months':
    case '36month':
    case 'threemonthly':
    case '3monthly':
    case 'threeyearly':
      return '36 months';
    case '48months':
    case '48month':
    case 'fourmonthly':
    case '4monthly':
      return '48 months';
    case '60months':
    case '60month':
    case 'fivemonthly':
    case '5monthly':
      return '60 months';
    default:
      return paymentType || 'Unknown';
  }
}

/**
 * Calculate policy end date based on start date and payment type
 */
export function calculatePolicyEndDate(startDate: Date, paymentType: string): Date {
  const months = getWarrantyDurationInMonths(paymentType);
  const endDate = new Date(startDate);
  endDate.setMonth(endDate.getMonth() + months);
  return endDate;
}

/**
 * Get warranty duration for Warranties 2000 API (string format)
 */
export function getWarrantyDurationForAPI(paymentType: string): string {
  return getWarrantyDurationInMonths(paymentType).toString();
}

/**
 * Get comprehensive payment duration information
 */
export function getPaymentDurationInfo(paymentType: string): PaymentDuration {
  const months = getWarrantyDurationInMonths(paymentType);
  const displayText = getWarrantyDurationDisplay(paymentType);
  const paymentFrequency = getPaymentTypeDisplay(paymentType);
  
  return {
    months,
    displayText,
    paymentFrequency
  };
}

/**
 * Format duration for email templates
 */
export function formatDurationForEmail(paymentType: string): string {
  const months = getWarrantyDurationInMonths(paymentType);
  return `${months} month${months === 1 ? '' : 's'}`;
}