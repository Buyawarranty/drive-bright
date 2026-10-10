import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ShieldAlert, X, ChevronDown, ChevronUp } from 'lucide-react';
import { AlertRailSlot, ALERT_RAIL_ORDER } from '@/components/admin/AlertRail';
import { useIsManagement } from '@/hooks/useIsManagement';
import { useAllAdminUsersMap } from '@/hooks/useAllAdminUsersMap';
import { setVisibleInterval } from '@/lib/visibilityInterval';
import { Button } from '@/components/ui/button';

/**
 * Management-only red alert for sales recorded by hand (paid directly in
 * Bumper/Stripe and confirmed into the CRM) that came in more than 30% under
 * the agent's quote, or under the minimum price for the term. Stays until a
 * manager closes it — no time-based expiry.
 */
const DISMISSED_KEY = 'sale-needs-authorisation-dismissed-ids';
const CEILING = 0.3;
const LOOKBACK_DAYS = 14;

export const minimumForTerm = (paymentType: string | null | undefined): number => {
  const t = String(paymentType || '').toLowerCase();
  if (/3|three|36/.test(t)) return 1099;
  if (/2|two|24/.test(t)) return 769;
  return 399;
};

export const saleFlagReasons = (paid: number, quoted: number | null, paymentType: string | null) => {
  const reasons: string[] = [];
  if (quoted && quoted > 0 && paid < quoted * (1 - CEILING) - 0.01) {
    reasons.push(`${Math.round(((quoted - paid) / quoted) * 100)}% under the £${quoted.toFixed(0)} quote`);
  }
  const min = minimumForTerm(paymentType);
  if (paid > 0 && paid < min - 0.01) reasons.push(`under the £${min.toLocaleString()} minimum`);
  return reasons;
};

interface Flag {
  id: string;
  name: string;
  warranty: string;
  paid: number;
  quoted: number | null;
  agent: string | null;
  createdAt: string;
  reasons: string[];
}

const normReg = (r?: string | null) => String(r || '').replace(/\s/g, '').toUpperCase();

const readDismissed = (): string[] => {
  try { return JSON.parse(localStorage.getItem(DISMISSED_KEY) || '[]'); } catch { return []; }
};

export const SaleNeedsAuthorisationAlert: React.FC = () => {
  const { isManagement } = useIsManagement();
  const adminMap = useAllAdminUsersMap() as any;
  const [flags, setFlags] = useState<Flag[]>([]);
  const [dismissed, setDismissed] = useState<string[]>(readDismissed);
  const [expanded, setExpanded] = useState(false);

  const load = useCallback(async () => {
    const since = new Date(Date.now() - LOOKBACK_DAYS * 86400000).toISOString();
    const { data: policies } = await supabase
      .from('customer_policies')
      .select('id, customer_id, customer_full_name, warranty_number, payment_amount, payment_type, payment_confirmed_by, created_at')
      .eq('is_manual_entry', true)
      .eq('is_deleted', false)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(300);
    if (!policies?.length) { setFlags([]); return; }

    const custIds = [...new Set(policies.map((p: any) => p.customer_id).filter(Boolean))];
    const { data: custs } = custIds.length
      ? await supabase.from('customers').select('id, registration_plate').in('id', custIds)
      : { data: [] as any[] };
    const regByCust = new Map((custs || []).map((c: any) => [c.id, normReg(c.registration_plate)]));

    const quoteSince = new Date(Date.now() - 90 * 86400000).toISOString();
    const { data: quotes } = await supabase
      .from('admin_sent_quotes')
      .select('vehicle_reg, customer_name, total_price, created_at')
      .gte('created_at', quoteSince)
      .order('created_at', { ascending: false })
      .limit(1000);

    const out: Flag[] = [];
    for (const p of policies as any[]) {
      const reg = regByCust.get(p.customer_id) || '';
      const name = String(p.customer_full_name || '').trim().toLowerCase();
      const match = (quotes || []).filter((q: any) =>
        (reg && normReg(q.vehicle_reg) === reg) ||
        (name && String(q.customer_name || '').trim().toLowerCase() === name));
      const quoted = match.length ? Math.max(...match.map((q: any) => Number(q.total_price) || 0)) : null;
      const paid = Number(p.payment_amount) || 0;
      const reasons = saleFlagReasons(paid, quoted, p.payment_type);
      if (!reasons.length) continue;
      out.push({
        id: p.id,
        name: p.customer_full_name || 'Customer',
        warranty: p.warranty_number || '',
        paid,
        quoted,
        agent: p.payment_confirmed_by || null,
        createdAt: p.created_at,
        reasons,
      });
    }
    setFlags(out);
  }, []);

  useEffect(() => {
    if (!isManagement) return;
    load();
    return setVisibleInterval(load, 60000);
  }, [isManagement, load]);

  if (!isManagement) return null;
  const live = flags.filter((f) => !dismissed.includes(f.id));
  if (!live.length) return null;

  const close = (id: string) => {
    const next = [...dismissed, id];
    setDismissed(next);
    try { localStorage.setItem(DISMISSED_KEY, JSON.stringify(next.slice(-500))); } catch { /* ignore */ }
  };

  const agentName = (id: string | null) => {
    if (!id) return 'Unknown agent';
    const a = adminMap?.[id] ?? adminMap?.get?.(id);
    return a?.name || [a?.first_name, a?.last_name].filter(Boolean).join(' ') || a?.email || 'Agent';
  };

  const shown = expanded ? live : live.slice(0, 1);

  return (
    <AlertRailSlot order={ALERT_RAIL_ORDER.saleNeedsAuthorisation}>
      <div className="rounded-lg border border-destructive border-l-4 bg-destructive text-destructive-foreground shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 px-3 py-2 font-semibold text-sm">
          <ShieldAlert className="h-4 w-4 shrink-0" />
          Sale needs authorisation ({live.length})
        </div>
        {shown.map((f) => (
          <div key={f.id} className="flex items-start justify-between gap-2 border-t border-destructive-foreground/20 px-3 py-2 text-xs">
            <div className="min-w-0">
              <div className="font-semibold">{f.name} · {f.warranty}</div>
              <div>Paid £{f.paid.toFixed(2)}{f.quoted ? ` · quoted £${f.quoted.toFixed(2)}` : ''}</div>
              <div>{f.reasons.join(' · ')}</div>
              <div className="opacity-90">Confirmed by {agentName(f.agent)} · {new Date(f.createdAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' })}</div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`Close alert for ${f.name}`}
              onClick={() => close(f.id)}
              className="h-6 w-6 shrink-0 hover:bg-destructive-foreground/10 hover:text-destructive-foreground"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ))}
        {live.length > 1 && (
          <Button
            type="button"
            variant="ghost"
            onClick={() => setExpanded((v) => !v)}
            className="h-auto w-full rounded-none border-t border-destructive-foreground/20 py-1.5 text-xs hover:bg-destructive-foreground/10 hover:text-destructive-foreground"
          >
            {expanded ? <>Show less <ChevronUp className="ml-1 h-3 w-3" /></> : <>See more ({live.length - 1}) <ChevronDown className="ml-1 h-3 w-3" /></>}
          </Button>
        )}
      </div>
    </AlertRailSlot>
  );
};

export default SaleNeedsAuthorisationAlert;
