import React from 'react';
import { X, ExternalLink } from 'lucide-react';
import type { Claim } from '@/types/claim';
import { cn } from '@/lib/utils';
import { ClaimNotesPanel } from '@/components/admin/claims/ClaimNotesPanel';
import { ClaimAttachmentsPanel } from './ClaimAttachmentsPanel';

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
export const ClaimDrawer: React.FC<Props> = ({ claim, onClose, fullPage = false }) => {
  if (!claim) return null;

  return (
    <aside
      className={cn(
        'bg-card border border-border rounded-lg overflow-hidden flex flex-col',
        fullPage
          ? 'w-full'
          : 'w-full lg:w-[460px] xl:w-[520px] shrink-0 max-h-[calc(100vh-160px)] lg:sticky lg:top-4',
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

      {/* Body — attachments + timed notes */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <ClaimAttachmentsPanel attachments={claim.attachments ?? []} />
        <ClaimNotesPanel claimId={claim.id} />
      </div>
    </aside>
  );
};
