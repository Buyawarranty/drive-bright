import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Loader2, RefreshCw, ShieldAlert, Users } from 'lucide-react';
import { toast } from 'sonner';
import { useViewAs } from '@/contexts/ViewAsContext';
import { useAllAdminUsersMap } from '@/hooks/useAllAdminUsersMap';
import { useSharkTankSettings } from '@/hooks/useSharkTank';
import { formatDistanceToNowStrict } from 'date-fns';

type Stat = {
  admin_user_id: string;
  taken_today: number;
  taken_total: number;
  claimed_today: number;
  claimed_total: number;
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

export function OpenPoolAgentCapsPanel() {
  const { effectiveRole } = useViewAs();
  const isManagement = MANAGEMENT_ROLES.includes(effectiveRole || '');
  const { settings } = useSharkTankSettings();
  const adminMap = useAllAdminUsersMap();

  const [stats, setStats] = useState<Stat[]>([]);
  const [caps, setCaps] = useState<Record<string, Cap>>({});
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, { daily: string; total: string }>>({});

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: s }, { data: c }] = await Promise.all([
      (supabase.rpc as any)('shark_tank_agent_stats'),
      (supabase as any).from('shark_tank_agent_caps').select('*'),
    ]);
    setStats((s as Stat[]) ?? []);
    const map: Record<string, Cap> = {};
    ((c as Cap[]) ?? []).forEach(r => { map[r.admin_user_id] = r; });
    setCaps(map);
    setLoading(false);
  }, []);

  useEffect(() => { if (isManagement) load(); }, [isManagement, load]);

  const rows = useMemo(() => {
    // Union of agents with stats + agents with explicit caps
    const ids = new Set<string>();
    stats.forEach(s => ids.add(s.admin_user_id));
    Object.keys(caps).forEach(id => ids.add(id));
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
        taken_today: s?.taken_today ?? 0,
        taken_total: s?.taken_total ?? 0,
        claimed_today: s?.claimed_today ?? 0,
        claimed_total: s?.claimed_total ?? 0,
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
      .from('shark_tank_agent_caps')
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
    <Card className="border-2 border-purple-200">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4 text-purple-700" />
            Open Lead Pool — per-agent allowances
            <Badge variant="outline" className="text-[10px]">{rows.length}</Badge>
            {!settings.enabled && (
              <Badge variant="outline" className="text-[10px] border-amber-400 text-amber-700">Pool OFF</Badge>
            )}
          </CardTitle>
          <Button variant="outline" size="sm" onClick={load} disabled={loading} className="gap-2">
            <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          See how many leads each agent has taken from the pool. Block an agent to stop them taking any more,
          or set a daily / total cap. Leave a cap blank for unlimited.
        </p>
      </CardHeader>
      <CardContent>
        {rows.length === 0 && (
          <p className="text-sm text-muted-foreground py-6 text-center">
            No agents have taken pool leads yet. Set an allowance below to start capping specific agents.
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
                  <th className="py-2 pr-3">Claimed (owned)</th>
                  <th className="py-2 pr-3">Last taken</th>
                  <th className="py-2 pr-3">Daily cap</th>
                  <th className="py-2 pr-3">Total cap</th>
                  <th className="py-2 pr-3">Blocked</th>
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
                          {r.blocked && (
                            <Badge className="bg-red-100 text-red-800 border-red-300 text-[10px]">
                              <ShieldAlert className="h-3 w-3 mr-1" /> Blocked
                            </Badge>
                          )}
                          {overDaily && !r.blocked && (
                            <Badge className="bg-amber-100 text-amber-800 border-amber-300 text-[10px]">
                              Cap reached
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">{r.email}</div>
                      </td>
                      <td className="py-2 pr-3 font-semibold">{r.taken_today}</td>
                      <td className="py-2 pr-3">{r.taken_total}</td>
                      <td className="py-2 pr-3">
                        {r.claimed_today} <span className="text-muted-foreground">/ {r.claimed_total}</span>
                      </td>
                      <td className="py-2 pr-3 text-xs text-muted-foreground">
                        {r.last_taken_at
                          ? formatDistanceToNowStrict(new Date(r.last_taken_at), { addSuffix: true })
                          : '—'}
                      </td>
                      <td className="py-2 pr-3">
                        <Input
                          type="number"
                          min={0}
                          placeholder="∞"
                          className="h-8 w-20"
                          value={dailyVal}
                          onChange={e => setDrafts(p => ({
                            ...p, [r.id]: { daily: e.target.value, total: totalVal },
                          }))}
                        />
                      </td>
                      <td className="py-2 pr-3">
                        <Input
                          type="number"
                          min={0}
                          placeholder="∞"
                          className="h-8 w-20"
                          value={totalVal}
                          onChange={e => setDrafts(p => ({
                            ...p, [r.id]: { daily: dailyVal, total: e.target.value },
                          }))}
                        />
                      </td>
                      <td className="py-2 pr-3">
                        <Switch
                          checked={r.blocked}
                          disabled={savingId === r.id}
                          onCheckedChange={v => saveCap(r.id, { blocked: v })}
                        />
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
