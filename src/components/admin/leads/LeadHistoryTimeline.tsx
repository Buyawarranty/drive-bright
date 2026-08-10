import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAllAdminUsersMap } from '@/hooks/useAllAdminUsersMap';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Phone, StickyNote, RefreshCw, UserCog, Activity, History } from 'lucide-react';

/**
 * Full audit trail for one lead — who called, who wrote notes, who changed the
 * status and who reassigned it. Merges:
 *   - lead_call_logs        (manual call attempts + outcome)
 *   - phone_events          (Zoiper / Dial 9 click-to-dial events)
 *   - lead_quick_notes      (agent notes)
 *   - sales_leads_changelog (status / owner changes)
 */

type Kind = 'call' | 'dial' | 'note' | 'status' | 'owner';

interface Entry {
  id: string;
  at: string;
  kind: Kind;
  actorId?: string | null;
  actorName?: string | null;
  title: string;
  detail?: string | null;
}

const KIND_META: Record<Kind, { label: string; icon: React.ElementType; cls: string }> = {
  call: { label: 'Call', icon: Phone, cls: 'bg-emerald-50 text-emerald-800 border-emerald-300' },
  dial: { label: 'Dialled', icon: Activity, cls: 'bg-sky-50 text-sky-800 border-sky-300' },
  note: { label: 'Note', icon: StickyNote, cls: 'bg-amber-50 text-amber-900 border-amber-300' },
  status: { label: 'Status', icon: RefreshCw, cls: 'bg-violet-50 text-violet-800 border-violet-300' },
  owner: { label: 'Reassigned', icon: UserCog, cls: 'bg-orange-50 text-orange-800 border-orange-300' },
};

interface Props {
  leadId: string;
  className?: string;
}

export const LeadHistoryTimeline: React.FC<Props> = ({ leadId, className }) => {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | Kind>('all');

  const isCart = leadId.startsWith('cart_');
  const actualId = isCart ? leadId.replace('cart_', '') : leadId;

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [calls, dials, notes, changes] = await Promise.all([
        supabase
          .from('lead_call_logs')
          .select('id, created_at, agent_id, agent_name, outcome, notes, attempt_number, call_started_at, call_ended_at, contact_made')
          .eq('lead_id', actualId)
          .order('created_at', { ascending: false })
          .limit(200),
        supabase
          .from('phone_events')
          .select('id, created_at, agent_id, agent_name, event_type, selected_outcome, phone_number, source_page')
          .eq('lead_id', actualId)
          .order('created_at', { ascending: false })
          .limit(200),
        supabase
          .from('lead_quick_notes')
          .select('id, created_at, created_by, note_text')
          .eq('lead_id', actualId)
          .order('created_at', { ascending: false })
          .limit(200),
        supabase
          .from('sales_leads_changelog')
          .select('id, changed_at, changed_by, old_status, new_status, old_assigned_to, new_assigned_to')
          .eq('lead_id', actualId)
          .order('changed_at', { ascending: false })
          .limit(300),
      ]);

      const list: Entry[] = [];

      (calls.data || []).forEach((r: any) => {
        const secs =
          r.call_started_at && r.call_ended_at
            ? Math.max(0, Math.round((new Date(r.call_ended_at).getTime() - new Date(r.call_started_at).getTime()) / 1000))
            : null;
        list.push({
          id: `call-${r.id}`,
          at: r.created_at,
          kind: 'call',
          actorId: r.agent_id,
          actorName: r.agent_name,
          title: `Call attempt ${r.attempt_number ?? ''}`.trim() +
            (r.outcome ? ` — ${String(r.outcome).replace(/_/g, ' ')}` : '') +
            (secs !== null ? ` (${Math.floor(secs / 60)}m ${secs % 60}s)` : ''),
          detail: r.notes,
        });
      });

      (dials.data || []).forEach((r: any) => {
        list.push({
          id: `dial-${r.id}`,
          at: r.created_at,
          kind: 'dial',
          actorId: r.agent_id,
          actorName: r.agent_name,
          title:
            `${String(r.event_type || 'dial').replace(/_/g, ' ')}` +
            (r.selected_outcome ? ` — ${String(r.selected_outcome).replace(/_/g, ' ')}` : ''),
          detail: [r.phone_number, r.source_page].filter(Boolean).join(' · ') || null,
        });
      });

      (notes.data || []).forEach((r: any) => {
        list.push({
          id: `note-${r.id}`,
          at: r.created_at,
          kind: 'note',
          actorId: r.created_by,
          title: 'Note added',
          detail: r.note_text,
        });
      });

      (changes.data || []).forEach((r: any) => {
        if (r.new_status && r.old_status !== r.new_status) {
          list.push({
            id: `st-${r.id}`,
            at: r.changed_at,
            kind: 'status',
            actorId: r.changed_by,
            title: `Status ${r.old_status ? `${r.old_status} → ` : '→ '}${r.new_status}`.replace(/_/g, ' '),
          });
        }
        if (r.new_assigned_to && r.old_assigned_to !== r.new_assigned_to) {
          list.push({
            id: `own-${r.id}`,
            at: r.changed_at,
            kind: 'owner',
            actorId: r.changed_by,
            title: 'Owner changed',
            detail: `${r.old_assigned_to || 'unassigned'} → ${r.new_assigned_to}`,
          });
        }
      });

      list.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
      setEntries(list);
    } catch (e) {
      console.error('[LeadHistoryTimeline]', e);
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [actualId]);

  useEffect(() => {
    if (isCart) {
      setEntries([]);
      setLoading(false);
      return;
    }
    fetchAll();
  }, [fetchAll, isCart]);

  const ids = useMemo(() => {
    const set = new Set<string>();
    entries.forEach(e => {
      if (e.actorId) set.add(e.actorId);
      if (e.kind === 'owner' && e.detail) e.detail.split('→').forEach(p => {
        const v = p.trim();
        if (v && v !== 'unassigned') set.add(v);
      });
    });
    return [...set];
  }, [entries]);

  const usersMap = useAllAdminUsersMap(ids);

  const nameFor = (id?: string | null, fallback?: string | null) => {
    if (id) {
      const u = usersMap.get(id);
      if (u) return [u.first_name, u.last_name].filter(Boolean).join(' ') || u.email;
    }
    return fallback || 'Unknown';
  };

  const shown = filter === 'all' ? entries : entries.filter(e => e.kind === filter);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    entries.forEach(e => { c[e.kind] = (c[e.kind] || 0) + 1; });
    return c;
  }, [entries]);

  if (isCart) {
    return (
      <p className={cn('text-xs text-muted-foreground', className)}>
        This is an abandoned-cart enquiry — call and status history starts once it becomes a lead.
      </p>
    );
  }

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex flex-wrap items-center gap-1.5">
        <History className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-semibold mr-1">Full history</span>
        {(['all', 'call', 'dial', 'note', 'status', 'owner'] as const).map(k => (
          <Button
            key={k}
            size="sm"
            variant={filter === k ? 'default' : 'outline'}
            className="h-6 px-2 text-xs capitalize"
            onClick={() => setFilter(k)}
          >
            {k === 'all' ? `All (${entries.length})` : `${KIND_META[k].label}${counts[k] ? ` (${counts[k]})` : ''}`}
          </Button>
        ))}
        <Button size="sm" variant="ghost" className="h-6 px-2 text-xs ml-auto" onClick={fetchAll}>
          <RefreshCw className="h-3 w-3 mr-1" /> Refresh
        </Button>
      </div>

      {loading ? (
        <p className="text-xs text-muted-foreground">Loading history…</p>
      ) : shown.length === 0 ? (
        <p className="text-xs text-muted-foreground">No history recorded for this lead yet.</p>
      ) : (
        <ol className="space-y-1.5 max-h-[420px] overflow-y-auto pr-1">
          {shown.map(e => {
            const meta = KIND_META[e.kind];
            const Icon = meta.icon;
            const detail =
              e.kind === 'owner' && e.detail
                ? e.detail.split('→').map(p => nameFor(p.trim() === 'unassigned' ? null : p.trim(), 'Unassigned')).join(' → ')
                : e.detail;
            return (
              <li key={e.id} className="flex items-start gap-2 rounded-md border bg-card px-2.5 py-2">
                <Badge variant="outline" className={cn('mt-0.5 gap-1 text-[10px] font-semibold', meta.cls)}>
                  <Icon className="h-3 w-3" />
                  {meta.label}
                </Badge>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium capitalize-first">{e.title}</p>
                  {detail && <p className="text-xs text-muted-foreground whitespace-pre-wrap break-words">{detail}</p>}
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {format(new Date(e.at), 'dd MMM yyyy, HH:mm')} · {nameFor(e.actorId, e.actorName)}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
};

export default LeadHistoryTimeline;
