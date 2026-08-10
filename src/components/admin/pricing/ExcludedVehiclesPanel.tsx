import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Ban, CheckCircle2, Info, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  EXCLUDED_MAKES,
  EXCLUDED_MODEL_RULES,
  EXCLUSION_MESSAGE,
  getExclusionReason,
  isVehicleExcluded,
} from '@/lib/vehicleExclusions';
import SectionPushLiveBar from '@/components/admin/pricing/SectionPushLiveBar';
import {
  emptyExclusionDraft,
  exclusionDraftDiffersFromLive,
  loadExclusionDraft,
  primeLiveExclusions,
  publishExclusions,
  saveExclusionDraft,
  type ExclusionDraft,
  type PublishedExclusionVersion,
} from '@/lib/pricing/liveVehicleExclusions';

/**
 * Read-only view of the live excluded vehicle matrix, plus a tester and an
 * "extra exclusions" draft the manager can push live with the pricing version.
 */
const ExcludedVehiclesPanel: React.FC = () => {
  const [search, setSearch] = useState('');
  const [testMake, setTestMake] = useState('');
  const [testModel, setTestModel] = useState('');

  const [draft, setDraft] = useState<ExclusionDraft>(() => loadExclusionDraft());
  const [live, setLive] = useState<PublishedExclusionVersion | null>(null);
  const [busy, setBusy] = useState(false);
  const [newMake, setNewMake] = useState('');
  const [ruleMake, setRuleMake] = useState('');
  const [ruleModel, setRuleModel] = useState('');

  useEffect(() => {
    primeLiveExclusions()
      .then(v => {
        setLive(v);
        // First visit with nothing drafted: start from whatever is live.
        setDraft(prev =>
          prev.makes.length === 0 && prev.modelRules.length === 0 && v
            ? { makes: v.extra_makes, modelRules: v.extra_model_rules }
            : prev
        );
      })
      .catch(() => undefined);
  }, []);

  const updateDraft = (next: ExclusionDraft) => {
    setDraft(next);
    saveExclusionDraft(next);
  };

  const addMake = () => {
    const m = newMake.trim().toLowerCase();
    if (!m) return;
    if (draft.makes.includes(m)) {
      toast.info(`${m} is already in the draft`);
      return;
    }
    updateDraft({ ...draft, makes: [...draft.makes, m] });
    setNewMake('');
  };

  const addModelRule = () => {
    const model = ruleModel.trim().toLowerCase();
    if (!model) {
      toast.error('Enter a model or keyword to exclude');
      return;
    }
    updateDraft({
      ...draft,
      modelRules: [
        ...draft.modelRules,
        { make: ruleMake.trim().toLowerCase() || null, model, label: `${ruleMake.trim()} ${ruleModel.trim()}`.trim() },
      ],
    });
    setRuleMake('');
    setRuleModel('');
  };

  const pushLive = async () => {
    setBusy(true);
    try {
      const label = `Exclusions ${new Date().toLocaleDateString('en-GB')} — ${draft.makes.length} makes, ${draft.modelRules.length} model rules`;
      const published = await publishExclusions(draft, label);
      setLive(published);
      toast.success('Exclusions pushed live — every quoting surface now uses them');
    } catch (e: any) {
      toast.error(e?.message || 'Could not push exclusions live');
    } finally {
      setBusy(false);
    }
  };

  const dirty = exclusionDraftDiffersFromLive(draft, live);

  const q = search.trim().toLowerCase();

  const makes = useMemo(
    () => EXCLUDED_MAKES.filter((m) => !q || m.includes(q)),
    [q]
  );

  const rules = useMemo(
    () =>
      EXCLUDED_MODEL_RULES.filter(
        (r) =>
          !q ||
          r.label.toLowerCase().includes(q) ||
          r.makes.some((m) => m.includes(q)) ||
          r.patterns.some((p) => p.source.toLowerCase().includes(q))
      ),
    [q]
  );

  const tested = testMake.trim() || testModel.trim();
  const excluded = tested ? isVehicleExcluded(testMake, testModel) : false;
  const reason = tested ? getExclusionReason(testMake, testModel) : null;


  return (
    <div className="space-y-4">
      <SectionPushLiveBar
        sectionLabel="Excluded vehicles"
        liveLabel={live ? live.label : 'Built-in matrix only'}
        candidates={[]}
        directPush={{
          label: dirty ? 'Push exclusions live' : 'Re-push exclusions live',
          run: pushLive,
        }}
        busy={busy}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Extra exclusions (draft)</CardTitle>
          <CardDescription>
            Add anything the built-in matrix doesn’t cover, then press <strong>Push exclusions live</strong>{' '}
            above. Drafts stay in your browser until pushed live; once live they apply to Steps 1–4,
            Quotes &amp; Orders and the DVLA lookup with whatever pricing version is live.
            {dirty ? ' Draft has unpublished changes.' : ' Draft matches what is live.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Exclude a whole make</Label>
            <div className="flex gap-2">
              <Input
                value={newMake}
                onChange={e => setNewMake(e.target.value)}
                placeholder="e.g. Corvette"
                onKeyDown={e => e.key === 'Enter' && addMake()}
              />
              <Button type="button" variant="outline" onClick={addMake}>
                <Plus className="mr-1 h-4 w-4" /> Add
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {draft.makes.length === 0 && (
                <p className="text-sm text-muted-foreground">No extra makes in the draft.</p>
              )}
              {draft.makes.map(m => (
                <Badge key={m} variant="destructive" className="gap-1 capitalize">
                  {m}
                  <button
                    type="button"
                    aria-label={`Remove ${m}`}
                    onClick={() => updateDraft({ ...draft, makes: draft.makes.filter(x => x !== m) })}
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Exclude a model / keyword</Label>
            <div className="grid gap-2 md:grid-cols-[1fr_1fr_auto]">
              <Input
                value={ruleMake}
                onChange={e => setRuleMake(e.target.value)}
                placeholder="Make (blank = all makes)"
              />
              <Input
                value={ruleModel}
                onChange={e => setRuleModel(e.target.value)}
                placeholder="Model or keyword, e.g. velar"
                onKeyDown={e => e.key === 'Enter' && addModelRule()}
              />
              <Button type="button" variant="outline" onClick={addModelRule}>
                <Plus className="mr-1 h-4 w-4" /> Add
              </Button>
            </div>
            <div className="space-y-2">
              {draft.modelRules.length === 0 && (
                <p className="text-sm text-muted-foreground">No extra model rules in the draft.</p>
              )}
              {draft.modelRules.map((r, i) => (
                <div
                  key={`${r.make}-${r.model}-${i}`}
                  className="flex items-center justify-between gap-2 rounded-md border p-2 text-sm"
                >
                  <span>
                    Excludes <strong className="capitalize">{r.model}</strong>{' '}
                    {r.make ? (
                      <>
                        on <span className="capitalize">{r.make}</span>
                      </>
                    ) : (
                      'across all makes'
                    )}
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      updateDraft({ ...draft, modelRules: draft.modelRules.filter((_, x) => x !== i) })
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-2">

        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <Ban className="h-5 w-5 text-destructive" />
            Excluded vehicles (live)
          </CardTitle>
          <CardDescription>
            Vehicles we cannot cover. Brand-level exclusions decline the whole make; model rules only
            decline specific models so the rest of the make stays coverable (a BMW 320d is fine, an M5
            is not). This matrix is live for quotes, Quotes &amp; Orders and the DVLA lookup.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription className="text-sm">
              Customer-facing message: “{EXCLUSION_MESSAGE}”
            </AlertDescription>
          </Alert>

          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-1">
              <Label>Search the matrix</Label>
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="e.g. bmw, amg, porsche"
              />
            </div>
            <div className="space-y-1">
              <Label>Test make</Label>
              <Input value={testMake} onChange={(e) => setTestMake(e.target.value)} placeholder="BMW" />
            </div>
            <div className="space-y-1">
              <Label>Test model</Label>
              <Input value={testModel} onChange={(e) => setTestModel(e.target.value)} placeholder="320d" />
            </div>
          </div>

          {tested && (
            <div
              className={`rounded-md border-2 p-3 text-sm font-medium ${
                excluded
                  ? 'border-destructive bg-destructive/10 text-destructive'
                  : 'border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
              }`}
            >
              {excluded ? (
                <span className="flex items-center gap-2">
                  <Ban className="h-4 w-4" />
                  Not covered — {reason || 'matches the excluded matrix'}
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  Coverable — no exclusion rule matches this vehicle
                </span>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Excluded makes ({makes.length})</CardTitle>
          <CardDescription>Every model of these brands is declined.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {makes.length === 0 && <p className="text-sm text-muted-foreground">No makes match “{search}”.</p>}
          {makes.map((m) => (
            <Badge key={m} variant="destructive" className="capitalize">
              {m}
            </Badge>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Excluded models by make ({rules.length})</CardTitle>
          <CardDescription>
            Only these model/trim combinations are declined — the rest of the make is still quoted.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {rules.length === 0 && <p className="text-sm text-muted-foreground">No model rules match “{search}”.</p>}
          {rules.map((r) => (
            <div key={r.label} className="rounded-md border p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{r.label}</span>
                {r.makes.slice(0, 4).map((m) => (
                  <Badge key={m} variant="outline" className="capitalize">
                    {m}
                  </Badge>
                ))}
              </div>
              <p className="mt-2 break-words font-mono text-xs text-muted-foreground">
                {r.patterns.map((p) => p.source).join('  ·  ')}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};

export default ExcludedVehiclesPanel;
