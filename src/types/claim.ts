export interface ClaimAttachment {
  url: string;
  name: string;
  size?: number;
  type?: string;
  /** 'evidence' when added later via /add-claim-evidence, otherwise undefined (original submission). */
  addedAs?: string;
  addedAt?: string;
  evidenceLabel?: string;
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
  // Vehicle info sourced from customers table (matched by reg)
  vehicleMake?: string | null;
  vehicleModel?: string | null;
  // Plan financial terms from customers table
  claimLimit?: number | null;
  voluntaryExcess?: number | null;
  labourRate?: number | null;
  // True if this registration also exists in customers as cancelled/refunded/soft-deleted
  hasCancellation?: boolean;
  // False when no active customer/policy could be matched to this claim's reg
  hasMatchingPolicy?: boolean;
  // Admin-flagged customer review sentiment ('positive' | 'negative' | null)
  reviewSentiment?: 'positive' | 'negative' | null;
  // Ordinal position of this claim across all claims from the same customer
  // (matched by email OR phone). 1 = first claim ever, 2 = second, etc.
  customerClaimIndex?: number;
  customerClaimTotal?: number;
  customerClaimMatchedBy?: 'email' | 'phone' | 'both' | null;
  /** True when >1 distinct submitter (email/phone) has filed a claim for the same reg — e.g. customer + garage. */
  duplicateSubmission?: boolean;
  duplicateSubmitterCount?: number;
  // Date and time the claim was submitted.
  submittedAt?: string;
  // Admin-editable settlement figures. Difference = claimedAmount - paidAmount.
  claimedAmount?: number | null;
  paidAmount?: number | null;
  // Populated when a public complaint has been submitted for this claim's reg/email
  complaint?: {
    reference: string;
    category: string;
    submittedAt: string;
    status: string;
  } | null;
}
