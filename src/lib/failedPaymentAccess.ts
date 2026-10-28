export const isFailedPaymentAdmin = (role?: string | null) => role === 'admin' || role === 'super_admin';
export const canOpenFailedPaymentPanel = (role?: string | null) =>
  isFailedPaymentAdmin(role) || role === 'sales' || role === 'sales_lead';
export const canSeeFailedPaymentAlert = (role: string | null | undefined, verifiedOwner: boolean) =>
  isFailedPaymentAdmin(role) || ((role === 'sales' || role === 'sales_lead') && verifiedOwner);