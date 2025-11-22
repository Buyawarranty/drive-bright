import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface VehicleData {
  regNumber: string;
  mileage: string;
  email: string;
  phone: string;
  firstName: string;
  lastName: string;
  address: string;
  make?: string;
  model?: string;
  year?: string;
  vehicleType?: string;
  fuelType?: string;
  transmission?: string;
}

export const useQuoteRestoration = () => {
  const restoreQuoteData = useCallback(async (quoteId: string, email: string): Promise<VehicleData | null> => {
    try {
      const { data, error } = await supabase
        .from('quote_data')
        .select('*')
        .eq('quote_id', quoteId)
        .eq('customer_email', email)
        .maybeSingle();

      if (error || !data) {
        console.error('Quote restoration failed:', error);
        return null;
      }

      const vehicleDataJson = data.vehicle_data as any;
      return {
        regNumber: vehicleDataJson.regNumber || '',
        mileage: vehicleDataJson.mileage || '',
        email,
        phone: '',
        firstName: '',
        lastName: '',
        address: '',
        make: vehicleDataJson.make || '',
        model: vehicleDataJson.model || '',
        year: vehicleDataJson.year || '',
        vehicleType: vehicleDataJson.vehicleType || 'car',
        fuelType: vehicleDataJson.fuelType || '',
        transmission: vehicleDataJson.transmission || ''
      };
    } catch (error) {
      console.error('Error restoring quote:', error);
      return null;
    }
  }, []);

  return { restoreQuoteData };
};