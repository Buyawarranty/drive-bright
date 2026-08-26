import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Loader2, Save } from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { withBackgroundPriority } from '@/lib/requestQueue';

/**
 * Managers-only: lists the individual sales inside a reconciliation bucket that
 * are NOT credited to a sales agent on a team, and lets a manager pick the right
 * agent and save. Saving writes the sale credit on the customer, which is the
 * single source both Customer Management and the scoreboard read.
 */

interface Row {
  customer_id: string;
  customer_name: string | null;
  registration_plate: string | null;
  amount: number;
  signup_date: string | null;
  bucket: string;
  current_label: string | null;
  current_admin_user_id: string | null;
}

interface AgentOption {
  id: string;
  name: string;
}

const gbp = (n: number) => `£${Math.round(n || 0).toLocaleString('en-GB')}`;

interface Props {
  bucket: string;
  start: Date;
  end: Date;
  onSaved?: () => void;
}

export const UnattributedSalesAssigner: React.FC<Props> = ({ bucket, start, end, onSaved }) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [agents, setAgents] = useState<AgentOption[]>([]);
  const [picks, setPicks] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [listRes, agentRes] = await withBackgroundPriority(() =>
        Promise.all([
          (supabase as any).rpc('list_scoreboard_unattributed_sales', {
            p_start: start.toISOString(),
            p_end: end.toISOString(),
          }),
          (supabase as any)
            .from('admin_users')
            .select('id, first_name, last_name, email, role, is_active')
            .eq('is_active', true)
            .in('role', ['sales', 'sales_lead']),
        ]),
      );

      setRows(
        (((listRes?.data || []) as Row[]) || [])
          .filter((r) => r.bucket === bucket)
          .map((r) => ({ ...r, amount: Number(r.amount) || 0 })),
      );
      setAgents(
        (((agentRes?.data || []) as any[]) || [])
          .map((a) => ({
            id: a.id as string,
            name:
              [a.first_name, a.last_name].filter(Boolean).join(' ').trim() || (a.email as string) || 'Unnamed agent',
          }))
          .sort((a, b) => a.name.localeCompare(b.name)),
      );
    } catch (e: any) {
      toast.error(e?.message || 'Could not load these sales');
    } finally {
      setLoading(false);
    }
  }, [bucket, start.getTime(), end.getTime()]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  const save = async (row: Row) => {
    const agentId = picks[row.customer_id];
    if (!agentId) {
      toast.error('Pick a sales agent first');
      return;
    }
    setSaving((s) => ({ ...s, [row.customer_id]: true }));
    try {
      const { error } = await (supabase as any).rpc('set_sale_credit_agent', {
        p_customer_id: row.customer_id,
        p_admin_user_id: agentId,
      });
      if (error) throw error;
      const name = agents.find((a) => a.id === agentId)?.name || 'the agent';
      toast.success(`${row.customer_name || 'Sale'} credited to ${name}`);
      setRows((rs) => rs.filter((r) => r.customer_id !== row.customer_id));
      onSaved?.();
    } catch (e: any) {
      toast.error(e?.message || 'Could not save the sale credit');
    } finally {
      setSaving((s) => ({ ...s, [row.customer_id]: false }));
    }
  };

  const total = useMemo(() => rows.reduce((t, r) => t + r.amount, 0), [rows]);

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-[11px] font-medium hover:bg-muted"
      >
        {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        {open ? 'Hide these sales' : 'Show these sales and assign an agent'}
      </button>

      {open && (
        <div className="mt-2 rounded-lg border border-border bg-background">
          {loading ? (
            <div className="flex items-center gap-2 px-3 py-3 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" /> Loading sales…
            </div>
          ) : rows.length === 0 ? (
            <div className="px-3 py-3 text-xs text-muted-foreground">Nothing left to assign here.</div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border bg-muted/40 text-left text-[10px] uppercase tracking-wide text-muted-foreground">
                      <th className="px-3 py-2 font-medium">Customer</th>
                      <th className="px-3 py-2 font-medium">Signed up</th>
                      <th className="px-3 py-2 font-medium">Amount</th>
                      <th className="px-3 py-2 font-medium">Currently credited</th>
                      <th className="px-3 py-2 font-medium">Assign to sales agent</th>
                      <th className="px-3 py-2 font-medium" />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.customer_id} className="border-b border-border last:border-0">
                        <td className="px-3 py-2">
                          <div className="font-medium">{r.customer_name || 'Unnamed customer'}</div>
                          {r.registration_plate && (
                            <div className="text-[10px] uppercase text-muted-foreground">{r.registration_plate}</div>
                          )}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                          {r.signup_date ? format(new Date(r.signup_date), 'd MMM') : '—'}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap font-semibold">{gbp(r.amount)}</td>
                        <td className="px-3 py-2 text-muted-foreground">{r.current_label || 'No agent on the record'}</td>
                        <td className="px-3 py-2">
                          <select
                            value={picks[r.customer_id] || ''}
                            onChange={(e) => setPicks((p) => ({ ...p, [r.customer_id]: e.target.value }))}
                            className="w-44 rounded-md border border-border bg-background px-2 py-1 text-xs"
                          >
                            <option value="">Choose agent…</option>
                            {agents.map((a) => (
                              <option key={a.id} value={a.id}>
                                {a.name}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          <button
                            type="button"
                            onClick={() => save(r)}
                            disabled={!picks[r.customer_id] || saving[r.customer_id]}
                            className="inline-flex items-center gap-1 rounded-md bg-orange-600 px-2 py-1 text-[11px] font-medium text-primary-foreground disabled:opacity-50"
                          >
                            {saving[r.customer_id] ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Save className="h-3 w-3" />
                            )}
                            Save
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="border-t border-border px-3 py-2 text-[11px] text-muted-foreground">
                {rows.length} sale{rows.length === 1 ? '' : 's'} · {gbp(total)} waiting to be credited. Saving updates
                the sale credit on the customer, so Customer Management and the scoreboard both move together.
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default UnattributedSalesAssigner;
