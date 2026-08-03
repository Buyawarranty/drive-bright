import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type TeamColor = 'red' | 'blue' | 'green' | 'slate';

export interface AgentTeam {
  id: string;
  name: string;
  color: TeamColor;
}

export interface AgentWorkstreams {
  new_leads: boolean;
  recontact: boolean;
  renewals: boolean;
}

const colorFromName = (name: string): TeamColor => {
  const n = name.toLowerCase();
  if (n.includes('red')) return 'red';
  if (n.includes('blue')) return 'blue';
  if (n.includes('green')) return 'green';
  return 'slate';
};

export const TEAM_COLOR_CLASSES: Record<TeamColor, { dot: string; pill: string; ring: string; text: string }> = {
  red:   { dot: 'bg-red-500',   pill: 'bg-red-100 text-red-800 border-red-300',     ring: 'ring-red-400',   text: 'text-red-700' },
  blue:  { dot: 'bg-blue-500',  pill: 'bg-blue-100 text-blue-800 border-blue-300',  ring: 'ring-blue-400',  text: 'text-blue-700' },
  green: { dot: 'bg-emerald-500', pill: 'bg-emerald-100 text-emerald-800 border-emerald-300', ring: 'ring-emerald-400', text: 'text-emerald-700' },
  slate: { dot: 'bg-slate-400', pill: 'bg-slate-100 text-slate-700 border-slate-300', ring: 'ring-slate-400', text: 'text-slate-600' },
};

/**
 * Reads lead_teams + lead_team_members and returns:
 *  - byAgent: admin_user_id -> team (badge lookup)
 *  - workstreamsByAgent: admin_user_id -> which queues the agent works
 *  - allTeams: full list, for filter chips
 */
export interface TeamMemberLite {
  admin_user_id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  role: string | null;
}

export function useAgentTeams() {
  const [byAgent, setByAgent] = useState<Map<string, AgentTeam>>(new Map());
  const [workstreamsByAgent, setWorkstreamsByAgent] = useState<Map<string, AgentWorkstreams>>(new Map());
  const [allTeams, setAllTeams] = useState<AgentTeam[]>([]);
  const [membersByTeam, setMembersByTeam] = useState<Map<string, TeamMemberLite[]>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const [{ data: teams }, { data: members }, { data: admins }] = await Promise.all([
        supabase.from('lead_teams').select('id, name, is_active').eq('is_active', true),
        supabase
          .from('lead_team_members')
          .select('team_id, admin_user_id, workstream_new_leads, workstream_recontact, workstream_renewals'),
        supabase
          .from('admin_users')
          .select('id, first_name, last_name, email, role, is_active')
          .eq('is_active', true),
      ]);
      if (cancelled) return;
      const teamList: AgentTeam[] = (teams || []).map(t => ({
        id: t.id, name: t.name, color: colorFromName(t.name),
      }));
      const adminMap = new Map<string, any>();
      for (const a of (admins || []) as any[]) adminMap.set(a.id, a);
      const map = new Map<string, AgentTeam>();
      const wsMap = new Map<string, AgentWorkstreams>();
      const teamMembers = new Map<string, TeamMemberLite[]>();
      for (const m of (members || []) as any[]) {
        const team = teamList.find(t => t.id === m.team_id);
        if (team && m.admin_user_id) {
          map.set(m.admin_user_id, team);
          wsMap.set(m.admin_user_id, {
            new_leads: m.workstream_new_leads === true,
            recontact: m.workstream_recontact === true,
            renewals: m.workstream_renewals === true,
          });
          const admin = adminMap.get(m.admin_user_id);
          if (admin) {
            const list = teamMembers.get(team.id) ?? [];
            list.push({
              admin_user_id: m.admin_user_id,
              first_name: admin.first_name,
              last_name: admin.last_name,
              email: admin.email,
              role: admin.role ?? null,
            });
            teamMembers.set(team.id, list);
          }
        }
      }
      // sort each team's members by first name
      teamMembers.forEach((list) => {
        list.sort((a, b) => (a.first_name || a.email).localeCompare(b.first_name || b.email));
      });
      setAllTeams(teamList);
      setByAgent(map);
      setWorkstreamsByAgent(wsMap);
      setMembersByTeam(teamMembers);
      setLoading(false);
    };
    load();
    return () => { cancelled = true; };
  }, []);

  return { byAgent, workstreamsByAgent, allTeams, membersByTeam, loading };
}

