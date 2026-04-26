export interface Claim {
  id: string;
  date: string;
  reg: string;
  customerName: string;
  email: string;
  phone: string;
  issue: string;
  ageInDays: number;
  status: 'overdue' | 'evidence' | 'review' | 'approved' | 'open' | 'closed';
  priority: 'critical' | 'high' | 'normal' | 'low';
  assignee: string;
  amount: number;
  evidence: 'Missing' | 'Partial' | 'Received';
}
