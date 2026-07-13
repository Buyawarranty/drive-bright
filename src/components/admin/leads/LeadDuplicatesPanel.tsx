import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Users, Phone, Mail } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface DuplicateRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  status: string | null;
  assigned_to: string | null;
  created_at: string;
  matched_on: ('phone' | 'email')[];
  agent_name?: string | null;
}

interface Props {
  leadId: string;
  phone?: string | null;
  email?: string | null;
  onOpenLead?: (leadId: string) => void;
}

const normalizePhone = (p?: string | null) =>
  (p || '').replace(/\D/g, '').replace(/^44/, '0');

export const LeadDuplicatesPanel: React.FC<Props> = ({ leadId, phone, email, onOpenLead }) => {
  const [rows, setRows] = useState<DuplicateRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!phone && !email) return;
      setLoading(true);

      const filters: string[] = [];
      if (email) filters.push(`email.ilike.${email.trim()}`);
      if (phone) {
        const digits = normalizePhone(phone);
        // match by last 10 digits to catch +44/0 variants
        const tail = digits.slice(-10);
        if (tail) filters.push(`phone.ilike.%${tail}%`);
      }

      const { data, error } = await supabase
        .from('sales_leads')
        .select('id, first_name, last_name, email, phone, status, assigned_to, created_at')
        .or(filters.join(','))
        .neq('id', leadId)
        .order('created_at', { ascending: false })
        .limit(10);

      if (cancelled) return;
      if (error || !data) {
        setRows([]);
        setLoading(false);
        return;
      }

      const normPhone = normalizePhone(phone).slice(-10);
      const normEmail = (email || '').trim().toLowerCase();

      const enriched: DuplicateRow[] = data.map((r: any) => {
        const matched: ('phone' | 'email')[] = [];
        if (normEmail && (r.email || '').toLowerCase() === normEmail) matched.push('email');
        if (normPhone && normalizePhone(r.phone).slice(-10) === normPhone) matched.push('phone');
        return { ...r, matched_on: matched };
      });

      // fetch agent names
      const agentIds = Array.from(new Set(enriched.map(r => r.assigned_to).filter(Boolean))) as string[];
      if (agentIds.length) {
        const { data: agents } = await supabase
          .from('admin_users')
          .select('id, first_name, last_name, email')
          .in('id', agentIds);
        const map = new Map<string, string>();
        (agents || []).forEach((a: any) => {
          map.set(a.id, [a.first_name, a.last_name].filter(Boolean).join(' ') || a.email || 'Agent');
        });
        enriched.forEach(r => { if (r.assigned_to) r.agent_name = map.get(r.assigned_to) || null; });
      }

      setRows(enriched);
      setLoading(false);
    };
    load();
    return () => { cancelled = true; };
  }, [leadId, phone, email]);

  if (!phone && !email) return null;
  if (!loading && rows.length === 0) return null;

  return (
    <div className="p-4 border-b bg-amber-50/60 dark:bg-amber-950/20">
      <div className="flex items-center gap-2 mb-2">
        <Users className="h-4 w-4 text-amber-700 dark:text-amber-300" />
        <span className="text-xs font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-200">
          Duplicates {loading ? '…' : `(${rows.length})`}
        </span>
        <span className="text-[11px] text-muted-foreground">Same phone or email as this lead</span>
      </div>

      {!loading && (
        <ul className="space-y-1.5">
          {rows.map((r) => {
            const name = [r.first_name, r.last_name].filter(Boolean).join(' ') || r.email || '—';
            return (
              <li
                key={r.id}
                className={cn(
                  'flex flex-wrap items-center gap-2 rounded-md border bg-background px-2.5 py-1.5 text-xs',
                  onOpenLead && 'cursor-pointer hover:bg-muted'
                )}
                onClick={() => onOpenLead?.(r.id)}
                title={onOpenLead ? 'Open this lead' : undefined}
              >
                <span className="font-medium truncate max-w-[160px]">{name}</span>
                {r.matched_on.includes('phone') && (
                  <Badge variant="outline" className="h-5 px-1.5 gap-1">
                    <Phone className="h-3 w-3" /> phone
                  </Badge>
                )}
                {r.matched_on.includes('email') && (
                  <Badge variant="outline" className="h-5 px-1.5 gap-1">
                    <Mail className="h-3 w-3" /> email
                  </Badge>
                )}
                {r.status && (
                  <Badge variant="secondary" className="h-5 px-1.5 capitalize">
                    {r.status.replace(/_/g, ' ')}
                  </Badge>
                )}
                <span className="text-muted-foreground">
                  {r.agent_name ? `→ ${r.agent_name}` : 'Unassigned'}
                </span>
                <span className="ml-auto text-muted-foreground tabular-nums">
                  {format(new Date(r.created_at), 'dd MMM yy')}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};
