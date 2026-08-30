import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface ManagerDiscountGrant {
  id: string;
  email: string;
  enabled: boolean;
  note: string | null;
  created_at: string;
}

/**
 * Access to the restricted "Manager access" discount codes.
 * Managers always have it; extra people can be switched on/off by email
 * in public.manager_discount_access (checked server-side too).
 */
export function useManagerDiscountAccess(canManage: boolean) {
  const [hasAccess, setHasAccess] = useState(false);
  const [grants, setGrants] = useState<ManagerDiscountGrant[]>([]);
  const [loading, setLoading] = useState(true);

  const loadAccess = useCallback(async () => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const uid = sessionData?.session?.user?.id;
      if (!uid) {
        setHasAccess(false);
        return;
      }
      const { data } = await supabase.rpc('has_manager_discount_access' as any, { _user_id: uid });
      setHasAccess(data === true);
    } catch {
      setHasAccess(false);
    }
  }, []);

  const loadGrants = useCallback(async () => {
    const { data } = await supabase
      .from('manager_discount_access' as any)
      .select('id, email, enabled, note, created_at')
      .order('email');
    setGrants(((data as any) || []) as ManagerDiscountGrant[]);
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await loadAccess();
      await loadGrants();
      setLoading(false);
    })();
  }, [loadAccess, loadGrants]);

  const addGrant = useCallback(async (email: string, note?: string) => {
    const clean = email.trim().toLowerCase();
    if (!clean) return { error: 'Enter an email address' };
    const { error } = await supabase
      .from('manager_discount_access' as any)
      .insert({ email: clean, enabled: true, note: note || null } as any);
    if (error) return { error: error.message };
    await loadGrants();
    await loadAccess();
    return {};
  }, [loadGrants, loadAccess]);

  const setGrantEnabled = useCallback(async (id: string, enabled: boolean) => {
    const { error } = await supabase
      .from('manager_discount_access' as any)
      .update({ enabled, updated_at: new Date().toISOString() } as any)
      .eq('id', id);
    if (error) return { error: error.message };
    await loadGrants();
    await loadAccess();
    return {};
  }, [loadGrants, loadAccess]);

  const removeGrant = useCallback(async (id: string) => {
    const { error } = await supabase.from('manager_discount_access' as any).delete().eq('id', id);
    if (error) return { error: error.message };
    await loadGrants();
    await loadAccess();
    return {};
  }, [loadGrants, loadAccess]);

  return { hasAccess, grants, loading, canManage, addGrant, setGrantEnabled, removeGrant, refresh: loadGrants };
}
