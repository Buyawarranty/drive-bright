import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { fetchAllRows } from '@/utils/supabaseBatchFetch';
import { toast } from 'sonner';
import { addSystemNote } from '@/utils/leadSystemNotes';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { WEBSITE_SALES_ACCOUNT_ID } from '@/constants/salesDefaults';
import { useAuth } from '@/hooks/useAuth';

const LEAD_TAG_BATCH_SIZE = 300;
const PENDING_STATUS_UPDATES_STORAGE_KEY = 'new-leads:pending-status-updates';

type PendingStatusUpdate = {
  leadId: string;
  status: LeadStatus;
  updatedAt: string;
  isAbandonedCart: boolean;
};

const readPendingStatusUpdates = (): Record<string, PendingStatusUpdate> => {
  if (typeof window === 'undefined') return {};

  try {
    const raw = window.localStorage.getItem(PENDING_STATUS_UPDATES_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

const writePendingStatusUpdates = (updates: Record<string, PendingStatusUpdate>) => {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(PENDING_STATUS_UPDATES_STORAGE_KEY, JSON.stringify(updates));
  } catch {
    // Ignore storage failures
  }
};

const withTimeout = async <T,>(promise: Promise<T>, ms: number, message: string): Promise<T> => {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(message)), ms);
      }),
    ]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
};

const isRetryableMutationError = (error: unknown) => {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return (
    message.includes('timeout') ||
    message.includes('failed to fetch') ||
    message.includes('networkerror') ||
    message.includes('aborterror') ||
    message.includes('load failed')
  );
};

export type LeadStatus = 'new' | 'contacted' | 'follow_up' | 'quote_sent' | 'negotiating' | 'converted' | 'lost' | 'fake_lead' | 'urgent_callback';
export type LeadPriority = 'low' | 'medium' | 'high' | 'urgent';
export type LeadSource = 'website' | 'referral' | 'social_ad' | 'google_ad' | 'phone' | 'email' | 'partner' | 'other';

export interface Lead {
  id: string;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  email: string;
  phone: string | null;
  lead_source: LeadSource;
  status: LeadStatus;
  priority: LeadPriority;
  priority_score: number;
  plan_interest: string | null;
  cart_value: number | null;
  quote_amount: number | null;
  vehicle_reg: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  vehicle_year: string | null;
  vehicle_type: string | null;
  mileage: string | null;
  assigned_to: string | null;
  assigned_at: string | null;
  next_action_type: string | null;
  next_action_date: string | null;
  follow_up_status: string;
  last_activity_date: string;
  last_contacted_at: string | null;
  notes: string | null;
  converted_at: string | null;
  lost_at: string | null;
  lost_reason: string | null;
  abandoned_cart_id: string | null;
  created_at: string;
  updated_at: string;
  // Payment tracking fields
  is_paid: boolean;
  payment_amount: number | null;
  payment_method: string | null;
  payment_date: string | null;
  step_two_completed_at: string | null;
  // New columns for merged abandoned cart data
  plan_name: string | null;
  payment_type: string | null;
  step_abandoned: number | null;
  contact_status: string | null;
  is_from_abandoned_cart: boolean;
  // Call tracking
  call_count: number;
  // Callback flag
  is_callback: boolean;
  // Cart metadata for plan selections
  cart_metadata: {
    claim_limit?: number;
    voluntary_excess?: number;
    labour_rate?: number;
    total_price?: number;
    competitorPrice?: string | null;
    quoteDetails?: string | null;
    protection_addons?: {
      breakdown?: boolean;
      rental?: boolean;
      european?: boolean;
      tyre?: boolean;
      wearAndTear?: boolean;
      motFee?: boolean;
      transfer?: boolean;
    };
  } | null;
  // Application count - how many times they've applied (hot lead indicator)
  application_count: number;
  // Resubmission tracking - when returning customer submits again
  resubmission_count: number;
  last_resubmitted_at: string | null;
  // Joined data
  assigned_user?: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string;
  } | null;
  tags?: LeadTag[];
}

export interface LeadTag {
  id: string;
  name: string;
  color: string;
  description: string | null;
}

export interface LeadActivity {
  id: string;
  lead_id: string;
  activity_type: string;
  description: string | null;
  outcome: string | null;
  performed_by: string | null;
  created_at: string;
  performer?: {
    first_name: string | null;
    last_name: string | null;
  } | null;
}

export interface AdminUser {
  id: string;
  user_id: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string;
  is_active: boolean;
  role?: string;
}

interface UseLeadsOptions {
  /** Server-side date filter applied to the Supabase query. Reduces row count dramatically. */
  serverDateFilter?: { from?: Date; to?: Date };
}

export const useLeads = (options?: UseLeadsOptions) => {
  const { user, loading: authLoading } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [tags, setTags] = useState<LeadTag[]>([]);
  const [salesUsers, setSalesUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const initialLoadDoneRef = useRef(false);
  const initialLoadStartedRef = useRef(false);
  const loadingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFetchingRef = useRef(false);
  const pendingFetchRef = useRef(false);
  const latestFetchTokenRef = useRef(0);
  const [filter, setFilter] = useState<LeadStatus | 'all' | 'all_leads' | 'live' | 'high_priority' | 'fake' | 'lost' | 'quote_sent' | 'urgent_callback' | 'callbacks' | 'recovered'>('all_leads');

  // Store server date filter as a ref so fetchLeads doesn't re-create on every date change
  const serverDateFilterRef = useRef(options?.serverDateFilter);
  serverDateFilterRef.current = options?.serverDateFilter;

  // Stable key that changes when the date filter boundaries change — triggers re-fetch
  const dateFilterKey = useMemo(() => {
    const f = options?.serverDateFilter;
    if (!f?.from && !f?.to) return 'all';
    return `${f.from?.getTime() ?? ''}_${f.to?.getTime() ?? ''}`;
  }, [options?.serverDateFilter]);
  
  // Cache sales users and leads for optimistic updates (avoid stale closures)
  const salesUsersRef = useRef<AdminUser[]>([]);
  salesUsersRef.current = salesUsers;
  const leadsRef = useRef<Lead[]>([]);
  leadsRef.current = leads;
  const authLoadingRef = useRef(authLoading);
  authLoadingRef.current = authLoading;
  const userRef = useRef(user);
  userRef.current = user;

  // Cache admin user ID to avoid repeated auth lookups
  const cachedAdminUserRef = useRef<{ id: string; firstName: string; email: string; role: string } | null>(null);
  const adminUserPromiseRef = useRef<Promise<{ id: string; firstName: string; email: string; role: string } | null> | null>(null);
  const pendingStatusFlushRef = useRef<Promise<void> | null>(null);

  const getCachedAdminUser = useCallback(async () => {
    if (cachedAdminUserRef.current) return cachedAdminUserRef.current;
    
    // Prevent duplicate concurrent requests
    if (adminUserPromiseRef.current) return adminUserPromiseRef.current;
    
    adminUserPromiseRef.current = (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      
      const { data: adminUser } = await supabase
        .from('admin_users')
        .select('id, first_name, email, role')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (adminUser) {
        const cached = { 
          id: adminUser.id, 
          firstName: adminUser.first_name || adminUser.email?.split('@')[0] || 'Admin',
          email: adminUser.email,
          role: adminUser.role || 'sales'
        };
        cachedAdminUserRef.current = cached;
        return cached;
      }
      return null;
    })();
    
    const result = await adminUserPromiseRef.current;
    adminUserPromiseRef.current = null;
    return result;
  }, []);

  const queuePendingStatusUpdate = useCallback((leadId: string, status: LeadStatus, isAbandonedCart: boolean) => {
    const pending = readPendingStatusUpdates();
    pending[leadId] = {
      leadId,
      status,
      updatedAt: new Date().toISOString(),
      isAbandonedCart,
    };
    writePendingStatusUpdates(pending);
  }, []);

  const clearPendingStatusUpdate = useCallback((leadId: string) => {
    const pending = readPendingStatusUpdates();
    if (!pending[leadId]) return;

    delete pending[leadId];
    writePendingStatusUpdates(pending);
  }, []);

  const flushPendingStatusUpdates = useCallback(async () => {
    if (pendingStatusFlushRef.current) return pendingStatusFlushRef.current;

    pendingStatusFlushRef.current = (async () => {
      const pending = Object.values(readPendingStatusUpdates()).sort(
        (a, b) => new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime()
      );

      if (pending.length === 0) return;

      for (const item of pending) {
        try {
          const { data: result, error } = await withTimeout(
            (async () =>
              await supabase.rpc('update_lead_status', {
                p_lead_id: item.isAbandonedCart ? item.leadId.replace('cart_', '') : item.leadId,
                p_status: item.status,
                p_is_abandoned_cart: item.isAbandonedCart,
              }))(),
            8000,
            'Pending status sync timed out'
          );

          if (error) throw error;

          const statusResult = result as { success: boolean; error?: string };
          if (!statusResult?.success) {
            throw new Error(statusResult?.error || 'Pending status sync failed');
          }

          clearPendingStatusUpdate(item.leadId);
        } catch (error) {
          console.warn('[Leads] Pending status sync will retry later:', error);
          break;
        }
      }
    })().finally(() => {
      pendingStatusFlushRef.current = null;
    });

    return pendingStatusFlushRef.current;
  }, [clearPendingStatusUpdate]);

  const fetchLeads = useCallback(async () => {
    if (authLoadingRef.current) return;

    if (!userRef.current) {
      setLeads([]);
      setLoading(false);
      initialLoadDoneRef.current = true;
      initialLoadStartedRef.current = false;
      return;
    }

    if (isFetchingRef.current) {
      pendingFetchRef.current = true;
      return;
    }

    isFetchingRef.current = true;
    const fetchToken = latestFetchTokenRef.current + 1;
    latestFetchTokenRef.current = fetchToken;
    const shouldShowBlockingLoader = !initialLoadDoneRef.current && leadsRef.current.length === 0;

    try {
      // Only show loading spinner on the very first load when there is no data yet
      if (shouldShowBlockingLoader && !initialLoadStartedRef.current) {
        initialLoadStartedRef.current = true;
        setLoading(true);
      }

      // Start one safety timeout for the initial blocking load
      // CRITICAL: Do NOT check fetchToken — always force loading off after 12s
      if (shouldShowBlockingLoader && !loadingTimeoutRef.current) {
        loadingTimeoutRef.current = setTimeout(() => {
          console.warn('[Leads] Loading safety timeout triggered after 12s');
          setLoading(false);
          initialLoadDoneRef.current = true;
          initialLoadStartedRef.current = false;
          isFetchingRef.current = false;
          loadingTimeoutRef.current = null;
        }, 12000);
      }

      // PERFORMANCE: Fetch sales_leads only — abandoned_carts are handled separately
      // by LostLeadsSection / recover_orphaned_leads RPC.
      const allSalesLeadsResult = await fetchAllRows(() => {
        let query = supabase
          .from('sales_leads')
          .select(`
            id, first_name, last_name, email, phone, lead_source, status, priority, priority_score,
            plan_interest, cart_value, quote_amount, vehicle_reg, vehicle_make, vehicle_model, vehicle_year,
            vehicle_type, mileage, assigned_to, assigned_at, next_action_type, next_action_date, follow_up_status,
            last_activity_date, last_contacted_at, notes, converted_at, lost_at, lost_reason, abandoned_cart_id,
            created_at, updated_at, is_paid, payment_amount, payment_method, payment_date, step_two_completed_at,
            call_count, is_callback,
            assigned_user:admin_users!sales_leads_assigned_to_fkey(id, first_name, last_name, email),
            abandoned_cart:abandoned_carts!sales_leads_abandoned_cart_id_fkey(cart_metadata)
          `)
          .order('created_at', { ascending: false })
          .order('id', { ascending: false });

        // Apply server-side date filter to reduce dataset size
        const dateFilter = serverDateFilterRef.current;
        if (dateFilter?.from) {
          query = query.gte('created_at', dateFilter.from.toISOString());
        }
        if (dateFilter?.to) {
          query = query.lte('created_at', dateFilter.to.toISOString());
        }

        return query;
      });

      const { data: allSalesLeadsData, error: salesError } = allSalesLeadsResult;
      if (salesError) throw salesError;

      console.log(`[Leads] Fetched ${allSalesLeadsData?.length || 0} sales leads`);

      const salesLeadsWithFlags = (allSalesLeadsData || []).map((lead: any) => {
        const fullName = lead.first_name || lead.last_name
          ? `${lead.first_name || ''} ${lead.last_name || ''}`.trim()
          : lead.full_name || null;
        return {
          ...lead,
          full_name: fullName,
          status: lead.status,
          plan_name: lead.plan_interest,
          payment_type: null,
          step_abandoned: null,
          contact_status: null,
          is_from_abandoned_cart: false,
          call_count: lead.call_count || 0,
          is_callback: lead.is_callback || false,
          cart_metadata: lead.abandoned_cart?.cart_metadata || null,
          resubmission_count: lead.resubmission_count || 0,
          last_resubmitted_at: lead.last_resubmitted_at || null,
        };
      });

      // SOURCE OF TRUTH: Only sales_leads count as leads.
      // Orphaned abandoned_carts are recovered via LostLeadsSection / recover_orphaned_leads RPC.
      const allLeads = salesLeadsWithFlags
        .filter((lead: any) => !recentlyDeletedRef.current.has(lead.id))
        .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      // Deduplicate by email — keep only the most recent lead per email,
      // carry the count so we know how many times they applied
      const emailCounts: Record<string, number> = {};
      const emailBestLead: Record<string, any> = {};
      allLeads.forEach((lead: any) => {
        const email = lead.email?.toLowerCase();
        if (email) {
          emailCounts[email] = (emailCounts[email] || 0) + 1;
          // Keep the lead with the most recent activity (already sorted newest first)
          if (!emailBestLead[email]) {
            emailBestLead[email] = lead;
          }
        }
      });

      // Build deduplicated list: one row per email (most recent), plus leads without email
      const deduplicatedLeads: any[] = [];
      const seenEmails = new Set<string>();
      allLeads.forEach((lead: any) => {
        const email = lead.email?.toLowerCase();
        if (email) {
          if (!seenEmails.has(email)) {
            seenEmails.add(email);
            deduplicatedLeads.push(lead);
          }
        } else {
          deduplicatedLeads.push(lead);
        }
      });

      const leadsWithCounts = deduplicatedLeads.map((lead: any) => ({
        ...lead,
        application_count: Math.min(emailCounts[lead.email?.toLowerCase()] || 1, 10),
      }));

      const salesLeadIds = leadsWithCounts.map((lead: any) => lead.id);

      let tagsByLeadId: Record<string, any[]> = {};

      try {
        if (salesLeadIds.length > 0) {
          const leadIdBatches: string[][] = [];

          for (let i = 0; i < salesLeadIds.length; i += LEAD_TAG_BATCH_SIZE) {
            leadIdBatches.push(salesLeadIds.slice(i, i + LEAD_TAG_BATCH_SIZE));
          }

          const tagBatchResults = await Promise.all(
            leadIdBatches.map(async (batch) =>
              await supabase
                .from('lead_tag_assignments')
                .select('lead_id, tag_id, lead_tags(id, name, color, description)')
                .in('lead_id', batch)
            )
          );

          tagBatchResults.forEach(({ data, error }) => {
            if (error) throw error;

            (data || []).forEach((assignment: any) => {
              if (!tagsByLeadId[assignment.lead_id]) {
                tagsByLeadId[assignment.lead_id] = [];
              }
              if (assignment.lead_tags) {
                tagsByLeadId[assignment.lead_id].push(assignment.lead_tags);
              }
            });
          });
        }
      } catch (tagError) {
        console.warn('[Leads] Tag fetch failed, continuing without tags:', tagError);
      }

      const leadsWithTags = leadsWithCounts.map((lead: any) => ({
        ...lead,
        tags: tagsByLeadId[lead.id] || [],
      }));

      if (fetchToken !== latestFetchTokenRef.current) {
        return;
      }

      if (recentOptimisticUpdatesRef.current.size > 0) {
        setLeads(prev => {
          const protectedLeads = new Map<string, Lead>();
          prev.forEach(lead => {
            if (recentOptimisticUpdatesRef.current.has(lead.id)) {
              protectedLeads.set(lead.id, lead);
            }
          });

          const merged = (leadsWithTags as Lead[]).map(lead =>
            protectedLeads.has(lead.id) ? protectedLeads.get(lead.id)! : lead
          );

          protectedLeads.forEach((lead, id) => {
            if (!merged.find(l => l.id === id)) {
              merged.push(lead);
            }
          });

          return merged.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        });
      } else {
        setLeads(leadsWithTags as Lead[]);
      }
    } catch (error) {
      if (fetchToken !== latestFetchTokenRef.current) {
        // Even on stale token, ensure loading is cleared to prevent infinite spinner
        if (!initialLoadDoneRef.current) {
          setLoading(false);
          initialLoadDoneRef.current = true;
          initialLoadStartedRef.current = false;
        }
        isFetchingRef.current = false;
        return;
      }
      console.error('Error fetching leads:', error);
      toast.error('Failed to load leads');
    } finally {
      // ALWAYS clear loading state — never leave spinner stuck
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
        loadingTimeoutRef.current = null;
      }
      setLoading(false);
      initialLoadDoneRef.current = true;
      initialLoadStartedRef.current = false;

      isFetchingRef.current = false;

      if (pendingFetchRef.current) {
        pendingFetchRef.current = false;
        queueMicrotask(() => {
          fetchLeadsRef.current();
        });
      }
    }
  }, []);

  const fetchTags = useCallback(async () => {
    const { data, error } = await supabase
      .from('lead_tags')
      .select('*')
      .eq('is_active', true)
      .order('name');

    if (error) {
      console.error('Error fetching tags:', error);
      return;
    }

    setTags(data || []);
  }, []);

  const fetchSalesUsers = useCallback(async () => {
    const { data, error } = await supabase
      .from('admin_users')
      .select('id, user_id, first_name, last_name, email, is_active, role')
      .eq('is_active', true)
      .in('role', ['sales', 'sales_lead', 'admin', 'super_admin'])
      .order('first_name');

    if (error) {
      console.error('Error fetching sales users:', error);
      return;
    }

    setSalesUsers(data || []);
  }, []);

  // Use refs so callbacks always call the latest fetchLeads without re-creating the effect
  const fetchLeadsRef = useRef(fetchLeads);
  fetchLeadsRef.current = fetchLeads;

  // Debounced refetch for realtime - prevents stampeding when multiple changes arrive
  const realtimeRefetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRealtimeRef = useRef(false);
  // Debounce guard for focus/visibility to prevent double-firing
  const lastRefetchTimeRef = useRef(0);

  const debouncedRealtimeRefetch = useCallback(() => {
    pendingRealtimeRef.current = true;
    
    if (realtimeRefetchTimerRef.current) {
      clearTimeout(realtimeRefetchTimerRef.current);
    }
    
    realtimeRefetchTimerRef.current = setTimeout(() => {
      if (pendingRealtimeRef.current) {
        pendingRealtimeRef.current = false;
        fetchLeadsRef.current();
      }
    }, 1000);
  }, []);

  // Initial fetch: flush any queued status changes first, then load once.
  // This avoids duplicate mount-time full-table fetches that were causing lag.
  useEffect(() => {
    if (authLoading || !user?.id) return;

    let cancelled = false;

    // Fire fetch immediately — don't block on flushing pending status updates
    fetchLeadsRef.current();

    // Flush pending status updates in the background (non-blocking)
    void flushPendingStatusUpdates();

    return () => {
      cancelled = true;
    };
  }, [authLoading, user?.id, flushPendingStatusUpdates]);

  // Re-fetch when the server-side date filter changes (e.g. user picks a different day)
  const dateFilterKeyRef = useRef(dateFilterKey);
  useEffect(() => {
    if (dateFilterKeyRef.current === dateFilterKey) {
      dateFilterKeyRef.current = dateFilterKey;
      return; // Skip the very first render — initial fetch already handles it
    }
    dateFilterKeyRef.current = dateFilterKey;
    if (!authLoading && user?.id) {
      fetchLeadsRef.current();
    }
  }, [dateFilterKey, authLoading, user?.id]);

  useEffect(() => {
    if (authLoading || !user?.id) return;

    fetchTags();
    fetchSalesUsers();

    // Real-time subscriptions for multi-user sync
    const leadsChannel = supabase
      .channel('leads-realtime-sync')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'sales_leads' },
        () => debouncedRealtimeRefetch()
      )
      .subscribe();

    // Note: abandoned_carts channel removed — leads are sourced only from sales_leads now

    // Polling fallback: refresh every 60s (realtime handles fast sync, this is a safety net)
    const pollingInterval = setInterval(() => {
      fetchLeadsRef.current();
    }, 60000);

    const flushPendingStatusQueue = () => {
      void flushPendingStatusUpdates();
    };

    // Debounced visibility/focus handler - prevents rapid-fire refetches
    const throttledRefetch = () => {
      const now = Date.now();
      if (now - lastRefetchTimeRef.current < 5000) return;
      lastRefetchTimeRef.current = now;
      flushPendingStatusQueue();
      fetchLeadsRef.current();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        throttledRefetch();
      } else if (document.visibilityState === 'hidden') {
        flushPendingStatusQueue();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    const handleFocus = () => {
      throttledRefetch();
    };
    window.addEventListener('focus', handleFocus);
    window.addEventListener('pagehide', flushPendingStatusQueue);
    window.addEventListener('beforeunload', flushPendingStatusQueue);

    return () => {
      leadsChannel.unsubscribe();
      
      clearInterval(pollingInterval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('pagehide', flushPendingStatusQueue);
      window.removeEventListener('beforeunload', flushPendingStatusQueue);
      if (realtimeRefetchTimerRef.current) {
        clearTimeout(realtimeRefetchTimerRef.current);
      }
    };
  }, [authLoading, user?.id, fetchTags, fetchSalesUsers, debouncedRealtimeRefetch, flushPendingStatusUpdates]);

  // Track recently updated lead IDs to prevent realtime from overwriting optimistic updates
  const recentOptimisticUpdatesRef = useRef<Set<string>>(new Set());
  // Track recently deleted lead IDs to prevent them from re-appearing after background fetch
  const recentlyDeletedRef = useRef<Set<string>>(new Set());

  // OPTIMISTIC UPDATE: Update status instantly, then sync to DB
  // Uses functional state updates to avoid stale closure issues
  const updateLeadStatus = useCallback(async (leadId: string, status: LeadStatus) => {
    const now = new Date().toISOString();
    const isAbandonedCart = leadId.startsWith('cart_');
    const actualId = isAbandonedCart ? leadId.replace('cart_', '') : leadId;
    
    const updates: any = { 
      status, 
      updated_at: now,
      last_activity_date: now
    };

    if (status === 'converted') {
      updates.converted_at = now;
    } else if (status === 'lost') {
      updates.lost_at = now;
    }

    // Capture previous state for rollback using functional update
    let previousLeadSnapshot: Lead | null = null;
    
    // Mark this lead as recently updated to protect from realtime overwrites
    recentOptimisticUpdatesRef.current.add(leadId);
    setTimeout(() => recentOptimisticUpdatesRef.current.delete(leadId), 30000);
    queuePendingStatusUpdate(leadId, status, isAbandonedCart);

    // Optimistic update - instant UI response, capture previous state
    setLeads(prev => prev.map(lead => {
      if (lead.id !== leadId) return lead;
      previousLeadSnapshot = { ...lead };
      return { ...lead, ...updates };
    }));

    try {
      // Use SECURITY DEFINER RPC to bypass RLS — ensures all agents can update status
      const { data: result, error: rpcError } = await withTimeout(
        (async () =>
          await supabase.rpc('update_lead_status', {
            p_lead_id: actualId,
            p_status: status,
            p_is_abandoned_cart: isAbandonedCart
          }))(),
        8000,
        'Status update timeout'
      );

      if (rpcError) throw rpcError;

      const statusResult = result as { success: boolean; error?: string };
      if (!statusResult.success) {
        throw new Error(statusResult.error || 'Status update failed');
      }

      // If marked as converted/lost/fake on abandoned cart, remove from local state
      if (isAbandonedCart && (status === 'lost' || status === 'fake_lead' || status === 'converted')) {
        setLeads(prev => prev.filter(lead => lead.id !== leadId));
      }

        if (!isAbandonedCart) {
          void logActivity(leadId, 'status_change', `Status changed to ${status}`);
        }

      const statusLabel = status.replace(/_/g, ' ');
        void getCachedAdminUser().then((adminUser) => {
          void addSystemNote(leadId, `Status changed to "${statusLabel}"`, adminUser?.id);
        });

      clearPendingStatusUpdate(leadId);
      
      // Send email notification when lead is converted to sale
      if (status === 'converted') {
        const adminUser = await getCachedAdminUser();
        supabase.functions.invoke('send-agent-sale-notification', {
          body: { leadId: actualId, agentId: adminUser?.id || null }
        }).catch(err => console.error('Failed to send agent sale notification:', err));
      }
      
      toast.success(`Status: ${status.replace('_', ' ')}`);
    } catch (error) {
      console.error('Error updating lead status:', error);
      if (isRetryableMutationError(error)) {
        toast.info('Status is syncing in the background');
        return;
      }

      clearPendingStatusUpdate(leadId);
      toast.error('Failed to update lead status');
      // Revert to full previous state snapshot (not just status)
      if (previousLeadSnapshot) {
        const snapshot = previousLeadSnapshot;
        setLeads(prev => prev.map(lead => 
          lead.id === leadId ? snapshot : lead
        ));
      }
      recentOptimisticUpdatesRef.current.delete(leadId);
    }
  }, [clearPendingStatusUpdate, getCachedAdminUser, queuePendingStatusUpdate]);

  // OPTIMISTIC UPDATE: Assign lead instantly using SECURITY DEFINER function
  // This guarantees the DB write succeeds regardless of RLS policy complexity
  // Includes a freshness check to prevent two agents assigning the same lead
  const assignLead = useCallback(async (leadId: string, userId: string | null) => {
    const now = new Date().toISOString();
    const user = salesUsersRef.current.find(u => u.id === userId);
    const isAbandonedCart = leadId.startsWith('cart_');
    const actualId = isAbandonedCart ? leadId.replace('cart_', '') : leadId;

    // FRESHNESS CHECK: Before assigning, verify the lead is still unassigned in the DB
    // This prevents two agents from calling the same customer
    // Super admins and admins can always override assignments
    const currentAdmin = await getCachedAdminUser();
    const isOverrideRole = currentAdmin?.role === 'super_admin' || currentAdmin?.role === 'admin' || currentAdmin?.role === 'sales_lead';

    if (userId && !isOverrideRole) {
      try {
        const table = isAbandonedCart ? 'abandoned_carts' : 'sales_leads';
        const field = isAbandonedCart ? 'contacted_by' : 'assigned_to';
        const { data: freshLead, error: freshError } = await supabase
          .from(table)
          .select(`${field}`)
          .eq('id', actualId)
          .maybeSingle();

        if (freshError) throw freshError;

        const currentlyAssigned = freshLead?.[field];
        if (currentlyAssigned && currentlyAssigned !== userId && currentlyAssigned !== WEBSITE_SALES_ACCOUNT_ID) {
          // Someone else already grabbed this lead — refresh the list and warn
          toast.error('This lead has already been assigned to another agent. Refreshing list...');
          fetchLeadsRef.current();
          return;
        }
      } catch (err) {
        console.error('Freshness check failed, proceeding with assignment:', err);
        // If the check fails, still try to assign — the RPC will handle conflicts
      }
    }
    
    // Capture previous state for rollback using functional update
    let previousLeadSnapshot: Lead | null = null;
    
    // Protect from realtime overwrites
    recentOptimisticUpdatesRef.current.add(leadId);
    setTimeout(() => recentOptimisticUpdatesRef.current.delete(leadId), 30000);
    
    // Optimistic update
    setLeads(prev => prev.map(lead => {
      if (lead.id !== leadId) return lead;
      previousLeadSnapshot = { ...lead };
      return { 
        ...lead, 
        assigned_to: userId,
        assigned_at: userId ? now : null,
        updated_at: now,
        assigned_user: user ? {
          id: user.id,
          first_name: user.first_name,
          last_name: user.last_name,
          email: user.email
        } : null
      };
    }));

    try {
      // Use SECURITY DEFINER function for reliable assignment
      const { data: result, error: rpcError } = await supabase
        .rpc('assign_lead_to_agent', {
          p_lead_id: actualId,
          p_agent_id: userId,
          p_is_abandoned_cart: isAbandonedCart
        });

      if (rpcError) throw rpcError;

      const assignResult = result as { success: boolean; error?: string };
      if (!assignResult.success) {
        throw new Error(assignResult.error || 'Assignment failed');
      }

      if (userId && user && !isAbandonedCart) {
        logActivity(leadId, 'assignment', `Assigned to ${user.first_name || user.email || 'Unknown'}`);
      }

      // Add automated system note for assignment change (fire-and-forget)
      const adminUser = await getCachedAdminUser();
      const previousUser = previousLeadSnapshot?.assigned_user;
      const previousName = previousUser ? (previousUser.first_name || previousUser.email || 'Unknown') : 'Unassigned';
      const newName = user ? (user.first_name || user.email || 'Unknown') : 'Unassigned (Website)';
      if (previousName !== newName) {
        addSystemNote(leadId, `Lead reassigned from ${previousName} → ${newName}`, adminUser?.id);
      }

      toast.success(userId ? `Assigned to ${user?.first_name || user?.email || 'user'}` : 'Assignment removed');
    } catch (error: any) {
      console.error('Error assigning lead:', error);
      const errorMsg = error?.message || error?.details || 'Unknown error';
      toast.error(`Failed to assign lead: ${errorMsg}`);
      // Revert to full previous state snapshot
      if (previousLeadSnapshot) {
        const snapshot = previousLeadSnapshot;
        setLeads(prev => prev.map(lead => 
          lead.id === leadId ? snapshot : lead
        ));
      }
      recentOptimisticUpdatesRef.current.delete(leadId);
    }
  }, []);

  const autoAssignLead = useCallback(async (leadId: string) => {
    try {
      const { data: nextUserId, error: rpcError } = await supabase
        .rpc('get_next_sales_user');

      if (rpcError) throw rpcError;

      if (nextUserId) {
        await assignLead(leadId, nextUserId);
      } else {
        toast.error('No sales users available for assignment');
      }
    } catch (error) {
      console.error('Error auto-assigning lead:', error);
      toast.error('Failed to auto-assign lead');
    }
  }, [assignLead]);

  // OPTIMISTIC UPDATE: Update priority instantly
  const updateLeadPriority = useCallback(async (leadId: string, priority: LeadPriority) => {
    const now = new Date().toISOString();
    
    // Optimistic update
    setLeads(prev => prev.map(lead => 
      lead.id === leadId ? { ...lead, priority, updated_at: now } : lead
    ));

    try {
      const { error } = await supabase
        .from('sales_leads')
        .update({ priority, updated_at: now })
        .eq('id', leadId);

      if (error) throw error;
    } catch (error) {
      console.error('Error updating priority:', error);
      toast.error('Failed to update priority');
      fetchLeads();
    }
  }, []);

  // OPTIMISTIC UPDATE: Schedule follow-up instantly
  const scheduleFollowUp = useCallback(async (leadId: string, actionType: string, actionDate: string) => {
    const now = new Date().toISOString();
    
    // Optimistic update
    setLeads(prev => prev.map(lead => 
      lead.id === leadId 
        ? { 
            ...lead, 
            next_action_type: actionType,
            next_action_date: actionDate,
            follow_up_status: 'pending',
            updated_at: now 
          } 
        : lead
    ));

    try {
      const { error } = await supabase
        .from('sales_leads')
        .update({
          next_action_type: actionType,
          next_action_date: actionDate,
          follow_up_status: 'pending',
          updated_at: now
        })
        .eq('id', leadId);

      if (error) throw error;

      logActivity(leadId, 'follow_up', `Scheduled ${actionType} for ${new Date(actionDate).toLocaleDateString()}`);
      toast.success('Follow-up scheduled');
    } catch (error) {
      console.error('Error scheduling follow-up:', error);
      toast.error('Failed to schedule follow-up');
      fetchLeads();
    }
  }, []);

  // OPTIMISTIC UPDATE: Add tag instantly
  const addTagToLead = useCallback(async (leadId: string, tagId: string) => {
    const tagToAdd = tags.find(t => t.id === tagId);
    if (!tagToAdd) return;

    // Optimistic update
    setLeads(prev => prev.map(lead => {
      if (lead.id === leadId) {
        const existingTags = lead.tags || [];
        if (existingTags.some(t => t.id === tagId)) {
          return lead; // Already has tag
        }
        return { ...lead, tags: [...existingTags, tagToAdd] };
      }
      return lead;
    }));

    try {
      const adminUser = await getCachedAdminUser();

      const { error } = await supabase
        .from('lead_tag_assignments')
        .insert({
          lead_id: leadId,
          tag_id: tagId,
          assigned_by: adminUser?.id
        });

      if (error) {
        if (error.code === '23505') {
          return; // Already assigned, no need to revert
        }
        throw error;
      }
    } catch (error) {
      console.error('Error adding tag:', error);
      toast.error('Failed to add tag');
      fetchLeads();
    }
  }, [tags, getCachedAdminUser]);

  // OPTIMISTIC UPDATE: Remove tag instantly
  const removeTagFromLead = useCallback(async (leadId: string, tagId: string) => {
    // Optimistic update
    setLeads(prev => prev.map(lead => {
      if (lead.id === leadId) {
        return { ...lead, tags: (lead.tags || []).filter(t => t.id !== tagId) };
      }
      return lead;
    }));

    try {
      const { error } = await supabase
        .from('lead_tag_assignments')
        .delete()
        .eq('lead_id', leadId)
        .eq('tag_id', tagId);

      if (error) throw error;
    } catch (error) {
      console.error('Error removing tag:', error);
      toast.error('Failed to remove tag');
      fetchLeads();
    }
  }, []);

  const logActivity = useCallback(async (leadId: string, activityType: string, description: string, outcome?: string) => {
    try {
      const adminUser = await getCachedAdminUser();

      const { error } = await supabase
        .from('lead_activities')
        .insert({
          lead_id: leadId,
          activity_type: activityType,
          description,
          outcome,
          performed_by: adminUser?.id
        });

      if (error) throw error;

      // Update last activity date optimistically
      setLeads(prev => prev.map(lead => 
        lead.id === leadId 
          ? { ...lead, last_activity_date: new Date().toISOString() }
          : lead
      ));
    } catch (error) {
      console.error('Error logging activity:', error);
    }
  }, [getCachedAdminUser]);

  // ATOMIC UPDATE: Update notes - APPENDS new notes to history, does not replace
  // Returns Promise to allow callers to handle success/failure
  const updateLeadNotes = useCallback(async (leadId: string, newNoteText: string, replaceAll: boolean = false): Promise<void> => {
    const now = new Date().toISOString();
    const isAbandonedCart = leadId.startsWith('cart_');
    const actualId = isAbandonedCart ? leadId.replace('cart_', '') : leadId;
    
    console.log(`[useLeads] updateLeadNotes called for ${leadId}, content length: ${newNoteText.length}`);
    
    // Get current admin user info for attribution (cached)
    const adminUserCached = await getCachedAdminUser();
    const authorName = adminUserCached?.firstName || 'Admin';

    // Format timestamp for the note entry
    const timestamp = new Date().toLocaleString('en-GB', { 
      day: '2-digit', 
      month: 'short', 
      year: 'numeric', 
      hour: '2-digit', 
      minute: '2-digit' 
    });

    // Use ref to avoid stale closure - always reads latest leads
    const currentLead = leadsRef.current.find(l => l.id === leadId);
    const existingNotes = currentLead?.notes || '';
    
    // If replaceAll is true, just use newNoteText as-is (for full editor saves)
    // Otherwise, append the new note with timestamp to existing history
    let finalNotes: string;
    if (replaceAll) {
      finalNotes = newNoteText;
    } else {
      const formattedNewNote = `[${timestamp} - ${authorName}] ${newNoteText.trim()}`;
      finalNotes = existingNotes 
        ? `${existingNotes}\n\n${formattedNewNote}` 
        : formattedNewNote;
    }
    
    // Optimistic update - update local state immediately
    setLeads(prev => prev.map(lead => 
      lead.id === leadId ? { ...lead, notes: finalNotes, updated_at: now } : lead
    ));

    // Refresh session before DB write to prevent stale auth token
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData?.session) {
      await supabase.auth.refreshSession();
    }

    // Perform the actual database update
    if (isAbandonedCart) {
      // Update abandoned_carts table - use contact_notes field
      const { error } = await supabase
        .from('abandoned_carts')
        .update({ 
          contact_notes: finalNotes, 
          updated_at: now 
        })
        .eq('id', actualId);

      if (error) {
        console.error('[useLeads] Error updating abandoned cart notes:', error);
        // Revert optimistic update on error - restore from ref
        const originalLead = leadsRef.current.find(l => l.id === leadId);
        if (originalLead) {
          setLeads(prev => prev.map(l => l.id === leadId ? originalLead : l));
        }
        throw new Error(error.message);
      }
    } else {
      // Update sales_leads table
      const { error } = await supabase
        .from('sales_leads')
        .update({ notes: finalNotes, updated_at: now })
        .eq('id', leadId);

      if (error) {
        console.error('[useLeads] Error updating sales lead notes:', error);
        const originalLead = leadsRef.current.find(l => l.id === leadId);
        if (originalLead) {
          setLeads(prev => prev.map(l => l.id === leadId ? originalLead : l));
        }
        throw new Error(error.message);
      }
    }
    
    console.log(`[useLeads] Note saved successfully for ${leadId}`);
    // Note: Toast is handled by the caller (LeadDetailsPanel) to avoid duplicates
  }, [getCachedAdminUser]);

  // OPTIMISTIC UPDATE: Mark contacted instantly
  const markContactedAt = useCallback(async (leadId: string) => {
    const now = new Date().toISOString();
    
    // Optimistic update
    setLeads(prev => prev.map(lead => 
      lead.id === leadId 
        ? { 
            ...lead, 
            last_contacted_at: now,
            last_activity_date: now,
            status: 'contacted' as LeadStatus,
            updated_at: now 
          } 
        : lead
    ));

    try {
      const { error } = await supabase
        .from('sales_leads')
        .update({
          last_contacted_at: now,
          last_activity_date: now,
          status: 'contacted',
          updated_at: now
        })
        .eq('id', leadId);

      if (error) throw error;

      logActivity(leadId, 'contact', 'Marked as contacted');
    } catch (error) {
      console.error('Error marking contacted:', error);
      toast.error('Failed to update contact status');
      fetchLeads();
    }
  }, []);

  // OPTIMISTIC UPDATE: Update call count instantly
  // Uses functional state update to avoid stale closure issues
  const updateCallCount = useCallback(async (leadId: string, increment: number = 1) => {
    const now = new Date().toISOString();
    const isAbandonedCart = leadId.startsWith('cart_');
    const actualId = isAbandonedCart ? leadId.replace('cart_', '') : leadId;
    
    // Use a variable to capture the computed count from the functional update
    let newCount = 0;
    
    // Optimistic update using functional form to get the latest state
    setLeads(prev => prev.map(lead => {
      if (lead.id === leadId) {
        newCount = Math.max(0, (lead.call_count || 0) + increment);
        return { ...lead, call_count: newCount, updated_at: now };
      }
      return lead;
    }));

    // If newCount wasn't set (lead not found in state), fetch from DB
    if (newCount === 0 && increment > 0) {
      try {
        const table = isAbandonedCart ? 'abandoned_carts' : 'sales_leads';
        const { data } = await supabase
          .from(table)
          .select('call_count')
          .eq('id', actualId)
          .single();
        newCount = Math.max(0, ((data?.call_count as number) || 0) + increment);
      } catch {
        newCount = increment;
      }
    }

    try {
      if (isAbandonedCart) {
        const { error } = await supabase
          .from('abandoned_carts')
          .update({
            call_count: newCount,
            updated_at: now
          })
          .eq('id', actualId);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('sales_leads')
          .update({
            call_count: newCount,
            updated_at: now
          })
          .eq('id', actualId);

        if (error) throw error;

        // Log activity for call tracking
        if (increment > 0) {
          logActivity(leadId, 'call', `Call attempt #${newCount}`);
          // Add automated system note for call (fire-and-forget)
          getCachedAdminUser().then(adminUser => {
            addSystemNote(leadId, `📞 Call #${newCount} attempted`, adminUser?.id);
          });
        }
      }
    } catch (error) {
      console.error('Error updating call count:', error);
      toast.error('Failed to update call count');
      fetchLeads();
    }
  }, [logActivity, fetchLeads]);

  const migrateFromAbandonedCarts = useCallback(async (silent = false) => {
    try {
      const { data: result, error } = await supabase.rpc('migrate_orphan_carts_to_leads');

      if (error) throw error;

      const migrated = (result as any)?.migrated || 0;
      if (migrated > 0) {
        if (!silent) toast.success(`Migrated ${migrated} leads from abandoned carts`);
        fetchLeads();
      } else {
        if (!silent) toast.info('No new carts to migrate');
      }
    } catch (error) {
      console.error('Error migrating carts:', error);
      if (!silent) toast.error('Failed to migrate abandoned carts');
    }
  }, [fetchLeads]);

  // OPTIMISTIC UPDATE: Delete leads with instant removal
  const deleteLeads = useCallback(async (leadIds: string[]) => {
    if (leadIds.length === 0) return;

    // Store previous state for potential rollback using ref to avoid stale closure
    const previousLeads = leadsRef.current;
    
    // Mark as recently deleted to prevent re-appearing after background fetch
    leadIds.forEach(id => recentlyDeletedRef.current.add(id));
    
    // Optimistic update - remove from UI immediately
    setLeads(prev => prev.filter(lead => !leadIds.includes(lead.id)));

    try {
      const { data, error } = await supabase
        .from('sales_leads')
        .delete()
        .in('id', leadIds)
        .select('id');

      if (error) throw error;

      const deletedCount = data?.length || 0;
      if (deletedCount === 0) {
        toast.error('Unable to delete leads. You may not have permission.');
        // Clear from deleted set and rollback
        leadIds.forEach(id => recentlyDeletedRef.current.delete(id));
        setLeads(previousLeads);
        return;
      }

      toast.success(`Deleted ${deletedCount} lead${deletedCount > 1 ? 's' : ''}`);
      // Keep in deleted set for 30s to prevent re-appearing from background fetches
      setTimeout(() => {
        leadIds.forEach(id => recentlyDeletedRef.current.delete(id));
      }, 30000);
    } catch (error) {
      console.error('Error deleting leads:', error);
      toast.error('Failed to delete leads');
      // Clear from deleted set and rollback
      leadIds.forEach(id => recentlyDeletedRef.current.delete(id));
      setLeads(previousLeads);
    }
  }, []);

  return {
    leads,
    tags,
    salesUsers,
    loading,
    filter,
    setFilter,
    fetchLeads,
    updateLeadStatus,
    assignLead,
    autoAssignLead,
    updateLeadPriority,
    scheduleFollowUp,
    addTagToLead,
    removeTagFromLead,
    logActivity,
    updateLeadNotes,
    markContactedAt,
    updateCallCount,
    migrateFromAbandonedCarts,
    deleteLeads
  };
};
