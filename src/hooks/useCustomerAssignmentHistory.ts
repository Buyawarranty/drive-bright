import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface AssignmentHistoryEntry {
  id: string;
  leadId: string;
  assignedToId: string | null;
  previousAssignedToId: string | null;
  assignedToName: string;
  previousAssignedToName: string | null;
  assignmentType: string | null;
  reason: string | null;
  assignedBy: string | null;
  wasWorked: boolean | null;
  at: string;
}

const tail9 = (phone?: string | null) => (phone || '').replace(/\D/g, '').slice(-9);

/**
 * Full record of who was given the lead behind a customer, and exactly when.
 * Read-only history used to reconcile commission when ownership changed hands.
 */
export function useCustomerAssignmentHistory(email?: string | null, phone?: string | null) {
  const [entries, setEntries] = useState<AssignmentHistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    const cleanEmail = (email || '').trim().toLowerCase();
    const t9 = tail9(phone);
    if (!cleanEmail && !t9) {
      setEntries([]);
      return;
    }
    setLoading(true);
    try {
      const leadIds = new Set<string>();

      if (cleanEmail) {
        const { data } = await supabase
          .from('sales_leads')
          .select('id')
          .ilike('email', cleanEmail)
          .limit(50);
        (data || []).forEach(r => leadIds.add(r.id as string));
      }
      if (t9) {
        const { data } = await supabase
          .from('sales_leads')
          .select('id, phone')
          .ilike('phone', `%${t9}%`)
          .limit(50);
        (data || []).forEach(r => {
          if (tail9(r.phone as string) === t9) leadIds.add(r.id as string);
        });
      }

      if (leadIds.size === 0) {
        setEntries([]);
        return;
      }

      const [auditRes, agentsRes] = await Promise.all([
        supabase
          .from('lead_assignment_audit')
          .select('id, lead_id, assigned_to_id, previous_assigned_to_id, assignment_type, reason, assigned_by, was_worked, created_at')
          .in('lead_id', Array.from(leadIds))
          .order('created_at', { ascending: true })
          .limit(300),
        supabase.from('admin_users').select('id, first_name, last_name, email').limit(500),
      ]);

      const nameOf = (id?: string | null) => {
        if (!id) return null;
        const a = (agentsRes.data || []).find(u => u.id === id);
        if (!a) return 'Unknown agent';
        return [a.first_name, a.last_name].filter(Boolean).join(' ') || a.email || 'Unknown agent';
      };

      setEntries(
        (auditRes.data || []).map(r => ({
          id: r.id as string,
          leadId: r.lead_id as string,
          assignedToId: (r.assigned_to_id as string) || null,
          previousAssignedToId: (r.previous_assigned_to_id as string) || null,
          assignedToName: nameOf(r.assigned_to_id as string) || 'Unassigned',
          previousAssignedToName: nameOf(r.previous_assigned_to_id as string),
          assignmentType: (r.assignment_type as string) || null,
          reason: (r.reason as string) || null,
          assignedBy: (r.assigned_by as string) || null,
          wasWorked: (r.was_worked as boolean) ?? null,
          at: r.created_at as string,
        })),
      );
    } catch (err) {
      console.error('[useCustomerAssignmentHistory] load failed', err);
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [email, phone]);

  useEffect(() => {
    load();
  }, [load]);

  return { entries, loading, refresh: load, original: entries[0] || null };
}
