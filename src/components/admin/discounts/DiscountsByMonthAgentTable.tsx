import React, { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { format, startOfMonth } from 'date-fns';

export interface DiscountRow {
  agentId: string;
  agentName: string;
  /** Sale / quote date */
  date: string;
  /** Price quoted on the pricing grid (QOP) */
  quoted: number | null;
  /** What the customer actually paid */
  paid: number;
}

interface Props {
  rows: DiscountRow[];
  /** Called when the user clicks an agent row, so the page can filter to them. */
  onSelectAgent?: (agentId: string) => void;
}

interface Bucket {
  sales: number;
  discounted: number;
  quoted: number;
  paid: number;
}

const emptyBucket = (): Bucket => ({ sales: 0, discounted: 0, quoted: 0, paid: 0 });

const pctOf = (b: Bucket) => (b.quoted > 0 ? ((b.quoted - b.paid) / b.quoted) * 100 : 0);
const gapOf = (b: Bucket) => b.quoted - b.paid;

const pctClass = (pct: number) => {
  if (pct <= 0) return 'text-muted-foreground';
  if (pct < 20) return 'text-green-700';
  if (pct < 30) return 'text-orange-700';
  return 'text-red-700';
};

const money = (n: number) => `£${Math.round(Math.abs(n)).toLocaleString()}`;

/**
 * Month → agent discount summary. One line per month, expand to see every agent
 * in that month with quoted (QOP) vs actual and the gap in £ and %.
 */
export const DiscountsByMonthAgentTable: React.FC<Props> = ({ rows, onSelectAgent }) => {
  const [openMonths, setOpenMonths] = useState<Record<string, boolean>>({});

  const months = useMemo(() => {
    const byMonth = new Map<string, { total: Bucket; agents: Map<string, { name: string; b: Bucket }> }>();

    rows.forEach((r) => {
      if (r.quoted === null || !(r.quoted > 0)) return;
      const key = format(startOfMonth(new Date(r.date)), 'yyyy-MM');
      let m = byMonth.get(key);
      if (!m) {
        m = { total: emptyBucket(), agents: new Map() };
        byMonth.set(key, m);
      }
      let a = m.agents.get(r.agentId);
      if (!a) {
        a = { name: r.agentName, b: emptyBucket() };
        m.agents.set(r.agentId, a);
      }
      const discounted = r.quoted - r.paid > 0.5;
      [m.total, a.b].forEach((b) => {
        b.sales++;
        b.quoted += r.quoted as number;
        b.paid += r.paid;
        if (discounted) b.discounted++;
      });
    });

    return Array.from(byMonth.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([key, m]) => ({
        key,
        label: format(new Date(`${key}-01`), 'MMMM yyyy'),
        total: m.total,
        agents: Array.from(m.agents.entries())
          .map(([id, a]) => ({ id, name: a.name, b: a.b }))
          .sort((x, y) => gapOf(y.b) - gapOf(x.b)),
      }));
  }, [rows]);

  const grand = useMemo(() => {
    const b = emptyBucket();
    months.forEach((m) => {
      b.sales += m.total.sales;
      b.discounted += m.total.discounted;
      b.quoted += m.total.quoted;
      b.paid += m.total.paid;
    });
    return b;
  }, [months]);

  const allOpen = months.length > 0 && months.every((m) => openMonths[m.key]);

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-semibold">Discounts by month and agent</h2>
            <p className="text-xs text-muted-foreground">
              Quoted price (QOP) against what was actually collected. Click a month to see each agent.
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              setOpenMonths(allOpen ? {} : Object.fromEntries(months.map((m) => [m.key, true])))
            }
          >
            {allOpen ? 'Collapse all' : 'Expand all'}
          </Button>
        </div>

        <div className="rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="w-[220px]">Month / agent</TableHead>
                <TableHead className="text-right">Sales</TableHead>
                <TableHead className="text-right">Discounted</TableHead>
                <TableHead className="text-right">Quoted (QOP)</TableHead>
                <TableHead className="text-right">Actual paid</TableHead>
                <TableHead className="text-right">Discount given</TableHead>
                <TableHead className="text-right">QOP vs actual</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {months.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No sales in this date range.
                  </TableCell>
                </TableRow>
              )}

              {months.map((m) => {
                const open = !!openMonths[m.key];
                const pct = pctOf(m.total);
                const gap = gapOf(m.total);
                return (
                  <React.Fragment key={m.key}>
                    <TableRow
                      className="cursor-pointer bg-muted/30 hover:bg-muted/60"
                      onClick={() => setOpenMonths((s) => ({ ...s, [m.key]: !s[m.key] }))}
                    >
                      <TableCell className="font-semibold whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5">
                          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          {m.label}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">{m.total.sales}</TableCell>
                      <TableCell className="text-right">{m.total.discounted}</TableCell>
                      <TableCell className="text-right">{money(m.total.quoted)}</TableCell>
                      <TableCell className="text-right font-medium">{money(m.total.paid)}</TableCell>
                      <TableCell className={`text-right font-bold ${gap > 0 ? 'text-red-600' : 'text-muted-foreground'}`}>
                        {gap > 0 ? `−${money(gap)}` : '—'}
                      </TableCell>
                      <TableCell className={`text-right font-bold ${pctClass(pct)}`}>
                        {pct > 0 ? `${pct.toFixed(1)}%` : '0%'}
                      </TableCell>
                    </TableRow>

                    {open &&
                      m.agents.map((a) => {
                        const apct = pctOf(a.b);
                        const agap = gapOf(a.b);
                        return (
                          <TableRow
                            key={`${m.key}-${a.id}`}
                            className="hover:bg-accent/40 cursor-pointer"
                            onClick={() => onSelectAgent?.(a.id)}
                          >
                            <TableCell className="pl-10 text-sm whitespace-nowrap">{a.name}</TableCell>
                            <TableCell className="text-right text-sm">{a.b.sales}</TableCell>
                            <TableCell className="text-right text-sm">{a.b.discounted}</TableCell>
                            <TableCell className="text-right text-sm">{money(a.b.quoted)}</TableCell>
                            <TableCell className="text-right text-sm">{money(a.b.paid)}</TableCell>
                            <TableCell className={`text-right text-sm font-semibold ${agap > 0 ? 'text-red-600' : 'text-muted-foreground'}`}>
                              {agap > 0 ? `−${money(agap)}` : '—'}
                            </TableCell>
                            <TableCell className="text-right text-sm">
                              <Badge variant="outline" className={`font-semibold ${pctClass(apct)}`}>
                                {apct > 0 ? `${apct.toFixed(1)}%` : '0%'}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                  </React.Fragment>
                );
              })}

              {months.length > 0 && (
                <TableRow className="border-t-2 bg-muted/60 font-bold">
                  <TableCell>All months</TableCell>
                  <TableCell className="text-right">{grand.sales}</TableCell>
                  <TableCell className="text-right">{grand.discounted}</TableCell>
                  <TableCell className="text-right">{money(grand.quoted)}</TableCell>
                  <TableCell className="text-right">{money(grand.paid)}</TableCell>
                  <TableCell className={`text-right ${gapOf(grand) > 0 ? 'text-red-600' : ''}`}>
                    {gapOf(grand) > 0 ? `−${money(gapOf(grand))}` : '—'}
                  </TableCell>
                  <TableCell className={`text-right ${pctClass(pctOf(grand))}`}>
                    {pctOf(grand) > 0 ? `${pctOf(grand).toFixed(1)}%` : '0%'}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};

export default DiscountsByMonthAgentTable;
