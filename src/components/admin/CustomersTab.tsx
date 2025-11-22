import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Edit, Download, Search, RefreshCw, AlertCircle, CalendarIcon, Save, Key, Send, Clock, CheckCircle, Trash2, UserX, Phone, Mail, RotateCcw, Archive, ChevronDown, ChevronUp, Eye, Copy, FileText, User } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

import { CustomerNotesSection } from './CustomerNotesSection';
import { WarrantyActions } from './WarrantyActions';
import { ManualOrderEntry } from './ManualOrderEntry';
import { EditOrderButton } from './EditOrderButton';
import { MOTHistorySection } from './MOTHistorySection';
import { W2000DataPreview } from './W2000DataPreview';
import { SendNotificationDialog } from './SendNotificationDialog';
import { ViewAsCustomerButton } from './ViewAsCustomerButton';
import { CustomerTagsManager } from './CustomerTagsManager';
import { CustomerTagsDisplay } from './CustomerTagsDisplay';
import { InlineCustomerTags } from './InlineCustomerTags';
import { BulkEmailDialog } from './BulkEmailDialog';
import { BulkTagDialog } from './BulkTagDialog';
import CoverageDetailsDisplay from '@/components/CoverageDetailsDisplay';
import AddOnProtectionDisplay from '@/components/AddOnProtectionDisplay';
import { W2KAuditLog } from './W2KAuditLog';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { getWarrantyDurationInMonths } from '@/lib/warrantyDurationUtils';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

// Helper function to map plan types to Warranties 2000 warranty types
function getWarrantyType(planType: string): string {
  // WarType must be one of: B-BASIC, B-GOLD, B-PLATINUM, B-EV, B-PHEV or B-MOTORCYCLE
  const lowerPlanType = planType?.toLowerCase() || '';
  
  // Handle full plan type names first
  if (lowerPlanType.includes('electric vehicle') || lowerPlanType.includes('ev extended warranty')) {
    return 'B-EV';
  }
  if (lowerPlanType.includes('phev') || lowerPlanType.includes('hybrid extended warranty')) {
    return 'B-PHEV';
  }
  if (lowerPlanType.includes('motorbike') || lowerPlanType.includes('motorcycle')) {
    return 'B-MOTORCYCLE';
  }
  if (lowerPlanType.includes('platinum')) {
    return 'B-PLATINUM';
  }
  if (lowerPlanType.includes('gold')) {
    return 'B-GOLD';
  }
  if (lowerPlanType.includes('basic')) {
    return 'B-BASIC';
  }
  
  // Fallback for simple cases
  switch (lowerPlanType) {
    case 'basic': return 'B-BASIC';
    case 'gold': return 'B-GOLD';
    case 'platinum': return 'B-PLATINUM';
    case 'phev': return 'B-PHEV';
    case 'ev': return 'B-EV';
    case 'motorbike': 
    case 'motorcycle': return 'B-MOTORCYCLE';
    default: return 'B-BASIC';
  }
}

// Helper function to calculate expiry date based on start date and payment type
function calculateExpiryDate(startDate: string, paymentType: string): Date {
  const start = new Date(startDate);
  const months = getWarrantyDurationInMonths(paymentType);
  const expiry = new Date(start);
  expiry.setMonth(expiry.getMonth() + months);
  return expiry;
}

interface Customer {
  id: string;
  name: string;
  email: string;
  phone?: string;
  first_name?: string;
  last_name?: string;
  flat_number?: string;
  building_name?: string;
  building_number?: string;
  street?: string;
  town?: string;
  county?: string;
  postcode?: string;
  country?: string;
  address?: string;
  plan_type: string;
  signup_date: string;
  created_at?: string;
  voluntary_excess: number;
  status: string;
  registration_plate: string;
  vehicle_make?: string;
  vehicle_model?: string;
  vehicle_year?: string;
  vehicle_fuel_type?: string;
  vehicle_transmission?: string;
  mileage?: string;
  payment_type?: string;
  stripe_session_id?: string;
  bumper_order_id?: string;
  discount_code?: string;
  discount_amount: number;
  original_amount: number;
  final_amount: number;
  warranty_reference_number: string;
  warranty_number: string;
  stripe_customer_id: string;
  warranty_expiry?: string;
  policy_number?: string;
  policy_status?: string;
  welcome_email_status?: 'sent' | 'not_sent';
  activation_email_status?: 'sent' | 'not_sent';
  assigned_to?: string;
  assigned_admin_name?: string;
  is_deleted?: boolean;
  deleted_at?: string;
  deleted_by?: string;
  last_login?: string;
  temporary_password?: string;
  // Add-on coverage fields
  tyre_cover?: boolean;
  wear_tear?: boolean;
  europe_cover?: boolean;
  transfer_cover?: boolean;
  breakdown_recovery?: boolean;
  vehicle_rental?: boolean;
  mot_fee?: boolean;
  claim_limit?: number;
  mot_repair?: boolean;
  lost_key?: boolean;
  consequential?: boolean;
  admin_users?: {
    id: string;
    email: string;
    first_name?: string;
    last_name?: string;
  } | null;
  customer_policies?: Array<{
    id?: string;
    policy_end_date: string;
    policy_start_date?: string;
    policy_number: string;
    status: string;
    warranty_number?: string;
    email_sent_status?: string;
    warranties_2000_status?: string;
    warranties_2000_sent_at?: string;
    created_at?: string;
  }>;
}

interface IncompleteCustomer {
  id: string;
  email: string;
  full_name?: string;
  phone?: string;
  vehicle_reg?: string;
  vehicle_make?: string;
  vehicle_model?: string;
  vehicle_year?: string;
  mileage?: string;
  plan_name?: string;
  payment_type?: string;
  vehicle_type?: string;
  step_abandoned: number;
  created_at: string;
  updated_at: string;
  contact_status: string;
  contact_notes?: string;
  last_contacted_at?: string;
  contacted_by?: string;
  cart_metadata?: any;
}

interface EmailStatus {
  policy_documents: boolean;
  portal_signup: boolean;
}

interface AdminNote {
  id: string;
  note: string;
  created_at: string;
  created_by: string;
  admin_name?: string;
  admin_users?: {
    email: string;
    first_name?: string;
    last_name?: string;
  } | null;
}

interface Plan {
  name: string;
}

interface AdminUser {
  id: string;
  user_id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  role: string;
}

// Number plate component
const NumberPlate = ({ plateNumber }: { plateNumber: string }) => {
  if (!plateNumber) return <span className="text-gray-400">N/A</span>;
  
  return (
    <div className="inline-flex items-center bg-white border-2 border-black rounded-sm overflow-hidden font-mono text-lg font-bold shadow-md">
      <div className="bg-blue-600 text-white px-2 py-1 text-xs font-normal">
        GB
      </div>
      <div className="bg-yellow-400 text-black px-3 py-1 tracking-wider">
        {plateNumber.toUpperCase()}
      </div>
    </div>
  );
};

export const CustomersTab = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [filteredCustomers, setFilteredCustomers] = useState<Customer[]>([]);
  const [deletedCustomers, setDeletedCustomers] = useState<Customer[]>([]);
  const [filteredDeletedCustomers, setFilteredDeletedCustomers] = useState<Customer[]>([]);
  const [incompleteCustomers, setIncompleteCustomers] = useState<IncompleteCustomer[]>([]);
  const [filteredIncompleteCustomers, setFilteredIncompleteCustomers] = useState<IncompleteCustomer[]>([]);
  const [selectedIncompleteCustomers, setSelectedIncompleteCustomers] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletedLoading, setDeletedLoading] = useState(true);
  const [incompleteLoading, setIncompleteLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [deletedSearchTerm, setDeletedSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('newest'); // Default to newest first
  const [filterByPlan, setFilterByPlan] = useState('all');
  const [filterByStatus, setFilterByStatus] = useState('all');
  const [filterByTag, setFilterByTag] = useState('all');
  const [availableTags, setAvailableTags] = useState<any[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [notes, setNotes] = useState<AdminNote[]>([]);
  const [newNote, setNewNote] = useState('');
  const [noteDate, setNoteDate] = useState<Date>(new Date());
  const [notesLoading, setNotesLoading] = useState(false);
  const [debugInfo, setDebugInfo] = useState<string>('');
  const [plans, setPlans] = useState<Plan[]>([]);
  const [passwordResetLoading, setPasswordResetLoading] = useState<{ [key: string]: boolean }>({});
  const [emailStatuses, setEmailStatuses] = useState<{ [key: string]: EmailStatus }>({});
  const [emailSendingLoading, setEmailSendingLoading] = useState<{ [key: string]: { [key: string]: boolean } }>({});
  const [dvlaLookupLoading, setDvlaLookupLoading] = useState<{ [key: string]: boolean }>({});
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [currentUser, setCurrentUser] = useState<{ id: string; email: string; } | null>(null);
  const [currentAdminUser, setCurrentAdminUser] = useState<AdminUser | null>(null);
  const [assignmentLoading, setAssignmentLoading] = useState<{ [key: string]: boolean }>({});
  const [selectedCustomers, setSelectedCustomers] = useState<Set<string>>(new Set());
  const [bulkDeleteLoading, setBulkDeleteLoading] = useState(false);
  const [restoreLoading, setRestoreLoading] = useState<{ [key: string]: boolean }>({});
  const [customerCredentials, setCustomerCredentials] = useState<{ email: string; password: string } | null>(null);
  const [credentialsLoading, setCredentialsLoading] = useState(false);
  const [sendingCredentials, setSendingCredentials] = useState(false);
  const [credentialsExpanded, setCredentialsExpanded] = useState(false);

  useEffect(() => {
    fetchCustomers();
    fetchDeletedCustomers();
    fetchIncompleteCustomers();
    fetchPlans();
    fetchEmailStatuses();
    fetchAdminUsers();
    getCurrentUser();
    fetchAvailableTags();
  }, []);

  useEffect(() => {
    applyFiltersAndSort();
  }, [searchTerm, customers, sortBy, filterByPlan, filterByStatus, filterByTag]);

  const fetchAvailableTags = async () => {
    try {
      const { data, error } = await supabase
        .from('customer_tags')
        .select('*')
        .order('category', { ascending: true })
        .order('name', { ascending: true });

      if (error) throw error;
      setAvailableTags(data || []);
    } catch (error) {
      console.error('Error fetching tags:', error);
    }
  };

  const applyFiltersAndSort = async () => {
    let filtered = [...customers];

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(customer =>
        customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        customer.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        customer.registration_plate?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        customer.warranty_reference_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        // Also search in policy numbers from related policies
        customer.customer_policies?.some(policy => 
          policy.policy_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          policy.warranty_number?.toLowerCase().includes(searchTerm.toLowerCase())
        )
      );
    }

    // Apply plan filter
    if (filterByPlan !== 'all') {
      filtered = filtered.filter(customer =>
        customer.plan_type?.toLowerCase() === filterByPlan.toLowerCase()
      );
    }

    // Apply status filter
    if (filterByStatus !== 'all') {
      filtered = filtered.filter(customer =>
        customer.status?.toLowerCase() === filterByStatus.toLowerCase()
      );
    }

    // Apply tag filter
    if (filterByTag !== 'all') {
      try {
        const { data: taggedCustomers, error } = await supabase
          .from('customer_tag_assignments')
          .select('customer_id')
          .eq('tag_id', filterByTag);

        if (!error && taggedCustomers) {
          const taggedCustomerIds = new Set(taggedCustomers.map(t => t.customer_id));
          filtered = filtered.filter(customer => taggedCustomerIds.has(customer.id));
        }
      } catch (error) {
        console.error('Error filtering by tag:', error);
      }
    }

    // Apply sorting
    filtered.sort((a, b) => {
      const dateA = new Date(a.signup_date).getTime();
      const dateB = new Date(b.signup_date).getTime();
      
      switch (sortBy) {
        case 'newest':
          return dateB - dateA; // Newest first (default)
        case 'oldest':
          return dateA - dateB; // Oldest first
        case 'name':
          return a.name.localeCompare(b.name);
        case 'email':
          return a.email.localeCompare(b.email);
        case 'plan':
          return (a.plan_type || '').localeCompare(b.plan_type || '');
        default:
          return dateB - dateA; // Default to newest first
      }
    });

    setFilteredCustomers(filtered);
  };

  const getCurrentUser = async () => {
    try {
      console.log('getCurrentUser: Starting...');
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error) throw error;
      if (user) {
        console.log('getCurrentUser: Found user:', user.email);
        setCurrentUser({ id: user.id, email: user.email || '' });
        
        // Find the corresponding admin user
        const { data: adminUserData, error: adminError } = await supabase
          .from('admin_users')
          .select('id, user_id, email, first_name, last_name, role')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .single();
          
        console.log('getCurrentUser: Admin user query result:', { adminUserData, adminError });
          
        if (!adminError && adminUserData) {
          console.log('getCurrentUser: Setting current admin user:', adminUserData);
          setCurrentAdminUser(adminUserData);
        } else if (adminError) {
          console.error('getCurrentUser: Admin user error:', adminError);
        }
      } else {
        console.log('getCurrentUser: No user found');
      }
    } catch (error) {
      console.error('Error getting current user:', error);
    }
  };

  const fetchAdminUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('admin_users')
        .select('id, user_id, email, first_name, last_name, role')
        .eq('is_active', true);
      
      if (error) throw error;
      setAdminUsers(data || []);
      
      // Update current admin user if currentUser exists
      if (currentUser) {
        const currentAdmin = data?.find(admin => admin.user_id === currentUser.id);
        if (currentAdmin) {
          setCurrentAdminUser(currentAdmin);
        }
      }
    } catch (error) {
      console.error('Error fetching admin users:', error);
    }
  };

  const fetchPlans = async () => {
    try {
      const { data, error } = await supabase
        .from('plans')
        .select('name')
        .eq('is_active', true);
      
      if (error) throw error;
      setPlans(data || []);
    } catch (error) {
      console.error('Error fetching plans:', error);
    }
  };

  const fetchCustomers = async () => {
    try {
      console.log('🔍 Starting customer fetch process...');
      setLoading(true);
      setDebugInfo('Starting fetch...');

      // Check current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      console.log('👤 Current user:', user);
      console.log('❌ User error:', userError);
      
      const isMasterAdmin = localStorage.getItem('masterAdmin') === 'true';
      console.log('🔐 Is master admin:', isMasterAdmin);
      
      setDebugInfo(`User: ${user?.email || 'Master Admin'}, Master Admin: ${isMasterAdmin}`);

      // Query both customers and orphaned policies (policies without customer records)
      console.log('📊 Attempting query with policy data and real customers only...');
      
      // First get customers with their policies and assigned admin details (exclude soft-deleted)
      const { data: customersData, error: customersError } = await supabase
        .from('customers')
        .select(`
          *,
          customer_policies!customer_id(
            id,
            policy_number,
            policy_end_date,
            policy_start_date,
            status,
            warranty_number,
            email_sent_status,
            warranties_2000_status,
            warranties_2000_sent_at,
            mot_fee,
            tyre_cover,
            wear_tear,
            europe_cover,
            transfer_cover,
            breakdown_recovery,
            vehicle_rental,
            claim_limit,
            mot_repair,
            lost_key,
            consequential
          ),
          admin_users!assigned_to(
            id,
            first_name,
            last_name,
            email
          )
        `)
        .not('email', 'ilike', '%@test.com%')
        .not('email', 'ilike', '%testuser%')
        .not('email', 'ilike', '%guest@%')
        .not('name', 'eq', 'Test Customer')
        .not('name', 'eq', 'Guest Customer')
        .eq('is_deleted', false)
        .order('updated_at', { ascending: false });

      // Then get orphaned policies (policies without customer records)
      const { data: orphanedPolicies, error: orphanedError } = await supabase
        .from('customer_policies')
        .select('*')
        .is('customer_id', null)
        .order('created_at', { ascending: false });

      let directData = customersData || [];
      let directError = customersError;
      
      // Add orphaned policies as customer records
      if (orphanedPolicies && orphanedPolicies.length > 0) {
        const orphanedAsCustomers = orphanedPolicies.map(policy => ({
          id: policy.id,
          name: 'Unknown Customer',
          email: policy.email,
          phone: null,
          first_name: null,
          last_name: null,
          flat_number: null,
          building_name: null,
          building_number: null,
          street: null,
          town: null,
          county: null,
          postcode: null,
          country: 'United Kingdom',
          plan_type: policy.plan_type,
          signup_date: policy.created_at,
          voluntary_excess: 0, // Orphaned policies don't have voluntary excess data
          status: 'Incomplete Record',
          registration_plate: 'Unknown',
          vehicle_make: null,
          vehicle_model: null,
          vehicle_year: null,
          vehicle_fuel_type: null,
          vehicle_transmission: null,
          mileage: null,
          payment_type: policy.payment_type,
          stripe_session_id: null,
          bumper_order_id: policy.policy_number?.startsWith('BAW-') ? policy.policy_number : null,
          discount_code: null,
          discount_amount: 0,
          original_amount: null,
          final_amount: null,
          assigned_to: null,
          warranty_reference_number: null,
          customer_policies: [policy],
          created_at: policy.created_at,
          updated_at: policy.updated_at,
          stripe_customer_id: null,
          warranty_number: null,
          admin_users: null,
          is_deleted: false,
          deleted_at: undefined,
          deleted_by: undefined,
          last_login: null,
          // Add missing add-on columns
          tyre_cover: false,
          wear_tear: false,
          europe_cover: false,
          transfer_cover: false,
          breakdown_recovery: false,
          vehicle_rental: false,
          mot_fee: false,
          mot_repair: false,
          lost_key: false,
          consequential: false,
          claim_limit: policy.claim_limit || 1250,
          brevo_contact_id: null,
          review_email_sent_at: null,
          seasonal_bonus_months: 0
        }));
        
        directData = [...directData, ...orphanedAsCustomers];
      }
      
      const directCount = directData.length;

      console.log('📊 Query result:', { data: directData, error: directError, count: directCount });

      if (directError) {
        console.error('❌ Query error, trying fallback without policies:', directError);
        setDebugInfo(prev => prev + `\nQuery with policies error: ${directError.message}, trying fallback...`);
        
        // Fallback: try without joining policies table
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('customers')
          .select('*');
          
        if (fallbackError) {
          console.error('❌ Fallback query error:', fallbackError);
          setDebugInfo(prev => prev + `\nFallback query error: ${fallbackError.message}`);
          
          if (isMasterAdmin) {
            toast.error('RLS policies might be blocking access. Check database policies.');
          } else {
            toast.error(`Database query failed: ${fallbackError.message}`);
          }
          return;
        }
        
        // Process fallback data (without warranty expiry)
        const processedData = fallbackData?.map((customer: any) => ({
          ...customer,
          warranty_expiry: null,
          last_login: customer.last_login || null
        })) || [];
        
        setCustomers(processedData);
        setFilteredCustomers(processedData);
        toast.success(`Loaded ${processedData.length} customers (warranty expiry unavailable)`);
        return;
      }

      console.log('✅ Query successful, processing data...');
      setDebugInfo(prev => prev + `\nQuery successful. Count: ${directCount}`);
      
      if (!directData || directData.length === 0) {
        console.warn('⚠️ No customers found in database');
        setDebugInfo(prev => prev + '\nNo customers found in result');
        toast.info('No customers found in database. Check if data was inserted correctly.');
      } else {
        console.log('✅ Found customers:', directData.length);
        setDebugInfo(prev => prev + `\nFound ${directData.length} customers`);
        toast.success(`Loaded ${directData.length} customers`);
      }
      
      // Process the data to flatten the customer_policies relationship
      const processedData = directData?.map((customer: any) => ({
        ...customer,
        warranty_expiry: customer.customer_policies?.[0]?.policy_end_date || null,
        warranty_reference_number: customer.warranty_reference_number || null,
        policy_number: customer.customer_policies?.[0]?.policy_number || null,
        policy_status: customer.customer_policies?.[0]?.status || null,
        last_login: customer.last_login || null
      })) || [];
      
      setCustomers(processedData);
      setFilteredCustomers(processedData);
      
      // Fetch email statuses after customers are loaded
      fetchEmailStatuses();
    } catch (error) {
      console.error('💥 Unexpected error fetching customers:', error);
      setDebugInfo(prev => prev + `\nUnexpected error: ${error}`);
      toast.error('Unexpected error occurred while fetching customers');
    } finally {
      setLoading(false);
    }
  };

  const fetchIncompleteCustomers = async () => {
    try {
      setIncompleteLoading(true);
      console.log('🔍 Fetching incomplete customers...');
      
      const { data, error } = await supabase
        .from('abandoned_carts')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching incomplete customers:', error);
        throw error;
      }

      console.log('✅ Found incomplete customers:', data?.length || 0);
      setIncompleteCustomers(data || []);
      setFilteredIncompleteCustomers(data || []);
    } catch (error) {
      console.error('Error fetching incomplete customers:', error);
      toast.error('Failed to load incomplete customers');
    } finally {
      setIncompleteLoading(false);
    }
  };

  const handleDeleteIncompleteCustomer = async (customerId: string) => {
    try {
      const { error } = await supabase
        .from('abandoned_carts')
        .delete()
        .eq('id', customerId);

      if (error) {
        console.error('Error deleting incomplete customer:', error);
        throw error;
      }

      toast.success('Incomplete customer deleted successfully');
      await fetchIncompleteCustomers();
    } catch (error) {
      console.error('Error deleting incomplete customer:', error);
      toast.error('Failed to delete incomplete customer');
    }
  };

  const handleBulkDeleteIncompleteCustomers = async () => {
    try {
      const { error } = await supabase
        .from('abandoned_carts')
        .delete()
        .in('id', selectedIncompleteCustomers);

      if (error) {
        console.error('Error deleting incomplete customers:', error);
        throw error;
      }

      toast.success(`Successfully deleted ${selectedIncompleteCustomers.length} incomplete customer${selectedIncompleteCustomers.length > 1 ? 's' : ''}`);
      
      // Clear selection and refresh
      setSelectedIncompleteCustomers([]);
      await fetchIncompleteCustomers();
    } catch (error) {
      console.error('Error deleting incomplete customers:', error);
      toast.error('Failed to delete incomplete customers');
    }
  };

  const fetchDeletedCustomers = async () => {
    try {
      setDeletedLoading(true);
      console.log('🔍 Fetching deleted customers...');
      
      const { data: customersData, error: customersError } = await supabase
        .from('customers')
        .select(`
          *,
          customer_policies!customer_id(
            id,
            policy_number,
            policy_end_date,
            policy_start_date,
            status,
            warranty_number,
            email_sent_status,
            warranties_2000_status,
            warranties_2000_sent_at,
            mot_fee,
            tyre_cover,
            wear_tear,
            europe_cover,
            transfer_cover,
            breakdown_recovery,
            vehicle_rental,
            claim_limit,
            mot_repair,
            lost_key,
            consequential
          ),
          admin_users!deleted_by(
            id,
            first_name,
            last_name,
            email
          )
        `)
        .eq('is_deleted', true)
        .order('deleted_at', { ascending: false });

      if (customersError) {
        console.error('Error fetching deleted customers:', customersError);
        throw customersError;
      }

      const processedData = customersData?.map((customer: any) => ({
        ...customer,
        warranty_expiry: customer.customer_policies?.[0]?.policy_end_date || null,
        warranty_reference_number: customer.warranty_reference_number || null,
        policy_number: customer.customer_policies?.[0]?.policy_number || null,
        policy_status: customer.customer_policies?.[0]?.status || null
      })) || [];

      console.log('✅ Found deleted customers:', processedData.length);
      setDeletedCustomers(processedData);
      setFilteredDeletedCustomers(processedData);
    } catch (error) {
      console.error('Error fetching deleted customers:', error);
      toast.error('Failed to load deleted customers');
    } finally {
      setDeletedLoading(false);
    }
  };

  const restoreCustomer = async (customerId: string, customerName: string) => {
    if (!isAdmin()) {
      toast.error('Only administrators can restore customer records');
      return;
    }

    if (!confirm(`Restore "${customerName}"? This will make the order active again.`)) {
      return;
    }

    setRestoreLoading(prev => ({ ...prev, [customerId]: true }));

    try {
      const { error } = await supabase.rpc('restore_customer', {
        customer_uuid: customerId
      });

      if (error) {
        console.error('Error restoring customer:', error);
        toast.error('Failed to restore customer: ' + error.message);
        return;
      }

      toast.success(`"${customerName}" restored successfully!`);
      fetchCustomers();
      fetchDeletedCustomers();
    } catch (error) {
      console.error('Unexpected error restoring record:', error);
      toast.error('An unexpected error occurred while restoring the record');
    } finally {
      setRestoreLoading(prev => ({ ...prev, [customerId]: false }));
    }
  };

  const updateContactStatus = async (
    customerId: string, 
    status: string, 
    notes?: string
  ) => {
    try {
      const { error } = await supabase
        .from('abandoned_carts')
        .update({
          contact_status: status,
          contact_notes: notes,
          last_contacted_at: new Date().toISOString(),
          contacted_by: (await supabase.auth.getUser()).data.user?.id
        })
        .eq('id', customerId);

      if (error) throw error;

      toast.success('Contact status updated successfully');
      fetchIncompleteCustomers(); // Refresh the list
    } catch (error) {
      console.error('Error updating contact status:', error);
      toast.error('Failed to update contact status');
    }
  };

  const sendBulkReminderEmails = async () => {
    if (selectedIncompleteCustomers.length === 0) {
      toast.error('Please select at least one customer');
      return;
    }

    try {
      const selectedCustomerData = filteredIncompleteCustomers.filter(c => 
        selectedIncompleteCustomers.includes(c.id)
      );

      toast.info(`Sending reminder emails to ${selectedCustomerData.length} customers...`);

      const { data, error } = await supabase.functions.invoke('send-bulk-reminder-emails', {
        body: { customers: selectedCustomerData }
      });

      if (error) throw error;

      toast.success(`Successfully sent ${selectedCustomerData.length} reminder emails`);
      
      // Update contact status for all selected customers
      await Promise.all(
        selectedIncompleteCustomers.map(id => 
          updateContactStatus(id, 'contacted', 'Bulk reminder email sent')
        )
      );

      setSelectedIncompleteCustomers([]);
    } catch (error) {
      console.error('Error sending bulk emails:', error);
      toast.error('Failed to send bulk emails');
    }
  };

  const updateBulkContactStatus = async (status: string) => {
    if (selectedIncompleteCustomers.length === 0) {
      toast.error('Please select at least one customer');
      return;
    }

    try {
      await Promise.all(
        selectedIncompleteCustomers.map(id => 
          updateContactStatus(id, status)
        )
      );

      toast.success(`Updated ${selectedIncompleteCustomers.length} customer statuses`);
      setSelectedIncompleteCustomers([]);
    } catch (error) {
      console.error('Error updating bulk status:', error);
      toast.error('Failed to update statuses');
    }
  };

  const toggleSelectAll = () => {
    if (selectedIncompleteCustomers.length === filteredIncompleteCustomers.length) {
      setSelectedIncompleteCustomers([]);
    } else {
      setSelectedIncompleteCustomers(filteredIncompleteCustomers.map(c => c.id));
    }
  };

  const toggleSelectCustomer = (customerId: string) => {
    setSelectedIncompleteCustomers(prev => 
      prev.includes(customerId)
        ? prev.filter(id => id !== customerId)
        : [...prev, customerId]
    );
  };

  const fetchNotes = async (customerId: string) => {
    setNotesLoading(true);
    try {
      const { data, error } = await supabase
        .from('admin_notes')
        .select('*')
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching notes:', error);
        throw error;
      }
      
      setNotes(data || []);
    } catch (error) {
      console.error('Error fetching notes:', error);
      toast.error('Failed to load notes');
    } finally {
      setNotesLoading(false);
    }
  };

  const assignCustomerToMe = async (customerId: string) => {
    if (!currentAdminUser) {
      toast.error('Unable to assign customer - admin user not found');
      return;
    }

    setAssignmentLoading(prev => ({ ...prev, [customerId]: true }));

    try {
      console.log('Assigning customer', customerId, 'to admin user', currentAdminUser.id);
      
      const { error } = await supabase
        .from('customers')
        .update({ assigned_to: currentAdminUser.id })
        .eq('id', customerId);

      if (error) {
        console.error('Assignment error:', error);
        throw error;
      }

      toast.success('Customer assigned to you successfully');
      fetchCustomers(); // Refresh the list
    } catch (error) {
      console.error('Error assigning customer:', error);
      toast.error('Failed to assign customer');
    } finally {
      setAssignmentLoading(prev => ({ ...prev, [customerId]: false }));
    }
  };

  const unassignCustomer = async (customerId: string) => {
    setAssignmentLoading(prev => ({ ...prev, [customerId]: true }));

    try {
      const { error } = await supabase
        .from('customers')
        .update({ assigned_to: null })
        .eq('id', customerId);

      if (error) throw error;

      toast.success('Customer unassigned successfully');
      fetchCustomers(); // Refresh the list
    } catch (error) {
      console.error('Error unassigning customer:', error);
      toast.error('Failed to unassign customer');
    } finally {
      setAssignmentLoading(prev => ({ ...prev, [customerId]: false }));
    }
  };

  const addNote = async () => {
    if (!newNote.trim() || !selectedCustomer) {
      toast.error('Please enter a note');
      return;
    }

    try {
      console.log('Adding note for customer:', selectedCustomer.id);
      console.log('Note content:', newNote);
      console.log('Note date:', noteDate.toISOString());

      // Check if user is authenticated or master admin
      const { data: { user } } = await supabase.auth.getUser();
      const isMasterAdmin = localStorage.getItem('masterAdmin') === 'true';
      
      const noteData = {
        customer_id: selectedCustomer.id,
        note: newNote,
        created_at: noteDate.toISOString(),
        created_by: isMasterAdmin ? null : user?.id
      };

      console.log('Inserting note data:', noteData);

      const { data, error } = await supabase
        .from('admin_notes')
        .insert([noteData])
        .select();

      if (error) {
        console.error('Database error adding note:', error);
        throw error;
      }

      console.log('Note added successfully:', data);
      
      setNewNote('');
      setNoteDate(new Date());
      fetchNotes(selectedCustomer.id);
      toast.success('Note added successfully');
    } catch (error) {
      console.error('Error adding note:', error);
      toast.error(`Failed to add note: ${error.message || 'Unknown error'}`);
    }
  };

  const updateCustomer = async () => {
    if (!editingCustomer) return;

    try {
      // Update customer table
      const { error: customerError } = await supabase
        .from('customers')
        .update({
          name: editingCustomer.name,
          email: editingCustomer.email,
          phone: editingCustomer.phone,
          first_name: editingCustomer.first_name,
          last_name: editingCustomer.last_name,
          flat_number: editingCustomer.flat_number,
          building_name: editingCustomer.building_name,
          building_number: editingCustomer.building_number,
          street: editingCustomer.street,
          town: editingCustomer.town,
          county: editingCustomer.county,
          postcode: editingCustomer.postcode,
          country: editingCustomer.country,
          registration_plate: editingCustomer.registration_plate,
          vehicle_make: editingCustomer.vehicle_make,
          vehicle_model: editingCustomer.vehicle_model,
          vehicle_year: editingCustomer.vehicle_year,
          vehicle_fuel_type: editingCustomer.vehicle_fuel_type,
          vehicle_transmission: editingCustomer.vehicle_transmission,
          mileage: editingCustomer.mileage,
          plan_type: editingCustomer.plan_type,
          payment_type: editingCustomer.payment_type,
          status: editingCustomer.status,
          voluntary_excess: editingCustomer.voluntary_excess,
          claim_limit: editingCustomer.claim_limit,
          discount_code: editingCustomer.discount_code,
          original_amount: editingCustomer.original_amount,
          discount_amount: editingCustomer.discount_amount,
          final_amount: editingCustomer.final_amount,
          mot_fee: editingCustomer.mot_fee,
          tyre_cover: editingCustomer.tyre_cover,
          wear_tear: editingCustomer.wear_tear,
          europe_cover: editingCustomer.europe_cover,
          transfer_cover: editingCustomer.transfer_cover,
          breakdown_recovery: editingCustomer.breakdown_recovery,
          vehicle_rental: editingCustomer.vehicle_rental,
          mot_repair: editingCustomer.mot_repair,
          lost_key: editingCustomer.lost_key,
          consequential: editingCustomer.consequential
        })
        .eq('id', editingCustomer.id);

      if (customerError) throw customerError;

      let authAccountCreated = false;
      // Create customer dashboard account if credentials provided
      if (editingCustomer.email && editingCustomer.temporary_password) {
        try {
          const { data: authData, error: authError } = await supabase.functions.invoke(
            'create-customer-account',
            {
              body: {
                email: editingCustomer.email,
                password: editingCustomer.temporary_password,
                firstName: editingCustomer.first_name || editingCustomer.name?.split(' ')[0] || '',
                lastName: editingCustomer.last_name || editingCustomer.name?.split(' ').slice(1).join(' ') || '',
                customerId: editingCustomer.id
              }
            }
          );

          if (authError) {
            console.error('Error creating auth account:', authError);
            toast.error(`Customer updated but failed to create auth account: ${authError.message}`);
          } else {
            console.log('Auth account created/updated successfully for:', editingCustomer.email);
            authAccountCreated = true;
          }
        } catch (authErr: any) {
          console.error('Exception creating auth account:', authErr);
          toast.warning('Customer updated but auth account creation had issues. Check admin notes.');
        }
      }

        // Update customer_policies table to sync warranty details
        if (editingCustomer.customer_policies && editingCustomer.customer_policies.length > 0) {
          const policyId = editingCustomer.customer_policies[0].id;
          
          const policyUpdateData: any = {
            voluntary_excess: editingCustomer.voluntary_excess,
            claim_limit: editingCustomer.claim_limit,
            payment_type: editingCustomer.payment_type,
            mot_fee: editingCustomer.mot_fee,
            tyre_cover: editingCustomer.tyre_cover,
            wear_tear: editingCustomer.wear_tear,
            europe_cover: editingCustomer.europe_cover,
            transfer_cover: editingCustomer.transfer_cover,
            breakdown_recovery: editingCustomer.breakdown_recovery,
            vehicle_rental: editingCustomer.vehicle_rental,
            mot_repair: editingCustomer.mot_repair,
            lost_key: editingCustomer.lost_key,
            consequential: editingCustomer.consequential,
            updated_at: new Date().toISOString()
          };

          // Add policy dates if they exist
          if (editingCustomer.customer_policies[0].policy_start_date) {
            policyUpdateData.policy_start_date = new Date(editingCustomer.customer_policies[0].policy_start_date).toISOString();
          }
          if (editingCustomer.customer_policies[0].policy_end_date) {
            policyUpdateData.policy_end_date = new Date(editingCustomer.customer_policies[0].policy_end_date).toISOString();
          }
          
          const { error: policyError } = await supabase
            .from('customer_policies')
            .update(policyUpdateData)
            .eq('id', policyId);

          if (policyError) {
            console.error('Error updating policy:', policyError);
            toast.error('Customer updated but failed to sync policy details');
          } else if (authAccountCreated) {
            toast.success(`Customer, warranty, and auth account updated for ${editingCustomer.email}`);
          } else {
            toast.success('Customer and warranty details updated successfully');
          }
        } else {
          if (authAccountCreated) {
            toast.success(`Customer updated and auth account created for ${editingCustomer.email}`);
          } else {
            toast.success('Customer updated successfully');
          }
        }
      
      fetchCustomers();
      setEditingCustomer(null);
    } catch (error) {
      console.error('Error updating customer:', error);
      toast.error('Failed to update customer');
    }
  };

  const exportToCSV = () => {
    const headers = ['Name', 'Email', 'Phone', 'Full Address', 'Registration Plate', 'Vehicle Details', 'Plan Type', 'Payment Type', 'Signup Date', 'Warranty Expiry', 'Voluntary Excess', 'Status', 'Final Amount'];
    const csvContent = [
      headers.join(','),
      ...filteredCustomers.map(customer => [
        customer.name,
        customer.email,
        customer.phone || '',
        `${customer.street || ''} ${customer.town || ''} ${customer.county || ''} ${customer.postcode || ''}`.trim(),
        customer.registration_plate || '',
        `${customer.vehicle_make || ''} ${customer.vehicle_model || ''} ${customer.vehicle_year || ''}`.trim(),
        customer.plan_type,
        customer.payment_type || '',
        format(new Date(customer.signup_date), 'yyyy-MM-dd'),
        customer.warranty_expiry ? format(new Date(customer.warranty_expiry), 'yyyy-MM-dd') : 'N/A',
        customer.voluntary_excess || 0,
        customer.status,
        
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `customers-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const fetchCustomerCredentials = async (customerEmail: string) => {
    try {
      setCredentialsLoading(true);
      const { data, error } = await supabase
        .from('welcome_emails')
        .select('email, temporary_password')
        .eq('email', customerEmail)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (error) {
        console.error('Error fetching customer credentials:', error);
        setCustomerCredentials(null);
        return;
      }
      
      if (data) {
        setCustomerCredentials({
          email: data.email,
          password: data.temporary_password
        });
      } else {
        setCustomerCredentials(null);
      }
    } catch (error) {
      console.error('Error fetching credentials:', error);
      setCustomerCredentials(null);
    } finally {
      setCredentialsLoading(false);
    }
  };

  const sendCredentialsEmail = async (customerEmail: string) => {
    try {
      setSendingCredentials(true);
      const { data, error } = await supabase.functions.invoke('resend-customer-credentials', {
        body: { email: customerEmail }
      });
      
      if (error) {
        toast.error('Failed to send credentials email: ' + error.message);
        return;
      }
      
      toast.success('Login credentials sent successfully to ' + customerEmail);
    } catch (error) {
      console.error('Error sending credentials:', error);
      toast.error('Failed to send credentials email');
    } finally {
      setSendingCredentials(false);
    }
  };

  const openCustomerDialog = (customer: Customer) => {
    setSelectedCustomer(customer);
    setEditingCustomer({ ...customer });
    fetchNotes(customer.id);
    fetchCustomerCredentials(customer.email);
  };

  // Check if current user is admin (not just member)
  const isAdmin = () => {
    const isMasterAdmin = localStorage.getItem('masterAdmin') === 'true';
    const hasAdminRole = currentAdminUser?.role === 'admin';
    
    console.log('isAdmin check:', {
      isMasterAdmin,
      currentAdminUser: currentAdminUser,
      hasAdminRole,
      result: isMasterAdmin || hasAdminRole
    });
    
    return isMasterAdmin || hasAdminRole;
  };

  const deleteCustomer = async (customerId: string, customerName: string) => {
    if (!isAdmin()) {
      toast.error('Only administrators can delete customer records');
      return;
    }

    if (!confirm(`Are you sure you want to archive "${customerName}"? You can restore it anytime from the Order Archive.`)) {
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const adminId = user?.id;

      if (!adminId) {
        toast.error('Unable to identify admin user');
        return;
      }

      // Check if this is an orphaned policy (fake customer record)
      const isOrphanedPolicy = customerName === 'Unknown Customer';
      
      if (isOrphanedPolicy) {
        // This is an orphaned policy - soft delete the policy record directly
        console.log('Soft deleting orphaned policy with ID:', customerId);
        
        const { error: policyError } = await supabase
          .from('customer_policies')
          .update({
            is_deleted: true,
            deleted_at: new Date().toISOString(),
            deleted_by: adminId
          })
          .eq('id', customerId);

        if (policyError) {
          console.error('Error archiving orphaned policy:', policyError);
          toast.error('Failed to archive policy record: ' + policyError.message);
          return;
        }

        toast.success('Policy archived successfully. Find it in Order Archive.');
      } else {
        // Use the database function for soft delete
        console.log('Soft deleting customer with ID:', customerId);
        
        const { error } = await supabase.rpc('soft_delete_customer', {
          customer_uuid: customerId,
          admin_uuid: adminId
        });

        if (error) {
          console.error('Error archiving customer:', error);
          toast.error('Failed to archive customer: ' + error.message);
          return;
        }

        toast.success(`"${customerName}" archived successfully. Find it in Order Archive.`);
      }
      
      fetchCustomers(); // Refresh the customer list
      fetchDeletedCustomers(); // Refresh deleted list
    } catch (error) {
      console.error('Unexpected error archiving record:', error);
      toast.error('An unexpected error occurred while archiving the record');
    }
  };

  const handleSelectAll = () => {
    if (selectedCustomers.size === filteredCustomers.length) {
      setSelectedCustomers(new Set());
    } else {
      setSelectedCustomers(new Set(filteredCustomers.map(c => c.id)));
    }
  };

  const handleSelectCustomer = (customerId: string) => {
    const newSelected = new Set(selectedCustomers);
    if (newSelected.has(customerId)) {
      newSelected.delete(customerId);
    } else {
      newSelected.add(customerId);
    }
    setSelectedCustomers(newSelected);
  };

  const bulkDeleteCustomers = async () => {
    if (!isAdmin()) {
      toast.error('Only administrators can delete customer records');
      return;
    }

    if (selectedCustomers.size === 0) {
      toast.error('No customers selected for archiving');
      return;
    }

    const selectedCount = selectedCustomers.size;
    if (!confirm(`Archive ${selectedCount} customer(s)? You can restore them anytime from Order Archive.`)) {
      return;
    }

    setBulkDeleteLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const adminId = user?.id;

      if (!adminId) {
        toast.error('Unable to identify admin user');
        setBulkDeleteLoading(false);
        return;
      }

      const errors = [];
      let successCount = 0;

      for (const customerId of selectedCustomers) {
        const customer = filteredCustomers.find(c => c.id === customerId);
        if (!customer) continue;

        try {
          const isOrphanedPolicy = customer.name === 'Unknown Customer';
          
          if (isOrphanedPolicy) {
            const { error: policyError } = await supabase
              .from('customer_policies')
              .update({
                is_deleted: true,
                deleted_at: new Date().toISOString(),
                deleted_by: adminId
              })
              .eq('id', customerId);

            if (policyError) {
              errors.push(`Failed to archive policy ${customerId}: ${policyError.message}`);
            } else {
              successCount++;
            }
          } else {
            const { error } = await supabase.rpc('soft_delete_customer', {
              customer_uuid: customerId,
              admin_uuid: adminId
            });

            if (error) {
              errors.push(`Failed to archive customer ${customer.name}: ${error.message}`);
            } else {
              successCount++;
            }
          }
        } catch (error) {
          errors.push(`Error archiving ${customer.name}: ${error}`);
        }
      }

      if (errors.length > 0) {
        console.error('Bulk archive errors:', errors);
        toast.error(`${successCount} customers archived, ${errors.length} failed`);
      } else {
        toast.success(`Successfully archived ${successCount} customer(s). Find them in Order Archive.`);
      }

      setSelectedCustomers(new Set());
      fetchCustomers();
      fetchDeletedCustomers();
    } catch (error) {
      console.error('Bulk archive error:', error);
      toast.error('An error occurred during bulk archiving');
    } finally {
      setBulkDeleteLoading(false);
    }
  };

  const fetchEmailStatuses = async () => {
    try {
      // Fetch welcome and activation email statuses for all customers
      const { data: emailLogs, error } = await supabase
        .from('email_logs')
        .select('recipient_email, subject, status')
        .in('status', ['sent', 'delivered']);

      if (error) {
        console.error('Error fetching email statuses:', error);
        return;
      }

      // Process email logs to determine status for each customer
      const statuses: { [key: string]: EmailStatus } = {};
      
      customers.forEach(customer => {
        const customerEmails = emailLogs?.filter(log => log.recipient_email === customer.email) || [];
        statuses[customer.email] = {
          portal_signup: customerEmails.some(log => 
            log.subject?.toLowerCase().includes('welcome to buyawarranty.co.uk') &&
            log.subject?.toLowerCase().includes('get you started')
          ),
          policy_documents: customerEmails.some(log => 
            log.subject?.toLowerCase().includes('policy') || 
            log.subject?.toLowerCase().includes('warranty') ||
            log.subject?.toLowerCase().includes('document')
          )
        };
      });

      setEmailStatuses(statuses);
    } catch (error) {
      console.error('Error fetching email statuses:', error);
    }
  };

  const sendManualEmail = async (customerId: string, customerEmail: string, emailType: 'policy_documents' | 'portal_signup') => {
    const emailKey = `${customerId}_${emailType}`;
    setEmailSendingLoading(prev => ({
      ...prev,
      [customerId]: { ...prev[customerId], [emailType]: true }
    }));

    try {
      const customer = customers.find(c => c.id === customerId);
      let functionName: string;
      let payload: any;
      
      if (emailType === 'portal_signup') {
        functionName = 'send-email';
        payload = {
          templateId: 'Welcome Email - Portal Signup',
          recipientEmail: customerEmail,
          variables: {
            customer_name: customer?.name || customer?.first_name || 'Customer',
            customerName: customer?.name || customer?.first_name || 'Customer',
            loginLink: `${window.location.origin}/customer-dashboard`,
            portalLink: `${window.location.origin}/customer-dashboard`
          }
        };
      } else {
        functionName = 'send-policy-documents';
        payload = {
          recipientEmail: customerEmail,
          variables: {
            planType: customer?.plan_type || 'basic',
            customerName: customer?.name || customer?.first_name || 'Customer'
          }
        };
      }

      const { error } = await supabase.functions.invoke(functionName, {
        body: payload
      });

      if (error) throw error;

      const emailTypeNames = {
        portal_signup: 'Portal Signup',
        policy_documents: 'Policy Documents'
      };

      toast.success(`${emailTypeNames[emailType]} email sent successfully`);
      
      // Update email status locally
      setEmailStatuses(prev => ({
        ...prev,
        [customerEmail]: {
          ...prev[customerEmail],
          [emailType]: true
        }
      }));
      
      // Refresh email statuses from database
      setTimeout(fetchEmailStatuses, 1000);
    } catch (error) {
      console.error(`Error sending ${emailType} email:`, error);
      toast.error(`Failed to send ${emailType} email`);
    } finally {
      setEmailSendingLoading(prev => ({
        ...prev,
        [customerId]: { ...prev[customerId], [emailType]: false }
      }));
    }
  };

  const EmailStatusIndicator = ({ customer }: { customer: Customer }) => {
    const status = emailStatuses[customer.email] || { policy_documents: false, portal_signup: false };
    
    return (
      <div className="flex flex-col space-y-1">
        <div className="flex items-center space-x-2">
          {status.portal_signup ? (
            <CheckCircle className="h-4 w-4 text-green-600" />
          ) : (
            <Clock className="h-4 w-4 text-red-500" />
          )}
          <span className="text-xs">Portal Signup</span>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={() => sendManualEmail(customer.id, customer.email, 'portal_signup')}
            disabled={emailSendingLoading[customer.id]?.portal_signup}
          >
            {emailSendingLoading[customer.id]?.portal_signup ? (
              <div className="animate-spin rounded-full h-3 w-3 border border-orange-600 border-t-transparent"></div>
            ) : (
              <Send className="h-3 w-3" />
            )}
          </Button>
        </div>
        
        <div className="flex items-center space-x-2">
          {status.policy_documents ? (
            <CheckCircle className="h-4 w-4 text-green-600" />
          ) : (
            <Clock className="h-4 w-4 text-red-500" />
          )}
          <span className="text-xs">Policy Documents</span>
          {!status.policy_documents && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={() => sendManualEmail(customer.id, customer.email, 'policy_documents')}
              disabled={emailSendingLoading[customer.id]?.policy_documents}
            >
              {emailSendingLoading[customer.id]?.policy_documents ? (
                <div className="animate-spin rounded-full h-3 w-3 border border-orange-600 border-t-transparent"></div>
              ) : (
                <Send className="h-3 w-3" />
              )}
            </Button>
          )}
        </div>
      </div>
    );
  };

  const handleSendWelcomeEmail = async (policyId: string, customerId: string) => {
    setEmailSendingLoading(prev => ({ 
      ...prev, 
      [customerId]: { ...prev[customerId], email: true } 
    }));
    
    try {
      const { data, error } = await supabase.functions.invoke('send-welcome-email-manual', {
        body: { 
          policyId: policyId,
          customerId: customerId 
        }
      });

      if (error) throw error;
      
      toast.success('Welcome email sent successfully!');
      fetchCustomers(); // Refresh to update status
    } catch (error: any) {
      console.error('Error sending welcome email:', error);
      toast.error(`Failed to send email: ${error.message}`);
    } finally {
      setEmailSendingLoading(prev => ({ 
        ...prev, 
        [customerId]: { ...prev[customerId], email: false } 
      }));
    }
  };

  const handleSendToWarranties2000 = async (policyId: string, customerId: string, force = false) => {
    setEmailSendingLoading(prev => ({ 
      ...prev, 
      [customerId]: { ...prev[customerId], warranties2000: true } 
    }));
    
    try {
      const { data, error } = await supabase.functions.invoke('send-to-warranties-2000', {
        body: { 
          policyId: policyId,
          customerId: customerId,
          force: force // Allow resending even if already sent
        }
      });

      if (error) throw error;
      
      toast.success('Successfully sent to Warranties 2000!');
      fetchCustomers(); // Refresh to update status
    } catch (error: any) {
      console.error('Error sending to Warranties 2000:', error);
      toast.error(`Failed to send to Warranties 2000: ${error.message}`);
    } finally {
      setEmailSendingLoading(prev => ({ 
        ...prev, 
        [customerId]: { ...prev[customerId], warranties2000: false } 
      }));
    }
  };

  const refreshVehicleDataFromDVLA = async (customerId: string, registrationPlate: string) => {
    if (!registrationPlate) {
      toast.error('Registration plate is required for DVLA lookup');
      return;
    }

    setDvlaLookupLoading(prev => ({ ...prev, [customerId]: true }));
    
    try {
      console.log(`Starting DVLA lookup for registration: ${registrationPlate}`);
      
      const { data, error } = await supabase.functions.invoke('dvla-vehicle-lookup', {
        body: { registrationNumber: registrationPlate }
      });

      if (error) {
        console.error('DVLA lookup error:', error);
        throw error;
      }

      console.log('DVLA lookup response:', data);

      if (!data.found) {
        toast.error(`Vehicle not found in DVLA database: ${data.error || 'Unknown error'}`);
        return;
      }

      // Update customer record with DVLA data
      const updateData = {
        vehicle_make: data.make || null,
        vehicle_model: data.model || null,
        vehicle_year: data.yearOfManufacture ? data.yearOfManufacture.toString() : null,
        vehicle_fuel_type: data.fuelType || null,
        vehicle_transmission: data.transmission || null,
        updated_at: new Date().toISOString()
      };

      console.log('Updating customer with DVLA data:', updateData);

      const { error: updateError } = await supabase
        .from('customers')
        .update(updateData)
        .eq('id', customerId);

      if (updateError) {
        console.error('Error updating customer with DVLA data:', updateError);
        throw updateError;
      }

      toast.success(`Vehicle data updated from DVLA: ${data.make} ${data.model || ''}`);
      
      // Refresh customers list to show updated data
      fetchCustomers();
      
    } catch (error: any) {
      console.error('Error in DVLA vehicle lookup:', error);
      toast.error(`DVLA lookup failed: ${error.message || 'Unknown error'}`);
    } finally {
      setDvlaLookupLoading(prev => ({ ...prev, [customerId]: false }));
    }
  };

  const resetCustomerPassword = async (customerId: string, customerEmail: string) => {
    setPasswordResetLoading(prev => ({ ...prev, [customerId]: true }));
    
    try {
      console.log('Resetting password for customer:', customerId, customerEmail);
      
      // Generate a secure temporary password
      const generateSecurePassword = () => {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
        let password = '';
        for (let i = 0; i < 12; i++) {
          password += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return password;
      };
      
      const tempPassword = generateSecurePassword();
      
      console.log('Generated temporary password for admin use:', tempPassword);
      
      // Log the password reset in our tracking table
      const { error: logError } = await supabase
        .from('welcome_emails')
        .insert({
          email: customerEmail,
          temporary_password: tempPassword,
          password_reset: true,
          user_id: customerId
        });
      
      if (logError) {
        console.error('Error logging password reset:', logError);
      }
      
      // Send reset email as backup
      const { error: emailError } = await supabase.functions.invoke('send-password-reset-email', {
        body: { email: customerEmail }
      });
      
      if (emailError) {
        console.error('Error sending reset email:', emailError);
        // Don't throw here, as we still want to show the temp password
      }
      
      // Show the temporary password to the admin with copy functionality
      const message = `Temporary password generated: ${tempPassword}\n\nThis password has been logged in the system. Please provide this to the customer securely. A password reset email has also been sent as backup.`;
      
      // Create a more user-friendly dialog
      if (navigator.clipboard) {
        try {
          await navigator.clipboard.writeText(tempPassword);
          toast.success(`Password reset successful! Temporary password copied to clipboard: ${tempPassword}`, {
            duration: 15000,
            action: {
              label: 'Copy Again',
              onClick: () => navigator.clipboard.writeText(tempPassword)
            }
          });
        } catch (clipboardError) {
          toast.success(`Password reset successful! Temporary password: ${tempPassword}`, {
            duration: 15000,
          });
        }
      } else {
        toast.success(`Password reset successful! Temporary password: ${tempPassword}`, {
          duration: 15000,
        });
      }
      
      // Also log to console for admin reference
      console.log('='.repeat(50));
      console.log('CUSTOMER PASSWORD RESET');
      console.log('Customer:', customerEmail);
      console.log('Temporary Password:', tempPassword);
      console.log('Reset Time:', new Date().toISOString());
      console.log('='.repeat(50));
      
    } catch (error) {
      console.error('Error resetting password:', error);
      toast.error(`Failed to reset password: ${error.message || 'Unknown error'}`);
    } finally {
      setPasswordResetLoading(prev => ({ ...prev, [customerId]: false }));
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600"></div>
        <span className="ml-2">Loading customers...</span>
      </div>
    );
  }

  const getContactStatusColor = (status: string) => {
    switch (status) {
      case 'not_contacted': return 'bg-red-500';
      case 'contacted': return 'bg-yellow-500'; 
      case 'follow_up': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  const getContactStatusText = (status: string) => {
    switch (status) {
      case 'not_contacted': return 'Not Contacted';
      case 'contacted': return 'Contacted';
      case 'follow_up': return 'Follow-up Done';
      default: return 'Unknown';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Customer Management</h2>
        <div className="flex space-x-2">
          <ManualOrderEntry />
          <Button 
            onClick={fetchCustomers} 
            variant="outline"
            className="flex items-center space-x-2"
          >
            <RefreshCw className="h-4 w-4" />
            <span>Refresh</span>
          </Button>
          <Button onClick={exportToCSV} className="flex items-center space-x-2">
            <Download className="h-4 w-4" />
            <span>Export CSV</span>
          </Button>
          
          {/* Debug Info Button */}
          {debugInfo && (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="flex items-center space-x-2 text-gray-600">
                  <AlertCircle className="h-4 w-4" />
                  <span>Debug Info</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-96">
                <div className="space-y-2">
                  <h4 className="font-semibold text-sm">Debug Information</h4>
                  <pre className="text-xs text-gray-700 whitespace-pre-wrap bg-gray-50 p-2 rounded">{debugInfo}</pre>
                </div>
              </PopoverContent>
            </Popover>
          )}

          {/* Order Management Guide Button */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="flex items-center space-x-2 text-gray-600">
                <AlertCircle className="h-4 w-4" />
                <span>Order Management Guide</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-96">
              <div className="space-y-3">
                <h4 className="font-semibold text-sm text-blue-900">Easily manage your vehicle warranty orders</h4>
                <p className="text-xs text-blue-700">
                  Need to delete an order? You can do that anytime — and if you change your mind, it's not gone forever.
                </p>
                <div className="space-y-2 text-xs text-blue-700">
                  <div className="flex items-start gap-2">
                    <Archive className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                    <div>
                      <strong>Deleted orders are safely stored</strong> — You'll find them in your Order Archive, where you can restore or review them whenever you like.
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <RotateCcw className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                    <div>
                      <strong>Restore with one click</strong> — Mistakes happen. That's why we've made it easy to bring back any deleted order.
                    </div>
                  </div>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <Tabs defaultValue="complete" className="w-full">
        <TabsList className="grid w-full grid-cols-3 bg-transparent gap-2">
          <TabsTrigger 
            value="complete" 
            className="bg-blue-50 text-blue-700 border border-blue-200 data-[state=active]:bg-blue-100 data-[state=active]:text-blue-900 data-[state=active]:border-blue-400 data-[state=active]:border-2 data-[state=active]:shadow-sm"
          >
            Active Orders
          </TabsTrigger>
          <TabsTrigger 
            value="deleted"
            className="bg-amber-50 text-amber-700 border border-amber-200 data-[state=active]:bg-amber-100 data-[state=active]:text-amber-900 data-[state=active]:border-amber-400 data-[state=active]:border-2 data-[state=active]:shadow-sm"
          >
            <Archive className="h-4 w-4 mr-2" />
            Order Archive
          </TabsTrigger>
          <TabsTrigger 
            value="incomplete" 
            className="bg-red-50 text-red-700 border border-red-200 data-[state=active]:bg-red-100 data-[state=active]:text-red-900 data-[state=active]:border-red-400 data-[state=active]:border-2 data-[state=active]:shadow-sm"
          >
            Incomplete Customers
          </TabsTrigger>
        </TabsList>

        <TabsContent value="complete" className="space-y-4">
          {/* Enhanced Search and Filter Controls */}
          <div className="bg-white p-4 rounded-lg border space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Search */}
              <div className="space-y-1">
                <Label htmlFor="search" className="text-sm font-medium">Search</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="search"
                    placeholder="Search by name, email, or registration..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              {/* Sort By */}
              <div className="space-y-1">
                <Label htmlFor="sortBy" className="text-sm font-medium">Sort By</Label>
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="newest">Newest First</SelectItem>
                    <SelectItem value="oldest">Oldest First</SelectItem>
                    <SelectItem value="name">Name (A-Z)</SelectItem>
                    <SelectItem value="email">Email (A-Z)</SelectItem>
                    <SelectItem value="plan">Plan Type</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Filter by Plan */}
              <div className="space-y-1">
                <Label htmlFor="planFilter" className="text-sm font-medium">Plan Type</Label>
                <Select value={filterByPlan} onValueChange={setFilterByPlan}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Plans</SelectItem>
                    <SelectItem value="basic">Basic</SelectItem>
                    <SelectItem value="gold">Gold</SelectItem>
                    <SelectItem value="platinum">Platinum</SelectItem>
                    <SelectItem value="electric">Electric</SelectItem>
                    <SelectItem value="phev">PHEV</SelectItem>
                    <SelectItem value="motorbike">Motorbike</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Filter by Status */}
              <div className="space-y-1">
                <Label htmlFor="statusFilter" className="text-sm font-medium">Status</Label>
                <Select value={filterByStatus} onValueChange={setFilterByStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Second row for tag filter */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Filter by Tag */}
              <div className="space-y-1">
                <Label htmlFor="tagFilter" className="text-sm font-medium">Filter by Tag</Label>
                <Select value={filterByTag} onValueChange={setFilterByTag}>
                  <SelectTrigger>
                    <SelectValue>
                      {filterByTag === 'all' ? (
                        'All Tags'
                      ) : (
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-3 h-3 rounded-full flex-shrink-0" 
                            style={{ backgroundColor: availableTags.find(t => t.id === filterByTag)?.color }}
                          />
                          <span>{availableTags.find(t => t.id === filterByTag)?.name || 'Select Tag'}</span>
                        </div>
                      )}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Tags</SelectItem>
                    {Object.entries(
                      availableTags.reduce((acc: any, tag) => {
                        if (!acc[tag.category]) {
                          acc[tag.category] = [];
                        }
                        acc[tag.category].push(tag);
                        return acc;
                      }, {})
                    ).map(([category, tags]: [string, any]) => (
                      <React.Fragment key={category}>
                        <SelectItem value={`category-${category}`} disabled className="font-semibold text-xs uppercase text-muted-foreground">
                          {category}
                        </SelectItem>
                        {tags.map((tag: any) => (
                          <SelectItem key={tag.id} value={tag.id} className="pl-6">
                            <div className="flex items-center gap-2">
                              <div 
                                className="w-3 h-3 rounded-full flex-shrink-0" 
                                style={{ backgroundColor: tag.color }}
                              />
                              <span>{tag.name}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </React.Fragment>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Results Summary and Bulk Actions */}
            <div className="flex items-center justify-between text-sm text-gray-600 pt-2 border-t">
              <div className="flex items-center gap-4">
                <span>
                  Showing {filteredCustomers.length} of {customers.length} customers
                  {searchTerm && ` for "${searchTerm}"`}
                  {filterByPlan !== 'all' && ` • ${filterByPlan} plan`}
                  {filterByStatus !== 'all' && ` • ${filterByStatus} status`}
                  {filterByTag !== 'all' && ` • filtered by tag`}
                </span>
                {selectedCustomers.size > 0 && (
                  <Badge variant="secondary" className="bg-blue-50 text-blue-700">
                    {selectedCustomers.size} selected
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                {selectedCustomers.size > 0 && (
                  <>
                    <BulkTagDialog 
                      selectedCustomerIds={Array.from(selectedCustomers)}
                      onComplete={() => {
                        setSelectedCustomers(new Set());
                        fetchCustomers();
                      }}
                    />
                    <BulkEmailDialog 
                      selectedCustomerIds={Array.from(selectedCustomers)}
                      onComplete={() => setSelectedCustomers(new Set())}
                    />
                    {isAdmin() && (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={bulkDeleteCustomers}
                        disabled={bulkDeleteLoading}
                        className="text-xs"
                      >
                        {bulkDeleteLoading ? (
                          <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-1"></div>
                        ) : (
                          <Trash2 className="h-3 w-3 mr-1" />
                        )}
                        Delete Selected ({selectedCustomers.size})
                      </Button>
                    )}
                  </>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSearchTerm('');
                    setSortBy('newest');
                    setFilterByPlan('all');
                    setFilterByStatus('all');
                    setFilterByTag('all');
                    setSelectedCustomers(new Set());
                  }}
                  className="text-xs"
                >
                  Clear Filters
                </Button>
              </div>
            </div>
          </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <Table className="min-w-[1800px]">
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <Checkbox
                  checked={selectedCustomers.size === filteredCustomers.length && filteredCustomers.length > 0}
                  onCheckedChange={handleSelectAll}
                  aria-label="Select all customers"
                />
              </TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>RegNum</TableHead>
              <TableHead>Make</TableHead>
              <TableHead>Model</TableHead>
              <TableHead>RegDate</TableHead>
              <TableHead>Address</TableHead>
              <TableHead>WarType</TableHead>
              <TableHead>Dur.</TableHead>
              <TableHead>Expiry Date</TableHead>
              <TableHead>Payment Method</TableHead>
              <TableHead>Vol. Excess</TableHead>
              <TableHead>Claim Limit</TableHead>
              <TableHead>Tags</TableHead>
              <TableHead>Ref</TableHead>
              <TableHead>Email Status</TableHead>
              <TableHead>Warranties2000</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Assigned To</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredCustomers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={20} className="text-center py-8">
                  <div className="space-y-4">
                    <AlertCircle className="h-12 w-12 text-gray-400 mx-auto" />
                    <div>
                      <p className="text-gray-500 text-lg">No customers found</p>
                      <p className="text-gray-400 text-sm mt-2">
                        This might be due to RLS policies or missing data
                      </p>
                    </div>
                    <Button onClick={fetchCustomers} variant="outline" size="sm">
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Try Again
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredCustomers.map((customer) => (
                <TableRow key={customer.id}>
                  <TableCell>
                    <Checkbox
                      checked={selectedCustomers.has(customer.id)}
                      onCheckedChange={() => handleSelectCustomer(customer.id)}
                      aria-label={`Select ${customer.name}`}
                    />
                  </TableCell>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openCustomerDialog(customer)}
                            title="Edit Customer"
                            className="h-6 w-6 p-0"
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                          <DialogHeader>
                            <div className="flex items-center justify-between">
                              <DialogTitle>Manage Customer: {selectedCustomer?.name}</DialogTitle>
                              {selectedCustomer && (
                                <SendNotificationDialog 
                                  customerId={selectedCustomer.id}
                                  customerName={selectedCustomer.name}
                                  customerEmail={selectedCustomer.email}
                                />
                              )}
                            </div>
                          </DialogHeader>
                          
                          {editingCustomer && (
                            <>
                              {/* Customer Login Credentials Section */}
                              <Collapsible 
                                open={credentialsExpanded} 
                                onOpenChange={setCredentialsExpanded}
                                className="mb-6"
                              >
                                <div className="p-4 bg-green-50 border-2 border-green-300 rounded-lg">
                                  <CollapsibleTrigger asChild>
                                    <button className="w-full flex items-center justify-between text-lg font-semibold text-green-900 hover:text-green-700 transition-colors">
                                      <div className="flex items-center">
                                        <Key className="h-5 w-5 mr-2" />
                                        Customer Login Credentials
                                      </div>
                                      {credentialsExpanded ? (
                                        <ChevronUp className="h-5 w-5" />
                                      ) : (
                                        <ChevronDown className="h-5 w-5" />
                                      )}
                                    </button>
                                  </CollapsibleTrigger>
                                  
                                  <CollapsibleContent className="mt-4">
                                    {credentialsLoading ? (
                                      <div className="text-sm text-gray-600">Loading credentials...</div>
                                    ) : customerCredentials ? (
                                      <div className="space-y-3">
                                        <div className="bg-white p-4 rounded border border-green-200">
                                          <div className="space-y-3">
                                            <div>
                                              <Label className="text-sm font-medium text-gray-700">Customer Dashboard URL</Label>
                                              <code className="text-sm font-mono bg-gray-100 px-2 py-1 rounded block mt-1">
                                                https://buyawarranty.co.uk/customer-dashboard
                                              </code>
                                            </div>
                                            
                                            <div>
                                              <Label className="text-sm font-medium text-gray-700">Username (Email)</Label>
                                              <code className="text-sm font-mono bg-gray-100 px-2 py-1 rounded block mt-1">
                                                {customerCredentials.email}
                                              </code>
                                            </div>
                                            
                                            <div>
                                              <Label className="text-sm font-medium text-gray-700">Temporary Password</Label>
                                              <code className="text-sm font-mono bg-gray-100 px-2 py-1 rounded block mt-1">
                                                {customerCredentials.password}
                                              </code>
                                            </div>
                                          </div>
                                          
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            className="w-full mt-3"
                                            onClick={() => {
                                              const credentials = `Customer Dashboard Login Details

Dashboard URL: https://buyawarranty.co.uk/customer-dashboard
Username: ${customerCredentials.email}
Password: ${customerCredentials.password}

Please log in and change your password after first login.`;
                                              navigator.clipboard.writeText(credentials);
                                              toast.success('All credentials copied to clipboard');
                                            }}
                                          >
                                            Copy All Credentials
                                          </Button>
                                        </div>
                                        
                                        <div className="bg-yellow-50 border border-yellow-200 rounded p-3 mt-3">
                                          <p className="text-xs text-yellow-800 flex items-center gap-1">
                                            <AlertCircle className="h-3 w-3" />
                                            Customer should change password after first login
                                          </p>
                                        </div>
                                        
                                        <div className="flex gap-2 mt-4">
                                          <Button
                                            onClick={() => sendCredentialsEmail(customerCredentials.email)}
                                            disabled={sendingCredentials}
                                            className="flex-1"
                                          >
                                            {sendingCredentials ? (
                                              <>
                                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                                Sending...
                                              </>
                                            ) : (
                                              <>
                                                <Send className="h-4 w-4 mr-2" />
                                                Email Login Credentials to Customer
                                              </>
                                            )}
                                          </Button>
                                          
                                          {/* View as Customer Info Box */}
                                          <div className="bg-blue-50 border border-blue-300 rounded-lg p-4 mt-4">
                                            <div className="flex items-start gap-3">
                                              <Eye className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                                              <div className="flex-1 space-y-2">
                                                <h4 className="font-semibold text-blue-900">Safe Customer View</h4>
                                                <p className="text-sm text-blue-800">
                                                  Use the button below to view this customer's dashboard safely. Your admin session will remain active in other tabs - no need to log out!
                                                </p>
                                              </div>
                                            </div>
                                          </div>
                                          
                                          <ViewAsCustomerButton
                                            customerId={selectedCustomer.id}
                                            customerEmail={customerCredentials.email}
                                            customerName={selectedCustomer.name}
                                          />
                                        </div>
                                        
                                        {/* Last Login Information */}
                                        {selectedCustomer.last_login && (
                                          <div className="bg-blue-50 border border-blue-200 rounded p-3 mt-3">
                                            <p className="text-xs text-blue-800 flex items-center gap-1">
                                              <Clock className="h-3 w-3" />
                                              Last Login: {new Date(selectedCustomer.last_login).toLocaleString('en-GB', {
                                                dateStyle: 'medium',
                                                timeStyle: 'short'
                                              })}
                                            </p>
                                          </div>
                                        )}
                                      </div>
                                    ) : (
                                      <div className="text-sm text-red-600">
                                        Unable to load credentials. Please try again.
                                      </div>
                                    )}
                                  </CollapsibleContent>
                                </div>
                              </Collapsible>

                              <Tabs defaultValue="details" className="w-full">
                                <TabsList className="grid w-full grid-cols-7">
                                  <TabsTrigger value="details">Customer Details</TabsTrigger>
                                  <TabsTrigger value="warranty">Warranty Details</TabsTrigger>
                                  <TabsTrigger value="tags">Tags</TabsTrigger>
                                  <TabsTrigger value="notes">Notes</TabsTrigger>
                                  <TabsTrigger value="actions">Warranty Actions</TabsTrigger>
                                  <TabsTrigger value="mot">MOT History</TabsTrigger>
                                  <TabsTrigger value="w2000">Warranties 2000</TabsTrigger>
                                </TabsList>

                                <TabsContent value="details" className="space-y-4">
                                  <div className="grid grid-cols-2 gap-4">
                                    <div>
                                      <Label htmlFor="edit-name">Full Name</Label>
                                      <Input
                                        id="edit-name"
                                        value={editingCustomer.name}
                                        onChange={(e) => setEditingCustomer({ ...editingCustomer, name: e.target.value })}
                                      />
                                    </div>
                                    <div>
                                      <Label htmlFor="edit-email">Email</Label>
                                      <Input
                                        id="edit-email"
                                        type="email"
                                        value={editingCustomer.email}
                                        onChange={(e) => setEditingCustomer({ ...editingCustomer, email: e.target.value })}
                                      />
                                    </div>
                                    <div>
                                      <Label htmlFor="edit-phone">Phone</Label>
                                      <Input
                                        id="edit-phone"
                                        value={editingCustomer.phone || ''}
                                        onChange={(e) => setEditingCustomer({ ...editingCustomer, phone: e.target.value })}
                                      />
                                    </div>
                                    <div>
                                      <Label htmlFor="edit-registration">Registration Plate</Label>
                                      <Input
                                        id="edit-registration"
                                        value={editingCustomer.registration_plate}
                                        onChange={(e) => setEditingCustomer({ ...editingCustomer, registration_plate: e.target.value })}
                                      />
                                    </div>
                                  </div>

                                  <div className="space-y-4 pt-4 border-t">
                                    <h3 className="text-lg font-semibold">Vehicle Details</h3>
                                    <div className="grid grid-cols-2 gap-4">
                                      <div>
                                        <Label htmlFor="edit-vehicle-make">Make</Label>
                                        <Input
                                          id="edit-vehicle-make"
                                          value={editingCustomer.vehicle_make || ''}
                                          onChange={(e) => setEditingCustomer({ ...editingCustomer, vehicle_make: e.target.value })}
                                        />
                                      </div>
                                      <div>
                                        <Label htmlFor="edit-vehicle-model">Model</Label>
                                        <Input
                                          id="edit-vehicle-model"
                                          value={editingCustomer.vehicle_model || ''}
                                          onChange={(e) => setEditingCustomer({ ...editingCustomer, vehicle_model: e.target.value })}
                                        />
                                      </div>
                                      <div>
                                        <Label htmlFor="edit-vehicle-year">Year</Label>
                                        <Input
                                          id="edit-vehicle-year"
                                          value={editingCustomer.vehicle_year || ''}
                                          onChange={(e) => setEditingCustomer({ ...editingCustomer, vehicle_year: e.target.value })}
                                        />
                                      </div>
                                      <div>
                                        <Label htmlFor="edit-mileage">Mileage</Label>
                                        <Input
                                          id="edit-mileage"
                                          value={editingCustomer.mileage || ''}
                                          onChange={(e) => setEditingCustomer({ ...editingCustomer, mileage: e.target.value })}
                                        />
                                      </div>
                                      <div>
                                        <Label htmlFor="edit-fuel-type">Fuel Type</Label>
                                        <Input
                                          id="edit-fuel-type"
                                          value={editingCustomer.vehicle_fuel_type || ''}
                                          onChange={(e) => setEditingCustomer({ ...editingCustomer, vehicle_fuel_type: e.target.value })}
                                        />
                                      </div>
                                      <div>
                                        <Label htmlFor="edit-transmission">Transmission</Label>
                                        <Input
                                          id="edit-transmission"
                                          value={editingCustomer.vehicle_transmission || ''}
                                          onChange={(e) => setEditingCustomer({ ...editingCustomer, vehicle_transmission: e.target.value })}
                                        />
                                      </div>
                                    </div>
                                  </div>

                                  <div className="space-y-4 pt-4 border-t">
                                    <h3 className="text-lg font-semibold">Address Details</h3>
                                    <div className="grid grid-cols-2 gap-4">
                                      <div>
                                        <Label htmlFor="edit-flat-number">Flat Number</Label>
                                        <Input
                                          id="edit-flat-number"
                                          value={editingCustomer.flat_number || ''}
                                          onChange={(e) => setEditingCustomer({ ...editingCustomer, flat_number: e.target.value })}
                                        />
                                      </div>
                                      <div>
                                        <Label htmlFor="edit-building-name">Building Name</Label>
                                        <Input
                                          id="edit-building-name"
                                          value={editingCustomer.building_name || ''}
                                          onChange={(e) => setEditingCustomer({ ...editingCustomer, building_name: e.target.value })}
                                        />
                                      </div>
                                      <div>
                                        <Label htmlFor="edit-building-number">Building Number</Label>
                                        <Input
                                          id="edit-building-number"
                                          value={editingCustomer.building_number || ''}
                                          onChange={(e) => setEditingCustomer({ ...editingCustomer, building_number: e.target.value })}
                                        />
                                      </div>
                                      <div>
                                        <Label htmlFor="edit-street">Street</Label>
                                        <Input
                                          id="edit-street"
                                          value={editingCustomer.street || ''}
                                          onChange={(e) => setEditingCustomer({ ...editingCustomer, street: e.target.value })}
                                        />
                                      </div>
                                      <div>
                                        <Label htmlFor="edit-town">Town</Label>
                                        <Input
                                          id="edit-town"
                                          value={editingCustomer.town || ''}
                                          onChange={(e) => setEditingCustomer({ ...editingCustomer, town: e.target.value })}
                                        />
                                      </div>
                                      <div>
                                        <Label htmlFor="edit-county">County</Label>
                                        <Input
                                          id="edit-county"
                                          value={editingCustomer.county || ''}
                                          onChange={(e) => setEditingCustomer({ ...editingCustomer, county: e.target.value })}
                                        />
                                      </div>
                                      <div>
                                        <Label htmlFor="edit-postcode">Postcode</Label>
                                        <Input
                                          id="edit-postcode"
                                          value={editingCustomer.postcode || ''}
                                          onChange={(e) => setEditingCustomer({ ...editingCustomer, postcode: e.target.value })}
                                        />
                                      </div>
                                      <div>
                                        <Label htmlFor="edit-country">Country</Label>
                                        <Input
                                          id="edit-country"
                                          value={editingCustomer.country || ''}
                                          onChange={(e) => setEditingCustomer({ ...editingCustomer, country: e.target.value })}
                                        />
                                      </div>
                                    </div>
                                  </div>

                                  <div className="space-y-4 pt-4 border-t">
                                    <h3 className="text-lg font-semibold">Warranty & Payment Details</h3>
                                    <div className="space-y-4">
                                      <div>
                                        <Label className="mb-2 block">Plan Type</Label>
                                        <ToggleGroup 
                                          type="single" 
                                          value={editingCustomer.plan_type || 'Platinum'} 
                                          onValueChange={(value) => value && setEditingCustomer({ ...editingCustomer, plan_type: value })}
                                          className="justify-start flex-wrap gap-2"
                                        >
                                          <ToggleGroupItem value="Basic" className="px-4 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">Basic</ToggleGroupItem>
                                          <ToggleGroupItem value="Gold" className="px-4 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">Gold</ToggleGroupItem>
                                          <ToggleGroupItem value="Platinum" className="px-4 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">Platinum</ToggleGroupItem>
                                          <ToggleGroupItem value="Electric" className="px-4 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">Electric</ToggleGroupItem>
                                          <ToggleGroupItem value="PHEV" className="px-4 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">PHEV</ToggleGroupItem>
                                          <ToggleGroupItem value="Motorbike" className="px-4 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">Motorbike</ToggleGroupItem>
                                        </ToggleGroup>
                                      </div>

                                      <div>
                                        <Label className="mb-2 block">Duration</Label>
                                        <ToggleGroup 
                                          type="single" 
                                          value={editingCustomer.payment_type || '12months'} 
                                          onValueChange={(value) => {
                                            if (value) {
                                              setEditingCustomer({ ...editingCustomer, payment_type: value });
                                              
                                              // Auto-calculate expiry date
                                              if (editingCustomer.customer_policies?.[0]?.policy_start_date) {
                                                const startDate = new Date(editingCustomer.customer_policies[0].policy_start_date);
                                                const months = getWarrantyDurationInMonths(value);
                                                const expiry = new Date(startDate);
                                                expiry.setMonth(expiry.getMonth() + months);
                                                
                                                const updatedPolicies = [...(editingCustomer.customer_policies || [])];
                                                updatedPolicies[0] = {
                                                  ...updatedPolicies[0],
                                                  policy_end_date: expiry.toISOString()
                                                };
                                                setEditingCustomer({ ...editingCustomer, payment_type: value, customer_policies: updatedPolicies });
                                              }
                                            }
                                          }}
                                          className="justify-start flex-wrap gap-2"
                                        >
                                          <ToggleGroupItem value="3months" className="px-4 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">3 Months</ToggleGroupItem>
                                          <ToggleGroupItem value="6months" className="px-4 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">6 Months</ToggleGroupItem>
                                          <ToggleGroupItem value="12months" className="px-4 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">1 Year</ToggleGroupItem>
                                          <ToggleGroupItem value="24months" className="px-4 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">2 Years</ToggleGroupItem>
                                          <ToggleGroupItem value="36months" className="px-4 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">3 Years</ToggleGroupItem>
                                          <ToggleGroupItem value="48months" className="px-4 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">4 Years</ToggleGroupItem>
                                          <ToggleGroupItem value="60months" className="px-4 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">5 Years</ToggleGroupItem>
                                        </ToggleGroup>
                                      </div>

                                      <div>
                                        <Label className="mb-2 block">Voluntary Excess</Label>
                                        <ToggleGroup 
                                          type="single" 
                                          value={editingCustomer.voluntary_excess?.toString() || '0'} 
                                          onValueChange={(value) => value && setEditingCustomer({ ...editingCustomer, voluntary_excess: parseInt(value) })}
                                          className="justify-start flex-wrap gap-2"
                                        >
                                          <ToggleGroupItem value="0" className="px-4 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">£0</ToggleGroupItem>
                                          <ToggleGroupItem value="50" className="px-4 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">£50</ToggleGroupItem>
                                          <ToggleGroupItem value="100" className="px-4 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">£100</ToggleGroupItem>
                                          <ToggleGroupItem value="150" className="px-4 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">£150</ToggleGroupItem>
                                          <ToggleGroupItem value="200" className="px-4 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">£200</ToggleGroupItem>
                                        </ToggleGroup>
                                      </div>

                                      <div>
                                        <Label className="mb-2 block">Claim Limit</Label>
                                        <ToggleGroup 
                                          type="single" 
                                          value={editingCustomer.claim_limit?.toString() || '1250'} 
                                          onValueChange={(value) => value && setEditingCustomer({ ...editingCustomer, claim_limit: parseInt(value) })}
                                          className="justify-start flex-wrap gap-2"
                                        >
                                          <ToggleGroupItem value="750" className="px-4 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">£750</ToggleGroupItem>
                                          <ToggleGroupItem value="1250" className="px-4 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">£1,250</ToggleGroupItem>
                                          <ToggleGroupItem value="2000" className="px-4 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">£2,000</ToggleGroupItem>
                                          <ToggleGroupItem value="2500" className="px-4 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">£2,500</ToggleGroupItem>
                                          <ToggleGroupItem value="3000" className="px-4 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">£3,000</ToggleGroupItem>
                                          <ToggleGroupItem value="4000" className="px-4 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">£4,000</ToggleGroupItem>
                                          <ToggleGroupItem value="5000" className="px-4 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">£5,000</ToggleGroupItem>
                                        </ToggleGroup>
                                      </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4 pt-4">
                                      <div>
                                        <Label htmlFor="edit-original-amount">Original Amount (£)</Label>
                                        <Input
                                          id="edit-original-amount"
                                          type="number"
                                          step="0.01"
                                          value={editingCustomer.original_amount || ''}
                                          onChange={(e) => setEditingCustomer({ ...editingCustomer, original_amount: Number(e.target.value) })}
                                        />
                                      </div>
                                      <div>
                                        <Label htmlFor="edit-discount-amount">Discount Amount (£)</Label>
                                        <Input
                                          id="edit-discount-amount"
                                          type="number"
                                          step="0.01"
                                          value={editingCustomer.discount_amount || ''}
                                          onChange={(e) => setEditingCustomer({ ...editingCustomer, discount_amount: Number(e.target.value) })}
                                        />
                                      </div>
                                      <div>
                                        <Label htmlFor="edit-final-amount">Final Amount (£)</Label>
                                        <Input
                                          id="edit-final-amount"
                                          type="number"
                                          step="0.01"
                                          value={editingCustomer.final_amount || ''}
                                          onChange={(e) => setEditingCustomer({ ...editingCustomer, final_amount: Number(e.target.value) })}
                                        />
                                      </div>
                                      <div>
                                        <Label htmlFor="edit-discount-code">Discount Code</Label>
                                        <Input
                                          id="edit-discount-code"
                                          value={editingCustomer.discount_code || ''}
                                          onChange={(e) => setEditingCustomer({ ...editingCustomer, discount_code: e.target.value })}
                                        />
                                      </div>
                                      <div>
                                        <Label htmlFor="edit-status">Status</Label>
                                        <Select
                                          value={editingCustomer.status}
                                          onValueChange={(value) => setEditingCustomer({ ...editingCustomer, status: value })}
                                        >
                                          <SelectTrigger id="edit-status">
                                            <SelectValue placeholder="Select status" />
                                          </SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value="Active">Active</SelectItem>
                                            <SelectItem value="Inactive">Inactive</SelectItem>
                                            <SelectItem value="Pending">Pending</SelectItem>
                                          </SelectContent>
                                        </Select>
                                      </div>
                                      <div>
                                        <Label htmlFor="edit-signup-date">Signup Date</Label>
                                        <Popover>
                                          <PopoverTrigger asChild>
                                            <Button
                                              id="edit-signup-date"
                                              variant="outline"
                                              className={cn(
                                                "w-full justify-start text-left font-normal",
                                                !editingCustomer.signup_date && "text-muted-foreground"
                                              )}
                                            >
                                              <CalendarIcon className="mr-2 h-4 w-4" />
                                              {editingCustomer.signup_date ? (
                                                format(new Date(editingCustomer.signup_date), 'dd/MM/yyyy')
                                              ) : (
                                                <span>Pick a date</span>
                                              )}
                                            </Button>
                                          </PopoverTrigger>
                                          <PopoverContent className="w-auto p-0" align="start">
                                            <Calendar
                                              mode="single"
                                              selected={editingCustomer.signup_date ? new Date(editingCustomer.signup_date) : undefined}
                                              onSelect={(date) => date && setEditingCustomer({ ...editingCustomer, signup_date: date.toISOString() })}
                                              initialFocus
                                            />
                                          </PopoverContent>
                                        </Popover>
                                      </div>
                                       <div>
                                        <Label>Purchase Date</Label>
                                        <div className="w-full px-3 py-2 text-sm border rounded-md bg-gray-50">
                                          {editingCustomer.customer_policies?.[0]?.created_at ? (
                                            <>
                                              {format(new Date(editingCustomer.customer_policies[0].created_at), 'dd/MM/yyyy')}
                                              <span className="text-gray-500 ml-2">
                                                {format(new Date(editingCustomer.customer_policies[0].created_at), 'HH:mm:ss')}
                                              </span>
                                            </>
                                          ) : editingCustomer.created_at ? (
                                            <>
                                              {format(new Date(editingCustomer.created_at), 'dd/MM/yyyy')}
                                              <span className="text-gray-500 ml-2">
                                                {format(new Date(editingCustomer.created_at), 'HH:mm:ss')}
                                              </span>
                                            </>
                                          ) : (
                                            <span className="text-gray-400">N/A</span>
                                          )}
                                        </div>
                                      </div>
                                      <div>
                                        <Label htmlFor="edit-start-date">Warranty Start Date</Label>
                                        <Input
                                          id="edit-start-date"
                                          type="date"
                                          value={editingCustomer.customer_policies?.[0]?.policy_start_date 
                                            ? new Date(editingCustomer.customer_policies[0].policy_start_date).toISOString().split('T')[0]
                                            : ''}
                                          onChange={(e) => {
                                            if (editingCustomer.customer_policies && editingCustomer.customer_policies[0]) {
                                              const startDate = new Date(e.target.value);
                                              const months = getWarrantyDurationInMonths(editingCustomer.payment_type || '12months');
                                              const expiry = new Date(startDate);
                                              expiry.setMonth(expiry.getMonth() + months);
                                              
                                              const updatedPolicies = [...editingCustomer.customer_policies];
                                              updatedPolicies[0] = {
                                                ...updatedPolicies[0],
                                                policy_start_date: e.target.value,
                                                policy_end_date: expiry.toISOString()
                                              };
                                              setEditingCustomer({ ...editingCustomer, customer_policies: updatedPolicies });
                                            }
                                          }}
                                        />
                                      </div>
                                      <div>
                                        <Label htmlFor="edit-expiry-date">Warranty Expiry Date</Label>
                                        <Input
                                          id="edit-expiry-date"
                                          type="date"
                                          value={editingCustomer.customer_policies?.[0]?.policy_end_date 
                                            ? new Date(editingCustomer.customer_policies[0].policy_end_date).toISOString().split('T')[0]
                                            : ''}
                                          onChange={(e) => {
                                            if (editingCustomer.customer_policies && editingCustomer.customer_policies[0]) {
                                              const updatedPolicies = [...editingCustomer.customer_policies];
                                              updatedPolicies[0] = {
                                                ...updatedPolicies[0],
                                                policy_end_date: e.target.value
                                              };
                                              setEditingCustomer({ ...editingCustomer, customer_policies: updatedPolicies });
                                            }
                                          }}
                                        />
                                      </div>
                                    </div>
                                  </div>
                                  
                                  <div className="space-y-4 pt-4 border-t">
                                    <h3 className="text-lg font-semibold">Add-On Protections</h3>
                                    <div className="grid grid-cols-2 gap-4">
                                      <div className="flex items-center space-x-2">
                                        <Checkbox 
                                          id="edit-mot-fee"
                                          checked={editingCustomer.mot_fee || false}
                                          onCheckedChange={(checked) => setEditingCustomer({ ...editingCustomer, mot_fee: !!checked })}
                                        />
                                        <Label htmlFor="edit-mot-fee" className="font-normal cursor-pointer">MOT Test Fee Cover</Label>
                                      </div>
                                      <div className="flex items-center space-x-2">
                                        <Checkbox 
                                          id="edit-breakdown-recovery"
                                          checked={editingCustomer.breakdown_recovery || false}
                                          onCheckedChange={(checked) => setEditingCustomer({ ...editingCustomer, breakdown_recovery: !!checked })}
                                        />
                                        <Label htmlFor="edit-breakdown-recovery" className="font-normal cursor-pointer">Breakdown Recovery</Label>
                                      </div>
                                      <div className="flex items-center space-x-2">
                                        <Checkbox 
                                          id="edit-tyre-cover"
                                          checked={editingCustomer.tyre_cover || false}
                                          onCheckedChange={(checked) => setEditingCustomer({ ...editingCustomer, tyre_cover: !!checked })}
                                        />
                                        <Label htmlFor="edit-tyre-cover" className="font-normal cursor-pointer">Tyre Cover</Label>
                                      </div>
                                      <div className="flex items-center space-x-2">
                                        <Checkbox 
                                          id="edit-wear-tear"
                                          checked={editingCustomer.wear_tear || false}
                                          onCheckedChange={(checked) => setEditingCustomer({ ...editingCustomer, wear_tear: !!checked })}
                                        />
                                        <Label htmlFor="edit-wear-tear" className="font-normal cursor-pointer">Wear & Tear Cover</Label>
                                      </div>
                                      <div className="flex items-center space-x-2">
                                        <Checkbox 
                                          id="edit-europe-cover"
                                          checked={editingCustomer.europe_cover || false}
                                          onCheckedChange={(checked) => setEditingCustomer({ ...editingCustomer, europe_cover: !!checked })}
                                        />
                                        <Label htmlFor="edit-europe-cover" className="font-normal cursor-pointer">Europe Cover</Label>
                                      </div>
                                      <div className="flex items-center space-x-2">
                                        <Checkbox 
                                          id="edit-vehicle-rental"
                                          checked={editingCustomer.vehicle_rental || false}
                                          onCheckedChange={(checked) => setEditingCustomer({ ...editingCustomer, vehicle_rental: !!checked })}
                                        />
                                        <Label htmlFor="edit-vehicle-rental" className="font-normal cursor-pointer">Vehicle Rental</Label>
                                      </div>
                                      <div className="flex items-center space-x-2">
                                        <Checkbox 
                                          id="edit-transfer-cover"
                                          checked={editingCustomer.transfer_cover || false}
                                          onCheckedChange={(checked) => setEditingCustomer({ ...editingCustomer, transfer_cover: !!checked })}
                                        />
                                        <Label htmlFor="edit-transfer-cover" className="font-normal cursor-pointer">Transfer Cover</Label>
                                      </div>
                                      <div className="flex items-center space-x-2">
                                        <Checkbox 
                                          id="edit-mot-repair"
                                          checked={editingCustomer.mot_repair || false}
                                          onCheckedChange={(checked) => setEditingCustomer({ ...editingCustomer, mot_repair: !!checked })}
                                        />
                                        <Label htmlFor="edit-mot-repair" className="font-normal cursor-pointer">MOT Repair</Label>
                                      </div>
                                      <div className="flex items-center space-x-2">
                                        <Checkbox 
                                          id="edit-lost-key"
                                          checked={editingCustomer.lost_key || false}
                                          onCheckedChange={(checked) => setEditingCustomer({ ...editingCustomer, lost_key: !!checked })}
                                        />
                                        <Label htmlFor="edit-lost-key" className="font-normal cursor-pointer">Lost Key Cover</Label>
                                      </div>
                                      <div className="flex items-center space-x-2">
                                        <Checkbox 
                                          id="edit-consequential"
                                          checked={editingCustomer.consequential || false}
                                          onCheckedChange={(checked) => setEditingCustomer({ ...editingCustomer, consequential: !!checked })}
                                        />
                                        <Label htmlFor="edit-consequential" className="font-normal cursor-pointer">Consequential Loss</Label>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Customer Dashboard Access */}
                                  <div className="space-y-4 pt-6 border-t">
                                    <div className="flex items-center gap-2 mb-4">
                                      <User className="h-5 w-5" />
                                      <h3 className="text-lg font-semibold">Customer Dashboard Access</h3>
                                    </div>
                                    
                                    <div className="bg-muted/50 p-4 rounded-lg">
                                      <p className="text-sm text-muted-foreground">
                                        Set up dashboard credentials to test customer login before they receive their welcome email.
                                      </p>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                      <div>
                                        <Label htmlFor="edit-dashboard-email">Dashboard Email</Label>
                                        <Input
                                          id="edit-dashboard-email"
                                          type="email"
                                          value={editingCustomer.email || ''}
                                          onChange={(e) => setEditingCustomer({ ...editingCustomer, email: e.target.value })}
                                          placeholder="customer@example.com"
                                        />
                                      </div>
                                      <div>
                                        <Label htmlFor="edit-temp-password">Temporary Password</Label>
                                        <Input
                                          id="edit-temp-password"
                                          type="text"
                                          value={editingCustomer.temporary_password || ''}
                                          onChange={(e) => setEditingCustomer({ ...editingCustomer, temporary_password: e.target.value })}
                                          placeholder="temp-password-123"
                                        />
                                      </div>
                                    </div>
                                  </div>
                                  
                                  <div className="flex justify-end space-x-2 pt-4">
                                    <Button onClick={updateCustomer}>
                                      <Save className="h-4 w-4 mr-2" />
                                      Save Changes
                                    </Button>
                                  </div>
                                </TabsContent>

                                <TabsContent value="warranty">
                                  {editingCustomer.customer_policies && editingCustomer.customer_policies.length > 0 ? (
                                    <div className="space-y-4">
                                      {/* Last Sent Info & Action Buttons */}
                                      <div className="space-y-3">
                                        {editingCustomer.customer_policies[0]?.warranties_2000_sent_at && (
                                          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                                            <div className="flex items-center gap-2 text-sm">
                                              <Clock className="h-4 w-4 text-blue-600" />
                                              <span className="font-medium text-blue-900">Last sent to Warranties 2000:</span>
                                              <span className="text-blue-700">
                                                {new Date(editingCustomer.customer_policies[0].warranties_2000_sent_at).toLocaleString('en-GB', {
                                                  day: '2-digit',
                                                  month: 'short',
                                                  year: 'numeric',
                                                  hour: '2-digit',
                                                  minute: '2-digit'
                                                })}
                                              </span>
                                            </div>
                                          </div>
                                        )}
                                        
                                        <div className="flex justify-between items-center gap-2">
                                          <Button 
                                            onClick={() => {
                                              if (editingCustomer.customer_policies[0]?.id) {
                                                if (confirm('⚠️ WARNING: Warranties 2000 should only receive ONE submission per warranty.\n\nOnly resend if you have updated critical information that must be corrected in their system.\n\nContinue with manual resend?')) {
                                                  handleSendToWarranties2000(
                                                    editingCustomer.customer_policies[0].id,
                                                    editingCustomer.id,
                                                    true // Force resend - overrides duplicate check
                                                  );
                                                }
                                              }
                                            }}
                                            variant="outline"
                                            className="flex items-center gap-2 border-orange-300 hover:bg-orange-50 hover:border-orange-400"
                                            disabled={emailSendingLoading[editingCustomer.id]?.warranties2000}
                                          >
                                            {emailSendingLoading[editingCustomer.id]?.warranties2000 ? (
                                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-orange-600"></div>
                                            ) : (
                                              <Send className="h-4 w-4 text-orange-600" />
                                            )}
                                            <span className="text-orange-600">Manual Resend to Warranties 2000</span>
                                          </Button>
                                          <EditOrderButton 
                                            customer={editingCustomer}
                                            policy={editingCustomer.customer_policies[0]}
                                          />
                                        </div>
                                      </div>
                                      
                                      {editingCustomer.customer_policies.map((policy: any, index: number) => (
                                        <Card key={index} className="p-4">
                                          <div className="grid grid-cols-2 gap-4">
                                            <div>
                                              <Label className="text-sm font-medium text-gray-500">Warranty Number</Label>
                                              <p className="text-sm font-semibold">{policy.warranty_number || 'N/A'}</p>
                                            </div>
                                            <div>
                                              <Label className="text-sm font-medium text-gray-500">Policy Number</Label>
                                              <p className="text-sm">{policy.policy_number || 'N/A'}</p>
                                            </div>
                                            <div>
                                              <Label className="text-sm font-medium text-gray-500">Start Date</Label>
                                              <p className="text-sm">{policy.start_date ? format(new Date(policy.start_date), 'dd/MM/yyyy') : 'N/A'}</p>
                                            </div>
                                            <div>
                                              <Label className="text-sm font-medium text-gray-500">Expiry Date</Label>
                                              <p className="text-sm">{policy.expiry_date ? format(new Date(policy.expiry_date), 'dd/MM/yyyy') : 'N/A'}</p>
                                            </div>
                                            <div>
                                              <Label className="text-sm font-medium text-gray-500">Payment Type</Label>
                                              <p className="text-sm">{policy.payment_type || 'N/A'}</p>
                                            </div>
                                            <div>
                                              <Label className="text-sm font-medium text-gray-500">Payment Status</Label>
                                              <Badge variant={policy.payment_status === 'paid' ? 'default' : 'destructive'}>
                                                {policy.payment_status}
                                              </Badge>
                                            </div>
                                            <div>
                                              <Label className="text-sm font-medium text-gray-500">Policy Status</Label>
                                              <Badge variant={policy.status === 'active' ? 'default' : policy.status === 'cancelled' ? 'destructive' : 'secondary'}>
                                                {policy.status || 'active'}
                                              </Badge>
                                            </div>
                                            <div className="col-span-2">
                                              <Label className="text-sm font-medium text-gray-500 mb-2 block">Coverage Details</Label>
                                              <CoverageDetailsDisplay 
                                                mot_fee={editingCustomer.mot_fee}
                                                tyre_cover={editingCustomer.tyre_cover}
                                                wear_tear={editingCustomer.wear_tear}
                                                europe_cover={editingCustomer.europe_cover}
                                                transfer_cover={editingCustomer.transfer_cover}
                                                breakdown_recovery={editingCustomer.breakdown_recovery}
                                                vehicle_rental={editingCustomer.vehicle_rental}
                                                mot_repair={editingCustomer.mot_repair}
                                                lost_key={editingCustomer.lost_key}
                                                consequential={editingCustomer.consequential}
                                              />
                                            </div>
                                            <div className="col-span-2">
                                              <Label className="text-sm font-medium text-gray-500 mb-2 block">Add-On Protections</Label>
                                              <AddOnProtectionDisplay 
                                                mot_fee={policy.mot_fee}
                                                tyre_cover={policy.tyre_cover}
                                                wear_tear={policy.wear_tear}
                                                europe_cover={policy.europe_cover}
                                                transfer_cover={policy.transfer_cover}
                                                breakdown_recovery={policy.breakdown_recovery}
                                                vehicle_rental={policy.vehicle_rental}
                                                mot_repair={policy.mot_repair}
                                                lost_key={policy.lost_key}
                                                consequential={policy.consequential}
                                                payment_type={editingCustomer.payment_type || 'monthly'}
                                              />
                                            </div>
                                            <div className="col-span-2 pt-4 border-t">
                                              <div className="flex items-center justify-between">
                                                <div>
                                                  <Label className="text-sm font-medium text-gray-700">Warranty Management</Label>
                                                  <p className="text-xs text-gray-500 mt-1">
                                                    {policy.status === 'cancelled' 
                                                      ? 'This warranty has been cancelled and is inactive'
                                                      : 'Cancel this warranty if it needs to be voided or deactivated'}
                                                  </p>
                                                </div>
                                                {policy.status !== 'cancelled' ? (
                                                  <Button
                                                    variant="destructive"
                                                    size="sm"
                                                    onClick={async () => {
                                                      if (!confirm('Are you sure you want to cancel this warranty? This action will mark it as inactive for the customer.')) return;
                                                      
                                                      try {
                                                        const { error } = await supabase
                                                          .from('customer_policies')
                                                          .update({ status: 'cancelled' })
                                                          .eq('id', policy.id);

                                                        if (error) throw error;

                                                        toast.success('Warranty cancelled successfully');
                                                        fetchCustomers(); // Refresh data
                                                      } catch (error) {
                                                        console.error('Error cancelling warranty:', error);
                                                        toast.error('Failed to cancel warranty');
                                                      }
                                                    }}
                                                  >
                                                    Cancel Warranty
                                                  </Button>
                                                ) : (
                                                  <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={async () => {
                                                      if (!confirm('Are you sure you want to reactivate this warranty?')) return;
                                                      
                                                      try {
                                                        const { error } = await supabase
                                                          .from('customer_policies')
                                                          .update({ status: 'active' })
                                                          .eq('id', policy.id);

                                                        if (error) throw error;

                                                        toast.success('Warranty reactivated successfully');
                                                        fetchCustomers(); // Refresh data
                                                      } catch (error) {
                                                        console.error('Error reactivating warranty:', error);
                                                        toast.error('Failed to reactivate warranty');
                                                      }
                                                    }}
                                                  >
                                                    Reactivate Warranty
                                                  </Button>
                                                )}
                                              </div>
                                            </div>
                                          </div>
                                        </Card>
                                      ))}
                                      
                                      {/* Warranties 2000 Submission History */}
                                      {editingCustomer.customer_policies[0]?.id && (
                                        <W2KAuditLog policyId={editingCustomer.customer_policies[0].id} />
                                      )}
                                    </div>
                                  ) : (
                                    <div className="text-center text-gray-500 py-8">
                                      No warranty policies found for this customer
                                    </div>
                                  )}
                                </TabsContent>

                                <TabsContent value="tags">
                                  {selectedCustomer && (
                                    <div className="space-y-4">
                                      <div>
                                        <h3 className="text-lg font-semibold mb-2">Customer Tags</h3>
                                        <p className="text-sm text-muted-foreground mb-4">
                                          Manage tags to organize and track customer status, payment info, and follow-ups.
                                        </p>
                                        <CustomerTagsManager 
                                          customerId={selectedCustomer.id}
                                          onTagsUpdate={fetchCustomers}
                                        />
                                      </div>
                                    </div>
                                  )}
                                </TabsContent>

                                <TabsContent value="notes">
                                  {selectedCustomer && (
                                    <CustomerNotesSection customerId={selectedCustomer.id} />
                                  )}
                                </TabsContent>

                                <TabsContent value="actions">
                                  {selectedCustomer && (
                                    <WarrantyActions 
                                      customerId={selectedCustomer.id}
                                      customerEmail={selectedCustomer.email}
                                      policyId={selectedCustomer.customer_policies?.[0]?.id}
                                      warrantyNumber={selectedCustomer.customer_policies?.[0]?.warranty_number}
                                      emailStatus={selectedCustomer.customer_policies?.[0]?.email_sent_status}
                                      warranties2000Status={selectedCustomer.customer_policies?.[0]?.warranties_2000_status}
                                      onActionComplete={fetchCustomers}
                                    />
                                  )}
                                </TabsContent>

                                <TabsContent value="mot">
                                  {selectedCustomer && (
                                    <MOTHistorySection 
                                      registrationNumber={selectedCustomer.registration_plate}
                                      customerId={selectedCustomer.id}
                                    />
                                  )}
                                </TabsContent>

                                <TabsContent value="w2000">
                                  {selectedCustomer && (
                                    <W2000DataPreview 
                                      customer={selectedCustomer}
                                    />
                                  )}
                                </TabsContent>
                              </Tabs>
                            </>
                          )}
                        </DialogContent>
                      </Dialog>
                      <div className="flex items-center justify-between gap-2 w-full">
                        <span className="font-medium">{customer.name}</span>
                        <InlineCustomerTags 
                          customerId={customer.id} 
                          onTagsUpdate={fetchCustomers}
                        />
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{customer.email}</TableCell>
                  <TableCell>{customer.phone || 'N/A'}</TableCell>
                  <TableCell>
                    <NumberPlate plateNumber={customer.registration_plate} />
                  </TableCell>
                  <TableCell className="font-medium">
                    <div className="flex items-center space-x-2">
                      <span className={customer.vehicle_make ? 'text-gray-900' : 'text-gray-400'}>
                        {customer.vehicle_make || 'N/A'}
                      </span>
                      {!customer.vehicle_make && (
                        <Badge variant="outline" className="text-xs bg-yellow-50 text-yellow-700 border-yellow-200">
                          Missing
                        </Badge>
                      )}
                      {customer.vehicle_make && (
                        <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                          DVLA
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">
                    <div className="flex items-center space-x-2">
                      <span className={customer.vehicle_model ? 'text-gray-900' : 'text-gray-400'}>
                        {customer.vehicle_model || 'N/A'}
                      </span>
                      {!customer.vehicle_model && (
                        <Badge variant="outline" className="text-xs bg-yellow-50 text-yellow-700 border-yellow-200">
                          Missing
                        </Badge>
                      )}
                      {customer.vehicle_model && (
                        <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                          DVLA
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <span className={customer.vehicle_year ? 'text-gray-900' : 'text-gray-400'}>
                      {customer.vehicle_year || 'N/A'}
                    </span>
                  </TableCell>
                  <TableCell className="max-w-xs truncate">
                    {customer.street || customer.town || customer.postcode 
                      ? `${customer.street || ''} ${customer.town || ''} ${customer.postcode || ''}`.trim()
                      : 'N/A'
                    }
                  </TableCell>
                   <TableCell>
                     <Badge variant="secondary">{getWarrantyType(customer.plan_type)}</Badge>
                   </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className="font-mono">
                        {getWarrantyDurationInMonths(customer.payment_type || '')} months
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      {customer.customer_policies?.[0]?.policy_start_date || customer.signup_date ? (
                        <div className="text-sm">
                          {format(
                            calculateExpiryDate(
                              customer.customer_policies?.[0]?.policy_start_date || customer.signup_date,
                              customer.payment_type || ''
                           ), 
                           'dd/MM/yyyy'
                         )}
                       </div>
                     ) : (
                       <span className="text-gray-400">N/A</span>
                     )}
                   </TableCell>
                     <TableCell>
                       <Badge variant="outline">
                         {customer.bumper_order_id ? 'Bumper' : 
                          customer.stripe_session_id ? 'Stripe' : 'N/A'}
                       </Badge>
                     </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="bg-blue-50 text-blue-700">
                          £{customer.voluntary_excess || 0}
                        </Badge>
                      </TableCell>
                       <TableCell>
                         <Badge variant="outline" className="bg-green-50 text-green-700">
                           £{(customer.customer_policies?.[0] as any)?.claim_limit || customer.claim_limit || 1250}
                         </Badge>
                       </TableCell>
                       <TableCell>
                         <CustomerTagsDisplay customerId={customer.id} maxVisible={2} />
                       </TableCell>
                    <TableCell className="font-mono text-sm">
                    {customer.warranty_reference_number || customer.warranty_number ? (
                      <div className="bg-green-50 px-2 py-1 rounded border">
                        {customer.warranty_reference_number || customer.warranty_number}
                      </div>
                    ) : (
                      <span className="text-gray-400">No Reference</span>
                    )}
                  </TableCell>
                   <TableCell>
                     <div className="flex items-center gap-2">
                       {customer.customer_policies?.[0]?.email_sent_status === 'sent' ? (
                         <Badge variant="secondary" className="bg-green-100 text-green-800">
                           <CheckCircle className="w-3 h-3 mr-1" />
                           Sent
                         </Badge>
                       ) : customer.customer_policies?.[0]?.email_sent_status === 'failed' ? (
                         <Badge variant="destructive" className="bg-red-100 text-red-800">
                           <AlertCircle className="w-3 h-3 mr-1" />
                           Failed
                         </Badge>
                       ) : (
                         <Badge variant="outline" className="bg-gray-100 text-gray-800">
                           <Clock className="w-3 h-3 mr-1" />
                           Not Sent
                         </Badge>
                       )}
                       
                       {customer.customer_policies?.[0]?.id && (
                         <Button
                           variant="ghost"
                           size="sm"
                           onClick={() => handleSendWelcomeEmail(customer.customer_policies[0].id, customer.id)}
                           disabled={emailSendingLoading[customer.id]?.email}
                           title="Send Welcome Email"
                           className="hover:bg-blue-50 hover:text-blue-600"
                         >
                           {emailSendingLoading[customer.id]?.email ? (
                             <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600"></div>
                           ) : (
                             <Send className="h-3 w-3" />
                           )}
                         </Button>
                       )}
                     </div>
                   </TableCell>
                   <TableCell>
                     <div className="flex items-center gap-2">
                       {customer.customer_policies?.[0]?.warranties_2000_status === 'sent' ? (
                         <Badge variant="secondary" className="bg-green-100 text-green-800">
                           <CheckCircle className="w-3 h-3 mr-1" />
                           Sent
                         </Badge>
                       ) : customer.customer_policies?.[0]?.warranties_2000_status === 'failed' ? (
                         <Badge variant="destructive" className="bg-red-100 text-red-800">
                           <AlertCircle className="w-3 h-3 mr-1" />
                           Failed
                         </Badge>
                       ) : (
                         <Badge variant="outline" className="bg-gray-100 text-gray-800">
                           <Clock className="w-3 h-3 mr-1" />
                           Not Sent
                         </Badge>
                       )}
                       
                       {customer.customer_policies?.[0]?.id && (
                         <Button
                           variant="ghost"
                           size="sm"
                           onClick={() => handleSendToWarranties2000(customer.customer_policies[0].id, customer.id)}
                           disabled={emailSendingLoading[customer.id]?.warranties2000}
                           title="Send to Warranties 2000"
                           className="hover:bg-purple-50 hover:text-purple-600"
                         >
                           {emailSendingLoading[customer.id]?.warranties2000 ? (
                             <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-purple-600"></div>
                           ) : (
                             <Send className="h-3 w-3" />
                           )}
                         </Button>
                       )}
                     </div>
                   </TableCell>
                  <TableCell>
                    <Badge variant={customer.status === 'Active' ? 'default' : 'destructive'}>
                      {customer.status}
                    </Badge>
                   </TableCell>
                    <TableCell>
                      <div className="flex flex-col space-y-1">
                        {customer.assigned_to ? (
                          <div className="flex items-center justify-between">
                            <div className="flex flex-col">
                              <span className="text-xs text-gray-500">Assigned to</span>
                              <span className="text-sm font-medium text-gray-900">
                                {customer.admin_users ? 
                                  `${customer.admin_users.first_name || ''} ${customer.admin_users.last_name || ''}`.trim() || customer.admin_users.email :
                                  'Unknown User'
                                }
                              </span>
                            </div>
                            {currentAdminUser?.id === customer.assigned_to && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => unassignCustomer(customer.id)}
                                disabled={assignmentLoading[customer.id]}
                                className="p-1 h-6 w-6 text-gray-400 hover:text-red-600"
                                title="Unassign from me"
                              >
                                <UserX className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => assignCustomerToMe(customer.id)}
                            disabled={assignmentLoading[customer.id]}
                            className="text-xs py-1 h-6"
                          >
                            {assignmentLoading[customer.id] ? (
                              <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-gray-400"></div>
                            ) : (
                              'Assign to me'
                            )}
                          </Button>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                     <div className="flex space-x-2">
                        {/* DVLA Vehicle Data Refresh */}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => refreshVehicleDataFromDVLA(customer.id, customer.registration_plate)}
                          disabled={dvlaLookupLoading[customer.id] || !customer.registration_plate}
                          title="Refresh Vehicle Data from DVLA"
                          className="hover:bg-green-50 hover:text-green-600"
                        >
                          {dvlaLookupLoading[customer.id] ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-600"></div>
                          ) : (
                            <RefreshCw className="h-4 w-4" />
                          )}
                        </Button>


                        {isAdmin() && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteCustomer(customer.id, customer.name)}
                            className="text-red-600 hover:text-red-800 hover:bg-red-50"
                            title="Delete Customer"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                       
                       <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => resetCustomerPassword(customer.id, customer.email)}
                        disabled={passwordResetLoading[customer.id]}
                        title="Generate New Password"
                        className="hover:bg-orange-50 hover:text-orange-600"
                      >
                        {passwordResetLoading[customer.id] ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-orange-600"></div>
                        ) : (
                          <Key className="h-4 w-4" />
                        )}
                      </Button>
                      
                      
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
          </div>
        </div>
        </TabsContent>

        <TabsContent value="deleted" className="space-y-4">
          {/* Info Banner for Deleted Orders */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <Archive className="h-5 w-5 text-amber-600 mt-0.5" />
              <div>
                <h3 className="font-semibold text-amber-900 mb-1">Order Archive</h3>
                <p className="text-sm text-amber-700">
                  These orders have been deleted but can be restored anytime. Orders remain in the archive until permanently removed.
                </p>
              </div>
            </div>
          </div>

          {/* Search */}
          <div className="bg-white p-4 rounded-lg border">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search deleted orders..."
                value={deletedSearchTerm}
                onChange={(e) => {
                  setDeletedSearchTerm(e.target.value);
                  const filtered = deletedCustomers.filter(customer =>
                    customer.name.toLowerCase().includes(e.target.value.toLowerCase()) ||
                    customer.email.toLowerCase().includes(e.target.value.toLowerCase()) ||
                    customer.registration_plate?.toLowerCase().includes(e.target.value.toLowerCase())
                  );
                  setFilteredDeletedCustomers(filtered);
                }}
                className="pl-10"
              />
            </div>
          </div>

          {deletedLoading ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600"></div>
              <span className="ml-2">Loading archived orders...</span>
            </div>
          ) : filteredDeletedCustomers.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-8">
              <div className="text-center space-y-4">
                <Archive className="h-12 w-12 text-gray-400 mx-auto" />
                <div>
                  <p className="text-gray-500 text-lg">No archived orders</p>
                  <p className="text-gray-400 text-sm mt-2">
                    {deletedSearchTerm ? 'No orders match your search' : 'Deleted orders will appear here'}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Registration</TableHead>
                      <TableHead>Plan Type</TableHead>
                      <TableHead>Deleted Date</TableHead>
                      <TableHead>Deleted By</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredDeletedCustomers.map((customer) => (
                      <TableRow key={customer.id} className="bg-gray-50">
                        <TableCell className="font-medium">{customer.name}</TableCell>
                        <TableCell>{customer.email}</TableCell>
                        <TableCell>
                          <NumberPlate plateNumber={customer.registration_plate} />
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{customer.plan_type}</Badge>
                        </TableCell>
                        <TableCell>
                          {customer.deleted_at ? format(new Date(customer.deleted_at), 'dd/MM/yyyy HH:mm') : 'N/A'}
                        </TableCell>
                        <TableCell>
                          {customer.admin_users ? (
                            <span className="text-sm">
                              {customer.admin_users.first_name} {customer.admin_users.last_name}
                            </span>
                          ) : (
                            <span className="text-gray-400 text-sm">System</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => restoreCustomer(customer.id, customer.name)}
                            disabled={restoreLoading[customer.id]}
                            className="text-green-600 hover:text-green-700 hover:bg-green-50"
                          >
                            {restoreLoading[customer.id] ? (
                              <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-green-600 mr-2"></div>
                            ) : (
                              <RotateCcw className="h-3 w-3 mr-2" />
                            )}
                            Restore
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="incomplete" className="space-y-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
            <div className="flex items-start space-x-3">
              <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
              <div>
                <h3 className="font-semibold text-red-900 mb-1">Incomplete Customers</h3>
                <p className="text-sm text-red-700">
                  These customers started but didn't complete their purchase. Follow up to help them finish their order.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between space-x-4">
            <div className="flex items-center space-x-4 flex-1">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search incomplete customers..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    if (e.target.value) {
                      const filtered = incompleteCustomers.filter(customer =>
                        customer.email.toLowerCase().includes(e.target.value.toLowerCase()) ||
                        customer.full_name?.toLowerCase().includes(e.target.value.toLowerCase()) ||
                        customer.vehicle_reg?.toLowerCase().includes(e.target.value.toLowerCase())
                      );
                      setFilteredIncompleteCustomers(filtered);
                    } else {
                      setFilteredIncompleteCustomers(incompleteCustomers);
                    }
                  }}
                  className="pl-10"
                />
              </div>
              <Button 
                onClick={fetchIncompleteCustomers} 
                variant="outline"
                className="flex items-center space-x-2"
              >
                <RefreshCw className="h-4 w-4" />
                <span>Refresh</span>
              </Button>
            </div>
            
            {selectedIncompleteCustomers.length > 0 && (
              <div className="flex items-center space-x-2">
                <span className="text-sm font-medium text-gray-700">
                  {selectedIncompleteCustomers.length} selected
                </span>
                <Button
                  onClick={sendBulkReminderEmails}
                  variant="default"
                  size="sm"
                  className="flex items-center space-x-2"
                >
                  <Mail className="h-4 w-4" />
                  <span>Send Reminder Emails</span>
                </Button>
                <Select onValueChange={updateBulkContactStatus}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Update Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="contacted">Mark as Contacted</SelectItem>
                    <SelectItem value="follow_up">Mark as Follow-up Done</SelectItem>
                    <SelectItem value="not_contacted">Mark as Not Contacted</SelectItem>
                  </SelectContent>
                </Select>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="destructive"
                      size="sm"
                      className="flex items-center space-x-2"
                    >
                      <Trash2 className="h-4 w-4" />
                      <span>Delete</span>
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete {selectedIncompleteCustomers.length} Incomplete Customer{selectedIncompleteCustomers.length > 1 ? 's' : ''}?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently delete {selectedIncompleteCustomers.length} incomplete customer record{selectedIncompleteCustomers.length > 1 ? 's' : ''}. This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleBulkDeleteIncompleteCustomers}
                        className="bg-red-600 hover:bg-red-700"
                      >
                        Delete {selectedIncompleteCustomers.length} Customer{selectedIncompleteCustomers.length > 1 ? 's' : ''}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            )}
          </div>

          <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">
                    <Checkbox
                      checked={selectedIncompleteCustomers.length === filteredIncompleteCustomers.length && filteredIncompleteCustomers.length > 0}
                      onCheckedChange={toggleSelectAll}
                      aria-label="Select all customers"
                    />
                  </TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Contact Status</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Vehicle</TableHead>
                  <TableHead>Mileage</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Step Abandoned</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {incompleteLoading ? (
                  <TableRow>
                    <TableCell colSpan={11} className="text-center py-8">
                      <div className="flex justify-center items-center">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-orange-600"></div>
                        <span className="ml-2">Loading incomplete customers...</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filteredIncompleteCustomers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={11} className="text-center py-8 text-gray-500">
                      No incomplete customers found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredIncompleteCustomers.map((customer) => {
                    const metadata = customer.cart_metadata || {};
                    const showDetails = customer.step_abandoned >= 3;
                    
                    return (
                    <TableRow key={customer.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedIncompleteCustomers.includes(customer.id)}
                          onCheckedChange={() => toggleSelectCustomer(customer.id)}
                          aria-label={`Select ${customer.full_name || customer.email}`}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {format(new Date(customer.created_at), 'MMM dd, yyyy')}
                        </div>
                        <div className="text-xs text-gray-500">
                          {format(new Date(customer.created_at), 'HH:mm')}
                        </div>
                      </TableCell>
                      <TableCell>{customer.phone || 'N/A'}</TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <div 
                            className={`w-3 h-3 rounded-full ${getContactStatusColor(customer.contact_status)}`}
                            title={getContactStatusText(customer.contact_status)}
                          />
                          <span className="text-xs">
                            {getContactStatusText(customer.contact_status)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{customer.full_name || 'Unknown'}</div>
                          {showDetails && metadata.selectedAddons && (
                            <div className="mt-1 text-xs text-gray-600">
                              {metadata.selectedAddons.length > 0 ? (
                                <div>Add-ons: {metadata.selectedAddons.join(', ')}</div>
                              ) : null}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <span>{customer.email}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={() => {
                              navigator.clipboard.writeText(customer.email);
                              toast.success('Email copied to clipboard');
                            }}
                            title="Copy email"
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div>{customer.vehicle_reg || 'N/A'}</div>
                          <div className="text-xs text-gray-500">
                            {customer.vehicle_make} {customer.vehicle_model} ({customer.vehicle_year})
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{customer.mileage || 'N/A'}</span>
                      </TableCell>
                      <TableCell>
                        <div>
                          <Badge variant="outline">
                            {customer.plan_name || 'N/A'}
                          </Badge>
                          {showDetails && customer.payment_type && (
                            <div className="text-xs text-gray-600 mt-1">
                              {customer.payment_type}
                            </div>
                          )}
                          {showDetails && metadata.finalPrice && (
                            <div className="text-xs font-semibold text-green-600 mt-1">
                              £{metadata.finalPrice}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={customer.step_abandoned === 1 ? 'destructive' : 'secondary'}>
                          Step {customer.step_abandoned}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button variant="ghost" size="sm" title="Generate Follow-up Email">
                                <FileText className="h-4 w-4" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-2xl">
                              <DialogHeader>
                                <DialogTitle>Follow-up Email Template</DialogTitle>
                              </DialogHeader>
                              <div className="space-y-4">
                                <div>
                                  <Label>Subject Line</Label>
                                  <Input 
                                    value="Your car's warranty is almost ready – just one more step!"
                                    readOnly
                                    className="bg-gray-50"
                                  />
                                </div>
                                <div>
                                  <Label>Email Body</Label>
                                  <Textarea
                                    value={`Hi ${customer.full_name?.split(' ')[0] || 'there'},

Just a quick reminder — you were moments away from securing your car warranty with Buy A Warranty, but it looks like the checkout wasn't completed.

We've saved your quote so you don't have to start over. It only takes a minute to finish, and your car will be covered in no time.

👉 https://buyawarranty.co.uk/

Need help or have a quick question? Just reply to this email or call us on 0330 229 5040 - we're here to help.
Don't wait too long — protect your car today and avoid unexpected repair bills.


Cheers,

The Buy A Warranty Team
📞 0330 229 5040
📧 info@buyawarranty.co.uk
🌐 www.buyawarranty.co.uk`}
                                    rows={15}
                                    className="font-mono text-sm"
                                  />
                                </div>
                                <Button
                                  onClick={() => {
                                    const emailText = `Hi ${customer.full_name?.split(' ')[0] || 'there'},

Just a quick reminder — you were moments away from securing your car warranty with Buy A Warranty, but it looks like the checkout wasn't completed.

We've saved your quote so you don't have to start over. It only takes a minute to finish, and your car will be covered in no time.

👉 https://buyawarranty.co.uk/

Need help or have a quick question? Just reply to this email or call us on 0330 229 5040 - we're here to help.
Don't wait too long — protect your car today and avoid unexpected repair bills.


Cheers,

The Buy A Warranty Team
📞 0330 229 5040
📧 info@buyawarranty.co.uk
🌐 www.buyawarranty.co.uk`;
                                    navigator.clipboard.writeText(emailText);
                                    toast.success('Email template copied to clipboard');
                                  }}
                                  className="w-full"
                                >
                                  <Copy className="h-4 w-4 mr-2" />
                                  Copy Email Template
                                </Button>
                              </div>
                            </DialogContent>
                          </Dialog>

                          <Dialog>
                            <DialogTrigger asChild>
                              <Button variant="ghost" size="sm" title="Contact Customer">
                                <Mail className="h-4 w-4" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Update Contact Status</DialogTitle>
                              </DialogHeader>
                              <div className="space-y-4">
                                <div>
                                  <Label>Contact Status</Label>
                                  <Select 
                                    defaultValue={customer.contact_status}
                                    onValueChange={(value) => {
                                      const notes = document.getElementById(`notes-${customer.id}`) as HTMLTextAreaElement;
                                      updateContactStatus(customer.id, value, notes?.value);
                                    }}
                                  >
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="not_contacted">Not Contacted</SelectItem>
                                      <SelectItem value="contacted">Contacted</SelectItem>
                                      <SelectItem value="follow_up">Follow-up Done</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div>
                                  <Label>Contact Notes</Label>
                                  <Textarea
                                    id={`notes-${customer.id}`}
                                    placeholder="Add notes about contact attempt..."
                                    defaultValue={customer.contact_notes || ''}
                                    rows={3}
                                  />
                                </div>
                              </div>
                            </DialogContent>
                          </Dialog>
                          
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            title="Call Customer"
                            onClick={() => window.open(`tel:${customer.phone}`)}
                            disabled={!customer.phone}
                          >
                            <Phone className="h-4 w-4" />
                          </Button>

                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                title="Delete incomplete customer"
                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Incomplete Customer?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This will permanently delete this incomplete customer record for {customer.full_name || customer.email}. This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDeleteIncompleteCustomer(customer.id)}
                                  className="bg-red-600 hover:bg-red-700"
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};
