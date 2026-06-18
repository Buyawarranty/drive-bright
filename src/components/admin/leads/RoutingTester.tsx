import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FlaskConical, CheckCircle2, AlertCircle, ArrowRight } from 'lucide-react';

const SOURCES = [
  'google_ads', 'facebook_ads', 'instagram', 'tiktok', 'youtube',
  'organic', 'direct', 'referral', 'unknown',
];

type SimResult = {
  outcome: 'team_routed' | 'global_fallback' | 'no_agent_available';
  team?: string;
  agent_id?: string | null;
  agent_name?: string | null;
  steps: Array<Record<string, any>>;
};

export function RoutingTester() {
  const [source, setSource] = useState('google_ads');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<SimResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setRunning(true);
    setError(null);
    setResult(null);
    const { data, error } = await supabase.rpc('simulate_lead_routing', { p_source: source });
    setRunning(false);
    if (error) {
      setError(error.message);
      return;
    }
    setResult(data as unknown as SimResult);
  };

  const outcomeStyle = result?.outcome === 'team_routed'
    ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
    : result?.outcome === 'global_fallback'
      ? 'border-sky-300 bg-sky-50 text-sky-900'
      : 'border-rose-300 bg-rose-50 text-rose-900';

  return (
    <div className="rounded-lg border-2 border-dashed border-slate-300 bg-slate-50/60 p-3">
      <div className="flex items-center gap-2 mb-2">
        <FlaskConical className="h-4 w-4 text-slate-600" />
        <span className="font-semibold text-sm">Routing tester</span>
        <span className="text-xs text-muted-foreground">
          Dry run — no lead is created, no assignment is changed.
        </span>
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex-1 min-w-[180px]">
          <Label className="text-xs">Pretend a new lead arrives from…</Label>
          <Select value={source} onValueChange={setSource}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              {SOURCES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={run} disabled={running} size="sm">
          {running ? 'Running…' : 'Run routing test'}
        </Button>
      </div>

      {error && (
        <div className="mt-2 flex items-start gap-2 text-xs text-rose-700">
          <AlertCircle className="h-4 w-4 mt-0.5" /> {error}
        </div>
      )}

      {result && (
        <div className={`mt-3 rounded border-2 p-2.5 ${outcomeStyle}`}>
          <div className="flex items-center gap-2 font-semibold text-sm">
            <CheckCircle2 className="h-4 w-4" />
            {result.outcome === 'team_routed' && (
              <>Routed to team <span className="underline">{result.team}</span> → {result.agent_name ?? 'agent ' + result.agent_id}</>
            )}
            {result.outcome === 'global_fallback' && (
              <>Global fallback → {result.agent_name ?? 'agent ' + result.agent_id} (live Team Red flow)</>
            )}
            {result.outcome === 'no_agent_available' && (
              <>No agent available — lead would stay unassigned.</>
            )}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
            {result.steps.map((s, i) => (
              <span key={i} className="inline-flex items-center gap-1">
                <span className="px-2 py-0.5 rounded bg-white/70 border border-current/20">
                  {s.gate === 'master_switch' && <>Master: <strong>{s.state}</strong></>}
                  {s.gate === 'team_candidate' && <>{s.team} (p{s.priority}) {s.picked_agent ? '✓' : '✗ no agent'}</>}
                  {s.gate === 'global_fallback' && <>Global pool {s.picked_agent ? '✓' : '✗'}</>}
                </span>
                {i < result.steps.length - 1 && <ArrowRight className="h-3 w-3 opacity-60" />}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
