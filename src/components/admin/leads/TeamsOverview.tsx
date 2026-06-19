import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { ChevronDown, ChevronRight, Users, Phone, Mail, Car, Search, AlertCircle, UserX } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { Lead, AdminUser } from '@/hooks/useLeads';

interface Team {
  id: string;
  name: string;
  color: string;
  emoji: string | null;
}

interface Member {
  team_id: string;
  admin_user_id: string;
  workstream_new_leads: boolean;
  workstream_recontact: boolean;
  workstream_renewals: boolean;
}

interface TeamsOverviewProps {
  leads: Lead[];
  salesUsers: AdminUser[];
}

const ACTIVE_STATUSES = new Set(['new', 'contacted', 'follow_up', 'quote_sent', 'negotiating', 'urgent_callback']);

const statusClass = (s: string) => {
  switch (s) {
    case 'new': return 'bg-blue-100 text-blue-800';
    case 'contacted': return 'bg-yellow-100 text-yellow-800';
    case 'follow_up': return 'bg-purple-100 text-purple-800';
    case 'quote_sent': return 'bg-cyan-100 text-cyan-800';
    case 'negotiating': return 'bg-orange-100 text-orange-800';
    case 'urgent_callback': return 'bg-red-100 text-red-800';
    case 'converted': return 'bg-green-100 text-green-800';
    case 'lost': return 'bg-gray-100 text-gray-600';
    default: return 'bg-gray-100 text-gray-700';
  }
};

const UNASSIGNED_KEY = '__unassigned__';
const NO_TEAM_KEY = '__no_team__';

export const TeamsOverview: React.FC<TeamsOverviewProps> = ({ leads, salesUsers }) => {
  const [teams, setTeams] = useState<Team[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [openTeams, setOpenTeams] = useState<Set<string>>(new Set());
  const [openAgents, setOpenAgents] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [t, m] = await Promise.all([
        supabase.from('lead_teams').select('id,name,color,emoji,is_active,sort_order').eq('is_active', true).order('sort_order'),
        supabase.from('lead_team_members').select('team_id,admin_user_id,workstream_new_leads,workstream_recontact,workstream_renewals'),
      ]);
      if (cancelled) return;
      setTeams((t.data || []) as Team[]);
      setMembers((m.data || []) as Member[]);
      // Default: all teams open
      setOpenTeams(new Set([...(t.data || []).map((x: any) => x.id), NO_TEAM_KEY, UNASSIGNED_KEY]));
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const agentToTeam = useMemo(() => {
    const map = new Map<string, string>();
    members.forEach(m => map.set(m.admin_user_id, m.team_id));
    return map;
  }, [members]);

  // Group leads by agent
  const leadsByAgent = useMemo(() => {
    const map = new Map<string, Lead[]>();
    for (const l of leads) {
      const key = l.assigned_to ?? UNASSIGNED_KEY;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(l);
    }
    return map;
  }, [leads]);

  const teamGroups = useMemo(() => {
    const sBy = (id: string) => salesUsers.find(u => u.id === id);
    const groups: Array<{
      team: Team | null;
      key: string;
      label: string;
      color: string;
      emoji: string | null;
      agents: Array<{ id: string; name: string; email: string; leads: Lead[] }>;
    }> = [];

    for (const t of teams) {
      const agentIds = members.filter(m => m.team_id === t.id).map(m => m.admin_user_id);
      const agents = agentIds.map(id => {
        const u = sBy(id);
        const name = u ? (`${u.first_name ?? ''} ${u.last_name ?? ''}`.trim() || u.email) : 'Unknown';
        return { id, name, email: u?.email ?? '', leads: leadsByAgent.get(id) ?? [] };
      }).sort((a, b) => b.leads.length - a.leads.length);
      groups.push({ team: t, key: t.id, label: t.name, color: t.color, emoji: t.emoji, agents });
    }

    // Sales agents with no team
    const teamed = new Set(members.map(m => m.admin_user_id));
    const orphanAgents = salesUsers
      .filter(u => !teamed.has(u.id) && (u as any).is_active !== false)
      .map(u => ({
        id: u.id,
        name: (`${u.first_name ?? ''} ${u.last_name ?? ''}`.trim() || u.email),
        email: u.email,
        leads: leadsByAgent.get(u.id) ?? [],
      }))
      .filter(a => a.leads.length > 0 || true) // keep all
      .sort((a, b) => b.leads.length - a.leads.length);
    if (orphanAgents.length) {
      groups.push({
        team: null, key: NO_TEAM_KEY, label: 'No team assigned',
        color: '#94a3b8', emoji: '⚠️', agents: orphanAgents,
      });
    }

    // Unassigned leads (no owner at all)
    const unassigned = leadsByAgent.get(UNASSIGNED_KEY) ?? [];
    if (unassigned.length) {
      groups.push({
        team: null, key: UNASSIGNED_KEY, label: 'Unassigned leads',
        color: '#f59e0b', emoji: '📥',
        agents: [{ id: UNASSIGNED_KEY, name: 'Nobody yet', email: '', leads: unassigned }],
      });
    }

    return groups;
  }, [teams, members, salesUsers, leadsByAgent]);

  // Search filter — match across agent name, lead name/email/reg
  const q = search.trim().toLowerCase();
  const matchLead = (l: Lead) => !q || [
    l.first_name, l.last_name, l.full_name, l.email, l.phone, l.vehicle_reg, l.vehicle_make, l.vehicle_model,
  ].some(v => v && String(v).toLowerCase().includes(q));

  const toggle = (set: Set<string>, key: string, setter: (s: Set<string>) => void) => {
    const next = new Set(set);
    next.has(key) ? next.delete(key) : next.add(key);
    setter(next);
  };

  if (loading) return <div className="p-8 text-center text-sm text-muted-foreground">Loading teams…</div>;

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Users className="h-5 w-5" /> Teams overview
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Every team, every agent in it, and the live leads currently on their plate.
          </p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search agent, name, email, reg…"
            className="pl-8 h-9"
          />
        </div>
      </div>

      {teamGroups.map(g => {
        const teamOpen = openTeams.has(g.key);
        const totalLeads = g.agents.reduce((sum, a) => sum + a.leads.filter(matchLead).length, 0);
        const activeLeads = g.agents.reduce(
          (sum, a) => sum + a.leads.filter(l => matchLead(l) && ACTIVE_STATUSES.has(l.status)).length, 0
        );

        return (
          <Card key={g.key} className="overflow-hidden">
            <CardHeader
              className="py-3 cursor-pointer select-none"
              style={{ backgroundColor: `${g.color}15`, borderBottom: `2px solid ${g.color}` }}
              onClick={() => toggle(openTeams, g.key, setOpenTeams)}
            >
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  {teamOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  <span
                    className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-white text-sm font-semibold"
                    style={{ backgroundColor: g.color }}
                  >
                    {g.emoji} {g.label}
                  </span>
                  <Badge variant="outline" className="text-[11px]">{g.agents.length} agent{g.agents.length === 1 ? '' : 's'}</Badge>
                  {g.key === NO_TEAM_KEY && (
                    <span className="text-[11px] text-amber-700 inline-flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" /> Receiving leads but not in any team
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <Badge variant="secondary" className="font-mono">{activeLeads} live</Badge>
                  <Badge variant="outline" className="font-mono">{totalLeads} total</Badge>
                </div>
              </div>
            </CardHeader>

            {teamOpen && (
              <CardContent className="p-0">
                {g.agents.length === 0 ? (
                  <div className="px-4 py-6 text-center text-sm text-muted-foreground inline-flex items-center gap-2 w-full justify-center">
                    <UserX className="h-4 w-4" /> No agents in this team yet
                  </div>
                ) : (
                  <div className="divide-y">
                    {g.agents.map(a => {
                      const visibleLeads = a.leads.filter(matchLead);
                      const liveCount = visibleLeads.filter(l => ACTIVE_STATUSES.has(l.status)).length;
                      const wonCount = visibleLeads.filter(l => l.status === 'converted').length;
                      const lostCount = visibleLeads.filter(l => l.status === 'lost').length;
                      const isOpen = openAgents.has(`${g.key}:${a.id}`);

                      return (
                        <Collapsible key={a.id} open={isOpen} onOpenChange={() =>
                          toggle(openAgents, `${g.key}:${a.id}`, setOpenAgents)
                        }>
                          <CollapsibleTrigger asChild>
                            <button className="w-full text-left px-4 py-2.5 hover:bg-muted/50 transition flex items-center gap-3">
                              {isOpen ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
                              <div
                                className="h-7 w-7 shrink-0 rounded-full text-white text-xs font-semibold inline-flex items-center justify-center"
                                style={{ backgroundColor: g.color }}
                              >
                                {a.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase() || '?'}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="text-sm font-medium truncate">{a.name}</div>
                                {a.email && <div className="text-xs text-muted-foreground truncate">{a.email}</div>}
                              </div>
                              <div className="flex items-center gap-1.5 text-[11px]">
                                <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">{liveCount} live</Badge>
                                <Badge className="bg-green-100 text-green-800 hover:bg-green-100">{wonCount} won</Badge>
                                <Badge variant="outline">{lostCount} lost</Badge>
                                <Badge variant="secondary" className="font-mono">{visibleLeads.length}</Badge>
                              </div>
                            </button>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <div className="px-4 pb-3">
                              {visibleLeads.length === 0 ? (
                                <div className="text-xs text-muted-foreground py-3">No leads in current view.</div>
                              ) : (
                                <div className="border rounded-md divide-y bg-background">
                                  {visibleLeads.slice(0, 100).map(l => (
                                    <div key={l.id} className="px-3 py-2 text-xs flex items-center gap-3 flex-wrap">
                                      <Badge className={`${statusClass(l.status)} hover:${statusClass(l.status)} text-[10px] shrink-0`}>
                                        {l.status.replace('_', ' ')}
                                      </Badge>
                                      <span className="font-medium truncate max-w-[180px]">
                                        {l.full_name || `${l.first_name ?? ''} ${l.last_name ?? ''}`.trim() || '—'}
                                      </span>
                                      {l.email && (
                                        <span className="inline-flex items-center gap-1 text-muted-foreground truncate max-w-[200px]">
                                          <Mail className="h-3 w-3" />{l.email}
                                        </span>
                                      )}
                                      {l.phone && (
                                        <span className="inline-flex items-center gap-1 text-muted-foreground">
                                          <Phone className="h-3 w-3" />{l.phone}
                                        </span>
                                      )}
                                      {l.vehicle_reg && (
                                        <span className="inline-flex items-center gap-1 font-mono uppercase">
                                          <Car className="h-3 w-3" />{l.vehicle_reg}
                                        </span>
                                      )}
                                      <span className="ml-auto text-muted-foreground">
                                        {formatDistanceToNow(new Date(l.last_activity_date || l.created_at), { addSuffix: true })}
                                      </span>
                                    </div>
                                  ))}
                                  {visibleLeads.length > 100 && (
                                    <div className="px-3 py-2 text-[11px] text-muted-foreground text-center">
                                      Showing first 100 of {visibleLeads.length}. Use search to narrow.
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </CollapsibleContent>
                        </Collapsible>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            )}
          </Card>
        );
      })}

      {teamGroups.length === 0 && (
        <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">No teams configured yet.</CardContent></Card>
      )}
    </div>
  );
};

export default TeamsOverview;
