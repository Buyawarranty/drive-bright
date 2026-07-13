import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Loader2, RefreshCw, ShieldAlert, PhoneCall, X, Pencil, Check } from 'lucide-react';
import { toast } from 'sonner';
import { useViewAs } from '@/contexts/ViewAsContext';
import { useAllAdminUsersMap } from '@/hooks/useAllAdminUsersMap';
import { formatDistanceToNowStrict } from 'date-fns';

/**
 * Inline click-to-edit cell for the Daily / Total cap columns. When empty it
 * renders as a clearly clickable "∞ Set" pill so managers know they can edit
 * it — the old bare number input rendered as just "∞" with no affordance,
 * which is why the caps looked like static text.
 *
 * Save on Enter / blur, Esc to cancel, ✕ to clear back to unlimited.
 */
const CapCell: React.FC<{
  value: string;
  savedValue: number | null;
  disabled?: boolean;
  onChange: (next: string) => void;
  onCommit: () => void;
  onClear: () => void;
}> = ({ value, savedValue, disabled, onChange, onCommit, onClear }) => {
  const [editing, setEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const hasValue = value.trim() !== '';
  const showInput = editing || hasValue;

  useEffect(() => {
    if (editing && inputRef.current) inputRef.current.focus();
  }, [editing]);

  if (!showInput) {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => setEditing(true)}
        className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md border border-dashed border-slate-300 bg-white hover:border-blue-400 hover:bg-blue-50 text-slate-600 hover:text-blue-700 text-sm transition-colors disabled:opacity-50"
        title="Click to set a cap"
      >
        <span className="text-base leading-none">∞</span>
        <Pencil className="h-3 w-3" />
        <span className="text-xs font-medium">Set</span>
      </button>
    );
  }

  return (
    <div className="inline-flex items-center gap-1">
      <Input
        ref={inputRef}
        type="number"
        min={0}
        placeholder="∞"
        className="h-8 w-20"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); onCommit(); setEditing(false); }
          if (e.key === 'Escape') { setEditing(false); if (savedValue == null) onChange(''); }
        }}
        onBlur={() => { if (hasValue) onCommit(); setEditing(false); }}
      />
      {(hasValue || savedValue != null) && (
        <button
          type="button"
          disabled={disabled}
          onClick={() => { onChange(''); onClear(); setEditing(false); }}
          className="h-6 w-6 inline-flex items-center justify-center rounded text-slate-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-50"
          title="Clear cap (unlimited)"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
};

type Stat = {
  admin_user_id: string;
  taken_today: number;
  taken_total: number;
  last_taken_at: string | null;
};

type Cap = {
  admin_user_id: string;
  daily_cap: number | null;
  total_cap: number | null;
  blocked: boolean;
  note: string | null;
};

const MANAGEMENT_ROLES = ['admin', 'super_admin', 'sales_manager'];

export function RecontactAgentCapsPanel() {
  const { effectiveRole } = useViewAs();
  const isManagement = MANAGEMENT_ROLES.includes(effectiveRole || '');
  const adminMap = useAllAdminUsersMap();

  const [stats, setStats] = useState<Stat[]>([]);
  const [caps, setCaps] = useState<Record<string, Cap>>({});
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, { daily: string; total: string }>>({});

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: s }, { data: c }] = await Promise.all([
      (supabase.rpc as any)('recontact_agent_stats'),
      (supabase as any).from('recontact_agent_caps').select('*'),
    ]);
    setStats((s as Stat[]) ?? []);
    const map: Record<string, Cap> = {};
    ((c as Cap[]) ?? []).forEach(r => { map[r.admin_user_id] = r; });
    setCaps(map);
    setLoading(false);
  }, []);

  useEffect(() => { if (isManagement) load(); }, [isManagement, load]);

  const rows = useMemo(() => {
    const ids = new Set<string>();
    stats.forEach(s => ids.add(s.admin_user_id));
    Object.keys(caps).forEach(id => ids.add(id));
    // Also include every active sales / sales_lead agent so managers can pre-set caps
    adminMap.forEach((a, id) => {
      if (a.is_active && (a.role === 'sales' || a.role === 'sales_lead')) ids.add(id);
    });
    const list = Array.from(ids).map(id => {
      const s = stats.find(x => x.admin_user_id === id);
      const cap = caps[id];
      const a = adminMap.get(id);
      const name = a
        ? ([a.first_name, a.last_name].filter(Boolean).join(' ') || a.email || 'Agent')
        : 'Agent';
      return {
        id,
        name,
        email: a?.email ?? '',
        role: a?.role ?? '',
        taken_today: s?.taken_today ?? 0,
        taken_total: s?.taken_total ?? 0,
        last_taken_at: s?.last_taken_at ?? null,
        daily_cap: cap?.daily_cap ?? null,
        total_cap: cap?.total_cap ?? null,
        blocked: cap?.blocked ?? false,
      };
    });
    list.sort((x, y) => y.taken_today - x.taken_today || x.name.localeCompare(y.name));
    return list;
  }, [stats, caps, adminMap]);

  const saveCap = async (adminId: string, patch: Partial<Cap>) => {
    setSavingId(adminId);
    const existing = caps[adminId];
    const payload = {
      admin_user_id: adminId,
      daily_cap: existing?.daily_cap ?? null,
      total_cap: existing?.total_cap ?? null,
      blocked: existing?.blocked ?? false,
      note: existing?.note ?? null,
      ...patch,
    };
    const { error } = await (supabase as any)
      .from('recontact_agent_caps')
      .upsert(payload, { onConflict: 'admin_user_id' });
    setSavingId(null);
    if (error) {
      toast.error(error.message || 'Could not save');
      return;
    }
    setCaps(prev => ({ ...prev, [adminId]: { ...payload } as Cap }));
    toast.success('Saved');
  };

  const commitCaps = (adminId: string) => {
    const d = drafts[adminId];
    if (!d) return;
    const daily = d.daily.trim() === '' ? null : Math.max(0, Number(d.daily));
    const total = d.total.trim() === '' ? null : Math.max(0, Number(d.total));
    saveCap(adminId, { daily_cap: daily, total_cap: total });
    setDrafts(prev => { const n = { ...prev }; delete n[adminId]; return n; });
  };

  if (!isManagement) return null;

  return (
    <Card className="border-2 border-blue-200">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-base flex items-center gap-2">
            <PhoneCall className="h-4 w-4 text-blue-700" />
            Recontact Leads — per-agent allowances
            <Badge variant="outline" className="text-[10px]">{rows.length}</Badge>
          </CardTitle>
          <Button variant="outline" size="sm" onClick={load} disabled={loading} className="gap-2">
            <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Turn <strong>Recontact</strong> on for the agents who work this queue — they'll get a green
          "On" tick. Off shows orange so it's obvious who isn't included. Add a daily or total cap next
          to control how many leads each on-agent can claim (blank = unlimited, standard 200/day guardrail still applies).
        </p>
      </CardHeader>
      <CardContent>
        {rows.length === 0 && (
          <p className="text-sm text-muted-foreground py-6 text-center">
            No agents to display yet.
          </p>
        )}
        {rows.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-muted-foreground border-b">
                  <th className="py-2 pr-3">Agent</th>
                  <th className="py-2 pr-3">Today</th>
                  <th className="py-2 pr-3">Total</th>
                  <th className="py-2 pr-3">Last claimed</th>
                  <th className="py-2 pr-3">Daily cap</th>
                  <th className="py-2 pr-3">Total cap</th>
                  <th className="py-2 pr-3">Recontact</th>
                  <th className="py-2 pr-3"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => {
                  const draft = drafts[r.id];
                  const dailyVal = draft ? draft.daily : (r.daily_cap ?? '').toString();
                  const totalVal = draft ? draft.total : (r.total_cap ?? '').toString();
                  const dirty = !!draft;
                  const overDaily = r.daily_cap != null && r.taken_today >= r.daily_cap;
                  return (
                    <tr key={r.id} className="border-b last:border-0 align-middle">
                      <td className="py-2 pr-3">
                        <div className="font-medium flex items-center gap-2">
                          {r.name}
                          {!r.blocked ? (
                            <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px]">
                              <Check className="h-3 w-3 mr-1" /> On
                            </Badge>
                          ) : (
                            <Badge className="bg-orange-100 text-orange-800 border-orange-300 text-[10px]">
                              <ShieldAlert className="h-3 w-3 mr-1" /> Off
                            </Badge>
                          )}
                          {overDaily && !r.blocked && (
                            <Badge className="bg-amber-100 text-amber-800 border-amber-300 text-[10px]">
                              Cap reached
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">{r.email} · {r.role}</div>
                      </td>
                      <td className="py-2 pr-3 font-semibold">{r.taken_today}</td>
                      <td className="py-2 pr-3">{r.taken_total}</td>
                      <td className="py-2 pr-3 text-xs text-muted-foreground">
                        {r.last_taken_at
                          ? formatDistanceToNowStrict(new Date(r.last_taken_at), { addSuffix: true })
                          : '—'}
                      </td>
                      <td className="py-2 pr-3">
                        <CapCell
                          value={dailyVal}
                          savedValue={r.daily_cap}
                          disabled={savingId === r.id}
                          onChange={(next) => setDrafts(p => ({
                            ...p, [r.id]: { daily: next, total: totalVal },
                          }))}
                          onCommit={() => commitCaps(r.id)}
                          onClear={() => saveCap(r.id, { daily_cap: null })}
                        />
                      </td>
                      <td className="py-2 pr-3">
                        <CapCell
                          value={totalVal}
                          savedValue={r.total_cap}
                          disabled={savingId === r.id}
                          onChange={(next) => setDrafts(p => ({
                            ...p, [r.id]: { daily: dailyVal, total: next },
                          }))}
                          onCommit={() => commitCaps(r.id)}
                          onClear={() => saveCap(r.id, { total_cap: null })}
                        />
                      </td>
                      <td className="py-2 pr-3">
                        {/* Switch shows the ON state (agent actively receives recontact leads).
                            Underlying column is `blocked`, so we invert: checked = !blocked. */}
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={!r.blocked}
                            disabled={savingId === r.id}
                            onCheckedChange={(v) => saveCap(r.id, { blocked: !v })}
                            className="data-[state=checked]:bg-emerald-600 data-[state=unchecked]:bg-orange-400"
                          />
                          <span className={`text-xs font-medium ${r.blocked ? 'text-orange-700' : 'text-emerald-700'}`}>
                            {r.blocked ? 'Off' : 'On'}
                          </span>
                        </div>
                      </td>
                      <td className="py-2 pr-3">
                        {dirty && (
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={savingId === r.id}
                            onClick={() => commitCaps(r.id)}
                          >
                            {savingId === r.id ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Save'}
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
