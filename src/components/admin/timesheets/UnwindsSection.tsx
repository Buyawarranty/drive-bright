import React, { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { Ban, TrendingDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface UnwindRecord {
  id: string;
  name: string;
  email: string;
  registration_plate: string | null;
  plan_type: string;
  status: string;
  final_amount: number | null;
  updated_at: string;
}

interface UnwindsSectionProps {
  currentMonth: Date;
  viewingUserId?: string; // admin_users.user_id of the person being viewed
}

export function UnwindsSection({ currentMonth, viewingUserId }: UnwindsSectionProps) {
  const { session } = useAuth();
  const [records, setRecords] = useState<UnwindRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const monthStart = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).toISOString();
  const monthEnd = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0, 23, 59, 59).toISOString();

  const fetchUnwinds = useCallback(async () => {
    const userId = viewingUserId || session?.user?.id;
    if (!userId) return;
    setLoading(true);
    try {
      // Get admin_user_id for the user
      const { data: adminUser } = await supabase
        .from('admin_users')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle();

      if (!adminUser) { setRecords([]); return; }

      // Fetch cancelled/refunded customers assigned to this agent in the period
      const { data, error } = await supabase
        .from('customers')
        .select('id, name, email, registration_plate, plan_type, status, final_amount, updated_at')
        .eq('is_deleted', false)
        .eq('assigned_to', adminUser.id)
        .or('status.ilike.cancelled,status.ilike.refunded')
        .gte('updated_at', monthStart)
        .lte('updated_at', monthEnd)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      setRecords((data || []) as UnwindRecord[]);
    } catch (err) {
      console.error('Error fetching unwinds:', err);
    } finally {
      setLoading(false);
    }
  }, [session?.user?.id, viewingUserId, monthStart, monthEnd]);

  useEffect(() => {
    fetchUnwinds();
  }, [fetchUnwinds]);

  if (loading) return null;
  if (records.length === 0) return null;

  const totalCancelled = records.filter(r => r.status?.toLowerCase() === 'cancelled').length;
  const totalRefunded = records.filter(r => r.status?.toLowerCase() === 'refunded').length;
  const totalValue = records.reduce((sum, r) => sum + (r.final_amount || 0), 0);

  return (
    <div className="bg-white rounded-xl shadow-sm border">
      <div className="p-5 border-b">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-red-100 rounded-lg">
            <TrendingDown className="h-5 w-5 text-red-600" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-foreground">Unwinds (Cancellations)</h3>
            <p className="text-sm text-muted-foreground">
              <span className="text-destructive font-medium">{records.length} total</span>
              {totalCancelled > 0 && <span> · {totalCancelled} cancelled</span>}
              {totalRefunded > 0 && <span> · {totalRefunded} refunded</span>}
              {totalValue > 0 && <span> · £{totalValue.toFixed(2)} value</span>}
            </p>
          </div>
        </div>
      </div>

      <div className="max-h-[300px] overflow-y-auto divide-y">
        {records.map(record => (
          <div key={record.id} className="p-4 hover:bg-muted/50">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm text-foreground">{record.name}</span>
                  {record.registration_plate && (
                    <span className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">{record.registration_plate.toUpperCase()}</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{record.plan_type}</p>
                {record.final_amount != null && record.final_amount > 0 && (
                  <p className="text-xs font-medium text-destructive">£{record.final_amount.toFixed(2)}</p>
                )}
                <p className="text-[10px] text-muted-foreground">{format(new Date(record.updated_at), 'dd/MM/yyyy')}</p>
              </div>
              <Badge variant="destructive" className="text-[10px] gap-1 flex-shrink-0">
                <Ban className="h-2.5 w-2.5" />
                {record.status}
              </Badge>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
