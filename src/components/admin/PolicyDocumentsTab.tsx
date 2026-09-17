import React, { useState, useRef, useEffect, useMemo } from 'react';
import { PostedLettersLog } from './PostedLettersLog';
import { BatchPolicyQueue } from './BatchPolicyQueue';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/use-toast';
import { Search, Printer, FileText, User, Car, Mail, Phone, Tag, Pencil, Save, X, Eye } from 'lucide-react';
import { format } from 'date-fns';
import { getDisplayClaimLimitValue, CLAIM_LIMIT_TIERS } from '@/lib/claimLimitTiers';
import { formatStoredPolicyCoverDuration } from '@/lib/policyCoverDuration';

interface CustomerData {
  id: string;
  name: string;
  first_name?: string;
  last_name?: string;
  email: string;
  phone?: string;
  flat_number?: string;
  building_name?: string;
  building_number?: string;
  street?: string;
  town?: string;
  county?: string;
  postcode?: string;
  registration_plate?: string;
  vehicle_make?: string;
  vehicle_model?: string;
  vehicle_year?: string;
  mileage?: string;
  plan_type: string;
  claim_limit?: number;
  voluntary_excess?: number;
  labour_rate?: number;
  warranty_number?: string;
  warranty_reference_number?: string;
  breakdown_recovery?: boolean;
  wear_tear?: boolean;
  europe_cover?: boolean;
  mot_fee?: boolean;
  mot_repair?: boolean;
  tyre_cover?: boolean;
  lost_key?: boolean;
  vehicle_rental?: boolean;
  transfer_cover?: boolean;
  consequential?: boolean;
  payment_type?: string;
  seasonal_bonus_months?: number;
  created_at?: string;
}

interface PolicyData {
  id: string;
  policy_number: string;
  policy_start_date: string;
  policy_end_date: string;
  plan_type: string;
  warranty_number?: string;
  claim_limit?: number;
  voluntary_excess?: number;
  payment_type: string;
  additional_notes?: string;
  seasonal_bonus_months?: number | null;
  updated_at?: string;
  created_at?: string;
}

interface EditData extends CustomerData {
  policy_claim_limit?: number;
  policy_voluntary_excess?: number;
  policy_plan_type?: string;
  policy_payment_type?: string;
  policy_seasonal_bonus_months?: number;
  policy_start_date?: string;
  policy_end_date?: string;
  policy_additional_notes?: string;
}

const claimLimitOptions = [
  { value: 2000, label: '£2,000', description: 'AutoCare Essential' },
  { value: 3000, label: '£3,000', description: 'AutoCare Elite' },
  { value: 5000, label: '£5,000', description: 'AutoCare Premium' },
];

const excessOptions = [0, 50, 100, 150, 250, 500];

const labourRateOptions = [
  { rate: 50, label: '£50/hr', description: 'Local Garages' },
  { rate: 70, label: '£70/hr', description: 'Independent Garages' },
  { rate: 100, label: '£100/hr', description: 'Approved Garages' },
  { rate: 150, label: '£150/hr', description: 'Specialist garages' },
];

const paymentTypeOptions = [
  { value: '12months', label: '1-Year Cover' },
  { value: '24months', label: '2-Year Cover' },
  { value: '36months', label: '3-Year Cover' },
];

const bonusMonthOptions = [0, 1, 2, 3, 4, 5, 6];

export const PolicyDocumentsTab: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [allCustomers, setAllCustomers] = useState<CustomerData[]>([]);
  const [remoteCustomers, setRemoteCustomers] = useState<CustomerData[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerData | null>(null);
  const [selectedPolicy, setSelectedPolicy] = useState<PolicyData | null>(null);
  const [customerPolicies, setCustomerPolicies] = useState<PolicyData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showPreview, setShowPreview] = useState(false);
  const [printMode, setPrintMode] = useState<'bw' | 'colour'>('colour');
  const [showDropdown, setShowDropdown] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<Partial<EditData>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isDvlaLoading, setIsDvlaLoading] = useState(false);

  const lookupDvla = async (reg: string, { overwrite }: { overwrite: boolean }) => {
    const clean = (reg || '').replace(/\s+/g, '').toUpperCase();
    if (!clean) {
      toast({ title: 'Enter registration', description: 'Add a registration number first.', variant: 'destructive' });
      return;
    }
    setIsDvlaLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('dvla-vehicle-lookup', {
        body: { registrationNumber: clean, skipAgeCheck: true },
      });
      if (error) throw error;
      if (!data?.found) {
        toast({ title: 'Vehicle not found', description: data?.error || 'DVLA lookup returned no data.', variant: 'destructive' });
        return;
      }
      setEditData(d => ({
        ...d,
        registration_plate: clean,
        vehicle_make: overwrite || !d.vehicle_make ? (data.make || d.vehicle_make || '') : d.vehicle_make,
        vehicle_model: overwrite || !d.vehicle_model ? (data.model || d.vehicle_model || '') : d.vehicle_model,
        vehicle_year: overwrite || !d.vehicle_year ? (data.yearOfManufacture ? String(data.yearOfManufacture) : d.vehicle_year || '') : d.vehicle_year,
      }));
      toast({ title: 'Vehicle details updated', description: 'Populated from DVLA/DVSA.' });
    } catch (err: any) {
      toast({ title: 'DVLA lookup failed', description: err.message || 'Try again.', variant: 'destructive' });
    } finally {
      setIsDvlaLoading(false);
    }
  };

  const printRef = useRef<HTMLDivElement>(null);
  const detailsRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Load all customers on mount, newest first
  useEffect(() => {
    const loadCustomers = async () => {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .or('is_deleted.is.null,is_deleted.eq.false')
        .order('created_at', { ascending: false })
        .limit(500);

      if (!error && data) {
        setAllCustomers(data);
      }
      setIsLoading(false);
    };
    loadCustomers();
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Only the newest 500 customers are held locally, so anything older must be
  // searched in the database. Runs after a short pause and merges with the local list.
  useEffect(() => {
    const term = searchQuery.trim();
    if (term.length < 2) {
      setRemoteCustomers([]);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      const like = term.replace(/[%,()]/g, '');
      const plate = like.replace(/\s/g, '');
      const digits = like.replace(/\D/g, '');
      const filters = [
        `name.ilike.%${like}%`,
        `email.ilike.%${like}%`,
        `registration_plate.ilike.%${like}%`,
        `registration_plate.ilike.%${plate}%`,
        `warranty_number.ilike.%${like}%`,
      ];
      if (digits.length >= 6) filters.push(`phone.ilike.%${digits}%`);
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .or(filters.join(','))
        .order('created_at', { ascending: false })
        .limit(50);
      if (!cancelled && !error && data) setRemoteCustomers(data as CustomerData[]);
    }, 300);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [searchQuery]);

  // Filter customers based on search query
  const filteredCustomers = useMemo(() => {
    if (!searchQuery.trim()) return allCustomers;
    const q = searchQuery.toLowerCase().replace(/\s/g, '');
    const seen = new Set(allCustomers.map((c) => c.id));
    const pool = [...allCustomers, ...remoteCustomers.filter((c) => !seen.has(c.id))];
    return pool.filter((c) => {
      const reg = (c.registration_plate || '').toLowerCase().replace(/\s/g, '');
      return (
        c.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.phone || '').includes(searchQuery) ||
        reg.includes(q) ||
        (c.warranty_number || '').toLowerCase().includes(searchQuery.toLowerCase())
      );
    });
  }, [searchQuery, allCustomers]);

  const selectCustomer = async (customer: CustomerData) => {
    let freshCustomer: CustomerData | null = null;
    setSelectedCustomer(customer);
    setShowDropdown(false);
    setSearchQuery('');
    setShowPreview(false);

    // Always re-fetch the latest customer row so address edits made in
    // Customer Management show up immediately (the list is cached on mount).
    try {
      const { data: fresh } = await supabase
        .from('customers')
        .select('*')
        .eq('id', customer.id)
        .maybeSingle();
      if (fresh) {
        freshCustomer = fresh as CustomerData;
        setSelectedCustomer(fresh as CustomerData);
        setAllCustomers((prev) => prev.map((c) => (c.id === fresh.id ? (fresh as CustomerData) : c)));
      }
    } catch {
      // keep the cached row if the refresh fails
    }


    // Auto-log search selection to Posted Letters Log (timestamped)
    try {
      await supabase.from('posted_letters_log').insert({
        customer_id: customer.id,
        registration_plate: customer.registration_plate || 'N/A',
        customer_name: customer.name,
        customer_email: customer.email,
        warranty_number: customer.warranty_number || customer.warranty_reference_number || null,
        plan_type: customer.plan_type,
        action_type: 'search',
        notes: 'Customer searched in Policy Documents',
      } as any);
    } catch (err) {
      console.error('Failed to log search to posted letters log:', err);
    }

    // Fetch policies for this customer first; email is only a fallback for older orphaned records.
    let { data: policies } = await supabase
      .from('customer_policies')
      .select('*')
      .eq('customer_id', customer.id)
      .or('is_deleted.is.null,is_deleted.eq.false')
      .order('updated_at', { ascending: false })
      .order('created_at', { ascending: false });

    if (!policies || policies.length === 0) {
      const { data: emailPolicies } = await supabase
        .from('customer_policies')
        .select('*')
        .ilike('email', customer.email)
        .or('is_deleted.is.null,is_deleted.eq.false')
        .order('updated_at', { ascending: false })
        .order('created_at', { ascending: false });
      policies = emailPolicies || [];
    }

    setCustomerPolicies(policies || []);
    const firstPolicy = policies && policies.length > 0 ? policies[0] : null;
    setSelectedPolicy(firstPolicy);
    return { customer: (freshCustomer || customer) as CustomerData, policy: firstPolicy as PolicyData | null };
  };

  // Shared "open the full editor" logic so the queue row Edit button and the
  // Customer Details Edit button behave identically.
  const beginEdit = (customer: CustomerData, policy: PolicyData | null) => {
    setIsEditing(true);
    const parts = (customer.name || '').trim().split(/\s+/);
    const fnFallback = parts[0] || '';
    const lnFallback = parts.slice(1).join(' ') || '';
    setEditData({
      name: customer.name,
      first_name: customer.first_name || fnFallback,
      last_name: customer.last_name || lnFallback,
      email: customer.email,
      phone: customer.phone || '',
      flat_number: customer.flat_number || '',
      building_name: customer.building_name || '',
      building_number: customer.building_number || '',
      street: customer.street || '',
      town: customer.town || '',
      county: customer.county || '',
      postcode: customer.postcode || '',
      registration_plate: customer.registration_plate || '',
      vehicle_make: customer.vehicle_make || '',
      vehicle_model: customer.vehicle_model || '',
      vehicle_year: customer.vehicle_year || '',
      mileage: customer.mileage || '',
      plan_type: customer.plan_type || '',
      payment_type: customer.payment_type || '',
      claim_limit: customer.claim_limit,
      voluntary_excess: customer.voluntary_excess,
      labour_rate: customer.labour_rate,
      seasonal_bonus_months: customer.seasonal_bonus_months,
      breakdown_recovery: customer.breakdown_recovery,
      wear_tear: customer.wear_tear,
      europe_cover: customer.europe_cover,
      mot_fee: customer.mot_fee,
      mot_repair: customer.mot_repair,
      tyre_cover: customer.tyre_cover,
      lost_key: customer.lost_key,
      vehicle_rental: customer.vehicle_rental,
      transfer_cover: customer.transfer_cover,
      consequential: customer.consequential,
      policy_plan_type: policy?.plan_type || customer.plan_type || '',
      policy_payment_type: policy?.payment_type || customer.payment_type || '',
      policy_claim_limit: policy?.claim_limit ?? customer.claim_limit,
      policy_voluntary_excess: policy?.voluntary_excess ?? customer.voluntary_excess,
      policy_seasonal_bonus_months: policy?.seasonal_bonus_months ?? customer.seasonal_bonus_months,
      policy_start_date: policy?.policy_start_date || '',
      policy_end_date: policy?.policy_end_date || '',
      policy_additional_notes: (policy as any)?.additional_notes || '',
    });
    const hasReg = !!customer.registration_plate;
    const missingVehicle = !customer.vehicle_make && !customer.vehicle_model && !customer.vehicle_year;
    if (hasReg && missingVehicle) {
      lookupDvla(customer.registration_plate!, { overwrite: false });
    }
  };

  // Entry point used by the To Post queue rows: select the customer in the
  // Customer Details card below and open the same full editor.
  const editCustomerById = async (customerId: string) => {
    const cached = allCustomers.find(c => c.id === customerId);
    let customer = cached as CustomerData | undefined;
    if (!customer) {
      const { data } = await supabase.from('customers').select('*').eq('id', customerId).maybeSingle();
      if (!data) {
        toast({ title: 'Customer not found', description: 'Could not load this record.', variant: 'destructive' });
        return;
      }
      customer = data as CustomerData;
    }
    const result = await selectCustomer(customer);
    beginEdit(result.customer, result.policy);
    setTimeout(() => {
      detailsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };


  const getBonusMonths = () => Number(displayPolicy?.seasonal_bonus_months ?? selectedPolicy?.seasonal_bonus_months ?? selectedCustomer?.seasonal_bonus_months ?? 0);

  const getDuration = () => {
    const policy = displayPolicy || selectedPolicy;
    if (!policy) return 'N/A';
    return formatStoredPolicyCoverDuration(policy.policy_start_date, policy.policy_end_date);
  };

  // Live preview data merges unsaved edits with the selected records
  const displayCustomer = useMemo(() => {
    if (!selectedCustomer) return null;
    if (!isEditing) return selectedCustomer;
    return { ...selectedCustomer, ...editData } as CustomerData;
  }, [selectedCustomer, isEditing, editData]);

  const displayPolicy = useMemo(() => {
    if (!selectedPolicy) return null;
    if (!isEditing) return selectedPolicy;
    return {
      ...selectedPolicy,
      claim_limit: editData.policy_claim_limit ?? selectedPolicy.claim_limit,
      voluntary_excess: editData.policy_voluntary_excess ?? selectedPolicy.voluntary_excess,
      plan_type: editData.policy_plan_type ?? selectedPolicy.plan_type,
      payment_type: editData.policy_payment_type ?? selectedPolicy.payment_type,
      seasonal_bonus_months: editData.policy_seasonal_bonus_months ?? selectedPolicy.seasonal_bonus_months,
      policy_start_date: editData.policy_start_date ?? selectedPolicy.policy_start_date,
      policy_end_date: editData.policy_end_date ?? selectedPolicy.policy_end_date,
      additional_notes: editData.policy_additional_notes ?? selectedPolicy.additional_notes,
    } as PolicyData;
  }, [selectedPolicy, isEditing, editData]);

  const formatAddress = () => {
    const customer = displayCustomer || selectedCustomer;
    if (!customer) return [];
    const parts = [
      customer.flat_number && `Flat ${customer.flat_number}`,
      customer.building_name,
      customer.building_number && customer.street
        ? `${customer.building_number} ${customer.street}`
        : customer.street,
      customer.town,
      customer.county,
      customer.postcode,
    ].filter(Boolean);
    if (parts.length > 0) return parts;

    // Fallback: address stored on the policy record (jsonb or plain string)
    const raw: any = (displayPolicy || selectedPolicy as any)?.address;
    if (!raw) return [];
    if (typeof raw === 'string') {
      return raw.split(',').map((s) => s.trim()).filter(Boolean);
    }
    if (typeof raw === 'object') {
      return [
        raw.flat_number && `Flat ${raw.flat_number}`,
        raw.building_name,
        raw.building_number && (raw.street || raw.address_line_1)
          ? `${raw.building_number} ${raw.street || raw.address_line_1}`
          : raw.street || raw.address_line_1,
        raw.address_line_2,
        raw.town || raw.city,
        raw.county,
        raw.postcode,
      ].filter(Boolean);
    }
    return [];
  };


  const getAddonsList = () => {
    const customer = displayCustomer || selectedCustomer;
    if (!customer) return [];
    const addons: string[] = [];
    // Breakdown recovery is shown in key benefits, not as a separate add-on
    if (customer.wear_tear) addons.push('Wear & Tear Cover');
    if (customer.europe_cover) addons.push('European Cover');
    if (customer.mot_repair) addons.push('MOT Repair Cover');
    if (customer.tyre_cover) addons.push('Tyre Cover');
    if (customer.lost_key) addons.push('Lost Key Cover');
    if (customer.vehicle_rental) addons.push('Vehicle Rental Cover');
    if (customer.transfer_cover) addons.push('Transfer Cover');
    if (customer.consequential) addons.push('Consequential Loss Cover');
    return addons;
  };

  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please allow pop-ups to print the letter');
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${selectedCustomer?.name || ''} - ${selectedPolicy?.warranty_number || selectedCustomer?.warranty_number || ''}</title>
          <style>
            @page { size: A4; margin: 15mm 18mm; margin-top: 0; margin-bottom: 0; }
            @media print { @page { margin-top: 0; margin-bottom: 0; } body { margin-top: 15mm; margin-bottom: 15mm; } }
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { font-family: 'Segoe UI', Arial, Helvetica, sans-serif; color: #1a1a1a; line-height: 1.5; background: white; font-size: 11px; }
            .page { max-width: 210mm; margin: 0 auto; }
            .header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 12px; border-bottom: 3px solid #eb4b00; margin-bottom: 14px; }
            .header img { height: 40px; }
            .company-info { text-align: right; font-size: 9px; color: #666; line-height: 1.4; }
            .date-line { text-align: right; font-size: 10px; color: #666; margin-bottom: 12px; }
            .customer-block { margin-bottom: 14px; font-size: 11px; }
            .customer-block p { margin: 1px 0; }
            .customer-block .name { font-weight: 700; font-size: 12px; }
            h1 { font-size: 18px; font-weight: 700; color: #1e3a5f; margin-bottom: 10px; }
            .ref-badge { background: linear-gradient(135deg, #eb4b00 0%, #ff6b2b 100%); color: white; padding: 8px 16px; border-radius: 6px; display: inline-block; margin-bottom: 14px; }
            .ref-badge .label { font-size: 8px; text-transform: uppercase; letter-spacing: 1px; opacity: 0.9; }
            .ref-badge .number { font-size: 15px; font-weight: 700; margin-top: 2px; }
            .greeting { margin-bottom: 8px; }
            .intro-text { margin-bottom: 12px; color: #333; }
            .section { margin-bottom: 14px; }
            .section-title { font-size: 13px; font-weight: 700; color: #1e3a5f; margin-bottom: 8px; border-bottom: 2px solid #e2e8f0; padding-bottom: 4px; }
            .glance-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 20px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px 14px; }
            .glance-item { display: flex; justify-content: space-between; padding: 3px 0; border-bottom: 1px solid #f0f0f0; }
            .glance-item:last-child { border-bottom: none; }
            .glance-label { color: #64748b; font-weight: 500; }
            .glance-value { font-weight: 600; color: #1a1a1a; text-align: right; }
            .benefits-box { background: #f0fdf4; border: 1px solid #86efac; border-radius: 6px; padding: 10px 14px; }
            .benefits-box h4 { color: #166534; font-size: 12px; margin-bottom: 6px; }
            .benefits-box ul { margin: 0; padding-left: 16px; color: #15803d; font-size: 10.5px; }
            .benefits-box li { margin-bottom: 3px; }
            .addons-box { background: #eff6ff; border: 1px solid #93c5fd; border-radius: 6px; padding: 10px 14px; }
            .addons-box h4 { color: #1e40af; font-size: 12px; margin-bottom: 6px; }
            .addons-box ul { margin: 0; padding-left: 16px; color: #1d4ed8; font-size: 10.5px; }
            .addons-box li { margin-bottom: 3px; }
            .claims-box { background: #fef3c7; border: 1px solid #fbbf24; border-radius: 6px; padding: 10px 14px; margin-bottom: 14px; }
            .claims-box h4 { color: #92400e; font-size: 12px; margin-bottom: 4px; }
            .claims-box p { color: #78350f; font-size: 10.5px; margin: 2px 0; }
            .account-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px 14px; margin-bottom: 14px; }
            .account-box h4 { color: #1e3a5f; font-size: 12px; margin-bottom: 4px; }
            .account-box p { font-size: 10.5px; color: #333; margin: 2px 0; }
            .account-box ul { margin: 4px 0 0; padding-left: 16px; font-size: 10px; color: #555; }
            .account-box li { margin-bottom: 2px; }
            .signature { margin-top: 16px; font-size: 11px; }
            .signature p { margin: 1px 0; }
            .contact-footer { margin-top: 18px; padding-top: 10px; border-top: 2px solid #e2e8f0; display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; font-size: 10px; }
            .contact-item { text-align: center; }
            .contact-item .clabel { color: #64748b; font-size: 8px; text-transform: uppercase; letter-spacing: 0.5px; }
            .contact-item .cvalue { color: #eb4b00; font-weight: 600; font-size: 12px; margin-top: 2px; }
            .legal-footer { margin-top: 12px; padding-top: 8px; border-top: 1px solid #e2e8f0; font-size: 8px; color: #94a3b8; text-align: center; }
            ${isBW ? '' : '@media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }'}
          </style>
        </head>
        <body>
          ${printContent.innerHTML}
        </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };

  const handlePrintLabel = () => {
    if (!selectedCustomer) return;
    const addr = formatAddress();
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please allow pop-ups to print the label');
      return;
    }

    const lines = [selectedCustomer.name, ...addr].filter(Boolean);

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Envelope Label - ${selectedCustomer.name}</title>
          <style>
            @page { size: 324mm 229mm; margin: 0; }
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body {
              font-family: 'Segoe UI', Arial, Helvetica, sans-serif;
              width: 324mm;
              height: 229mm;
              display: flex;
              justify-content: center;
              align-items: center;
              background: white;
            }
            .label {
              padding: 20mm;
              font-size: 22pt;
              line-height: 1.6;
              font-weight: 600;
              color: #000;
              text-align: left;
            }
            .label p { margin: 0; }
          </style>
        </head>
        <body>
          <div class="label">
            ${lines.map(l => `<p>${l}</p>`).join('')}
          </div>
        </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); }, 250);
  };

  const handlePrintBrotherLabel = () => {
    if (!selectedCustomer) return;
    const addr = formatAddress();
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please allow pop-ups to print the label');
      return;
    }

    const lines = [selectedCustomer.name, ...addr].filter(Boolean);

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Brother Label - ${selectedCustomer.name}</title>
          <style>
            @page { size: 90mm 29mm; margin: 0; }
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body {
              font-family: 'Segoe UI', Arial, Helvetica, sans-serif;
              width: 90mm;
              height: 29mm;
              display: flex;
              align-items: center;
              background: white;
              overflow: hidden;
            }
            .label {
              padding: 1.5mm 3mm;
              font-size: 7pt;
              line-height: 1.35;
              font-weight: 600;
              color: #000;
              text-align: left;
              width: 100%;
            }
            .label p { margin: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
          </style>
        </head>
        <body>
          <div class="label">
            ${lines.map(l => `<p>${l}</p>`).join('')}
          </div>
        </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); }, 250);
  };

  const logLetterToPostedLog = async (type: 'letter' | 'label') => {
    if (!selectedCustomer) return;
    try {
      await supabase.from('posted_letters_log').insert({
        customer_id: selectedCustomer.id,
        registration_plate: selectedCustomer.registration_plate || 'N/A',
        customer_name: selectedCustomer.name,
        customer_email: selectedCustomer.email,
        warranty_number: selectedPolicy?.warranty_number || selectedCustomer.warranty_number || selectedCustomer.warranty_reference_number || null,
        plan_type: selectedPolicy?.plan_type || selectedCustomer.plan_type || null,
        sent_at: new Date().toISOString(),
        marked_sent_by: null,
        action_type: type === 'label' ? 'label' : 'print',
        notes: type === 'label' ? 'Address label printed' : 'Confirmation letter printed',
      } as any);
    } catch (e) {
      // Silent fail - don't block the print action
    }
  };

  const warrantyRef = displayPolicy?.warranty_number || displayCustomer?.warranty_number || displayCustomer?.warranty_reference_number || 'N/A';
  const claimLimit = displayPolicy?.claim_limit || displayCustomer?.claim_limit;
  const excess = displayPolicy?.voluntary_excess ?? displayCustomer?.voluntary_excess;
  const labourRate = displayCustomer?.labour_rate;
  const planType = displayPolicy?.plan_type || displayCustomer?.plan_type || 'N/A';
  const todayDate = format(new Date(), 'd MMMM yyyy');
  const addons = getAddonsList();
  const address = formatAddress();
  const isBW = printMode === 'bw';

  // Colour palette - switches between colour and B&W
  const c = {
    accent: isBW ? '#333' : '#eb4b00',
    accentGrad: isBW ? '#333' : 'linear-gradient(135deg, #eb4b00 0%, #ff6b2b 100%)',
    accentText: isBW ? 'white' : 'white',
    heading: isBW ? '#000' : '#1e3a5f',
    border: isBW ? '#999' : '#e2e8f0',
    borderAccent: isBW ? '#333' : '#eb4b00',
    glanceBg: isBW ? '#f5f5f5' : '#f8fafc',
    glanceBorder: isBW ? '#ccc' : '#e2e8f0',
    benefitsBg: isBW ? '#f5f5f5' : '#f0fdf4',
    benefitsBorder: isBW ? '#aaa' : '#86efac',
    benefitsHeading: isBW ? '#000' : '#166534',
    benefitsText: isBW ? '#333' : '#15803d',
    addonsBg: isBW ? '#f5f5f5' : '#eff6ff',
    addonsBorder: isBW ? '#aaa' : '#93c5fd',
    addonsHeading: isBW ? '#000' : '#1e40af',
    addonsText: isBW ? '#333' : '#1d4ed8',
    claimsBg: isBW ? '#f5f5f5' : '#fef3c7',
    claimsBorder: isBW ? '#aaa' : '#fbbf24',
    claimsHeading: isBW ? '#000' : '#92400e',
    claimsText: isBW ? '#333' : '#78350f',
    accountBg: isBW ? '#f5f5f5' : '#f8fafc',
    accountBorder: isBW ? '#ccc' : '#e2e8f0',
    accountHeading: isBW ? '#000' : '#1e3a5f',
    contactValue: isBW ? '#000' : '#eb4b00',
    muted: isBW ? '#555' : '#64748b',
    legal: isBW ? '#777' : '#94a3b8',
    divider: isBW ? '#ccc' : '#f0f0f0',
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <FileText className="h-6 w-6 text-orange-500" />
          Policy Documents
        </h2>
        <p className="text-gray-500 mt-1">Search for a customer and generate a printable A4 policy document letter to include with posted T&Cs.</p>
      </div>

      {/* To Post — batch queue at top */}
      <BatchPolicyQueue onEditCustomer={editCustomerById} />



      {/* Search Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Search className="h-5 w-5" />
            Find Customer
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative" ref={dropdownRef}>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, phone, reg..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setShowDropdown(true);
                }}
                onFocus={() => setShowDropdown(true)}
                className="pl-10"
              />
            </div>

            {showDropdown && (
              <div className="absolute z-50 mt-1 w-full bg-background border rounded-lg shadow-lg max-h-80 overflow-y-auto">
                {isLoading ? (
                  <div className="px-4 py-6 text-center text-sm text-muted-foreground">Loading customers...</div>
                ) : filteredCustomers.length === 0 ? (
                  <div className="px-4 py-6 text-center text-sm text-muted-foreground">No customers found</div>
                ) : (
                  filteredCustomers.slice(0, 50).map((customer) => (
                    <button
                      key={customer.id}
                      onClick={() => selectCustomer(customer)}
                      className="w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors flex items-center justify-between border-b last:border-b-0"
                    >
                      <div className="min-w-0">
                        <p className="font-semibold text-foreground">{customer.name}</p>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                          <span className="flex items-center gap-1 truncate"><Mail className="h-3 w-3 shrink-0" />{customer.email}</span>
                          {customer.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3 shrink-0" />{customer.phone}</span>}
                        </div>
                      </div>
                      <div className="text-right shrink-0 ml-3">
                        {customer.registration_plate && (
                          <span className="inline-flex items-center gap-1 bg-muted px-2 py-0.5 rounded text-xs font-mono font-semibold">
                            <Car className="h-3 w-3" />
                            {customer.registration_plate}
                          </span>
                        )}
                        <p className="text-xs text-muted-foreground mt-0.5">{customer.vehicle_make} {customer.vehicle_model}</p>
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Selected Customer Info */}
      {selectedCustomer && (
        <div ref={detailsRef} className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="space-y-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Customer Details
                </CardTitle>
                <div className="flex items-center gap-2">
                  {!isEditing ? (
                    <div className="flex items-center gap-1">
                      <Button size="sm" variant="ghost" onClick={() => beginEdit(selectedCustomer, selectedPolicy)} className="gap-1 text-xs h-7">
                        <Pencil className="h-3 w-3" />
                        Edit
                      </Button>

                      <Button size="sm" variant="outline" disabled={!selectedPolicy} onClick={() => setShowPreview(true)} className="gap-1 text-xs h-7">
                        <Eye className="h-3 w-3" />
                        View Letter
                      </Button>
                    </div>
                  ) : (
                    <div className="flex gap-1">
                      <Button size="sm" variant="default" disabled={isSaving} onClick={async () => {
                        setIsSaving(true);
                        try {
                          const firstName = (editData.first_name || '').trim();
                          const lastName = (editData.last_name || '').trim();
                          const fullName = `${firstName} ${lastName}`.trim();

                          const customerUpdate = {
                            name: fullName,
                            first_name: firstName,
                            last_name: lastName,
                            email: editData.email,
                            phone: editData.phone || null,
                            flat_number: editData.flat_number || null,
                            building_name: editData.building_name || null,
                            building_number: editData.building_number || null,
                            street: editData.street || null,
                            town: editData.town || null,
                            county: editData.county || null,
                            postcode: editData.postcode || null,
                            registration_plate: editData.registration_plate || null,
                            vehicle_make: editData.vehicle_make || null,
                            vehicle_model: editData.vehicle_model || null,
                            vehicle_year: editData.vehicle_year || null,
                            mileage: editData.mileage || null,
                            plan_type: editData.policy_plan_type || editData.plan_type || selectedCustomer.plan_type,
                            payment_type: editData.policy_payment_type || editData.payment_type || selectedCustomer.payment_type,
                            claim_limit: editData.policy_claim_limit ?? editData.claim_limit ?? selectedCustomer.claim_limit,
                            voluntary_excess: editData.policy_voluntary_excess ?? editData.voluntary_excess ?? selectedCustomer.voluntary_excess,
                            labour_rate: editData.labour_rate ?? selectedCustomer.labour_rate,
                            seasonal_bonus_months: editData.policy_seasonal_bonus_months ?? editData.seasonal_bonus_months ?? selectedCustomer.seasonal_bonus_months,
                            breakdown_recovery: editData.breakdown_recovery ?? selectedCustomer.breakdown_recovery,
                            wear_tear: editData.wear_tear ?? selectedCustomer.wear_tear,
                            europe_cover: editData.europe_cover ?? selectedCustomer.europe_cover,
                            mot_fee: editData.mot_fee ?? selectedCustomer.mot_fee,
                            mot_repair: editData.mot_repair ?? selectedCustomer.mot_repair,
                            tyre_cover: editData.tyre_cover ?? selectedCustomer.tyre_cover,
                            lost_key: editData.lost_key ?? selectedCustomer.lost_key,
                            vehicle_rental: editData.vehicle_rental ?? selectedCustomer.vehicle_rental,
                            transfer_cover: editData.transfer_cover ?? selectedCustomer.transfer_cover,
                            consequential: editData.consequential ?? selectedCustomer.consequential,
                          };

                          const { error: customerError } = await supabase.from('customers').update(customerUpdate).eq('id', selectedCustomer.id);
                          if (customerError) throw customerError;

                          if (selectedPolicy?.id) {
                            const policyUpdate = {
                              plan_type: editData.policy_plan_type || selectedPolicy.plan_type,
                              payment_type: editData.policy_payment_type || selectedPolicy.payment_type,
                              claim_limit: editData.policy_claim_limit ?? selectedPolicy.claim_limit,
                              voluntary_excess: editData.policy_voluntary_excess ?? selectedPolicy.voluntary_excess,
                              seasonal_bonus_months: editData.policy_seasonal_bonus_months ?? selectedPolicy.seasonal_bonus_months,
                              policy_start_date: editData.policy_start_date || selectedPolicy.policy_start_date,
                              policy_end_date: editData.policy_end_date || selectedPolicy.policy_end_date,
                              additional_notes: editData.policy_additional_notes ?? (selectedPolicy as any).additional_notes,
                            };
                            const { error: policyError } = await supabase.from('customer_policies').update(policyUpdate).eq('id', selectedPolicy.id);
                            if (policyError) throw policyError;

                            const updatedPolicy = { ...selectedPolicy, ...policyUpdate };
                            setSelectedPolicy(updatedPolicy as PolicyData);
                            setCustomerPolicies(prev => prev.map(p => p.id === selectedPolicy.id ? updatedPolicy as PolicyData : p));
                          }

                          const updatedCustomer = { ...selectedCustomer, ...customerUpdate, name: fullName, first_name: firstName, last_name: lastName };
                          setSelectedCustomer(updatedCustomer as CustomerData);
                          setAllCustomers(prev => prev.map(c => c.id === selectedCustomer.id ? updatedCustomer as CustomerData : c));
                          setIsEditing(false);
                          toast({ title: 'Saved', description: 'Customer and policy details updated.' });
                        } catch (err: any) {
                          toast({ title: 'Error', description: err.message || 'Failed to save', variant: 'destructive' });
                        } finally {
                          setIsSaving(false);
                        }
                      }} className="gap-1 text-xs h-7">
                        <Save className="h-3 w-3" />
                        Save
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setIsEditing(false)} className="h-7 text-xs">
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                  <div className="flex items-center gap-1 border rounded-lg overflow-hidden">
                    <button
                      onClick={() => setPrintMode('bw')}
                      className={`px-2 py-1 text-xs font-medium transition-colors ${printMode === 'bw' ? 'bg-foreground text-background' : 'bg-background text-foreground hover:bg-muted'}`}
                    >
                      B&W
                    </button>
                    <button
                      onClick={() => setPrintMode('colour')}
                      className={`px-2 py-1 text-xs font-medium transition-colors ${printMode === 'colour' ? 'bg-foreground text-background' : 'bg-background text-foreground hover:bg-muted'}`}
                    >
                      Colour
                    </button>
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" onClick={() => { setShowPreview(true); logLetterToPostedLog('letter'); }} className="gap-1">
                  <FileText className="h-3.5 w-3.5" />
                  Preview Letter
                </Button>
                <Button size="sm" variant="outline" onClick={() => { setShowPreview(true); logLetterToPostedLog('letter'); setTimeout(handlePrint, 100); }} className="gap-1">
                  <Printer className="h-3.5 w-3.5" />
                  Print Letter
                </Button>
                <Button size="sm" variant="secondary" onClick={() => { handlePrintLabel(); logLetterToPostedLog('label'); }} className="gap-1 bg-amber-100 text-amber-900 hover:bg-amber-200 border border-amber-300">
                  <Tag className="h-3.5 w-3.5" />
                  🏷️ Envelope Label
                </Button>
                <Button size="sm" variant="secondary" onClick={() => { handlePrintBrotherLabel(); logLetterToPostedLog('label'); }} className="gap-1 bg-purple-100 text-purple-900 hover:bg-purple-200 border border-purple-300">
                  <Tag className="h-3.5 w-3.5" />
                  🖨️ Brother QL Label
                </Button>
              </div>
            </CardHeader>
            <CardContent className="text-sm space-y-1">
              {isEditing ? (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs text-muted-foreground">First Name</Label>
                    <Input value={editData.first_name || ''} onChange={e => setEditData(d => ({ ...d, first_name: e.target.value }))} className="h-8 text-sm" />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Surname</Label>
                    <Input value={editData.last_name || ''} onChange={e => setEditData(d => ({ ...d, last_name: e.target.value }))} className="h-8 text-sm" />
                  </div>

                  <div>
                    <Label className="text-xs text-muted-foreground">Email</Label>
                    <Input value={editData.email || ''} onChange={e => setEditData(d => ({ ...d, email: e.target.value }))} className="h-8 text-sm" />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Phone</Label>
                    <Input value={editData.phone || ''} onChange={e => setEditData(d => ({ ...d, phone: e.target.value }))} className="h-8 text-sm" />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Flat Number</Label>
                    <Input value={editData.flat_number || ''} onChange={e => setEditData(d => ({ ...d, flat_number: e.target.value }))} className="h-8 text-sm" />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Building Name</Label>
                    <Input value={editData.building_name || ''} onChange={e => setEditData(d => ({ ...d, building_name: e.target.value }))} className="h-8 text-sm" />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Building Number</Label>
                    <Input value={editData.building_number || ''} onChange={e => setEditData(d => ({ ...d, building_number: e.target.value }))} className="h-8 text-sm" />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Street</Label>
                    <Input value={editData.street || ''} onChange={e => setEditData(d => ({ ...d, street: e.target.value }))} className="h-8 text-sm" />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Town</Label>
                    <Input value={editData.town || ''} onChange={e => setEditData(d => ({ ...d, town: e.target.value }))} className="h-8 text-sm" />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">County</Label>
                    <Input value={editData.county || ''} onChange={e => setEditData(d => ({ ...d, county: e.target.value }))} className="h-8 text-sm" />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Postcode</Label>
                    <Input value={editData.postcode || ''} onChange={e => setEditData(d => ({ ...d, postcode: e.target.value }))} className="h-8 text-sm" />
                  </div>
                </div>
              ) : (
                <>
                  <p><span className="text-muted-foreground">Name:</span> <strong>{displayCustomer?.name}</strong></p>
                  <p><span className="text-muted-foreground">Email:</span> {displayCustomer?.email}</p>
                  {displayCustomer?.phone && <p><span className="text-muted-foreground">Phone:</span> {displayCustomer.phone}</p>}
                  {address.length > 0 && <p><span className="text-muted-foreground">Address:</span> {address.join(', ')}</p>}
                </>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Car className="h-4 w-4" />
                Vehicle & Cover
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-1">
              {isEditing ? (
                <div className="grid grid-cols-2 gap-2">
                  <div className="col-span-2">
                    <Label className="text-xs text-muted-foreground">Registration</Label>
                    <div className="flex gap-2">
                      <Input value={editData.registration_plate || ''} onChange={e => setEditData(d => ({ ...d, registration_plate: e.target.value.toUpperCase() }))} className="h-8 text-sm font-mono uppercase flex-1" />
                      <Button type="button" size="sm" variant="outline" disabled={isDvlaLoading || !editData.registration_plate} onClick={() => lookupDvla(editData.registration_plate || '', { overwrite: true })} className="h-8 text-xs whitespace-nowrap">
                        {isDvlaLoading ? 'Looking up…' : 'Lookup DVLA'}
                      </Button>
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs text-muted-foreground">Make</Label>
                    <Input value={editData.vehicle_make || ''} onChange={e => setEditData(d => ({ ...d, vehicle_make: e.target.value }))} className="h-8 text-sm" />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Model</Label>
                    <Input value={editData.vehicle_model || ''} onChange={e => setEditData(d => ({ ...d, vehicle_model: e.target.value }))} className="h-8 text-sm" />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Year</Label>
                    <Input value={editData.vehicle_year || ''} onChange={e => setEditData(d => ({ ...d, vehicle_year: e.target.value }))} className="h-8 text-sm" />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Mileage</Label>
                    <Input value={editData.mileage || ''} onChange={e => setEditData(d => ({ ...d, mileage: e.target.value }))} className="h-8 text-sm" />
                  </div>

                  <div className="col-span-2 pt-2 border-t">
                    <p className="text-xs font-semibold text-muted-foreground mb-2">Cover Settings</p>
                  </div>

                  <div>
                    <Label className="text-xs text-muted-foreground">Plan Type</Label>
                    <Input value={editData.policy_plan_type ?? editData.plan_type ?? selectedPolicy?.plan_type ?? selectedCustomer.plan_type ?? ''} onChange={e => setEditData(d => ({ ...d, policy_plan_type: e.target.value }))} className="h-8 text-sm" />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Payment Term</Label>
                    <Select value={String(editData.policy_payment_type ?? selectedPolicy?.payment_type ?? selectedCustomer.payment_type ?? '')} onValueChange={v => setEditData(d => ({ ...d, policy_payment_type: v }))}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Select term" />
                      </SelectTrigger>
                      <SelectContent>
                        {paymentTypeOptions.map(opt => (
                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-xs text-muted-foreground">Claim Limit</Label>
                    <Select value={String(editData.policy_claim_limit ?? editData.claim_limit ?? selectedPolicy?.claim_limit ?? selectedCustomer.claim_limit ?? '')} onValueChange={v => setEditData(d => ({ ...d, policy_claim_limit: Number(v), claim_limit: Number(v) }))}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Select limit" />
                      </SelectTrigger>
                      <SelectContent>
                        {claimLimitOptions.map(opt => (
                          <SelectItem key={opt.value} value={String(opt.value)}>{opt.label} — {opt.description}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Labour Rate</Label>
                    <Select value={String(editData.labour_rate ?? selectedCustomer?.labour_rate ?? '')} onValueChange={v => setEditData(d => ({ ...d, labour_rate: Number(v) }))}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Select rate" />
                      </SelectTrigger>
                      <SelectContent>
                        {labourRateOptions.map(opt => (
                          <SelectItem key={opt.rate} value={String(opt.rate)}>{opt.label} — {opt.description}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-xs text-muted-foreground">Voluntary Excess</Label>
                    <Select value={String(editData.policy_voluntary_excess ?? editData.voluntary_excess ?? selectedPolicy?.voluntary_excess ?? selectedCustomer.voluntary_excess ?? '')} onValueChange={v => setEditData(d => ({ ...d, policy_voluntary_excess: Number(v), voluntary_excess: Number(v) }))}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Select excess" />
                      </SelectTrigger>
                      <SelectContent>
                        {excessOptions.map(opt => (
                          <SelectItem key={opt} value={String(opt)}>£{opt}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Bonus Months</Label>
                    <Select value={String(editData.policy_seasonal_bonus_months ?? selectedPolicy?.seasonal_bonus_months ?? selectedCustomer.seasonal_bonus_months ?? 0)} onValueChange={v => setEditData(d => ({ ...d, policy_seasonal_bonus_months: Number(v), seasonal_bonus_months: Number(v) }))}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Select bonus" />
                      </SelectTrigger>
                      <SelectContent>
                        {bonusMonthOptions.map(opt => (
                          <SelectItem key={opt} value={String(opt)}>{opt} month{opt !== 1 ? 's' : ''}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-xs text-muted-foreground">Policy Start</Label>
                    <Input type="date" value={(editData.policy_start_date ?? selectedPolicy?.policy_start_date ?? '').split('T')[0]} onChange={e => setEditData(d => ({ ...d, policy_start_date: e.target.value }))} className="h-8 text-sm" />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Policy End</Label>
                    <Input type="date" value={(editData.policy_end_date ?? selectedPolicy?.policy_end_date ?? '').split('T')[0]} onChange={e => setEditData(d => ({ ...d, policy_end_date: e.target.value }))} className="h-8 text-sm" />
                  </div>

                  <div className="col-span-2 pt-2 border-t">
                    <p className="text-xs font-semibold text-muted-foreground mb-2">Add-ons</p>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { key: 'breakdown_recovery', label: 'Breakdown Recovery' },
                        { key: 'wear_tear', label: 'Wear & Tear' },
                        { key: 'europe_cover', label: 'European Cover' },
                        { key: 'mot_fee', label: 'MOT Fee' },
                        { key: 'mot_repair', label: 'MOT Repair' },
                        { key: 'tyre_cover', label: 'Tyre Cover' },
                        { key: 'lost_key', label: 'Lost Key' },
                        { key: 'vehicle_rental', label: 'Vehicle Rental' },
                        { key: 'transfer_cover', label: 'Transfer Cover' },
                        { key: 'consequential', label: 'Consequential Loss' },
                      ].map(({ key, label }) => (
                        <label key={key} className="flex items-center gap-2 text-xs">
                          <Checkbox checked={!!(editData as any)[key]} onCheckedChange={checked => setEditData(d => ({ ...d, [key]: checked === true }))} />
                          {label}
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="col-span-2">
                    <Label className="text-xs text-muted-foreground">Additional Notes</Label>
                    <Textarea value={editData.policy_additional_notes ?? selectedPolicy?.additional_notes ?? ''} onChange={e => setEditData(d => ({ ...d, policy_additional_notes: e.target.value }))} className="text-sm min-h-[80px]" />
                  </div>
                </div>
              ) : (
                <>
                  <p><span className="text-muted-foreground">Reg:</span> <strong>{displayCustomer?.registration_plate || '—'}</strong></p>
                  <p><span className="text-muted-foreground">Vehicle:</span> {displayCustomer?.vehicle_make} {displayCustomer?.vehicle_model} {displayCustomer?.vehicle_year}</p>
                  <p><span className="text-muted-foreground">Mileage:</span> {displayCustomer?.mileage ? `${parseInt(displayCustomer.mileage).toLocaleString()} miles` : '—'}</p>
                  <p><span className="text-muted-foreground">Plan:</span> {planType}</p>
                  <p><span className="text-muted-foreground">Term:</span> {displayPolicy?.payment_type || displayCustomer?.payment_type || '—'}</p>
                  <p><span className="text-muted-foreground">Claim Limit:</span> {claimLimit ? `£${getDisplayClaimLimitValue(claimLimit).toLocaleString()}` : '—'}</p>
                  <p><span className="text-muted-foreground">Labour Rate:</span> {labourRate ? `£${labourRate}/hour` : '—'}</p>
                  <p><span className="text-muted-foreground">Excess:</span> {excess !== undefined && excess !== null ? `£${excess}` : '—'}</p>
                  <p><span className="text-muted-foreground">Warranty Ref:</span> {warrantyRef}</p>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Policy Selector */}
      {customerPolicies.length > 1 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Select Policy</CardTitle></CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {customerPolicies.map((pol) => (
                <Button
                  key={pol.id}
                  variant={selectedPolicy?.id === pol.id ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedPolicy(pol)}
                >
                  {pol.policy_number} — {pol.plan_type}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Generate / Print buttons moved to Customer Details card header */}

      {/* A4 Letter Preview */}
      {showPreview && selectedCustomer && selectedPolicy && (
        <Card className="border-2 relative">
          <div className="absolute top-3 right-3 z-10 flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => { setTimeout(handlePrint, 100); }} className="gap-1">
              <Printer className="h-3.5 w-3.5" />
              Print This
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowPreview(false)} className="h-8 w-8 p-0">
              ✕
            </Button>
          </div>
          <CardContent className="p-8 bg-white">
            <div ref={printRef} className="policy-letter">
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', paddingBottom: '12px', borderBottom: `3px solid ${c.borderAccent}`, marginBottom: '14px' }}>
                <img src="https://buyawarranty.co.uk/lovable-uploads/baw-logo-new-2025.png" alt="Buy A Warranty" style={{ height: '40px', filter: isBW ? 'grayscale(100%)' : 'none' }} />
                <div style={{ textAlign: 'right', fontSize: '9px', color: '#666', lineHeight: '1.4' }}>
                  <p style={{ fontWeight: '600' }}>Buy A Warranty Ltd</p>
                  <p>Warranty House, 62 Berkhamsted Ave</p>
                  <p>Wembley, HA9 6DT</p>
                  <p>Company No: 10314863</p>
                </div>
              </div>

              <div style={{ textAlign: 'right', fontSize: '10px', color: '#666', marginBottom: '12px' }}>{todayDate}</div>

              <div style={{ marginBottom: '14px', fontSize: '11px' }}>
                <p style={{ fontWeight: '700', fontSize: '11px', margin: '1px 0' }}>{displayCustomer?.name}</p>
                {address.map((line, i) => (
                  <p key={i} style={{ margin: '1px 0' }}>{line}</p>
                ))}
              </div>

              <h1 style={{ fontSize: '18px', fontWeight: '700', color: c.heading, marginBottom: '10px' }}>
                Your Warranty Cover Document
              </h1>

              {/* Vehicle Registration */}
              <div style={{ display: 'inline-flex', alignItems: 'stretch', border: '2.5px solid #111', borderRadius: '8px', overflow: 'hidden', fontFamily: "'Segoe UI', Arial, sans-serif", marginBottom: '14px', verticalAlign: 'middle' }}>
                <span style={{ background: '#2563eb', color: '#fff', padding: '6px 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: 700, lineHeight: 1.15, letterSpacing: '0.5px' }}>
                  <span>GB</span>
                  <span>UK</span>
                </span>
                <span style={{ background: '#f0c040', color: '#111', padding: '6px 16px', fontSize: '16px', fontWeight: 700, letterSpacing: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {displayCustomer?.registration_plate || 'N/A'}
                </span>
              </div>

              <p style={{ marginBottom: '8px', fontSize: '11px' }}>Dear {displayCustomer?.name?.split(' ')[0] || 'Customer'},</p>
              <p style={{ marginBottom: '12px', color: '#333', fontSize: '11px' }}>
                Thank you for choosing Buyawarranty to protect your vehicle. Please find below a summary of your warranty cover. Your policy provides protection against the cost of unexpected mechanical or electrical breakdowns, helping you stay on the road with peace of mind.
              </p>

              {/* Cover at a Glance */}
              <div style={{ marginBottom: '14px' }}>
                <div style={{ fontSize: '13px', fontWeight: '700', color: c.heading, marginBottom: '8px', borderBottom: `2px solid ${c.border}`, paddingBottom: '4px' }}>Your Cover at a Glance</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 20px', background: c.glanceBg, border: `1px solid ${c.glanceBorder}`, borderRadius: '6px', padding: '12px 14px' }}>
                  {[
                    ['Vehicle', <span style={{ display: 'inline-flex', alignItems: 'stretch', border: '2px solid #111', borderRadius: '6px', overflow: 'hidden', fontFamily: "'Segoe UI', Arial, sans-serif", verticalAlign: 'middle' }}><span style={{ background: '#2563eb', color: '#fff', padding: '2px 5px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontSize: '7px', fontWeight: 700, lineHeight: 1.1, letterSpacing: '0.5px' }}><span>GB</span><span>UK</span></span><span style={{ background: '#f0c040', color: '#111', padding: '2px 8px', fontSize: '11px', fontWeight: 700, letterSpacing: '1.5px', display: 'flex', alignItems: 'center' }}>{displayCustomer?.registration_plate || 'N/A'}</span></span>],
                    ['Plan Type', planType],
                    ['Duration', getDuration()],
                    ['Mileage', displayCustomer?.mileage ? `${parseInt(displayCustomer.mileage).toLocaleString()} miles` : 'N/A'],
                    ['Start Date', displayPolicy?.policy_start_date ? format(new Date(displayPolicy.policy_start_date), 'd MMM yyyy') : 'N/A'],
                    ['End Date', displayPolicy?.policy_end_date ? format(new Date(displayPolicy.policy_end_date), 'd MMM yyyy') : 'N/A'],
                    ['Email', displayCustomer?.email || 'N/A'],
                    ['Policy No.', displayPolicy?.policy_number || 'N/A'],
                  ].map(([label, value], i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: `1px solid ${c.divider}` }}>
                      <span style={{ color: c.muted, fontWeight: '500' }}>{label}</span>
                      <span style={{ fontWeight: '600' }}>{value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Details Check Statement */}
              <div style={{ background: '#FF5A5F', color: '#fff', borderRadius: '6px', padding: '12px 16px', marginBottom: '14px', fontSize: '11px', fontWeight: 600, textAlign: 'center' }}>
                If any of the details are incorrect, please contact us on support@buyawarranty.co.uk
              </div>

              {/* Benefits */}
              <div style={{ marginBottom: '14px' }}>
                <div style={{ fontSize: '13px', fontWeight: '700', color: c.heading, marginBottom: '8px', borderBottom: `2px solid ${c.border}`, paddingBottom: '4px' }}>What Your Warranty Includes</div>
                <div style={{ background: c.benefitsBg, border: `1px solid ${c.benefitsBorder}`, borderRadius: '6px', padding: '10px 14px', marginBottom: '8px' }}>
                  <h4 style={{ color: c.benefitsHeading, fontSize: '12px', marginBottom: '6px', fontWeight: '700' }}>Key Benefits of Your Cover</h4>
                  <ul style={{ margin: '0', paddingLeft: '16px', color: c.benefitsText, fontSize: '10.5px' }}>
                    <li style={{ marginBottom: '3px' }}>Protection for major mechanical and electrical components</li>
                    {claimLimit && <li style={{ marginBottom: '3px' }}>Claims limit of £{getDisplayClaimLimitValue(claimLimit).toLocaleString()} per claim</li>}
                    {labourRate && <li style={{ marginBottom: '3px' }}>Labour rate covered up to £{labourRate}/hour</li>}
                    {excess !== undefined && excess !== null && <li style={{ marginBottom: '3px' }}>Voluntary excess of £{excess} per claim</li>}
                    <li style={{ marginBottom: '3px' }}>Access to trusted UK-wide VAT registered repair garages</li>
                    <li style={{ marginBottom: '3px' }}>Choose your own VAT registered garage option</li>
                    <li style={{ marginBottom: '3px' }}>Fast, simple claims process via our dedicated claims team</li>
                    {displayCustomer?.breakdown_recovery && <li style={{ marginBottom: '3px' }}>Breakdown recovery claimback</li>}
                  </ul>
                </div>

                {(addons.length > 0 || getBonusMonths() > 0) && (
                  <div style={{ background: c.addonsBg, border: `1px solid ${c.addonsBorder}`, borderRadius: '6px', padding: '10px 14px' }}>
                    <h4 style={{ color: c.addonsHeading, fontSize: '12px', marginBottom: '6px', fontWeight: '700' }}>Additional Included Services</h4>
                    <ul style={{ margin: '0', paddingLeft: '16px', color: c.addonsText, fontSize: '10.5px' }}>
                      {addons.map((addon, i) => (
                        <li key={i} style={{ marginBottom: '3px' }}>✓ {addon}</li>
                      ))}
                      {getBonusMonths() > 0 && (
                        <li style={{ marginBottom: '3px' }}>✓ Free extended cover: {getBonusMonths()} bonus month{getBonusMonths() > 1 ? 's' : ''}</li>
                      )}
                    </ul>
                  </div>
                )}

                <p style={{ fontSize: '10px', color: '#666', marginTop: '6px' }}>
                  Your full policy booklet (attached) includes a detailed breakdown of inclusions, exclusions, claim procedures, and general conditions. Please keep it somewhere safe for future reference.
                </p>
              </div>

              {/* Additional Notes */}
              {(displayPolicy as any)?.additional_notes && (displayPolicy as any).additional_notes.trim() && (
                <div style={{ background: isBW ? '#f5f5f5' : '#fef9ee', border: `2px solid ${isBW ? '#666' : '#f59e0b'}`, borderRadius: '6px', padding: '12px 14px', marginBottom: '14px' }}>
                  <h4 style={{ color: isBW ? '#000' : '#92400e', fontSize: '13px', marginBottom: '6px', fontWeight: '700' }}>⭐ Important Notes About Your Cover</h4>
                  <p style={{ color: isBW ? '#333' : '#78350f', fontSize: '11px', margin: '0', whiteSpace: 'pre-wrap', lineHeight: '1.5' }}>{(displayPolicy as any).additional_notes}</p>
                </div>
              )}

              {/* Claims */}
              <div style={{ background: c.claimsBg, border: `1px solid ${c.claimsBorder}`, borderRadius: '6px', padding: '10px 14px', marginBottom: '14px' }}>
                <h4 style={{ color: c.claimsHeading, fontSize: '12px', marginBottom: '4px', fontWeight: '700' }}>How to Make a Claim</h4>
                <p style={{ color: c.claimsText, fontSize: '10.5px', margin: '2px 0' }}>If your vehicle experiences a fault, simply contact our Claims Team <strong>before</strong> any repairs are carried out so we can authorise the work.</p>
                <p style={{ color: c.claimsText, fontSize: '10.5px', margin: '4px 0', fontWeight: '700' }}>Claims Hotline: 0330 229 5045</p>
                <p style={{ color: c.claimsText, fontSize: '10.5px', margin: '2px 0' }}>Opening Hours: Monday to Friday, 9am to 5pm</p>
                <p style={{ color: c.claimsText, fontSize: '10.5px', margin: '4px 0 0' }}>We aim to make claims as smooth and stress-free as possible. Our team will guide you through each step and liaise with the repairer on your behalf.</p>
              </div>

              {/* Account */}
              <div style={{ background: c.accountBg, border: `1px solid ${c.accountBorder}`, borderRadius: '6px', padding: '10px 14px', marginBottom: '14px' }}>
                <h4 style={{ color: c.accountHeading, fontSize: '12px', marginBottom: '4px', fontWeight: '700' }}>Your Account &amp; Policy Documents</h4>
                <p style={{ fontSize: '10.5px', color: '#333', margin: '2px 0' }}>Your warranty policy documents are also available online. You can access them at any time by visiting:</p>
                <p style={{ fontSize: '11px', color: c.contactValue, margin: '6px 0', fontWeight: '700' }}>https://buyawarranty.co.uk/customer-dashboard/</p>
                <p style={{ fontSize: '10.5px', color: '#333', margin: '4px 0' }}>Simply click the <strong>Login</strong> option at the top of the homepage, or go directly to the link above. Use your registered email to sign in:</p>
                <p style={{ fontSize: '10.5px', color: '#333', margin: '4px 0' }}><strong>Email:</strong> {selectedCustomer.email}</p>
                <p style={{ fontSize: '10px', color: '#555', margin: '6px 0 0' }}>Once logged in, you can:</p>
                <ul style={{ margin: '4px 0 0', paddingLeft: '16px', fontSize: '10px', color: '#555' }}>
                  <li style={{ marginBottom: '2px' }}>View and download your full warranty policy</li>
                  <li style={{ marginBottom: '2px' }}>Download your Terms &amp; Conditions</li>
                  <li style={{ marginBottom: '2px' }}>Check your vehicle and cover details</li>
                  <li style={{ marginBottom: '2px' }}>Manage your contact information</li>
                  <li style={{ marginBottom: '2px' }}>Renew or upgrade your plan when the time comes</li>
                </ul>
              </div>

              <p style={{ fontSize: '10.5px', color: '#333', marginBottom: '6px' }}>
                If there's anything you're unsure about, or if you simply want to understand your cover better, we're here for you.
              </p>

              <div style={{ marginTop: '16px', fontSize: '11px' }}>
                <p style={{ margin: '1px 0' }}>Warm regards,</p>
                <p style={{ margin: '10px 0 1px', fontWeight: '600' }}>The Buyawarranty Team</p>
              </div>

              {/* Contact Footer */}
              <div style={{ marginTop: '18px', paddingTop: '10px', borderTop: `2px solid ${c.border}`, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', fontSize: '10px' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ color: c.muted, fontSize: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Sales Enquiries</div>
                  <div style={{ color: c.contactValue, fontWeight: '600', fontSize: '12px', marginTop: '2px' }}>0330 229 5040</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ color: c.muted, fontSize: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Claims Hotline</div>
                  <div style={{ color: c.contactValue, fontWeight: '600', fontSize: '12px', marginTop: '2px' }}>0330 229 5045</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ color: c.muted, fontSize: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Customer Support</div>
                  <div style={{ color: c.contactValue, fontWeight: '600', fontSize: '12px', marginTop: '2px' }}>support@buyawarranty.co.uk</div>
                </div>
              </div>

              <div style={{ marginTop: '12px', paddingTop: '8px', borderTop: `1px solid ${c.border}`, fontSize: '8px', color: c.legal, textAlign: 'center' }}>
                Buy A Warranty Ltd is registered in England &amp; Wales. Company No: 10314863.
                Registered Address: Warranty House, 62 Berkhamsted Ave, Wembley, HA9 6DT.
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Posted Letters Log Register */}
      <PostedLettersLog />
    </div>
  );
};

