export interface ClaimAttachment {
  url: string;
  name: string;
  size?: number;
  type?: string;
}

export interface Claim {
  id: string;
  date: string;            // formatted display date (e.g. "10 Apr 2026")
  reg: string;             // vehicle registration
  customerName: string;
  email: string;
  phone: string;
  issue: string;
  ageInDays: number;
  status: 'overdue' | 'evidence' | 'review' | 'approved' | 'open' | 'closed';
  priority: 'critical' | 'high' | 'normal' | 'low';
  assignee: string;        // 'unassigned' or display name
  amount: number;
  evidence: 'Missing' | 'Partial' | 'Received';
  tier?: string;           // warranty/plan tier
  previousClaims?: number; // count of prior claims for the same reg
  // Raw values from DB so action handlers can update accurately
  rawStatus?: string | null;
  rawPriority?: string | null;
  // Attachments uploaded by the customer on /make-a-claim
  attachments?: ClaimAttachment[];
}
