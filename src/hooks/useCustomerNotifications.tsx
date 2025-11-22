import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface CustomerNotification {
  id: string;
  customer_id: string;
  message: string;
  is_important: boolean;
  is_read: boolean;
  created_by: string | null;
  created_at: string;
  read_at: string | null;
  attachment_url: string | null;
}

export const useCustomerNotifications = (customerEmail: string | undefined) => {
  const [notifications, setNotifications] = useState<CustomerNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!customerEmail) {
      setLoading(false);
      return;
    }

    fetchNotifications();
    subscribeToNotifications();

    return () => {
      supabase.channel('customer-notifications').unsubscribe();
    };
  }, [customerEmail]);

  const fetchNotifications = async () => {
    if (!customerEmail) return;

    try {
      // First get the customer ID
      const { data: customer } = await supabase
        .from('customers')
        .select('id')
        .eq('email', customerEmail)
        .single();

      if (!customer) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('customer_notifications')
        .select('*')
        .eq('customer_id', customer.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setNotifications(data || []);
      setUnreadCount(data?.filter(n => !n.is_read).length || 0);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const subscribeToNotifications = () => {
    if (!customerEmail) return;

    const channel = supabase
      .channel('customer-notifications')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'customer_notifications',
        },
        (payload) => {
          console.log('Notification change received:', payload);
          fetchNotifications();
        }
      )
      .subscribe();
  };

  const markAsRead = async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from('customer_notifications')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('id', notificationId);

      if (error) throw error;

      setNotifications(prev =>
        prev.map(n => n.id === notificationId ? { ...n, is_read: true, read_at: new Date().toISOString() } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    if (!customerEmail) return;

    try {
      const { data: customer } = await supabase
        .from('customers')
        .select('id')
        .eq('email', customerEmail)
        .single();

      if (!customer) return;

      const { error } = await supabase
        .from('customer_notifications')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('customer_id', customer.id)
        .eq('is_read', false);

      if (error) throw error;

      setNotifications(prev =>
        prev.map(n => ({ ...n, is_read: true, read_at: new Date().toISOString() }))
      );
      setUnreadCount(0);
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  };

  return {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    refresh: fetchNotifications,
  };
};
