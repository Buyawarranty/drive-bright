import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

const BATCH_SIZE = 200;

export const useLeadNoteCounts = (leadIds: string[]) => {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const lastFetchedKeyRef = useRef('');

  // Fingerprint every id, not just length/first/last — two different pages of
  // leads can share those and previously skipped the refetch, leaving the
  // notes column blank.
  const stableKey = useMemo(() => [...leadIds].sort().join(','), [leadIds]);
  const hasLeads = leadIds.length > 0;

  const fetchCounts = useCallback(async () => {
    const ids = stableKey ? stableKey.split(',') : [];
    if (ids.length === 0) return;
    if (lastFetchedKeyRef.current === stableKey) return;
    lastFetchedKeyRef.current = stableKey;

    try {
      let failed = false;

      // Grouped-count RPC so we don't hit Supabase's 1000-row cap, applied in
      // small batches and merged as they land so one bad batch can't wipe the
      // whole notes column.
      for (let i = 0; i < ids.length; i += BATCH_SIZE) {
        const batch = ids.slice(i, i + BATCH_SIZE);
        const { data, error } = await supabase.rpc('get_lead_quick_note_counts', {
          p_lead_ids: batch,
        });

        if (error) {
          console.error('Error fetching note counts batch:', error);
          failed = true;
          continue;
        }

        const partial: Record<string, number> = {};
        (data || []).forEach((row: { lead_id: string; note_count: number }) => {
          partial[row.lead_id] = Number(row.note_count) || 0;
        });
        setCounts(prev => ({ ...prev, ...partial }));
      }

      // Allow a retry on the next render if anything went wrong.
      if (failed) lastFetchedKeyRef.current = '';
    } catch (err) {
      console.error('Error fetching note counts:', err);
      lastFetchedKeyRef.current = '';
    }
  }, [stableKey]);

  // Latest fetcher read through a ref so the realtime channel is created once
  // instead of being torn down and re-subscribed on every render.
  const fetchCountsRef = useRef(fetchCounts);
  useEffect(() => {
    fetchCountsRef.current = fetchCounts;
  }, [fetchCounts]);

  useEffect(() => {
    fetchCounts();
  }, [fetchCounts]);

  // Realtime: refresh counts when notes change (debounced)
  useEffect(() => {
    if (!hasLeads) return;

    let timer: ReturnType<typeof setTimeout> | null = null;
    const channel = supabase
      .channel(`lead_note_counts-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lead_quick_notes' }, () => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => {
          lastFetchedKeyRef.current = ''; // force refetch
          fetchCountsRef.current();
        }, 2000);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      if (timer) clearTimeout(timer);
    };
  }, [hasLeads]);

  return counts;
};
