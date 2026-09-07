/**
 * Shared "how do you want to pay" preference between step 3 and step 4.
 *
 * Step 3's sticky footer lets the customer pick Pay in Full or Pay Monthly.
 * That choice used to be local to step 3, so step 4 always opened on monthly
 * and customers who wanted to pay in full could not see their option.
 */

export type PaymentPreference = 'monthly' | 'full';

const KEY = 'baw_checkout_payment_preference';

export const getPaymentPreference = (): PaymentPreference | null => {
  try {
    const raw = sessionStorage.getItem(KEY) || localStorage.getItem(KEY);
    return raw === 'full' || raw === 'monthly' ? raw : null;
  } catch {
    return null;
  }
};

export const setPaymentPreference = (pref: PaymentPreference) => {
  try {
    sessionStorage.setItem(KEY, pref);
    localStorage.setItem(KEY, pref);
  } catch {
    // storage unavailable — preference simply won't persist
  }
};
