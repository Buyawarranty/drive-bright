import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const GATEWAY_RECEIPT_KEY = 'loginGatewayReceipt';

export async function gatewayRequest(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('login-gateway', { body });
  if (error || data?.error) throw new Error(data?.error || 'Unable to check gateway access. Please try again.');
  return data;
}

export function useGatewayUnlock() {
  const [isUnlocked, setIsUnlocked] = useState(false);
  useEffect(() => {
    let alive = true;
    const validate = async () => {
      const token = sessionStorage.getItem(GATEWAY_RECEIPT_KEY);
      if (!token) { if (alive) setIsUnlocked(false); return; }
      try {
        const data = await gatewayRequest({ action: 'validate', token });
        if (!data.valid) sessionStorage.removeItem(GATEWAY_RECEIPT_KEY);
        if (alive) setIsUnlocked(data.valid === true);
      } catch { if (alive) setIsUnlocked(false); }
    };
    void validate();
    const timer = window.setInterval(validate, 60000);
    window.addEventListener('focus', validate);
    return () => { alive = false; window.clearInterval(timer); window.removeEventListener('focus', validate); };
  }, []);
  return { isUnlocked, setIsUnlocked };
}