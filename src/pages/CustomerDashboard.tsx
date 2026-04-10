import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { SEOHead } from '@/components/SEOHead';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { Calendar, FileText, User, Mail, Lock, MapPin, CreditCard, Eye, EyeOff, Phone, MessageSquare, Download, AlertCircle, CheckCircle, X, ArrowLeft, Search } from 'lucide-react';
import TrustpilotHeader from '@/components/TrustpilotHeader';
import { getWarrantyDurationDisplay, getPaymentTypeDisplay } from '@/lib/warrantyUtils';
import { getDisplayClaimLimitValue } from '@/lib/claimLimitTiers';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import CoverageDetailsDisplay from '@/components/CoverageDetailsDisplay';
import AddOnProtectionDisplay from '@/components/AddOnProtectionDisplay';
import { NotificationBell } from '@/components/NotificationBell';
import { useCustomerNotifications } from '@/hooks/useCustomerNotifications';
import { ReturnDiscountBanner } from '@/components/ReturnDiscountBanner';
import { useImpersonation } from '@/hooks/useImpersonation';
import { ImpersonationBanner } from '@/components/ImpersonationBanner';
import { AddressAutocomplete, AddressData as AutocompleteAddressData } from '@/components/ui/address-autocomplete';


interface CustomerPolicy {
  id: string;
  email?: string;
  plan_type: string;
  payment_type: string;
  policy_number: string;
  policy_start_date: string;
  policy_end_date: string;
  seasonal_bonus_months?: number;
  status: string;
  address: any;
  pdf_basic_url?: string;
  pdf_gold_url?: string;
  pdf_platinum_url?: string;
  payment_amount?: number;
  stripe_session_id?: string;
  bumper_order_id?: string;
  document_url?: string; // Add this for fetched documents
  claim_limit?: number;
  voluntary_excess?: number;
  labour_rate?: number;
  warranty_number?: string;
  registration_plate?: string;
  phone?: string;
  first_name?: string;
  last_name?: string;
  street?: string;
  town?: string;
  postcode?: string;
  country?: string;
  mileage?: string;
  mot_fee?: boolean;
  tyre_cover?: boolean;
  wear_tear?: boolean;
  europe_cover?: boolean;
  transfer_cover?: boolean;
  breakdown_recovery?: boolean;
  vehicle_rental?: boolean;
  mot_repair?: boolean;
  lost_key?: boolean;
  consequential?: boolean;
  additional_notes?: string;
  is_manual_entry?: boolean;
  created_at?: string;
  customer_id?: string;
  customers?: {
    id: string;
    vehicle_make?: string;
    vehicle_model?: string;
    vehicle_year?: string;
    vehicle_fuel_type?: string;
    vehicle_transmission?: string;
    registration_plate?: string;
    mileage?: string;
    phone?: string;
    first_name?: string;
    last_name?: string;
    street?: string;
    town?: string;
    postcode?: string;
    country?: string;
    building_number?: string;
    building_name?: string;
    flat_number?: string;
  };
}

interface PolicyDocument {
  id: string;
  plan_type: string;
  document_name: string;
  file_url: string;
  vehicle_type: string;
}

interface AddressData {
  flatNumber?: string;
  buildingName?: string;
  buildingNumber?: string;
  street: string;
  city: string;
  county?: string;
  postcode: string;
  country: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
}

const CustomerDashboard = () => {
  const { user, signOut, loading } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { isImpersonating, impersonatedCustomer, stopImpersonation } = useImpersonation();
  const [policies, setPolicies] = useState<CustomerPolicy[]>([]);
  const [selectedPolicy, setSelectedPolicy] = useState<CustomerPolicy | null>(null);
  const [policyLoading, setPolicyLoading] = useState(true);
  const [editingAddress, setEditingAddress] = useState(false);
  const [editingPassword, setEditingPassword] = useState(false);
  const [showSupportForm, setShowSupportForm] = useState(false);
  const [customerData, setCustomerData] = useState<any>(null);
  const [address, setAddress] = useState<AddressData>({
    flatNumber: '',
    buildingName: '',
    buildingNumber: '',
    street: '',
    city: '',
    county: '',
    postcode: '',
    country: 'United Kingdom',
    phone: '',
    firstName: '',
    lastName: ''
  });
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [supportMessage, setSupportMessage] = useState('');
  const [supportSubject, setSupportSubject] = useState('');
  const [activeTab, setActiveTab] = useState('overview');
  
  
  const [showRenewalBanner, setShowRenewalBanner] = useState(false);
  const [renewalDiscount, setRenewalDiscount] = useState<string | null>(null);
  
  // Login form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loginFailed, setLoginFailed] = useState(false);

  // Notification system
  const { 
    notifications, 
    unreadCount, 
    markAsRead, 
    markAllAsRead 
  } = useCustomerNotifications(user?.email);

  // Check if logged-in user is an admin
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingAdminStatus, setCheckingAdminStatus] = useState(true);

  useEffect(() => {
    const checkAdminStatus = async () => {
      if (user && !isImpersonating) {
        try {
          const { data } = await supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', user.id);
          
          // Define admin roles
          const adminRoles = ['super_admin', 'admin', 'member', 'viewer', 'guest', 'sales', 'sales_lead', 'blog_writer', 'dev_tester', 'accounts_manager', 'accounts_payroll', 'lead_gen', 'accounts'];
          const hasAdminRole = data && data.some(r => adminRoles.includes(r.role));
          
          if (hasAdminRole) {
            setIsAdmin(true);
          }
        } catch (error) {
          console.error('Error checking admin status:', error);
        }
      }
      setCheckingAdminStatus(false);
    };

    checkAdminStatus();
  }, [user, isImpersonating]);

  useEffect(() => {
    console.log("=== AUTH USEEFFECT TRIGGERED ===");
    console.log("User:", user?.email, user?.id);
    console.log("Loading:", loading);
    console.log("Is impersonating:", isImpersonating);
    console.log("Impersonated customer:", impersonatedCustomer);
    
    // Don't do anything if still loading auth state
    if (loading) {
      console.log("⏳ Still loading auth state, waiting...");
      return;
    }
    
    // If user is logged in or impersonating, fetch their policies
    if (user || isImpersonating) {
      console.log("✅ User authenticated or impersonating, fetching policies...");
      fetchPolicies();
      
      // Update last login timestamp for actual user login (not for impersonation)
      if (user && !isImpersonating) {
        updateLastLogin();
      }
      
      // Set up real-time updates for warranties and customer data changes
      const effectiveEmail = user?.email || impersonatedCustomer?.customerEmail;
      const channel = supabase
        .channel('customer-data-changes')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'customer_policies',
            filter: `email=eq.${effectiveEmail}`
          },
          (payload) => {
            console.log('New warranty detected, refreshing policies');
            fetchPolicies();
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'customer_policies',
            filter: `email=eq.${effectiveEmail}`
          },
          (payload) => {
            console.log('Warranty updated, refreshing policies');
            fetchPolicies();
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'customers',
            filter: `email=eq.${effectiveEmail}`
          },
          (payload) => {
            console.log('Customer data updated (including reg plate), refreshing policies');
            fetchPolicies();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    } else {
      console.log("❌ No user and not impersonating, showing login form");
      // User not logged in, show login form (don't redirect)
      setPolicyLoading(false);
    }
  }, [user, loading, isImpersonating, impersonatedCustomer]);

  // Update customerData when selectedPolicy changes to ensure address form and display show correct data
  useEffect(() => {
    if (selectedPolicy?.customers) {
      const customers = selectedPolicy.customers;
      setCustomerData(customers);
      setAddress(prev => ({
        ...prev,
        phone: customers.phone || '',
        firstName: customers.first_name || '',
        lastName: customers.last_name || '',
        flatNumber: customers.flat_number || '',
        buildingName: customers.building_name || '',
        buildingNumber: customers.building_number || '',
        street: customers.street || '',
        city: customers.town || '',
        county: (customers as any).county || '',
        postcode: customers.postcode || '',
        country: customers.country || 'United Kingdom'
      }));
    }
  }, [selectedPolicy]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    setLoginFailed(false);

    console.log("=== LOGIN ATTEMPT ===", { email: email.trim().toLowerCase() });

    try {
      const normalizedEmail = email.trim().toLowerCase();
      
      // Use the customer-login edge function instead of direct Supabase auth
      const { data, error } = await supabase.functions.invoke('customer-login', {
        body: {
          email: normalizedEmail,
          password,
        }
      });

      console.log("Login response:", { data, error });

      // supabase.functions.invoke puts non-2xx responses in `data` (not `error`)
      // so we must check both `error` AND `data.success === false` / `data.error`
      if (error) {
        console.error("Login transport error:", error);
        toast({
          title: "Login Failed",
          description: "Unable to connect to the login service. Please try again in a moment.",
          variant: "destructive",
        });
        setLoginFailed(true);
        return;
      }

      // Edge function returned an error response (401, 400, etc.)
      if (data?.success === false || data?.error) {
        console.error("Login failed:", data.error);
        toast({
          title: "Login Failed",
          description: "Invalid email or password. Please check your credentials or reset your password below.",
          variant: "destructive",
        });
        setLoginFailed(true);
        return;
      }

      if (data?.user && data?.session) {
        console.log("Setting session with tokens...");
        
        // Set the session in Supabase auth
        const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token
        });
        
        console.log("Session set result:", { sessionData, sessionError });
        
        if (sessionError) {
          console.error("Session set error:", sessionError);
          toast({
            title: "Login Failed",
            description: "Login succeeded but session could not be established. Please try again.",
            variant: "destructive",
          });
          return;
        }
        
        toast({
          title: "Welcome back!",
          description: "You have been signed in successfully.",
        });
        
        // Immediately fetch policies after successful login
        console.log("Fetching policies immediately after login...");
        await fetchPolicies();
      } else {
        console.error("No user or session in response:", data);
        toast({
          title: "Login Failed",
          description: "Something went wrong. Please try again or reset your password.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Login exception:', error);
      toast({
        title: "Login Failed",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
      setLoginFailed(true);
    } finally {
      setLoginLoading(false);
    }
  };

  // Map plan types to document types - all warranties now use premium plan
  const mapPlanTypeToDocumentType = (planType: string): string => {
    // Map all plan types to premium for unified premium warranty coverage
    const premiumPlans = [
      'basic', 'Basic', 'Basic Car Plan',
      'gold', 'Gold', 'Gold Car Plan', 
      'platinum', 'Platinum', 'Platinum Vehicle Plan',
      'premium', 'Premium', 'Premium Car Plan'
    ];
    
    if (premiumPlans.some(plan => planType.toLowerCase().includes(plan.toLowerCase()))) {
      return 'premium';
    }
    
    // Keep special vehicle types unchanged
    const mapping: Record<string, string> = {
      'phev hybrid extended warranty': 'phev',
      'PHEV Hybrid Extended Warranty': 'phev',
      'electric': 'electric',
      'Electric': 'electric',
      'motorbike': 'motorbike',
      'Motorbike': 'motorbike'
    };
    
    return mapping[planType] || 'premium'; // Default to premium
  };

  // Fetch documents for policies
  const fetchPolicyDocuments = async (policies: CustomerPolicy[]): Promise<CustomerPolicy[]> => {
    try {
      console.log("Fetching documents for policies");
      
      // Get all unique plan types
      const planTypes = [...new Set(policies.map(p => mapPlanTypeToDocumentType(p.plan_type)))];
      console.log("Plan types to fetch documents for:", planTypes);
      
      // Fetch documents for these plan types - get the most recent ones
      const { data: documents, error } = await supabase
        .from('customer_documents')
        .select('*')
        .in('plan_type', planTypes)
        .eq('vehicle_type', 'standard')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching documents:', error);
        return policies;
      }

      console.log("Found documents:", documents);

      // Attach document URLs to policies
      const policiesWithDocuments = policies.map(policy => {
        const documentType = mapPlanTypeToDocumentType(policy.plan_type);
        const document = documents?.find(doc => doc.plan_type === documentType);
        
        return {
          ...policy,
          document_url: document?.file_url || null
        };
      });

      console.log("Policies with documents:", policiesWithDocuments);
      return policiesWithDocuments;
      
    } catch (error) {
      console.error('Error in fetchPolicyDocuments:', error);
      return policies;
    }
  };


  const updateLastLogin = async () => {
    if (!user?.email) return;
    
    try {
      // Update last_login in customers table
      await supabase
        .from('customers')
        .update({ last_login: new Date().toISOString() })
        .eq('email', user.email);
        
      // Also update in customer_policies if exists
      await supabase
        .from('customer_policies')
        .update({ last_login: new Date().toISOString() })
        .eq('email', user.email);
    } catch (error) {
      console.error('Error updating last login:', error);
    }
  };

  const fetchPolicies = async () => {
    try {
      setPolicyLoading(true);
      const effectiveEmail = isImpersonating ? impersonatedCustomer?.customerEmail : user?.email;
      
      console.log("=== FETCH POLICIES DEBUG ===");
      console.log("User:", user);
      console.log("Effective email:", effectiveEmail);
      console.log("Is impersonating:", isImpersonating);
      
      if (!effectiveEmail && !user?.id) {
        console.log("ERROR: No user or email available");
        setPolicyLoading(false);
        setPolicies([]);
        return;
      }

      // Try multiple query strategies
      let data: any[] | null = null;
      let error: any = null;

      // Strategy 1: Try by email first (most reliable) - using case-insensitive match
      if (effectiveEmail) {
        console.log("Strategy 1: Querying by email:", effectiveEmail);
        let query = supabase
          .from('customer_policies')
          .select('*')
          .ilike('email', effectiveEmail);
        
        // When impersonating, show ALL policies including soft-deleted ones
        if (!isImpersonating) {
          query = query.or('is_deleted.is.null,is_deleted.eq.false');
        }
        
        const result = await query.order('created_at', { ascending: false });
        
        console.log("Email query result:", result);
        data = result.data;
        error = result.error;
      }

      // Strategy 2: If no results, try by user_id (for normal login)
      if ((!data || data.length === 0) && user?.id && !isImpersonating) {
        console.log("Strategy 2: Querying by user_id:", user.id);
        const result = await supabase
          .from('customer_policies')
          .select('*')
          .eq('user_id', user.id)
          .or('is_deleted.is.null,is_deleted.eq.false')
          .order('created_at', { ascending: false });
        
        console.log("User ID query result:", result);
        data = result.data;
        error = result.error;
      }

      // Strategy 3: When impersonating and email didn't match, try by customer_id
      // This handles cases where the policy email has typos but customer_id is correct
      if ((!data || data.length === 0) && isImpersonating && impersonatedCustomer?.customerId) {
        console.log("Strategy 3: Querying by customer_id (impersonation fallback):", impersonatedCustomer.customerId);
        let query = supabase
          .from('customer_policies')
          .select('*')
          .eq('customer_id', impersonatedCustomer.customerId);
        
        const result = await query.order('created_at', { ascending: false });
        
        console.log("Customer ID query result:", result);
        data = result.data;
        error = result.error;
      }
      
      if (error && error.code !== 'PGRST116') {
        console.error('ERROR fetching policies:', error);
        toast({
          title: "Error fetching policies",
          description: error.message,
          variant: "destructive",
        });
        setPolicyLoading(false);
        setPolicies([]);
        return;
      }

      console.log("Final data check:", { hasData: !!data, count: data?.length });

      if (data && data.length > 0) {
        console.log("SUCCESS: Found", data.length, "policies");
        
        // Fetch customer data separately
        const customerIds = [...new Set(data.map(p => p.customer_id).filter(Boolean))];
        console.log("Customer IDs to fetch:", customerIds);
        
        if (customerIds.length > 0) {
        const { data: customersData } = await supabase
            .from('customers')
            .select('id, vehicle_make, vehicle_model, vehicle_year, vehicle_fuel_type, vehicle_transmission, registration_plate, mileage, phone, first_name, last_name, flat_number, building_name, building_number, street, town, county, postcode, country, labour_rate')
            .in('id', customerIds);
          
          console.log("Customers data:", customersData);
          
          // Attach customer data to policies
          if (customersData) {
            data = data.map(policy => ({
              ...policy,
              customers: customersData.find(c => c.id === policy.customer_id) || null
            }));
          }
        }
        
        // Fetch documents for policies
        const policiesWithDocuments = await fetchPolicyDocuments(data);
        console.log("Policies with documents:", policiesWithDocuments);
        
        // Sort policies: prioritize Stripe/Bumper-verified over manual admin entries,
        // then by created_at descending within each group
        const sortedPolicies = [...policiesWithDocuments].sort((a, b) => {
          const aIsManual = a.is_manual_entry === true;
          const bIsManual = b.is_manual_entry === true;
          // Verified (non-manual) policies come first
          if (aIsManual !== bIsManual) return aIsManual ? 1 : -1;
          // Within same group, newest first
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });
        
        setPolicies(sortedPolicies);
        setSelectedPolicy(sortedPolicies[0]);
        
        // Set customer data from the first policy
        const firstPolicy = policiesWithDocuments[0];
        if (firstPolicy?.customers) {
          const customerData = firstPolicy.customers;
          setCustomerData(customerData);
          
          // Set address from customer data
          setAddress(prev => ({
            ...prev,
            phone: customerData.phone || '',
            firstName: customerData.first_name || '',
            lastName: customerData.last_name || '',
            flatNumber: customerData.flat_number || '',
            buildingName: customerData.building_name || '',
            buildingNumber: customerData.building_number || '',
            street: customerData.street || '',
            city: customerData.town || '',
            county: (customerData as any).county || '',
            postcode: customerData.postcode || '',
            country: customerData.country || 'United Kingdom'
          }));
        }

        checkRenewalNotification(policiesWithDocuments[0]);
      } else {
        console.log("WARNING: No policies found");
        setPolicies([]);
        setSelectedPolicy(null);
        
        // When impersonating, still fetch customer data even without policies
        if (isImpersonating && effectiveEmail) {
          console.log("Impersonating with no policies - fetching customer data directly");
          const { data: custData } = await supabase
            .from('customers')
            .select('id, vehicle_make, vehicle_model, vehicle_year, vehicle_fuel_type, vehicle_transmission, registration_plate, mileage, phone, first_name, last_name, flat_number, building_name, building_number, street, town, county, postcode, country, labour_rate')
            .ilike('email', effectiveEmail)
            .limit(1)
            .maybeSingle();
          
          if (custData) {
            console.log("Found customer data for impersonation:", custData);
            setCustomerData(custData);
            setAddress(prev => ({
              ...prev,
              phone: custData.phone || '',
              firstName: custData.first_name || '',
              lastName: custData.last_name || '',
              flatNumber: custData.flat_number || '',
              buildingName: custData.building_name || '',
              buildingNumber: custData.building_number || '',
              street: custData.street || '',
              city: custData.town || '',
              county: (custData as any).county || '',
              postcode: custData.postcode || '',
              country: custData.country || 'United Kingdom'
            }));
          }
        }
      }
    } catch (error) {
      console.error('EXCEPTION in fetchPolicies:', error);
      toast({
        title: "Error",
        description: "Failed to fetch policies. Please try again.",
        variant: "destructive",
      });
      setPolicies([]);
    } finally {
      setPolicyLoading(false);
      console.log("=== FETCH POLICIES COMPLETE ===");
    }
  };

  const updateAddress = async () => {
    if (!selectedPolicy) {
      toast({
        title: "Error",
        description: "No policy selected. Please refresh and try again.",
        variant: "destructive",
      });
      return;
    }

    try {
      const addressJson = {
        flat_number: address.flatNumber || '',
        building_name: address.buildingName || '',
        building_number: address.buildingNumber || '',
        street: address.street || '',
        city: address.city || '',
        county: address.county || '',
        postcode: address.postcode || '',
        country: address.country || 'United Kingdom'
      };

      const effectiveEmail = isImpersonating ? impersonatedCustomer?.customerEmail : user?.email;
      
      console.log("=== UPDATE ADDRESS DEBUG ===");
      console.log("Effective email:", effectiveEmail);
      console.log("Customer ID:", selectedPolicy.customer_id);
      console.log("Address data:", addressJson);

      // Update customer data - use customer_id if available, fallback to email
      let customerUpdateError = null;
      
      if (selectedPolicy.customer_id) {
        // Use customer_id for more reliable matching
        const { error } = await supabase
          .from('customers')
          .update({
            phone: address.phone || '',
            flat_number: address.flatNumber || '',
            building_name: address.buildingName || '',
            building_number: address.buildingNumber || '',
            street: address.street || '',
            town: address.city || '',
            county: address.county || '',
            postcode: address.postcode || '',
            country: address.country || 'United Kingdom'
          })
          .eq('id', selectedPolicy.customer_id);
        
        customerUpdateError = error;
        console.log("Customer update by ID result:", { error });
      } else if (effectiveEmail) {
        // Fallback to email matching (case-insensitive)
        const { error } = await supabase
          .from('customers')
          .update({
            phone: address.phone || '',
            flat_number: address.flatNumber || '',
            building_name: address.buildingName || '',
            building_number: address.buildingNumber || '',
            street: address.street || '',
            town: address.city || '',
            county: address.county || '',
            postcode: address.postcode || '',
            country: address.country || 'United Kingdom'
          })
          .ilike('email', effectiveEmail);
        
        customerUpdateError = error;
        console.log("Customer update by email result:", { error });
      }

      if (customerUpdateError) {
        console.error("Customer update error:", customerUpdateError);
      }

      // Update policy address
      const { error: policyError } = await supabase
        .from('customer_policies')
        .update({ 
          address: addressJson,
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedPolicy.id);

      console.log("Policy update result:", { error: policyError });

      if (policyError) throw policyError;

      toast({
        title: "Details updated",
        description: "Your address and contact details have been successfully saved.",
      });
      setEditingAddress(false);
      
      // Refresh policies to show updated data
      await fetchPolicies();
    } catch (error) {
      console.error("Update address error:", error);
      toast({
        title: "Error",
        description: "Failed to update details. Please try again.",
        variant: "destructive",
      });
    }
  };

  const updatePassword = async () => {
    if (newPassword !== confirmPassword) {
      toast({
        title: "Password mismatch",
        description: "Passwords do not match.",
        variant: "destructive",
      });
      return;
    }

    if (newPassword.length < 6) {
      toast({
        title: "Password too short",
        description: "Password must be at least 6 characters long.",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) throw error;

      toast({
        title: "Password updated",
        description: "Your password has been successfully updated.",
      });
      setEditingPassword(false);
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update password. Please try again.",
        variant: "destructive",
      });
    }
  };

  const submitSupportRequest = async () => {
    if (!supportSubject.trim() || !supportMessage.trim()) {
      toast({
        title: "Missing Information",
        description: "Please provide both subject and message.",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase.functions.invoke('send-email', {
        body: {
          to: 'support@buyawarranty.co.uk',
          subject: `Support Request: ${supportSubject}`,
          html: `
            <h3>Support Request from Customer</h3>
            <p><strong>Email:</strong> ${user?.email}</p>
            <p><strong>Subject:</strong> ${supportSubject}</p>
            <p><strong>Message:</strong></p>
            <p>${supportMessage.replace(/\n/g, '<br>')}</p>
            <hr>
            <p><em>This message was sent from the customer dashboard.</em></p>
          `
        }
      });

      if (error) throw error;

      toast({
        title: "Support request sent",
        description: "Your support request has been sent successfully. We'll get back to you soon.",
      });
      
      setShowSupportForm(false);
      setSupportSubject('');
      setSupportMessage('');
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to send support request. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleManageBilling = async () => {
    try {
      toast({
        title: "Loading billing portal...",
        description: "Please wait while we redirect you to the billing portal.",
      });

      const { data, error } = await supabase.functions.invoke('create-billing-portal');
      
      if (error) {
        throw error;
      }

      if (data?.url) {
        window.open(data.url, '_blank');
      } else {
        throw new Error('No billing portal URL returned');
      }
    } catch (error) {
      console.error('Billing portal error:', error);
      toast({
        title: "Error",
        description: "Unable to access billing portal. Please contact support.",
        variant: "destructive",
      });
    }
  };

  const downloadPolicyDocument = (policy: CustomerPolicy) => {
    const pdfUrl = getPolicyPdf(policy);
    if (pdfUrl) {
      const link = document.createElement('a');
      link.href = pdfUrl;
      link.download = `Policy_${policy.policy_number}.pdf`;
      link.click();
      
      toast({
        title: "Download started",
        description: `Downloading policy ${policy.policy_number}`,
      });
    }
  };

  const getPolicyPdf = (policy: CustomerPolicy) => {
    if (!policy) return null;
    
    // Use the fetched document URL first, then fallback to the old fields
    if (policy.document_url) {
      return policy.document_url;
    }
    
    // Fallback to old PDF fields for backward compatibility - all now point to premium
    switch (policy.plan_type.toLowerCase()) {
      case 'basic':
      case 'gold':  
      case 'platinum':
      case 'premium':
        return policy.pdf_platinum_url || policy.pdf_gold_url || policy.pdf_basic_url;
      default:
        return policy.pdf_platinum_url || policy.pdf_gold_url || policy.pdf_basic_url;
    }
  };

  const fetchCustomerData = async (email: string) => {
    try {
      // Get the most recent customer record for this email
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('email', email)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('Error fetching customer data:', error);
        return;
      }

      if (data) {
        console.log('Customer data fetched:', data);
        setCustomerData(data);
        setAddress(prev => ({
          ...prev,
          phone: data.phone || '',
          firstName: data.first_name || '',
          lastName: data.last_name || '',
          street: (() => {
            const addressParts = [
              data.flat_number,
              data.building_name,
              data.building_number,
              data.street
            ].filter(part => part && part.trim() && part !== ',');
            return addressParts.length > 0 ? addressParts.join(', ') : prev.street;
          })(),
          city: data.town || prev.city,
          postcode: data.postcode || prev.postcode,
          country: data.country || prev.country
        }));
      }
    } catch (error) {
      console.error('Error in fetchCustomerData:', error);
    }
  };

  const checkRenewalNotification = (policy: CustomerPolicy) => {
    if (!policy) return;
    
    const endDate = new Date(policy.policy_end_date);
    // Add bonus months to the end date if applicable
    if (policy.seasonal_bonus_months) {
      endDate.setMonth(endDate.getMonth() + policy.seasonal_bonus_months);
    }
    const now = new Date();
    const diffTime = endDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    // Show renewal banner if within 30 days of expiry
    if (diffDays > 0 && diffDays <= 30) {
      setShowRenewalBanner(true);
      generateRenewalDiscount();
    }
  };

  const generateRenewalDiscount = async () => {
    try {
      const discountCode = `RENEW10-${Date.now().toString().slice(-6)}`;
      setRenewalDiscount(discountCode);
      
      // Create the discount code in the database
      const { error } = await supabase.functions.invoke('create-discount-code', {
        body: {
          code: discountCode,
          type: 'percentage',
          value: 10,
          validDays: 30,
          usageLimit: 1,
          applicableProducts: ['all']
        }
      });

      if (error) {
        console.error('Error creating renewal discount:', error);
      }
    } catch (error) {
      console.error('Error generating renewal discount:', error);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  if (loading || policyLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  // Show login form if user is not authenticated
  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50">
        <SEOHead 
          title="Customer Dashboard | BuyAWarranty Account Portal"
          description="Access your warranty policies, download documents, manage your account details, and get support for your vehicle warranty coverage."
          keywords="customer dashboard, warranty portal, policy documents, account management, vehicle warranty"
        />
        {/* Minimal Header */}
        <div className="bg-white border-b border-gray-100">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center py-4">
              <button 
                onClick={() => navigate('/')}
                className="flex items-center hover:opacity-80 transition-opacity"
              >
                <img 
                  src="/lovable-uploads/baw_logo_new_2025_copy_2-2.png" 
                  alt="BuyAWarranty" 
                  className="h-7 sm:h-9 w-auto"
                />
              </button>
              <div className="hidden sm:block">
                <TrustpilotHeader />
              </div>
            </div>
          </div>
        </div>

        {/* Main Login Content */}
        <div className="flex-1 flex items-center justify-center px-4 py-8 sm:py-12">
          <div className="w-full max-w-md">
            {/* Back Link */}
            <Button
              variant="ghost"
              onClick={() => window.location.href = '/'}
              className="mb-6 text-gray-500 hover:text-gray-700 hover:bg-gray-50 px-0 -ml-1"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to homepage
            </Button>

            {/* Login Card */}
            <Card className="border-0 shadow-xl shadow-gray-200/50 rounded-2xl overflow-hidden">
              <CardHeader className="text-center pb-2 pt-8 px-6 sm:px-8">
                <div className="mx-auto w-14 h-14 bg-gradient-to-br from-orange-50 to-amber-100 rounded-full flex items-center justify-center mb-5 shadow-sm">
                  <User className="w-7 h-7 text-orange-500" />
                </div>
                <CardTitle className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
                  Welcome Back
                </CardTitle>
                <CardDescription className="text-gray-600 text-base leading-relaxed max-w-sm mx-auto">
                  Sign in to view your warranty details, download documents and manage your cover
                </CardDescription>
              </CardHeader>

              <CardContent className="px-6 sm:px-8 pb-8 pt-6">
                <form onSubmit={handleLogin} className="space-y-5">
                  {/* Email Field */}
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-sm font-medium text-gray-700">
                      Email Address
                    </Label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        id="email"
                        type="email"
                        placeholder="you@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="pl-11 h-12 rounded-xl border-gray-200 focus:border-orange-300 focus:ring-orange-200 transition-colors"
                        required
                        disabled={loginLoading}
                      />
                    </div>
                  </div>

                  {/* Password Field */}
                  <div className="space-y-2">
                    <Label htmlFor="password" className="text-sm font-medium text-gray-700">
                      Password
                    </Label>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="Enter your password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="pl-11 pr-11 h-12 rounded-xl border-gray-200 focus:border-orange-300 focus:ring-orange-200 transition-colors"
                        required
                        disabled={loginLoading}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-1 top-1/2 -translate-y-1/2 h-10 w-10 p-0 hover:bg-gray-100 rounded-lg"
                        onClick={() => setShowPassword(!showPassword)}
                        disabled={loginLoading}
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4 text-gray-400" />
                        ) : (
                          <Eye className="h-4 w-4 text-gray-400" />
                        )}
                      </Button>
                    </div>
                  </div>

                  {/* Sign In Button */}
                  <Button 
                    type="submit" 
                    className="w-full h-12 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-semibold text-base shadow-lg shadow-orange-200/50 mt-2" 
                    disabled={loginLoading || !email || !password}
                  >
                    {loginLoading ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                        Signing In...
                      </>
                    ) : (
                      'Sign In'
                    )}
                  </Button>

                  {/* Secure Login Badge */}
                  <div className="flex items-center justify-center gap-1.5 text-xs text-gray-400 pt-1">
                    <Lock className="w-3 h-3" />
                    <span>Secure Login</span>
                  </div>
                </form>

                {/* Login Failed - Prominent Reset Prompt */}
                {loginFailed && (
                  <div className="mt-6 bg-red-50 border border-red-200 rounded-xl p-5 animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="flex items-start gap-3">
                      <div className="bg-red-100 rounded-full p-2 mt-0.5">
                        <Lock className="w-4 h-4 text-red-600" />
                      </div>
                      <div className="flex-1">
                        <h4 className="font-semibold text-red-800 text-sm">Can't log in?</h4>
                        <p className="text-sm text-red-700 mt-1">
                          Your password may have been updated. Click below to reset it — we'll email you a link to set a new one.
                        </p>
                        <Button 
                          className="mt-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg h-10 px-6"
                          onClick={() => navigate('/forgot-password')}
                        >
                          Reset My Password
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Help Section */}
                <div className="mt-8 pt-6 border-t border-gray-100 space-y-4">
                  <div className="text-center space-y-3">
                    {/* Forgot Password */}
                    <p className="text-sm text-gray-600">
                      <span className="font-medium text-gray-700">Forgot your password?</span>{' '}
                      <Button 
                        variant="link" 
                        className="p-0 h-auto font-medium text-orange-500 hover:text-orange-600"
                        onClick={() => navigate('/forgot-password')}
                      >
                        Reset it here
                      </Button>
                    </p>

                    {/* Resend Credentials */}
                    <p className="text-sm text-gray-600">
                      <span className="font-medium text-gray-700">Still can't log in?</span>{' '}
                      <Button 
                        variant="link" 
                        className="p-0 h-auto font-medium text-orange-500 hover:text-orange-600"
                        onClick={() => navigate('/forgot-password')}
                      >
                        Resend your login details
                      </Button>
                    </p>
                  </div>

                  {/* First Time User Notice */}
                  <div className="bg-amber-50/70 rounded-xl p-4 mt-4">
                    <p className="text-sm text-amber-800 text-center leading-relaxed">
                      <span className="font-medium">First time here?</span> Use the temporary password we emailed you when your warranty was set up.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Support Contact */}
            <p className="text-center text-sm text-gray-500 mt-6">
              Need help? Contact us at{' '}
              <a href="mailto:support@buyawarranty.co.uk" className="text-orange-500 hover:text-orange-600 font-medium">
                support@buyawarranty.co.uk
              </a>
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <SEOHead 
        title="Customer Dashboard | BuyAWarranty Account Portal"
        description="Manage your warranty policies, download documents, and access your account details."
        keywords="customer dashboard, warranty management, policy documents"
      />
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center py-4 sm:py-6 gap-4">
            <div className="flex items-center">
              <img 
                src="/lovable-uploads/9b53da8c-70f3-4fc2-8497-e1958a650b4a.png" 
                alt="BuyAWarranty" 
                className="h-6 sm:h-8 w-auto mr-3 sm:mr-4"
              />
              <h1 className="text-lg sm:text-2xl font-bold text-gray-900">Customer Dashboard</h1>
            </div>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4">
              <div className="hidden sm:block">
                <TrustpilotHeader />
              </div>
              <span className="text-xs sm:text-sm text-gray-600">Welcome, {user?.email}</span>
              <NotificationBell
                notifications={notifications}
                unreadCount={unreadCount}
                onMarkAsRead={markAsRead}
                onMarkAllAsRead={markAllAsRead}
              />
              <Button variant="outline" onClick={handleSignOut} size="sm">
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </div>

      <ReturnDiscountBanner 
        firstPurchaseDate={policies.length > 0 ? policies[policies.length - 1].policy_start_date : null}
        customerEmail={user?.email || null}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        {/* Admin Warning Banner */}
        {!checkingAdminStatus && isAdmin && !isImpersonating && (
          <Alert className="mb-6 border-red-300 bg-red-50">
            <AlertCircle className="h-5 w-5 text-red-600" />
            <AlertDescription className="text-red-900">
              <div className="space-y-2">
                <div className="font-semibold text-lg">⚠️ Admin Account Detected</div>
                <p className="text-sm">
                  You're logged in with an admin account. Logging into the customer dashboard in this tab will 
                  <strong> log you out of the admin dashboard in other tabs</strong>.
                </p>
                <p className="text-sm font-medium">
                  Instead, use the <span className="font-bold text-primary">"View as Customer"</span> button in the admin dashboard 
                  to safely view customer accounts without losing your admin session.
                </p>
                <Button 
                  size="sm" 
                  variant="default"
                  onClick={() => navigate('/admin-dashboard')}
                  className="mt-2 bg-primary hover:bg-primary/90"
                >
                  Go to Admin Dashboard
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Impersonation Banner */}
        {isImpersonating && impersonatedCustomer && (
          <ImpersonationBanner
            customerName={impersonatedCustomer.customerName}
            customerEmail={impersonatedCustomer.customerEmail}
            onExit={stopImpersonation}
          />
        )}
        
        {/* Renewal Notification Banner */}
        {showRenewalBanner && selectedPolicy && (
          <Alert className="mb-6 border-orange-200 bg-orange-50">
            <AlertCircle className="h-4 w-4 text-orange-600" />
            <AlertDescription className="text-orange-800">
              <div className="flex items-center justify-between">
                <div>
                  <strong>Your warranty expires soon!</strong> Renew now and get 10% off your next policy.
                  {renewalDiscount && (
                    <div className="mt-2">
                      <span className="text-sm">Use code: <strong>{renewalDiscount}</strong></span>
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => navigate('/')}>
                    Renew Now
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setShowRenewalBanner(false)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {policies.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>No Policies Found</CardTitle>
              <CardDescription>
                We couldn't find any active policies for your account. 
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="text-sm text-gray-600 space-y-2 bg-gray-50 p-4 rounded">
                  <p><strong>Debug Info:</strong></p>
                  {isImpersonating && impersonatedCustomer ? (
                    <>
                      <p>Impersonating: {impersonatedCustomer.customerName}</p>
                      <p>Customer Email: {impersonatedCustomer.customerEmail}</p>
                      <p>Customer ID: {impersonatedCustomer.customerId}</p>
                      <p>Admin Email: {user?.email || 'Not set'}</p>
                    </>
                  ) : (
                    <>
                      <p>User ID: {user?.id || 'Not set'}</p>
                      <p>Email: {user?.email || 'Not set'}</p>
                    </>
                  )}
                  <p>Auth Status: {loading ? 'Loading...' : user ? 'Authenticated' : 'Not authenticated'}</p>
                  <p>Policies Loading: {policyLoading ? 'Yes' : 'No'}</p>
                </div>
                <div className="flex gap-4">
                  <Button 
                    onClick={async () => {
                      console.log("Manual refresh clicked");
                      console.log("Current user:", user);
                      console.log("Current email:", user?.email);
                      await fetchPolicies();
                    }} 
                    variant="outline"
                    disabled={policyLoading}
                  >
                    {policyLoading ? 'Loading...' : 'Refresh Policy Data'}
                  </Button>
                  <Button 
                    onClick={async () => {
                      // Test direct query
                      console.log("Testing direct query...");
                      const { data, error } = await supabase
                        .from('customer_policies')
                        .select('*')
                        .eq('email', user?.email);
                      console.log("Direct query result:", { data, error, count: data?.length });
                      
                      toast({
                        title: "Test Query Result",
                        description: error ? `Error: ${error.message}` : `Found ${data?.length || 0} policies`,
                        variant: error ? "destructive" : "default"
                      });
                    }}
                    variant="secondary"
                  >
                    Test Database Query
                  </Button>
                  <Button onClick={() => setShowSupportForm(true)} variant="default">
                    <MessageSquare className="mr-2 h-4 w-4" />
                    Contact Support
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="support">Support</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
                {/* Policy Overview */}
                <div className="lg:col-span-2 space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between text-lg">
                        <span className="flex items-center">
                          <FileText className="mr-2 h-5 w-5" />
                          {policies.length > 1 ? 'Your Warranties' : 'Your Active Policy'}
                        </span>
                        {policies.length > 1 && (
                          <span className="inline-flex items-center gap-1.5 bg-blue-600 text-white text-sm font-bold px-3 py-1 rounded-full">
                            {policies.length} Warranties
                          </span>
                        )}
                      </CardTitle>
                      {policies.length > 1 && (
                        <CardDescription>
                          <div className="mt-4 space-y-2">
                            <Label className="text-sm font-semibold text-gray-700 block">
                              You have {policies.length} warranties — select one to view:
                            </Label>
                            <div className="space-y-2">
                              {policies.map((policy) => {
                                const vehicleReg = policy.customers?.registration_plate || 
                                                 policy.policy_number?.split('-').pop() || 
                                                 'Unknown Vehicle';
                                const vehicleName = policy.customers?.vehicle_make && policy.customers?.vehicle_model
                                  ? `${policy.customers.vehicle_year ? policy.customers.vehicle_year + ' ' : ''}${policy.customers.vehicle_make} ${policy.customers.vehicle_model}`
                                  : (policy.plan_type?.includes('motorbike') || policy.plan_type?.includes('Motorbike'))
                                  ? 'Motorbike'
                                  : 'Vehicle';
                                const policyDate = new Date(policy.policy_start_date).toLocaleDateString('en-GB');
                                const warrantyRef = policy.warranty_number || policy.policy_number;
                                const isSelected = selectedPolicy?.id === policy.id;
                                
                                return (
                                  <button
                                    key={policy.id}
                                    onClick={() => setSelectedPolicy(policy)}
                                    className={`w-full text-left p-3 rounded-lg border-2 transition-all ${
                                      isSelected 
                                        ? 'border-blue-500 bg-blue-50 shadow-sm' 
                                        : 'border-gray-200 bg-white hover:border-blue-300 hover:bg-blue-50/50'
                                    }`}
                                  >
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-3">
                                        <span className="inline-block bg-yellow-400 text-black font-bold text-xs px-2 py-1 rounded">
                                          {vehicleReg}
                                        </span>
                                        <span className="font-medium text-sm text-gray-900">{vehicleName}</span>
                                      </div>
                                      {isSelected && (
                                        <span className="text-xs bg-blue-600 text-white px-2 py-0.5 rounded-full font-medium">Viewing</span>
                                      )}
                                    </div>
                                    <div className="mt-1 text-xs text-gray-500 ml-0">
                                      Ref: {warrantyRef} · Started: {policyDate} · £{policy.payment_amount?.toFixed(2) || '0.00'}
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </CardDescription>
                      )}
                    </CardHeader>
                    <CardContent className="space-y-6">
                      {selectedPolicy && (
                        <>
                          {/* Warranty Header with Key Information */}
                          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-lg border border-blue-200">
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                              <div className="text-center sm:text-left">
                                <Label className="text-xs font-medium text-blue-700 uppercase tracking-wide">Vehicle Registration</Label>
                                <p className="text-lg font-bold text-blue-900 mt-1">
                                  {selectedPolicy?.customers?.registration_plate || customerData?.registration_plate || selectedPolicy?.policy_number?.split('-').pop() || 'Not provided'}
                                </p>
                              </div>
                              <div className="text-center">
                                <Label className="text-xs font-medium text-blue-700 uppercase tracking-wide">Warranty Reference</Label>
                                <p className="text-lg font-bold text-blue-900 mt-1 font-mono">
                                  {selectedPolicy?.warranty_number || customerData?.warranty_reference_number || selectedPolicy?.policy_number}
                                </p>
                              </div>
                              <div className="text-center sm:text-right">
                                <Label className="text-xs font-medium text-blue-700 uppercase tracking-wide">Status</Label>
                                {(() => {
                                  // Resolve display status: scheduled policies past their start date should show as active
                                  const isFutureActivation = selectedPolicy.status === 'scheduled' && new Date(selectedPolicy.policy_start_date) > new Date();
                                  const displayStatus = (selectedPolicy.status === 'scheduled' && new Date(selectedPolicy.policy_start_date) <= new Date()) 
                                    ? 'active' 
                                    : selectedPolicy.status;
                                  
                                  if (isFutureActivation) {
                                    return (
                                      <div className="mt-1">
                                        <p className="text-lg font-bold text-blue-600 flex items-center justify-center sm:justify-end gap-2">
                                          <AlertCircle className="h-5 w-5" />
                                          FUTURE ACTIVATION
                                        </p>
                                        <p className="text-xs text-blue-500 text-center sm:text-right mt-1">
                                          Activates on {new Date(selectedPolicy.policy_start_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                                        </p>
                                      </div>
                                    );
                                  }
                                  
                                  return (
                                    <p className={`text-lg font-bold mt-1 flex items-center justify-center sm:justify-end gap-2 ${
                                      displayStatus === 'active' ? 'text-green-600' : 
                                      displayStatus === 'expired' ? 'text-red-600' : 
                                      displayStatus === 'cancelled' ? 'text-gray-600' : 
                                      displayStatus === 'refunded' ? 'text-amber-600' : 'text-yellow-600'
                                    }`}>
                                      {displayStatus === 'active' && <CheckCircle className="h-5 w-5" />}
                                      {displayStatus === 'expired' && <X className="h-5 w-5" />}
                                      {displayStatus === 'cancelled' && <X className="h-5 w-5" />}
                                      {displayStatus === 'refunded' && <X className="h-5 w-5" />}
                                      {displayStatus === 'pending' && <AlertCircle className="h-5 w-5" />}
                                      {displayStatus === 'cancelled' || displayStatus === 'refunded' 
                                        ? (displayStatus === 'refunded' ? 'REFUNDED' : 'INACTIVE')
                                        : displayStatus.toUpperCase()}
                                    </p>
                                  );
                                })()}
                              </div>
                            </div>
                          </div>

                          {/* Policy Details Grid */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                              <Label className="text-xs sm:text-sm font-medium text-gray-500">Plan Type</Label>
                              <p className="font-semibold text-sm sm:text-base">
                                Platinum {selectedPolicy.plan_type.includes('motorbike') || selectedPolicy.plan_type.includes('Motorbike') 
                                  ? 'Motorbike Plan' 
                                  : selectedPolicy.plan_type.includes('van') || selectedPolicy.plan_type.includes('Van')
                                  ? 'Van Plan'
                                  : selectedPolicy.plan_type.includes('phev') || selectedPolicy.plan_type.includes('electric') || selectedPolicy.plan_type.includes('Electric')
                                  ? 'Electric/Hybrid Plan'
                                  : 'Car Plan'}
                              </p>
                            </div>
                            <div>
                              <Label className="text-xs sm:text-sm font-medium text-gray-500">Duration</Label>
                              <p className="font-semibold text-sm sm:text-base">
                                {getWarrantyDurationDisplay(selectedPolicy.payment_type)}
                                {selectedPolicy.seasonal_bonus_months != null && selectedPolicy.seasonal_bonus_months > 0 && (
                                  <span className="text-green-600 font-medium ml-1">
                                    + {selectedPolicy.seasonal_bonus_months} months FREE
                                  </span>
                                )}
                              </p>
                            </div>
                             <div>
                               <Label className="text-xs sm:text-sm font-medium text-gray-500">Vehicle</Label>
                               <p className="font-semibold text-sm sm:text-base text-black">
                                 {customerData?.vehicle_make && customerData?.vehicle_model && 
                                  customerData.vehicle_make !== 'Unknown' && customerData.vehicle_model !== 'Unknown'
                                   ? `${customerData.vehicle_year ? customerData.vehicle_year + ' ' : ''}${customerData.vehicle_make} ${customerData.vehicle_model}`.toUpperCase()
                                   : (selectedPolicy?.plan_type?.includes('motorbike') || selectedPolicy?.plan_type?.includes('Motorbike'))
                                   ? 'Motorbike Details Not Provided'
                                   : 'Vehicle Details Not Provided'}
                               </p>
                               {customerData?.vehicle_fuel_type && customerData.vehicle_fuel_type !== 'Unknown' && (
                                 <p className="text-xs text-muted-foreground mt-0.5">
                                   {customerData.vehicle_fuel_type}{customerData.vehicle_transmission && customerData.vehicle_transmission !== 'Unknown' ? ` • ${customerData.vehicle_transmission}` : ''}
                                 </p>
                               )}
                             </div>
                              <div>
                                <Label className="text-xs sm:text-sm font-medium text-gray-500">Mileage</Label>
                                <p className="font-semibold text-sm sm:text-base">
                                  {(() => {
                                    if (!customerData?.mileage || !customerData.mileage.trim()) {
                                      return 'Not provided';
                                    }
                                    const mileageStr = customerData.mileage.trim();
                                    // Check if it's a range (contains 'to' or '-')
                                    if (mileageStr.toLowerCase().includes('to') || mileageStr.includes('-')) {
                                      return mileageStr;
                                    }
                                    // Try to parse as number
                                    const mileageNum = Number(mileageStr);
                                    if (!isNaN(mileageNum) && mileageNum > 0) {
                                      return `${mileageNum.toLocaleString()} miles`;
                                    }
                                    // If not a valid number, return as-is
                                    return mileageStr;
                                  })()}
                                </p>
                              </div>
                             <div>
                               <Label className="text-xs sm:text-sm font-medium text-gray-500">
                                 {selectedPolicy?.status === 'scheduled' && new Date(selectedPolicy.policy_start_date) > new Date() 
                                   ? 'Activation Date' 
                                   : 'Policy Start Date'}
                               </Label>
                               <p className="font-semibold text-sm sm:text-base">
                                 {selectedPolicy?.policy_start_date ? new Date(selectedPolicy.policy_start_date).toLocaleDateString('en-GB') : 'N/A'}
                               </p>
                              </div>
                              <div>
                                <Label className="text-xs sm:text-sm font-medium text-gray-500">Policy End Date</Label>
                                <p className="font-semibold text-sm sm:text-base">
                                  {selectedPolicy?.policy_end_date ? (() => {
                                    const endDate = new Date(selectedPolicy.policy_end_date);
                                    if (selectedPolicy.seasonal_bonus_months != null && selectedPolicy.seasonal_bonus_months > 0) {
                                      endDate.setMonth(endDate.getMonth() + selectedPolicy.seasonal_bonus_months);
                                    }
                                    return endDate.toLocaleDateString('en-GB');
                                  })() : 'N/A'}
                                </p>
                                {selectedPolicy?.seasonal_bonus_months != null && selectedPolicy.seasonal_bonus_months > 0 && (
                                  <p className="text-xs text-green-600 font-medium mt-1">
                                    +{selectedPolicy.seasonal_bonus_months} months FREE bonus applied
                                  </p>
                                )}
                              </div>
                              <div>
                                <Label className="text-xs sm:text-sm font-medium text-gray-500">Amount Paid</Label>
                                <p className="font-semibold text-sm sm:text-base text-green-700">
                                  {selectedPolicy?.payment_amount ? `£${selectedPolicy.payment_amount.toFixed(2)}` : 'N/A'}
                                </p>
                              </div>
                              <div>
                                <Label className="text-xs sm:text-sm font-medium text-gray-500">Payment Method</Label>
                                <p className="font-semibold text-sm sm:text-base">
                                  {selectedPolicy?.bumper_order_id ? 'Bumper (Pay Monthly)' : 
                                   selectedPolicy?.stripe_session_id ? 'Stripe (Paid in Full)' : 'N/A'}
                                </p>
                              </div>
                          </div>

                          {/* Document Actions - View T&Cs and Warranty Plan */}
                          <div className="pt-4 border-t">
                            <div className="flex flex-wrap gap-3">
                              <Button 
                                size="sm"
                                className="bg-orange-500 hover:bg-orange-600 text-white"
                                onClick={async () => {
                                  const { data } = await supabase
                                    .from('customer_documents')
                                    .select('file_url')
                                    .eq('plan_type', 'terms-and-conditions')
                                    .order('created_at', { ascending: false })
                                    .limit(1)
                                    .single();
                                  
                                  if (data?.file_url) {
                                    window.open(data.file_url, '_blank');
                                  } else {
                                    toast({
                                      title: "Error",
                                      description: "Terms and Conditions document not available",
                                      variant: "destructive",
                                    });
                                  }
                                }}
                              >
                                <FileText className="mr-2 h-4 w-4" />
                                View T's and C's
                              </Button>
                              <Button 
                                size="sm"
                                className="bg-orange-500 hover:bg-orange-600 text-white"
                                onClick={() => {
                                  const pdfUrl = getPolicyPdf(selectedPolicy!);
                                  if (pdfUrl) {
                                    window.open(pdfUrl, '_blank');
                                  } else {
                                    toast({
                                      title: "Error",
                                      description: "Policy document not available",
                                      variant: "destructive",
                                    });
                                  }
                                }}
                                disabled={!selectedPolicy}
                              >
                                <FileText className="mr-2 h-4 w-4" />
                                View your warranty plan
                              </Button>
                            </div>
                          </div>

                          {/* Add-On Protection Packages */}
                          <AddOnProtectionDisplay
                            mot_fee={selectedPolicy.mot_fee}
                            tyre_cover={selectedPolicy.tyre_cover}
                            wear_tear={selectedPolicy.wear_tear}
                            europe_cover={selectedPolicy.europe_cover}
                            transfer_cover={selectedPolicy.transfer_cover}
                            breakdown_recovery={selectedPolicy.breakdown_recovery}
                            vehicle_rental={selectedPolicy.vehicle_rental}
                            mot_repair={selectedPolicy.mot_repair}
                            lost_key={selectedPolicy.lost_key}
                            consequential={selectedPolicy.consequential}
                            claim_limit={selectedPolicy.claim_limit}
                            voluntary_excess={selectedPolicy.voluntary_excess}
                            payment_type={selectedPolicy.payment_type}
                          />
                          
                          {/* Additional Notes Section */}
                          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                            <h4 className="text-sm font-semibold text-amber-800 flex items-center gap-2 mb-2">
                              <FileText className="h-4 w-4" />
                              Additional Notes
                            </h4>
                            <p className="text-sm text-amber-900 whitespace-pre-line">
                              {selectedPolicy.additional_notes || "No additional notes for this policy."}
                            </p>
                          </div>
                          {/* Policy Details */}
                          <div className="space-y-3">
                            <h4 className="text-lg font-semibold text-blue-900 flex items-center gap-2">
                              <AlertCircle className="h-4 w-4" />
                              Policy Details
                            </h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                              <div>
                                <Label className="text-xs sm:text-sm font-medium text-gray-700">Claim Limit</Label>
                                <p className="font-bold text-lg text-blue-900">
                                  £{getDisplayClaimLimitValue(selectedPolicy?.claim_limit || customerData?.claim_limit || 1250).toLocaleString()} per claim
                                </p>
                              </div>
                              <div>
                                <Label className="text-xs sm:text-sm font-medium text-gray-700">Voluntary Excess</Label>
                                <p className="font-bold text-lg text-blue-900">
                                  £{selectedPolicy?.voluntary_excess || customerData?.voluntary_excess || 0}
                                </p>
                              </div>
                              <div>
                                <Label className="text-xs sm:text-sm font-medium text-gray-700">Labour Rate</Label>
                                <p className="font-bold text-lg text-blue-900">
                                  £{selectedPolicy?.labour_rate || customerData?.labour_rate || 70}/hour
                                </p>
                              </div>
                            </div>
                          </div>
                        </>
                      )}
                    </CardContent>
                  </Card>

                  {/* Address Update Banner */}
                  {(!address.street || !address.city || !address.postcode) && (
                    <Alert className="bg-amber-50 border-amber-200">
                      <AlertCircle className="h-4 w-4 text-amber-600" />
                      <AlertDescription className="text-amber-800">
                        <strong>Please update your address and contact details.</strong> We need your current address to process any warranty claims effectively.
                      </AlertDescription>
                    </Alert>
                  )}

                  {/* Address Management */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between text-lg">
                        <span className="flex items-center">
                          <MapPin className="mr-2 h-5 w-5" />
                          Your details
                        </span>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => setEditingAddress(!editingAddress)}
                        >
                          {editingAddress ? 'Cancel' : 'Edit'}
                        </Button>
                      </CardTitle>
                    </CardHeader>
                     <CardContent>
                        {editingAddress ? (
                          <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <Label htmlFor="firstName">First Name</Label>
                                <Input
                                  id="firstName"
                                  value={address.firstName}
                                  disabled
                                  className="bg-gray-100"
                                />
                                <p className="text-xs text-gray-500 mt-1">Contact support to change your name</p>
                              </div>
                              <div>
                                <Label htmlFor="lastName">Last Name</Label>
                                <Input
                                  id="lastName"
                                  value={address.lastName}
                                  disabled
                                  className="bg-gray-100"
                                />
                                <p className="text-xs text-gray-500 mt-1">Contact support to change your name</p>
                              </div>
                            </div>
                            <div>
                              <Label htmlFor="editEmail">Email Address</Label>
                              <Input
                                id="editEmail"
                                type="email"
                                value={selectedPolicy?.email || policies[0]?.email || user?.email || ''}
                                disabled
                                className="bg-gray-100"
                              />
                              <p className="text-xs text-gray-500 mt-1">Contact support to change your email address</p>
                            </div>
                            <div>
                              <Label htmlFor="phone">Phone Number</Label>
                              <Input
                                id="phone"
                                value={address.phone}
                                onChange={(e) => setAddress({...address, phone: e.target.value})}
                              />
                            </div>
                            
                            {/* Address Lookup with getaddress.io */}
                            <div className="mb-4 pb-4 border-b border-border/50">
                              <Label className="flex items-center gap-2 mb-2 text-sm font-medium">
                                <Search className="h-4 w-4" />
                                Find Your Address
                              </Label>
                              <AddressAutocomplete
                                placeholder="Start typing postcode or address..."
                                onAddressSelect={(autocompleteData: AutocompleteAddressData) => {
                                  setAddress({
                                    ...address,
                                    buildingNumber: autocompleteData.building_number || '',
                                    buildingName: autocompleteData.building_name || '',
                                    street: autocompleteData.line_1 || '',
                                    city: autocompleteData.town || '',
                                    county: autocompleteData.county || '',
                                    postcode: autocompleteData.postcode || '',
                                  });
                                }}
                                className="w-full border border-border rounded-lg px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-primary/20 min-h-[44px]"
                              />
                              <p className="text-xs text-muted-foreground mt-2">
                                Search by postcode or address, then adjust fields below if needed
                              </p>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <Label htmlFor="flatNumber">Flat Number</Label>
                                <Input
                                  id="flatNumber"
                                  placeholder="e.g., Flat 2"
                                  value={address.flatNumber}
                                  onChange={(e) => setAddress({...address, flatNumber: e.target.value})}
                                />
                              </div>
                              <div>
                                <Label htmlFor="buildingName">Building Name</Label>
                                <Input
                                  id="buildingName"
                                  placeholder="e.g., Oak Court"
                                  value={address.buildingName}
                                  onChange={(e) => setAddress({...address, buildingName: e.target.value})}
                                />
                              </div>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <Label htmlFor="buildingNumber">Building Number</Label>
                                <Input
                                  id="buildingNumber"
                                  placeholder="e.g., 5"
                                  value={address.buildingNumber}
                                  onChange={(e) => setAddress({...address, buildingNumber: e.target.value})}
                                />
                              </div>
                              <div>
                                <Label htmlFor="street">Street</Label>
                                <Input
                                  id="street"
                                  placeholder="e.g., Jessica Grove"
                                  value={address.street}
                                  onChange={(e) => setAddress({...address, street: e.target.value})}
                                />
                              </div>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <Label htmlFor="city">City/Town</Label>
                                <Input
                                  id="city"
                                  value={address.city}
                                  onChange={(e) => setAddress({...address, city: e.target.value})}
                                />
                              </div>
                              <div>
                                <Label htmlFor="county">County</Label>
                                <Input
                                  id="county"
                                  placeholder="e.g., Staffordshire"
                                  value={address.county}
                                  onChange={(e) => setAddress({...address, county: e.target.value})}
                                />
                              </div>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <Label htmlFor="postcode">Post Code</Label>
                                <Input
                                  id="postcode"
                                  value={address.postcode}
                                  onChange={(e) => setAddress({...address, postcode: e.target.value})}
                                />
                              </div>
                              <div>
                                <Label htmlFor="country">Country</Label>
                                <Input
                                  id="country"
                                  value={address.country}
                                  onChange={(e) => setAddress({...address, country: e.target.value})}
                                />
                              </div>
                            </div>
                            <div className="flex gap-3">
                              <Button onClick={updateAddress} className="flex-1">
                                Save Changes
                              </Button>
                              <Button 
                                variant="outline" 
                                onClick={() => setEditingAddress(false)}
                                className="flex-1"
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                         ) : (
                           <div className="space-y-3">
                             {/* Customer Name */}
                             <div>
                               <Label className="text-sm font-medium text-gray-500">Full Name</Label>
                               <p className="font-semibold text-base">
                                 {address.firstName && address.lastName 
                                   ? `${address.firstName} ${address.lastName}` 
                                   : (address.firstName || address.lastName || 'N/A')}
                               </p>
                             </div>
                             
                             {/* Email Address */}
                             <div>
                               <Label className="text-sm font-medium text-gray-500">Email Address</Label>
                               <p className="font-semibold text-base">{selectedPolicy?.email || policies[0]?.email || user?.email}</p>
                             </div>
                             
                             {/* Phone Number */}
                             <div>
                               <Label className="text-sm font-medium text-gray-500">Phone Number</Label>
                               <p className="font-semibold text-base">
                                 {address.phone || 'N/A'}
                               </p>
                             </div>
                             
                             {/* Flat Number */}
                             {address.flatNumber && (
                               <div>
                                 <Label className="text-sm font-medium text-gray-500">Flat Number</Label>
                                 <p className="font-semibold text-base">
                                   {address.flatNumber}
                                 </p>
                               </div>
                             )}
                             
                             {/* Building Name */}
                             {address.buildingName && (
                               <div>
                                 <Label className="text-sm font-medium text-gray-500">Building Name</Label>
                                 <p className="font-semibold text-base">
                                   {address.buildingName}
                                 </p>
                               </div>
                             )}
                             
                             {/* Building Number */}
                             {address.buildingNumber && (
                               <div>
                                 <Label className="text-sm font-medium text-gray-500">Building Number</Label>
                                 <p className="font-semibold text-base">
                                   {address.buildingNumber}
                                 </p>
                               </div>
                             )}
                             
                             {/* Street */}
                             {address.street && (
                               <div>
                                 <Label className="text-sm font-medium text-gray-500">Street</Label>
                                 <p className="font-semibold text-base">
                                   {address.street}
                                 </p>
                               </div>
                             )}
                             
                             {/* City/Town */}
                             <div>
                               <Label className="text-sm font-medium text-gray-500">City/Town</Label>
                               <p className="font-semibold text-base">
                                 {address.city || 'N/A'}
                               </p>
                             </div>
                             
                             {/* County */}
                             {address.county && (
                               <div>
                                 <Label className="text-sm font-medium text-gray-500">County</Label>
                                 <p className="font-semibold text-base">
                                   {address.county}
                                 </p>
                               </div>
                             )}
                             
                             {/* Post Code */}
                             <div>
                               <Label className="text-sm font-medium text-gray-500">Post Code</Label>
                               <p className="font-semibold text-base">
                                 {address.postcode || 'N/A'}
                               </p>
                             </div>
                             
                             {/* Country */}
                             <div>
                               <Label className="text-sm font-medium text-gray-500">Country</Label>
                               <p className="font-semibold text-base">
                                 {address.country || 'United Kingdom'}
                               </p>
                             </div>
                           </div>
                         )}
                     </CardContent>
                  </Card>
                </div>

                {/* Account Management Sidebar */}
                <div className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center text-lg">
                        <User className="mr-2 h-5 w-5" />
                        Account Settings
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                       <Label className="text-sm font-medium text-gray-500">Email</Label>
                       <p className="font-semibold">{selectedPolicy?.email || policies[0]?.email || user?.email}</p>
                      </div>
                      
                      <div className="pt-4 border-t">
                        <Button 
                          variant="outline" 
                          className="w-full"
                          onClick={() => setEditingPassword(!editingPassword)}
                        >
                          <Lock className="mr-2 h-4 w-4" />
                          Change Password
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  {editingPassword && (
                    <Card>
                      <CardHeader>
                        <CardTitle>Change Password</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div>
                          <Label htmlFor="newPassword">New Password</Label>
                          <div className="relative">
                            <Input
                              id="newPassword"
                              type={showPassword ? "text" : "password"}
                              value={newPassword}
                              onChange={(e) => setNewPassword(e.target.value)}
                              className="pr-10"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                              onClick={() => setShowPassword(!showPassword)}
                            >
                              {showPassword ? (
                                <EyeOff className="h-4 w-4 text-gray-500" />
                              ) : (
                                <Eye className="h-4 w-4 text-gray-500" />
                              )}
                            </Button>
                          </div>
                        </div>
                        <div>
                          <Label htmlFor="confirmPassword">Confirm Password</Label>
                          <div className="relative">
                            <Input
                              id="confirmPassword"
                              type={showPassword ? "text" : "password"}
                              value={confirmPassword}
                              onChange={(e) => setConfirmPassword(e.target.value)}
                              className="pr-10"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                              onClick={() => setShowPassword(!showPassword)}
                            >
                              {showPassword ? (
                                <EyeOff className="h-4 w-4 text-gray-500" />
                              ) : (
                                <Eye className="h-4 w-4 text-gray-500" />
                              )}
                            </Button>
                          </div>
                        </div>
                        <Button onClick={updatePassword} className="w-full">
                          Update Password
                        </Button>
                      </CardContent>
                    </Card>
                  )}


                </div>
              </div>
            </TabsContent>

            <TabsContent value="support" className="space-y-6">
              <div className="max-w-2xl">
                <Card>
                  <CardHeader>
                    <CardTitle>Other Ways to Reach Us</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-3">
                      <h4 className="font-medium text-sm text-gray-700">General Support</h4>
                      <div className="flex items-center gap-3 p-3 border rounded-lg">
                        <Phone className="h-5 w-5 text-blue-600" />
                        <div>
                          <p className="font-medium">Phone Support</p>
                          <p className="text-sm text-gray-600">0330 229 5040</p>
                          <p className="text-xs text-gray-500">Mon-Fri: 9AM-6PM</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 p-3 border rounded-lg">
                        <Mail className="h-5 w-5 text-blue-600" />
                        <div>
                          <p className="font-medium">Email Support</p>
                          <p className="text-sm text-gray-600">support@buyawarranty.co.uk</p>
                          <p className="text-xs text-gray-500">Response within 24 hours</p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="space-y-3 pt-4 border-t">
                      <h4 className="font-medium text-sm text-gray-700">Claims and Repairs</h4>
                      <div className="flex items-center gap-3 p-3 border rounded-lg">
                        <Phone className="h-5 w-5 text-green-600" />
                        <div>
                          <p className="font-medium">Claims Phone</p>
                          <p className="text-sm text-gray-600">0330 229 5045</p>
                          <p className="text-xs text-gray-500">Mon-Fri: 9AM-6PM</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 p-3 border rounded-lg">
                        <Mail className="h-5 w-5 text-green-600" />
                        <div>
                          <p className="font-medium">Claims Email</p>
                          <p className="text-sm text-gray-600">claims@buyawarranty.co.uk</p>
                          <p className="text-xs text-gray-500">For warranty claims and repairs</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        )}
      </div>


      {/* Support Form Modal */}
      {showSupportForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Contact Support</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowSupportForm(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="space-y-4">
              <div>
                <Label htmlFor="modalSubject">Subject</Label>
                <Input
                  id="modalSubject"
                  placeholder="Brief description of your issue"
                  value={supportSubject}
                  onChange={(e) => setSupportSubject(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="modalMessage">Message</Label>
                <Textarea
                  id="modalMessage"
                  placeholder="Please describe your issue in detail..."
                  rows={4}
                  value={supportMessage}
                  onChange={(e) => setSupportMessage(e.target.value)}
                />
              </div>
              <div className="flex gap-3">
                <Button onClick={submitSupportRequest} className="flex-1">
                  <MessageSquare className="mr-2 h-4 w-4" />
                  Send Request
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => setShowSupportForm(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default CustomerDashboard;