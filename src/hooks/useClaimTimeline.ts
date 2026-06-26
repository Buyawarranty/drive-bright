import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { ClaimNoteType } from '@/hooks/useClaimNotes';

export type TimelineKind =
  | 'submitted'
  | 'status_change'
  | 'evidence_requested'
  | 'evidence_received'
  | 'note'
  | 'communication';

export interface TimelineEvent {
  id: string;
  kind: TimelineKind;
  at: string;
  title: string;
  detail?: string;
  actor?: string | null;
  tone?: 'info' | 'good' | 'warn' | 'bad' | 'neutral';
  badge?: string;
  noteType?: ClaimNoteType;
}

interface Result {
  events: TimelineEvent[];
  loading: boolean;
  refetch: () => Promise<void>;
}

export const useClaimTimeline = (claimId?: string | null): Result => {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!claimId) {
      setEvents([]);
      return;
    }
    setLoading(true);
    try {
      const [claimRes, notesRes, commsRes, reqRes, respRes] = await Promise.all([
        (supabase
          .from('claims_submissions' as any)
          .select('created_at')
          .eq('id', claimId)
          .maybeSingle() as any),
        (supabase
          .from('claim_notes' as any)
          .select('id, note, note_type, created_at, created_by_name')
          .eq('claim_id', claimId) as any),
        (supabase
          .from('claim_communications' as any)
          .select('id, communication_type, direction, subject, message, created_at, sender_email, recipient_email')
          .eq('claim_id', claimId) as any),
        (supabase
          .from('claim_update_requests' as any)
          .select('id, message, recipient_email, sent_at, created_at')
          .eq('claim_id', claimId) as any),
        (supabase
          .from('claim_update_responses' as any)
          .select('id, response_text, created_at, customer_name')
          .eq('claim_id', claimId) as any),
      ]);

      const out: TimelineEvent[] = [];
      const submittedAt = (claimRes?.data as any)?.created_at;

      if (submittedAt) {
        out.push({
          id: `claim-${claimId}`,
          kind: 'submitted',
          at: submittedAt,
          title: 'Claim submitted',
          detail: 'Customer opened a new claim.',
          tone: 'info',
        });
      }

      (notesRes?.data || []).forEach((n: any) => {
        out.push({
          id: `note-${n.id}`,
          kind: 'note',
          at: n.created_at,
          title: 'Internal note',
          detail: n.note,
          actor: n.created_by_name,
          tone: n.note_type === 'complaint_risk' ? 'bad' : 'neutral',
          noteType: (n.note_type as ClaimNoteType) || 'general',
        });
      });

      (commsRes?.data || []).forEach((c: any) => {
        const type = (c.communication_type || '').toLowerCase();
        const dir = (c.direction || '').toLowerCase();
        const isStatus = type === 'status_change';
        const isOut = dir === 'outbound';
        out.push({
          id: `comm-${c.id}`,
          kind: isStatus ? 'status_change' : 'communication',
          at: c.created_at,
          title: isStatus
            ? `Status changed${c.message ? `: ${c.message}` : ''}`
            : `${isOut ? 'Sent' : 'Received'} ${c.communication_type || 'message'}`,
          detail: isStatus ? undefined : (c.subject ? `${c.subject}\n\n${c.message || ''}` : c.message),
          actor: isOut ? c.sender_email : c.sender_email || c.recipient_email,
          tone: isStatus ? 'info' : 'info',
          badge: c.communication_type,
        });
      });


      (reqRes?.data || []).forEach((r: any) => {
        out.push({
          id: `req-${r.id}`,
          kind: 'evidence_requested',
          at: r.sent_at || r.created_at,
          title: 'Evidence requested from customer',
          detail: r.message,
          actor: r.recipient_email,
          tone: 'warn',
        });
      });

      (respRes?.data || []).forEach((r: any) => {
        out.push({
          id: `resp-${r.id}`,
          kind: 'evidence_received',
          at: r.created_at,
          title: 'Customer responded with evidence',
          detail: r.response_text,
          actor: r.customer_name,
          tone: 'good',
        });
      });

      out.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
      setEvents(out);
    } catch (err) {
      console.error('useClaimTimeline error', err);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [claimId]);

  useEffect(() => {
    load();
  }, [load]);

  return { events, loading, refetch: load };
};
