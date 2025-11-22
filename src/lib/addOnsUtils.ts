// Utility functions for add-ons pricing and auto-inclusion logic

export interface AddOnInfo {
  key: string;
  name: string;
  monthlyPrice: number;
  oneTimePrice?: number;
  description: string;
  isAutoIncluded: boolean;
  displayPrice: string;
}

// Normalize payment type to consistent format
export const normalizePaymentType = (paymentType: string | null | undefined): string => {
  if (!paymentType) {
    console.warn('normalizePaymentType received null/undefined paymentType, defaulting to "monthly"');
    return '12months';
  }
  
  const normalized = paymentType.toLowerCase().replace(/[^a-z0-9]/g, '');
  
  // Map various formats to consistent ones
  const mapping: { [key: string]: string } = {
    '12months': '12months',
    'monthly': '12months',
    '1year': '12months',
    'yearly': '12months',
    
    '24months': '24months',
    '2year': '24months',
    'twoyearly': '24months',
    'two_yearly': '24months',
    
    '36months': '36months',
    '3year': '36months',
    'threeyearly': '36months',
    'three_yearly': '36months'
  };
  
  return mapping[normalized] || '12months';
};

// Get auto-included add-ons based on payment type
export const getAutoIncludedAddOns = (paymentType: string): string[] => {
  const normalizedType = normalizePaymentType(paymentType);
  
  switch (normalizedType) {
    case '24months':
      return ['breakdown', 'motFee']; // 2-Year: Vehicle recovery, MOT test fee
    case '36months':
      return ['breakdown', 'motFee', 'rental']; // 3-Year: All above + Rental
    default:
      return []; // 12-month plans have no auto-included add-ons
  }
};

// Check if an add-on is auto-included for a specific payment type
export const isAddOnAutoIncluded = (addOnKey: string, paymentType: string): boolean => {
  return getAutoIncludedAddOns(paymentType).includes(addOnKey);
};

// Get add-on pricing information with auto-inclusion status
export const getAddOnInfo = (paymentType: string, durationMonths: number = 12): AddOnInfo[] => {
  const autoIncluded = getAutoIncludedAddOns(paymentType);
  
  const addOns: AddOnInfo[] = [
    {
      key: 'breakdown',
      name: 'Vehicle Recovery',
      monthlyPrice: 3.99,
      description: 'Roadside assistance and recovery service',
      isAutoIncluded: autoIncluded.includes('breakdown'),
      displayPrice: autoIncluded.includes('breakdown') ? 'FREE' : `£${(3.99 * durationMonths).toFixed(2)}`
    },
    {
      key: 'rental',
      name: 'Hire Car',
      monthlyPrice: 6.99,
      description: 'Courtesy car while yours is being repaired',
      isAutoIncluded: autoIncluded.includes('rental'),
      displayPrice: autoIncluded.includes('rental') ? 'FREE' : `£${(6.99 * durationMonths).toFixed(2)}`
    },
    {
      key: 'tyre',
      name: 'Tyre Cover',
      monthlyPrice: 7.99,
      description: 'Protection for tyre damage and punctures',
      isAutoIncluded: autoIncluded.includes('tyre'),
      displayPrice: autoIncluded.includes('tyre') ? 'FREE' : `£${(7.99 * durationMonths).toFixed(2)}`
    },
    {
      key: 'wearAndTear',
      name: 'Wear & Tear',
      monthlyPrice: 9.99,
      description: 'Coverage for general wear and tear items',
      isAutoIncluded: autoIncluded.includes('wearAndTear'),
      displayPrice: autoIncluded.includes('wearAndTear') ? 'FREE' : `£${(9.99 * durationMonths).toFixed(2)}`
    },
    {
      key: 'european',
      name: 'European Cover',
      monthlyPrice: 5.99,
      description: 'Coverage while driving in Europe',
      isAutoIncluded: autoIncluded.includes('european'),
      displayPrice: autoIncluded.includes('european') ? 'FREE' : `£${(5.99 * durationMonths).toFixed(2)}`
    },
    {
      key: 'motRepair',
      name: 'MOT Repair',
      monthlyPrice: 4.00,
      description: 'Cover for MOT failure repairs',
      isAutoIncluded: autoIncluded.includes('motRepair'),
      displayPrice: autoIncluded.includes('motRepair') ? 'FREE' : `£${(4.00 * durationMonths).toFixed(2)}`
    },
    {
      key: 'motFee',
      name: 'MOT Test Fee',
      monthlyPrice: 1.99,
      description: 'Reimbursement of the MOT test fee up to £75',
      isAutoIncluded: autoIncluded.includes('motFee'),
      displayPrice: autoIncluded.includes('motFee') ? 'FREE' : `£${(1.99 * durationMonths).toFixed(2)}`
    },
    {
      key: 'lostKey',
      name: 'Lost Key Cover',
      monthlyPrice: 3.00,
      description: 'Replacement key and locksmith costs',
      isAutoIncluded: autoIncluded.includes('lostKey'),
      displayPrice: autoIncluded.includes('lostKey') ? 'FREE' : `£${(3.00 * durationMonths).toFixed(2)}`
    },
    {
      key: 'consequential',
      name: 'Consequential Loss',
      monthlyPrice: 5.00,
      description: 'Additional costs due to breakdown',
      isAutoIncluded: autoIncluded.includes('consequential'),
      displayPrice: autoIncluded.includes('consequential') ? 'FREE' : `£${(5.00 * durationMonths).toFixed(2)}`
    },
    {
      key: 'transfer',
      name: 'Transfer Cover',
      monthlyPrice: 0,
      oneTimePrice: 19.99,
      description: 'Transfer warranty to new owner',
      isAutoIncluded: autoIncluded.includes('transfer'),
      displayPrice: autoIncluded.includes('transfer') ? 'FREE' : '£19.99'
    }
  ];
  
  return addOns;
};

// Calculate total add-on price (excluding auto-included ones)
export const calculateAddOnPrice = (
  selectedAddOns: { [key: string]: boolean }, 
  paymentType: string, 
  durationMonths: number = 12
): number => {
  const autoIncluded = getAutoIncludedAddOns(paymentType);
  let total = 0;
  
  // Monthly recurring add-ons
  if (selectedAddOns.breakdown && !autoIncluded.includes('breakdown')) total += 3.99 * durationMonths;
  if (selectedAddOns.rental && !autoIncluded.includes('rental')) total += 6.99 * durationMonths;
  if (selectedAddOns.tyre && !autoIncluded.includes('tyre')) total += 7.99 * durationMonths;
  if (selectedAddOns.wearAndTear && !autoIncluded.includes('wearAndTear')) total += 9.99 * durationMonths;
  if (selectedAddOns.european && !autoIncluded.includes('european')) total += 5.99 * durationMonths;
  if (selectedAddOns.motRepair && !autoIncluded.includes('motRepair')) total += 4.00 * durationMonths;
  if (selectedAddOns.motFee && !autoIncluded.includes('motFee')) total += 1.99 * durationMonths;
  if (selectedAddOns.lostKey && !autoIncluded.includes('lostKey')) total += 3.00 * durationMonths;
  if (selectedAddOns.consequential && !autoIncluded.includes('consequential')) total += 5.00 * durationMonths;
  
  // One-time add-ons
  if (selectedAddOns.transfer && !autoIncluded.includes('transfer')) total += 19.99;
  
  return Math.round(total * 100) / 100; // Round to 2 decimal places
};