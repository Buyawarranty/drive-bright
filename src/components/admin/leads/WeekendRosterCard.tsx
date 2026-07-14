import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { CalendarDays, Save, Sunrise } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface AdminLite {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  role: string;
}

/**
 * Weekend Roster settings.
 *
 * - Sunday: tick everyone working. New Sunday leads round-robin among the
 *   ticked-and-active agents (bypassing daily caps). Stored under
 *   `lead_settings.weekend_sunday_roster` as a JSONB array of admin_users.id.
 *   Legacy single-agent key `weekend_solo_agent_id` is still read as a
 *   fallback by the trigger for back-compat.
 * - Saturday: tick who's rostered. Informational for planning; anyone
 *   active can grab pool leads. Stored under
 *   `lead_settings.weekend_saturday_roster` as a JSONB array.
 */
export const WeekendRosterCard = () => {
  const [agents, setAgents] = useState<AdminLite[]>([]);
  const [sunday, setSunday] = useState<Set<string>>(new Set());
  const [saturday, setSaturday] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    (async () => {
      const [agentsRes, settingsRes] = await Promise.all([
        supabase
          .from('admin_users')
          .select('id, first_name, last_name, email, role, is_active')
          .eq('is_active', true)
          .in('role', ['sales', 'sales_lead', 'lead_gen'])
          .order('first_name', { ascending: true }),
        (supabase as any)
          .from('lead_settings')
          .select('setting_key, setting_value')
          .in('setting_key', [
            'weekend_solo_agent_id',
            'weekend_saturday_roster',
            'weekend_sunday_roster',
          ]),
      ]);
      setAgents((agentsRes.data as AdminLite[]) || []);

      const map = new Map<string, any>();
      (settingsRes.data || []).forEach((r: any) => map.set(r.setting_key, r.setting_value));

      const sundayRoster = map.get('weekend_sunday_roster');
      if (Array.isArray(sundayRoster) && sundayRoster.length > 0) {
        setSunday(new Set(sundayRoster.filter((x: any) => typeof x === 'string')));
      } else {
        // fallback: seed from legacy single solo agent
        const legacy = map.get('weekend_solo_agent_id');
        const legacyId = typeof legacy === 'string' ? legacy : legacy?.value ?? '';
        if (legacyId) setSunday(new Set([legacyId]));
      }

      const roster = map.get('weekend_saturday_roster');
      if (Array.isArray(roster)) {
        setSaturday(new Set(roster.filter((x: any) => typeof x === 'string')));
      }
      setLoading(false);
    })();
  }, []);

  const displayName = (a: AdminLite) =>
    `${a.first_name || ''} ${a.last_name || ''}`.trim() || a.email;

  const toggle = (setter: typeof setSunday) => (id: string, on: boolean) => {
    setter((prev) => {
      const next = new Set(prev);
      if (on) next.add(id); else next.delete(id);
      return next;
    });
    setDirty(true);
  };
  const toggleSunday = toggle(setSunday);
  const toggleSaturday = toggle(setSaturday);

  const onSave = async () => {
    setSaving(true);
    try {
      const sundayIds = Array.from(sunday);
      const rows = [
        { setting_key: 'weekend_sunday_roster', setting_value: sundayIds },
        // Keep legacy key aligned so any external reader still works.
        {
          setting_key: 'weekend_solo_agent_id',
          setting_value: sundayIds[0] ?? null,
        },
        { setting_key: 'weekend_saturday_roster', setting_value: Array.from(saturday) },
      ];
      for (const r of rows) {
        const { error } = await (supabase as any)
          .from('lead_settings')
          .upsert(r, { onConflict: 'setting_key' });
        if (error) throw error;
      }
      toast({
        title: 'Weekend roster saved',
        description: `Sunday roster: ${sundayIds.length} agent${sundayIds.length === 1 ? '' : 's'}. Saturday roster: ${saturday.size} agent${saturday.size === 1 ? '' : 's'}.`,
      });
      setDirty(false);
    } catch (e: any) {
      toast({
        title: 'Could not save weekend roster',
        description: e?.message ?? 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const renderRosterList = (
    checkedSet: Set<string>,
    onToggle: (id: string, on: boolean) => void,
  ) => (
    <div className="max-h-52 overflow-y-auto rounded-md border border-border bg-background divide-y divide-border">
      {loading && <div className="px-3 py-2 text-xs text-muted-foreground">Loading…</div>}
      {!loading && agents.length === 0 && (
        <div className="px-3 py-2 text-xs text-muted-foreground">No active agents.</div>
      )}
      {agents.map((a) => {
        const checked = checkedSet.has(a.id);
        return (
          <label
            key={a.id}
            className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-muted/40"
          >
            <Checkbox
              checked={checked}
              onCheckedChange={(v) => onToggle(a.id, v === true)}
            />
            <span className="flex-1 min-w-0 truncate">
              {displayName(a)}
              <span className="ml-1 text-xs text-muted-foreground">· {a.role}</span>
            </span>
          </label>
        );
      })}
    </div>
  );

  return (
    <section className="rounded-lg border border-border bg-card shadow-sm">
      <div className="px-5 py-4 flex items-start gap-2 border-b border-border">
        <CalendarDays className="h-4 w-4 text-primary shrink-0 mt-0.5" />
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold text-foreground">Weekend Roster</h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            Tick who covers Saturdays and who's working Sundays. Staff come and go,
            so change this whenever the schedule shifts — takes effect immediately,
            no deploy needed.
          </p>
        </div>
      </div>

      <div className="px-5 py-4 grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* SUNDAY */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Sunrise className="h-3.5 w-3.5 text-amber-600" />
            <h4 className="text-sm font-semibold text-foreground">Sunday — working agents</h4>
          </div>
          <p className="text-xs text-muted-foreground">
            New Sunday leads round-robin among the ticked agents (bypassing daily caps).
            If nobody's ticked or all ticked agents are inactive, leads park in the
            Open Pool and are flagged so managers see coverage is off.
          </p>
          {renderRosterList(sunday, toggleSunday)}
          <div className="text-xs text-muted-foreground">
            {sunday.size} agent{sunday.size === 1 ? '' : 's'} working Sunday.
          </div>
        </div>

        {/* SATURDAY */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-3.5 w-3.5 text-primary" />
            <h4 className="text-sm font-semibold text-foreground">Saturday — rostered agents</h4>
          </div>
          <p className="text-xs text-muted-foreground">
            All Saturday leads go straight to the Open Pool for self-serve. Tick who's
            rostered so managers can see planned coverage. Anyone active can still
            grab leads; this list is for planning.
          </p>
          {renderRosterList(saturday, toggleSaturday)}
          <div className="text-xs text-muted-foreground">
            {saturday.size} agent{saturday.size === 1 ? '' : 's'} rostered for Saturday.
          </div>
        </div>
      </div>

      <div className="px-5 pb-4 flex items-center justify-between gap-3">
        <p className="text-[11px] text-muted-foreground leading-snug">
          Weekend mode triggers automatically by UK day of week. Saturday recycles at
          10 min (caps overridden); Sunday recycling is off — the Sunday roster owns
          the day.
        </p>
        <Button onClick={onSave} disabled={saving || !dirty || loading} className="gap-1.5 h-9">
          <Save className="h-3.5 w-3.5" />
          {saving ? 'Saving…' : 'Save roster'}
        </Button>
      </div>
    </section>
  );
};

export default WeekendRosterCard;
