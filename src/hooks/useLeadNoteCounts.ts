import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

const BATCH_SIZE = 200;

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

      // Batch the .in() query to avoid URL length limits
      for (let i = 0; i < leadIds.length; i += BATCH_SIZE) {
        const batch = leadIds.slice(i, i + BATCH_SIZE);
        const { data, error } = await supabase
          .from('lead_quick_notes')
          .select('lead_id')
          .in('lead_id', batch);

        if (error) {
          console.error('Error fetching note counts batch:', error);
          continue;
        }

        (data || []).forEach(row => {
          countMap[row.lead_id] = (countMap[row.lead_id] || 0) + 1;
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
