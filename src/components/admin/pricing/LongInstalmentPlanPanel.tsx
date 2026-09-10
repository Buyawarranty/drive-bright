import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CalendarClock, Info, RotateCcw, Save } from 'lucide-react';
import { toast } from 'sonner';
import { useLongInstalmentMultiples } from '@/hooks/useLongInstalmentMultiples';
import { useIsManagement } from '@/hooks/useIsManagement';
import { LONG_PLAN_MULTIPLE_LIMITS, clampLongPlanMultiple } from '@/lib/instalmentOptions';

/**
 * Management control for the longer instalment plans on Quotes & Orders.
 * The 1-year price stays the base: 24 instalments = x1 multiple, 36 = x2 multiple.
 * The 12-instalment prices and the customer website prices are not affected.
 */
export default function LongInstalmentPlanPanel() {
  const { multiples, loading, saving, save, defaults } = useLongInstalmentMultiples();
  const { isManagement } = useIsManagement();
  const [draft24, setDraft24] = useState(String(multiples[24]));
  const [draft36, setDraft36] = useState(String(multiples[36]));
  const [exampleOneYear, setExampleOneYear] = useState('349');

  useEffect(() => {
    if (loading) return;
    setDraft24(String(multiples[24]));
    setDraft36(String(multiples[36]));
  }, [loading, multiples]);

  const parsed24 = Number(draft24);
  const parsed36 = Number(draft36);
  const valid24 =
    Number.isFinite(parsed24) &&
    parsed24 >= LONG_PLAN_MULTIPLE_LIMITS[24].min &&
    parsed24 <= LONG_PLAN_MULTIPLE_LIMITS[24].max;
  const valid36 =
    Number.isFinite(parsed36) &&
    parsed36 >= LONG_PLAN_MULTIPLE_LIMITS[36].min &&
    parsed36 <= LONG_PLAN_MULTIPLE_LIMITS[36].max;
  const dirty = parsed24 !== multiples[24] || parsed36 !== multiples[36];

  const example = useMemo(() => {
    const oneYear = Number(exampleOneYear) || 0;
    const total24 = valid24 ? Math.round(oneYear * parsed24) : 0;
    const total36 = valid36 ? Math.round(oneYear * parsed36) : 0;
    return {
      oneYear,
      total24,
      total36,
      monthly24: total24 > 0 ? Math.ceil(total24 / 24) : 0,
      monthly36: total36 > 0 ? Math.ceil(total36 / 36) : 0,
    };
  }, [exampleOneYear, parsed24, parsed36, valid24, valid36]);

  const onSave = async () => {
    if (!valid24 || !valid36) {
      toast.error('Enter multiples inside the allowed range.');
      return;
    }
    const ok = await save({
      24: clampLongPlanMultiple(24, parsed24),
      36: clampLongPlanMultiple(36, parsed36),
    });
    toast[ok ? 'success' : 'error'](
      ok ? 'Longer plan pricing saved — agents see it straight away.' : 'Could not save. Please try again.'
    );
  };

  return (
    <Card className="border-2 border-amber-200">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarClock className="h-5 w-5 text-amber-600" />
          Longer plans — 24 and 36 payments
          <Badge variant="outline" className="ml-1">Agent quotes only</Badge>
        </CardTitle>
        <CardDescription>
          Spreading payments over 2 or 3 years costs more, so these plans are priced straight off the
          one-year price for the same excess, claim limit and labour rate. Change a number here and
          every quote re-prices immediately. The 12-payment prices and the customer website prices are
          untouched.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="long-plan-24">24 payments (2-year cover) — × one-year price</Label>
            <Input
              id="long-plan-24"
              type="number"
              step="0.01"
              min={LONG_PLAN_MULTIPLE_LIMITS[24].min}
              max={LONG_PLAN_MULTIPLE_LIMITS[24].max}
              value={draft24}
              disabled={!isManagement || loading}
              onChange={e => setDraft24(e.target.value)}
              className={!valid24 ? 'border-destructive' : undefined}
            />
            <p className="text-xs text-muted-foreground">
              Allowed {LONG_PLAN_MULTIPLE_LIMITS[24].min}–{LONG_PLAN_MULTIPLE_LIMITS[24].max} · standard {defaults[24]}
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="long-plan-36">36 payments (3-year cover) — × one-year price</Label>
            <Input
              id="long-plan-36"
              type="number"
              step="0.01"
              min={LONG_PLAN_MULTIPLE_LIMITS[36].min}
              max={LONG_PLAN_MULTIPLE_LIMITS[36].max}
              value={draft36}
              disabled={!isManagement || loading}
              onChange={e => setDraft36(e.target.value)}
              className={!valid36 ? 'border-destructive' : undefined}
            />
            <p className="text-xs text-muted-foreground">
              Allowed {LONG_PLAN_MULTIPLE_LIMITS[36].min}–{LONG_PLAN_MULTIPLE_LIMITS[36].max} · standard {defaults[36]}
            </p>
          </div>
        </div>

        <div className="rounded-lg border bg-muted/40 p-4 space-y-2">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="long-plan-example">Try it — one-year price</Label>
              <Input
                id="long-plan-example"
                type="number"
                value={exampleOneYear}
                onChange={e => setExampleOneYear(e.target.value)}
                className="w-32"
              />
            </div>
            <div className="text-sm space-y-1">
              <p>
                <strong>24 payments:</strong> £{example.total24} total · £{example.monthly24}/month
              </p>
              <p>
                <strong>36 payments:</strong> £{example.total36} total · £{example.monthly36}/month
              </p>
            </div>
          </div>
        </div>

        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription className="text-sm">
            These plans can only be set up on the matching Bumper 24 or 36 month plan — never on the
            12-month plan or by card.
          </AlertDescription>
        </Alert>

        {!isManagement && (
          <p className="text-sm text-muted-foreground">
            Only managers, admins and super admins can change these figures.
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          <Button onClick={onSave} disabled={!isManagement || saving || loading || !dirty}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Saving…' : 'Save longer plan pricing'}
          </Button>
          <Button
            variant="outline"
            disabled={!isManagement || saving || loading}
            onClick={() => {
              setDraft24(String(defaults[24]));
              setDraft36(String(defaults[36]));
            }}
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset to standard ({defaults[24]} / {defaults[36]})
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
