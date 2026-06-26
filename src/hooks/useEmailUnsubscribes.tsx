import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type EmailFrequency = 'all' | 'essentials' | 'off';

export interface EmailUnsubscribe {
  id: string;
  email: string;
  reason: string | null;
  unsubscribed_by: string | null;
  unsubscribed_by_name: string | null;
  source: string | null;
  customer_name: string | null;
  vehicle_reg: string | null;
  frequency: EmailFrequency;
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
      return (data || []) as EmailUnsubscribe[];
    },
  });

  // Set a specific frequency tier for an email - works for full opt-out OR "essentials only"
  const setFrequency = useMutation({
    mutationFn: async (params: {
      email: string;
      frequency: EmailFrequency;
      reason?: string;
      source?: string;
      customerName?: string;
      vehicleReg?: string;
      unsubscribedBy?: string;
      unsubscribedByName?: string;
    }) => {
      const email = params.email.trim().toLowerCase();
      const { frequency } = params;

      // 1. marketing_audience: upsert with the new frequency
      // is_subscribed mirrors frequency !== 'off' so legacy code keeps working.
      const isSubscribed = frequency !== 'off';
      const { data: existing } = await supabase
        .from('marketing_audience')
        .select('id')
        .eq('email', email)
        .maybeSingle();

      if (existing) {
        await supabase
          .from('marketing_audience')
          .update({
            is_subscribed: isSubscribed,
            unsubscribed_at: isSubscribed ? null : new Date().toISOString(),
            frequency,
          })
          .eq('email', email);
      } else {
        await supabase.from('marketing_audience').insert({
          email,
          is_subscribed: isSubscribed,
          unsubscribed_at: isSubscribed ? null : new Date().toISOString(),
          frequency,
          source: params.source || 'manual',
        });
      }

      // 2. email_unsubscribes: only kept when frequency = 'off'. For 'all' or 'essentials',
      //    delete any existing blocklist row so legacy `isBlocked` checks return false.
      if (frequency === 'off') {
        const { error: unsubError } = await supabase.from('email_unsubscribes').upsert(
          {
            email,
            reason: params.reason || 'Customer requested to stop receiving emails',
            source: params.source || 'manual',
            customer_name: params.customerName,
            vehicle_reg: params.vehicleReg,
            unsubscribed_by: params.unsubscribedBy,
            unsubscribed_by_name: params.unsubscribedByName,
            frequency,
          },
          { onConflict: 'email' }
        );
        if (unsubError) throw unsubError;
      } else {
        await supabase.from('email_unsubscribes').delete().eq('email', email);
      }
    },
    onSuccess: (_data, variables) => {
      const label =
        variables.frequency === 'off'
          ? 'unsubscribed from all marketing'
          : variables.frequency === 'essentials'
          ? 'switched to essentials-only emails'
          : 're-subscribed to all marketing';
      toast.success(`${variables.email} ${label}`);
      queryClient.invalidateQueries({ queryKey: ['email-unsubscribes'] });
      queryClient.invalidateQueries({ queryKey: ['marketing-audience'] });
    },
    onError: (err: any) => {
      toast.error('Failed to update preference: ' + err.message);
    },
  });

  // Legacy: keep blockEmail / unblockEmail working - they just delegate to setFrequency.
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
      return setFrequency.mutateAsync({ ...params, frequency: 'off' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-unsubscribes'] });
      queryClient.invalidateQueries({ queryKey: ['marketing-audience'] });
    },
  });

  const unblockEmail = useMutation({
    mutationFn: async (email: string) => {
      return setFrequency.mutateAsync({ email, frequency: 'all' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-unsubscribes'] });
      queryClient.invalidateQueries({ queryKey: ['marketing-audience'] });
    },
  });

  const isBlocked = (email: string) => {
    return unsubscribes.some((u) => u.email === email.trim().toLowerCase());
  };

  return { unsubscribes, isLoading, blockEmail, unblockEmail, setFrequency, isBlocked };
}
