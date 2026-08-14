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
    let cancelled = false;

    const normalizedReg = (registrationNumber || '').replace(/\s+/g, '').toUpperCase();

    // Reg is empty or still being typed — clear state and never leave a spinner up.
    if (normalizedReg.length < 5) {
      setMotMileage(null);
      setMotDate(null);
      setError(null);
      setIsLoading(false);
      return;
    }

    const spacedReg = `${normalizedReg.slice(0, -3)} ${normalizedReg.slice(-3)}`;

    setIsLoading(true);
    setError(null);

    // Hard ceiling: an agent on the phone must never wait on this.
    const failSafe = setTimeout(() => {
      if (!cancelled) setIsLoading(false);
    }, 8000);

    const timer = setTimeout(async () => {
      try {
        // PERF: indexed equality (unique index on registration), never ilike.
        // The same plate can be stored with and without a space, so never use
        // maybeSingle() here — two rows would throw instead of returning data.
        const { data: rows, error: fetchError } = await supabase
          .from('mot_history')
          .select('mot_tests')
          .in('registration', [normalizedReg, spacedReg])
          .limit(2);

        if (cancelled) return;

        if (fetchError) {
          console.error('Error fetching MOT mileage:', fetchError);
          setError('Failed to fetch MOT data');
          setMotMileage(null);
          setMotDate(null);
          return;
        }

        const data = rows?.find((r) => Array.isArray(r.mot_tests) && (r.mot_tests as any[]).length > 0) ?? rows?.[0] ?? null;

        const rawMotTests = data?.mot_tests as unknown;
        const motTests: MotTest[] = Array.isArray(rawMotTests) ? (rawMotTests as MotTest[]) : [];

        if (motTests.length === 0) {
          setMotMileage(null);
          setMotDate(null);
          return;
        }

        const testWithMileage = [...motTests]
          .sort((a, b) => {
            const dateA = a.completedDate ? new Date(a.completedDate).getTime() : 0;
            const dateB = b.completedDate ? new Date(b.completedDate).getTime() : 0;
            return dateB - dateA;
          })
          .find((test) => test.odometerValue && test.odometerValue > 0);

        if (testWithMileage?.odometerValue) {
          setMotMileage(testWithMileage.odometerValue);
          setMotDate(testWithMileage.completedDate || null);
        } else {
          setMotMileage(null);
          setMotDate(null);
        }
      } catch (err) {
        if (cancelled) return;
        console.error('Error in useMotMileage:', err);
        setError('Unexpected error fetching MOT data');
        setMotMileage(null);
        setMotDate(null);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }, 300); // debounce typing so each keystroke doesn't fire a query

    return () => {
      cancelled = true;
      clearTimeout(timer);
      clearTimeout(failSafe);
    };
  }, [registrationNumber]);


  return { motMileage, motDate, isLoading, error };
};
