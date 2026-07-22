import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

const BATCH_SIZE = 500;

export const useLeadNoteCounts = (leadIds: string[]) => {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const lastFetchedKeyRef = useRef('');

  const stableKey = useMemo(() => {
    const sorted = [...leadIds].sort();
    return sorted.length > 0 ? `${sorted.length}:${sorted[0]}:${sorted[sorted.length - 1]}` : '';
  }, [leadIds]);

  const fetchCounts = useCallback(async () => {
    if (leadIds.length === 0) return;
    if (lastFetchedKeyRef.current === stableKey) return;
    lastFetchedKeyRef.current = stableKey;

    try {
      const countMap: Record<string, number> = {};

      // Use a grouped-count RPC so we don't hit Supabase's 1000-row cap
      // (a busy day easily produces >1000 quick notes across a page of leads,
      // which previously silently truncated counts and hid recent notes).
      for (let i = 0; i < leadIds.length; i += BATCH_SIZE) {
        const batch = leadIds.slice(i, i + BATCH_SIZE);
        const { data, error } = await supabase.rpc('get_lead_quick_note_counts', {
          p_lead_ids: batch,
        });

        if (error) {
          console.error('Error fetching note counts batch:', error);
          continue;
        }

        (data || []).forEach((row: { lead_id: string; note_count: number }) => {
          countMap[row.lead_id] = Number(row.note_count) || 0;
        });
      }

      setCounts(countMap);
    } catch (err) {
      console.error('Error fetching note counts:', err);
    }
  }, [stableKey]);


  useEffect(() => {
    fetchCounts();
  }, [fetchCounts]);

  // Realtime: refresh counts when notes change (debounced)
  useEffect(() => {
    if (leadIds.length === 0) return;

    let timer: ReturnType<typeof setTimeout> | null = null;
    const channel = supabase
      .channel('lead_note_counts')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lead_quick_notes' }, () => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => {
          lastFetchedKeyRef.current = ''; // force refetch
          fetchCounts();
        }, 2000);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      if (timer) clearTimeout(timer);
    };
  }, [fetchCounts]);

  return counts;
};
