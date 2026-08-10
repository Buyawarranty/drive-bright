import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useIsManagement } from '@/hooks/useIsManagement';
import { useAllAdminUsersMap } from '@/hooks/useAllAdminUsersMap';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { LeadHistoryTimeline } from './LeadHistoryTimeline';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Trophy, ChevronDown, ChevronUp, Search, RefreshCw } from 'lucide-react';

/**
 * Converted sales stay out of the working New Leads list, so managers lost the
 * ability to read the notes and call log behind a sale. This panel keeps the
 * last 6 months of converted / paid leads in the New Leads section with the
 * full audit trail (calls, dials, notes, status and owner changes) per lead.
 * Management only.
 */

interface Row {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  vehicle_reg: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  status: string | null;
  assigned_to: string | null;
  converted_at: string | null;
  created_at: string;
  payment_amount: number | null;
  is_paid: boolean | null;
}

const DAYS = 90;

export const ConvertedSalesLogPanel: React.FC = () => {
  const { isManagement } = useIsManagement();
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    try {
      const since = new Date(Date.now() - DAYS * 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from('sales_leads')
        .select(
          'id, first_name, last_name, email, phone, vehicle_reg, vehicle_make, vehicle_model, status, assigned_to, converted_at, created_at, payment_amount, is_paid'
        )
        .eq('status', 'converted')
        .gte('created_at', since)
        .order('converted_at', { ascending: false, nullsFirst: false })
        .limit(500);
      if (error) throw error;
      setRows((data || []) as Row[]);
    } catch (e) {
      console.error('[ConvertedSalesLogPanel]', e);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open && rows.length === 0 && !loading) fetchRows();
  }, [open, rows.length, loading, fetchRows]);

  const ownerIds = useMemo(
    () => [...new Set(rows.map(r => r.assigned_to).filter(Boolean) as string[])],
    [rows]
  );
  const usersMap = useAllAdminUsersMap(ownerIds);

  const ownerName = (id: string | null) => {
    if (!id) return 'Unassigned';
    const u = usersMap.get(id);
    if (!u) return 'Unknown';
    return [u.first_name, u.last_name].filter(Boolean).join(' ') || u.email;
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase().replace(/\s+/g, '');
    if (!q) return rows;
    return rows.filter(r => {
      const hay = [
        r.first_name, r.last_name, r.email, r.phone, r.vehicle_reg, r.vehicle_make, r.vehicle_model,
        ownerName(r.assigned_to),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .replace(/\s+/g, '');
      return hay.includes(q);
    });
  }, [rows, search, usersMap]);

  if (isManagement !== true) return null;

  return (
    <div className="rounded-lg border bg-card">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left"
      >
        <Trophy className="h-4 w-4 text-teal-600" />
        <span className="text-sm font-semibold">Converted sales log</span>
        <Badge variant="outline" className="text-[10px]">
          Managers only
        </Badge>
        <span className="text-xs text-muted-foreground">
          Notes & call history for sales that left the working list (last {DAYS} days)
        </span>
        {open ? (
          <ChevronUp className="ml-auto h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="ml-auto h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {open && (
        <div className="border-t p-3 space-y-3">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search reg, name, email, phone or agent…"
                className="h-9 pl-8 text-sm"
              />
            </div>
            <Button variant="outline" size="sm" className="h-9" onClick={fetchRows} disabled={loading}>
              <RefreshCw className={cn('h-3.5 w-3.5 mr-1', loading && 'animate-spin')} />
              Refresh
            </Button>
          </div>

          {loading ? (
            <p className="text-xs text-muted-foreground">Loading converted sales…</p>
          ) : filtered.length === 0 ? (
            <p className="text-xs text-muted-foreground">No converted sales found for this period.</p>
          ) : (
            <ul className="space-y-1.5 max-h-[520px] overflow-y-auto pr-1">
              {filtered.map(r => {
                const isOpen = expandedId === r.id;
                const name = [r.first_name, r.last_name].filter(Boolean).join(' ') || r.email || 'Unnamed';
                return (
                  <li key={r.id} className="rounded-md border bg-background">
                    <button
                      type="button"
                      onClick={() => setExpandedId(isOpen ? null : r.id)}
                      className="flex w-full flex-wrap items-center gap-2 px-2.5 py-2 text-left"
                    >
                      <span className="text-sm font-medium">{name}</span>
                      {r.vehicle_reg && (
                        <Badge variant="outline" className="font-mono text-[10px] uppercase">
                          {r.vehicle_reg}
                        </Badge>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {[r.vehicle_make, r.vehicle_model].filter(Boolean).join(' ')}
                      </span>
                      <Badge className="bg-teal-600 text-[10px] text-primary-foreground hover:bg-teal-600">
                        Converted
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        Owner: <b>{ownerName(r.assigned_to)}</b>
                      </span>
                      <span className="ml-auto text-[11px] text-muted-foreground">
                        {r.converted_at
                          ? format(new Date(r.converted_at), 'dd MMM yyyy, HH:mm')
                          : format(new Date(r.created_at), 'dd MMM yyyy')}
                      </span>
                      {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>
                    {isOpen && (
                      <div className="border-t bg-muted/20 p-3">
                        <LeadHistoryTimeline leadId={r.id} />
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};

export default ConvertedSalesLogPanel;
