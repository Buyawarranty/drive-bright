import { useState, useEffect } from 'react';

interface ImpersonationData {
  customerId: string;
  customerEmail: string;
  customerName: string;
}

export const useImpersonation = () => {
  const [isImpersonating, setIsImpersonating] = useState(false);
  const [impersonatedCustomer, setImpersonatedCustomer] = useState<ImpersonationData | null>(null);

  useEffect(() => {
    // Check for impersonation data in sessionStorage
    const impersonationData = sessionStorage.getItem('admin_impersonation');
    if (impersonationData) {
      try {
        const data = JSON.parse(impersonationData) as ImpersonationData;
        setIsImpersonating(true);
        setImpersonatedCustomer(data);
      } catch (error) {
        console.error('Error parsing impersonation data:', error);
        sessionStorage.removeItem('admin_impersonation');
      }
    }
  }, []);

  const startImpersonation = (customerId: string, customerEmail: string, customerName: string) => {
    const data: ImpersonationData = {
      customerId,
      customerEmail,
      customerName,
    };
    sessionStorage.setItem('admin_impersonation', JSON.stringify(data));
    setIsImpersonating(true);
    setImpersonatedCustomer(data);
  };

  const stopImpersonation = () => {
    sessionStorage.removeItem('admin_impersonation');
    setIsImpersonating(false);
    setImpersonatedCustomer(null);
  };

  return {
    isImpersonating,
    impersonatedCustomer,
    startImpersonation,
    stopImpersonation,
  };
};
