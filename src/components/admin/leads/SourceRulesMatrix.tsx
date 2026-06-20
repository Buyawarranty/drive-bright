import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowUp, ArrowDown, X, LayoutGrid, Plus } from 'lucide-react';
import { LEAD_SOURCES } from './LeadRoutingDialog';

interface Team {
  id: string;
  name: string;
  color: string;
  emoji: string | null;
}

interface SourceRule {
  id: string;
  team_id: string;
  source: string;
  allowed: boolean;
  priority: number;
}

interface Props {
  teams: Team[];
  rules: SourceRule[];
  canEdit: boolean;
  routingEnabled: boolean;
  /** Toggle whether a team is in the running for this source. */
  onSetAllowed: (teamId: string, source: string, allowed: boolean) => void;
  /** Change a team's priority for this source (lower = picked first). */
  onSetPriority: (teamId: string, source: string, priority: number) => void;
}

export const SourceRulesMatrix = ({ teams, rules, canEdit, routingEnabled, onSetAllowed, onSetPriority }: Props) => {
  if (!teams.length) return null;

  // Allowed teams for a source, sorted by priority asc (lowest = first pick).
  const orderedTeams = (source: string) => {
    const allowed = rules
      .filter(r => r.source === source && r.allowed)
      .map(r => ({ team: teams.find(t => t.id === r.team_id), priority: r.priority ?? 0 }))
      .filter((x): x is { team: Team; priority: number } => Boolean(x.team));
    return allowed.sort((a, b) => a.priority - b.priority || a.team.name.localeCompare(b.team.name));
  };

  const unallowedTeams = (source: string) => {
    const allowedIds = new Set(rules.filter(r => r.source === source && r.allowed).map(r => r.team_id));
    return teams.filter(t => !allowedIds.has(t.id));
  };

  // Move a team up or down in the priority list by swapping priority numbers.
  const move = (source: string, teamId: string, dir: -1 | 1) => {
    const ordered = orderedTeams(source);
    const idx = ordered.findIndex(o => o.team.id === teamId);
    const swapIdx = idx + dir;
    if (idx < 0 || swapIdx < 0 || swapIdx >= ordered.length) return;
    // Normalise so priorities are 1..N before swap, then swap the two.
    const normalised = ordered.map((o, i) => ({ ...o, priority: i + 1 }));
    const a = normalised[idx];
    const b = normalised[swapIdx];
    onSetPriority(a.team.id, source, b.priority);
    onSetPriority(b.team.id, source, a.priority);
    // Push any others that drifted back to their normalised index.
    normalised.forEach((o, i) => {
      if (o.team.id !== a.team.id && o.team.id !== b.team.id) {
        onSetPriority(o.team.id, source, i + 1);
      }
    });
  };

  const addTeam = (source: string, teamId: string) => {
    const nextPriority = orderedTeams(source).length + 1;
    onSetAllowed(teamId, source, true);
    onSetPriority(teamId, source, nextPriority);
  };

  return (
    <div className="border-2 border-foreground bg-background">
      <div className="px-4 py-2.5 border-b-2 border-foreground bg-muted flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <LayoutGrid className="h-4 w-4" />
          <span className="text-xs font-bold uppercase tracking-wide">Which team gets each source first</span>
          {!routingEnabled && (
            <span className="ml-1 px-2 py-0.5 text-[10px] font-bold uppercase border-2 border-amber-600 text-amber-800 bg-amber-50">
              Preview · Master OFF
            </span>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground hidden md:block">
          Leftmost team is tried first. If no agent is available, the next team is tried.
        </p>
      </div>
      <div className="divide-y-2 divide-foreground/10">
        {LEAD_SOURCES.map(s => {
          const ordered = orderedTeams(s.value);
          const unallowed = unallowedTeams(s.value);
          return (
            <div key={s.value} className="px-4 py-3 flex flex-wrap items-center gap-3 hover:bg-muted/30">
              <div className="flex items-center gap-2 min-w-[180px]">
                <span className="text-base">{s.icon}</span>
                <span className="font-semibold text-sm">{s.label}</span>
              </div>

              <div className="flex flex-wrap items-center gap-2 flex-1">
                {ordered.length === 0 && (
                  <span className="text-xs text-muted-foreground italic">
                    No team — falls back to the live global flow.
                  </span>
                )}
                {ordered.map(({ team }, i) => (
                  <div
                    key={team.id}
                    className="inline-flex items-center gap-1 px-2 py-1 text-xs font-bold text-white border-2 border-foreground"
                    style={{ backgroundColor: team.color }}
                    title={`${i === 0 ? '1st pick' : `${i + 1}${['st','nd','rd'][i] || 'th'} pick`}`}
                  >
                    <span className="bg-white/20 px-1.5 py-0.5 rounded-sm text-[10px] tabular-nums">
                      #{i + 1}
                    </span>
                    <span>{team.emoji} {team.name}</span>
                    {canEdit && (
                      <>
                        <button
                          type="button"
                          onClick={() => move(s.value, team.id, -1)}
                          disabled={i === 0}
                          className="ml-1 p-0.5 hover:bg-white/20 disabled:opacity-30"
                          title="Move up (higher priority)"
                        >
                          <ArrowUp className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => move(s.value, team.id, 1)}
                          disabled={i === ordered.length - 1}
                          className="p-0.5 hover:bg-white/20 disabled:opacity-30"
                          title="Move down (lower priority)"
                        >
                          <ArrowDown className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onSetAllowed(team.id, s.value, false)}
                          className="p-0.5 hover:bg-white/20"
                          title="Remove team from this source"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </>
                    )}
                  </div>
                ))}
              </div>

              {canEdit && unallowed.length > 0 && (
                <Select onValueChange={(v) => addTeam(s.value, v)} value="">
                  <SelectTrigger className="h-8 w-[160px] text-xs shrink-0">
                    <SelectValue placeholder={
                      <span className="inline-flex items-center gap-1">
                        <Plus className="h-3 w-3" /> Add team
                      </span>
                    } />
                  </SelectTrigger>
                  <SelectContent>
                    {unallowed.map(t => (
                      <SelectItem key={t.id} value={t.id} className="text-xs">
                        {t.emoji} {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
