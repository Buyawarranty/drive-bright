import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type LeadStatus = 'new' | 'contacted' | 'follow_up' | 'quote_sent' | 'negotiating' | 'converted' | 'lost';
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
  const [filter, setFilter] = useState<LeadStatus | 'all' | 'high_priority'>('all');

  const fetchLeads = useCallback(async () => {
    try {
      setLoading(true);
      
      // Fetch sales_leads
      let query = supabase
        .from('sales_leads')
        .select(`
          *,
          assigned_user:admin_users!sales_leads_assigned_to_fkey(id, first_name, last_name, email)
        `)
        .order('created_at', { ascending: false });

      if (filter !== 'all' && filter !== 'high_priority') {
        query = query.eq('status', filter);
      } else if (filter === 'high_priority') {
        query = query.in('priority', ['high', 'urgent']);
      }

      const { data: salesLeadsData, error: salesError } = await query;
      if (salesError) throw salesError;

      // Fetch abandoned carts that are NOT already linked to a sales lead
      const { data: abandonedCartsData, error: cartsError } = await supabase
        .from('abandoned_carts')
        .select('*')
        .eq('is_converted', false)
        .order('created_at', { ascending: false });

      if (cartsError) throw cartsError;

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
        .map((cart: any) => ({
          id: `cart_${cart.id}`,
          first_name: cart.full_name?.split(' ')[0] || null,
          last_name: cart.full_name?.split(' ').slice(1).join(' ') || null,
          full_name: cart.full_name || null,
          email: cart.email,
          phone: cart.phone,
          lead_source: 'website' as LeadSource,
          status: cart.contact_status === 'contacted' ? 'contacted' as LeadStatus : 'new' as LeadStatus,
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
          assigned_to: cart.contacted_by,
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
          assigned_user: null,
          tags: []
        }));

      // Merge sales leads with abandoned carts
      const salesLeadsWithFlags = (salesLeadsData || []).map((lead: any) => ({
        ...lead,
        full_name: lead.first_name || lead.last_name 
          ? `${lead.first_name || ''} ${lead.last_name || ''}`.trim() 
          : null,
        plan_name: lead.plan_interest,
        payment_type: null,
        step_abandoned: null,
        contact_status: null,
        is_from_abandoned_cart: false
      }));

      // Combine and sort by created_at
      const allLeads = [...salesLeadsWithFlags, ...cartsAsLeads]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

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

      // Fetch tags for sales leads only
      const leadsWithTags = await Promise.all(
        leadsWithCounts.map(async (lead: any) => {
          if (lead.is_from_abandoned_cart) {
            return lead;
          }
          const { data: tagData } = await supabase
            .from('lead_tag_assignments')
            .select('tag_id, lead_tags(id, name, color, description)')
            .eq('lead_id', lead.id);

          return {
            ...lead,
            tags: tagData?.map((t: any) => t.lead_tags).filter(Boolean) || []
          };
        })
      );

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

  const updateLeadStatus = async (leadId: string, status: LeadStatus) => {
    try {
      const updates: any = { 
        status, 
        updated_at: new Date().toISOString(),
        last_activity_date: new Date().toISOString()
      };

      if (status === 'converted') {
        updates.converted_at = new Date().toISOString();
      } else if (status === 'lost') {
        updates.lost_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('sales_leads')
        .update(updates)
        .eq('id', leadId);

      if (error) throw error;

      // Log activity
      await logActivity(leadId, 'status_change', `Status changed to ${status}`);

      toast.success('Lead status updated');
      fetchLeads();
    } catch (error) {
      console.error('Error updating lead status:', error);
      toast.error('Failed to update lead status');
    }
  };

  const assignLead = async (leadId: string, userId: string | null) => {
    try {
      const { error } = await supabase
        .from('sales_leads')
        .update({
          assigned_to: userId,
          assigned_at: userId ? new Date().toISOString() : null,
          updated_at: new Date().toISOString()
        })
        .eq('id', leadId);

      if (error) throw error;

      if (userId) {
        const user = salesUsers.find(u => u.id === userId);
        await logActivity(leadId, 'assignment', `Assigned to ${user?.first_name || user?.email || 'Unknown'}`);
      }

      toast.success('Lead assigned successfully');
      fetchLeads();
    } catch (error) {
      console.error('Error assigning lead:', error);
      toast.error('Failed to assign lead');
    }
  };

  const autoAssignLead = async (leadId: string) => {
    try {
      // Call the round-robin function
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
  };

  const updateLeadPriority = async (leadId: string, priority: LeadPriority) => {
    try {
      const { error } = await supabase
        .from('sales_leads')
        .update({ 
          priority, 
          updated_at: new Date().toISOString() 
        })
        .eq('id', leadId);

      if (error) throw error;

      toast.success('Priority updated');
      fetchLeads();
    } catch (error) {
      console.error('Error updating priority:', error);
      toast.error('Failed to update priority');
    }
  };

  const scheduleFollowUp = async (leadId: string, actionType: string, actionDate: string) => {
    try {
      const { error } = await supabase
        .from('sales_leads')
        .update({
          next_action_type: actionType,
          next_action_date: actionDate,
          follow_up_status: 'pending',
          updated_at: new Date().toISOString()
        })
        .eq('id', leadId);

      if (error) throw error;

      await logActivity(leadId, 'follow_up', `Scheduled ${actionType} for ${new Date(actionDate).toLocaleDateString()}`);

      toast.success('Follow-up scheduled');
      fetchLeads();
    } catch (error) {
      console.error('Error scheduling follow-up:', error);
      toast.error('Failed to schedule follow-up');
    }
  };

  const addTagToLead = async (leadId: string, tagId: string) => {
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
          toast.info('Tag already assigned');
          return;
        }
        throw error;
      }

      toast.success('Tag added');
      fetchLeads();
    } catch (error) {
      console.error('Error adding tag:', error);
      toast.error('Failed to add tag');
    }
  };

  const removeTagFromLead = async (leadId: string, tagId: string) => {
    try {
      const { error } = await supabase
        .from('lead_tag_assignments')
        .delete()
        .eq('lead_id', leadId)
        .eq('tag_id', tagId);

      if (error) throw error;

      toast.success('Tag removed');
      fetchLeads();
    } catch (error) {
      console.error('Error removing tag:', error);
      toast.error('Failed to remove tag');
    }
  };

  const logActivity = async (leadId: string, activityType: string, description: string, outcome?: string) => {
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

      // Update last activity date
      await supabase
        .from('sales_leads')
        .update({ last_activity_date: new Date().toISOString() })
        .eq('id', leadId);
    } catch (error) {
      console.error('Error logging activity:', error);
    }
  };

  const updateLeadNotes = async (leadId: string, notes: string) => {
    try {
      const { error } = await supabase
        .from('sales_leads')
        .update({ 
          notes, 
          updated_at: new Date().toISOString() 
        })
        .eq('id', leadId);

      if (error) throw error;

      toast.success('Notes saved');
      fetchLeads();
    } catch (error) {
      console.error('Error updating notes:', error);
      toast.error('Failed to save notes');
    }
  };

  const markContactedAt = async (leadId: string) => {
    try {
      const { error } = await supabase
        .from('sales_leads')
        .update({
          last_contacted_at: new Date().toISOString(),
          last_activity_date: new Date().toISOString(),
          status: 'contacted',
          updated_at: new Date().toISOString()
        })
        .eq('id', leadId);

      if (error) throw error;

      await logActivity(leadId, 'contact', 'Marked as contacted');
      toast.success('Lead marked as contacted');
      fetchLeads();
    } catch (error) {
      console.error('Error marking contacted:', error);
      toast.error('Failed to update contact status');
    }
  };

  const migrateFromAbandonedCarts = async () => {
    try {
      // Fetch abandoned carts that haven't been migrated
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
        // Check if already migrated
        const { data: existing } = await supabase
          .from('sales_leads')
          .select('id')
          .eq('abandoned_cart_id', cart.id)
          .single();

        if (existing) continue;

        // Get next user for round-robin
        const { data: nextUserId } = await supabase.rpc('get_next_sales_user');

        // Create lead from cart
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
  };

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
    migrateFromAbandonedCarts
  };
};
