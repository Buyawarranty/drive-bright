import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Search, Calendar } from 'lucide-react';
import { format } from 'date-fns';

interface LeadRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  phone: string | null;
  vehicle_reg: string | null;
  status: string;
  created_at: string;
  assigned_to: string | null;
}

interface AgentLite {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
}

interface LeadPickerListProps {
  fromAgentIds: string[];
  agents?: AgentLite[];
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  onSelectAll: (ids: string[]) => void;
  onDeselectAll: () => void;
}

type Preset = 'today' | 'yesterday' | 'overnight' | '7days' | 'all' | 'custom';

const buildRange = (preset: Preset, customFrom?: string, customTo?: string): { from: Date | null; to: Date | null } => {
  const now = new Date();
  const startOfDay = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
  const endOfDay = (d: Date) => { const x = new Date(d); x.setHours(23, 59, 59, 999); return x; };

  switch (preset) {
    case 'today':
      return { from: startOfDay(now), to: endOfDay(now) };
    case 'yesterday': {
      const y = new Date(now); y.setDate(y.getDate() - 1);
      return { from: startOfDay(y), to: endOfDay(y) };
    }
    case 'overnight': {
      const from = new Date(now); from.setDate(from.getDate() - 1);
      from.setHours(18, 1, 0, 0);
      const to = new Date(now); to.setHours(8, 59, 59, 999);
      return { from, to };
    }
    case '7days': {
      const from = new Date(now); from.setDate(from.getDate() - 7);
      return { from: startOfDay(from), to: endOfDay(now) };
    }
    case 'all':
      return { from: null, to: null };
    case 'custom': {
      return {
        from: customFrom ? new Date(customFrom + 'T00:00:00') : null,
        to: customTo ? new Date(customTo + 'T23:59:59.999') : null,
      };
    }
  }
};

const fmtDateInput = (d: Date | null) => (d ? format(d, 'yyyy-MM-dd') : '');

export const LeadPickerList: React.FC<LeadPickerListProps> = ({
  fromAgentIds,
  agents = [],
  selectedIds,
  onToggle,
  onSelectAll,
  onDeselectAll,
}) => {
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [preset, setPreset] = useState<Preset>('overnight');
  const [customFrom, setCustomFrom] = useState<string>('');
  const [customTo, setCustomTo] = useState<string>('');
  const [includeTerminal, setIncludeTerminal] = useState(false);
  const [previousAgents, setPreviousAgents] = useState<Map<string, string>>(new Map());
  /** lead_id → who wrote the most recent note, so a manager never reassigns away from the agent working it. */
  const [lastNote, setLastNote] = useState<Map<string, { author: string; text: string; at: string }>>(new Map());
  const TERMINAL_STATUSES = ['lost', 'converted', 'fake_lead', 'cancelled'];


  const range = useMemo(
    () => buildRange(preset, customFrom, customTo),
    [preset, customFrom, customTo],
  );

  const agentMap = useMemo(() => {
    const m = new Map<string, AgentLite>();
    agents.forEach(a => m.set(a.id, a));
    return m;
  }, [agents]);

  const UNASSIGNED_ID = '00000000-0000-0000-0000-000000000000';
  const agentKey = fromAgentIds.slice().sort().join(',');

  useEffect(() => {
    if (fromAgentIds.length === 0) { setLeads([]); setLoading(false); return; }
    const includeUnassigned = fromAgentIds.includes(UNASSIGNED_ID);
    const realAgentIds = fromAgentIds.filter(id => id !== UNASSIGNED_ID);

    const fetchLeads = async () => {
      setLoading(true);
      const applyRange = (q: any) => {
        if (range.from) q = q.gte('created_at', range.from.toISOString());
        if (range.to) q = q.lte('created_at', range.to.toISOString());
        return q;
      };

      const queries: Promise<any>[] = [];
      if (realAgentIds.length > 0) {
        queries.push(
          applyRange(
            supabase
              .from('sales_leads')
              .select('id, first_name, last_name, email, phone, vehicle_reg, status, created_at, assigned_to')
              .in('assigned_to', realAgentIds),
          ).order('created_at', { ascending: false }).limit(500),
        );
      }
      if (includeUnassigned) {
        let uq: any = supabase
          .from('sales_leads')
          .select('id, first_name, last_name, email, phone, vehicle_reg, status, created_at, assigned_to')
          .is('assigned_to', null);
        if (!includeTerminal) {
          uq = uq.not('status', 'in', `(${TERMINAL_STATUSES.join(',')})`);
        }
        queries.push(applyRange(uq).order('created_at', { ascending: false }).limit(500));
      }
      const results = await Promise.all(queries);
      const combined: LeadRow[] = [];
      for (const r of results) if (!r.error && r.data) combined.push(...(r.data as LeadRow[]));
      combined.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
      setLeads(combined);

      // Who wrote the last note on each lead in view (name shown on the row)
      const allIds = combined.map(l => l.id);
      if (allIds.length > 0) {
        const { data: notes } = await supabase
          .from('lead_quick_notes')
          .select('lead_id, note_text, created_by, created_at')
          .in('lead_id', allIds.slice(0, 500))
          .order('created_at', { ascending: false });
        const authorIds = Array.from(new Set((notes || []).map((n: any) => n.created_by).filter(Boolean)));
        const nameById = new Map<string, string>();
        if (authorIds.length > 0) {
          const { data: authors } = await supabase
            .from('admin_users')
            .select('id, first_name, last_name, email')
            .in('id', authorIds as string[]);
          (authors || []).forEach((a: any) => {
            nameById.set(a.id, `${a.first_name || ''} ${a.last_name || ''}`.trim() || a.email);
          });
        }
        const nm = new Map<string, { author: string; text: string; at: string }>();
        (notes || []).forEach((n: any) => {
          if (nm.has(n.lead_id)) return;
          nm.set(n.lead_id, {
            author: nameById.get(n.created_by) || 'Unknown agent',
            text: n.note_text || '',
            at: n.created_at,
          });
        });
        setLastNote(nm);
      } else {
        setLastNote(new Map());
      }

      // Look up the former agent for any unassigned rows in view
      const unassignedIds = combined.filter(l => !l.assigned_to).map(l => l.id);
      if (unassignedIds.length > 0) {
        const { data: audit } = await supabase
          .from('lead_assignment_audit')
          .select('lead_id, assigned_to_id, created_at')
          .in('lead_id', unassignedIds)
          .not('assigned_to_id', 'is', null)
          .order('created_at', { ascending: false });
        const map = new Map<string, string>();
        (audit || []).forEach((row: any) => {
          if (!map.has(row.lead_id) && row.assigned_to_id) map.set(row.lead_id, row.assigned_to_id);
        });
        setPreviousAgents(map);
      } else {
        setPreviousAgents(new Map());
      }
      setLoading(false);
    };
    fetchLeads();
  }, [agentKey, range.from?.getTime(), range.to?.getTime(), includeTerminal]);


  const filtered = search.trim()
    ? leads.filter(l => {
        const s = search.toLowerCase();
        return (
          l.email?.toLowerCase().includes(s) ||
          l.first_name?.toLowerCase().includes(s) ||
          l.last_name?.toLowerCase().includes(s) ||
          l.phone?.includes(s) ||
          l.vehicle_reg?.toLowerCase().includes(s)
        );
      })
    : leads;

  const allFilteredSelected = filtered.length > 0 && filtered.every(l => selectedIds.has(l.id));

  const presetBtn = (id: Preset, label: string) => (
    <Button
      type="button"
      variant={preset === id ? 'default' : 'outline'}
      size="sm"
      className={`h-7 px-2.5 text-[11px] ${preset === id ? 'shadow-sm' : 'bg-background'}`}
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); setPreset(id); }}
    >
      {label}
    </Button>
  );

  const agentLabel = (id: string | null) => {
    if (!id) return null;
    const a = agentMap.get(id);
    if (!a) return null;
    const initials = `${a.first_name?.[0] || ''}${a.last_name?.[0] || ''}`.toUpperCase() || a.email[0].toUpperCase();
    return initials;
  };

  return (
    <div className="space-y-2">
      <div className="space-y-1.5 p-2.5 rounded-lg border bg-muted/30">
        <div className="flex items-center justify-between flex-wrap gap-1">
          <Label className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            Lead created
          </Label>
          <div className="flex gap-1 flex-wrap">
            {presetBtn('today', 'Today')}
            {presetBtn('yesterday', 'Yesterday')}
            {presetBtn('overnight', 'Overnight')}
            {presetBtn('7days', '7 days')}
            {presetBtn('all', 'All')}
          </div>
        </div>
        {preset === 'overnight' && (
          <p className="text-[10px] text-muted-foreground italic">
            Yesterday 18:01 → today 08:59
          </p>
        )}
        <div className="flex gap-2">
          <Input
            type="date"
            value={preset === 'custom' ? customFrom : fmtDateInput(range.from)}
            onChange={e => {
              const v = e.target.value;
              if (preset !== 'custom') setCustomTo(fmtDateInput(range.to));
              setCustomFrom(v);
              setPreset('custom');
            }}
            className="h-7 text-xs"
          />
          <Input
            type="date"
            value={preset === 'custom' ? customTo : fmtDateInput(range.to)}
            onChange={e => {
              const v = e.target.value;
              if (preset !== 'custom') setCustomFrom(fmtDateInput(range.from));
              setCustomTo(v);
              setPreset('custom');
            }}
            className="h-7 text-xs"
          />
        </div>
        {fromAgentIds.includes(UNASSIGNED_ID) && (
          <label className="flex items-center gap-1.5 text-[10px] text-muted-foreground cursor-pointer pt-1">
            <Checkbox
              checked={includeTerminal}
              onCheckedChange={(c) => setIncludeTerminal(!!c)}
              className="h-3 w-3"
            />
            Include lost / fake / converted (terminal) leads
            <span className="italic">— these won't appear in the target agent's Live Leads</span>
          </label>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
          <span className="ml-2 text-sm text-muted-foreground">Loading leads…</span>
        </div>
      ) : leads.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">No leads found for the selected agents in this date range.</p>
      ) : (
        <>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search leads…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="h-8 text-xs pl-7"
              />
            </div>
            <Badge variant="secondary" className="text-xs shrink-0">
              {selectedIds.size} selected
            </Badge>
          </div>

          <div className="border rounded-lg max-h-64 overflow-y-auto">
            <div className="flex items-center gap-2 px-3 py-2 border-b bg-muted/50 sticky top-0 z-10">
              <Checkbox
                checked={allFilteredSelected}
                onCheckedChange={(checked) => {
                  if (checked) onSelectAll(filtered.map(l => l.id));
                  else onDeselectAll();
                }}
              />
              <span className="text-[11px] font-medium text-muted-foreground flex-1">
                {allFilteredSelected ? 'Deselect all' : `Select all ${filtered.length}`}
              </span>
              <span className="text-[10px] text-muted-foreground">Newest first</span>
            </div>

            {filtered.map((lead) => {
              const d = new Date(lead.created_at);
              const owner = agentLabel(lead.assigned_to);
              const isUnassigned = !lead.assigned_to;
              const prevAgentId = isUnassigned ? previousAgents.get(lead.id) : null;
              const prevAgent = prevAgentId ? agentMap.get(prevAgentId) : null;
              const prevAgentName = prevAgent
                ? (`${prevAgent.first_name || ''} ${prevAgent.last_name || ''}`.trim() || prevAgent.email)
                : null;
              const note = lastNote.get(lead.id);

              return (
                <label
                  key={lead.id}
                  className={`flex items-center gap-2 px-3 py-2 border-b last:border-b-0 cursor-pointer hover:bg-muted/30 transition-colors ${
                    selectedIds.has(lead.id) ? 'bg-primary/5' : isUnassigned ? 'bg-amber-50/60 dark:bg-amber-950/20' : ''
                  }`}
                >
                  <Checkbox
                    checked={selectedIds.has(lead.id)}
                    onCheckedChange={() => onToggle(lead.id)}
                  />
                  <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-medium truncate max-w-[120px]">
                      {lead.first_name || lead.last_name
                        ? `${lead.first_name || ''} ${lead.last_name || ''}`.trim()
                        : lead.email}
                    </span>
                    {lead.vehicle_reg && (
                      <span className="text-[10px] text-muted-foreground font-mono">{lead.vehicle_reg}</span>
                    )}
                    {isUnassigned && (
                      <Badge
                        variant="outline"
                        className="text-[10px] shrink-0 border-amber-500/60 bg-amber-100/70 text-amber-900 dark:bg-amber-900/30 dark:text-amber-200"
                        title={prevAgentName ? `Previously assigned to ${prevAgentName}` : 'No prior assignment on record'}
                      >
                        {prevAgentName ? `was: ${prevAgentName}` : 'was: unknown'}
                      </Badge>
                    )}
                    {note && (
                      <Badge
                        variant="outline"
                        className="text-[10px] shrink-0 border-sky-500/60 bg-sky-100/70 text-sky-900 dark:bg-sky-900/30 dark:text-sky-200"
                        title={`Note by ${note.author} on ${format(new Date(note.at), 'dd MMM HH:mm')}:\n${note.text}`}
                      >
                        Note by {note.author}
                      </Badge>
                    )}
                  </div>

                  {owner && fromAgentIds.length > 1 && !isUnassigned && (
                    <Badge variant="secondary" className="text-[10px] shrink-0">{owner}</Badge>
                  )}
                  <Badge variant="outline" className="text-[10px] shrink-0">{lead.status}</Badge>
                  <span className="text-[10px] font-mono text-foreground shrink-0 tabular-nums">
                    {format(d, 'dd MMM HH:mm')}
                  </span>
                </label>
              );
            })}

            {filtered.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">No leads match your search.</p>
            )}
          </div>
        </>
      )}
    </div>
  );
};
