import type { Claim } from '@/types/claim';
import { deriveStage } from './statusMap';
import { computeSla } from './sla';

export type QueueKey =
  | 'all'
  | 'new'
  | 'unassigned'
  | 'evidence_needed'
  | 'evidence_received'
  | 'in_review'
  | 'awaiting_authorisation'
  | 'approved_awaiting_invoice'
  | 'invoice_received'
  | 'payment_pending'
  | 'declined'
  | 'closed'
  | 'appealed'
  | 'overdue'
  | 'high_priority'
  | 'my_claims';

export interface QueueDef {
  key: QueueKey;
  label: string;
  description?: string;
  group: 'work' | 'workflow' | 'review';
  match: (c: Claim, ctx: QueueContext) => boolean;
}

export interface QueueContext {
  currentUserName?: string | null;
}

export const QUEUES: QueueDef[] = [
  { key: 'all', label: 'All Claims', group: 'work', match: () => true },
  { key: 'new', label: 'New / Untriaged', group: 'work', match: (c) => deriveStage(c) === 'new' },
  { key: 'unassigned', label: 'Unassigned', group: 'work', match: (c) => c.assignee === 'unassigned' && c.status !== 'closed' },
  { key: 'overdue', label: 'Overdue SLA', group: 'work', match: (c) => computeSla(c).tone === 'overdue' && c.status !== 'closed' },
  { key: 'high_priority', label: 'High Priority', group: 'work', match: (c) => (c.priority === 'critical' || c.priority === 'high') && c.status !== 'closed' },
  { key: 'my_claims', label: 'My Claims', group: 'work', match: (c, ctx) => !!ctx.currentUserName && c.assignee === ctx.currentUserName },

  { key: 'evidence_needed', label: 'Evidence Needed', group: 'workflow', match: (c) => deriveStage(c) === 'evidence_needed' },
  { key: 'evidence_received', label: 'Evidence Received', group: 'workflow', match: (c) => deriveStage(c) === 'evidence_received' },
  { key: 'in_review', label: 'In Review', group: 'workflow', match: (c) => deriveStage(c) === 'in_review' },
  { key: 'awaiting_authorisation', label: 'Awaiting Authorisation', group: 'workflow', match: (c) => deriveStage(c) === 'awaiting_authorisation' },
  { key: 'approved_awaiting_invoice', label: 'Approved — Awaiting Invoice', group: 'workflow', match: (c) => deriveStage(c) === 'approved_awaiting_invoice' },
  { key: 'invoice_received', label: 'Invoice Received', group: 'workflow', match: (c) => deriveStage(c) === 'invoice_received' },
  { key: 'payment_pending', label: 'Payment Pending', group: 'workflow', match: (c) => deriveStage(c) === 'payment_pending' },

  { key: 'declined', label: 'Declined', group: 'review', match: (c) => deriveStage(c) === 'declined' },
  { key: 'appealed', label: 'Appealed', group: 'review', match: (c) => deriveStage(c) === 'appealed' },
  { key: 'closed', label: 'Closed', group: 'review', match: (c) => deriveStage(c) === 'closed' },
];

export function countQueue(claims: Claim[], q: QueueDef, ctx: QueueContext): number {
  let n = 0;
  for (const c of claims) if (q.match(c, ctx)) n++;
  return n;
}
