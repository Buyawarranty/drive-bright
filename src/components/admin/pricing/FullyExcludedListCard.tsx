import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Ban, Info } from 'lucide-react';
import {
  EXCLUDED_MAKES,
  EXCLUDED_MODEL_RULES,
  EXCLUSION_MESSAGE,
  getLiveExclusionExtras,
} from '@/lib/vehicleExclusions';
import { primeLiveExclusions } from '@/lib/pricing/liveVehicleExclusions';

/**
 * Always-visible, read-only list of the fully excluded vehicles (Ferrari,
 * Lamborghini, Bentley…) plus the model-level rules. This list is enforced on
 * every quoting surface and is re-published automatically with every pricing
 * push live, so it can never drift behind a pricing version.
 */
const FullyExcludedListCard: React.FC<{ compact?: boolean }> = ({ compact }) => {
  const [q, setQ] = useState('');
  const [extras, setExtras] = useState(() => getLiveExclusionExtras());

  useEffect(() => {
    primeLiveExclusions()
      .then(() => setExtras(getLiveExclusionExtras()))
      .catch(() => undefined);
  }, []);

  const search = q.trim().toLowerCase();

  const draft = useMemo(() => loadExclusionDraft(), []);

  const makes = useMemo(() => {
    const liveExtras = (extras.makes ?? []).map(m => m.trim().toLowerCase());
    const all = [
      ...EXCLUDED_MAKES.map(m => ({ make: m, origin: 'built-in' as const })),
      ...liveExtras.map(m => ({ make: m, origin: 'live' as const })),
      ...draft.makes
        .map(m => m.trim().toLowerCase())
        .filter(m => m && !liveExtras.includes(m))
        .map(m => ({ make: m, origin: 'draft' as const })),
    ];
    const seen = new Set<string>();
    return all
      .filter(m => (seen.has(m.make) ? false : (seen.add(m.make), true)))
      .filter(m => !search || m.make.includes(search))
      .sort((a, b) => a.make.localeCompare(b.make));
  }, [extras, search, draft]);

  const rules = useMemo(
    () =>
      EXCLUDED_MODEL_RULES.filter(
        r =>
          !search ||
          r.label.toLowerCase().includes(search) ||
          r.makes.some(m => m.includes(search))
      ),
    [search]
  );

  const extraRules = useMemo(
    () =>
      (extras.modelRules ?? []).filter(
        r =>
          !search ||
          r.model.toLowerCase().includes(search) ||
          (r.make || '').toLowerCase().includes(search)
      ),
    [extras, search]
  );

  return (
    <Card className="border-2 border-destructive/40">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Ban className="h-5 w-5 text-destructive" />
          Fully excluded vehicles ({makes.length} makes)
        </CardTitle>
        <CardDescription>
          These brands are never quoted — Steps 1–4, Quotes &amp; Orders and the DVLA lookup all decline
          them. This list is pushed live automatically with <strong>every</strong> pricing push live, so
          it always matches whatever pricing version is live.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription className="text-sm">
            Customer message: “{EXCLUSION_MESSAGE}”
          </AlertDescription>
        </Alert>

        <Input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Search excluded makes / models, e.g. ferrari, amg"
        />

        <div className="flex flex-wrap gap-2">
          {makes.length === 0 && (
            <p className="text-sm text-muted-foreground">No excluded makes match “{q}”.</p>
          )}
          {makes.map(m => (
            <Badge key={m.make} variant="destructive" className="capitalize">
              {m.make}
              {m.extra ? ' • added' : ''}
            </Badge>
          ))}
        </div>

        {!compact && (
          <div className="space-y-2">
            <p className="text-sm font-semibold">
              Model-level exclusions ({rules.length + extraRules.length})
            </p>
            <div className="flex flex-wrap gap-2">
              {rules.map(r => (
                <Badge key={r.label} variant="outline">
                  {r.label}
                </Badge>
              ))}
              {extraRules.map((r, i) => (
                <Badge key={`${r.make}-${r.model}-${i}`} variant="outline" className="capitalize">
                  {r.make ? `${r.make} ` : ''}
                  {r.model} • added
                </Badge>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Model rules only decline that model — the rest of the make is still quoted (a BMW 320d is
              covered, an M5 is not).
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default FullyExcludedListCard;
