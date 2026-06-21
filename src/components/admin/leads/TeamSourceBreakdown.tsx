import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { TEAM_COLOR_CLASSES, type AgentTeam } from '@/hooks/useAgentTeams';
import { cn } from '@/lib/utils';
import { Activity, AlertCircle, CalendarDays } from 'lucide-react';

/**
 * Per-team lead-source breakdown for the last 24 hours.
 * Lets managers see at a glance: "Team Red got 12 Google + 4 Facebook today,
 * Team Blue got 0 — is routing actually working?"
 */
interface Props {
  teams: AgentTeam[];
  /** admin_user_id -> team */
  agentTeamMap: Map<string, AgentTeam>;
}

interface SourceCount {
  source: string;
  count: number;
}

interface TeamStats {
  team: AgentTeam | null; // null = unassigned bucket
  total: number;
  bySource: SourceCount[];
  lastAt: Date | null;
}

// Friendly label + emoji for each raw `lead_source` value stored on sales_leads.
const SOURCE_META: Record<string, { label: string; icon: string }> = {
  google_ad:   { label: 'Google',    icon: '🟡' },
  google:      { label: 'Google',    icon: '🟡' },
  social_ad:   { label: 'Facebook',  icon: '🔷' },
  facebook:    { label: 'Facebook',  icon: '🔷' },
  instagram:   { label: 'Instagram', icon: '🟣' },
  tiktok:      { label: 'TikTok',    icon: '⚫' },
  youtube:     { label: 'YouTube',   icon: '🔺' },
  organic:     { label: 'Organic',   icon: '🌱' },
  website:     { label: 'Website',   icon: '⭐' },
  direct:      { label: 'Direct',    icon: '⭐' },
  referral:    { label: 'Referral',  icon: '🔗' },
  email:       { label: 'Email',     icon: '✉️' },
  sms:         { label: 'SMS',       icon: '💬' },
};
const sourceMeta = (s: string) =>
  SOURCE_META[s] || { label: s.replace(/_/g, ' '), icon: '❔' };

const formatAgo = (d: Date | null) => {
  if (!d) return 'no leads yet';
  const mins = Math.floor((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ago`;
};

const formatRange = (from: Date, to: Date) => {
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
  const sameDay = from.toDateString() === to.toDateString();
  if (sameDay) return from.toLocaleDateString('en-GB', { ...opts, year: 'numeric' });
  return `${from.toLocaleDateString('en-GB', opts)} – ${to.toLocaleDateString('en-GB', { ...opts, year: 'numeric' })}`;
};

export const TeamSourceBreakdown = ({ teams, agentTeamMap }: Props) => {
  const [stats, setStats] = useState<TeamStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [, setTick] = useState(0); // re-render to refresh "X mins ago" text

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from('sales_leads')
        .select('assigned_to, lead_source, created_at')
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(2000);
      if (cancelled) return;
      if (error || !data) { setLoading(false); return; }

      // Bucket by team (unassigned -> null bucket).
      const buckets = new Map<string, TeamStats>();
      const ensure = (key: string, team: AgentTeam | null) => {
        if (!buckets.has(key)) buckets.set(key, { team, total: 0, bySource: [], lastAt: null });
        return buckets.get(key)!;
      };
      teams.forEach(t => ensure(t.id, t));
      ensure('__none__', null);

      for (const row of data as any[]) {
        const team = row.assigned_to ? agentTeamMap.get(row.assigned_to) || null : null;
        const key = team ? team.id : '__none__';
        const b = ensure(key, team);
        b.total += 1;
        const src = row.lead_source || 'other';
        const existing = b.bySource.find(s => s.source === src);
        if (existing) existing.count += 1;
        else b.bySource.push({ source: src, count: 1 });
        const ts = new Date(row.created_at);
        if (!b.lastAt || ts > b.lastAt) b.lastAt = ts;
      }

      // Sort sources within each team by count desc.
      buckets.forEach(b => b.bySource.sort((a, z) => z.count - a.count));

      // Order: real teams first (by name), unassigned last and only if it has rows.
      const ordered: TeamStats[] = teams
        .map(t => buckets.get(t.id)!)
        .filter(Boolean);
      const none = buckets.get('__none__');
      if (none && none.total > 0) ordered.push(none);

      setStats(ordered);
      setLoading(false);
    };
    load();
    const refresh = setInterval(load, 60_000);
    const reRender = setInterval(() => setTick(t => t + 1), 30_000);
    return () => { cancelled = true; clearInterval(refresh); clearInterval(reRender); };
  }, [teams, agentTeamMap]);

  if (loading || stats.length === 0) return null;

  const from = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const to = new Date();

  return (
    <div className="w-full mt-2 rounded-lg border border-border bg-muted/20 px-3 py-2">
      <div className="flex items-center gap-2 mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        <Activity className="h-3 w-3" />
        Lead sources per team — last 24h
        <span className="inline-flex items-center gap-1 ml-2 px-1.5 py-0.5 rounded border border-border bg-background text-[10px] font-medium normal-case text-foreground">
          <CalendarDays className="h-3 w-3 text-muted-foreground" />
          {formatRange(from, to)}
        </span>
        <span className="text-[10px] font-normal normal-case text-muted-foreground/70 ml-auto">
          Auto-refreshes every minute
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {stats.map((s, i) => {
          const color = s.team?.color ?? 'slate';
          const cls = TEAM_COLOR_CLASSES[color];
          const isEmpty = s.total === 0;
          const isStale = s.lastAt && Date.now() - s.lastAt.getTime() > 2 * 60 * 60 * 1000;
          return (
            <div
              key={s.team?.id ?? `none-${i}`}
              className={cn(
                'flex items-center gap-2 px-2.5 py-1.5 rounded-md border bg-background',
                cls.pill.replace('bg-', 'border-').split(' ').find(c => c.startsWith('border-')) || 'border-border',
              )}
            >
              <span className={cn('inline-flex items-center gap-1.5 text-xs font-semibold', cls.text)}>
                <span className={cn('h-2 w-2 rounded-full', cls.dot)} />
                {s.team ? s.team.name : 'Unassigned'}
                <span className="text-muted-foreground font-normal">·</span>
                <span className="tabular-nums">{s.total}</span>
              </span>

              {isEmpty ? (
                <span className="inline-flex items-center gap-1 text-[11px] text-amber-700">
                  <AlertCircle className="h-3 w-3" />
                  No leads in 24h
                </span>
              ) : (
                <div className="flex items-center gap-1 flex-wrap">
                  {s.bySource.slice(0, 6).map(src => {
                    const meta = sourceMeta(src.source);
                    return (
                      <span
                        key={src.source}
                        title={`${meta.label}: ${src.count} lead${src.count === 1 ? '' : 's'} in last 24h`}
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-border bg-muted/50 text-[11px]"
                      >
                        <span aria-hidden>{meta.icon}</span>
                        <span className="text-foreground">{meta.label}</span>
                        <span className="tabular-nums font-semibold">{src.count}</span>
                      </span>
                    );
                  })}
                </div>
              )}

              <span className={cn(
                'text-[10px] tabular-nums pl-1 border-l border-border ml-0.5',
                isStale ? 'text-amber-700 font-semibold' : 'text-muted-foreground',
              )}>
                last {formatAgo(s.lastAt)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
