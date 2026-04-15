import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface AdminNotification {
  id: string;
  type: 'contact' | 'claim' | 'customer' | 'lead_resubmission';
  title: string;
  message: string;
  created_at: string;
  is_read: boolean;
  reference_id: string;
}

interface CountState {
  contacts: number;
  claims: number;
  customers: number;
  resubmissions: number;
}

export const useAdminNotifications = (userRole?: string | null) => {
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [counts, setCounts] = useState<CountState>({ contacts: 0, claims: 0, customers: 0, resubmissions: 0 });
  const [loading, setLoading] = useState(true);
  const [readIds, setReadIds] = useState<Set<string>>(() => {
    const stored = localStorage.getItem('admin_read_notifications');
    return stored ? new Set(JSON.parse(stored)) : new Set();
  });

  const fetchNotifications = useCallback(async () => {
    try {
      // Fetch new contact submissions (last 24 hours, status = 'new')
      const { data: contacts } = await supabase
        .from('contact_submissions')
        .select('id, name, email, created_at')
        .eq('status', 'new')
        .order('created_at', { ascending: false })
        .limit(20);

      // Fetch new claims (last 24 hours, status = 'new')
      const { data: claims } = await supabase
        .from('claims_submissions')
        .select('id, name, email, created_at')
        .eq('status', 'new')
        .order('created_at', { ascending: false })
        .limit(20);

      // Fetch new customers (last 24 hours)
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data: customers } = await supabase
        .from('customers')
        .select('id, name, email, created_at')
        .gte('created_at', twentyFourHoursAgo)
        .order('created_at', { ascending: false })
        .limit(20);

      // Fetch lead resubmissions (last 48 hours, resubmission_count > 0)
      const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
      const { data: resubmissions } = await supabase
        .from('sales_leads')
        .select('id, first_name, last_name, email, last_resubmitted_at, resubmission_count, vehicle_reg')
        .gt('resubmission_count', 0)
        .not('last_resubmitted_at', 'is', null)
        .gte('last_resubmitted_at', fortyEightHoursAgo)
        .order('last_resubmitted_at', { ascending: false })
        .limit(20);

      const allNotifications: AdminNotification[] = [];

      contacts?.forEach(c => {
        allNotifications.push({
          id: `contact-${c.id}`,
          type: 'contact',
          title: 'New Contact Submission',
          message: `${c.name} (${c.email})`,
          created_at: c.created_at,
          is_read: readIds.has(`contact-${c.id}`),
          reference_id: c.id,
        });
      });

      claims?.forEach(c => {
        allNotifications.push({
          id: `claim-${c.id}`,
          type: 'claim',
          title: 'New Claim Submitted',
          message: `${c.name} (${c.email})`,
          created_at: c.created_at,
          is_read: readIds.has(`claim-${c.id}`),
          reference_id: c.id,
        });
      });

      customers?.forEach(c => {
        allNotifications.push({
          id: `customer-${c.id}`,
          type: 'customer',
          title: 'New Customer',
          message: `${c.name} (${c.email})`,
          created_at: c.created_at,
          is_read: readIds.has(`customer-${c.id}`),
          reference_id: c.id,
        });
      });

      resubmissions?.forEach(r => {
        const name = [r.first_name, r.last_name].filter(Boolean).join(' ') || r.email;
        const regInfo = r.vehicle_reg ? ` — ${r.vehicle_reg}` : '';
        allNotifications.push({
          id: `resub-${r.id}-${r.resubmission_count}`,
          type: 'lead_resubmission',
          title: '🔥 Lead Came Back!',
          message: `${name}${regInfo} resubmitted (×${r.resubmission_count})`,
          created_at: r.last_resubmitted_at!,
          is_read: readIds.has(`resub-${r.id}-${r.resubmission_count}`),
          reference_id: r.id,
        });
      });

      // Sort by created_at descending
      allNotifications.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      setNotifications(allNotifications);
      setCounts({
        contacts: contacts?.length || 0,
        claims: claims?.length || 0,
        customers: customers?.length || 0,
        resubmissions: resubmissions?.length || 0,
      });
    } catch (error) {
      console.error('Error fetching admin notifications:', error);
    } finally {
      setLoading(false);
    }
  }, [readIds]);

  // Subscribe to real-time changes
  useEffect(() => {
    fetchNotifications();

    const isAdminRole = userRole === 'admin' || userRole === 'super_admin';

    const contactChannel = supabase
      .channel('admin-contacts')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'contact_submissions',
      }, (payload) => {
        const data = payload.new as { name: string; email: string };
        if (isAdminRole) {
          toast.info('New Contact Submission', {
            description: `${data.name} (${data.email})`,
            duration: 5000,
          });
        }
        fetchNotifications();
      })
      .subscribe();

    const claimsChannel = supabase
      .channel('admin-claims')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'claims_submissions',
      }, (payload) => {
        const data = payload.new as { name: string; email: string };
        // Only show claim toast for admin/super_admin
        if (isAdminRole) {
          toast.warning('New Claim Submitted', {
            description: `${data.name} (${data.email})`,
            duration: 5000,
          });
        }
        fetchNotifications();
      })
      .subscribe();

    const customersChannel = supabase
      .channel('admin-customers')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'customers',
      }, (payload) => {
        const data = payload.new as { name: string; email: string };
        toast.success('New Customer!', {
          description: `${data.name} (${data.email})`,
          duration: 5000,
        });
        fetchNotifications();
      })
      .subscribe();

    // Listen for lead resubmissions (UPDATE on sales_leads where resubmission_count changes)
    const resubChannel = supabase
      .channel('admin-lead-resubmissions')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'sales_leads',
      }, (payload) => {
        const oldData = payload.old as { resubmission_count?: number };
        const newData = payload.new as { 
          resubmission_count?: number; 
          first_name?: string; 
          last_name?: string; 
          email?: string;
          vehicle_reg?: string;
        };
        
        // Only fire when resubmission_count actually increased
        if ((newData.resubmission_count || 0) > (oldData.resubmission_count || 0)) {
          const name = [newData.first_name, newData.last_name].filter(Boolean).join(' ') || newData.email || 'Unknown';
          const regInfo = newData.vehicle_reg ? ` (${newData.vehicle_reg})` : '';
          
          toast('🔥 Lead Came Back!', {
            description: `${name}${regInfo} resubmitted — act fast!`,
            duration: 10000,
            className: '!bg-purple-600 !text-white !border-purple-700 [&_*]:!text-white',
          });
          fetchNotifications();
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(contactChannel);
      supabase.removeChannel(claimsChannel);
      supabase.removeChannel(customersChannel);
      supabase.removeChannel(resubChannel);
    };
  }, [fetchNotifications, userRole]);

  const markAsRead = useCallback((notificationId: string) => {
    setReadIds(prev => {
      const newSet = new Set(prev);
      newSet.add(notificationId);
      localStorage.setItem('admin_read_notifications', JSON.stringify([...newSet]));
      return newSet;
    });
    setNotifications(prev => 
      prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n)
    );
  }, []);

  const markAllAsRead = useCallback(() => {
    const allIds = notifications.map(n => n.id);
    setReadIds(prev => {
      const newSet = new Set([...prev, ...allIds]);
      localStorage.setItem('admin_read_notifications', JSON.stringify([...newSet]));
      return newSet;
    });
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
  }, [notifications]);

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return {
    notifications,
    counts,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    refresh: fetchNotifications,
  };
};
