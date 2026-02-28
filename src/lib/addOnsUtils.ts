// Utility functions for add-ons pricing and auto-inclusion logic

export interface AddOnInfo {
  key: string;
  name: string;
  monthlyPrice: number;
  oneTimePrice?: number;
  description: string;
  isAutoIncluded: boolean;
  displayPrice: string;
  tooltipDetails?: string[];
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
      return ['breakdown']; // 2-Year: Vehicle recovery only
    case '36months':
      return ['breakdown', 'rental']; // 3-Year: Vehicle recovery + Rental only
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
      monthlyPrice: 4,
      description: 'Roadside assistance and recovery service',
      isAutoIncluded: autoIncluded.includes('breakdown'),
      displayPrice: autoIncluded.includes('breakdown') ? 'FREE' : `£${(4 * durationMonths)}`
    },
    {
      key: 'rental',
      name: 'Hire Car',
      monthlyPrice: 7,
      description: 'Courtesy car while yours is being repaired',
      isAutoIncluded: autoIncluded.includes('rental'),
      displayPrice: autoIncluded.includes('rental') ? 'FREE' : `£${(7 * durationMonths)}`
    },
    {
      key: 'tyre',
      name: 'Tyre Cover',
      monthlyPrice: 7,
      description: 'Protection for tyre damage and punctures',
      isAutoIncluded: autoIncluded.includes('tyre'),
      displayPrice: autoIncluded.includes('tyre') ? 'FREE' : `£${(7 * durationMonths)}`,
      tooltipDetails: ['Up to £150 per tyre replacement', 'Covers accidental damage and vandalism', 'Includes puncture repairs', 'Up to 4 replacements per year']
    },
    {
      key: 'wearAndTear',
      name: 'Wear & Tear',
      monthlyPrice: 20,
      description: 'Coverage for general wear and tear items',
      isAutoIncluded: autoIncluded.includes('wearAndTear'),
      displayPrice: autoIncluded.includes('wearAndTear') ? 'FREE' : `£${(20 * durationMonths)}`
    },
    {
      key: 'european',
      name: 'European Cover',
      monthlyPrice: 5,
      description: 'Coverage while driving in Europe',
      isAutoIncluded: autoIncluded.includes('european'),
      displayPrice: autoIncluded.includes('european') ? 'FREE' : `£${(5 * durationMonths)}`
    },
    {
      key: 'motRepair',
      name: 'MOT Repair',
      monthlyPrice: 4,
      description: 'Cover for MOT failure repairs',
      isAutoIncluded: autoIncluded.includes('motRepair'),
      displayPrice: autoIncluded.includes('motRepair') ? 'FREE' : `£${(4 * durationMonths)}`
    },
    {
      key: 'lostKey',
      name: 'Lost Key Cover',
      monthlyPrice: 3,
      description: 'Replacement key and locksmith costs',
      isAutoIncluded: autoIncluded.includes('lostKey'),
      displayPrice: autoIncluded.includes('lostKey') ? 'FREE' : `£${(3 * durationMonths)}`
    },
    {
      key: 'consequential',
      name: 'Consequential Loss',
      monthlyPrice: 5,
      description: 'Additional costs due to breakdown',
      isAutoIncluded: autoIncluded.includes('consequential'),
      displayPrice: autoIncluded.includes('consequential') ? 'FREE' : `£${(5 * durationMonths)}`
    },
    {
      key: 'transfer',
      name: 'Transfer Cover',
      monthlyPrice: 0,
      oneTimePrice: 19,
      description: 'Transfer warranty to new owner',
      isAutoIncluded: autoIncluded.includes('transfer'),
      displayPrice: autoIncluded.includes('transfer') ? 'FREE' : '£19'
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
  if (selectedAddOns.breakdown && !autoIncluded.includes('breakdown')) total += 4 * durationMonths;
  if (selectedAddOns.rental && !autoIncluded.includes('rental')) total += 7 * durationMonths;
  if (selectedAddOns.tyre && !autoIncluded.includes('tyre')) total += 7 * durationMonths;
  if (selectedAddOns.wearAndTear && !autoIncluded.includes('wearAndTear')) total += 20 * durationMonths;
  if (selectedAddOns.european && !autoIncluded.includes('european')) total += 5 * durationMonths;
  if (selectedAddOns.motRepair && !autoIncluded.includes('motRepair')) total += 4 * durationMonths;
  if (selectedAddOns.motFee && !autoIncluded.includes('motFee')) total += 1 * durationMonths;
  if (selectedAddOns.lostKey && !autoIncluded.includes('lostKey')) total += 3 * durationMonths;
  if (selectedAddOns.consequential && !autoIncluded.includes('consequential')) total += 5 * durationMonths;
  
  // One-time add-ons
  if (selectedAddOns.transfer && !autoIncluded.includes('transfer')) total += 19;
  
  return Math.floor(total); // Round down to whole number
};