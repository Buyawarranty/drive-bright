import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface ClaimStaff {
  id: string;
  name: string;
  email: string;
  initials: string;
}

const toInitials = (name: string) =>
  name.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('') || '??';

/**
 * Active admin users that can be assigned to a claim.
 * Lightweight — fetched once on mount.
 */
export const useClaimsStaff = () => {
  const [staff, setStaff] = useState<ClaimStaff[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('admin_users')
        .select('user_id, first_name, last_name, email, role, is_active')
        .eq('is_active', true);
      if (cancelled) return;
      const list: ClaimStaff[] = (data || [])
        .filter((r: any) => !!r.user_id)
        .map((r: any) => {
          const name =
            [r.first_name, r.last_name].filter(Boolean).join(' ').trim() || r.email || 'Staff';
          return { id: r.user_id, name, email: r.email || '', initials: toInitials(name) };
        })
        .sort((a, b) => a.name.localeCompare(b.name));
      setStaff(list);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { staff, loading };
};
