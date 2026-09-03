import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * READ-ONLY live leads for the Open Round Robin practice areas.
 *
 * This hook exists so managers can rehearse Open Round Robin against the exact
 * leads the business is really receiving, without switching ORR on and without
 * touching the live New Leads pipeline.
 *
 * Hard rules (do not change):
 *  - SELECT only. This hook never inserts, updates, deletes, or calls an RPC.
 *  - Nothing it returns is ever written back. Practice panels copy these rows
 *    into their own local state; taking, dialling or restatusing a practice row
 *    changes nothing in the database and no agent's figures move.
 */

export type SandboxLeadWindow = 'overnight' | 'recent';

export interface SandboxLiveLead {
  id: string;
  createdAt: Date;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  reg: string;
  status: string;
  source: string | null;
  assignedTo: string | null;
  callCount: number;
}

interface Options {
  window?: SandboxLeadWindow;
  limit?: number;
}

/** 6pm the previous day → 9am today: the overnight parked batch. */
const overnightRange = () => {
  const from = new Date();
  from.setDate(from.getDate() - 1);
  from.setHours(18, 0, 0, 0);
  const to = new Date();
  to.setHours(9, 0, 0, 0);
  if (to.getTime() <= from.getTime()) to.setDate(to.getDate() + 1);
  return { from, to };
};

export const useSandboxLiveLeads = (enabled: boolean, options: Options = {}) => {
  const { window: leadWindow = 'recent', limit = 40 } = options;
  const [leads, setLeads] = useState<SandboxLiveLead[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setError(null);
    try {
      let query = supabase
        .from('sales_leads')
        .select('id, created_at, first_name, last_name, email, phone, vehicle_reg, status, lead_source, assigned_to, call_count')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (leadWindow === 'overnight') {
        const { from, to } = overnightRange();
        query = query.gte('created_at', from.toISOString()).lte('created_at', to.toISOString());
      } else {
        const from = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        query = query.gte('created_at', from.toISOString());
      }

      const { data, error: queryError } = await query;
      if (queryError) throw queryError;

      setLeads(
        (data ?? []).map((row: any) => ({
          id: row.id as string,
          createdAt: new Date(row.created_at as string),
          firstName: (row.first_name as string) || '',
          lastName: (row.last_name as string) || '',
          email: (row.email as string) || '',
          phone: (row.phone as string) || '',
          reg: (row.vehicle_reg as string) || '',
          status: (row.status as string) || 'new',
          source: (row.lead_source as string) ?? null,
          assignedTo: (row.assigned_to as string) ?? null,
          callCount: Number(row.call_count ?? 0),
        })),
      );
    } catch (e: any) {
      setError(e?.message || 'Could not load live leads');
      setLeads([]);
    } finally {
      setLoading(false);
    }
  }, [enabled, leadWindow, limit]);

  useEffect(() => {
    if (!enabled) {
      setLeads([]);
      setError(null);
      return;
    }
    void load();
  }, [enabled, load]);

  return { leads, loading, error, refresh: load };
};
