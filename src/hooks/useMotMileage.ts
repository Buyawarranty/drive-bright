import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface MotTest {
  odometerValue?: number;
  odometerUnit?: string;
  completedDate?: string;
  testResult?: string;
}

interface UseMotMileageResult {
  motMileage: number | null;
  motDate: string | null;
  isLoading: boolean;
  error: string | null;
}

export const useMotMileage = (registrationNumber: string | undefined): UseMotMileageResult => {
  const [motMileage, setMotMileage] = useState<number | null>(null);
  const [motDate, setMotDate] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchMotMileage = async () => {
      if (!registrationNumber) {
        setMotMileage(null);
        setMotDate(null);
        return;
      }

      // Normalize the registration (remove spaces, uppercase)
      const normalizedReg = registrationNumber.replace(/\s+/g, '').toUpperCase();
      
      setIsLoading(true);
      setError(null);

      try {
        // Query the mot_history table for this registration
        const { data, error: fetchError } = await supabase
          .from('mot_history')
          .select('mot_tests')
          .or(`registration.eq.${normalizedReg},registration.ilike.%${normalizedReg}%`)
          .limit(1)
          .maybeSingle();

        if (fetchError) {
          console.error('Error fetching MOT mileage:', fetchError);
          setError('Failed to fetch MOT data');
          setMotMileage(null);
          setMotDate(null);
          return;
        }

        if (!data || !data.mot_tests) {
          console.log('No MOT history found for:', normalizedReg);
          setMotMileage(null);
          setMotDate(null);
          return;
        }

        // Parse mot_tests - it's stored as a JSON array
        // Cast to unknown first to safely type-check
        const rawMotTests = data.mot_tests as unknown;
        const motTests: MotTest[] = Array.isArray(rawMotTests) 
          ? (rawMotTests as MotTest[])
          : [];

        if (motTests.length === 0) {
          setMotMileage(null);
          setMotDate(null);
          return;
        }

        // Sort by completedDate descending to get the most recent test
        const sortedTests = [...motTests].sort((a, b) => {
          const dateA = a.completedDate ? new Date(a.completedDate).getTime() : 0;
          const dateB = b.completedDate ? new Date(b.completedDate).getTime() : 0;
          return dateB - dateA;
        });

        // Find the first test with a valid odometer reading
        const testWithMileage = sortedTests.find(
          test => test.odometerValue && test.odometerValue > 0
        );

        if (testWithMileage && testWithMileage.odometerValue) {
          console.log('✅ Found MOT mileage:', testWithMileage.odometerValue, 'from', testWithMileage.completedDate);
          setMotMileage(testWithMileage.odometerValue);
          setMotDate(testWithMileage.completedDate || null);
        } else {
          setMotMileage(null);
          setMotDate(null);
        }
      } catch (err) {
        console.error('Error in useMotMileage:', err);
        setError('Unexpected error fetching MOT data');
        setMotMileage(null);
        setMotDate(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchMotMileage();
  }, [registrationNumber]);

  return { motMileage, motDate, isLoading, error };
};
