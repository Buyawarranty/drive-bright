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

interface PlanData {
  name?: string;
  price?: number;
  paymentType?: string;
  claimLimit?: number;
  labourRate?: number;
  voluntaryExcess?: number;
  boostAddon?: boolean;
  addOns?: string[];
}

interface RestoreResult {
  vehicleData: VehicleData;
  planData: PlanData | null;
}

export const useQuoteRestoration = () => {
  const restoreQuoteData = useCallback(async (quoteId: string, email: string): Promise<VehicleData | null> => {
    try {
      console.log('🔍 Attempting quote restoration:', { quoteId, email });
      
      const { data: rows, error } = await supabase
        .rpc('restore_quote_data', { _quote_id: quoteId, _email: email });
      const data = rows && rows.length > 0 ? rows[0] : null;

      if (error || !data) {
        console.error('Quote restoration failed:', error);
        return null;
      }

      console.log('✅ Quote data found:', data);
      
      const vehicleDataJson = data.vehicle_data as any;
      const planDataJson = data.plan_data as any;
      
      // If we have plan data, save it to localStorage for PricingTable to pick up
      if (planDataJson) {
        console.log('💾 Saving plan data to localStorage:', planDataJson);
        // CRITICAL: claim limit MUST be a valid matrix value (750/1250/2000/3000/5000).
        // Previously defaulted to 2500 which is NOT in the matrix → PricingTable
        // silently fell back to its own default and customers saw a different price
        // in Step 4 than in Step 3. Default to 1250 (matrix DEFAULT_CLAIM_LIMIT).
        const VALID_CLAIM_LIMITS = [750, 1250, 2000, 3000, 5000];
        const restoredClaimLimit = Number(planDataJson.claimLimit);
        const safeClaimLimit = VALID_CLAIM_LIMITS.includes(restoredClaimLimit) ? restoredClaimLimit : 1250;
        const planSettings = {
          paymentType: planDataJson.paymentType || '12months',
          claimLimit: safeClaimLimit,
          labourRate: planDataJson.labourRate || 70,
          voluntaryExcess: planDataJson.voluntaryExcess ?? 100,
          boostAddon: planDataJson.boostAddon || false,
          addOns: planDataJson.addOns || []
        };
        if (restoredClaimLimit && !VALID_CLAIM_LIMITS.includes(restoredClaimLimit)) {
          console.warn('⚠️ Quote restoration: invalid claimLimit', restoredClaimLimit, '→ falling back to', safeClaimLimit);
        }
        localStorage.setItem('buyawarranty_quotePlanSettings', JSON.stringify(planSettings));
      }
      
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

  // New method to get full restoration data including plan
  const restoreQuoteDataFull = useCallback(async (quoteId: string, email: string): Promise<RestoreResult | null> => {
    try {
      console.log('🔍 Attempting full quote restoration:', { quoteId, email });
      
      const { data: rows, error } = await supabase
        .rpc('restore_quote_data', { _quote_id: quoteId, _email: email });
      const data = rows && rows.length > 0 ? rows[0] : null;

      if (error || !data) {
        console.error('Full quote restoration failed:', error);
        return null;
      }

      console.log('✅ Full quote data found:', data);
      
      const vehicleDataJson = data.vehicle_data as any;
      const planDataJson = data.plan_data as any;
      
      return {
        vehicleData: {
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
        },
        planData: planDataJson || null
      };
    } catch (error) {
      console.error('Error restoring full quote:', error);
      return null;
    }
  }, []);

  return { restoreQuoteData, restoreQuoteDataFull };
};
