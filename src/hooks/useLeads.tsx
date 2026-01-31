import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type LeadStatus = 'new' | 'contacted' | 'follow_up' | 'quote_sent' | 'negotiating' | 'converted' | 'lost' | 'fake_lead';
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
}

export const useLeads = () => {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [tags, setTags] = useState<LeadTag[]>([]);
  const [salesUsers, setSalesUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<LeadStatus | 'all' | 'high_priority' | 'fake'>('all');
  
  // Cache sales users for optimistic updates
  const salesUsersRef = useRef<AdminUser[]>([]);
  salesUsersRef.current = salesUsers;

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
      setLoading(true);
      
      // Use Promise.all to fetch all data sources in parallel for better performance
      const [salesLeadsResult, abandonedCartsResult] = await Promise.all([
        // Fetch sales_leads with optimized column selection
        (async () => {
          let query = supabase
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
            .limit(500); // Limit initial fetch for performance

          if (filter === 'all') {
            // Exclude lost and fake leads from the main "All" view
            query = query.not('status', 'in', '("lost","fake_lead")');
          } else if (filter === 'high_priority') {
            query = query.in('priority', ['high', 'urgent']);
          } else if (filter === 'fake') {
            query = query.eq('status', 'fake_lead' as any);
          } else {
            // Cast to any to allow custom status values not yet in database types
            query = query.eq('status', filter as any);
          }

          return query;
        })(),
        // Fetch abandoned carts with optimized column selection and limit
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
          .limit(500) // Limit for performance
      ]);

      const { data: salesLeadsData, error: salesError } = salesLeadsResult;
      if (salesError) throw salesError;

      const { data: abandonedCartsData, error: cartsError } = abandonedCartsResult;
      if (cartsError) throw cartsError;

      // Build a map of auth.user_id -> admin_user for abandoned cart assignments
      // contacted_by stores auth.users.id, we need to map to admin_users
      const contactedByIds = (abandonedCartsData || [])
        .filter((cart: any) => cart.contacted_by)
        .map((cart: any) => cart.contacted_by);
      
      let adminUsersByAuthId: Record<string, any> = {};
      if (contactedByIds.length > 0) {
        const { data: adminUsersForCarts } = await supabase
          .from('admin_users')
          .select('id, user_id, first_name, last_name, email')
          .in('user_id', contactedByIds);
        
        // Create map: auth.user_id -> admin_user
        (adminUsersForCarts || []).forEach((user: any) => {
          if (user.user_id) {
            adminUsersByAuthId[user.user_id] = user;
          }
        });
      }

      // Get IDs of abandoned carts already linked to sales_leads
      const linkedCartIds = new Set(
        (salesLeadsData || [])
          .filter((lead: any) => lead.abandoned_cart_id)
          .map((lead: any) => lead.abandoned_cart_id)
      );

      // Get emails already in sales_leads to avoid duplicates
      const existingEmails = new Set(
        (salesLeadsData || []).map((lead: any) => lead.email?.toLowerCase())
      );

      // Convert abandoned carts to lead format (only those not already linked)
      const cartsAsLeads = (abandonedCartsData || [])
        .filter((cart: any) => 
          !linkedCartIds.has(cart.id) && 
          !existingEmails.has(cart.email?.toLowerCase())
        )
        .map((cart: any) => {
          const fullName = cart.full_name || '';
          const isFakeLead = isTestLead(fullName, cart.phone) || cart.contact_status === 'fake_lead';
          
          // Get the admin user from the contacted_by auth.user_id
          const assignedAdminUser = cart.contacted_by ? adminUsersByAuthId[cart.contacted_by] : null;
          
          return {
            id: `cart_${cart.id}`,
            first_name: fullName.split(' ')[0] || null,
            last_name: fullName.split(' ').slice(1).join(' ') || null,
            full_name: fullName || null,
            email: cart.email,
            phone: cart.phone,
            lead_source: 'website' as LeadSource,
            status: isFakeLead ? 'fake_lead' as LeadStatus : 
                    cart.contact_status === 'contacted' ? 'contacted' as LeadStatus : 'new' as LeadStatus,
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
            // Use admin_users.id for assigned_to (consistent with sales_leads)
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
            // Set the assigned_user from our lookup
            assigned_user: assignedAdminUser ? {
              id: assignedAdminUser.id,
              first_name: assignedAdminUser.first_name,
              last_name: assignedAdminUser.last_name,
              email: assignedAdminUser.email
            } : null,
            tags: []
          };
        });

      // Merge sales leads with abandoned carts
      const salesLeadsWithFlags = (salesLeadsData || []).map((lead: any) => {
        const fullName = lead.first_name || lead.last_name 
          ? `${lead.first_name || ''} ${lead.last_name || ''}`.trim() 
          : null;
        const isFakeLead = isTestLead(fullName, lead.phone);
        
        return {
          ...lead,
          full_name: fullName,
          // Auto-detect fake leads but don't override if already set to a different status
          status: isFakeLead && lead.status === 'new' ? 'fake_lead' : lead.status,
          plan_name: lead.plan_interest,
          payment_type: null,
          step_abandoned: null,
          contact_status: null,
          is_from_abandoned_cart: false,
          call_count: lead.call_count || 0,
          cart_metadata: null
        };
      });

      // Combine and sort by created_at (newest first)
      let allLeads = [...salesLeadsWithFlags, ...cartsAsLeads]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      
      // For "all" filter, exclude lost and fake leads (they have their own tabs)
      if (filter === 'all') {
        allLeads = allLeads.filter((lead: any) => 
          lead.status !== 'lost' && lead.status !== 'fake_lead'
        );
      } else if (filter === 'fake') {
        // Only show fake leads
        allLeads = allLeads.filter((lead: any) => lead.status === 'fake_lead');
      } else if (filter === 'lost') {
        // Only show lost leads
        allLeads = allLeads.filter((lead: any) => lead.status === 'lost');
      }

      // Calculate application count per email (how many times this email has applied)
      const emailCounts: Record<string, number> = {};
      allLeads.forEach((lead: any) => {
        const email = lead.email?.toLowerCase();
        if (email) {
          emailCounts[email] = (emailCounts[email] || 0) + 1;
        }
      });

      // Add application count to each lead
      const leadsWithCounts = allLeads.map((lead: any) => ({
        ...lead,
        application_count: emailCounts[lead.email?.toLowerCase()] || 1
      }));

      // Fetch all tag assignments in a single query (instead of N+1 queries)
      const salesLeadIds = leadsWithCounts
        .filter((lead: any) => !lead.is_from_abandoned_cart)
        .map((lead: any) => lead.id);

      let tagsByLeadId: Record<string, any[]> = {};
      
      if (salesLeadIds.length > 0) {
        const { data: allTagData } = await supabase
          .from('lead_tag_assignments')
          .select('lead_id, tag_id, lead_tags(id, name, color, description)')
          .in('lead_id', salesLeadIds);

        // Group tags by lead_id
        (allTagData || []).forEach((assignment: any) => {
          if (!tagsByLeadId[assignment.lead_id]) {
            tagsByLeadId[assignment.lead_id] = [];
          }
          if (assignment.lead_tags) {
            tagsByLeadId[assignment.lead_id].push(assignment.lead_tags);
          }
        });
      }

      // Assign tags to leads without additional queries
      const leadsWithTags = leadsWithCounts.map((lead: any) => ({
        ...lead,
        tags: lead.is_from_abandoned_cart ? [] : (tagsByLeadId[lead.id] || [])
      }));

      setLeads(leadsWithTags as Lead[]);
    } catch (error) {
      console.error('Error fetching leads:', error);
      toast.error('Failed to load leads');
    } finally {
      setLoading(false);
    }
  }, [filter]);

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
      .select('id, user_id, first_name, last_name, email, is_active')
      .eq('is_active', true)
      .order('first_name');

    if (error) {
      console.error('Error fetching sales users:', error);
      return;
    }

    setSalesUsers(data || []);
  }, []);

  useEffect(() => {
    fetchLeads();
    fetchTags();
    fetchSalesUsers();
  }, [fetchLeads, fetchTags, fetchSalesUsers]);

  // OPTIMISTIC UPDATE: Update status instantly, then sync to DB
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

    // Optimistic update - instant UI response
    setLeads(prev => prev.map(lead => 
      lead.id === leadId ? { ...lead, ...updates } : lead
    ));

    try {
      if (isAbandonedCart) {
        // Map status to contact_status for abandoned_carts table
        const contactStatus = status === 'fake_lead' ? 'fake_lead' : 
                              status === 'contacted' ? 'contacted' :
                              status === 'converted' ? 'converted' :
                              status === 'lost' ? 'lost' : 'pending';
        
        const { error } = await supabase
          .from('abandoned_carts')
          .update({
            contact_status: contactStatus,
            updated_at: now
          })
          .eq('id', actualId);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('sales_leads')
          .update(updates)
          .eq('id', actualId);

        if (error) throw error;

        // Log activity in background (don't await)
        logActivity(leadId, 'status_change', `Status changed to ${status}`);
      }
      
      toast.success(`Lead status updated to ${status.replace('_', ' ')}`);
    } catch (error) {
      console.error('Error updating lead status:', error);
      toast.error('Failed to update lead status');
      // Revert on error
      fetchLeads();
    }
  }, []);

  // OPTIMISTIC UPDATE: Assign lead instantly
  const assignLead = useCallback(async (leadId: string, userId: string | null) => {
    const now = new Date().toISOString();
    const user = salesUsersRef.current.find(u => u.id === userId);
    const isAbandonedCart = leadId.startsWith('cart_');
    const actualId = isAbandonedCart ? leadId.replace('cart_', '') : leadId;
    
    // Optimistic update
    setLeads(prev => prev.map(lead => 
      lead.id === leadId 
        ? { 
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
          } 
        : lead
    ));

    try {
      if (isAbandonedCart) {
        // Update abandoned_carts table - uses contacted_by field for assignment
        // IMPORTANT: contacted_by references auth.users(id), so we need to get the user_id
        // from admin_users, not the admin_users.id directly
        let authUserId: string | null = null;
        if (userId) {
          const { data: adminUser } = await supabase
            .from('admin_users')
            .select('user_id')
            .eq('id', userId)
            .maybeSingle();
          authUserId = adminUser?.user_id || null;
        }
        
        const { error } = await supabase
          .from('abandoned_carts')
          .update({
            contacted_by: authUserId,
            last_contacted_at: authUserId ? now : null,
            updated_at: now
          })
          .eq('id', actualId);

        if (error) throw error;
      } else {
        // Get current user's admin ID to check if this is a self-assignment
        const { data: { user: authUser } } = await supabase.auth.getUser();
        
        if (authUser && userId) {
          // Check if this is self-assignment by comparing to current user's admin_users.id
          const { data: currentAdminUser } = await supabase
            .from('admin_users')
            .select('id')
            .eq('user_id', authUser.id)
            .maybeSingle();
          
          const isSelfAssignment = currentAdminUser?.id === userId;
          
          // Get the current lead to check if it's unassigned
          const { data: currentLead } = await supabase
            .from('sales_leads')
            .select('assigned_to')
            .eq('id', actualId)
            .maybeSingle();
          
          const isUnassignedLead = currentLead?.assigned_to === null;
          
          // Use RPC for self-assignment of unassigned leads (bypasses RLS issues)
          if (isSelfAssignment && isUnassignedLead) {
            // Force presence update before claiming
            await supabase.rpc('log_agent_interaction', { p_event_type: 'claim_attempt' });
            
            const { data: result, error: claimError } = await supabase
              .rpc('claim_lead_for_agent', {
                p_lead_id: actualId,
                p_agent_id: userId
              });
            
            if (claimError) throw claimError;
            
            const claimResult = result as { success: boolean; error?: string; message?: string };
            
            if (!claimResult.success) {
              throw new Error(claimResult.error || 'Failed to claim lead');
            }
          } else {
            // Regular update for admins or reassignments
            const { error } = await supabase
              .from('sales_leads')
              .update({
                assigned_to: userId,
                assigned_at: now,
                updated_at: now
              })
              .eq('id', actualId);

            if (error) throw error;
          }
        } else if (userId === null) {
          // Removing assignment
          const { error } = await supabase
            .from('sales_leads')
            .update({
              assigned_to: null,
              assigned_at: null,
              updated_at: now
            })
            .eq('id', actualId);

          if (error) throw error;
        }

        if (userId && user) {
          logActivity(leadId, 'assignment', `Assigned to ${user.first_name || user.email || 'Unknown'}`);
        }
      }

      toast.success(userId ? `Assigned to ${user?.first_name || user?.email || 'user'}` : 'Assignment removed');
    } catch (error) {
      console.error('Error assigning lead:', error);
      toast.error('Failed to assign lead');
      fetchLeads();
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
      const { data: userData } = await supabase.auth.getUser();
      const { data: adminUser } = await supabase
        .from('admin_users')
        .select('id')
        .eq('user_id', userData.user?.id)
        .single();

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
  }, [tags]);

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
      const { data: userData } = await supabase.auth.getUser();
      const { data: adminUser } = await supabase
        .from('admin_users')
        .select('id')
        .eq('user_id', userData.user?.id)
        .single();

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
  }, []);

  // OPTIMISTIC UPDATE: Update notes instantly
  const updateLeadNotes = useCallback(async (leadId: string, notes: string) => {
    const now = new Date().toISOString();
    const isAbandonedCart = leadId.startsWith('cart_');
    const actualId = isAbandonedCart ? leadId.replace('cart_', '') : leadId;
    
    // Optimistic update
    setLeads(prev => prev.map(lead => 
      lead.id === leadId ? { ...lead, notes, updated_at: now } : lead
    ));

    try {
      if (isAbandonedCart) {
        // Update abandoned_carts table - use contact_notes field
        const { error } = await supabase
          .from('abandoned_carts')
          .update({ 
            contact_notes: notes, 
            updated_at: now 
          })
          .eq('id', actualId);

        if (error) throw error;
      } else {
        // Update sales_leads table
        const { error } = await supabase
          .from('sales_leads')
          .update({ notes, updated_at: now })
          .eq('id', leadId);

        if (error) throw error;
      }
      toast.success('Notes saved');
    } catch (error) {
      console.error('Error updating notes:', error);
      toast.error('Failed to save notes');
      fetchLeads();
    }
  }, []);

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
  const updateCallCount = useCallback(async (leadId: string, increment: number = 1) => {
    const now = new Date().toISOString();
    const isAbandonedCart = leadId.startsWith('cart_');
    const actualId = isAbandonedCart ? leadId.replace('cart_', '') : leadId;
    
    // Get current call count
    const currentLead = leads.find(l => l.id === leadId);
    const newCount = Math.max(0, (currentLead?.call_count || 0) + increment);
    
    // Optimistic update
    setLeads(prev => prev.map(lead => 
      lead.id === leadId 
        ? { ...lead, call_count: newCount, updated_at: now } 
        : lead
    ));

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
        }
      }
    } catch (error) {
      console.error('Error updating call count:', error);
      toast.error('Failed to update call count');
      fetchLeads();
    }
  }, [leads, logActivity, fetchLeads]);

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
          .single();

        if (existing) continue;

        const { data: nextUserId } = await supabase.rpc('get_next_sales_user');

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
            abandoned_cart_id: cart.id,
            assigned_to: nextUserId,
            assigned_at: nextUserId ? new Date().toISOString() : null
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

    // Store previous state for potential rollback
    const previousLeads = leads;
    
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
  }, [leads]);

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
