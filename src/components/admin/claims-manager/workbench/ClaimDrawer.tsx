import React from 'react';
import { X, ExternalLink, AlertOctagon, AlertCircle } from 'lucide-react';
import type { Claim } from '@/types/claim';
import { cn } from '@/lib/utils';
import { ClaimNotesPanel } from '@/components/admin/claims/ClaimNotesPanel';
import { ClaimCommunicationsPanel } from '@/components/admin/claims/ClaimCommunicationsPanel';
import { ClaimAttachmentsPanel } from './ClaimAttachmentsPanel';
import { ClaimCallsLog } from './ClaimCallsLog';
import { formatDaysOnRisk } from './formatters';


interface Props {
  claim: Claim | null;
  onClose: () => void;
  /** Optional — kept for backwards-compat with callers. Notes panel manages its own writes. */
  onUpdated?: () => void | Promise<void>;
  /** Render in full-page mode (used by /admin/claims/:id). */
  fullPage?: boolean;
}

const initials = (name: string) =>
  name.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('');

/**
 * Slim claim side panel — mirrors the Leads quick-notes pattern.
 * Just a header (identity + close) plus a timed notes timeline.
 */
const fmtGBP = (n?: number | null) => {
  if (n == null || !Number.isFinite(Number(n))) return '—';
  return `£${Number(n).toLocaleString('en-GB', { maximumFractionDigits: 0 })}`;
};

export const ClaimDrawer: React.FC<Props> = ({ claim, onClose, onUpdated, fullPage = false }) => {
  if (!claim) return null;

  return (
    <aside
      className={cn(
        'bg-card overflow-hidden flex flex-col',
        fullPage
          ? 'w-full h-full border-0 rounded-none'
          : 'border border-border rounded-lg w-full lg:w-[460px] xl:w-[520px] shrink-0 max-h-[calc(100vh-160px)] lg:sticky lg:top-4',
      )}
    >
      {/* Header */}
      <div className="p-4 border-b border-border bg-muted/30">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 shrink-0 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-sm font-semibold">
            {initials(claim.customerName)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-foreground truncate">{claim.customerName}</div>
            <div className="text-xs text-muted-foreground">
              Claim BAW-{claim.reg} · Opened {claim.date}
            </div>
          </div>
          {!fullPage && (
            <a
              href={`/admin/claims/${claim.id}`}
              target="_blank"
              rel="noreferrer"
              title="Open full page"
              className="h-8 w-8 inline-flex items-center justify-center rounded border border-border bg-card hover:bg-muted text-muted-foreground"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label={fullPage ? 'Back to claims' : 'Close drawer'}
            className="h-8 w-8 inline-flex items-center justify-center rounded border border-border bg-card hover:bg-muted text-muted-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Body — vehicle + plan terms + complaint banner + attachments + timed notes */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Vehicle + plan terms */}
        <div className="rounded-lg border border-border bg-muted/20 p-3">
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
            <div>
              <div className="text-muted-foreground">Vehicle</div>
              <div className="font-medium text-foreground">
                {[claim.vehicleMake, claim.vehicleModel].filter(Boolean).join(' ') || '—'}
              </div>
            </div>
            <div>
              <div className="text-muted-foreground">Registration</div>
              <div className="font-mono font-semibold text-foreground">{claim.reg}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Claim limit</div>
              <div className="font-medium text-foreground">{fmtGBP(claim.claimLimit)}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Voluntary excess</div>
              <div className="font-medium text-foreground">{fmtGBP(claim.voluntaryExcess)}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Labour rate</div>
              <div className="font-medium text-foreground">
                {claim.labourRate != null ? `${fmtGBP(claim.labourRate)}/hr` : '—'}
              </div>
            </div>
            {claim.tier && (
              <div>
                <div className="text-muted-foreground">Plan</div>
                <div className="font-medium text-foreground capitalize">{claim.tier}</div>
              </div>
            )}
          </div>
        </div>

        {claim.complaint && (
          <div className="rounded-lg border-2 border-red-300 bg-red-50 p-3 flex items-start gap-3">
            <AlertOctagon className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-red-800">
                Complaint submitted
              </div>
              <div className="text-xs text-red-700 mt-0.5">
                Ref <span className="font-mono">{claim.complaint.reference}</span>
                {' · '}
                {claim.complaint.category}
                {' · '}
                {new Date(claim.complaint.submittedAt).toLocaleDateString('en-GB', {
                  day: '2-digit', month: 'short', year: 'numeric',
                })}
              </div>
              <a
                href={`/admin-dashboard/?tab=complaints`}
                target="_blank"
                rel="noreferrer"
                className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-red-700 underline hover:text-red-900"
              >
                Open in Complaints portal
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        )}
        {/* Reported issue */}
        <div className="rounded-lg border border-border bg-card p-3">
          <div className="flex items-center gap-2 mb-1.5">
            <AlertCircle className="h-4 w-4 text-orange-500" />
            <span className="text-sm font-semibold text-foreground">Reported issue</span>
          </div>
          <p className="text-sm text-foreground/90 whitespace-pre-wrap">{claim.issue || '—'}</p>
        </div>

        {/* Risk days + mileage since inception */}
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg border border-border bg-muted/20 p-3">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Days on risk</div>
            <div className="text-lg font-bold text-foreground mt-1">
              {formatDaysOnRisk(claim.daysOnRisk)}
            </div>

            <div className="text-[10px] text-muted-foreground">Since warranty purchase</div>
          </div>
          <div className="rounded-lg border border-border bg-muted/20 p-3">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Since claim</div>
            <div className="text-lg font-bold text-foreground mt-1">
              {claim.ageInDays != null ? `${claim.ageInDays}d` : '—'}
            </div>
            <div className="text-[10px] text-muted-foreground">Days open</div>
          </div>
          <div className="rounded-lg border border-border bg-muted/20 p-3">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Miles driven</div>
            <div className="text-lg font-bold text-foreground mt-1">
              {(() => {
                const p = claim.purchaseMileage;
                const cur = claim.claimMileage;
                if (p == null || cur == null) return '—';
                const driven = cur - p;
                return `${driven < 0 ? '-' : ''}${Math.abs(driven).toLocaleString()}`;
              })()}
            </div>
            <div className="text-[10px] text-muted-foreground">
              {claim.purchaseMileage != null
                ? `From ${claim.purchaseMileage.toLocaleString()} mi`
                : 'Since inception'}
            </div>
          </div>
        </div>

        <ClaimAttachmentsPanel
          attachments={claim.attachments ?? []}
          claimId={claim.id}
          onUploaded={onUpdated}
        />
        <ClaimCommunicationsPanel claimId={claim.id} />
        <ClaimCallsLog phone={claim.phone} />
        <ClaimNotesPanel claimId={claim.id} />
      </div>
    </aside>
  );
};
