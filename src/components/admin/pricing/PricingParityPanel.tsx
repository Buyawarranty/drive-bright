import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScaleIcon } from 'lucide-react';
import { buildParityRows, summariseParity } from '@/lib/pricing/parityHarness';

const EXCESS_OPTIONS = [0, 50, 100, 150, 250];
import { getDisplayClaimLimit } from '@/lib/claimLimitTiers';

const CLAIM_LIMITS = [1000, 2000, 3000];
const LABOUR_RATES = [50, 70, 100, 150];

const money = (n: number) => `£${Math.abs(n).toLocaleString('en-GB')}`;

function Delta({ value }: { value: number }) {
  if (value === 0) {
    return <span className="text-emerald-600 font-medium">match</span>;
  }
  return (
    <span className={value > 0 ? 'text-amber-600 font-medium' : 'text-destructive font-medium'}>
      {value > 0 ? '+' : '−'}
      {money(value)}
    </span>
  );
}

export default function PricingParityPanel() {
  const [excess, setExcess] = useState(100);
  const [claimLimit, setClaimLimit] = useState(2000);
  const [labourRate, setLabourRate] = useState(70);
  const [boost, setBoost] = useState(false);
  const [onlyDiffs, setOnlyDiffs] = useState(false);

  const rows = useMemo(
    () =>
      buildParityRows({
        voluntaryExcess: excess,
        claimLimit,
        labourRate,
        boostEnabled: boost,
      }),
    [excess, claimLimit, labourRate, boost]
  );

  const summary = useMemo(() => summariseParity(rows), [rows]);
  const visible = onlyDiffs
    ? rows.filter((r) => r.adminDelta !== 0 || r.cardsDelta !== 0 || r.inlineDelta !== 0)
    : rows;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ScaleIcon className="h-4 w-4" /> Parity table — draft service vs live surfaces
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <AlertDescription className="text-sm">
            Runs a fixed vehicle set through the draft service and through each live assembly.
            <strong> Nothing is published</strong> — a non-zero delta is a real price difference we
            must explain before any page switches over. Step 3/4 cards include the −£100/−£200
            multi-year discount; Step 3 inline does not.
          </AlertDescription>
        </Alert>

        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Excess</Label>
            <Select value={String(excess)} onValueChange={(v) => setExcess(Number(v))}>
              <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
              <SelectContent>
                {EXCESS_OPTIONS.map((v) => (
                  <SelectItem key={v} value={String(v)}>£{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Claim limit</Label>
            <Select value={String(claimLimit)} onValueChange={(v) => setClaimLimit(Number(v))}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                {CLAIM_LIMITS.map((v) => (
                  <SelectItem key={v} value={String(v)}>{getDisplayClaimLimit(v)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Labour rate</Label>
            <Select value={String(labourRate)} onValueChange={(v) => setLabourRate(Number(v))}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                {LABOUR_RATES.map((v) => (
                  <SelectItem key={v} value={String(v)}>£{v}/hr</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2 pb-1">
            <Switch checked={boost} onCheckedChange={setBoost} id="parity-boost" />
            <Label htmlFor="parity-boost" className="text-xs">Boost (+£60)</Label>
          </div>
          <div className="flex items-center gap-2 pb-1">
            <Switch checked={onlyDiffs} onCheckedChange={setOnlyDiffs} id="parity-diffs" />
            <Label htmlFor="parity-diffs" className="text-xs">Differences only</Label>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3 text-sm">
          <div className="rounded-md border p-3">
            <div className="text-xs text-muted-foreground">Quotes &amp; Orders</div>
            <div className="text-lg font-semibold">
              {summary.matchedAdmin}/{summary.total} match
            </div>
            <div className="text-xs text-muted-foreground">
              worst delta <Delta value={summary.worstAdminDelta} />
            </div>
          </div>
          <div className="rounded-md border p-3">
            <div className="text-xs text-muted-foreground">Step 3/4 cards</div>
            <div className="text-lg font-semibold">
              {summary.matchedCards}/{summary.total} match
            </div>
            <div className="text-xs text-muted-foreground">
              worst delta <Delta value={summary.worstCardsDelta} />
            </div>
          </div>
          <div className="rounded-md border p-3">
            <div className="text-xs text-muted-foreground">Step 3 inline</div>
            <div className="text-lg font-semibold">
              {summary.matchedInline}/{summary.total} match
            </div>
            <div className="text-xs text-muted-foreground">
              worst delta <Delta value={summary.worstInlineDelta} />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vehicle</TableHead>
                <TableHead>Term</TableHead>
                <TableHead className="text-right">Factor</TableHead>
                <TableHead className="text-right">Draft (admin)</TableHead>
                <TableHead className="text-right">Live Q&amp;O</TableHead>
                <TableHead className="text-right">Δ</TableHead>
                <TableHead className="text-right">Draft (web)</TableHead>
                <TableHead className="text-right">Live cards</TableHead>
                <TableHead className="text-right">Δ</TableHead>
                <TableHead className="text-right">Live inline</TableHead>
                <TableHead className="text-right">Δ</TableHead>
                <TableHead>Legacy surcharge</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((r) => (
                <TableRow key={`${r.vehicle}-${r.period}`}>
                  <TableCell className="whitespace-nowrap">{r.vehicle}</TableCell>
                  <TableCell>{r.period.replace('months', 'm')}</TableCell>
                  <TableCell className="text-right">×{r.vehicleFactor.toFixed(3)}</TableCell>
                  <TableCell className="text-right">{money(r.draftAdmin)}</TableCell>
                  <TableCell className="text-right">{money(r.liveAdmin)}</TableCell>
                  <TableCell className="text-right"><Delta value={r.adminDelta} /></TableCell>
                  <TableCell className="text-right">{money(r.draftCustomer)}</TableCell>
                  <TableCell className="text-right">{money(r.liveCards)}</TableCell>
                  <TableCell className="text-right"><Delta value={r.cardsDelta} /></TableCell>
                  <TableCell className="text-right">{money(r.liveInline)}</TableCell>
                  <TableCell className="text-right"><Delta value={r.inlineDelta} /></TableCell>
                  <TableCell>
                    {r.legacySurcharge ? (
                      <Badge variant={r.doubleCounts ? 'destructive' : 'secondary'}>
                        {money(r.legacySurcharge)}
                        {r.doubleCounts ? ' double-counts' : ''}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {visible.length === 0 && (
                <TableRow>
                  <TableCell colSpan={12} className="text-center text-sm text-muted-foreground">
                    Every row matches on all three surfaces with these options.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
