import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function useOwnAttendanceBar(adminId: string | null) {
  const { data } = useQuery({
    queryKey: ['own-attendance-bar', adminId],
    enabled: !!adminId,
    queryFn: async () => {
      if (!adminId) return false;
      const { data, error } = await supabase.from('lead_team_members')
        .select('show_own_attendance_bar').eq('admin_user_id', adminId).maybeSingle();
      return !error && data?.show_own_attendance_bar === true;
    },
    staleTime: 15000,
    refetchInterval: 30000,
    retry: false,
  });
  return data === true;
}