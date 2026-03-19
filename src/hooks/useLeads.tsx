import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { fetchAllRows } from '@/utils/supabaseBatchFetch';
import { toast } from 'sonner';
import { addSystemNote } from '@/utils/leadSystemNotes';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

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

export const useLeads = () => {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [tags, setTags] = useState<LeadTag[]>([]);
  const [salesUsers, setSalesUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const initialLoadDoneRef = useRef(false);
  const initialLoadStartedRef = useRef(false);
  const loadingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [filter, setFilter] = useState<LeadStatus | 'all' | 'all_leads' | 'live' | 'high_priority' | 'fake' | 'lost' | 'quote_sent' | 'urgent_callback'>('all_leads');
  
  // Cache sales users and leads for optimistic updates (avoid stale closures)
  const salesUsersRef = useRef<AdminUser[]>([]);
  salesUsersRef.current = salesUsers;
  const leadsRef = useRef<Lead[]>([]);
  leadsRef.current = leads;

  // Cache admin user ID to avoid repeated auth lookups
  const cachedAdminUserRef = useRef<{ id: string; firstName: string; email: string; role: string } | null>(null);
  const adminUserPromiseRef = useRef<Promise<{ id: string; firstName: string; email: string; role: string } | null> | null>(null);

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

  // Helper to detect test/fake leads based on known test data
  const isTestLead = (name: string | null, phone: string | null): boolean => {
    const testNames = ['kamran', 'prajwal', 'praj', 'test'];
    const testPhones = ['07960111131'];
    
    const nameLower = (name || '').toLowerCase();
    const phoneClean = (phone || '').replace(/\s+/g, '');
    
    // Check if name contains any test name
    const isTestName = testNames.some(testName => nameLower.includes(testName));
    
    // Check if phone matches test phone
    const isTestPhone = testPhones.includes(phoneClean);
    
    return isTestName || isTestPhone;
  };

  const fetchLeads = useCallback(async () => {
    try {
      // Only show loading spinner on the very first successful load
      if (!initialLoadDoneRef.current) {
        if (!initialLoadStartedRef.current) {
          initialLoadStartedRef.current = true;
          setLoading(true);
        }
        // Safety timeout: force loading off after 8s to prevent infinite loading
        if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current);
        loadingTimeoutRef.current = setTimeout(() => {
          console.warn('[Leads] Loading safety timeout triggered after 8s');
          setLoading(false);
          initialLoadDoneRef.current = true;
        }, 8000);
      }

      // PERFORMANCE: Fetch one raw source-of-truth dataset, then let the UI handle view filtering.
      const [allSalesLeadsResult, abandonedCartsResult] = await Promise.all([
        fetchAllRows(() =>
          supabase
            .from('sales_leads')
            .select(`
              id, first_name, last_name, email, phone, lead_source, status, priority, priority_score,
              plan_interest, cart_value, quote_amount, vehicle_reg, vehicle_make, vehicle_model, vehicle_year,
              vehicle_type, mileage, assigned_to, assigned_at, next_action_type, next_action_date, follow_up_status,
              last_activity_date, last_contacted_at, notes, converted_at, lost_at, lost_reason, abandoned_cart_id,
              created_at, updated_at, is_paid, payment_amount, payment_method, payment_date, step_two_completed_at,
              call_count,
              assigned_user:admin_users!sales_leads_assigned_to_fkey(id, first_name, last_name, email)
            `)
            .order('created_at', { ascending: false })
        ),
        fetchAllRows(() =>
          supabase
            .from('abandoned_carts')
            .select(`
              id, full_name, email, phone, vehicle_reg, vehicle_make, vehicle_model, vehicle_year,
              vehicle_type, mileage, plan_name, payment_type, step_abandoned, contact_status,
              contacted_by, last_contacted_at, contact_notes, cart_metadata, is_converted,
              call_count, created_at, updated_at
            `)
            .eq('is_converted', false)
            .order('created_at', { ascending: false })
        ),
      ]);

      const { data: allSalesLeadsData, error: salesError } = allSalesLeadsResult;
      if (salesError) throw salesError;

      const { data: abandonedCartsData, error: cartsError } = abandonedCartsResult;
      if (cartsError) throw cartsError;

      console.log(`[Leads] Fetched ${allSalesLeadsData?.length || 0} sales leads, ${abandonedCartsData?.length || 0} abandoned carts`);

      // Build dedup sets from ALL sales leads — prevents carts reappearing.
      const linkedCartIds = new Set(
        (allSalesLeadsData || [])
          .filter((lead: any) => lead.abandoned_cart_id)
          .map((lead: any) => lead.abandoned_cart_id)
      );
      const existingEmails = new Set(
        (allSalesLeadsData || []).map((lead: any) => lead.email?.toLowerCase()).filter(Boolean)
      );
      const existingPhones = new Set(
        (allSalesLeadsData || [])
          .map((lead: any) => lead.phone?.replace(/\s/g, ''))
          .filter(Boolean)
      );

      // Build admin user lookup for abandoned cart assignments (contacted_by -> admin_users)
      const contactedByIds = (abandonedCartsData || [])
        .filter((cart: any) => cart.contacted_by)
        .map((cart: any) => cart.contacted_by);

      let adminUsersByAuthId: Record<string, any> = {};
      if (contactedByIds.length > 0) {
        const { data: adminUsersForCarts } = await supabase
          .from('admin_users')
          .select('id, user_id, first_name, last_name, email')
          .in('user_id', contactedByIds);

        (adminUsersForCarts || []).forEach((user: any) => {
          if (user.user_id) {
            adminUsersByAuthId[user.user_id] = user;
          }
        });
      }

      const mapContactStatusToLeadStatus = (contactStatus: string | null, isFakeLead: boolean): LeadStatus => {
        if (isFakeLead) return 'fake_lead';
        switch (contactStatus) {
          case 'contacted': return 'contacted';
          case 'follow_up': return 'follow_up';
          case 'quote_sent': return 'quote_sent';
          case 'negotiating': return 'negotiating';
          case 'converted': return 'converted';
          case 'lost': return 'lost';
          case 'fake_lead': return 'fake_lead';
          case 'urgent_callback': return 'urgent_callback';
          case 'special_pricing_request': return 'urgent_callback';
          default: return 'new';
        }
      };

      const cartsAsLeads = (abandonedCartsData || [])
        .filter((cart: any) =>
          !linkedCartIds.has(cart.id) &&
          !existingEmails.has(cart.email?.toLowerCase()) &&
          !(cart.phone && existingPhones.has(cart.phone.replace(/\s/g, ''))) &&
          // Step 3 carts are duplicates of existing quote-delivery sales leads.
          cart.step_abandoned !== 3
        )
        .map((cart: any) => {
          const fullName = cart.full_name || '';
          const isFakeLead = isTestLead(fullName, cart.phone) || cart.contact_status === 'fake_lead';
          const assignedAdminUser = cart.contacted_by ? adminUsersByAuthId[cart.contacted_by] : null;
          const derivedStatus = mapContactStatusToLeadStatus(cart.contact_status, isFakeLead);

          return {
            id: `cart_${cart.id}`,
            first_name: fullName.split(' ')[0] || null,
            last_name: fullName.split(' ').slice(1).join(' ') || null,
            full_name: fullName || null,
            email: cart.email,
            phone: cart.phone,
            lead_source: 'website' as LeadSource,
            status: derivedStatus,
            priority: 'medium' as LeadPriority,
            priority_score: 0,
            plan_interest: cart.plan_name,
            cart_value: null,
            quote_amount: null,
            vehicle_reg: cart.vehicle_reg,
            vehicle_make: cart.vehicle_make,
            vehicle_model: cart.vehicle_model,
            vehicle_year: cart.vehicle_year,
            vehicle_type: cart.vehicle_type,
            mileage: cart.mileage,
            assigned_to: assignedAdminUser?.id || null,
            assigned_at: cart.last_contacted_at,
            next_action_type: null,
            next_action_date: null,
            follow_up_status: 'none',
            last_activity_date: cart.updated_at,
            last_contacted_at: cart.last_contacted_at,
            notes: cart.contact_notes,
            converted_at: null,
            lost_at: null,
            lost_reason: null,
            abandoned_cart_id: cart.id,
            created_at: cart.created_at,
            updated_at: cart.updated_at,
            plan_name: cart.plan_name,
            payment_type: cart.payment_type,
            step_abandoned: cart.step_abandoned,
            contact_status: cart.contact_status,
            is_from_abandoned_cart: true,
            is_paid: false,
            payment_amount: null,
            payment_method: null,
            payment_date: null,
            step_two_completed_at: null,
            call_count: cart.call_count || 0,
            cart_metadata: cart.cart_metadata || null,
            assigned_user: assignedAdminUser ? {
              id: assignedAdminUser.id,
              first_name: assignedAdminUser.first_name,
              last_name: assignedAdminUser.last_name,
              email: assignedAdminUser.email,
            } : null,
            tags: [],
            resubmission_count: 0,
            last_resubmitted_at: null,
          };
        });

      const salesLeadsWithFlags = (allSalesLeadsData || []).map((lead: any) => {
        const fullName = lead.first_name || lead.last_name
          ? `${lead.first_name || ''} ${lead.last_name || ''}`.trim()
          : lead.full_name || null;
        const isFakeLead = isTestLead(fullName, lead.phone);

        return {
          ...lead,
          full_name: fullName,
          status: isFakeLead && lead.status === 'new' ? 'fake_lead' : lead.status,
          plan_name: lead.plan_interest,
          payment_type: null,
          step_abandoned: null,
          contact_status: null,
          is_from_abandoned_cart: false,
          call_count: lead.call_count || 0,
          cart_metadata: null,
          resubmission_count: lead.resubmission_count || 0,
          last_resubmitted_at: lead.last_resubmitted_at || null,
        };
      });

      const allLeads = [...salesLeadsWithFlags, ...cartsAsLeads]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      const emailCounts: Record<string, number> = {};
      allLeads.forEach((lead: any) => {
        const email = lead.email?.toLowerCase();
        if (email) {
          emailCounts[email] = (emailCounts[email] || 0) + 1;
        }
      });

      const leadsWithCounts = allLeads.map((lead: any) => ({
        ...lead,
        application_count: emailCounts[lead.email?.toLowerCase()] || 1,
      }));

      const salesLeadIds = leadsWithCounts
        .filter((lead: any) => !lead.is_from_abandoned_cart)
        .map((lead: any) => lead.id);

      let tagsByLeadId: Record<string, any[]> = {};

      try {
        if (salesLeadIds.length > 0) {
          const BATCH_SIZE = 300;
          const allTagData: any[] = [];

          const batchPromises = [];
          for (let i = 0; i < salesLeadIds.length; i += BATCH_SIZE) {
            const batch = salesLeadIds.slice(i, i + BATCH_SIZE);
            batchPromises.push(
              supabase
                .from('lead_tag_assignments')
                .select('lead_id, tag_id, lead_tags(id, name, color, description)')
                .in('lead_id', batch)
            );
          }
          const batchResults = await Promise.all(batchPromises);
          batchResults.forEach(({ data: batchData }) => {
            if (batchData) allTagData.push(...batchData);
          });

          allTagData.forEach((assignment: any) => {
            if (!tagsByLeadId[assignment.lead_id]) {
              tagsByLeadId[assignment.lead_id] = [];
            }
            if (assignment.lead_tags) {
              tagsByLeadId[assignment.lead_id].push(assignment.lead_tags);
            }
          });
        }
      } catch (tagError) {
        console.warn('[Leads] Tag fetch failed, continuing without tags:', tagError);
      }

      const leadsWithTags = leadsWithCounts.map((lead: any) => ({
        ...lead,
        tags: lead.is_from_abandoned_cart ? [] : (tagsByLeadId[lead.id] || []),
      }));

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
      console.error('Error fetching leads:', error);
      toast.error('Failed to load leads');
    } finally {
      if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current);
      setLoading(false);
      initialLoadDoneRef.current = true;
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

  // Initial fetch + fetch on filter change (no subscription teardown)
  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  // One-time setup for realtime, polling, and visibility listeners
  useEffect(() => {
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

    const cartsChannel = supabase
      .channel('carts-realtime-sync')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'abandoned_carts' },
        () => debouncedRealtimeRefetch()
      )
      .subscribe();

    // Polling fallback: refresh every 60s (realtime handles fast sync, this is a safety net)
    const pollingInterval = setInterval(() => {
      fetchLeadsRef.current();
    }, 60000);

    // Debounced visibility/focus handler - prevents rapid-fire refetches
    const throttledRefetch = () => {
      const now = Date.now();
      if (now - lastRefetchTimeRef.current < 5000) return;
      lastRefetchTimeRef.current = now;
      fetchLeadsRef.current();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        throttledRefetch();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    const handleFocus = () => {
      throttledRefetch();
    };
    window.addEventListener('focus', handleFocus);

    return () => {
      leadsChannel.unsubscribe();
      cartsChannel.unsubscribe();
      clearInterval(pollingInterval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
      if (realtimeRefetchTimerRef.current) {
        clearTimeout(realtimeRefetchTimerRef.current);
      }
    };
  }, [fetchTags, fetchSalesUsers, debouncedRealtimeRefetch]);

  // Track recently updated lead IDs to prevent realtime from overwriting optimistic updates
  const recentOptimisticUpdatesRef = useRef<Set<string>>(new Set());

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

    // Optimistic update - instant UI response, capture previous state
    setLeads(prev => prev.map(lead => {
      if (lead.id !== leadId) return lead;
      previousLeadSnapshot = { ...lead };
      return { ...lead, ...updates };
    }));

    try {
      // Use SECURITY DEFINER RPC to bypass RLS — ensures all agents can update status
      const { data: result, error: rpcError } = await supabase
        .rpc('update_lead_status', {
          p_lead_id: actualId,
          p_status: status,
          p_is_abandoned_cart: isAbandonedCart
        });

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
        // Log activity in background (don't await)
        logActivity(leadId, 'status_change', `Status changed to ${status}`);
      }

      // Add automated system note for status change (fire-and-forget)
      const adminUser = await getCachedAdminUser();
      const statusLabel = status.replace(/_/g, ' ');
      addSystemNote(leadId, `Status changed to "${statusLabel}"`, adminUser?.id);
      
      toast.success(`Status: ${status.replace('_', ' ')}`);
    } catch (error) {
      console.error('Error updating lead status:', error);
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
  }, []);

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
        if (currentlyAssigned && currentlyAssigned !== userId) {
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
    } catch (error) {
      console.error('Error assigning lead:', error);
      toast.error('Failed to assign lead. Please try again.');
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

  const migrateFromAbandonedCarts = useCallback(async () => {
    try {
      const { data: carts, error: fetchError } = await supabase
        .from('abandoned_carts')
        .select('*')
        .eq('is_converted', false);

      if (fetchError) throw fetchError;

      if (!carts || carts.length === 0) {
        toast.info('No abandoned carts to migrate');
        return;
      }

      let migrated = 0;
      for (const cart of carts) {
        const { data: existing } = await supabase
          .from('sales_leads')
          .select('id')
          .eq('abandoned_cart_id', cart.id)
          .maybeSingle();

        if (existing) continue;

        const { error: insertError } = await supabase
          .from('sales_leads')
          .insert({
            first_name: cart.full_name?.split(' ')[0] || null,
            last_name: cart.full_name?.split(' ').slice(1).join(' ') || null,
            email: cart.email,
            phone: cart.phone,
            lead_source: 'website',
            status: cart.contact_status === 'contacted' ? 'contacted' : 'new',
            plan_interest: cart.plan_name,
            vehicle_reg: cart.vehicle_reg,
            vehicle_make: cart.vehicle_make,
            vehicle_model: cart.vehicle_model,
            vehicle_year: cart.vehicle_year,
            vehicle_type: cart.vehicle_type,
            mileage: cart.mileage,
            notes: cart.contact_notes,
            abandoned_cart_id: cart.id
          });

        if (!insertError) {
          migrated++;
        }
      }

      toast.success(`Migrated ${migrated} leads from abandoned carts`);
      fetchLeads();
    } catch (error) {
      console.error('Error migrating carts:', error);
      toast.error('Failed to migrate abandoned carts');
    }
  }, [fetchLeads]);

  // OPTIMISTIC UPDATE: Delete leads with instant removal
  const deleteLeads = useCallback(async (leadIds: string[]) => {
    if (leadIds.length === 0) return;

    // Store previous state for potential rollback using ref to avoid stale closure
    const previousLeads = leadsRef.current;
    
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
        setLeads(previousLeads); // Rollback
        return;
      }

      toast.success(`Deleted ${deletedCount} lead${deletedCount > 1 ? 's' : ''}`);
    } catch (error) {
      console.error('Error deleting leads:', error);
      toast.error('Failed to delete leads');
      setLeads(previousLeads); // Rollback
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
