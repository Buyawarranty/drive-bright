import { useEffect, useMemo, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Claim } from '@/types/claim';

/**
 * Maps a raw claims_submissions row + DB status string into the simplified
 * Claim shape used by the new Claims Manager UI.
 */
const STATUS_MAP: Record<string, Claim['status']> = {
  // direct matches
  overdue: 'overdue',
  evidence: 'evidence',
  evidence_needed: 'evidence',
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

export const useClaims = (): UseClaimsResult => {
  const [rows, setRows] = useState<any[]>([]);
  const [staffById, setStaffById] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [{ data: claimRows, error: claimErr }, { data: staffRows }] = await Promise.all([
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
      ]);

      if (claimErr) throw claimErr;

      const lookup: Record<string, string> = {};
      (staffRows || []).forEach((s: any) => {
        const name = [s.first_name, s.last_name].filter(Boolean).join(' ').trim() || s.email || 'Staff';
        if (s.user_id) lookup[s.user_id] = name;
      });

      setStaffById(lookup);
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
    rows.forEach((r) => {
      const reg = (r.vehicle_registration || '').toLowerCase().trim();
      if (!reg) return;
      regCounts.set(reg, (regCounts.get(reg) || 0) + 1);
    });

    return rows.map((r): Claim => {
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
      };
    });
  }, [rows, staffById]);

  return { claims, loading, error, refetch: fetchAll };
};
