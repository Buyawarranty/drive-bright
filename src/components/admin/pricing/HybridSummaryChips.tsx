import React from 'react';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';

/**
 * The summary chips under the hybrid variables, made editable.
 * Typing here writes straight back to the same settings as the fields above,
 * so a manager can adjust the headline figures without scrolling back up.
 */
type Cfg = {
  targetReference: number;
  baseReductionPct: number;
  ceiling: number;
  ceilingOn: boolean;
  twoYearDiscountPct: number;
  threeYearDiscountPct: number;
};

const chip =
  'inline-flex items-center gap-2 rounded-full border bg-background px-3 py-1 text-xs';
const num = 'h-6 w-16 rounded-md px-2 py-0 text-xs';

const HybridSummaryChips: React.FC<{
  cfg: Cfg;
  set: <K extends keyof Cfg>(key: K, value: Cfg[K]) => void;
  effectiveTarget: number;
  multiYearLabel?: string;
}> = ({ cfg, set, effectiveTarget, multiYearLabel = 'Multi-year discount' }) => (
  <div className="mt-4 flex flex-wrap items-center gap-2">
    <span className={chip}>
      Reference target £
      <Input
        type="number"
        className={num}
        value={cfg.targetReference > 0 ? cfg.targetReference : effectiveTarget || ''}
        onChange={e => set('targetReference', Math.max(0, Number(e.target.value) || 0))}
        aria-label="Exact one-year reference target"
      />
      {cfg.targetReference > 0 ? (
        <button
          type="button"
          className="underline underline-offset-2 text-muted-foreground"
          onClick={() => set('targetReference', 0)}
        >
          use % below August
        </button>
      ) : (
        <>
          <Input
            type="number"
            className={num}
            value={cfg.baseReductionPct}
            onChange={e => set('baseReductionPct', Number(e.target.value) || 0)}
            aria-label="Reduction from August base percent"
          />
          % below August
        </>
      )}
    </span>

    <span className={chip}>
      <Switch
        checked={cfg.ceilingOn}
        onCheckedChange={v => set('ceilingOn', v)}
        aria-label="Auto-quote ceiling on"
      />
      {cfg.ceilingOn ? (
        <>
          Ceiling £
          <Input
            type="number"
            className={num}
            value={cfg.ceiling}
            onChange={e => set('ceiling', Math.max(0, Number(e.target.value) || 0))}
            aria-label="Auto-quote ceiling"
          />
        </>
      ) : (
        'No ceiling'
      )}
    </span>

    <span className={chip}>
      {multiYearLabel}
      <Input
        type="number"
        className={num}
        value={cfg.twoYearDiscountPct}
        onChange={e => set('twoYearDiscountPct', Number(e.target.value) || 0)}
        aria-label="2 year discount percent"
      />
      % /
      <Input
        type="number"
        className={num}
        value={cfg.threeYearDiscountPct}
        onChange={e => set('threeYearDiscountPct', Number(e.target.value) || 0)}
        aria-label="3 year discount percent"
      />
      %
    </span>
  </div>
);

export default HybridSummaryChips;
