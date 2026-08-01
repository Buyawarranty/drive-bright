import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { AlertTriangle, FlaskConical, RotateCcw, Save, Rocket, Trash2 } from 'lucide-react';
import { useIsManagement } from '@/hooks/useIsManagement';
import AgeBandPricingPreview from '@/components/admin/pricing/AgeBandPricingPreview';
import {
  usePricingVersions,
  buildCodeAdminMatrix,
  PERIODS,
  EXCESSES,
  CLAIM_LIMITS,
  type PricingVersion,
} from '@/hooks/usePricingVersions';
import {
  deriveCustomerPriceFromAdmin,
  formatGBP,
  type PricingMatrixShape,
} from '@/lib/pricingMatrix';

const PERIOD_LABELS: Record<string, string> = {
  '12months': '1 year',
  '24months': '2 years',
  '36months': '3 years',
};

function cloneMatrix(m: PricingMatrixShape): PricingMatrixShape {
  return JSON.parse(JSON.stringify(m));
}

export default function PriceUpdatesTab() {
  const { isManagement, loading: roleLoading } = useIsManagement();
  const {
    versions,
    loading,
    createVersion,
    saveVersion,
    publishVersion,
    revertToCode,
    deleteVersion,
  } = usePricingVersions();

  const liveVersion = versions.find(v => v.status === 'live') || null;
  const drafts = versions.filter(v => v.status === 'draft');

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [label, setLabel] = useState('');
  const [notes, setNotes] = useState('');
  const [discountPct, setDiscountPct] = useState(10);
  const [matrix, setMatrix] = useState<PricingMatrixShape>(() => buildCodeAdminMatrix());
  const [busy, setBusy] = useState(false);

  // Pick the first draft once loaded.
  useEffect(() => {
    if (selectedId || drafts.length === 0) return;
    loadIntoEditor(drafts[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drafts.length]);

  function loadIntoEditor(v: PricingVersion) {
    setSelectedId(v.id);
    setLabel(v.label);
    setNotes(v.notes ?? '');
    setDiscountPct(Number(v.step3_discount_pct ?? 10));
    setMatrix(cloneMatrix(v.admin_matrix));
  }

  const codeMatrix = useMemo(() => buildCodeAdminMatrix(), []);

  function setCell(period: string, excess: number, limit: number, value: string) {
    const n = Math.max(0, Math.round(Number(value.replace(/[^0-9]/g, '')) || 0));
    setMatrix(prev => {
      const next = cloneMatrix(prev);
      next[period] = next[period] || {};
      next[period][String(excess)] = next[period][String(excess)] || {};
      next[period][String(excess)][String(limit)] = n;
      return next;
    });
  }

  function bulkApplyPct(pct: number) {
    setMatrix(prev => {
      const next = cloneMatrix(prev);
      for (const p of Object.keys(next)) {
        for (const e of Object.keys(next[p])) {
          for (const l of Object.keys(next[p][e])) {
            next[p][e][l] = Math.round(next[p][e][l] * (1 + pct / 100));
          }
        }
      }
      return next;
    });
    toast.success(`Applied ${pct > 0 ? '+' : ''}${pct}% to every price in the draft`);
  }

  async function handleCreateDraft() {
    setBusy(true);
    try {
      const v = await createVersion(
        `Test pricing ${new Date().toLocaleDateString('en-GB')}`,
        liveVersion ? cloneMatrix(liveVersion.admin_matrix) : buildCodeAdminMatrix(),
        liveVersion ? Number(liveVersion.step3_discount_pct) : 10,
        ''
      );
      loadIntoEditor(v);
      toast.success('Test draft created — edit freely, nothing is live yet');
    } catch (e: any) {
      toast.error(e?.message || 'Could not create draft');
    } finally {
      setBusy(false);
    }
  }

  async function handleSave() {
    if (!selectedId) return;
    setBusy(true);
    try {
      await saveVersion(selectedId, {
        label,
        notes,
        admin_matrix: matrix,
        step3_discount_pct: discountPct,
      });
      toast.success('Draft saved (test only — not live)');
    } catch (e: any) {
      toast.error(e?.message || 'Could not save draft');
    } finally {
      setBusy(false);
    }
  }

  async function handlePublish() {
    if (!selectedId) return;
    if (
      !window.confirm(
        'Push this pricing live?\n\nQuotes & Orders will use these prices, and the customer journey (Step 3/4) will use them minus ' +
          discountPct +
          '%, rounded to the nearest pound.'
      )
    )
      return;
    setBusy(true);
    try {
      await saveVersion(selectedId, {
        label,
        notes,
        admin_matrix: matrix,
        step3_discount_pct: discountPct,
      });
      await publishVersion(selectedId);
      toast.success('Pricing published live — reload any open quote pages');
    } catch (e: any) {
      toast.error(e?.message || 'Could not publish');
    } finally {
      setBusy(false);
    }
  }

  async function handleRevert() {
    if (!window.confirm('Revert all pricing back to the built-in code prices?')) return;
    setBusy(true);
    try {
      await revertToCode();
      toast.success('Reverted to the built-in code pricing');
    } catch (e: any) {
      toast.error(e?.message || 'Could not revert');
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm('Delete this draft?')) return;
    try {
      await deleteVersion(id);
      if (selectedId === id) setSelectedId(null);
      toast.success('Draft deleted');
    } catch (e: any) {
      toast.error(e?.message || 'Could not delete');
    }
  }

  if (roleLoading) {
    return <div className="p-6 text-sm text-muted-foreground">Checking access…</div>;
  }

  if (!isManagement) {
    return (
      <Alert variant="destructive" className="m-4">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Price updates are restricted to management (admin, super admin, sales manager).
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6 p-1">
      <AgeBandPricingPreview />

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FlaskConical className="h-5 w-5" />
                Price updates
              </CardTitle>
              <CardDescription>
                Build and test a new Quotes &amp; Orders price structure without touching live
                pricing. The customer journey price (Step 3/4) is always this structure minus{' '}
                {discountPct}%, rounded to the nearest whole pound. Nothing changes for customers
                or agents until you press <strong>Push live</strong>.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {liveVersion ? (
                <Badge className="bg-emerald-600">Live: {liveVersion.label}</Badge>
              ) : (
                <Badge variant="secondary">Live: built-in code pricing</Badge>
              )}
              <Button variant="outline" size="sm" onClick={handleRevert} disabled={busy || !liveVersion}>
                <RotateCcw className="h-4 w-4 mr-1" /> Revert to code pricing
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={handleCreateDraft} disabled={busy}>
              New test draft
            </Button>
            {drafts.map(d => (
              <div key={d.id} className="flex items-center gap-1">
                <Button
                  variant={selectedId === d.id ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => loadIntoEditor(d)}
                >
                  {d.label}
                </Button>
                <Button variant="ghost" size="icon" onClick={() => handleDelete(d.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
            {loading && <span className="text-sm text-muted-foreground">Loading…</span>}
          </div>

          {!selectedId ? (
            <p className="text-sm text-muted-foreground">
              Create a test draft to start. It is pre-filled with the prices currently in use, so
              you only change what you need.
            </p>
          ) : (
            <div className="space-y-5">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-1">
                  <Label>Draft name</Label>
                  <Input value={label} onChange={e => setLabel(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Website discount off Quotes &amp; Orders (%)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={50}
                    value={discountPct}
                    onChange={e => setDiscountPct(Number(e.target.value) || 0)}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Quick change to every price</Label>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => bulkApplyPct(5)}>
                      +5%
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => bulkApplyPct(10)}>
                      +10%
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => bulkApplyPct(-5)}>
                      -5%
                    </Button>
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <Label>Notes (why this change)</Label>
                <Textarea rows={3} value={notes} onChange={e => setNotes(e.target.value)} />
              </div>

              <Tabs defaultValue="12months">
                <TabsList>
                  {PERIODS.map(p => (
                    <TabsTrigger key={p} value={p}>
                      {PERIOD_LABELS[p]}
                    </TabsTrigger>
                  ))}
                </TabsList>
                {PERIODS.map(period => (
                  <TabsContent key={period} value={period} className="pt-4">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm border-collapse">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left p-2">Excess</th>
                            {CLAIM_LIMITS.map(l => (
                              <th key={l} className="text-left p-2">
                                Claim limit £{l.toLocaleString()}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {EXCESSES.map(excess => (
                            <tr key={excess} className="border-b align-top">
                              <td className="p-2 font-medium whitespace-nowrap">£{excess}</td>
                              {CLAIM_LIMITS.map(limit => {
                                const value =
                                  matrix?.[period]?.[String(excess)]?.[String(limit)] ?? 0;
                                const codeValue =
                                  codeMatrix?.[period]?.[String(excess)]?.[String(limit)] ?? 0;
                                const step3 = deriveCustomerPriceFromAdmin(value, discountPct);
                                const changed = value !== codeValue;
                                return (
                                  <td key={limit} className="p-2">
                                    <div className="flex items-center gap-2">
                                      <span className="text-muted-foreground">£</span>
                                      <Input
                                        className="h-9 w-24"
                                        value={String(value)}
                                        onChange={e => setCell(period, excess, limit, e.target.value)}
                                      />
                                    </div>
                                    <div className="mt-1 text-xs text-muted-foreground">
                                      Website: {formatGBP(step3)} · {formatGBP(Math.floor(step3 / 12))}/mo
                                    </div>
                                    {changed && (
                                      <div className="text-xs text-amber-600">
                                        now live: {formatGBP(codeValue)}
                                      </div>
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </TabsContent>
                ))}
              </Tabs>

              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={handleSave} disabled={busy}>
                  <Save className="h-4 w-4 mr-1" /> Save draft (test only)
                </Button>
                <Button onClick={handlePublish} disabled={busy}>
                  <Rocket className="h-4 w-4 mr-1" /> Push live
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">History</CardTitle>
          <CardDescription>Every saved and published pricing structure.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {versions.length === 0 && (
            <p className="text-sm text-muted-foreground">No pricing versions yet.</p>
          )}
          {versions.map(v => (
            <div
              key={v.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-2"
            >
              <div>
                <div className="font-medium">{v.label}</div>
                <div className="text-xs text-muted-foreground">
                  Website is {Number(v.step3_discount_pct)}% below these prices ·{' '}
                  {v.published_at
                    ? `published ${new Date(v.published_at).toLocaleString('en-GB')}`
                    : `saved ${new Date(v.updated_at).toLocaleString('en-GB')}`}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge
                  className={
                    v.status === 'live'
                      ? 'bg-emerald-600'
                      : v.status === 'draft'
                        ? 'bg-amber-500'
                        : undefined
                  }
                  variant={v.status === 'archived' ? 'secondary' : 'default'}
                >
                  {v.status === 'live' ? 'Live' : v.status === 'draft' ? 'Test draft' : 'Archived'}
                </Badge>
                {v.status !== 'live' && (
                  <Button variant="outline" size="sm" onClick={() => loadIntoEditor(v)}>
                    Open
                  </Button>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
