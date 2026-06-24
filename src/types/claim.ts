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
  status: 'overdue' | 'evidence' | 'review' | 'approved' | 'open' | 'closed' | 'appealed';
  priority: 'critical' | 'high' | 'normal' | 'low';
  assignee: string;        // 'unassigned' or display name
  amount: number;
  evidence: 'Missing' | 'Partial' | 'Received';
  tier?: string;           // warranty/plan tier
  previousClaims?: number; // count of prior claims for the same reg
  // Raw values from DB so action handlers can update accurately
  rawStatus?: string | null;
  rawPriority?: string | null;
  // Days since the warranty was purchased (warranty_start_date → today)
  daysOnRisk?: number | null;
  // Mileage when the warranty was purchased (Step 4 input)
  purchaseMileage?: number | null;
  // Mileage on the make-a-claim form
  claimMileage?: number | null;
  // Attachments uploaded by the customer on /make-a-claim
  attachments?: ClaimAttachment[];
  // True if this registration also exists in customers as cancelled/refunded/soft-deleted
  hasCancellation?: boolean;
}
