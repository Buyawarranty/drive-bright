interface DailyRevenueCustomer {
  purchase_source?: string | null;
  is_manual_entry?: boolean | null;
  warranty_reference_number?: string | null;
}

const AGENT_SOURCES = ['quote_link', 'external', 'admin_external', 'manual', 'admin', 'phone'];

export function isDirectWebsiteRevenue(customer: DailyRevenueCustomer): boolean {
  if (customer.is_manual_entry === true || customer.warranty_reference_number?.startsWith('BAW-S-')) return false;
  return !AGENT_SOURCES.includes((customer.purchase_source || '').trim().toLowerCase());
}

export function dailyRevenueSeller<T extends DailyRevenueCustomer>(customer: T, resolveCredit: (customer: T) => string | null): string {
  return isDirectWebsiteRevenue(customer) ? 'website' : resolveCredit(customer) || 'website';
}