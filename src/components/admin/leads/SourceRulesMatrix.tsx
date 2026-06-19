import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LayoutGrid, Wand2 } from 'lucide-react';
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
  percentage?: number | null;
}

interface Props {
  teams: Team[];
  rules: SourceRule[];
  canEdit: boolean;
  routingEnabled: boolean;
  /** Set the percentage of a source that should be routed to a team (0-100). */
  onSetPercentage: (teamId: string, source: string, percentage: number) => void;
}

export const SourceRulesMatrix = ({ teams, rules, canEdit, routingEnabled, onSetPercentage }: Props) => {
  if (!teams.length) return null;

  const pctOf = (teamId: string, source: string) => {
    const r = rules.find(x => x.team_id === teamId && x.source === source);
    if (!r) return 0;
    // Back-compat: if percentage is missing but allowed was true, treat as 100.
    if (typeof r.percentage === 'number') return r.percentage;
    return r.allowed ? 100 : 0;
  };

  const rowTotal = (source: string) =>
    teams.reduce((sum, t) => sum + pctOf(t.id, source), 0);

  const evenSplit = (source: string) => {
    if (!teams.length) return;
    const each = Math.floor(100 / teams.length);
    const remainder = 100 - each * teams.length;
    teams.forEach((t, i) => {
      onSetPercentage(t.id, source, each + (i === 0 ? remainder : 0));
    });
  };

  const clearRow = (source: string) => {
    teams.forEach(t => onSetPercentage(t.id, source, 0));
  };

  return (
    <div className="border-2 border-foreground bg-background">
      <div className="px-4 py-2.5 border-b-2 border-foreground bg-muted flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <LayoutGrid className="h-4 w-4" />
          <span className="text-xs font-bold uppercase tracking-wide">Source → Team Split</span>
          {!routingEnabled && (
            <span className="ml-1 px-2 py-0.5 text-[10px] font-bold uppercase border-2 border-amber-600 text-amber-800 bg-amber-50">
              Preview · Master OFF
            </span>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground hidden md:block">
          Rows must total <strong>100%</strong> to route fully via teams.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-muted/50 border-b-2 border-foreground/20">
              <th className="text-left text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-3 py-2 sticky left-0 bg-muted/50">
                Source
              </th>
              {teams.map(t => (
                <th key={t.id} className="px-2 py-2 text-center">
                  <span
                    className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-bold uppercase text-white border-2 border-foreground"
                    style={{ backgroundColor: t.color }}
                  >
                    {t.emoji} {t.name}
                  </span>
                </th>
              ))}
              <th className="px-2 py-2 text-center text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Total</th>
              <th className="px-2 py-2 text-right text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Quick</th>
            </tr>
          </thead>
          <tbody className="divide-y-2 divide-foreground/10">
            {LEAD_SOURCES.map(s => {
              const total = rowTotal(s.value);
              const totalClass =
                total === 0
                  ? 'bg-muted text-muted-foreground border-muted-foreground/30'
                  : total === 100
                  ? 'bg-emerald-600 text-white border-emerald-700'
                  : total < 100
                  ? 'bg-amber-500 text-white border-amber-600'
                  : 'bg-red-600 text-white border-red-700';
              return (
                <tr key={s.value} className="hover:bg-muted/30">
                  <td className="px-3 py-2 sticky left-0 bg-background">
                    <span className="inline-flex items-center gap-2">
                      <span className="text-base">{s.icon}</span>
                      <span className="font-semibold text-sm">{s.label}</span>
                    </span>
                  </td>
                  {teams.map(t => {
                    const v = pctOf(t.id, s.value);
                    const isActive = v > 0;
                    return (
                      <td key={t.id} className="px-2 py-2 text-center">
                        <div className="inline-flex items-center">
                          <Input
                            type="number"
                            min={0}
                            max={100}
                            step={5}
                            disabled={!canEdit}
                            value={v}
                            onChange={(e) => {
                              const next = Math.max(0, Math.min(100, parseInt(e.target.value || '0', 10) || 0));
                              onSetPercentage(t.id, s.value, next);
                            }}
                            className={`w-16 h-9 text-center rounded-none border-2 font-bold tabular-nums focus-visible:ring-0 focus-visible:border-foreground ${
                              isActive ? 'border-foreground bg-background' : 'border-muted-foreground/30 text-muted-foreground'
                            }`}
                          />
                          <span className="ml-1 text-xs text-muted-foreground font-semibold">%</span>
                        </div>
                      </td>
                    );
                  })}
                  <td className="px-2 py-2 text-center">
                    <span className={`inline-flex items-center justify-center min-w-[3.25rem] px-2 py-1 text-[11px] font-bold border-2 tabular-nums ${totalClass}`}>
                      {total}%
                    </span>
                  </td>
                  <td className="px-2 py-2 text-right whitespace-nowrap">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 px-2 text-[10px] font-bold uppercase rounded-none border-2 border-foreground mr-1"
                      disabled={!canEdit}
                      onClick={() => evenSplit(s.value)}
                    >
                      <Wand2 className="h-3 w-3 mr-1" /> Even
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-[10px] font-bold uppercase rounded-none"
                      disabled={!canEdit || total === 0}
                      onClick={() => clearRow(s.value)}
                    >
                      Clear
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
