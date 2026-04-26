import React, { useState } from 'react';
import { X, Phone, Mail, Car, Shield, History } from 'lucide-react';
import type { Claim } from '@/types/claim';

interface ClaimDetailPanelProps {
  claim: Claim | null;
  onClose: () => void;
}

const initials = (name: string) =>
  name.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('');

const statusBadgeMap: Record<Claim['status'], { label: string; cls: string }> = {
  overdue: { label: 'Overdue', cls: 'bg-red-100 text-red-700 border-red-200' },
  evidence: { label: 'Evidence Needed', cls: 'bg-amber-100 text-amber-700 border-amber-200' },
  review: { label: 'In Review', cls: 'bg-blue-100 text-blue-700 border-blue-200' },
  approved: { label: 'Approved', cls: 'bg-green-100 text-green-700 border-green-200' },
  open: { label: 'Open', cls: 'bg-gray-100 text-gray-700 border-gray-200' },
  closed: { label: 'Closed', cls: 'bg-gray-100 text-gray-600 border-gray-200' },
};

const priorityCls: Record<Claim['priority'], string> = {
  critical: 'bg-red-100 text-red-700 border-red-200',
  high: 'bg-amber-100 text-amber-700 border-amber-200',
  normal: 'bg-blue-100 text-blue-700 border-blue-200',
  low: 'bg-gray-100 text-gray-700 border-gray-200',
};

const evidenceCls: Record<Claim['evidence'], string> = {
  Missing: 'text-red-600',
  Partial: 'text-amber-600',
  Received: 'text-green-600',
};

const TIMELINE = [
  { color: 'bg-blue-500', text: 'Claim submitted by customer via online portal', time: '12 days ago' },
  { color: 'bg-amber-500', text: 'Evidence requested — photos and repair quote', time: '8 days ago' },
  { color: 'bg-green-500', text: 'Internal note added by claims handler', time: '2 days ago' },
];

const FooterBtn: React.FC<{ label: string; onClick: () => void; variant?: 'default' | 'primary' | 'danger' }> = ({
  label,
  onClick,
  variant = 'default',
}) => {
  const cls =
    variant === 'primary'
      ? 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700'
      : variant === 'danger'
      ? 'bg-red-600 text-white border-red-600 hover:bg-red-700'
      : 'bg-card text-foreground border-border hover:bg-muted';
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-9 px-3 rounded-md border text-sm font-medium transition-colors ${cls}`}
    >
      {label}
    </button>
  );
};

export const ClaimDetailPanel: React.FC<ClaimDetailPanelProps> = ({ claim, onClose }) => {
  const [statusDraft, setStatusDraft] = useState<Claim['status'] | ''>('');
  const [note, setNote] = useState('');

  if (!claim) return null;

  const status = statusBadgeMap[claim.status];
  const fire = (label: string) => () => alert(`${label}: ${claim.id} (${claim.reg})`);

  return (
    <div className="bg-card border border-border rounded-lg shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-start gap-3 p-4 border-b border-border bg-muted/30">
        <div className="h-10 w-10 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-sm font-semibold shrink-0">
          {initials(claim.customerName)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-foreground truncate">{claim.customerName}</div>
          <div className="text-xs text-muted-foreground">
            Claim #{claim.reg} · Opened {claim.date}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`inline-flex px-2 py-0.5 rounded text-[11px] font-semibold border ${status.cls}`}>
            {status.label}
          </span>
          <span className={`inline-flex px-2 py-0.5 rounded text-[11px] font-semibold border capitalize ${priorityCls[claim.priority]}`}>
            {claim.priority}
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close panel"
            className="ml-1 inline-flex items-center justify-center h-8 w-8 rounded border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 p-4">
        {/* Column 1: Customer */}
        <div className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Customer</h3>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2"><Mail className="h-4 w-4 text-muted-foreground" /> {claim.email}</div>
            <div className="flex items-center gap-2"><Phone className="h-4 w-4 text-muted-foreground" /> {claim.phone}</div>
            <div className="flex items-center gap-2"><Car className="h-4 w-4 text-muted-foreground" /> {claim.reg}</div>
            <div className="flex items-center gap-2"><Shield className="h-4 w-4 text-muted-foreground" /> Plan tier: <span className="font-semibold">Platinum</span></div>
            <div className="flex items-center gap-2"><History className="h-4 w-4 text-muted-foreground" /> Previous claims: <span className="font-semibold">2</span></div>
          </div>
        </div>

        {/* Column 2: Claim details */}
        <div className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Claim details</h3>
          <div className="space-y-2 text-sm">
            <div><span className="text-muted-foreground">Issue:</span> <div className="mt-0.5">{claim.issue}</div></div>
            <div>
              <span className="text-muted-foreground">Cost estimate:</span>{' '}
              <span className="font-mono font-semibold">£{claim.amount.toLocaleString()}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Evidence:</span>{' '}
              <span className={`font-semibold ${evidenceCls[claim.evidence]}`}>{claim.evidence}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Days open:</span>{' '}
              <span className={`font-semibold ${claim.ageInDays >= 10 ? 'text-red-600' : 'text-foreground'}`}>
                {claim.ageInDays}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Assignee:</span>{' '}
              <span className="font-semibold">{claim.assignee === 'unassigned' ? 'Unassigned' : claim.assignee}</span>
            </div>
          </div>

          <div className="pt-2 space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Update status
            </label>
            <div className="flex gap-2">
              <select
                value={statusDraft}
                onChange={(e) => setStatusDraft(e.target.value as Claim['status'])}
                className="flex-1 h-9 px-2 rounded-md border border-border bg-card text-sm"
              >
                <option value="">Select…</option>
                <option value="open">Open</option>
                <option value="evidence">Evidence Needed</option>
                <option value="review">In Review</option>
                <option value="approved">Approved</option>
                <option value="overdue">Overdue</option>
                <option value="closed">Closed</option>
              </select>
              <button
                type="button"
                className="h-9 px-3 rounded-md border border-blue-600 bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
              >
                Save Status
              </button>
            </div>
          </div>
        </div>

        {/* Column 3: Activity timeline */}
        <div className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Activity timeline</h3>
          <ul className="space-y-3">
            {TIMELINE.map((t, i) => (
              <li key={i} className="flex gap-2">
                <span className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${t.color}`} />
                <div className="text-sm">
                  <div className="text-foreground">{t.text}</div>
                  <div className="text-xs text-muted-foreground">{t.time}</div>
                </div>
              </li>
            ))}
          </ul>

          <div className="pt-2 space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Internal note
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="Add a note for the team…"
              className="w-full p-2 rounded-md border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <button
              type="button"
              className="h-9 px-3 rounded-md border border-blue-600 bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
            >
              Save Note
            </button>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex flex-wrap items-center justify-end gap-2 p-4 border-t border-border bg-muted/30">
        <FooterBtn label="Escalate" onClick={fire('Escalate')} variant="danger" />
        <FooterBtn label="Request Evidence" onClick={fire('Request Evidence')} />
        <FooterBtn label="Log Call" onClick={fire('Log Call')} />
        <FooterBtn label="Approve Claim" onClick={fire('Approve Claim')} variant="primary" />
        <FooterBtn label="Close Claim" onClick={fire('Close Claim')} />
      </div>
    </div>
  );
};
