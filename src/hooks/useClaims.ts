import { useEffect, useMemo, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Claim, ClaimAttachment } from '@/types/claim';

const buildAttachments = (row: any): ClaimAttachment[] => {
  const list: ClaimAttachment[] = [];
  const rawList: any[] = Array.isArray(row.file_urls) ? row.file_urls : [];
  rawList.forEach((f) => {
    const url = f?.publicUrl || f?.url;
    if (!url) return;
    list.push({
      url,
      name: f?.name || 'attachment',
      size: f?.size,
      type: f?.type,
      addedAs: f?.addedAs,
      addedAt: f?.addedAt,
      evidenceLabel: f?.evidenceLabel,
    });
  });
  if (list.length === 0 && row.file_url) {
    list.push({ url: row.file_url, name: row.file_name || 'attachment', size: row.file_size });
  }
  return list;
};

/**
 * Maps a raw claims_submissions row + DB status string into the simplified
 * Claim shape used by the new Claims Manager UI.
 */
const STATUS_MAP: Record<string, Claim['status']> = {
  // direct matches
  overdue: 'overdue',
  evidence: 'evidence',
  evidence_needed: 'evidence',
  awaiting_info: 'evidence',
  awaiting_information: 'evidence',
  review: 'review',
  in_review: 'review',
  under_review: 'review',
  approved: 'approved',
  open: 'open',
  new: 'open',
  pending: 'open',
  closed: 'closed',
  paid: 'closed',
  resolved: 'closed',
  rejected: 'closed',
  appealed: 'appealed',
  appeal: 'appealed',
};

const PRIORITY_MAP: Record<string, Claim['priority']> = {
  critical: 'critical',
  urgent: 'critical',
  high: 'high',
  normal: 'normal',
  medium: 'normal',
  low: 'low',
};

const formatDate = (iso?: string | null) => {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
};

const daysBetween = (iso?: string | null) => {
  if (!iso) return 0;
  const ms = Date.now() - new Date(iso).getTime();
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
};

const inferEvidence = (row: any): Claim['evidence'] => {
  const single = !!row.file_url;
  const multi = Array.isArray(row.file_urls) && row.file_urls.length > 0;
  if (multi && Array.isArray(row.file_urls) && row.file_urls.length >= 2) return 'Received';
  if (single || multi) return 'Partial';
  return 'Missing';
};

const inferStatus = (raw: string | null | undefined, ageDays: number): Claim['status'] => {
  const key = (raw || '').toLowerCase();
  const mapped = STATUS_MAP[key];
  if (mapped) {
    // Promote stale "open"/"new" to "overdue" after 7 days for visibility
    if ((mapped === 'open' || mapped === 'evidence') && ageDays >= 7) return 'overdue';
    return mapped;
  }
  return ageDays >= 7 ? 'overdue' : 'open';
};

const inferPriority = (raw: string | null | undefined, amount: number, ageDays: number): Claim['priority'] => {
  const key = (raw || '').toLowerCase();
  const mapped = PRIORITY_MAP[key];
  if (mapped) return mapped;
  if (amount >= 1500 || ageDays >= 14) return 'critical';
  if (amount >= 800 || ageDays >= 7) return 'high';
  if (amount > 0) return 'normal';
  return 'low';
};

interface UseClaimsResult {
  claims: Claim[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

const normReg = (s?: string | null) => (s || '').toString().toUpperCase().replace(/\s+/g, '').trim();

interface CustomerVehicleInfo {
  make?: string | null;
  model?: string | null;
  claimLimit?: number | null;
  voluntaryExcess?: number | null;
  labourRate?: number | null;
}

export const useClaims = (): UseClaimsResult => {
  const [rows, setRows] = useState<any[]>([]);
  const [staffById, setStaffById] = useState<Record<string, string>>({});
  const [customerMileageByReg, setCustomerMileageByReg] = useState<Record<string, number>>({});
  const [customerStartByReg, setCustomerStartByReg] = useState<Record<string, string>>({});
  const [customerInfoByReg, setCustomerInfoByReg] = useState<Record<string, CustomerVehicleInfo>>({});
  const [cancelledRegs, setCancelledRegs] = useState<Set<string>>(new Set());
  const [complaintsByReg, setComplaintsByReg] = useState<Record<string, Claim['complaint']>>({});
  const [complaintsByEmail, setComplaintsByEmail] = useState<Record<string, Claim['complaint']>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [{ data: claimRows, error: claimErr }, { data: staffRows }, { data: customerRows }, { data: policyRows }, { data: complaintRows }] = await Promise.all([
        supabase
          .from('claims_submissions')
          .select('*')
          .neq('status', 'fake_test')
          .order('created_at', { ascending: false })
          .limit(1000),
        supabase
          .from('admin_users')
          .select('user_id, first_name, last_name, email')
          .eq('is_active', true),
        supabase
          .from('customers')
          .select('id, registration_plate, mileage, status, is_deleted, vehicle_make, vehicle_model, claim_limit, voluntary_excess, labour_rate')
          .not('registration_plate', 'is', null)
          .limit(5000),
        supabase
          .from('customer_policies')
          .select('customer_id, policy_start_date')
          .not('policy_start_date', 'is', null)
          .order('policy_start_date', { ascending: true })
          .limit(10000),
        supabase
          .from('complaints')
          .select('reference, category, status, email, registration_plate, warranty_ref, created_at')
          .order('created_at', { ascending: false })
          .limit(2000),
      ]);

      if (claimErr) throw claimErr;

      const lookup: Record<string, string> = {};
      (staffRows || []).forEach((s: any) => {
        const name = [s.first_name, s.last_name].filter(Boolean).join(' ').trim() || s.email || 'Staff';
        if (s.user_id) lookup[s.user_id] = name;
      });

      const mileageByReg: Record<string, number> = {};
      const startByCustomerId: Record<string, string> = {};
      (policyRows || []).forEach((p: any) => {
        if (p.customer_id && p.policy_start_date && !startByCustomerId[p.customer_id]) {
          startByCustomerId[p.customer_id] = p.policy_start_date;
        }
      });
      const startByReg: Record<string, string> = {};
      const cancelled = new Set<string>();
      const liveActiveRegs = new Set<string>();
      const infoByReg: Record<string, CustomerVehicleInfo> = {};
      (customerRows || []).forEach((c: any) => {
        const reg = normReg(c.registration_plate);
        if (!reg) return;
        const m = Number(c.mileage);
        if (Number.isFinite(m) && m > 0 && !mileageByReg[reg]) {
          mileageByReg[reg] = m;
        }
        const start = c.id ? startByCustomerId[c.id] : null;
        if (start && !startByReg[reg]) {
          startByReg[reg] = start;
        }
        const st = (c.status || '').toLowerCase();
        // Archived (soft-deleted) duplicate records must never mark a reg as
        // cancelled — the live record for the same vehicle is what counts.
        if (!c.is_deleted) {
          if (st === 'cancelled' || st === 'refunded') {
            cancelled.add(reg);
          } else {
            liveActiveRegs.add(reg);
          }
        }

        // Prefer the first non-null values seen for this reg
        const existing = infoByReg[reg] || {};
        infoByReg[reg] = {
          make: existing.make ?? c.vehicle_make ?? null,
          model: existing.model ?? c.vehicle_model ?? null,
          claimLimit: existing.claimLimit ?? (c.claim_limit != null ? Number(c.claim_limit) : null),
          voluntaryExcess: existing.voluntaryExcess ?? (c.voluntary_excess != null ? Number(c.voluntary_excess) : null),
          labourRate: existing.labourRate ?? (c.labour_rate != null ? Number(c.labour_rate) : null),
        };
      });

      // Index complaints by normalized reg and by lowercase email; newest wins (rows already DESC).
      const cRegMap: Record<string, Claim['complaint']> = {};
      const cEmailMap: Record<string, Claim['complaint']> = {};
      (complaintRows || []).forEach((c: any) => {
        const info = {
          reference: c.reference,
          category: c.category,
          submittedAt: c.created_at,
          status: c.status,
        };
        const reg = normReg(c.registration_plate) || normReg(c.warranty_ref);
        if (reg && !cRegMap[reg]) cRegMap[reg] = info;
        const em = (c.email || '').toString().toLowerCase().trim();
        if (em && !cEmailMap[em]) cEmailMap[em] = info;
      });

      setStaffById(lookup);
      setCustomerMileageByReg(mileageByReg);
      setCustomerStartByReg(startByReg);
      setCustomerInfoByReg(infoByReg);
      // If any live record for the reg is still active, the vehicle is covered.
      liveActiveRegs.forEach((reg) => cancelled.delete(reg));
      setCancelledRegs(cancelled);

      setComplaintsByReg(cRegMap);
      setComplaintsByEmail(cEmailMap);
      setRows(claimRows || []);
    } catch (e: any) {
      console.error('useClaims fetch error', e);
      setError(e?.message || 'Failed to load claims');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const claims = useMemo<Claim[]>(() => {
    // Pre-compute previous-claim counts per registration
    const regCounts = new Map<string, number>();
    // Distinct submitters per reg (customer vs garage vs 3rd party)
    const submittersByReg = new Map<string, Set<string>>();
    rows.forEach((r) => {
      const reg = (r.vehicle_registration || '').toLowerCase().trim();
      if (!reg) return;
      regCounts.set(reg, (regCounts.get(reg) || 0) + 1);
      const submitter =
        (r.email || '').toString().toLowerCase().trim() ||
        (r.phone || '').toString().replace(/\D+/g, '') ||
        (r.name || '').toString().toLowerCase().trim();
      if (!submitter) return;
      if (!submittersByReg.has(reg)) submittersByReg.set(reg, new Set());
      submittersByReg.get(reg)!.add(submitter);
    });

    // Assign chronological index (1..N oldest→newest) per reg. Rows are DESC.
    const indexByRowId = new Map<string, number>();
    const seenPerReg = new Map<string, number>();
    for (let i = rows.length - 1; i >= 0; i--) {
      const r = rows[i];
      const reg = (r.vehicle_registration || '').toLowerCase().trim();
      if (!reg) continue;
      const next = (seenPerReg.get(reg) || 0) + 1;
      seenPerReg.set(reg, next);
      indexByRowId.set(r.id, next);
    }

    // Deduplicate: one row per customer (reg + normalized email/name).
    // Rows are already ordered by created_at DESC, so the first occurrence wins.
    const seen = new Set<string>();
    const deduped = rows.filter((r) => {
      const reg = (r.vehicle_registration || '').toString().toLowerCase().trim();
      const email = (r.email || '').toString().toLowerCase().trim();
      const name = (r.name || '').toString().toLowerCase().trim();
      const key = `${reg}|${email || name}`;
      if (!key || key === '|') return true;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    return deduped.map((r): Claim => {
      const ageInDays = daysBetween(r.created_at);
      const amount = Number(r.payment_amount) || 0;
      const status = inferStatus(r.status, ageInDays);
      const priority = inferPriority(r.priority, amount, ageInDays);
      const reg = (r.vehicle_registration || '').toString().toUpperCase() || '—';
      const regKey = reg.toLowerCase();
      const totalForReg = regCounts.get(regKey) || 1;

      return {
        id: r.id,
        date: formatDate(r.created_at),
        submittedAt: r.created_at,
        reg,
        customerName: r.name || 'Unknown',
        email: r.email || '',
        phone: r.phone || '',
        issue: r.claim_reason || r.message || '—',
        ageInDays,
        status,
        priority,
        assignee: r.assigned_to ? (staffById[r.assigned_to] || 'Assigned') : 'unassigned',
        amount,
        evidence: inferEvidence(r),
        tier: r.warranty_type || undefined,
        previousClaims: Math.max(0, totalForReg - 1),
        rawStatus: r.status ?? null,
        rawPriority: r.priority ?? null,
        daysOnRisk: (() => {
          if (r.days_on_risk != null) return Number(r.days_on_risk);
          const start = r.warranty_start_date || customerStartByReg[normReg(reg)];
          if (!start) return null;
          return Math.max(0, Math.floor((Date.now() - new Date(start).getTime()) / (1000 * 60 * 60 * 24)));
        })(),
        purchaseMileage:
          r.purchase_mileage != null
            ? Number(r.purchase_mileage)
            : (customerMileageByReg[normReg(reg)] ?? null),
        claimMileage: r.mileage_at_claim != null ? Number(r.mileage_at_claim) : null,
        attachments: buildAttachments(r),
        vehicleMake: customerInfoByReg[normReg(reg)]?.make ?? null,
        vehicleModel: customerInfoByReg[normReg(reg)]?.model ?? null,
        claimLimit: customerInfoByReg[normReg(reg)]?.claimLimit ?? null,
        voluntaryExcess: customerInfoByReg[normReg(reg)]?.voluntaryExcess ?? null,
        labourRate: customerInfoByReg[normReg(reg)]?.labourRate ?? null,
        hasCancellation: cancelledRegs.has(normReg(reg)),
        hasMatchingPolicy: !!customerInfoByReg[normReg(reg)],
        reviewSentiment: (r.review_sentiment === 'positive' || r.review_sentiment === 'negative') ? r.review_sentiment : null,
        claimedAmount: r.claimed_amount != null ? Number(r.claimed_amount) : (r.payment_amount != null ? Number(r.payment_amount) : null),
        paidAmount: r.paid_amount != null ? Number(r.paid_amount) : null,
        customerClaimIndex: indexByRowId.get(r.id) ?? undefined,
        customerClaimTotal: totalForReg,
        duplicateSubmission: (submittersByReg.get(regKey)?.size || 0) > 1,
        duplicateSubmitterCount: submittersByReg.get(regKey)?.size || 1,
        complaint:
          complaintsByReg[normReg(reg)] ||
          complaintsByEmail[(r.email || '').toString().toLowerCase().trim()] ||
          null,
      };
    });
  }, [rows, staffById, customerMileageByReg, customerStartByReg, customerInfoByReg, cancelledRegs, complaintsByReg, complaintsByEmail]);

  return { claims, loading, error, refetch: fetchAll };
};
