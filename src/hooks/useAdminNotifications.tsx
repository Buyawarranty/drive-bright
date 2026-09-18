import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { withBackgroundPriority } from '@/lib/requestQueue';

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

export const useAdminNotifications = (userRole?: string | null, adminId?: string | null) => {
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [counts, setCounts] = useState<CountState>({ contacts: 0, claims: 0, customers: 0, resubmissions: 0 });
  const [loading, setLoading] = useState(true);
  const [readIds, setReadIds] = useState<Set<string>>(() => {
    const stored = localStorage.getItem('admin_read_notifications');
    return stored ? new Set(JSON.parse(stored)) : new Set();
  });

  // Keep latest readIds in a ref so fetchNotifications stays stable
  // and doesn't tear down realtime channels every time a notification is read.
  const readIdsRef = useRef(readIds);
  useEffect(() => { readIdsRef.current = readIds; }, [readIds]);

  // Debounce / coalesce refetches triggered by bursty realtime events.
  const refetchTimerRef = useRef<number | null>(null);
  const scheduleRefetch = useCallback(() => {
    if (refetchTimerRef.current) return;
    refetchTimerRef.current = window.setTimeout(() => {
      refetchTimerRef.current = null;
      fetchNotificationsRef.current?.();
    }, 5000);
  }, []);
  const fetchNotificationsRef = useRef<(() => void) | null>(null);
  const lastLeadResubmissionToastRef = useRef<Record<string, number>>({});
  const knownLeadResubmissionCountsRef = useRef<Record<string, number>>({});

  const fetchNotifications = useCallback(async () => {
    const currentReadIds = readIdsRef.current;
    try {
      // Fetch new contact submissions (last 24 hours, status = 'new')
      const { contacts, claims, customers, resubmissions } = await withBackgroundPriority(async () => {
        const contactsPromise = supabase
          .from('contact_submissions')
          .select('id, name, email, created_at')
          .eq('status', 'new')
          .order('created_at', { ascending: false })
          .limit(20);

        const claimsPromise = supabase
          .from('claims_submissions')
          .select('id, name, email, created_at')
          .eq('status', 'new')
          .order('created_at', { ascending: false })
          .limit(20);

        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const customersPromise = supabase
          .from('customers')
          .select('id, name, email, created_at')
          .gte('created_at', twentyFourHoursAgo)
          .order('created_at', { ascending: false })
          .limit(20);

        const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
        const isManagement = userRole === 'admin' || userRole === 'super_admin' || userRole === 'sales_manager';
        let resubQuery = supabase
          .from('sales_leads')
          .select('id, first_name, last_name, email, last_resubmitted_at, resubmission_count, vehicle_reg, owner_agent, assigned_to')
          .gt('resubmission_count', 0)
          .not('last_resubmitted_at', 'is', null)
          .gte('last_resubmitted_at', fortyEightHoursAgo)
          .order('last_resubmitted_at', { ascending: false })
          .limit(20);
        if (!isManagement) {
          if (!adminId) {
            resubQuery = resubQuery.eq('id', '00000000-0000-0000-0000-000000000000');
          } else {
            resubQuery = resubQuery.or(`owner_agent.eq.${adminId},assigned_to.eq.${adminId}`);
          }
        }

        const [contactsRes, claimsRes, customersRes, resubmissionsRes] = await Promise.all([
          contactsPromise,
          claimsPromise,
          customersPromise,
          resubQuery,
        ]);

        return {
          contacts: contactsRes.data,
          claims: claimsRes.data,
          customers: customersRes.data,
          resubmissions: resubmissionsRes.data,
        };
      });

      const allNotifications: AdminNotification[] = [];

      contacts?.forEach(c => {
        allNotifications.push({
          id: `contact-${c.id}`,
          type: 'contact',
          title: 'New Contact Submission',
          message: `${c.name} (${c.email})`,
          created_at: c.created_at,
          is_read: currentReadIds.has(`contact-${c.id}`),
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
          is_read: currentReadIds.has(`claim-${c.id}`),
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
          is_read: currentReadIds.has(`customer-${c.id}`),
          reference_id: c.id,
        });
      });

      resubmissions?.forEach(r => {
        const name = [r.first_name, r.last_name].filter(Boolean).join(' ') || r.email;
        const regInfo = r.vehicle_reg ? ` — ${r.vehicle_reg}` : '';
        knownLeadResubmissionCountsRef.current[r.id] = r.resubmission_count || 0;
        allNotifications.push({
          id: `resub-${r.id}-${r.resubmission_count}`,
          type: 'lead_resubmission',
          title: '🔥 Lead Came Back!',
          message: `${name}${regInfo} resubmitted (×${r.resubmission_count})`,
          created_at: r.last_resubmitted_at!,
          is_read: currentReadIds.has(`resub-${r.id}-${r.resubmission_count}`),
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
  }, [userRole, adminId]);

  // Keep ref to latest fetchNotifications for use inside scheduleRefetch
  useEffect(() => { fetchNotificationsRef.current = fetchNotifications; }, [fetchNotifications]);

  // Subscribe to real-time changes
  useEffect(() => {
    fetchNotifications();

    const isAdminRole = userRole === 'admin' || userRole === 'super_admin';

    const contactChannel = supabase
      .channel(`admin-contacts-${Math.random().toString(36).slice(2)}`)
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
        scheduleRefetch();
      })
      .subscribe();

    const claimsChannel = supabase
      .channel(`admin-claims-${Math.random().toString(36).slice(2)}`)
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
        scheduleRefetch();
      })
      .subscribe();

    // Listen for new evidence on existing claims (UPDATE on claims_submissions)
    const claimsEvidenceChannel = supabase
      .channel(`admin-claims-evidence-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'claims_submissions',
      }, (payload) => {
        const oldData = payload.old as { internal_notes?: string };
        const newData = payload.new as { name?: string; vehicle_registration?: string; internal_notes?: string };
        const oldNotes = oldData.internal_notes || '';
        const newNotes = newData.internal_notes || '';
        if (newNotes.includes('[NEW EVIDENCE') && newNotes.length > oldNotes.length) {
          const typeMatch = newNotes.slice(oldNotes.length).match(/Type:\s*([^\n]+)/);
          const evidenceType = typeMatch ? typeMatch[1].trim() : 'Evidence';
          if (isAdminRole) {
            toast.warning('📎 New Evidence Submitted', {
              description: `${evidenceType} — ${newData.name || 'Customer'} (${newData.vehicle_registration || 'no reg'})`,
              duration: 6000,
            });
          }
          scheduleRefetch();
        }
      })
      .subscribe();

    const customersChannel = supabase
      .channel(`admin-customers-${Math.random().toString(36).slice(2)}`)
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
        scheduleRefetch();
      })
      .subscribe();

    // Listen for lead resubmissions (UPDATE on sales_leads where resubmission_count changes)
    const resubChannel = supabase
      .channel(`admin-lead-resubmissions-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'sales_leads',
      }, (payload) => {
        const oldData = payload.old as { resubmission_count?: number };
        const newData = payload.new as { 
          id?: string;
          resubmission_count?: number; 
          first_name?: string; 
          last_name?: string; 
          email?: string;
          vehicle_reg?: string;
          owner_agent?: string | null;
          assigned_to?: string | null;
        };
        
        const newCount = newData.resubmission_count || 0;
        const previousCount = typeof oldData.resubmission_count === 'number'
          ? oldData.resubmission_count
          : newData.id
            ? knownLeadResubmissionCountsRef.current[newData.id]
            : undefined;

        if (newData.id) {
          knownLeadResubmissionCountsRef.current[newData.id] = newCount;
        }

        // Only fire when resubmission_count actually increased; skip noisy updates when old count is unavailable.
        if (previousCount !== undefined && newCount > previousCount) {
          // Scope resubmission toast to owner (or management). A teammate's
          // repeat customer must never pop up on another agent's screen as a
          // "🔥 Lead Came Back!" toast — they read it as a brand-new lead.
          const isManagement = userRole === 'admin' || userRole === 'super_admin' || userRole === 'sales_manager';
          const ownsLead =
            !!adminId &&
            (newData.owner_agent === adminId || newData.assigned_to === adminId);
          if (!isManagement && !ownsLead) {
            scheduleRefetch();
            return;
          }

          const toastKey = `${newData.id || newData.email || 'lead'}-${newData.resubmission_count || 0}`;
          const now = Date.now();
          if (now - (lastLeadResubmissionToastRef.current[toastKey] || 0) < 30000) {
            scheduleRefetch();
            return;
          }
          lastLeadResubmissionToastRef.current[toastKey] = now;

          const name = [newData.first_name, newData.last_name].filter(Boolean).join(' ') || newData.email || 'Unknown';
          const regInfo = newData.vehicle_reg ? ` (${newData.vehicle_reg})` : '';
          
          toast('🔥 Lead Came Back!', {
            description: `${name}${regInfo} resubmitted — act fast!`,
            duration: 4000,
            closeButton: true,
            className: '!bg-primary !text-primary-foreground !border-primary !p-2 !min-h-0 !w-[220px] !text-[11px] [&_*]:!text-primary-foreground [&_[data-title]]:!text-[11px] [&_[data-title]]:!font-semibold [&_[data-description]]:!text-[10px] [&_[data-description]]:!leading-tight',
          });
          scheduleRefetch();
        }
      })
      .subscribe();

    return () => {
      if (refetchTimerRef.current) {
        clearTimeout(refetchTimerRef.current);
        refetchTimerRef.current = null;
      }
      supabase.removeChannel(contactChannel);
      supabase.removeChannel(claimsChannel);
      supabase.removeChannel(claimsEvidenceChannel);
      supabase.removeChannel(customersChannel);
      supabase.removeChannel(resubChannel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userRole, adminId]);

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
