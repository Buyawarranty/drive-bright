/** Apply after server authentication; grants never override sales privacy. */
export function canReadCompanySalesValues(role: string | null | undefined): boolean {
  return Boolean(role) && role !== 'sales' && role !== 'sales_lead';
}