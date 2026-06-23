import type { Claim } from '@/types/claim';

export type EvidenceItemKey =
  | 'diagnosis'
  | 'estimate'
  | 'invoice'
  | 'service_history'
  | 'photos';

export interface EvidenceItem {
  key: EvidenceItemKey;
  label: string;
  /** Keywords to match against attachment file names. */
  match: string[];
  /** Customer-friendly message used when chasing this item. */
  requestMessage: (claim: Claim) => string;
}

export const EVIDENCE_ITEMS: EvidenceItem[] = [
  {
    key: 'diagnosis',
    label: 'Diagnosis report',
    match: ['diag', 'fault', 'report', 'scan'],
    requestMessage: (c) =>
      `To progress your claim for ${c.reg}, please send us the garage's diagnosis or fault report.`,
  },
  {
    key: 'estimate',
    label: 'Repair estimate',
    match: ['estimate', 'quote', 'quotation'],
    requestMessage: (c) =>
      `Please ask your repairer to send a written repair estimate for ${c.reg} before any work is carried out.`,
  },
  {
    key: 'invoice',
    label: 'Final invoice',
    match: ['invoice', 'receipt', 'bill'],
    requestMessage: (c) =>
      `Once the repair on ${c.reg} is complete, please send us the final invoice so we can release payment.`,
  },
  {
    key: 'service_history',
    label: 'Service history',
    match: ['service', 'history', 'logbook', 'book'],
    requestMessage: (c) =>
      `Please send us a copy of the service history for ${c.reg} (digital records or stamped service book).`,
  },
  {
    key: 'photos',
    label: 'Photos of the fault',
    match: ['photo', 'image', 'pic', '.jpg', '.jpeg', '.png', '.heic'],
    requestMessage: (c) =>
      `Please send a few clear photos of the fault on ${c.reg} so our team can review it.`,
  },
];

export interface EvidenceStatus {
  item: EvidenceItem;
  received: boolean;
  matches: { name: string; url?: string }[];
}

export function deriveEvidenceStatus(claim: Claim): EvidenceStatus[] {
  const attachments = claim.attachments ?? [];
  return EVIDENCE_ITEMS.map((item) => {
    const matches = attachments.filter((a) => {
      const n = (a.name || '').toLowerCase();
      return item.match.some((m) => n.includes(m.toLowerCase()));
    });
    return { item, received: matches.length > 0, matches };
  });
}
