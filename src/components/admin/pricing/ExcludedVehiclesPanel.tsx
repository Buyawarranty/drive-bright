import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Ban, CheckCircle2, Info } from 'lucide-react';
import {
  EXCLUDED_MAKES,
  EXCLUDED_MODEL_RULES,
  EXCLUSION_MESSAGE,
  getExclusionReason,
  isVehicleExcluded,
} from '@/lib/vehicleExclusions';

/**
 * Read-only view of the live excluded vehicle matrix, plus a tester.
 * This is the same matrix quotes and the DVLA lookup use, so nothing here is a draft.
 */
const ExcludedVehiclesPanel: React.FC = () => {
  const [search, setSearch] = useState('');
  const [testMake, setTestMake] = useState('');
  const [testModel, setTestModel] = useState('');

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
