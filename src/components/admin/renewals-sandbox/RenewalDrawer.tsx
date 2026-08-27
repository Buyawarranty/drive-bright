import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Loader2, Phone, Mail, Car, ShieldCheck, UserCheck, Link2Off, Lock, PoundSterling, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import type { SandboxRow } from './types';
import { priceRenewal, getLifecycle, LIFECYCLE_LABEL } from './renewalPricing';
import {
  evaluateOwnership,
  SLA_LABEL,
  SLA_TONE,
  OWNERSHIP_REASON_LABEL,
  QUALIFYING_ACTIVITY_LABEL,
} from './renewalOwnership';
import { RenewalNegotiationPanel } from './RenewalNegotiationPanel';
import { useAllAdminUsersMap } from '@/hooks/useAllAdminUsersMap';

interface MatchedLead {
  id: string;
  first_name: string | null;
  last_name: string | null;
  status: string | null;
  assigned_to: string | null;
  created_at: string;
  last_contact_date: string | null;
}

interface Props {
  row: SandboxRow | null;
  live: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const money = (n: number | null | undefined) =>
  typeof n === 'number' ? `£${n.toLocaleString('en-GB')}` : '—';

export const RenewalDrawer: React.FC<Props> = ({ row, live, open, onOpenChange }) => {
  const [lead, setLead] = useState<MatchedLead | null>(null);
  const [loading, setLoading] = useState(false);

  const c = row?.customers;
  const email = (c?.email || row?.email || '').toLowerCase().trim();
  const phone = (c?.phone || '').replace(/\D/g, '');
  const tail9 = phone.length >= 9 ? phone.slice(-9) : '';

  useEffect(() => {
    if (!open || !row) { setLead(null); return; }
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const filters: string[] = [];
        if (email) filters.push(`email.ilike.${email}`);
        if (tail9) filters.push(`phone.ilike.%${tail9}`);
        if (!filters.length) { if (mounted) setLead(null); return; }
        const { data } = await (supabase.from('sales_leads') as any)
          .select('id, first_name, last_name, status, assigned_to, created_at, last_contact_date')
          .or(filters.join(','))
          .order('created_at', { ascending: false })
          .limit(1);
        if (mounted) setLead((data as MatchedLead[])?.[0] || null);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [open, row, email, tail9]);

  const name = [c?.first_name, c?.last_name].filter(Boolean).join(' ') || c?.name || row?.customer_full_name || '—';

  const quote = useMemo(() => (row ? priceRenewal(row) : null), [row]);
  const lifecycle = useMemo(() => (row ? getLifecycle(row) : null), [row]);

  const ownership = useMemo(
    () => (row ? evaluateOwnership(row, {
      lastTouchedAt: lead?.last_contact_date ?? null,
      lastActivity: lead?.last_contact_date ? 'call' : null,
    }) : null),
    [row, lead?.last_contact_date],
  );
  const adminMap = useAllAdminUsersMap(ownership?.ownerId ?? null);
  const staffName = (id?: string | null) => {
    if (!id) return null;
    const u = adminMap.get(id);
    return u ? ([u.first_name, u.last_name].filter(Boolean).join(' ') || u.email) : null;
  };
  const ownerName = staffName(ownership?.ownerId);
  const originalAgentName = staffName(ownership?.originalAgentId);

  return (

    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            {name}
            <Badge variant="outline" className="border-purple-200 bg-purple-100 text-purple-800">Renewal</Badge>
          </SheetTitle>
          <SheetDescription>
            {live ? 'Engine is live — actions will affect New Leads.' : 'Sandbox — everything here is read-only.'}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-5 text-sm">
          <section className="space-y-1">
            <h4 className="flex items-center gap-2 font-semibold"><ShieldCheck className="h-4 w-4" /> Current warranty</h4>
            <div className="grid grid-cols-2 gap-y-1">
              <span className="text-muted-foreground">Policy</span><span>{row?.policy_number || '—'}</span>
              <span className="text-muted-foreground">Plan</span><span>{row?.plan_type || '—'}</span>
              <span className="text-muted-foreground">Claim limit</span><span>{money(row?.claim_limit)}</span>
              <span className="text-muted-foreground">Starts</span>
              <span>{row?.policy_start_date ? format(new Date(row.policy_start_date), 'd MMM yyyy') : '—'}</span>
              <span className="text-muted-foreground">Expires</span>
              <span>{row?.policy_end_date ? format(new Date(row.policy_end_date), 'd MMM yyyy') : '—'}</span>
              <span className="text-muted-foreground">Payment</span><span>{row?.payment_type || '—'}</span>
            </div>
          </section>

          <Separator />

          <section className="space-y-1">
            <h4 className="flex items-center gap-2 font-semibold"><Car className="h-4 w-4" /> Vehicle & contact</h4>
            <div className="grid grid-cols-2 gap-y-1">
              <span className="text-muted-foreground">Vehicle</span>
              <span>{[c?.vehicle_make, c?.vehicle_model].filter(Boolean).join(' ') || '—'}</span>
              <span className="text-muted-foreground">Reg</span>
              <span className="uppercase">{c?.registration_plate || '—'}</span>
              <span className="text-muted-foreground">Phone</span><span>{c?.phone || '—'}</span>
              <span className="text-muted-foreground">Email</span><span className="break-all">{c?.email || row?.email || '—'}</span>
            </div>
          </section>

          <Separator />

          <section className="space-y-2">
            <h4 className="flex items-center gap-2 font-semibold"><UserCheck className="h-4 w-4" /> Matched CRM lead</h4>
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : lead ? (
              <div className="rounded-md border p-2">
                <div className="font-medium">
                  {[lead.first_name, lead.last_name].filter(Boolean).join(' ') || 'Existing lead'}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="secondary">{lead.status || 'new'}</Badge>
                  <span>Created {format(new Date(lead.created_at), 'd MMM yyyy')}</span>
                  {lead.last_contact_date && (
                    <span>Last contact {format(new Date(lead.last_contact_date), 'd MMM yyyy')}</span>
                  )}
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  A renewal going live would attach to this lead and stay with its current owner rather than creating a duplicate.
                </p>
              </div>
            ) : (
              <div className="flex items-start gap-2 rounded-md border border-dashed p-2 text-xs text-muted-foreground">
                <Link2Off className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                No existing lead matched on email or phone — going live would create a fresh renewal lead.
              </div>
            )}
          </section>

          <Separator />

          <section className="space-y-2">
            <h4 className="flex items-center gap-2 font-semibold">
              <PoundSterling className="h-4 w-4" /> Renewal offer
              {lifecycle && <Badge variant="secondary">{LIFECYCLE_LABEL[lifecycle]}</Badge>}
            </h4>
            {!quote ? null : quote.blocked ? (
              <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50/60 p-2 text-xs text-amber-900">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {quote.blockReason} — this renewal needs a manager decision before a price can be offered.
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-y-1">
                  <span className="text-muted-foreground">Like-for-like</span><span>{money(quote.standardPrice)}</span>
                  <span className="text-muted-foreground">Loyalty price (lead with)</span>
                  <span className="font-semibold">{money(quote.loyaltyPrice)}</span>
                  <span className="text-muted-foreground">Agent floor (no approval)</span><span>{money(quote.agentFloorPrice)}</span>
                  <span className="text-muted-foreground">Absolute minimum</span><span>{money(quote.netFloor)}</span>
                  <span className="text-muted-foreground">Paid last time</span><span>{money(quote.previousPrice)}</span>
                  {quote.deltaVsPrevious !== null && (
                    <>
                      <span className="text-muted-foreground">Change vs last year</span>
                      <span className={quote.deltaVsPrevious > 0 ? 'text-red-700' : 'text-emerald-700'}>
                        {quote.deltaVsPrevious > 0 ? '+' : ''}{money(quote.deltaVsPrevious)}
                      </span>
                    </>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Priced by the live quote engine for {quote.paymentPeriod.replace('months', ' months')}, £{quote.voluntaryExcess} excess,
                  {' '}£{quote.claimLimit.toLocaleString('en-GB')} claim limit, £{quote.labourRate}/hr labour. Anything below the agent floor
                  needs manager approval; nothing may go below the absolute minimum.
                </p>
                <RenewalNegotiationPanel quote={quote} live={live} />
              </>
            )}
          </section>

          <Separator />

          <section className="space-y-2">
            <h4 className="flex items-center gap-2 font-semibold"><UserCheck className="h-4 w-4" /> Ownership & SLA</h4>
            {ownership && (
              <>
                <div className="grid grid-cols-2 gap-y-1">
                  <span className="text-muted-foreground">Original selling agent</span>
                  <span>{originalAgentName || 'Website / unknown'}</span>
                  <span className="text-muted-foreground">Current owner</span>
                  <span>{ownerName || 'Renewal pool (round robin)'}</span>
                  <span className="text-muted-foreground">Why</span>
                  <span>{OWNERSHIP_REASON_LABEL[ownership.reason]}</span>
                  <span className="text-muted-foreground">Last qualifying activity</span>
                  <span>
                    {ownership.lastActivityAt
                      ? `${ownership.lastActivity ? QUALIFYING_ACTIVITY_LABEL[ownership.lastActivity] : 'Activity'} · ${format(new Date(ownership.lastActivityAt), 'd MMM yyyy')}`
                      : 'None yet'}
                  </span>
                  <span className="text-muted-foreground">Next action</span>
                  <span>{ownership.nextAction}</span>
                  <span className="text-muted-foreground">First-touch SLA</span>
                  <span>{ownership.slaHours}h</span>
                </div>
                <Badge variant="outline" className={SLA_TONE[ownership.slaState]}>
                  {SLA_LABEL[ownership.slaState]}
                  {ownership.hoursRemaining !== null && ownership.slaState !== 'breached'
                    ? ` · ${ownership.hoursRemaining}h left`
                    : ''}
                </Badge>
                <p className="text-xs text-muted-foreground">
                  A renewal never jumps its existing owner. If the first-touch SLA is missed it becomes eligible for the
                  renewal queue so another agent can pick it up.
                </p>
              </>
            )}
          </section>

          <Separator />


          <section className="space-y-2">
            <h4 className="font-semibold">Quick actions</h4>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" disabled={!live} asChild={live && !!c?.phone}>
                {live && c?.phone ? (
                  <a href={`tel:${c.phone}`}><Phone className="mr-1 h-4 w-4" /> Call</a>
                ) : (
                  <span><Phone className="mr-1 h-4 w-4" /> Call</span>
                )}
              </Button>
              <Button size="sm" variant="outline" disabled={!live} asChild={live && !!(c?.email || row?.email)}>
                {live && (c?.email || row?.email) ? (
                  <a href={`mailto:${c?.email || row?.email}`}><Mail className="mr-1 h-4 w-4" /> Email</a>
                ) : (
                  <span><Mail className="mr-1 h-4 w-4" /> Email</span>
                )}
              </Button>
              <Button size="sm" variant="outline" disabled>
                Push to New Leads
              </Button>
            </div>
            {!live && (
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                <Lock className="h-3 w-3" /> Actions unlock when the engine is switched live.
              </p>
            )}
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default RenewalDrawer;
