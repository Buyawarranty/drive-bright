import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const useLeadNoteCounts = (leadIds: string[]) => {
  const [counts, setCounts] = useState<Record<string, number>>({});

  const stableKey = useMemo(() => leadIds.sort().join(','), [leadIds]);

  useEffect(() => {
    if (leadIds.length === 0) return;

    const fetchCounts = async () => {
      try {
        const { data, error } = await supabase
          .from('lead_quick_notes')
          .select('lead_id')
          .in('lead_id', leadIds);

        if (error) {
          console.error('Error fetching note counts:', error);
          return;
        }

        const countMap: Record<string, number> = {};
        (data || []).forEach(row => {
          countMap[row.lead_id] = (countMap[row.lead_id] || 0) + 1;
        });
        setCounts(countMap);
      } catch (err) {
        console.error('Error fetching note counts:', err);
      }
    };

    fetchCounts();
  }, [stableKey]);

  return counts;
};
