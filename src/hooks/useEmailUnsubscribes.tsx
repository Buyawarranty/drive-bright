import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface EmailUnsubscribe {
  id: string;
  email: string;
  reason: string | null;
  unsubscribed_by: string | null;
  unsubscribed_by_name: string | null;
  source: string | null;
  customer_name: string | null;
  vehicle_reg: string | null;
  created_at: string;
}

export function useEmailUnsubscribes() {
  const queryClient = useQueryClient();

  const { data: unsubscribes = [], isLoading } = useQuery({
    queryKey: ['email-unsubscribes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('email_unsubscribes')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as EmailUnsubscribe[];
    },
  });

  const blockEmail = useMutation({
    mutationFn: async (params: {
      email: string;
      reason?: string;
      source?: string;
      customerName?: string;
      vehicleReg?: string;
      unsubscribedBy?: string;
      unsubscribedByName?: string;
    }) => {
      // Also update marketing_audience
      const [unsubResult, marketingResult] = await Promise.all([
        supabase.from('email_unsubscribes').upsert({
          email: params.email.trim().toLowerCase(),
          reason: params.reason || 'Customer requested to stop receiving emails',
          source: params.source || 'manual',
          customer_name: params.customerName,
          vehicle_reg: params.vehicleReg,
          unsubscribed_by: params.unsubscribedBy,
          unsubscribed_by_name: params.unsubscribedByName,
        }, { onConflict: 'email' }),
        supabase.from('marketing_audience')
          .update({ is_subscribed: false, unsubscribed_at: new Date().toISOString() })
          .eq('email', params.email.trim().toLowerCase()),
      ]);

      if (unsubResult.error) throw unsubResult.error;
    },
    onSuccess: () => {
      toast.success('Email blocked from all marketing');
      queryClient.invalidateQueries({ queryKey: ['email-unsubscribes'] });
      queryClient.invalidateQueries({ queryKey: ['marketing-audience'] });
    },
    onError: (err: any) => {
      toast.error('Failed to block email: ' + err.message);
    },
  });

  const unblockEmail = useMutation({
    mutationFn: async (email: string) => {
      const [deleteResult, marketingResult] = await Promise.all([
        supabase.from('email_unsubscribes').delete().eq('email', email.trim().toLowerCase()),
        supabase.from('marketing_audience')
          .update({ is_subscribed: true, unsubscribed_at: null })
          .eq('email', email.trim().toLowerCase()),
      ]);
      if (deleteResult.error) throw deleteResult.error;
    },
    onSuccess: () => {
      toast.success('Email re-subscribed to marketing');
      queryClient.invalidateQueries({ queryKey: ['email-unsubscribes'] });
      queryClient.invalidateQueries({ queryKey: ['marketing-audience'] });
    },
    onError: (err: any) => {
      toast.error('Failed to unblock email: ' + err.message);
    },
  });

  const isBlocked = (email: string) => {
    return unsubscribes.some(u => u.email === email.trim().toLowerCase());
  };

  return { unsubscribes, isLoading, blockEmail, unblockEmail, isBlocked };
}
