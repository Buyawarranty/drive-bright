/**
 * RENEWALS SANDBOX — audit trail (Stage 8, Step 23)
 * ---------------------------------------------------------------------------
 * Every decision taken in the sandbox is recorded so that, when the engine goes
 * live, there is a ready-made trail of who did what to a renewal and why.
 *
 * Sandbox scope: entries are held in a capped localStorage ring buffer. NOTHING
 * is written to the database, so no live record is ever changed by a sandbox
 * action. The shape below is deliberately the shape a `renewal_audit_log` table
 * would take, so going live is an insert, not a rewrite.
 */

export type RenewalAuditAction =
  | 'viewed'
  | 'reserved'
  | 'released'
  | 'price_offered'
  | 'discount_requested'
  | 'approval_simulated'
  | 'quote_handoff'
  | 'completion_checked'
  | 'settings_changed';

export const AUDIT_ACTION_LABEL: Record<RenewalAuditAction, string> = {
  viewed: 'Opened renewal',
  reserved: 'Reserved from queue',
  released: 'Released back to queue',
  price_offered: 'Price offered',
  discount_requested: 'Discount above authority requested',
  approval_simulated: 'Manager approval (simulated)',
  quote_handoff: 'Sent to Quotes & Orders',
  completion_checked: 'Completion validated',
  settings_changed: 'Renewal settings changed',
};

export interface RenewalAuditEntry {
  id: string;
  at: string;
  action: RenewalAuditAction;
  policyId: string | null;
  policyNumber: string | null;
  customerName: string | null;
  /** Plain-English detail shown in the trail. */
  detail: string;
  /** Money involved, where the action was a price decision. */
  amount?: number | null;
  /** Sandbox marker — always true until the engine is live. */
  sandbox: true;
}

const KEY = 'renewals_sandbox_audit_v1';
const MAX = 300;

const listeners = new Set<() => void>();
let cache: RenewalAuditEntry[] | null = null;

export function getAuditTrail(): RenewalAuditEntry[] {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    cache = raw ? (JSON.parse(raw) as RenewalAuditEntry[]) : [];
  } catch {
    cache = [];
  }
  return cache;
}

export function recordRenewalAudit(entry: Omit<RenewalAuditEntry, 'id' | 'at' | 'sandbox'>) {
  const next: RenewalAuditEntry = {
    ...entry,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    at: new Date().toISOString(),
    sandbox: true,
  };
  cache = [next, ...getAuditTrail()].slice(0, MAX);
  try { localStorage.setItem(KEY, JSON.stringify(cache)); } catch { /* private mode */ }
  listeners.forEach((l) => l());
}

export function clearAuditTrail() {
  cache = [];
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
  listeners.forEach((l) => l());
}

export function subscribeAuditTrail(cb: () => void): () => void {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

/** CSV of the trail, ready for reporting once the engine is live. */
export function auditTrailCsv(entries = getAuditTrail()): string {
  const head = ['When', 'Action', 'Policy', 'Customer', 'Detail', 'Amount', 'Mode'];
  const rows = entries.map((e) => [
    e.at,
    AUDIT_ACTION_LABEL[e.action] || e.action,
    e.policyNumber || e.policyId || '',
    e.customerName || '',
    e.detail,
    typeof e.amount === 'number' ? String(e.amount) : '',
    'Sandbox',
  ]);
  return [head, ...rows]
    .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))
    .join('\n');
}
