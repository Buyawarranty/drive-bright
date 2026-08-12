import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { History, RotateCcw, Check, StickyNote, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import type { PricingVersion } from '@/hooks/usePricingVersions';


/**
 * PRICE UPDATE LOG
 * -------------------------------------------------------------------------
 * A plain, chronological record of every price model that has been saved or
 * pushed live, newest first, with a one-click "Revert price" back to any of
 * them. Reverting republishes that stored version exactly as it was — it never
 * re-values historic sales.
 */

/** A representative cell so each row shows a comparable headline figure. */
function sampleGridPrice(v: PricingVersion): number | null {
  const m: any = v.admin_matrix;
  const cell = m?.['24months']?.['100']?.['2000'] ?? m?.['24months']?.['100']?.['1000'];
  const n = Number(cell);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}

/** Average of every Quotes & Orders cell, so the percentage move is the whole
 *  curve rather than one sample cell. */
function averageGridPrice(v: PricingVersion): number | null {
  const m: any = v.admin_matrix;
  if (!m) return null;
  const values: number[] = [];
  for (const term of Object.values(m) as any[]) {
    if (!term || typeof term !== 'object') continue;
    for (const excess of Object.values(term) as any[]) {
      if (!excess || typeof excess !== 'object') continue;
      for (const cell of Object.values(excess) as any[]) {
        const n = Number(cell);
        if (Number.isFinite(n) && n > 0) values.push(n);
      }
    }
  }
  if (!values.length) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/** Percentage move of this price model against the one saved before it. */
function pctVsPrevious(current: PricingVersion, previous?: PricingVersion): number | null {
  if (!previous) return null;
  const a = averageGridPrice(previous);
  const b = averageGridPrice(current);
  if (!a || !b) return null;
  return Math.round(((b - a) / a) * 1000) / 10;
}

function whenLabel(v: PricingVersion): string {
  const iso = v.published_at || v.updated_at || v.created_at;
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isFinite(d.getTime()) ? format(d, 'dd/MM/yyyy HH:mm') : '—';
}

export default function PriceUpdateLogPanel({
  versions,
  busy,
  onRevert,
  onSaveNote,
}: {
  versions: PricingVersion[];
  busy?: boolean;
  onRevert: (v: PricingVersion) => void;
  /** Save the performance note against this price model. */
  onSaveNote?: (id: string, notes: string) => Promise<void>;
}) {
  const [showAll, setShowAll] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [openNotes, setOpenNotes] = useState<Record<string, boolean>>({});

  const saveNote = async (id: string, current: string) => {
    if (!onSaveNote) return;
    setSavingId(id);
    try {
      await onSaveNote(id, (drafts[id] ?? current ?? '').trim());
      toast.success('Note saved');
    } catch (e: any) {
      toast.error(e?.message || 'Could not save the note');
    } finally {
      setSavingId(null);
    }
  };


  const rows = useMemo(() => {
    const sorted = [...versions].sort((a, b) => {
      const ta = new Date(a.published_at || a.updated_at || a.created_at).getTime() || 0;
      const tb = new Date(b.published_at || b.updated_at || b.created_at).getTime() || 0;
      return tb - ta;
    });
    return showAll ? sorted : sorted.slice(0, 8);
  }, [versions, showAll]);

  return (
    <Card className="border-2">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-xl">
          <History className="h-5 w-5 text-primary" />
          Price update log
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Every price model saved or pushed live, newest first. Press{' '}
          <strong>Revert price</strong> on any row to make those exact Quotes &amp; Orders prices
          live again — the website price follows at its published gap. Sales already taken keep the
          price they were sold at.
        </p>
      </CardHeader>
      <CardContent className="space-y-2">
        {rows.length === 0 && (
          <p className="text-sm text-muted-foreground">No price models recorded yet.</p>
        )}

        {rows.map((v, i) => {
          const isLive = v.status === 'live';
          const sample = sampleGridPrice(v);
          const move = pctVsPrevious(v, rows[i + 1]);
          return (
            <div
              key={v.id}
              className={`rounded-lg border p-3 ${isLive ? 'border-primary bg-primary/5' : 'bg-card'}`}
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold truncate">{v.label}</span>
                    {isLive ? (
                      <Badge className="gap-1">
                        <Check className="h-3 w-3" /> Live now
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="capitalize">
                        {v.status}
                      </Badge>
                    )}
                    {move !== null && (
                      <Badge
                        variant="outline"
                        className={
                          move > 0
                            ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                            : move < 0
                              ? 'border-orange-300 bg-orange-50 text-orange-800'
                              : 'text-muted-foreground'
                        }
                      >
                        {move > 0 ? '+' : move < 0 ? '−' : ''}
                        {Math.abs(move)}% {move === 0 ? 'no change' : 'vs previous'}
                      </Badge>
                    )}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {v.published_at ? 'Pushed live' : 'Saved'} {whenLabel(v)}
                    {sample !== null && <> · 2yr £100 excess / £2,000 limit: £{sample}</>}
                    {' · website −'}
                    {Math.round(Number(v.step3_discount_pct) > 0 ? Number(v.step3_discount_pct) : 10)}%
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setOpenNotes(s => ({ ...s, [v.id]: !s[v.id] }))}
                  >
                    <StickyNote className="mr-1 h-4 w-4" />
                    {openNotes[v.id] ? 'Hide note' : v.notes ? 'Edit note' : 'Add note'}
                  </Button>
                  {isLive ? (
                    <span className="text-xs font-medium text-primary">Currently live</span>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() => onRevert(v)}
                    >
                      <RotateCcw className="mr-1 h-4 w-4" />
                      Revert price
                    </Button>
                  )}
                </div>
              </div>

              {/* Performance notes — what this price model did, in plain words. */}
              {v.notes && !openNotes[v.id] && (
                <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900 whitespace-pre-wrap">
                  {v.notes}
                </div>
              )}

              {openNotes[v.id] && (
                <div className="mt-2 space-y-2">
                  <Textarea
                    rows={3}
                    placeholder="How did this price perform? e.g. 12 sales in 4 days, average order £512, conversion held at 8% — kept the 2yr uplift."
                    value={drafts[v.id] ?? v.notes ?? ''}
                    onChange={e => setDrafts(s => ({ ...s, [v.id]: e.target.value }))}
                    className="text-sm"
                  />
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      disabled={savingId === v.id || !onSaveNote}
                      onClick={() => saveNote(v.id, v.notes ?? '')}
                    >
                      {savingId === v.id && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
                      Save note
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setDrafts(s => ({ ...s, [v.id]: v.notes ?? '' }));
                        setOpenNotes(s => ({ ...s, [v.id]: false }));
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>

          );
        })}

        {versions.length > 8 && (
          <Button type="button" variant="ghost" size="sm" onClick={() => setShowAll(s => !s)}>
            {showAll ? 'Show fewer' : `Show all ${versions.length} entries`}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
