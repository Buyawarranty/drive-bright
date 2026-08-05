import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { addSystemNote } from '@/utils/leadSystemNotes';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { WEBSITE_SALES_ACCOUNT_ID } from '@/constants/salesDefaults';
import { useAuth } from '@/hooks/useAuth';
import { useViewAs } from '@/contexts/ViewAsContext';

const LEAD_TAG_BATCH_SIZE = 75;
const INITIAL_LEADS_LOAD_TIMEOUT_MS = 25000;
const LEADS_FETCH_TIMEOUT_MS = 25000;
const LEAD_TAG_BATCH_TIMEOUT_MS = 4000;
const LEADS_LIST_LIMIT = 750;
const LEADS_PAGE_SIZE = 1000;
const MAX_PAGED_LEADS = 5000;
const PENDING_STATUS_UPDATES_STORAGE_KEY = 'new-leads:pending-status-updates';
let latestAccessToken: string | null = null;

const cacheLatestAccessToken = async () => {
  const { data } = await supabase.auth.getSession();
  latestAccessToken = data.session?.access_token || null;
  return latestAccessToken;
};

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

const callUpdateLeadStatusRpc = async (
  leadId: string,
  status: LeadStatus,
  isAbandonedCart: boolean,
  keepalive = false
) => {
  const accessToken = keepalive ? latestAccessToken : await cacheLatestAccessToken();
  const supabaseUrl = (supabase as any).supabaseUrl || import.meta.env.VITE_SUPABASE_URL;
  const supabaseKey = (supabase as any).supabaseKey || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase configuration missing');
  }

  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/update_lead_status`, {
    method: 'POST',
    keepalive,
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${accessToken || supabaseKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      p_lead_id: isAbandonedCart ? leadId.replace('cart_', '') : leadId,
      p_status: status,
      p_is_abandoned_cart: isAbandonedCart,
    }),
  });

  if (!response.ok) {
    throw new Error((await response.text()) || `Status update failed (${response.status})`);
  }

  return await response.json() as { success: boolean; error?: string };
};

export type LeadStatus = 'new' | 'contacted' | 'follow_up' | 'quote_sent' | 'negotiating' | 'converted' | 'lost' | 'not_interested' | 'fake_lead' | 'urgent_callback' | 'no_answer' | 'left_voicemail' | 'wrong_number' | 'callback_booked' | 'bought_elsewhere' | 'vehicle_sold' | 'do_not_contact';
export type LeadPriority = 'low' | 'medium' | 'high' | 'urgent';
export type LeadSource = 'website' | 'referral' | 'social_ad' | 'google_ad' | 'bing_ad' | 'phone' | 'email' | 'partner' | 'other';

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
  // Recontact bulk-claim tracking — how many times this lead has been claimed
  // from the recontact pool (via ClaimRecontactBatchButton). >1 means it's
  // been through multiple agents' hands.
  claim_count?: number;
  last_claimed_at?: string | null;
  // Agent ids the lead should be hidden from in normal lists (previous owners
  // after a recontact re-claim). They can still find the lead via search.
  hidden_from_agent_ids?: string[] | null;
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
  /** Server-side agent scope used for historical agent views so counts are not based on the recent global window. */
  serverAgentFilter?: string;
  /** Server-side database-wide search used when the user searches leads by core fields. */
  serverSearchTerm?: string;
  /** When true, server fetches ALL callback leads (is_callback=true) regardless of date window. */
  serverCallbacksOnly?: boolean;
  /**
   * When true, the server date window ALSO matches leads whose last_contacted_at
   * falls inside it. Lets an agent find older leads they actually worked today,
   * which the created_at / last_resubmitted_at window hides.
   */
  serverIncludeContactedInRange?: boolean;

  /** Explicit lead IDs to load, used for reminders so old callback leads do not disappear from the list. */
  serverLeadIds?: string[];
}

export const useLeads = (options?: UseLeadsOptions) => {
  const { user, loading: authLoading } = useAuth();
  const { isImpersonating, effectiveAdminUserId, effectiveRole, effectivePermissions } = useViewAs();
  // Refs so fetchLeads can read the latest impersonation state without being recreated
  const impersonationRef = useRef({ isImpersonating, effectiveAdminUserId, effectiveRole, effectivePermissions });
  impersonationRef.current = { isImpersonating, effectiveAdminUserId, effectiveRole, effectivePermissions };
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
  const networkRetryCountRef = useRef(0);
  const networkRetryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [filter, setFilter] = useState<LeadStatus | 'all' | 'all_leads' | 'live' | 'high_priority' | 'fake' | 'lost' | 'quote_sent' | 'urgent_callback' | 'callbacks' | 'recovered'>('all_leads');

  // Store server date filter as a ref so fetchLeads doesn't re-create on every date change
  const serverDateFilterRef = useRef(options?.serverDateFilter);
  serverDateFilterRef.current = options?.serverDateFilter;
  const serverAgentFilterRef = useRef(options?.serverAgentFilter);
  serverAgentFilterRef.current = options?.serverAgentFilter;
  const serverSearchTermRef = useRef(options?.serverSearchTerm);
  serverSearchTermRef.current = options?.serverSearchTerm;
  const serverCallbacksOnlyRef = useRef(options?.serverCallbacksOnly);
  serverCallbacksOnlyRef.current = options?.serverCallbacksOnly;
  const serverLeadIdsRef = useRef(options?.serverLeadIds);
  serverLeadIdsRef.current = options?.serverLeadIds;
  const serverIncludeContactedRef = useRef(options?.serverIncludeContactedInRange);
  serverIncludeContactedRef.current = options?.serverIncludeContactedInRange;

  // Stable key that changes when the date filter boundaries change — triggers re-fetch
  const dateFilterKey = useMemo(() => {
    const f = options?.serverDateFilter;
    const dateKey = !f?.from && !f?.to ? 'all' : `${f.from?.getTime() ?? ''}_${f.to?.getTime() ?? ''}`;
    const explicitLeadIdsKey = options?.serverLeadIds ? [...options.serverLeadIds].sort().join('|') : '';
    return `${dateKey}_${options?.serverAgentFilter ?? 'all'}_${options?.serverSearchTerm?.trim().toLowerCase() ?? ''}_${options?.serverCallbacksOnly ? 'cb' : ''}_${options?.serverIncludeContactedInRange ? 'wk' : ''}_${explicitLeadIdsKey}`;
  }, [options?.serverDateFilter, options?.serverAgentFilter, options?.serverSearchTerm, options?.serverCallbacksOnly, options?.serverIncludeContactedInRange, options?.serverLeadIds]);

  
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
  const cachedAdminUserRef = useRef<{ id: string; firstName: string; email: string; role: string; permissions: Record<string, boolean> } | null>(null);
  const adminUserPromiseRef = useRef<Promise<{ id: string; firstName: string; email: string; role: string; permissions: Record<string, boolean> } | null> | null>(null);
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
        .select('id, first_name, email, role, permissions')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (adminUser) {
        const cached = { 
          id: adminUser.id, 
          firstName: adminUser.first_name || adminUser.email?.split('@')[0] || 'Admin',
          email: adminUser.email,
          role: adminUser.role || 'sales',
          permissions: (adminUser.permissions as Record<string, boolean>) || {}
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
          const statusResult = await withTimeout(
            callUpdateLeadStatusRpc(item.leadId, item.status, item.isAbandonedCart, false),
            8000,
            'Pending status sync timed out'
          );
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
        }, INITIAL_LEADS_LOAD_TIMEOUT_MS);
      }

      // PERFORMANCE: Fetch sales_leads only — abandoned_carts are handled separately
      // by LostLeadsSection / recover_orphaned_leads RPC.
      // For 'sales' role agents: fetch ALL leads assigned to them (no 750 cap),
      // plus the most recent unassigned leads so they can still claim new ones.
      // For admin / sales_lead / super_admin: keep the global recent-750 window.
      let currentAdmin = await getCachedAdminUser();
      // When a super_admin impersonates another agent via "View As", scope the lead
      // fetch as if it were that agent — otherwise we'd return the global recent-750
      // window and miss older leads assigned to the impersonated sales agent.
      const imp = impersonationRef.current;
      if (imp.isImpersonating && imp.effectiveAdminUserId && currentAdmin) {
        currentAdmin = {
          ...currentAdmin,
          id: imp.effectiveAdminUserId,
          role: imp.effectiveRole || currentAdmin.role,
          permissions: (imp.effectivePermissions as Record<string, boolean>) || {},
        };
      }
      // Sales agents are normally restricted to assigned + unassigned leads.
      // Granting `tab_new-leads_all-leads` lifts that restriction (manager-style global view).
      const hasAllLeadsPerm = currentAdmin?.permissions?.['tab_new-leads_all-leads'] === true;
      const isSalesAgent = currentAdmin?.role === 'sales' && !hasAllLeadsPerm;

      const SELECT_COLUMNS = `
        id, first_name, last_name, email, phone, lead_source, status, priority, priority_score,
        plan_interest, cart_value, quote_amount, vehicle_reg, vehicle_make, vehicle_model, vehicle_year,
        vehicle_type, mileage, assigned_to, assigned_at, next_action_type, next_action_date, follow_up_status,
        last_activity_date, last_contacted_at, notes, converted_at, lost_at, lost_reason, abandoned_cart_id,
        created_at, updated_at, is_paid, payment_amount, payment_method, payment_date, step_two_completed_at,
        call_count, is_callback, resubmission_count, last_resubmitted_at, hidden_from_agent_ids
      `;

      // For a sales agent, resolve the ids of everyone on their team so
      // searches stay scoped to that team (they should NOT see other teams'
      // leads even when searching by phone / reg). Managers keep global search.
      let teamMemberIds: string[] | null = null;
      if (isSalesAgent && currentAdmin?.id) {
        const { data: myMembership } = await supabase
          .from('lead_team_members')
          .select('team_id')
          .eq('admin_user_id', currentAdmin.id)
          .maybeSingle();
        if (myMembership?.team_id) {
          const { data: teamMates } = await supabase
            .from('lead_team_members')
            .select('admin_user_id')
            .eq('team_id', myMembership.team_id);
          teamMemberIds = Array.from(new Set([
            currentAdmin.id,
            ...((teamMates || []) as any[]).map((r) => r.admin_user_id).filter(Boolean),
          ]));
        } else {
          teamMemberIds = [currentAdmin.id];
        }
      }

      // When a lead has been claimed away from a previous owner via the
      // Recontact pool, the previous owner id is stored in
      // hidden_from_agent_ids so the lead no longer surfaces for them.
      const applyHiddenFromAgent = (query: any) => {
        if (!isSalesAgent || !currentAdmin?.id) return query;
        return query.not('hidden_from_agent_ids', 'cs', `{${currentAdmin.id}}`);
      };

      const applyServerDateFilter = (query: any) => {
        if (serverSearchTermRef.current?.trim()) return query;
        if (serverCallbacksOnlyRef.current) return query;

        const dateFilter = serverDateFilterRef.current;
        if (!dateFilter?.from && !dateFilter?.to) return query;

        // Filter by the effective "lead date" that shows in the row:
        // last_resubmitted_at when present, otherwise created_at.
        // We want rows where EITHER column falls fully inside [from, to].
        // Chaining multiple `.or()` calls produces repeated `or=` params which
        // PostgREST does not always AND correctly — combine into a single
        // `or(and(...), and(...))` expression so the window is respected.
        const fromIso = dateFilter.from?.toISOString();
        const toIso = dateFilter.to?.toISOString();

        const createdParts: string[] = [];
        const resubParts: string[] = [];
        const contactedParts: string[] = [];
        if (fromIso) {
          createdParts.push(`created_at.gte.${fromIso}`);
          resubParts.push(`last_resubmitted_at.gte.${fromIso}`);
          contactedParts.push(`last_contacted_at.gte.${fromIso}`);
        }
        if (toIso) {
          createdParts.push(`created_at.lte.${toIso}`);
          resubParts.push(`last_resubmitted_at.lte.${toIso}`);
          contactedParts.push(`last_contacted_at.lte.${toIso}`);
        }

        const groupOf = (parts: string[]) => (parts.length > 1 ? `and(${parts.join(',')})` : parts[0]);
        const groups = [groupOf(createdParts), groupOf(resubParts)];
        if (serverIncludeContactedRef.current) groups.push(groupOf(contactedParts));

        return query.or(groups.join(','));

      };

      const applyCallbacksFilter = (query: any) => {
        if (!serverCallbacksOnlyRef.current) return query;
        return query.eq('is_callback', true);
      };

      const applyServerSearchFilter = (query: any) => {
        const rawTerm = serverSearchTermRef.current?.trim();
        if (!rawTerm) return query;

        const escapedTerm = rawTerm.replace(/[%_]/g, '\\$&').replace(/,/g, ' ');
        const wildcardTerm = `%${escapedTerm}%`;
        const nameParts = escapedTerm.split(/\s+/).filter(Boolean);
        const digitsOnly = rawTerm.replace(/\D/g, '');
        const compactTerm = rawTerm.replace(/\s+/g, '');
        const phoneVariants = new Set<string>();
        const regVariants = new Set<string>();
        const searchClauses = [
          `email.ilike.${wildcardTerm}`,
          `first_name.ilike.${wildcardTerm}`,
          `last_name.ilike.${wildcardTerm}`,
          `phone.ilike.${wildcardTerm}`,
          `vehicle_reg.ilike.${wildcardTerm}`,
          `vehicle_make.ilike.${wildcardTerm}`,
          `vehicle_model.ilike.${wildcardTerm}`,
          `vehicle_year.ilike.${wildcardTerm}`,
          `plan_interest.ilike.${wildcardTerm}`,
          `notes.ilike.${wildcardTerm}`,
        ];

        if (nameParts.length >= 2) {
          const firstPart = `%${nameParts[0]}%`;
          const lastPart = `%${nameParts.slice(1).join(' ')}%`;
          const reversedFirst = `%${nameParts[nameParts.length - 1]}%`;
          const reversedLast = `%${nameParts.slice(0, -1).join(' ')}%`;
          searchClauses.push(`and(first_name.ilike.${firstPart},last_name.ilike.${lastPart})`);
          searchClauses.push(`and(first_name.ilike.${reversedFirst},last_name.ilike.${reversedLast})`);
        }

        if (digitsOnly.length >= 6) {
          phoneVariants.add(digitsOnly);
          phoneVariants.add(digitsOnly.replace(/^(\d{5})(\d+)/, '$1 $2'));
          if (digitsOnly.startsWith('44')) {
            phoneVariants.add(`0${digitsOnly.slice(2)}`);
          } else if (digitsOnly.startsWith('0')) {
            phoneVariants.add(`+44${digitsOnly.slice(1)}`);
            phoneVariants.add(`44${digitsOnly.slice(1)}`);
          }
        }

        if (/^[a-z0-9]{5,}$/i.test(compactTerm)) {
          const upperCompact = compactTerm.toUpperCase();
          regVariants.add(upperCompact);
          regVariants.add(`${upperCompact.slice(0, -3)} ${upperCompact.slice(-3)}`);
        }

        searchClauses.push(...Array.from(phoneVariants).map(value => `phone.ilike.%${value}%`));
        searchClauses.push(...Array.from(regVariants).map(value => `vehicle_reg.ilike.%${value}%`));

        return query.or(searchClauses.join(','));
      };

      const fetchPagedLeads = async (buildQuery: (from: number, to: number) => any) => {
        const rows: any[] = [];
        for (let offset = 0; offset < MAX_PAGED_LEADS; offset += LEADS_PAGE_SIZE) {
          const { data, error } = await buildQuery(offset, offset + LEADS_PAGE_SIZE - 1);
          if (error) return { data: rows, error } as any;
          const page = data || [];
          rows.push(...page);
          if (page.length < LEADS_PAGE_SIZE) break;
        }
        return { data: rows, error: null } as any;
      };

      const fetchExplicitLeads = async (ids: string[]) => {
        const cleanedIds = [...new Set(ids.filter(id => id && !id.startsWith('cart_') && !id.startsWith('customer_') && !id.startsWith('claim_')))];
        if (cleanedIds.length === 0) return { data: [], error: null } as any;

        const rows: any[] = [];
        for (let i = 0; i < cleanedIds.length; i += LEAD_TAG_BATCH_SIZE) {
          const batch = cleanedIds.slice(i, i + LEAD_TAG_BATCH_SIZE);
          const { data, error } = await applyServerSearchFilter(
            supabase
              .from('sales_leads')
              .select(SELECT_COLUMNS)
              .in('id', batch)
          );
          if (error) return { data: rows, error } as any;
          rows.push(...(data || []));
        }

        return { data: rows, error: null } as any;
      };

      const allSalesLeadsResult = await withTimeout(
        (async () => {
          const serverAgentFilter = serverAgentFilterRef.current;
          if (serverAgentFilter && serverAgentFilter !== 'all' && serverAgentFilter !== 'unassigned') {
            return await fetchPagedLeads((from, to) =>
              applyCallbacksFilter(applyServerSearchFilter(applyServerDateFilter(
                supabase
                  .from('sales_leads')
                  .select(SELECT_COLUMNS)
                  .eq('assigned_to', serverAgentFilter)
                  .order('created_at', { ascending: false })
                  .order('id', { ascending: false })
                  .range(from, to)
              )))
            );
          }

          if (serverAgentFilter === 'unassigned') {
            return await fetchPagedLeads((from, to) =>
              applyCallbacksFilter(applyServerSearchFilter(applyServerDateFilter(
                supabase
                  .from('sales_leads')
                  .select(SELECT_COLUMNS)
                  .is('assigned_to', null)
                  .order('created_at', { ascending: false })
                  .order('id', { ascending: false })
                  .range(from, to)
              )))
            );
          }

          // When a sales agent is actively searching, broaden the query to ALL leads
          // so they can find any customer (assigned to anyone) and call them back or
          // hand off to the right salesperson. Without an active search, keep the
          // narrower assigned+unassigned scope.
          const hasActiveSearch = !!serverSearchTermRef.current?.trim();
          if (isSalesAgent && currentAdmin?.id && !hasActiveSearch) {
            // 1) All leads assigned to this agent (full history, no 750 cap)
            const assignedQ = fetchPagedLeads((from, to) =>
              applyHiddenFromAgent(applyCallbacksFilter(applyServerSearchFilter(applyServerDateFilter(
                supabase
                  .from('sales_leads')
                  .select(SELECT_COLUMNS)
                  .eq('assigned_to', currentAdmin.id)
                  .order('created_at', { ascending: false })
                  .order('id', { ascending: false })
                  .range(from, to)
              ))))
            );

            // 2) Recent unassigned leads so the agent can still claim
            let unassignedQ = supabase
              .from('sales_leads')
              .select(SELECT_COLUMNS)
              .is('assigned_to', null)
              .order('created_at', { ascending: false })
              .order('id', { ascending: false })
              .limit(500);
            unassignedQ = applyServerDateFilter(unassignedQ);
            unassignedQ = applyServerSearchFilter(unassignedQ);
            unassignedQ = applyCallbacksFilter(unassignedQ);
            unassignedQ = applyHiddenFromAgent(unassignedQ);

            const [assignedRes, unassignedRes] = await Promise.all([assignedQ, unassignedQ]);
            if (assignedRes.error) return assignedRes;
            if (unassignedRes.error) return unassignedRes;

            const merged = [...(assignedRes.data || []), ...(unassignedRes.data || [])];
            // Dedupe by id
            const seen = new Set<string>();
            const data = merged.filter((r: any) => {
              if (seen.has(r.id)) return false;
              seen.add(r.id);
              return true;
            });
            return { data, error: null } as any;
          }

          const hasServerSearch = !!serverSearchTermRef.current?.trim();
          if (hasServerSearch) {
            // Sales agents searching should stay scoped to their own team's
            // leads (plus unassigned so they can claim). Managers/admins see
            // the global result set unchanged.
            if (isSalesAgent && teamMemberIds && teamMemberIds.length > 0) {
              const idsCsv = teamMemberIds.join(',');
              // Allow searching within: own team, unassigned, OR any lead the
              // current agent used to own (so they can help returning callers).
              // The row will be badged "Old lead — new owner" in the UI.
              const scopeOr = `assigned_to.in.(${idsCsv}),assigned_to.is.null,hidden_from_agent_ids.cs.{${currentAdmin.id}}`;
              return await fetchPagedLeads((from, to) =>
                applyCallbacksFilter(applyServerSearchFilter(applyServerDateFilter(
                  supabase
                    .from('sales_leads')
                    .select(SELECT_COLUMNS)
                    .or(scopeOr)
                    .order('created_at', { ascending: false })
                    .order('id', { ascending: false })
                    .range(from, to)
                )))
              );
            }
            return await fetchPagedLeads((from, to) =>
              applyCallbacksFilter(applyServerSearchFilter(applyServerDateFilter(
                supabase
                  .from('sales_leads')
                  .select(SELECT_COLUMNS)
                  .order('created_at', { ascending: false })
                  .order('id', { ascending: false })
                  .range(from, to)
              )))
            );
          }

          const dateFilter = serverDateFilterRef.current;
          const hasDateBoundedView = !!dateFilter?.from || !!dateFilter?.to;

          if (hasDateBoundedView || serverCallbacksOnlyRef.current) {
            return await fetchPagedLeads((from, to) =>
              applyCallbacksFilter(applyServerDateFilter(
                supabase
                  .from('sales_leads')
                  .select(SELECT_COLUMNS)
                  .order('created_at', { ascending: false })
                  .order('id', { ascending: false })
                  .range(from, to)
              ))
            );
          }

          return await supabase
            .from('sales_leads')
            .select(SELECT_COLUMNS)
            .order('created_at', { ascending: false })
            .order('id', { ascending: false })
            .limit(LEADS_LIST_LIMIT);
        })(),
        LEADS_FETCH_TIMEOUT_MS,
        'Leads fetch timed out'
      );

      const { data: allSalesLeadsData, error: salesError } = allSalesLeadsResult;
      if (salesError) throw salesError;

      const explicitLeadIds = serverLeadIdsRef.current || [];
      const explicitLeadsResult = explicitLeadIds.length > 0
        ? await withTimeout(fetchExplicitLeads(explicitLeadIds), LEADS_FETCH_TIMEOUT_MS, 'Reminder leads fetch timed out')
        : { data: [], error: null } as any;
      if (explicitLeadsResult.error) throw explicitLeadsResult.error;

      const salesLeadRowsById = new Map<string, any>();
      [...(allSalesLeadsData || []), ...(explicitLeadsResult.data || [])].forEach((lead: any) => {
        if (!salesLeadRowsById.has(lead.id)) salesLeadRowsById.set(lead.id, lead);
      });

      console.log(`[Leads] Fetched ${salesLeadRowsById.size} sales leads (sales agent: ${isSalesAgent})`);

      const salesLeadsWithFlags = Array.from(salesLeadRowsById.values()).map((lead: any) => {
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
          hidden_from_agent_ids: lead.hidden_from_agent_ids || null,
        };
      });

      // SOURCE OF TRUTH: Only sales_leads count as leads.
      // Orphaned abandoned_carts are recovered via LostLeadsSection / recover_orphaned_leads RPC.
      const allLeads = salesLeadsWithFlags
        .filter((lead: any) => !recentlyDeletedRef.current.has(lead.id))
        .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      // Deduplicate by email — pick the canonical "owner" row, not just the newest.
      // Priority: assigned + has activity → assigned → has activity → most recently updated → newest created.
      // This prevents duplicate rows from making ownership appear to switch between agents.
      const emailCounts: Record<string, number> = {};
      const emailGroups: Record<string, any[]> = {};
      allLeads.forEach((lead: any) => {
        const email = lead.email?.toLowerCase();
        if (email) {
          emailCounts[email] = (emailCounts[email] || 0) + 1;
          (emailGroups[email] ||= []).push(lead);
        }
      });

      const scoreLead = (l: any) => {
        const hasAssignee = l.assigned_to ? 0 : 1;
        const hasActivity = (l.call_count > 0 || l.notes || l.last_contacted_at) ? 0 : 1;
        return { hasAssignee, hasActivity };
      };
      const pickCanonical = (rows: any[]) =>
        [...rows].sort((a, b) => {
          const sa = scoreLead(a), sb = scoreLead(b);
          if (sa.hasAssignee !== sb.hasAssignee) return sa.hasAssignee - sb.hasAssignee;
          if (sa.hasActivity !== sb.hasActivity) return sa.hasActivity - sb.hasActivity;
          const ua = new Date(a.updated_at || a.created_at).getTime();
          const ub = new Date(b.updated_at || b.created_at).getTime();
          if (ua !== ub) return ub - ua;
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        })[0];

      const deduplicatedLeads: any[] = [];
      const seenEmails = new Set<string>();
      allLeads.forEach((lead: any) => {
        const email = lead.email?.toLowerCase();
        if (email) {
          if (!seenEmails.has(email)) {
            seenEmails.add(email);
            deduplicatedLeads.push(pickCanonical(emailGroups[email]));
          }
        } else {
          deduplicatedLeads.push(lead);
        }
      });

      const leadsWithCounts = deduplicatedLeads.map((lead: any) => ({
        ...lead,
        application_count: Math.min(emailCounts[lead.email?.toLowerCase()] || 1, 10),
      }));

      const visibleLeadIds = leadsWithCounts.slice(0, 250).map((lead: any) => lead.id);

      let tagsByLeadId: Record<string, any[]> = {};

      try {
        if (visibleLeadIds.length > 0) {
          const leadIdBatches: string[][] = [];

          for (let i = 0; i < visibleLeadIds.length; i += LEAD_TAG_BATCH_SIZE) {
            leadIdBatches.push(visibleLeadIds.slice(i, i + LEAD_TAG_BATCH_SIZE));
          }

          for (const batch of leadIdBatches) {
            const { data, error } = await withTimeout(
              (async () =>
                await supabase
                  .from('lead_tag_assignments')
                  .select('lead_id, tag_id, lead_tags(id, name, color, description)')
                  .in('lead_id', batch))(),
              LEAD_TAG_BATCH_TIMEOUT_MS,
              'Lead tag lookup timed out'
            );

            if (error) {
              console.warn('[Leads] Tag batch fetch failed, skipping batch:', error);
              continue;
            }

            (data || []).forEach((assignment: any) => {
              if (!tagsByLeadId[assignment.lead_id]) {
                tagsByLeadId[assignment.lead_id] = [];
              }
              if (assignment.lead_tags) {
                tagsByLeadId[assignment.lead_id].push(assignment.lead_tags);
              }
            });
          }
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
      networkRetryCountRef.current = 0;
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
      console.error('[Leads] Error fetching leads:', error);
      const errMsg = (error as any)?.message || (error as any)?.details || 'Unknown error';
      const lowered = String(errMsg).toLowerCase();
      const isTransientNetwork =
        lowered.includes('failed to fetch') ||
        lowered.includes('networkerror') ||
        lowered.includes('load failed') ||
        lowered.includes('aborterror') ||
        lowered.includes('timed out');

      if (isTransientNetwork && networkRetryCountRef.current < 2) {
        // Browser was offline / tab throttled / transient fetch failure —
        // silently retry instead of nagging the user with a red toast.
        networkRetryCountRef.current += 1;
        const delay = 1500 * networkRetryCountRef.current;
        console.warn(`[Leads] Transient network error, retrying in ${delay}ms (attempt ${networkRetryCountRef.current}/2)`);
        if (networkRetryTimerRef.current) clearTimeout(networkRetryTimerRef.current);
        networkRetryTimerRef.current = setTimeout(() => {
          networkRetryTimerRef.current = null;
          fetchLeadsRef.current?.();
        }, delay);
      } else {
        toast.error(`Failed to load leads: ${errMsg}`);
        networkRetryCountRef.current = 0;
      }

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
      .in('role', ['sales', 'sales_lead', 'claims_agent', 'claims_manager', 'admin', 'super_admin'])
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

    void cacheLatestAccessToken();

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

  // Re-fetch when the super_admin starts/stops impersonating another agent so the
  // scoped query (assigned-to-that-agent) runs instead of the global recent-750 window.
  const impersonationKey = `${isImpersonating ? '1' : '0'}_${effectiveAdminUserId || ''}_${effectiveRole || ''}`;
  const impersonationKeyRef = useRef(impersonationKey);
  useEffect(() => {
    if (impersonationKeyRef.current === impersonationKey) return;
    impersonationKeyRef.current = impersonationKey;
    if (!authLoading && user?.id) {
      fetchLeadsRef.current();
    }
  }, [impersonationKey, authLoading, user?.id]);

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
      const pending = Object.values(readPendingStatusUpdates()).sort(
        (a, b) => new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime()
      );

      if (pending.length === 0) return;

      void cacheLatestAccessToken();

      if (document.visibilityState === 'hidden') {
        pending.forEach(item => {
          void callUpdateLeadStatusRpc(item.leadId, item.status, item.isAbandonedCart, true)
            .then((result) => {
              if (result?.success) clearPendingStatusUpdate(item.leadId);
            })
            .catch((error) => console.warn('[Leads] keepalive status sync will retry later:', error));
        });
        return;
      }

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
      const statusResult = await withTimeout(
        callUpdateLeadStatusRpc(actualId, status, isAbandonedCart, false),
        8000,
        'Status update timeout'
      );
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
      
      return;
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
    // Self-assign always wins — if an agent clicks "assign to me", they get the lead
    // even if the auto-sweep just handed it to someone else. Only cross-agent
    // reassignments by non-managers still hit the freshness guard.
    const isSelfAssign = !!userId && !!currentAdmin?.id && userId === currentAdmin.id;

    if (userId && !isOverrideRole && !isSelfAssign) {
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
          toast.error('This lead has already been assigned to another agent. Refreshing list...');
          fetchLeadsRef.current();
          return;
        }
      } catch (err) {
        console.error('Freshness check failed, proceeding with assignment:', err);
      }
    }

    let previousLeadSnapshot: Lead | null = null;
    recentOptimisticUpdatesRef.current.add(leadId);
    setTimeout(() => recentOptimisticUpdatesRef.current.delete(leadId), 30000);

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
      const { data: result, error: rpcError } = await supabase
        .rpc('assign_lead_to_agent', {
          p_lead_id: actualId,
          p_agent_id: userId,
          p_is_abandoned_cart: isAbandonedCart,
        });

      if (rpcError) throw rpcError;

      const assignResult = result as { success: boolean; error?: string };
      if (!assignResult.success) {
        throw new Error(assignResult.error || 'Assignment failed');
      }

      if (userId && user && !isAbandonedCart) {
        logActivity(leadId, 'assignment', `Assigned to ${user.first_name || user.email || 'Unknown'}`);
      }

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
      // Activity log: agents need a visible trail whenever priority changes.
      void logActivity(leadId, 'priority_change', `Priority set to ${priority}`);
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
      // Activity log: tag changes should show up in the lead's activity feed.
      void logActivity(leadId, 'tag_added', `Tag "${tagToAdd.name}" added`);
    } catch (error) {
      console.error('Error adding tag:', error);
      toast.error('Failed to add tag');
      fetchLeads();
    }
  }, [tags, getCachedAdminUser]);

  // OPTIMISTIC UPDATE: Remove tag instantly
  const removeTagFromLead = useCallback(async (leadId: string, tagId: string) => {
    // Capture the tag name before optimistic removal so the activity log can
    // reference it even after it's gone from local state.
    const removedTag = tags.find(t => t.id === tagId);
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
      void logActivity(leadId, 'tag_removed', `Tag "${removedTag?.name ?? 'unknown'}" removed`);
    } catch (error) {
      console.error('Error removing tag:', error);
      toast.error('Failed to remove tag');
      fetchLeads();
    }
  }, [tags]);

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
    // Activity log so agents can see notes were added/updated from the row toolbar.
    void logActivity(leadId, 'note', replaceAll ? 'Notes edited' : 'Note added');
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

    // Small helper: run the update, retry once on transient timeouts before
    // showing the user an error. sales_leads has heavy trigger overhead and
    // the first write occasionally hits statement_timeout under load — a
    // silent retry hides that from the agent so they don't feel the button
    // is broken and start double-clicking.
    const runUpdate = async () => {
      const table = isAbandonedCart ? 'abandoned_carts' : 'sales_leads';
      return supabase
        .from(table)
        .update({ call_count: newCount, updated_at: now })
        .eq('id', actualId);
    };

    try {
      let { error } = await runUpdate();
      if (error && /timeout|canceling statement|deadlock/i.test(error.message)) {
        ({ error } = await runUpdate());
      }
      if (error) throw error;

      // Log activity for call tracking (sales leads only). We deliberately do
      // NOT write a generic "📞 Call #N attempted" system note here — the
      // outcome-picker (NotesQuickActionsPopover) writes the meaningful
      // "Call #N — <outcome>" note, and writing both at the same second was
      // double-counting the notes badge.
      if (!isAbandonedCart && increment > 0) {
        logActivity(leadId, 'call', `Call attempt #${newCount}`);
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
