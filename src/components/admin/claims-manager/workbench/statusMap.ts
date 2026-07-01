import type { Claim } from '@/types/claim';

// Admin operational lifecycle. Mapped from current simplified Claim.status,
// using rawStatus when present so we don't lose detail.
export type WorkflowStage =
  | 'new'
  | 'unassigned'
  | 'triage'
  | 'evidence_needed'
  | 'evidence_received'
  | 'in_review'
  | 'awaiting_authorisation'
  | 'approved_awaiting_invoice'
  | 'invoice_received'
  | 'payment_pending'
  | 'parts_order'
  | 'declined'
  | 'appealed'
  | 'cancelled'
  | 'closed';

export interface StageMeta {
  key: WorkflowStage;
  adminLabel: string;
  customerLabel: string;
  nextAction: string;
  // tailwind chip classes
  cls: string;
  // SLA hours from claim creation for this stage
  slaHours: number;
}

export const STAGE_META: Record<WorkflowStage, StageMeta> = {
  new: {
    key: 'new',
    adminLabel: 'New / Untriaged',
    customerLabel: 'Claim received',
    nextAction: 'Triage & assign',
    cls: 'bg-slate-100 text-slate-700 border-slate-200',
    slaHours: 4,
  },
  unassigned: {
    key: 'unassigned',
    adminLabel: 'Unassigned',
    customerLabel: 'Claim received',
    nextAction: 'Assign to handler',
    cls: 'bg-red-50 text-red-700 border-red-200',
    slaHours: 2,
  },
  triage: {
    key: 'triage',
    adminLabel: 'Triage',
    customerLabel: 'Claim received',
    nextAction: 'Initial review & route',
    cls: 'bg-slate-100 text-slate-700 border-slate-200',
    slaHours: 4,
  },
  evidence_needed: {
    key: 'evidence_needed',
    adminLabel: 'Evidence Needed',
    customerLabel: 'We need more information',
    nextAction: 'Chase evidence',
    cls: 'bg-amber-100 text-amber-800 border-amber-200',
    slaHours: 48,
  },
  evidence_received: {
    key: 'evidence_received',
    adminLabel: 'Evidence Received',
    customerLabel: 'We are reviewing your claim',
    nextAction: 'Review evidence',
    cls: 'bg-blue-50 text-blue-700 border-blue-200',
    slaHours: 8,
  },
  in_review: {
    key: 'in_review',
    adminLabel: 'In Review',
    customerLabel: 'We are reviewing your claim',
    nextAction: 'Decide eligibility',
    cls: 'bg-blue-100 text-blue-700 border-blue-200',
    slaHours: 24,
  },
  awaiting_authorisation: {
    key: 'awaiting_authorisation',
    adminLabel: 'Awaiting Authorisation',
    customerLabel: 'We are reviewing your claim',
    nextAction: 'Authorise repair',
    cls: 'bg-indigo-100 text-indigo-700 border-indigo-200',
    slaHours: 24,
  },
  approved_awaiting_invoice: {
    key: 'approved_awaiting_invoice',
    adminLabel: 'Approved — Awaiting Invoice',
    customerLabel: 'Repair authorised',
    nextAction: 'Request invoice',
    cls: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    slaHours: 72,
  },
  invoice_received: {
    key: 'invoice_received',
    adminLabel: 'Invoice Received',
    customerLabel: 'Invoice being checked',
    nextAction: 'Verify invoice & pay',
    cls: 'bg-teal-100 text-teal-700 border-teal-200',
    slaHours: 24,
  },
  payment_pending: {
    key: 'payment_pending',
    adminLabel: 'Payment Pending',
    customerLabel: 'Invoice being checked',
    nextAction: 'Release payment',
    cls: 'bg-teal-100 text-teal-700 border-teal-200',
    slaHours: 24,
  },
  parts_order: {
    key: 'parts_order',
    adminLabel: 'Parts Order',
    customerLabel: 'Parts being ordered',
    nextAction: 'Confirm parts & schedule repair',
    cls: 'bg-sky-100 text-sky-700 border-sky-200',
    slaHours: 48,
  },
  declined: {
    key: 'declined',
    adminLabel: 'Declined',
    customerLabel: 'Claim declined',
    nextAction: 'Notify customer',
    cls: 'bg-rose-100 text-rose-700 border-rose-200',
    slaHours: 9999,
  },
  appealed: {
    key: 'appealed',
    adminLabel: 'Appealed',
    customerLabel: 'Appeal under review',
    nextAction: 'Re-review claim',
    cls: 'bg-purple-100 text-purple-700 border-purple-200',
    slaHours: 48,
  },
  cancelled: {
    key: 'cancelled',
    adminLabel: 'Cancelled',
    customerLabel: 'Claim cancelled',
    nextAction: 'No action',
    cls: 'bg-zinc-100 text-zinc-700 border-zinc-200',
    slaHours: 9999,
  },
  closed: {
    key: 'closed',
    adminLabel: 'Closed',
    customerLabel: 'Claim completed',
    nextAction: 'No action',
    cls: 'bg-gray-100 text-gray-600 border-gray-200',
    slaHours: 9999,
  },
};

export const stageOrder: WorkflowStage[] = [
  'new',
  'unassigned',
  'triage',
  'evidence_needed',
  'evidence_received',
  'in_review',
  'awaiting_authorisation',
  'approved_awaiting_invoice',
  'invoice_received',
  'payment_pending',
  'parts_order',
  'declined',
  'appealed',
  'cancelled',
  'closed',
];

/**
 * Map a Claim to the new workflow stage.
 * Prefers rawStatus, falls back to simplified status, and overlays "unassigned"
 * when the claim has no owner and isn't already terminal.
 */
export function deriveStage(c: Claim): WorkflowStage {
  const raw = (c.rawStatus || '').toLowerCase().trim();

  // Direct matches from DB.
  if (raw === 'appealed' || raw === 'appeal') return 'appealed';
  if (raw === 'awaiting_info' || raw === 'awaiting_information' || raw === 'evidence_needed') return 'evidence_needed';
  if (raw === 'evidence_received') return 'evidence_received';
  if (raw === 'in_review' || raw === 'under_review' || raw === 'review') return 'in_review';
  if (raw === 'awaiting_authorisation' || raw === 'awaiting_authorization') return 'awaiting_authorisation';
  if (raw === 'approved') return 'approved_awaiting_invoice';
  if (raw === 'invoice_received') return 'invoice_received';
  if (raw === 'payment_pending' || raw === 'paid') return 'payment_pending';
  if (raw === 'parts_order' || raw === 'parts_ordered' || raw === 'awaiting_parts') return 'parts_order';
  if (raw === 'declined' || raw === 'rejected') return 'declined';
  if (raw === 'cancelled' || raw === 'canceled') return 'cancelled';
  if (raw === 'triage') return 'triage';
  if (raw === 'closed' || raw === 'resolved') return 'closed';

  // Fall back to simplified Claim.status.
  if (c.status === 'evidence') return 'evidence_needed';
  if (c.status === 'review') return 'in_review';
  if (c.status === 'approved') return 'approved_awaiting_invoice';
  if ((c.status as string) === 'closed') return 'closed';

  // Overdue is a flag, not a stage — keep it open and surface via SLA.
  if (c.assignee === 'unassigned' && (c.status as string) !== 'closed') return 'unassigned';
  return 'new';
}

// Map a target workflow stage back to a DB status value we can persist.
export const STAGE_TO_DB_STATUS: Record<WorkflowStage, string> = {
  new: 'new',
  unassigned: 'new',
  triage: 'triage',
  evidence_needed: 'awaiting_info',
  evidence_received: 'evidence_received',
  in_review: 'in_review',
  awaiting_authorisation: 'awaiting_authorisation',
  approved_awaiting_invoice: 'approved',
  invoice_received: 'invoice_received',
  payment_pending: 'payment_pending',
  parts_order: 'parts_order',
  declined: 'declined',
  appealed: 'appealed',
  cancelled: 'cancelled',
  closed: 'closed',
};
