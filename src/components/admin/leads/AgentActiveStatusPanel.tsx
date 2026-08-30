import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Loader2, Power, ShieldOff, ArrowRightLeft, Database, CalendarOff, X } from 'lucide-react';
import { toast } from 'sonner';

type Staff = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  role: string;
  is_active: boolean;
  archived_at: string | null;
};

const SALES_ROLES = new Set([
  'sales', 'sales_agent', 'sales_lead', 'sales_manager', 'lead_gen', 'performance_manager',
]);

const nameOf = (s: Staff) =>
  [s.first_name, s.last_name].filter(Boolean).join(' ').trim() || s.email;

const initialsOf = (s: Staff) => {
  const n = nameOf(s);
  return n.split(' ').filter(Boolean).slice(0, 2).map(p => p[0]?.toUpperCase()).join('') || '?';
};

/**
 * Agent on/off switch for lead allocation + login access.
 *
 * Switching an agent OFF sets admin_users.is_active = false, which:
 *  - blocks their staff login and revokes their tab permissions,
 *  - pauses their distribution cap and clears every workstream flag
 *    (DB trigger trg_deactivated_agent_leaves_distribution),
 *  - hides them from New Leads / Allocation agent lists.
 * All of their leads, notes, calls and history are kept, so their work can be
 * redistributed from Agent Offboarding below.
 */
export const AgentActiveStatusPanel: React.FC = () => {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [pending, setPending] = useState<Staff | null>(null);
  const [leadCounts, setLeadCounts] = useState<Record<string, number>>({});
  const [leave, setLeave] = useState<LeavePeriod[]>([]);
  const [leaveDraft, setLeaveDraft] = useState<Record<string, LeaveDraft>>({});
  const [savingLeaveFor, setSavingLeaveFor] = useState<string | null>(null);

  const loadLeave = useCallback(async () => {
    const { data } = await (supabase.from('agent_leave_periods') as any)
      .select('id, admin_user_id, start_date, end_date, leave_type')
      .gte('end_date', todayIso)
      .order('start_date');
    setLeave((data || []) as LeavePeriod[]);
  }, []);

  const load = useCallback(async () => {
    const { data } = await (supabase.from('admin_users') as any)
      .select('id, first_name, last_name, email, role, is_active, archived_at')
      .order('first_name');
    const rows = ((data || []) as Staff[]).filter(s => SALES_ROLES.has(s.role));
    setStaff(rows);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const active = useMemo(() => staff.filter(s => s.is_active && !s.archived_at), [staff]);
  const departed = useMemo(() => staff.filter(s => !s.is_active || s.archived_at), [staff]);

  // Lead counts for departed agents so managers can see there is work to move.
  useEffect(() => {
    if (departed.length === 0) return;
    let cancelled = false;
    (async () => {
      const entries = await Promise.all(
        departed.map(async (s) => {
          const { count } = await (supabase.from('sales_leads') as any)
            .select('id', { count: 'exact', head: true })
            .eq('assigned_to', s.id);
          return [s.id, count ?? 0] as const;
        }),
      );
      if (!cancelled) setLeadCounts(Object.fromEntries(entries));
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [departed.map(d => d.id).join(',')]);

  const applyToggle = async (agent: Staff, on: boolean) => {
    setSavingId(agent.id);
    const { error } = await (supabase.from('admin_users') as any)
      .update({ is_active: on })
      .eq('id', agent.id);
    setSavingId(null);
    if (error) {
      toast.error(`Could not update ${nameOf(agent)} — ${error.message}`);
      return;
    }
    setStaff(prev => prev.map(s => (s.id === agent.id ? { ...s, is_active: on } : s)));
    toast.success(
      on
        ? `${nameOf(agent)} switched on — login restored. Turn their lead types back on in Allocation.`
        : `${nameOf(agent)} switched off — login blocked, permissions revoked and taken out of lead distribution. Their leads and notes are kept.`,
    );
    load();
  };

  const scrollToOffboarding = () => {
    const el = document.getElementById('agent-offboarding');
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const addLeave = async (agent: Staff) => {
    const draft = leaveDraft[agent.id];
    if (!draft?.start || !draft?.end) {
      toast.error('Pick a start and end date for the leave.');
      return;
    }
    if (draft.end < draft.start) {
      toast.error('The end date must be on or after the start date.');
      return;
    }
    setSavingLeaveFor(agent.id);
    const { error } = await (supabase.from('agent_leave_periods') as any).insert({
      admin_user_id: agent.id,
      start_date: draft.start,
      end_date: draft.end,
      leave_type: draft.type || 'holiday',
    });
    setSavingLeaveFor(null);
    if (error) {
      toast.error(`Could not save the leave — ${error.message}`);
      return;
    }
    setLeaveDraft(prev => ({ ...prev, [agent.id]: { start: '', end: '', type: 'holiday' } }));
    toast.success(`${nameOf(agent)} gets no new leads from ${draft.start} to ${draft.end}.`);
    loadLeave();
  };

  const removeLeave = async (id: string) => {
    const { error } = await (supabase.from('agent_leave_periods') as any).delete().eq('id', id);
    if (error) {
      toast.error(`Could not remove the leave — ${error.message}`);
      return;
    }
    setLeave(prev => prev.filter(l => l.id !== id));
    toast.success('Leave removed — they are back in the rotation for those dates.');
  };

  return (
    <Card className="border-2">
      <CardContent className="p-4 space-y-5">
        <div className="flex items-start gap-2">
          <Power className="h-5 w-5 text-primary shrink-0 mt-0.5" />
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-foreground">Agents on and off</h3>
            <p className="text-xs text-muted-foreground">
              One switch per agent, plus holiday and leave dates. Off blocks their staff login, revokes
              their tab permissions and takes them out of lead distribution straight away. Booked leave
              stops new leads for those dates only and puts them back automatically afterwards. Nothing is
              deleted — every lead, note, call and target stays on record so their work can be
              redistributed below.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading agents…
          </div>
        ) : (
          <>
            <div className="space-y-2">
              {active.length === 0 && (
                <div className="text-sm text-muted-foreground">No active sales agents.</div>
              )}
              {active.map(s => {
                const mine = leave.filter(l => l.admin_user_id === s.id);
                const onLeaveNow = mine.find(l => l.start_date <= todayIso && l.end_date >= todayIso);
                const draft = leaveDraft[s.id] || { start: '', end: '', type: 'holiday' };
                return (
                  <div key={s.id} className="rounded-lg border p-2.5 space-y-2">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="text-xs bg-primary/10 text-primary">{initialsOf(s)}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{nameOf(s)}</p>
                        <p className="text-xs text-muted-foreground truncate">{s.email} · {s.role}</p>
                      </div>
                      {onLeaveNow ? (
                        <Badge variant="outline" className="text-[10px] border-amber-500/50 text-amber-600">
                          On leave to {onLeaveNow.end_date}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] border-emerald-500/40 text-emerald-600">On</Badge>
                      )}
                      {savingId === s.id
                        ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        : <Switch checked onCheckedChange={() => setPending(s)} />}
                    </div>

                    <div className="pl-11 space-y-2">
                      {mine.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {mine.map(l => (
                            <span
                              key={l.id}
                              className="inline-flex items-center gap-1 rounded-md border border-amber-500/40 bg-amber-500/5 px-2 py-0.5 text-[11px] text-amber-700"
                            >
                              <CalendarOff className="h-3 w-3" />
                              {l.leave_type} · {l.start_date} → {l.end_date}
                              <button
                                type="button"
                                aria-label="Remove leave"
                                className="ml-0.5 hover:text-destructive"
                                onClick={() => removeLeave(l.id)}
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[11px] text-muted-foreground">No leads from</span>
                        <Input
                          type="date"
                          value={draft.start}
                          onChange={(e) => setLeaveDraft(p => ({ ...p, [s.id]: { ...draft, start: e.target.value } }))}
                          className="h-7 w-[140px] text-xs"
                        />
                        <span className="text-[11px] text-muted-foreground">to</span>
                        <Input
                          type="date"
                          value={draft.end}
                          onChange={(e) => setLeaveDraft(p => ({ ...p, [s.id]: { ...draft, end: e.target.value } }))}
                          className="h-7 w-[140px] text-xs"
                        />
                        <Select
                          value={draft.type}
                          onValueChange={(v) => setLeaveDraft(p => ({ ...p, [s.id]: { ...draft, type: v } }))}
                        >
                          <SelectTrigger className="h-7 w-[120px] text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {LEAVE_TYPES.map(t => (
                              <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          disabled={savingLeaveFor === s.id}
                          onClick={() => addLeave(s)}
                        >
                          {savingLeaveFor === s.id
                            ? <Loader2 className="h-3 w-3 animate-spin" />
                            : <>Add leave</>}
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>


            <div className="space-y-2 pt-2 border-t">
              <div className="flex items-start gap-2">
                <Database className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <h4 className="text-sm font-semibold text-foreground">
                    Switched off or left the business — data kept
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    These agents can no longer log in and receive no leads. Their history is stored, so use
                    Agent Offboarding to hand their leads to other agents (fully reversible).
                  </p>
                </div>
              </div>

              {departed.length === 0 ? (
                <div className="text-xs text-muted-foreground">Nobody is switched off.</div>
              ) : (
                departed.map(s => (
                  <div key={s.id} className="flex items-center gap-3 rounded-lg border border-dashed p-2.5 bg-muted/30">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="text-xs bg-muted text-muted-foreground">{initialsOf(s)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{nameOf(s)}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {s.email} · {s.role}
                        {leadCounts[s.id] !== undefined && ` · ${leadCounts[s.id]} lead${leadCounts[s.id] === 1 ? '' : 's'} still on their name`}
                      </p>
                    </div>
                    {s.archived_at
                      ? <Badge variant="outline" className="text-[10px]">Deleted · history kept</Badge>
                      : <Badge variant="outline" className="text-[10px] border-destructive/40 text-destructive">Off</Badge>}
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={scrollToOffboarding}>
                      <ArrowRightLeft className="h-3 w-3 mr-1" /> Redistribute leads
                    </Button>
                    {!s.archived_at && (
                      savingId === s.id
                        ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        : <Switch checked={false} onCheckedChange={() => applyToggle(s, true)} />
                    )}
                  </div>
                ))
              )}
            </div>
          </>
        )}

        <AlertDialog open={!!pending} onOpenChange={(o) => !o && setPending(null)}>
          <AlertDialogContent className="max-w-sm">
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <ShieldOff className="h-4 w-4 text-destructive" />
                Switch {pending ? nameOf(pending) : ''} off?
              </AlertDialogTitle>
              <AlertDialogDescription className="text-xs space-y-2">
                <span className="block">They stop receiving leads immediately and their staff login and tab permissions are switched off.</span>
                <span className="block">All their leads, notes, calls and figures are kept — redistribute them from Agent Offboarding.</span>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => { if (pending) { const a = pending; setPending(null); applyToggle(a, false); } }}
              >
                Switch off
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
};
