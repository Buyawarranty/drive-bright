import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Gavel, CheckCircle2, Paperclip, Mail, Scale, ExternalLink } from 'lucide-react';
import { ReturnedAppeal } from '@/hooks/useReturnedAppeals';

/** Every appeal submitted/opened from the Claims tab, with its outcome. */
interface SentAppeal {
  id: string;
  claimId: string;
  sentAt: string | null;
  createdAt: string;
  status: string | null;
  closedAt: string | null;
  customerEmail: string | null;
  customerName: string | null;
  registration: string | null;
}

const outcomeLabel = (a: SentAppeal): { text: string; className: string } => {
  if (a.closedAt) {
    const s = (a.status || '').toLowerCase();
    if (s.includes('upheld') || s.includes('accepted') || s.includes('approved'))
      return { text: 'Closed — upheld', className: 'bg-emerald-100 border-emerald-300 text-emerald-800' };
    if (s.includes('reject') || s.includes('declin') || s.includes('dismiss'))
      return { text: 'Closed — not upheld', className: 'bg-slate-100 border-slate-300 text-slate-700' };
    return { text: 'Closed', className: 'bg-slate-100 border-slate-300 text-slate-700' };
  }
  const s = (a.status || '').toLowerCase();
  if (s === 'invited') return { text: 'Invited — awaiting customer', className: 'bg-amber-100 border-amber-300 text-amber-800' };
  if (s === 'submitted') return { text: 'Submitted — awaiting review', className: 'bg-blue-100 border-blue-300 text-blue-800' };
  return { text: a.status || 'Open', className: 'bg-amber-100 border-amber-300 text-amber-800' };
};

interface AppealsInboxPanelProps {
  appeals: ReturnedAppeal[];
  loading?: boolean;
  onMarkAsRead: (id: string) => void;
  onOpenAppealDialog?: () => void;
}

const formatDate = (value?: string | null) => {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return '—';
  }
};

export const AppealsInboxPanel: React.FC<AppealsInboxPanelProps> = ({
  appeals,
  loading,
  onMarkAsRead,
  onOpenAppealDialog,
}) => {
  const unreadCount = appeals.filter(a => !a.isRead).length;

  return (
    <section className="rounded-2xl border border-amber-200 bg-white overflow-hidden">
      <header className="flex items-center justify-between flex-wrap gap-3 px-4 py-3 bg-amber-50 border-b border-amber-200">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[#E8541A]/10">
            <Gavel className="h-4 w-4 text-[#E8541A]" />
          </span>
          <div>
            <h2 className="text-base font-semibold text-amber-900 leading-tight">Appeals</h2>
            <p className="text-[11px] text-amber-700">Appeals returned by customers, with everything they sent back</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge className="bg-[#E8541A] text-white hover:bg-[#E8541A]">
            {appeals.length} appeal{appeals.length === 1 ? '' : 's'} back
          </Badge>
          {unreadCount > 0 && (
            <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-800">
              {unreadCount} new
            </Badge>
          )}
          {/* The customer-facing appeal form — same public design as /complaints/ */}
          <Button size="sm" variant="outline" className="bg-white" asChild>
            <a href="/appeals/" target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-3.5 w-3.5 mr-1" /> Public appeal form
            </a>
          </Button>
          {onOpenAppealDialog && (
            <Button size="sm" variant="outline" className="bg-white" onClick={onOpenAppealDialog}>
              <Scale className="h-3.5 w-3.5 mr-1" /> Open appeal
            </Button>
          )}
        </div>
      </header>

      <div className="p-4 space-y-3">
        {loading && <p className="text-sm text-muted-foreground">Loading appeals…</p>}

        {!loading && appeals.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No appeals have come back yet. Returned appeals appear here the moment a customer submits their appeal form.
          </p>
        )}

        {appeals.map(a => (
          <article
            key={a.id}
            className={`rounded-xl border p-3 ${a.isRead ? 'border-slate-200 bg-white' : 'border-[#E8541A]/40 bg-orange-50/60'}`}
          >
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-[#1A2B4A]">
                    {(a.registration || 'No reg').toUpperCase()}
                  </span>
                  <span className="text-sm text-slate-600">{a.customerName || 'Unknown customer'}</span>
                  {!a.isRead && <Badge className="bg-[#E8541A] text-white hover:bg-[#E8541A]">New</Badge>}
                  {a.statusUpdate && (
                    <Badge variant="outline" className="border-slate-300 text-slate-700">{a.statusUpdate}</Badge>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Returned {formatDate(a.createdAt)}
                  {a.appealSentAt ? ` · appeal sent ${formatDate(a.appealSentAt)}` : ''}
                </p>
              </div>
              {!a.isRead && (
                <Button size="sm" variant="outline" onClick={() => onMarkAsRead(a.id)}>
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Mark as read
                </Button>
              )}
            </div>

            <dl className="mt-3 grid gap-2 sm:grid-cols-2 text-sm">
              {a.claimReason && (
                <div>
                  <dt className="text-[11px] uppercase tracking-wide text-slate-500">Claim</dt>
                  <dd className="text-slate-800">{a.claimReason}</dd>
                </div>
              )}
              {a.appealReason && (
                <div>
                  <dt className="text-[11px] uppercase tracking-wide text-slate-500">Grounds for appeal</dt>
                  <dd className="text-slate-800">{a.appealReason}</dd>
                </div>
              )}
              {a.notes && (
                <div className="sm:col-span-2">
                  <dt className="text-[11px] uppercase tracking-wide text-slate-500">What the customer sent back</dt>
                  <dd className="text-slate-800 whitespace-pre-wrap">{a.notes}</dd>
                </div>
              )}
              {a.independentReviewer && (
                <div>
                  <dt className="text-[11px] uppercase tracking-wide text-slate-500">Independent inspection</dt>
                  <dd className="text-slate-800">
                    {a.independentReviewer}
                    {a.appealFee ? ` · £${a.appealFee}` : ''}
                  </dd>
                </div>
              )}
              {a.invoiceAmount != null && (
                <div>
                  <dt className="text-[11px] uppercase tracking-wide text-slate-500">Invoice amount</dt>
                  <dd className="text-slate-800">£{Number(a.invoiceAmount).toLocaleString('en-GB')}</dd>
                </div>
              )}
            </dl>

            <div className="mt-3 flex items-center gap-3 flex-wrap text-xs">
              {a.respondentEmail && (
                <a href={`mailto:${a.respondentEmail}`} className="inline-flex items-center gap-1 text-[#1A2B4A] hover:underline">
                  <Mail className="h-3.5 w-3.5" /> {a.respondentEmail}
                </a>
              )}
              {a.fileUrl && (
                <a href={a.fileUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[#E8541A] hover:underline">
                  <Paperclip className="h-3.5 w-3.5" /> {a.fileName || 'Supporting evidence'}
                </a>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
};
