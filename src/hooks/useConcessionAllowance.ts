import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

function getLondonYearMonth(): string {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(now);
  const year = parts.find((p) => p.type === 'year')?.value;
  const month = parts.find((p) => p.type === 'month')?.value;
  return `${year}-${month}`;
}

export interface ConcessionAllowanceState {
  adminUserId: string | null;
  yearMonth: string;
  allow3mo: number;
  allow6mo: number;
  allow1mo: number;
  used3mo: number;
  used6mo: number;
  used1mo: number;
  remaining3mo: number;
  remaining6mo: number;
  remaining1mo: number;
  canUse3mo: boolean;
  canUse6mo: boolean;
  canUse1mo: boolean;
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

const DEFAULT_ALLOW_3MO = 10;
const DEFAULT_ALLOW_6MO = 3;
const DEFAULT_ALLOW_1MO = 20;

export function useConcessionAllowance(adminUserId: string | null): ConcessionAllowanceState {
  const yearMonth = getLondonYearMonth();
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ['concession-allowance', adminUserId, yearMonth],
    queryFn: async () => {
      if (!adminUserId) {
        return {
          allow3mo: DEFAULT_ALLOW_3MO,
          allow6mo: DEFAULT_ALLOW_6MO,
          allow1mo: DEFAULT_ALLOW_1MO,
          used3mo: 0,
          used6mo: 0,
          used1mo: 0,
        };
      }

      const [{ data: allowance, error: allowanceError }, { data: usage, error: usageError }] =
        await Promise.all([
          supabase
            .from('concession_allowances')
            .select('*')
            .eq('admin_user_id', adminUserId)
            .eq('year_month', yearMonth)
            .maybeSingle(),
          supabase.rpc('get_concession_usage', {
            p_admin_user_id: adminUserId,
            p_year_month: yearMonth,
          }),
        ]);

      if (allowanceError) throw allowanceError;
      if (usageError) throw usageError;

      const used = (usage?.[0] ?? { used_3mo: 0, used_6mo: 0, used_1mo: 0 }) as any;
      const allow3mo = allowance?.allow_3mo ?? DEFAULT_ALLOW_3MO;
      const allow6mo = allowance?.allow_6mo ?? DEFAULT_ALLOW_6MO;
      const allow1mo = (allowance as any)?.allow_1mo ?? DEFAULT_ALLOW_1MO;

      return {
        allow3mo,
        allow6mo,
        allow1mo,
        used3mo: Number(used.used_3mo || 0),
        used6mo: Number(used.used_6mo || 0),
        used1mo: Number(used.used_1mo || 0),
      };
    },
    enabled: !!adminUserId,
    staleTime: 20 * 1000,
  });

  const remaining3mo = Math.max(0, (data?.allow3mo ?? DEFAULT_ALLOW_3MO) - (data?.used3mo ?? 0));
  const remaining6mo = Math.max(0, (data?.allow6mo ?? DEFAULT_ALLOW_6MO) - (data?.used6mo ?? 0));
  const remaining1mo = Math.max(0, (data?.allow1mo ?? DEFAULT_ALLOW_1MO) - (data?.used1mo ?? 0));

  return {
    adminUserId,
    yearMonth,
    allow3mo: data?.allow3mo ?? DEFAULT_ALLOW_3MO,
    allow6mo: data?.allow6mo ?? DEFAULT_ALLOW_6MO,
    allow1mo: data?.allow1mo ?? DEFAULT_ALLOW_1MO,
    used3mo: data?.used3mo ?? 0,
    used6mo: data?.used6mo ?? 0,
    used1mo: data?.used1mo ?? 0,
    remaining3mo,
    remaining6mo,
    remaining1mo,
    canUse3mo: remaining3mo > 0,
    canUse6mo: remaining6mo > 0,
    canUse1mo: remaining1mo > 0,
    loading: isLoading || !adminUserId,
    error: error as Error | null,
    refresh: async () => {
      await queryClient.invalidateQueries({ queryKey: ['concession-allowance', adminUserId, yearMonth] });
    },
  };
}
