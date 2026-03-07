import React, { useState, useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';

interface LeadDroughtAlertProps {
  userRole: string | null;
}

export const LeadDroughtAlert: React.FC<LeadDroughtAlertProps> = ({ userRole }) => {
  const [lastLeadTime, setLastLeadTime] = useState<Date | null>(null);
  const [isDrought, setIsDrought] = useState(false);

  const allowedRoles = ['super_admin', 'admin', 'sales_lead'];
  const canSee = allowedRoles.includes(userRole || '');

  useEffect(() => {
    if (!canSee) return;

    const checkLastLead = async () => {
      // Get most recent lead from both tables
      const [salesRes, cartsRes] = await Promise.all([
        supabase
          .from('sales_leads')
          .select('created_at')
          .order('created_at', { ascending: false })
          .limit(1),
        supabase
          .from('abandoned_carts')
          .select('created_at')
          .order('created_at', { ascending: false })
          .limit(1),
      ]);

      const salesTime = salesRes.data?.[0]?.created_at;
      const cartTime = cartsRes.data?.[0]?.created_at;

      const times = [salesTime, cartTime].filter(Boolean).map(t => new Date(t!));
      if (times.length === 0) {
        setIsDrought(true);
        return;
      }

      const mostRecent = new Date(Math.max(...times.map(t => t.getTime())));
      setLastLeadTime(mostRecent);

      const hourAgo = Date.now() - 60 * 60 * 1000;
      setIsDrought(mostRecent.getTime() < hourAgo);
    };

    checkLastLead();
    const interval = setInterval(checkLastLead, 60_000); // re-check every minute
    return () => clearInterval(interval);
  }, [canSee]);

  if (!canSee || !isDrought) return null;

  return (
    <div className="flex items-center gap-3 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300">
      <AlertTriangle className="h-5 w-5 shrink-0 text-red-600 dark:text-red-400" />
      <div>
        <span className="font-semibold">No new leads detected for 1+ hour.</span>{' '}
        {lastLeadTime ? (
          <span>Last lead received {formatDistanceToNow(lastLeadTime, { addSuffix: true })}.</span>
        ) : (
          <span>No recent leads found.</span>
        )}
        <span className="ml-1 text-red-600 dark:text-red-400">Check lead sources immediately.</span>
      </div>
    </div>
  );
};
