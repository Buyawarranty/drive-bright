import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { ArrowRight, Mail, MessageCircle, Loader2, History, RefreshCw, Eye, Zap, CreditCard, Calendar, Link as LinkIcon, UserCheck, CheckCircle2, Send, AlertCircle, Save, Pencil, ChevronDown, Gift, BookOpen, Trash2, CalendarIcon, Info, Users, KeyRound, FileText, Car, Copy } from 'lucide-react';
import { DuplicateWarrantyDialog } from './DuplicateWarrantyDialog';
import { PaidOrdersTab } from './PaidOrdersTab';
import CustomerLoginsTab from './CustomerLoginsTab';
import CustomerPolicyUpdateTab from './CustomerPolicyUpdateTab';
import { format, addDays, isBefore, startOfDay, isToday } from 'date-fns';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { LeadSearchPopover, LeadData } from './LeadSearchPopover';
import MileageSlider from '@/components/MileageSlider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { 
  calculateTotalWarrantyPrice, 
  DURATION_MONTHS,
  type PaymentPeriod 
} from '@/lib/pricingMatrix';
import { calculateAddOnPrice, getAutoIncludedAddOns, getAddOnInfo } from '@/lib/addOnsUtils';
import { calculateVehiclePriceAdjustment } from '@/lib/vehicleValidation';
import { useMotMileage } from '@/hooks/useMotMileage';
import { CLAIM_LIMIT_TIERS, isPremiumVehicle, getBaseClaimLimit, getClaimLimitSurcharge, getClaimLimitSurchargeMonthly, PREMIUM_CLAIM_MONTHLY, getDisplayClaimLimitValue } from '@/lib/claimLimitTiers';

interface VehicleData {
  regNumber: string;
  mileage: string;
  make?: string;
  model?: string;
  fuelType?: string;
  transmission?: string;
  year?: string;
  vehicleType?: string;
}

// Step 3 exact options
const termOptions = [
  { id: '12months', label: '1-Year Cover', months: 12, bonus: 3 },
  { id: '24months', label: '2-Year Cover', months: 24, bonus: 3, isPopular: true },
  { id: '36months', label: '3-Year Cover', months: 36, bonus: 3, isBestValue: true }
];

const excessOptions = [0, 50, 100, 150];

const claimLimitOptions = [
  { value: 750, label: '£1,000', description: 'AutoCare Basic' },
  { value: 2000, label: '£2,000', description: 'AutoCare Essential', popular: true },
  { value: 3000, label: '£3,000', description: 'AutoCare Elite' },
  { value: 5000, label: '£5,000', description: 'AutoCare Premium' },
];

// Helper to get visible claim limits based on vehicle make
const getVisibleClaimLimits = (vehicleMake?: string) => {
  if (isPremiumVehicle(vehicleMake)) {
    return claimLimitOptions.filter(opt => opt.value !== 5000);
  }
  return claimLimitOptions;
};

const labourRateOptions = [
  { rate: 50, label: '£50/hr', description: 'Local Garages', isBestValue: true },
  { rate: 70, label: '£70/hr', description: 'Independent Garages', isPopular: true },
  { rate: 100, label: '£100/hr', description: 'Approved Garages' },
  { rate: 200, label: '£200/hr', description: 'Expert Garages' }
];

// Mileage dropdown options (10,000 to 140,000 in 1,000 increments)
const mileageDropdownOptions = Array.from({ length: 131 }, (_, i) => 10000 + (i * 1000));

interface GetQuoteTabProps {
  prePopulatedLead?: LeadData | null;
}

export const GetQuoteTab: React.FC<GetQuoteTabProps> = ({ prePopulatedLead }) => {
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [regNumber, setRegNumber] = useState('');
  const [mileage, setMileage] = useState('');
  const [sliderMileage, setSliderMileage] = useState(0);
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [vehicleData, setVehicleData] = useState<VehicleData | null>(null);
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerDob, setCustomerDob] = useState('');
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [paymentType, setPaymentType] = useState<PaymentPeriod>('24months');
  const [excessAmount, setExcessAmount] = useState(100);
  const [claimLimit, setClaimLimit] = useState(2000);
  const [ageOverrideEnabled, setAgeOverrideEnabled] = useState(false);
  const [showAgeOverrideConfirm, setShowAgeOverrideConfirm] = useState(false);
  const [pendingAgeOverrideAction, setPendingAgeOverrideAction] = useState<'lookup' | 'quickConfirm' | null>(null);
  const [labourRate, setLabourRate] = useState(70);
  const [boostAddon, setBoostAddon] = useState(false);
  const [selectedAddOns, setSelectedAddOns] = useState<{ [key: string]: boolean }>({});
  const [additionalNotes, setAdditionalNotes] = useState('');
  const [freeExtendedCover, setFreeExtendedCover] = useState<'none' | '3months' | '6months'>('none');
  const [includePayInFullDiscount, setIncludePayInFullDiscount] = useState(false); // Default OFF - must opt-in to give 10% discount
  
  // Validation state
  const [showNameError, setShowNameError] = useState(false);
  const [showEmailError, setShowEmailError] = useState(false);
  const [customMonthlyPrice, setCustomMonthlyPrice] = useState('');
  const [customFullPrice, setCustomFullPrice] = useState('');
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [emailContent, setEmailContent] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [sentQuotes, setSentQuotes] = useState<any[]>([]);
  const [savedQuotes, setSavedQuotes] = useState<any[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [showHistoryDialog, setShowHistoryDialog] = useState(false);
  const [selectedHistoryQuote, setSelectedHistoryQuote] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('new');
  const [historySubTab, setHistorySubTab] = useState<'sent' | 'saved'>('sent');
  const [paidOrdersCount, setPaidOrdersCount] = useState(0);
  const [adminEmail, setAdminEmail] = useState<string | null>(null);
  const [adminName, setAdminName] = useState<string | null>(null);
  const [additionalEmails, setAdditionalEmails] = useState<string[]>([]);
  const [newEmailInput, setNewEmailInput] = useState('');
  
  // Confirm External Payment state
  const [isConfirmingPaid, setIsConfirmingPaid] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState<{ show: boolean; record?: any }>({ show: false });
  const [showConfirmPaymentDialog, setShowConfirmPaymentDialog] = useState(false);
  const [paymentSource, setPaymentSource] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);
  const [paymentNotes, setPaymentNotes] = useState('');
  const [sendToW2k, setSendToW2k] = useState(true);
  const [sendWelcomeEmail, setSendWelcomeEmail] = useState(true);
  const [existingPolicyWarning, setExistingPolicyWarning] = useState<string | null>(null);
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  const [externalPaymentStep, setExternalPaymentStep] = useState<'details' | 'preview' | 'complete'>('details');
  
  // Warranty Start Date (separate from payment date)
  const [warrantyStartDate, setWarrantyStartDate] = useState<Date>(new Date());
  const [isStartDateCalendarOpen, setIsStartDateCalendarOpen] = useState(false);
  const [isQuickConfirming, setIsQuickConfirming] = useState(false);
  
  // Customer address fields for external payment
  const [customerPostcode, setCustomerPostcode] = useState('');
  const [customerStreet, setCustomerStreet] = useState('');
  const [customerTown, setCustomerTown] = useState('');
  const [customerBuildingNumber, setCustomerBuildingNumber] = useState('');
  const [customerCounty, setCustomerCounty] = useState('');
  const [skipAddressDetails, setSkipAddressDetails] = useState(false);
  
  // Editable customer fields for external payment dialog
  const [editableCustomerName, setEditableCustomerName] = useState('');
  const [editableCustomerEmail, setEditableCustomerEmail] = useState('');
  const [editableCustomerPhone, setEditableCustomerPhone] = useState('');
  const [editableMileage, setEditableMileage] = useState('');
  const [editableRegNumber, setEditableRegNumber] = useState('');
  const [mileagePrefilledFromMot, setMileagePrefilledFromMot] = useState(false);
  
  // Section expand/collapse state for external payment dialog - all open by default
  const [expandedSections, setExpandedSections] = useState({
    customerVehicle: true,
    address: true,
    policyConfig: true,
    payment: true,
  });
  
  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };
  // Completion status tracking
  const [completionStatus, setCompletionStatus] = useState<{
    policyCreated: boolean;
    emailSent: boolean | null; // null = pending, true = success, false = failed
    w2000Sent: boolean | null; // null = pending/scheduled, true = success, false = failed
    warrantyReference: string;
    isFutureStart: boolean;
  } | null>(null);

  // Handle lead selection (from search or pre-populated)
  const handleLeadSelect = (lead: LeadData) => {
    setSelectedLeadId(lead.id);
    setCustomerEmail(lead.email);
    setCustomerName(`${lead.first_name || ''} ${lead.last_name || ''}`.trim());
    setCustomerPhone(lead.phone || '');
    
    if (lead.vehicle_reg) {
      setRegNumber(lead.vehicle_reg.toUpperCase());
    }
    if (lead.mileage) {
      const numMileage = parseInt(lead.mileage.replace(/,/g, ''), 10);
      if (!isNaN(numMileage)) {
        setMileage(numMileage.toLocaleString());
        setSliderMileage(numMileage);
      }
    }
    
    toast({
      title: "Lead imported",
      description: `Details for ${lead.first_name || lead.email} have been loaded.`,
    });
  };

  // Handle pre-populated lead on mount
  useEffect(() => {
    if (prePopulatedLead) {
      handleLeadSelect(prePopulatedLead);
    }
  }, [prePopulatedLead]);

  // MOT mileage lookup for external payment dialog
  const { motMileage, motDate, isLoading: motMileageLoading } = useMotMileage(editableRegNumber);
  
  // Auto-prefill mileage from MOT when available
  useEffect(() => {
    if (motMileage && !editableMileage && !mileagePrefilledFromMot) {
      setEditableMileage(motMileage.toString());
      setMileagePrefilledFromMot(true);
    }
  }, [motMileage, editableMileage, mileagePrefilledFromMot]);

  // Get admin email on mount
  useEffect(() => {
    const getAdminEmail = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: adminUser } = await supabase
          .from('admin_users')
          .select('email, first_name, last_name')
          .eq('user_id', user.id)
          .single();
        setAdminEmail(adminUser?.email || user.email || null);
        const fullName = [adminUser?.first_name, adminUser?.last_name].filter(Boolean).join(' ');
        setAdminName(fullName || null);
      }
    };
    getAdminEmail();
    loadSentQuotesHistory();
    loadSavedQuotes();
    loadPaidOrdersCount();
  }, []);

  // Load paid orders count
  const loadPaidOrdersCount = async () => {
    try {
      const { count } = await supabase
        .from('live_quotes')
        .select('*', { count: 'exact', head: true })
        .in('status', ['paid', 'paid_externally']);
      setPaidOrdersCount(count || 0);
    } catch (e) {
      console.error('Error loading paid orders count:', e);
    }
  };

  // Load saved quotes from localStorage
  const loadSavedQuotes = () => {
    try {
      const saved = JSON.parse(localStorage.getItem('admin_saved_quotes') || '[]');
      setSavedQuotes(saved);
    } catch (e) {
      console.error('Error loading saved quotes:', e);
      setSavedQuotes([]);
    }
  };

  // Load a saved quote into the form
  const loadSavedQuote = (savedQuote: any) => {
    if (savedQuote.vehicleData) {
      setVehicleData(savedQuote.vehicleData);
      setRegNumber(savedQuote.vehicleData.regNumber || '');
      setMileage(savedQuote.vehicleData.mileage || '');
      const numMileage = parseInt(String(savedQuote.vehicleData.mileage).replace(/,/g, ''), 10);
      if (!isNaN(numMileage)) setSliderMileage(numMileage);
    }
    setCustomerName(savedQuote.customerName || '');
    setCustomerEmail(savedQuote.customerEmail || '');
    setCustomerPhone(savedQuote.customerPhone || '');
    const loadedPaymentType = savedQuote.paymentType || '24months';
    setPaymentType(loadedPaymentType);
    setExcessAmount(savedQuote.excessAmount || 100);
    setClaimLimit(savedQuote.claimLimit || 2000);
    setLabourRate(savedQuote.labourRate || 70);
    setBoostAddon(savedQuote.boostAddon || false);
    setSelectedAddOns(savedQuote.selectedAddOns || {});
    setFreeExtendedCover(savedQuote.freeExtendedCover || 'none');
    setAdditionalNotes(savedQuote.additionalNotes || '');
    
    // Set step based on available data
    if (savedQuote.vehicleData) {
      setStep(2);
    }
    
    setActiveTab('new');
    toast({
      title: "Quote loaded",
      description: "Saved quote has been loaded. You can continue editing.",
    });
  };

  // Delete a saved quote
  const deleteSavedQuote = (index: number) => {
    const updated = [...savedQuotes];
    updated.splice(index, 1);
    localStorage.setItem('admin_saved_quotes', JSON.stringify(updated));
    setSavedQuotes(updated);
    toast({
      title: "Quote deleted",
      description: "Saved quote has been removed.",
    });
  };

  // Track if custom prices have been manually overridden
  const [isPriceOverridden, setIsPriceOverridden] = useState(false);

  // Calculate base price (before any custom overrides)
  const calculateBasePrice = () => {
    // Get duration months for add-on calculation
    const durationMonths = DURATION_MONTHS[paymentType] || 12;
    
    // Auto-included add-ons based on duration (2yr gets breakdown, 3yr gets breakdown+rental)
    const autoIncluded = getAutoIncludedAddOns(paymentType);
    
    // Calculate add-on price from selected add-ons (excluding auto-included)
    const addOnPrice = calculateAddOnPrice(selectedAddOns, paymentType, durationMonths);
    
    // Calculate vehicle adjustment (high-mileage surcharge: +£200/+£400/+£600 for 1/2/3-year)
    // This matches Step 3 pricing logic exactly
    const warrantyYears = paymentType === '12months' ? 1 : paymentType === '24months' ? 2 : 3;
    const vehicleMileage = parseInt(mileage.replace(/[^0-9]/g, '')) || 0;
    const vehicleAdjustmentResult = calculateVehiclePriceAdjustment(
      { 
        mileage: vehicleMileage.toString(),
        make: vehicleData?.make || '',
        model: vehicleData?.model || '',
        year: vehicleData?.year || '',
        vehicleType: vehicleData?.vehicleType || '',
        regNumber: vehicleData?.regNumber || regNumber || ''
      }, 
      warrantyYears
    );
    
    console.log('🔍 Admin Quote - Vehicle Adjustment:', {
      mileage: vehicleMileage,
      warrantyYears,
      adjustmentAmount: vehicleAdjustmentResult.adjustmentAmount,
      adjustmentType: vehicleAdjustmentResult.adjustmentType
    });
    
     const effectiveClaimLimit = getBaseClaimLimit(claimLimit);
    const premiumSurcharge = getClaimLimitSurcharge(claimLimit, paymentType, excessAmount);
    
    const result = calculateTotalWarrantyPrice({
      paymentPeriod: paymentType,
      voluntaryExcess: excessAmount,
      claimLimit: effectiveClaimLimit,
      labourRate: labourRate,
      boostEnabled: boostAddon,
      vehicleAdjustment: vehicleAdjustmentResult.adjustmentAmount,
      addOnPrice: addOnPrice + premiumSurcharge
    });
    
    // Calculate pay-in-full based on monthly × 12 for consistency (avoids rounding discrepancies)
    const contractTotal = result.monthlyPrice * 12;
    const payInFullPrice = includePayInFullDiscount 
      ? Math.floor(contractTotal * 0.90)
      : contractTotal;
    
    return { 
      totalPrice: result.totalPrice, 
      monthlyPrice: result.monthlyPrice,
      payInFullPrice,
      wasPrice: result.wasPrice,
      savings: result.savings
    };
  };

  // Calculate price using pricingMatrix.ts with add-ons
  const calculatePrice = () => {
    // If custom prices are set and user has manually overridden, use them
    if (isPriceOverridden) {
      if (customFullPrice && parseFloat(customFullPrice) > 0) {
        const fullPrice = parseFloat(customFullPrice);
        const monthly = Math.floor(fullPrice / 12);
        const contractTotal = monthly * 12; // Consistent with what customer actually pays monthly
        return { 
          totalPrice: fullPrice, 
          monthlyPrice: monthly,
          payInFullPrice: includePayInFullDiscount ? Math.floor(contractTotal * 0.90) : contractTotal,
          wasPrice: 0,
          savings: 0
        };
      }
      if (customMonthlyPrice && parseFloat(customMonthlyPrice) > 0) {
        const monthly = parseFloat(customMonthlyPrice);
        const total = monthly * 12;
        return { 
          totalPrice: total, 
          monthlyPrice: monthly,
          payInFullPrice: includePayInFullDiscount ? Math.floor(total * 0.90) : total,
          wasPrice: 0,
          savings: 0
        };
      }
    }
    
    return calculateBasePrice();
  };

  const currentPrice = calculatePrice();
  const basePrice = calculateBasePrice();

  // Reset price override when any selection changes
  useEffect(() => {
    setIsPriceOverridden(false);
  }, [paymentType, excessAmount, claimLimit, labourRate, boostAddon, selectedAddOns]);

  // Reset claim limit if premium vehicle selected and £5000 was chosen
  useEffect(() => {
    if (claimLimit === 5000 && isPremiumVehicle(vehicleData?.make)) {
      setClaimLimit(2000);
    }
  }, [vehicleData?.make]);

  // Auto-populate custom price fields when selections change (if not manually overridden)
  useEffect(() => {
    if (!isPriceOverridden) {
      setCustomMonthlyPrice(basePrice.monthlyPrice.toString());
      setCustomFullPrice(basePrice.totalPrice.toString());
    }
  }, [paymentType, excessAmount, claimLimit, labourRate, boostAddon, selectedAddOns, isPriceOverridden]);

  // Handle custom price field changes
  const handleCustomMonthlyChange = (value: string) => {
    // Allow empty or partial input for better UX
    const sanitized = value.replace(/[^0-9.]/g, '');
    setCustomMonthlyPrice(sanitized);
    const parsed = parseFloat(sanitized);
    if (sanitized && !isNaN(parsed) && parsed > 0) {
      setIsPriceOverridden(true);
      const fullPrice = parsed * 12;
      setCustomFullPrice(fullPrice.toString());
    } else if (!sanitized) {
      setIsPriceOverridden(false);
    }
  };

  const handleCustomFullChange = (value: string) => {
    const sanitized = value.replace(/[^0-9.]/g, '');
    setCustomFullPrice(sanitized);
    const parsed = parseFloat(sanitized);
    if (sanitized && !isNaN(parsed) && parsed > 0) {
      setIsPriceOverridden(true);
      const monthly = Math.floor(parsed / 12);
      setCustomMonthlyPrice(monthly.toString());
    } else if (!sanitized) {
      setIsPriceOverridden(false);
    }
  };

  const resetToCalculatedPrice = () => {
    setIsPriceOverridden(false);
    setCustomMonthlyPrice(basePrice.monthlyPrice.toString());
    setCustomFullPrice(basePrice.totalPrice.toString());
  };

  const formatRegNumber = (value: string) => {
    return value.replace(/\s/g, '').toUpperCase();
  };

  const handleMileageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/[^0-9]/g, '');
    setMileage(value);
    const numValue = parseInt(value, 10);
    if (!isNaN(numValue)) {
      setSliderMileage(numValue);
    }
  };

  const handleSliderChange = (value: number) => {
    setSliderMileage(value);
    setMileage(value.toString());
  };

  const handleVehicleLookup = async () => {
    if (!regNumber.trim() || !mileage.trim()) {
      toast({
        title: "Missing Information",
        description: "Please enter both registration number and mileage",
        variant: "destructive",
      });
      return;
    }

    setIsLookingUp(true);
    try {
      // Add timeout to prevent infinite loading - 30s for cold starts
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);
      
      const { data, error } = await supabase.functions.invoke('dvla-vehicle-lookup', {
        body: { registrationNumber: regNumber, skipAgeCheck: ageOverrideEnabled }
      });
      
      clearTimeout(timeoutId);

      if (error) {
        console.error('DVLA lookup error:', error);
        toast({
          title: "Lookup Failed",
          description: error.message || "Unable to connect to vehicle database. Please try again.",
          variant: "destructive",
        });
        setIsLookingUp(false);
        return;
      }

      if (data?.error || !data?.make || !data?.model) {
        toast({
          title: "Vehicle Not Found",
          description: data?.error || "Unable to find vehicle details. Please check the registration number and try again.",
          variant: "destructive",
        });
        setIsLookingUp(false);
        return;
      }

      if (data.yearOfManufacture || data.year) {
        const currentYear = new Date().getFullYear();
        const vehicleYear = parseInt(data.yearOfManufacture || data.year, 10);
        if (!isNaN(vehicleYear) && vehicleYear > 0) {
          const vehicleAge = currentYear - vehicleYear;
          if (vehicleAge > 15 && !ageOverrideEnabled) {
            toast({
              title: "Vehicle Too Old",
              description: `This vehicle is ${vehicleAge} years old. We only cover vehicles up to 15 years old.`,
              variant: "destructive",
            });
            setIsLookingUp(false);
            return;
          }
        }
      }

      setVehicleData({
        regNumber: regNumber.toUpperCase(),
        mileage: mileage,
        make: data.make,
        model: data.model,
        fuelType: data.fuelType || '',
        transmission: data.transmission || '',
        year: data.yearOfManufacture || data.year || '',
        vehicleType: data.vehicleType || '',
      });
      
      setStep(2);
    } catch (error: any) {
      console.error('Error looking up vehicle:', error);
      const msg = error?.name === 'AbortError' 
        ? 'Request timed out. Please try again.' 
        : (error?.message || 'Unable to connect to vehicle database. Please try again.');
      toast({
        title: "Lookup Failed",
        description: msg,
        variant: "destructive",
      });
    } finally {
      setIsLookingUp(false);
    }
  };

  // Quick Confirm Order - skips Step 2 and goes directly to Confirm External Payment
  const handleQuickConfirmOrder = async () => {
    if (!regNumber.trim()) {
      toast({
        title: "Missing Registration",
        description: "Please enter a registration number",
        variant: "destructive",
      });
      return;
    }

    // If no mileage, default to 0 - can be edited in dialog
    const effectiveMileage = mileage.trim() || '0';

    setIsQuickConfirming(true);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);
      
      const { data, error } = await supabase.functions.invoke('dvla-vehicle-lookup', {
        body: { registrationNumber: regNumber, skipAgeCheck: ageOverrideEnabled }
      });
      
      clearTimeout(timeoutId);

      if (error) {
        console.error('DVLA lookup error:', error);
        toast({
          title: "Lookup Failed",
          description: error.message || "Unable to connect to vehicle database. Please try again.",
          variant: "destructive",
        });
        setIsQuickConfirming(false);
        return;
      }

      if (data?.error || !data?.make || !data?.model) {
        toast({
          title: "Vehicle Not Found",
          description: data?.error || "Unable to find vehicle details. Please check the registration number and try again.",
          variant: "destructive",
        });
        setIsQuickConfirming(false);
        return;
      }

      if (data.yearOfManufacture || data.year) {
        const currentYear = new Date().getFullYear();
        const vehicleYear = parseInt(data.yearOfManufacture || data.year, 10);
        if (!isNaN(vehicleYear) && vehicleYear > 0) {
          const vehicleAge = currentYear - vehicleYear;
          if (vehicleAge > 15 && !ageOverrideEnabled) {
            toast({
              title: "Vehicle Too Old",
              description: `This vehicle is ${vehicleAge} years old. We only cover vehicles up to 15 years old.`,
              variant: "destructive",
            });
            setIsQuickConfirming(false);
            return;
          }
        }
      }

      // Set vehicle data
      setVehicleData({
        regNumber: regNumber.toUpperCase(),
        mileage: effectiveMileage,
        make: data.make,
        model: data.model,
        fuelType: data.fuelType || '',
        transmission: data.transmission || '',
        year: data.yearOfManufacture || data.year || '',
        vehicleType: data.vehicleType || '',
      });
      
      // Reset payment dialog state for fresh entry
      setPaymentSource('');
      setPaymentAmount('');
      setPaymentDate(new Date().toISOString().split('T')[0]);
      setPaymentConfirmed(false);
      setPaymentNotes('');
      setWarrantyStartDate(new Date());
      setExternalPaymentStep('details');
      setCompletionStatus(null);
      
      // Open the Confirm External Payment dialog directly
      setShowConfirmPaymentDialog(true);
      
      toast({
        title: "Vehicle Found",
        description: `${data.make} ${data.model} (${data.yearOfManufacture || data.year}) - Ready to confirm order`,
      });
    } catch (error: any) {
      console.error('Error looking up vehicle:', error);
      const msg = error?.name === 'AbortError' 
        ? 'Request timed out. Please try again.' 
        : (error?.message || 'Unable to connect to vehicle database. Please try again.');
      toast({
        title: "Lookup Failed",
        description: msg,
        variant: "destructive",
      });
    } finally {
      setIsQuickConfirming(false);
    }
  };

  const loadSentQuotesHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const { data, error } = await supabase
        .from('admin_sent_quotes')
        .select('*')
        .order('sent_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setSentQuotes(data || []);
    } catch (error) {
      console.error('Error loading sent quotes:', error);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handleCalculateQuote = () => {
    let hasError = false;
    
    if (!customerName.trim()) {
      setShowNameError(true);
      hasError = true;
    } else {
      setShowNameError(false);
    }
    
    if (!customerEmail.trim() || !customerEmail.includes('@')) {
      setShowEmailError(true);
      hasError = true;
    } else {
      setShowEmailError(false);
    }
    
    if (hasError) {
      toast({
        title: "Missing Information",
        description: "Please fill in customer name and a valid email address",
        variant: "destructive",
      });
      // Auto-scroll to the top so user can see the error fields
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    setStep(3);
  };
  
  // Toggle an add-on
  const handleToggleAddOn = (key: string) => {
    setSelectedAddOns(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const generateEmailSubject = (): string => {
    return `Your ${vehicleData?.make} ${vehicleData?.model} warranty quote is ready – choose how to pay`;
  };

  const handlePreviewEmail = () => {
    if (!quoteLink) {
      toast({
        title: "Quote Link Required",
        description: "Please wait for the quote link to be generated first.",
        variant: "destructive",
      });
      return;
    }
    setEmailSubject(generateEmailSubject());
    setShowEmailDialog(true);
  };

  const handleSendEmail = async () => {
    if (!quoteLink) {
      toast({
        title: "Quote Link Required",
        description: "Please wait for the quote link to be generated first.",
        variant: "destructive",
      });
      return;
    }

    setIsSendingEmail(true);
    try {
      console.log('🚀 Starting quote send process...');
      const { data: { user } } = await supabase.auth.getUser();
      
      // Generate unique quote ID for restoration
      const quoteId = `ADMIN-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const displayClaimLimit = boostAddon ? getDisplayClaimLimitValue(claimLimit) + 1000 : getDisplayClaimLimitValue(claimLimit);
      const termOption = termOptions.find(t => t.id === paymentType);
      const coverMonths = termOption?.months || 12;
      // Map freeExtendedCover to bonusMonths - only show bonus if explicitly selected
      const bonusMonthsMap: Record<string, number> = { 'none': 0, '3months': 3, '6months': 6 };
      const bonusMonths = bonusMonthsMap[freeExtendedCover] || 0;

      // CRITICAL: Sync the live_quotes record with current form values
      // This ensures the quote link and the email always show the same details
      const accessToken = quoteLink.split('/quote/')[1];
      if (accessToken) {
        console.log('🔄 Syncing live_quotes with current form values...');
        const durationMap: Record<string, number> = { '12months': 12, '24months': 24, '36months': 36 };
        const { error: syncError } = await supabase
          .from('live_quotes')
          .update({
            excess_amount: excessAmount,
            claim_limit: claimLimit,
            labour_rate: labourRate,
            boost_addon: boostAddon,
            duration_months: durationMap[paymentType] || 12,
            bonus_months: bonusMonths,
            monthly_price: currentPrice.monthlyPrice,
            upfront_price: currentPrice.payInFullPrice || Math.floor(currentPrice.monthlyPrice * 12 * 0.90),
            customer_name: customerName,
            customer_email: customerEmail,
          })
          .eq('access_token', accessToken);
        
        if (syncError) {
          console.error('⚠️ Failed to sync live_quotes:', syncError);
        } else {
          console.log('✅ live_quotes synced with current form values');
        }
      }

      // Build recipients - customer + admin copy + additional emails
      const allCcEmails = [
        ...(adminEmail && adminEmail !== customerEmail ? [adminEmail] : []),
        ...additionalEmails.filter(e => e !== customerEmail && e !== adminEmail)
      ];

      console.log('📧 Sending email to:', customerEmail);
      console.log('📧 CC emails:', allCcEmails);
      console.log('📎 Quote link:', quoteLink);
      
      // Send the email with HTML template (to customer with CC to admin and additional recipients)
      const { error: emailError } = await supabase.functions.invoke('send-admin-quote', {
        body: {
          to: customerEmail,
          cc: allCcEmails.length > 0 ? allCcEmails : undefined,
          subject: emailSubject,
          quoteLink: quoteLink,
          customerName,
          vehicleData,
          quoteDetails: {
            plan: 'Platinum',
            paymentType,
            totalPrice: currentPrice.totalPrice,
            monthlyPrice: currentPrice.monthlyPrice,
            excessAmount,
            claimLimit: displayClaimLimit,
            labourRate,
            boostAddon,
            coverMonths,
            bonusMonths
          }
        }
      });

      if (emailError) {
        console.error('❌ Email sending failed:', emailError);
        throw new Error(`Email failed: ${emailError.message}`);
      }
      
      console.log('✅ Email sent successfully');

      // Save to quote_data for restoration
      console.log('💾 Saving to quote_data for restoration...');
      const { error: quoteDataError } = await supabase
        .from('quote_data')
        .insert({
          quote_id: quoteId,
          customer_email: customerEmail,
          vehicle_data: {
            regNumber: vehicleData?.regNumber,
            mileage: vehicleData?.mileage,
            make: vehicleData?.make,
            model: vehicleData?.model,
            year: vehicleData?.year,
            vehicleType: vehicleData?.vehicleType,
            fuelType: vehicleData?.fuelType,
            transmission: vehicleData?.transmission
          },
          plan_data: {
            paymentType,
            claimLimit,
            labourRate,
            voluntaryExcess: excessAmount,
            boostAddon,
            addOns: [],
            additionalNotes
          },
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
        });

      if (quoteDataError) {
        console.error('⚠️ Failed to save quote_data for restoration:', quoteDataError);
      } else {
        console.log('✅ Quote saved for restoration with ID:', quoteId);
      }

      // Save to admin_sent_quotes for tracking
      console.log('💾 Saving to admin_sent_quotes...');
      const { error: quoteError } = await supabase
        .from('admin_sent_quotes')
        .insert({
          customer_name: customerName,
          customer_email: customerEmail,
          vehicle_reg: vehicleData?.regNumber || '',
          vehicle_make: vehicleData?.make,
          vehicle_model: vehicleData?.model,
          vehicle_year: vehicleData?.year,
          vehicle_mileage: vehicleData?.mileage,
          vehicle_fuel_type: vehicleData?.fuelType,
          vehicle_transmission: vehicleData?.transmission,
          vehicle_type: vehicleData?.vehicleType,
          plan_name: 'Platinum',
          payment_type: paymentType,
          excess_amount: excessAmount,
          claim_limit: displayClaimLimit,
          total_price: currentPrice.totalPrice,
          monthly_price: currentPrice.monthlyPrice,
          labour_rate: labourRate,
          boost_addon: boostAddon,
          additional_notes: additionalNotes || null,
          email_subject: emailSubject,
          email_content: emailContent,
          sent_by: user?.id
        });

      if (quoteError) {
        console.error('❌ Failed to save quote to history:', quoteError);
        toast({
          title: "Email Sent (History Not Saved)",
          description: `Quote was emailed to ${customerEmail} but couldn't be saved to history.`,
          variant: "destructive",
        });
        return;
      }
      
      console.log('✅ Quote saved to admin_sent_quotes');

      // Update existing leads to "quote_sent" status
      // First, update sales_leads by email or vehicle_reg
      console.log('📋 Updating existing leads to quote_sent status...');
      const emailLower = customerEmail.toLowerCase();
      const vehicleRegClean = vehicleData?.regNumber?.replace(/\s/g, '').toUpperCase();
      
      // Update sales_leads matching this email
      const { error: salesLeadError } = await supabase
        .from('sales_leads')
        .update({ 
          status: 'quote_sent', 
          updated_at: new Date().toISOString(),
          last_activity_date: new Date().toISOString()
        })
        .or(`email.ilike.${emailLower}${vehicleRegClean ? `,vehicle_reg.ilike.${vehicleRegClean}` : ''}`);
      
      if (salesLeadError) {
        console.error('Failed to update sales_leads status:', salesLeadError);
      } else {
        console.log('✅ Updated sales_leads to quote_sent');
      }

      // Update abandoned_carts matching this email or reg to quote_sent
      const { error: cartUpdateError } = await supabase
        .from('abandoned_carts')
        .update({ 
          contact_status: 'quote_sent', 
          updated_at: new Date().toISOString() 
        })
        .or(`email.ilike.${emailLower}${vehicleRegClean ? `,vehicle_reg.ilike.${vehicleRegClean}` : ''}`);
      
      if (cartUpdateError) {
        console.error('Failed to update abandoned_carts status:', cartUpdateError);
      } else {
        console.log('✅ Updated abandoned_carts to quote_sent');
      }

      // Add to abandoned_carts if no existing cart (for tracking purposes)
      console.log('📋 Adding to abandoned_carts with quote_sent status...');
      await supabase
        .from('abandoned_carts')
        .upsert({
          email: customerEmail,
          full_name: customerName,
          phone: '',
          vehicle_reg: vehicleData?.regNumber,
          vehicle_make: vehicleData?.make,
          vehicle_model: vehicleData?.model,
          vehicle_year: vehicleData?.year,
          vehicle_type: vehicleData?.vehicleType,
          mileage: vehicleData?.mileage,
          plan_name: 'Platinum',
          payment_type: paymentType,
          step_abandoned: 3,
          contact_status: 'quote_sent',
          cart_metadata: {
            excess: excessAmount,
            claimLimit: displayClaimLimit,
            labourRate,
            boostAddon,
            totalPrice: currentPrice.totalPrice,
            quoteSource: 'admin_sent',
            quoteId,
            additionalNotes
          }
        }, { onConflict: 'email', ignoreDuplicates: true });

      const copyMessage = adminEmail ? ` A copy was also sent to ${adminEmail}.` : '';
      toast({
        title: "✅ Quote Sent Successfully!",
        description: `Email sent to ${customerEmail}.${copyMessage}`,
        duration: 5000,
      });
      
      await loadSentQuotesHistory();
      
      setShowEmailDialog(false);
      // Reset form
      setStep(1);
      setRegNumber('');
      setMileage('');
      setSliderMileage(0);
      setVehicleData(null);
      setCustomerEmail('');
      setCustomerName('');
      setCustomerDob('');
      setPaymentType('24months');
      setExcessAmount(100);
      setClaimLimit(2000);
      setLabourRate(70);
      setBoostAddon(false);
      setAdditionalNotes('');
      setCustomMonthlyPrice('');
      setCustomFullPrice('');
      setIsPriceOverridden(false);
      setQuoteLink(null);
      setQuoteGenerated(false);
      
    } catch (error: any) {
      console.error('💥 Error in quote send process:', error);
      toast({
        title: "❌ Error Sending Quote",
        description: error.message || "Failed to send quote. Check console for details.",
        variant: "destructive",
        duration: 7000,
      });
    } finally {
      setIsSendingEmail(false);
    }
  };

  const handleResendQuote = async (quote: any) => {
    try {
      setIsSendingEmail(true);
      console.log('🔄 Resending quote to:', quote.customer_email);
      
      const { error: emailError } = await supabase.functions.invoke('send-admin-quote', {
        body: {
          to: quote.customer_email,
          cc: adminEmail !== quote.customer_email ? adminEmail : undefined,
          subject: `[RESENT] ${quote.email_subject}`,
          content: quote.email_content,
          vehicleData: {
            regNumber: quote.vehicle_reg,
            mileage: quote.vehicle_mileage,
            make: quote.vehicle_make,
            model: quote.vehicle_model,
            year: quote.vehicle_year,
            fuelType: quote.vehicle_fuel_type,
            transmission: quote.vehicle_transmission,
            vehicleType: quote.vehicle_type
          },
          quoteDetails: {
            plan: quote.plan_name,
            paymentType: quote.payment_type,
            price: quote.total_price,
            excessAmount: quote.excess_amount,
            claimLimit: quote.claim_limit,
            labourRate: quote.labour_rate || 70,
            boostAddon: quote.boost_addon || false
          }
        }
      });

      if (emailError) {
        throw new Error(`Email failed: ${emailError.message}`);
      }

      await supabase
        .from('admin_sent_quotes')
        .update({
          resent_count: (quote.resent_count || 0) + 1,
          last_resent_at: new Date().toISOString()
        })
        .eq('id', quote.id);

      const copyMessage = adminEmail ? ` A copy was also sent to ${adminEmail}.` : '';
      toast({
        title: "✅ Quote Resent Successfully!",
        description: `Email resent to ${quote.customer_email}.${copyMessage}`,
        duration: 5000,
      });

      await loadSentQuotesHistory();
    } catch (error: any) {
      console.error('💥 Error resending quote:', error);
      toast({
        title: "❌ Error Resending Quote",
        description: error.message || "Failed to resend quote.",
        variant: "destructive",
      });
    } finally {
      setIsSendingEmail(false);
    }
  };

  // Edit a sent quote - load it into the form for modification and resend
  const handleEditQuote = (quote: any) => {
    // Set customer data
    setCustomerName(quote.customer_name || '');
    setCustomerEmail(quote.customer_email || '');
    setCustomerPhone(''); // Not stored in sent quotes
    
    // Set vehicle data
    const vehicleDataFromQuote = {
      regNumber: quote.vehicle_reg || '',
      mileage: quote.vehicle_mileage || '',
      make: quote.vehicle_make || '',
      model: quote.vehicle_model || '',
      year: quote.vehicle_year || '',
      fuelType: quote.vehicle_fuel_type || '',
      transmission: quote.vehicle_transmission || '',
      vehicleType: quote.vehicle_type || '',
    };
    setVehicleData(vehicleDataFromQuote);
    setRegNumber(quote.vehicle_reg || '');
    setMileage(quote.vehicle_mileage || '');
    const numMileage = parseInt(String(quote.vehicle_mileage).replace(/,/g, ''), 10);
    if (!isNaN(numMileage)) setSliderMileage(numMileage);
    
    // Set quote configuration
    const duration = quote.payment_type || '24months';
    setPaymentType(duration);
    setExcessAmount(quote.excess_amount || 100);
    setClaimLimit(quote.claim_limit || 2000);
    setLabourRate(quote.labour_rate || 70);
    setBoostAddon(quote.boost_addon || false);
    setAdditionalNotes(quote.additional_notes || '');
    
    // Go to Step 2 (quote details) for editing
    setStep(2);
    setActiveTab('new');
    setQuoteGenerated(false);
    setQuoteLink(null);
    
    toast({
      title: "Quote loaded for editing",
      description: `Edit and resend quote for ${quote.customer_name}`,
    });
  };

  const generateWhatsAppMessage = () => {
    const termOption = termOptions.find(t => t.id === paymentType);
    const months = termOption?.months || 12;
    const bonus = termOption?.bonus || 3;
    const displayClaimLimit = boostAddon ? getDisplayClaimLimitValue(claimLimit) + 1000 : getDisplayClaimLimitValue(claimLimit);
    
    const content = `Hi ${customerName.split(' ')[0]},

Here's your warranty quote for ${vehicleData?.make} ${vehicleData?.model} (${vehicleData?.regNumber}):

Plan: Platinum
Price: £${currentPrice.monthlyPrice}/month
Cover: ${months} months + ${bonus} FREE
Claim Limit: £${displayClaimLimit.toLocaleString()}

Complete your purchase here:
${quoteLink || 'https://buyawarranty.co.uk'}

Questions? Call 0330 229 5040`;

    const encodedMessage = encodeURIComponent(content);
    const whatsappUrl = `https://api.whatsapp.com/send?phone=447467703287&text=${encodedMessage}`;
    window.open(whatsappUrl, '_blank');
  };

  // State for quote link generation
  const [isGeneratingQuoteLink, setIsGeneratingQuoteLink] = useState(false);
  const [quoteLink, setQuoteLink] = useState<string | null>(null);
  const [quoteGenerated, setQuoteGenerated] = useState(false);

  // Auto-generate quote link when entering step 3
  useEffect(() => {
    if (step === 3 && customerEmail && customerName && vehicleData && !quoteGenerated) {
      generateQuoteLink();
    }
  }, [step, customerEmail, customerName, vehicleData]);

  const generateQuoteLink = async () => {
    if (!customerEmail || !customerName || !vehicleData) return;
    
    setIsGeneratingQuoteLink(true);
    setQuoteLink(null);
    
    const displayClaimLimit = boostAddon ? getDisplayClaimLimitValue(claimLimit) + 1000 : getDisplayClaimLimitValue(claimLimit);
    const contractTotal = currentPrice.monthlyPrice * 12; // Use monthly × 12 for consistency
    const payInFullPrice = currentPrice.payInFullPrice || Math.floor(contractTotal * 0.90);
    
    try {
      const { data, error } = await supabase.functions.invoke('create-live-quote', {
        body: {
          customerName,
          customerEmail,
          customerPhone: '',
          vehicleData: {
            regNumber: vehicleData.regNumber,
            make: vehicleData.make,
            model: vehicleData.model,
            year: vehicleData.year,
            fuelType: vehicleData.fuelType,
            transmission: vehicleData.transmission,
            mileage: vehicleData.mileage,
            vehicleType: vehicleData.vehicleType || 'car'
          },
          paymentType,
          excessAmount,
          claimLimit, // Send raw claim limit - customer page will add boost if needed
          labourRate,
          boostAddon,
          monthlyPrice: currentPrice.monthlyPrice,
          upfrontPrice: payInFullPrice,
          breakdownIncluded: getAutoIncludedAddOns(paymentType).includes('breakdown'),
          rentalIncluded: getAutoIncludedAddOns(paymentType).includes('rental'),
          additionalNotes,
          freeExtendedCover, // Pass the free extended cover selection
          createdByName: 'Admin',
          customerDob: customerDob || null
        }
      });

      if (error) throw error;

      if (data?.quote?.shareLink || data?.quote?.accessToken) {
        const origin = window.location.origin;
        const quoteUrl = `${origin}/quote/${data.quote.accessToken}`;
        setQuoteLink(quoteUrl);
        setQuoteGenerated(true);
      } else {
        throw new Error('No quote link returned');
      }
    } catch (error: any) {
      console.error('Error generating quote link:', error);
      toast({
        title: "❌ Failed to Generate Quote Link",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingQuoteLink(false);
    }
  };

  // Retry generating quote link
  const handleRetryQuoteLink = async () => {
    setQuoteGenerated(false);
    await generateQuoteLink();
  };

  // Copy quote link to clipboard
  const handleCopyQuoteLink = async () => {
    if (!quoteLink) return;
    await navigator.clipboard.writeText(quoteLink);
    toast({ title: "✓ Quote link copied!", duration: 2000 });
  };

  // Generate warranty reference using the DB function (consistent BAW format)
  const generateWarrantyReference = async (): Promise<string> => {
    const { data, error } = await supabase.rpc('generate_warranty_number');
    if (error) {
      console.error('Error generating warranty number:', error);
      // Fallback
      const date = new Date();
      const datePart = `${String(date.getDate()).padStart(2, '0')}${String(date.getMonth() + 1).padStart(2, '0')}`;
      const serial = Math.floor(Math.random() * 100000) + 500000;
      return `BAW-${datePart}-${serial}`;
    }
    return data;
  };

  // Check for existing active policy on this vehicle
  const checkExistingPolicy = async () => {
    if (!vehicleData?.regNumber) return null;
    
    const { data: existingPolicy } = await supabase
      .from('customer_policies')
      .select('id, policy_number, email, status, policy_start_date')
      .eq('status', 'active')
      .ilike('email', customerEmail)
      .maybeSingle();
    
    // Also check customers table for active policy on same reg
    const { data: existingCustomerPolicy } = await supabase
      .from('customers')
      .select('id, name, email, registration_plate, status')
      .eq('registration_plate', vehicleData.regNumber.toUpperCase())
      .eq('status', 'Active')
      .maybeSingle();
    
    if (existingPolicy) {
      return `An active policy (${existingPolicy.policy_number}) already exists for this email.`;
    }
    if (existingCustomerPolicy && existingCustomerPolicy.email.toLowerCase() !== customerEmail.toLowerCase()) {
      return `This vehicle (${vehicleData.regNumber}) is already covered under ${existingCustomerPolicy.name}'s policy (${existingCustomerPolicy.email}).`;
    }
    return null;
  };

  // Open payment confirmation dialog with validation
  const handleOpenConfirmPaymentDialog = async () => {
    if (!customerEmail || !customerName || !vehicleData) {
      toast({
        title: "Incomplete Quote",
        description: "Please complete all customer and vehicle details first",
        variant: "destructive",
      });
      return;
    }

    // Check for existing policies
    const warning = await checkExistingPolicy();
    setExistingPolicyWarning(warning);
    
    // Pre-fill payment amount from quote
    setPaymentAmount(currentPrice.totalPrice.toString());
    // Reset warranty start date to today
    setWarrantyStartDate(new Date());
    // Reset to details step when opening
    setExternalPaymentStep('details');
    
    // Initialize editable fields with current values
    setEditableCustomerName(customerName);
    setEditableCustomerEmail(customerEmail);
    setEditableCustomerPhone(customerPhone);
    setEditableMileage(vehicleData?.mileage || mileage);
    setEditableRegNumber(vehicleData?.regNumber || regNumber);
    setMileagePrefilledFromMot(false); // Reset MOT prefill flag
    
    // Reset address fields
    setCustomerPostcode('');
    setCustomerStreet('');
    setCustomerTown('');
    setCustomerBuildingNumber('');
    setCustomerCounty('');
    setSkipAddressDetails(false);
    
    setShowConfirmPaymentDialog(true);
  };

  // Generate preview data for external payment
  const getExternalPaymentPreviewData = () => {
    const termOption = termOptions.find(t => t.id === paymentType);
    const durationMonths = termOption?.months || 12;
    const displayClaimLimit = boostAddon ? getDisplayClaimLimitValue(claimLimit) + 1000 : getDisplayClaimLimitValue(claimLimit);
    const startDate = startOfDay(warrantyStartDate);
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + durationMonths);
    const autoIncludedAddOns = getAutoIncludedAddOns(paymentType);
    const isFutureStart = !isToday(warrantyStartDate) && warrantyStartDate > new Date();

    return {
      customer: {
        name: editableCustomerName || customerName,
        email: (editableCustomerEmail || customerEmail).toLowerCase(),
        phone: editableCustomerPhone || customerPhone || 'Not provided',
        address: skipAddressDetails 
          ? 'Customer will complete in dashboard' 
          : customerPostcode 
            ? `${customerBuildingNumber ? customerBuildingNumber + ' ' : ''}${customerStreet}, ${customerTown}${customerCounty ? ', ' + customerCounty : ''}, ${customerPostcode}`
            : 'Not provided',
        postcode: customerPostcode,
        street: customerStreet,
        town: customerTown,
        buildingNumber: customerBuildingNumber,
        county: customerCounty,
        skipAddressDetails,
      },
      vehicle: {
        registration: (editableRegNumber || vehicleData?.regNumber)?.toUpperCase() || '',
        make: vehicleData?.make || 'Unknown',
        model: vehicleData?.model || 'Unknown',
        year: vehicleData?.year || 'Unknown',
        mileage: parseInt(editableMileage || vehicleData?.mileage || '0').toLocaleString(),
        fuelType: vehicleData?.fuelType || 'Unknown',
        transmission: vehicleData?.transmission || 'Unknown',
      },
      policy: {
        planType: 'Platinum',
        duration: termOption?.label || '12 months',
        durationMonths,
        startDate: startDate.toLocaleDateString('en-GB'),
        endDate: endDate.toLocaleDateString('en-GB'),
        excess: excessAmount,
        claimLimit: displayClaimLimit,
        labourRate: labourRate,
        boostAddon,
        freeExtendedCover,
        breakdownRecovery: autoIncludedAddOns.includes('breakdown'),
        vehicleRental: autoIncludedAddOns.includes('rental'),
        isFutureStart,
      },
      payment: {
        source: paymentSource,
        amount: parseFloat(paymentAmount),
        date: paymentDate,
        notes: paymentNotes,
      },
      integrations: {
        sendToW2k,
        sendWelcomeEmail,
        w2kNotes: additionalNotes ? `External payment via ${paymentSource}. ${additionalNotes}`.trim() : `External payment via ${paymentSource}`.trim(),
      }
    };
  };

  // Validate payment confirmation form
  const isPaymentFormValid = () => {
    return (
      paymentSource.trim() !== '' &&
      paymentAmount.trim() !== '' &&
      warrantyStartDate !== undefined &&
      paymentConfirmed === true
    );
  };

  // Handle confirm external payment - atomic operation
  const handleConfirmExternalPayment = async () => {
    if (!isPaymentFormValid()) {
      toast({
        title: "Incomplete Form",
        description: "Please fill in all required fields and confirm payment",
        variant: "destructive",
      });
      return;
    }

    // Check for duplicate warranty before proceeding
    const { checkDuplicateWarranty } = await import('@/lib/duplicateWarrantyCheck');
    const finalEmail = editableCustomerEmail || customerEmail;
    const duplicateCheck = await checkDuplicateWarranty(regNumber, finalEmail);
    if (duplicateCheck.isDuplicate) {
      setDuplicateWarning({ show: true, record: duplicateCheck.existingRecord });
      return;
    }

    // Price validation - allow override, just show warning in UI (no blocking)
    const confirmedAmount = parseFloat(paymentAmount);
    const hasPriceDifference = Math.abs(confirmedAmount - currentPrice.totalPrice) > 1;

    setIsConfirmingPaid(true);
    const warrantyReference = await generateWarrantyReference();
    const displayClaimLimit = boostAddon ? getDisplayClaimLimitValue(claimLimit) + 1000 : getDisplayClaimLimitValue(claimLimit);
    const termOption = termOptions.find(t => t.id === paymentType);
    const durationMonths = termOption?.months || 12;
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const adminUserId = user?.id;
      
      // Get the admin_users.id for assigning customer to this agent (confirming agent)
      let adminUserRecordId: string | null = null;
      if (adminUserId) {
        const { data: adminUser } = await supabase
          .from('admin_users')
          .select('id')
          .eq('user_id', adminUserId)
          .maybeSingle();
        adminUserRecordId = adminUser?.id || null;
      }
      
      // Get the original quote sender from live_quotes if a quote link exists
      let quoteSentByUserId: string | null = null;
      if (quoteLink) {
        const accessToken = quoteLink.split('/quote/')[1];
        if (accessToken) {
          const { data: originalQuote } = await supabase
            .from('live_quotes')
            .select('created_by')
            .eq('access_token', accessToken)
            .maybeSingle();
          
          if (originalQuote?.created_by) {
            // Get the admin_users.id for the quote sender
            const { data: quoteSenderAdmin } = await supabase
              .from('admin_users')
              .select('id')
              .eq('user_id', originalQuote.created_by)
              .maybeSingle();
            quoteSentByUserId = quoteSenderAdmin?.id || null;
          }
        }
      }

      // === ATOMIC TRANSACTION START ===
      
      // 1. Check for existing customer by email (case insensitive)
      const finalEmail = editableCustomerEmail || customerEmail;
      const { data: existingCustomer } = await supabase
        .from('customers')
        .select('id, name, email, registration_plate')
        .ilike('email', finalEmail)
        .maybeSingle();

      // 1b. Check for existing policy — reuse warranty number if found
      let existingPolicyRecord: { id: string; warranty_number: string | null; policy_number: string } | null = null;
      if (existingCustomer) {
        const { data: policies } = await supabase
          .from('customer_policies')
          .select('id, warranty_number, policy_number')
          .eq('customer_id', existingCustomer.id)
          .not('is_deleted', 'eq', true)
          .order('created_at', { ascending: false })
          .limit(1);
        
        if (policies && policies.length > 0) {
          existingPolicyRecord = policies[0];
          console.log('Found existing policy, reusing warranty number:', existingPolicyRecord.warranty_number);
        }
      }

      // Use existing warranty number if available, otherwise use the generated one
      const finalWarrantyReference = existingPolicyRecord?.warranty_number || warrantyReference;

      let customerId: string;
      
      // Use editable fields for final data
      const finalName = editableCustomerName || customerName;
      const finalPhone = editableCustomerPhone || customerPhone;
      const finalRegNumber = (editableRegNumber || vehicleData.regNumber)?.toUpperCase();
      const finalMileage = editableMileage || vehicleData.mileage;
      
      // Parse name into first/last for customer record
      const nameParts = finalName.trim().split(' ');
      const parsedFirstName = nameParts[0] || '';
      const parsedLastName = nameParts.slice(1).join(' ') || '';
      
      // 2. Customer record data with payment confirmation details
      const customerData: Record<string, any> = {
        name: finalName,
        first_name: parsedFirstName,
        last_name: parsedLastName,
        email: finalEmail.toLowerCase(),
        phone: finalPhone || null,
        registration_plate: finalRegNumber || null,
        vehicle_make: vehicleData.make || null,
        vehicle_model: vehicleData.model || null,
        vehicle_year: vehicleData.year || null,
        vehicle_fuel_type: vehicleData.fuelType || null,
        vehicle_transmission: vehicleData.transmission || null,
        mileage: finalMileage || null,
        plan_type: 'Platinum',
        payment_type: paymentType === '12months' ? 'yearly' 
          : paymentType === '24months' ? '2-Year'
          : paymentType === '36months' ? '3-Year'
          : paymentType,
        status: 'Active',
        warranty_reference_number: finalWarrantyReference,
        voluntary_excess: excessAmount,
        claim_limit: displayClaimLimit,
        labour_rate: labourRate,
        final_amount: confirmedAmount,
        is_manual_entry: true,
        payment_verified: true,
        breakdown_recovery: getAutoIncludedAddOns(paymentType).includes('breakdown'),
        vehicle_rental: getAutoIncludedAddOns(paymentType).includes('rental'),
        // Assign customer to the confirming sales agent
        assigned_to: adminUserRecordId,
        // Sales agent attribution for commission tracking
        quote_sent_by: quoteSentByUserId,
        payment_confirmed_by: adminUserRecordId,
        // CRITICAL: Save the selected payment source from the dropdown
        purchase_source: paymentSource || 'external',
      };
      
      // Include address if provided (not skipped)
      if (!skipAddressDetails && customerPostcode) {
        customerData.postcode = customerPostcode;
        customerData.street = customerStreet || null;
        customerData.town = customerTown || null;
        customerData.building_number = customerBuildingNumber || null;
        customerData.county = customerCounty || null;
      }

      // 3. Create or update customer
      if (existingCustomer) {
        const { error: updateError } = await supabase
          .from('customers')
          .update({ ...customerData, updated_at: new Date().toISOString() })
          .eq('id', existingCustomer.id);
        
        if (updateError) throw updateError;
        customerId = existingCustomer.id;
      } else {
        const { data: newCustomer, error: insertError } = await supabase
          .from('customers')
          .insert(customerData as any)
          .select('id')
          .single();
        
        if (insertError) throw insertError;
        customerId = newCustomer.id;
      }

      // 4. Calculate policy dates using warrantyStartDate
      // CRITICAL: Use UTC midnight to avoid BST/GMT timezone offset causing wrong date
      const startDateLocal = startOfDay(warrantyStartDate);
      const startDate = new Date(Date.UTC(startDateLocal.getFullYear(), startDateLocal.getMonth(), startDateLocal.getDate()));
      const endDate = new Date(startDate);
      endDate.setUTCMonth(endDate.getUTCMonth() + durationMonths);
      
      // Check if this is a future start date for W2000 scheduling
      const isFutureStartDate = !isToday(warrantyStartDate) && warrantyStartDate > new Date();

      // 5. Create or update policy record with payment confirmation metadata
      // Convert paymentType ID to human-readable label for consistency
      const paymentTypeLabel = paymentType === '12months' ? 'yearly' 
        : paymentType === '24months' ? '2-Year'
        : paymentType === '36months' ? '3-Year'
        : paymentType;
      
      const policyData: Record<string, any> = {
        customer_id: customerId,
        email: finalEmail.toLowerCase(),
        customer_full_name: finalName,
        plan_type: 'Platinum',
        payment_type: paymentTypeLabel,
        policy_number: existingPolicyRecord?.policy_number || finalWarrantyReference,
        warranty_number: finalWarrantyReference,
        policy_start_date: startDate.toISOString(),
        policy_end_date: endDate.toISOString(),
        status: isFutureStartDate ? 'scheduled' : 'active',
        voluntary_excess: excessAmount,
        claim_limit: displayClaimLimit,
        payment_amount: confirmedAmount,
        breakdown_recovery: getAutoIncludedAddOns(paymentType).includes('breakdown'),
        vehicle_rental: getAutoIncludedAddOns(paymentType).includes('rental'),
        is_manual_entry: true,
        payment_verified: true,
        // W2000 scheduling for future start dates
        warranties_2000_scheduled_for: isFutureStartDate ? startDate.toISOString() : null,
        warranties_2000_status: sendToW2k ? (isFutureStartDate ? 'scheduled' : 'pending') : null,
        // Include additional notes and bonus months from quote
        additional_notes: additionalNotes || null,
        seasonal_bonus_months: freeExtendedCover === '6months' ? 6 : freeExtendedCover === '3months' ? 3 : 0,
        // Sales agent attribution for commission tracking
        quote_sent_by: quoteSentByUserId,
        payment_confirmed_by: adminUserRecordId,
      };
      
      // Include address in policy if provided
      if (!skipAddressDetails && customerPostcode) {
        policyData.address = {
          postcode: customerPostcode,
          street: customerStreet || '',
          town: customerTown || '',
          building_number: customerBuildingNumber || '',
          county: customerCounty || '',
        };
      }

      let policyId: string;
      
      console.log('[CONFIRM-EXTERNAL] Policy data being saved:', {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        warrantyStartDate: warrantyStartDate.toISOString(),
        paymentType: policyData.payment_type,
        claimLimit: policyData.claim_limit,
        customerName: finalName,
        email: finalEmail,
      });
      
      if (existingPolicyRecord) {
        // Update existing policy instead of creating duplicate
        const { error: policyUpdateError } = await supabase
          .from('customer_policies')
          .update({ ...policyData, updated_at: new Date().toISOString() })
          .eq('id', existingPolicyRecord.id);

        if (policyUpdateError) throw policyUpdateError;
        policyId = existingPolicyRecord.id;
        console.log('Updated existing policy:', policyId);
      } else {
        // Create new policy
        const { data: newPolicy, error: policyError } = await supabase
          .from('customer_policies')
          .insert(policyData as any)
          .select('id')
          .single();

        if (policyError) throw policyError;
        policyId = newPolicy.id;
      }

      // 6. Add admin note with payment confirmation details
      await supabase
        .from('admin_notes')
        .insert({
          customer_id: customerId,
          note: `External Payment Confirmed:\n• Source: ${paymentSource}\n• Amount: £${confirmedAmount}\n• Warranty Start Date: ${format(startDate, 'd MMM yyyy')}${isFutureStartDate ? ' (future start)' : ''}\n• Confirmed by: ${adminEmail || 'Admin'}${paymentNotes ? `\n• Notes: ${paymentNotes}` : ''}`,
          created_by: adminUserId
        });

      // 7. Update live_quotes status if exists
      if (quoteLink) {
        const accessToken = quoteLink.split('/quote/')[1];
        if (accessToken) {
          await supabase
            .from('live_quotes')
            .update({ 
              status: 'paid_externally',
              payment_confirmed_at: new Date().toISOString(),
              payment_confirmed_by: adminUserId,
              payment_source: paymentSource
            })
            .eq('access_token', accessToken);
        }
      }

      // 8. Mark any abandoned carts as converted
      await supabase
        .from('abandoned_carts')
        .update({ 
          is_converted: true, 
          converted_at: new Date().toISOString(),
          contact_status: 'converted'
        })
        .eq('email', customerEmail.toLowerCase());

      // 9. Mark any sales leads as converted
      if (selectedLeadId) {
        await supabase
          .from('sales_leads')
          .update({
            status: 'converted',
            converted_at: new Date().toISOString()
          })
          .eq('id', selectedLeadId);
      }

      // === ATOMIC TRANSACTION END ===

      // Initialize completion status - policy is created at this point
      let emailSentSuccess: boolean | null = null;
      let w2000SentSuccess: boolean | null = null;

      // 10. Send to Warranties 2000 if checked AND not a future start date
      // Future start dates will be processed by the scheduled edge function
      if (sendToW2k && !isFutureStartDate) {
        try {
          const { error: w2kError } = await supabase.functions.invoke('send-to-warranties-2000', {
            body: { 
              policyId: policyId,
              customerId: customerId,
              force: true,
              additionalNotes: additionalNotes ? `External payment via ${paymentSource}. ${additionalNotes}`.trim() : `External payment via ${paymentSource}`.trim()
            }
          });
          w2000SentSuccess = !w2kError;
          if (w2kError) console.error('W2K error:', w2kError);
        } catch (w2kError) {
          console.error('W2K error:', w2kError);
          w2000SentSuccess = false;
        }
      } else if (sendToW2k && isFutureStartDate) {
        console.log('W2000 submission scheduled for future start date:', format(startDate, 'yyyy-MM-dd'));
        w2000SentSuccess = null; // Scheduled, not sent yet
      }

      // 11. Send welcome email with warranty number and dashboard login
      if (sendWelcomeEmail) {
        try {
          const { error: emailError } = await supabase.functions.invoke('send-welcome-email-manual', {
            body: { 
              policyId: policyId,
              customerId: customerId
            }
          });
          emailSentSuccess = !emailError;
          if (emailError) console.error('Welcome email error:', emailError);
          
          // Update policy with email sent status
          await supabase
            .from('customer_policies')
            .update({ 
              email_sent_status: emailSentSuccess ? 'sent' : 'failed',
              email_sent_at: emailSentSuccess ? new Date().toISOString() : null
            })
            .eq('id', policyId);
        } catch (emailError) {
          console.error('Welcome email error:', emailError);
          emailSentSuccess = false;
        }
      }

      // Send sale notification email (fire and forget)
      try {
        await supabase.functions.invoke('send-sale-notification', {
          body: {
            customerName: finalName,
            customerEmail: finalEmail,
            customerPhone: customerPhone || null,
            regPlate: regNumber || null,
            planName: 'Platinum',
            saleValue: confirmedAmount,
            paymentMethod: paymentSource || 'External',
            warrantyReference: finalWarrantyReference,
            vehicleMake: vehicleData?.make || null,
            vehicleModel: vehicleData?.model || null,
            agentId: quoteSentByUserId || null,
          }
        });
      } catch (e) {
        console.warn('Sale notification email failed (non-critical):', e);
      }

      // Set completion status and show complete step
      setCompletionStatus({
        policyCreated: true,
        emailSent: sendWelcomeEmail ? emailSentSuccess : null,
        w2000Sent: sendToW2k ? w2000SentSuccess : null,
        warrantyReference: finalWarrantyReference,
        isFutureStart: isFutureStartDate
      });
      setExternalPaymentStep('complete');
      setIsConfirmingPaid(false);

      // Success toast
      toast({
        title: isFutureStartDate ? "✅ Policy Scheduled!" : "✅ Policy Activated!",
        description: isFutureStartDate 
          ? `Warranty ${finalWarrantyReference} created. Cover starts ${format(startDate, 'd MMM yyyy')}.`
          : `Warranty ${finalWarrantyReference} created successfully.`,
        duration: 6000,
      });

    } catch (error: any) {
      console.error('Error confirming external payment:', error);
      toast({
        title: "❌ Payment Confirmation Failed",
        description: error.message || "Failed to create policy. No changes were made.",
        variant: "destructive",
      });
      setIsConfirmingPaid(false);
    }
  };

  // Reset form to initial state
  const resetForm = () => {
    setStep(1);
    setRegNumber('');
    setMileage('');
    setSliderMileage(0);
    setVehicleData(null);
    setCustomerEmail('');
    setCustomerName('');
    setCustomerPhone('');
    setCustomerDob('');
    setPaymentType('24months');
    setExcessAmount(100);
    setClaimLimit(2000);
    setLabourRate(70);
    setBoostAddon(false);
    setSelectedAddOns({});
    setAdditionalNotes('');
    setQuoteLink(null);
    setQuoteGenerated(false);
    setSelectedLeadId(null);
    // Reset validation state
    setShowNameError(false);
    setShowEmailError(false);
    // Reset payment confirmation fields
    setPaymentSource('');
    setPaymentAmount('');
    setPaymentDate(new Date().toISOString().split('T')[0]);
    setPaymentConfirmed(false);
    setPaymentNotes('');
    setExistingPolicyWarning(null);
    setExternalPaymentStep('details');
    setCompletionStatus(null);
    setWarrantyStartDate(new Date());
  };

  return (
    <>
    <DuplicateWarrantyDialog
      isOpen={duplicateWarning.show}
      onClose={() => setDuplicateWarning({ show: false })}
      record={duplicateWarning.record}
    />
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Quotes & Orders</h1>
        <p className="text-gray-600 mt-2">Create quotes to send customers or confirm orders paid elsewhere</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5 h-auto">
          <TabsTrigger value="new" className="text-xs sm:text-sm py-2 px-1 sm:px-3">
            <Zap className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
            <span className="hidden sm:inline">Quote / Confirm</span>
            <span className="sm:hidden">New</span>
          </TabsTrigger>
          <TabsTrigger value="history" className="text-xs sm:text-sm py-2 px-1 sm:px-3">
            <History className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
            <span className="hidden sm:inline">History</span>
            <span className="sm:hidden">Hist</span>
            <span className="ml-1">({sentQuotes.length + savedQuotes.length})</span>
          </TabsTrigger>
          <TabsTrigger value="paid" className="text-xs sm:text-sm py-2 px-1 sm:px-3">
            <Users className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
            <span className="hidden sm:inline">Paid Orders</span>
            <span className="sm:hidden">Orders</span>
            {paidOrdersCount > 0 && <span className="ml-1">({paidOrdersCount})</span>}
          </TabsTrigger>
          <TabsTrigger value="logins" className="text-xs sm:text-sm py-2 px-1 sm:px-3">
            <KeyRound className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
            <span className="hidden sm:inline">Customer Logins</span>
            <span className="sm:hidden">Logins</span>
          </TabsTrigger>
          <TabsTrigger value="update" className="text-xs sm:text-sm py-2 px-1 sm:px-3">
            <Pencil className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
            <span className="hidden sm:inline">Update</span>
            <span className="sm:hidden">Update</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="new" className="space-y-6 mt-6">
          {/* Step 1: Vehicle Details */}
          {step === 1 && (
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={resetForm}
                      className="text-muted-foreground hover:text-foreground -ml-2"
                    >
                      ← Back
                    </Button>
                    <div>
                      <CardTitle>Step 1: Vehicle Details</CardTitle>
                      <CardDescription>Enter the customer's vehicle registration and mileage</CardDescription>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <div className="flex gap-2">
                      <LeadSearchPopover onSelectLead={handleLeadSelect} />
                      {savedQuotes.length > 0 && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setActiveTab('history');
                            setHistorySubTab('saved');
                          }}
                          className="gap-1"
                        >
                          <BookOpen className="h-4 w-4" />
                          Saved ({savedQuotes.length})
                        </Button>
                      )}
                    </div>
                    {selectedLeadId && (
                      <Badge variant="secondary" className="gap-1">
                        <UserCheck className="h-3 w-3" />
                        Lead imported
                      </Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Registration Number</Label>
                  <Input
                    type="text"
                    value={regNumber}
                    onChange={(e) => setRegNumber(formatRegNumber(e.target.value))}
                    placeholder="e.g. AB12 CDE"
                    className="uppercase text-2xl font-bold py-6"
                    maxLength={8}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Mileage</Label>
                  <div className="flex gap-2">
                    <Input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={mileage}
                      onChange={handleMileageChange}
                      placeholder="e.g. 45000"
                      className="text-lg py-4 flex-1"
                    />
                    <Select
                      value={sliderMileage.toString()}
                      onValueChange={(value) => {
                        const numValue = parseInt(value, 10);
                        setSliderMileage(numValue);
                        setMileage(numValue.toLocaleString());
                      }}
                    >
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Quick select" />
                      </SelectTrigger>
                      <SelectContent className="max-h-[300px]">
                        {mileageDropdownOptions.map((miles) => (
                          <SelectItem key={miles} value={miles.toString()}>
                            {miles.toLocaleString()} miles
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <MileageSlider
                    value={sliderMileage}
                    onChange={handleSliderChange}
                    min={0}
                    max={150000}
                  />
                </div>

                {/* Age Override Option */}
                <div className="flex items-center space-x-2 pt-2 pb-1">
                  <Checkbox
                    id="ageOverride"
                    checked={ageOverrideEnabled}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setShowAgeOverrideConfirm(true);
                      } else {
                        setAgeOverrideEnabled(false);
                      }
                    }}
                  />
                  <Label htmlFor="ageOverride" className="text-sm font-medium text-orange-700 cursor-pointer">
                    Override 15-year age limit (authorised personnel only)
                  </Label>
                </div>
                {ageOverrideEnabled && (
                  <Alert className="border-orange-300 bg-orange-50">
                    <AlertCircle className="h-4 w-4 text-orange-600" />
                    <AlertDescription className="text-orange-800 text-sm">
                      Age override is active. Vehicles older than 15 years will be priced using 12–15 year pricing.
                    </AlertDescription>
                  </Alert>
                )}

                {/* Two Primary Actions Side by Side */}
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <Button 
                    onClick={handleVehicleLookup}
                    disabled={isLookingUp || isQuickConfirming}
                    size="lg"
                    className="gap-2 bg-blue-600 hover:bg-blue-700"
                  >
                    {isLookingUp ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Looking up...
                      </>
                    ) : (
                      <>
                        <Mail className="w-4 h-4" />
                        Send Quote
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </Button>
                  
                  <Button 
                    onClick={handleQuickConfirmOrder}
                    disabled={isLookingUp || isQuickConfirming || !regNumber.trim()}
                    size="lg"
                    className="gap-2 bg-green-600 hover:bg-green-700"
                  >
                    {isQuickConfirming ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <CreditCard className="w-4 h-4" />
                        Confirm Payment
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </Button>
                </div>
                
                {/* Help text */}
                <div className="grid grid-cols-2 gap-3 text-xs text-muted-foreground text-center">
                  <p><span className="text-blue-600 font-medium">Send Quote</span> — Configure & email a quote link</p>
                  <p><span className="text-green-600 font-medium">Confirm Payment</span> — Already paid elsewhere</p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 2: Quote Details */}
          {step === 2 && vehicleData && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Step 2: Quote Details</CardTitle>
                    <CardDescription>
                      Vehicle: {vehicleData.make} {vehicleData.model} ({vehicleData.year}) - {vehicleData.regNumber}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <LeadSearchPopover 
                      onSelectLead={handleLeadSelect} 
                      className="bg-blue-100 text-blue-700 hover:bg-blue-200 border-blue-300"
                    />
                    {savedQuotes.length > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setActiveTab('history');
                          setHistorySubTab('saved');
                        }}
                        className="gap-1"
                      >
                        <BookOpen className="h-4 w-4" />
                        Saved ({savedQuotes.length})
                      </Button>
                    )}
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setStep(1)}
                      className="text-muted-foreground hover:text-foreground border-muted-foreground/30"
                    >
                      ← Back
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => {
                        setVehicleData(null);
                        setRegNumber('');
                        setMileage('');
                        setSliderMileage(0);
                        setStep(1);
                      }}
                      className="text-orange-600 hover:bg-orange-50 hover:text-orange-700"
                    >
                      <Pencil className="w-3 h-3 mr-1" />
                      Edit Vehicle
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Customer Info */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Customer Name <span className="text-red-500">*</span></Label>
                    <Input
                      value={customerName}
                      onChange={(e) => {
                        setCustomerName(e.target.value);
                        if (showNameError && e.target.value.trim()) setShowNameError(false);
                      }}
                      placeholder="e.g. John Smith"
                      className={cn(
                        "bg-blue-50 border-blue-200 focus:border-blue-400",
                        showNameError && "border-red-500 bg-red-50"
                      )}
                    />
                    {showNameError && (
                      <p className="text-sm text-red-500 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" /> Customer name is required
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Customer Email <span className="text-red-500">*</span></Label>
                    <Input
                      type="email"
                      value={customerEmail}
                      onChange={(e) => {
                        setCustomerEmail(e.target.value);
                        if (showEmailError && e.target.value.includes('@')) setShowEmailError(false);
                      }}
                      placeholder="customer@example.com"
                      className={cn(
                        "bg-blue-50 border-blue-200 focus:border-blue-400",
                        showEmailError && "border-red-500 bg-red-50"
                      )}
                    />
                    {showEmailError && (
                      <p className="text-sm text-red-500 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" /> Valid email address is required
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Customer Phone</Label>
                    <Input
                      type="tel"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      placeholder="07xxx xxxxxx"
                      className="bg-blue-50 border-blue-200 focus:border-blue-400"
                    />
                  </div>
                </div>

                {/* Date of Birth - Optional */}
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5">
                    <Label>Date of Birth</Label>
                    <span className="text-xs text-muted-foreground">(optional)</span>
                    <Popover>
                      <PopoverTrigger asChild>
                        <button type="button" className="text-muted-foreground hover:text-foreground">
                          <Info className="w-3.5 h-3.5" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-72 text-sm" side="right">
                        <p className="font-medium mb-1">Why do we need this?</p>
                        <p className="text-muted-foreground">We use your date of birth to securely verify your identity when you make a claim or contact us. This helps protect your policy from unauthorised use.</p>
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="flex gap-2 items-center max-w-md">
                    <Select
                      value={customerDob ? new Date(customerDob).getDate().toString() : ''}
                      onValueChange={(day) => {
                        const current = customerDob ? new Date(customerDob) : new Date(1990, 0, 1);
                        current.setDate(parseInt(day));
                        setCustomerDob(format(current, 'yyyy-MM-dd'));
                      }}
                    >
                      <SelectTrigger className="w-[80px] bg-blue-50 border-blue-200">
                        <SelectValue placeholder="Day" />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                          <SelectItem key={d} value={d.toString()}>{d}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select
                      value={customerDob ? new Date(customerDob).getMonth().toString() : ''}
                      onValueChange={(month) => {
                        const current = customerDob ? new Date(customerDob) : new Date(1990, 0, 1);
                        current.setMonth(parseInt(month));
                        setCustomerDob(format(current, 'yyyy-MM-dd'));
                      }}
                    >
                      <SelectTrigger className="w-[120px] bg-blue-50 border-blue-200">
                        <SelectValue placeholder="Month" />
                      </SelectTrigger>
                      <SelectContent>
                        {['January','February','March','April','May','June','July','August','September','October','November','December'].map((m, i) => (
                          <SelectItem key={i} value={i.toString()}>{m}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select
                      value={customerDob ? new Date(customerDob).getFullYear().toString() : ''}
                      onValueChange={(year) => {
                        const current = customerDob ? new Date(customerDob) : new Date(1990, 0, 1);
                        current.setFullYear(parseInt(year));
                        setCustomerDob(format(current, 'yyyy-MM-dd'));
                      }}
                    >
                      <SelectTrigger className="w-[100px] bg-blue-50 border-blue-200">
                        <SelectValue placeholder="Year" />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 80 }, (_, i) => new Date().getFullYear() - 17 - i).map(y => (
                          <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {customerDob && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setCustomerDob('')}
                        className="text-muted-foreground hover:text-destructive px-2"
                      >
                        ✕
                      </Button>
                    )}
                  </div>
                </div>

                {/* Duration - Quick Select Chips */}
                <div className="space-y-3">
                  <Label className="text-base font-semibold">Cover Duration</Label>
                  <div className="grid grid-cols-3 gap-3">
                    {termOptions.map((term) => (
                      <button
                        key={term.id}
                        onClick={() => setPaymentType(term.id as PaymentPeriod)}
                        className={cn(
                          "relative p-4 rounded-lg border-2 text-center transition-all",
                          paymentType === term.id
                            ? "border-primary bg-primary/10"
                            : "border-border hover:border-primary/50"
                        )}
                      >
                        {term.isPopular && (
                          <span className="absolute -top-2 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-[10px] font-bold px-2 py-0.5 rounded-full">
                            POPULAR
                          </span>
                        )}
                        {term.isBestValue && (
                          <span className="absolute -top-2 left-1/2 -translate-x-1/2 bg-success text-success-foreground text-[10px] font-bold px-2 py-0.5 rounded-full">
                            BEST VALUE
                          </span>
                        )}
                        <div className="font-semibold">{term.label}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Labour Rate - Quick Select Chips */}
                <div className="space-y-3">
                  <Label className="text-base font-semibold">Labour Rate</Label>
                  <div className="grid grid-cols-4 gap-2">
                    {labourRateOptions.map((option) => (
                      <button
                        key={option.rate}
                        onClick={() => setLabourRate(option.rate)}
                        className={cn(
                          "relative py-3 px-2 rounded-lg border-2 text-center transition-all min-h-[80px] flex flex-col items-center justify-center",
                          labourRate === option.rate
                            ? "border-primary bg-primary/10"
                            : "border-border hover:border-primary/50"
                        )}
                      >
                        {option.isBestValue && (
                          <span className="absolute -top-2 left-1/2 -translate-x-1/2 bg-success text-success-foreground text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap">
                            BEST VALUE
                          </span>
                        )}
                        {option.isPopular && (
                          <span className="absolute -top-2 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap">
                            POPULAR
                          </span>
                        )}
                        <div className="font-semibold">{option.label}</div>
                        <div className="text-xs text-muted-foreground">{option.description}</div>
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">Higher rate = more garage choice</p>
                </div>

                {/* Excess - Quick Select Chips */}
                <div className="space-y-3">
                  <Label className="text-base font-semibold">Excess Amount</Label>
                  <div className="grid grid-cols-4 gap-2">
                    {excessOptions.map((excess) => (
                      <button
                        key={excess}
                        onClick={() => setExcessAmount(excess)}
                        className={cn(
                          "py-3 px-2 rounded-lg border-2 text-center font-semibold transition-all",
                          excessAmount === excess
                            ? "border-primary bg-primary/10"
                            : "border-border hover:border-primary/50"
                        )}
                      >
                        £{excess}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">Lower excess = higher monthly cost</p>
                </div>

                {/* Claim Limit - Quick Select Chips */}
                <div className="space-y-3">
                  <Label className="text-base font-semibold">Claim Limit 🚗</Label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {getVisibleClaimLimits(vehicleData?.make).map((option) => (
                      <button
                        key={option.value}
                        onClick={() => {
                          if (option.value === 3000) {
                            setClaimLimit(2000);
                            setBoostAddon(true);
                          } else if (option.value === 5000) {
                            setClaimLimit(5000);
                            setBoostAddon(false);
                          } else {
                            setClaimLimit(option.value);
                            setBoostAddon(false);
                          }
                        }}
                        className={cn(
                          "py-3 px-2 rounded-lg border-2 text-center transition-all relative",
                          (option.value === 3000 ? (claimLimit === 2000 && boostAddon) : claimLimit === option.value && (option.value !== 2000 || !boostAddon))
                            ? "border-primary bg-primary/10"
                            : "border-border hover:border-primary/50"
                        )}
                      >
                        {option.popular && (
                          <span className="absolute -top-2 left-1/2 -translate-x-1/2 text-[10px] bg-primary text-primary-foreground px-2 py-0.5 rounded-full">POPULAR</span>
                        )}
                        <div className="font-semibold">{option.label}</div>
                        <div className="text-xs text-muted-foreground">{option.description}</div>
                         {(option.value === 5000 || option.value === 3000) && (
                          <div className="text-[11px] text-[#0BA360] font-medium mt-0.5">
                            +£{getClaimLimitSurchargeMonthly(option.value, paymentType, excessAmount)}/mo
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                  <p className={cn(
                    "text-xs font-medium mt-1 rounded-md px-2.5 py-1.5 transition-all",
                    claimLimit === 5000
                      ? "bg-[#FF385C]/10 text-[#FF385C] border border-[#FF385C]/20"
                      : "text-amber-600"
                  )}>
                    ⚠️ £5,000 AutoCare Premium is not available for Porsche, Range Rover, Jaguar, and Tesla vehicles.
                  </p>
                </div>

                {/* Boost Addon - directly below Claim Limit */}
                <div className="flex items-center justify-between p-4 rounded-lg border-2 border-dashed border-amber-400 bg-amber-50">
                  <div className="flex items-center gap-3">
                    <Zap className="w-5 h-5 text-amber-500" />
                    <div>
                      <div className="font-semibold">Boost Claim Limit (+£1,000)</div>
                      <div className="text-sm text-muted-foreground">
                        +£{5 * DURATION_MONTHS[paymentType]} total (+£5/month × {DURATION_MONTHS[paymentType]} months)
                      </div>
                    </div>
                  </div>
                  <Switch
                    checked={boostAddon}
                    onCheckedChange={setBoostAddon}
                  />
                </div>

                <div className="space-y-3">
                  <Label className="text-base font-semibold">Optional Add-ons</Label>
                  
                  {/* Auto-Included Add-ons Display */}
                  {getAutoIncludedAddOns(paymentType).length > 0 && (
                    <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                      <div className="flex items-center gap-2 text-green-700">
                        <span className="text-sm font-medium">✓ Included FREE with {termOptions.find(t => t.id === paymentType)?.label}:</span>
                        <div className="flex gap-2">
                          {getAutoIncludedAddOns(paymentType).includes('breakdown') && (
                            <Badge variant="outline" className="bg-green-100 border-green-300 text-green-800">Vehicle Recovery</Badge>
                          )}
                          {getAutoIncludedAddOns(paymentType).includes('rental') && (
                            <Badge variant="outline" className="bg-green-100 border-green-300 text-green-800">Hire Car</Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Selectable Add-ons Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {getAddOnInfo(paymentType, DURATION_MONTHS[paymentType])
                      .filter((addon) => !['motFee', 'lostKey', 'consequential', 'motRepair'].includes(addon.key))
                      .map((addon) => {
                      const isAutoIncluded = addon.isAutoIncluded;
                      const isUnavailable = ['wearAndTear'].includes(addon.key);
                      const isSelected = !isUnavailable && (selectedAddOns[addon.key] || isAutoIncluded);
                      // Display monthly price like Step 3
                      const monthlyPriceDisplay = addon.oneTimePrice 
                        ? `£${addon.oneTimePrice} one-off` 
                        : `+£${addon.monthlyPrice}/mo`;
                      
                      return (
                        <button
                          key={addon.key}
                          onClick={() => !isAutoIncluded && !isUnavailable && handleToggleAddOn(addon.key)}
                          disabled={isAutoIncluded || isUnavailable}
                          className={cn(
                            "p-3 rounded-lg border-2 text-left transition-all relative",
                            isUnavailable
                              ? "border-border bg-muted opacity-50 cursor-not-allowed"
                              : isAutoIncluded 
                                ? "border-green-300 bg-green-50 cursor-default" 
                                : isSelected
                                  ? "border-primary bg-primary/10"
                                  : "border-border hover:border-primary/50"
                          )}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1">
                              <span className={cn("font-medium text-sm", isUnavailable && "line-through text-muted-foreground")}>{addon.name}</span>
                              {addon.tooltipDetails && !isUnavailable && (
                                <div className="group relative">
                                  <Info className="h-3.5 w-3.5 text-muted-foreground hover:text-primary cursor-help" />
                                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-52 p-2.5 bg-popover border border-border rounded-lg shadow-lg text-xs opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                                    <p className="font-semibold text-foreground mb-1.5">{addon.name}</p>
                                    <ul className="space-y-1 text-muted-foreground">
                                      {addon.tooltipDetails.map((detail, idx) => (
                                        <li key={idx} className="flex items-start gap-1.5">
                                          <CheckCircle2 className="h-3 w-3 text-green-500 mt-0.5 shrink-0" />
                                          <span>{detail}</span>
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                </div>
                              )}
                            </div>
                            {isUnavailable ? (
                              <Badge variant="outline" className="text-[10px] bg-muted border-border text-muted-foreground">UNAVAILABLE</Badge>
                            ) : isAutoIncluded ? (
                              <Badge variant="outline" className="text-[10px] bg-green-100 border-green-300 text-green-700">FREE</Badge>
                            ) : (
                              <span className="text-xs font-medium text-primary">{monthlyPriceDisplay}</span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">{addon.description}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>


                {/* Free Extended Cover Option - PROMINENT */}
                <div className={cn(
                  "space-y-3 p-4 rounded-lg border-2 transition-all",
                  freeExtendedCover !== 'none' 
                    ? "border-green-500 bg-green-50" 
                    : "border-dashed border-gray-300 bg-gray-50"
                )}>
                  <Label className="text-base font-semibold flex items-center gap-2">
                    <Gift className="w-5 h-5 text-green-600" />
                    Free Extended Cover
                    {freeExtendedCover !== 'none' && (
                      <Badge className="bg-green-600 text-white ml-2">
                        +{freeExtendedCover === '3months' ? '3' : '6'} MONTHS ACTIVE
                      </Badge>
                    )}
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    <strong>IMPORTANT:</strong> Click a button below to add free months. This will show in the customer's email AND their quote page.
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setFreeExtendedCover('none');
                        // Remove any existing free cover notes
                        setAdditionalNotes(prev => prev.replace(/\s*\|\s*FREE EXTENDED COVER: \d+ months\s*/g, '').replace(/^FREE EXTENDED COVER: \d+ months\s*\|?\s*/g, '').trim());
                      }}
                      className={cn(
                        "flex-1 py-3 px-4 rounded-lg border-2 text-center font-semibold transition-all",
                        freeExtendedCover === 'none'
                          ? "border-primary bg-primary/10"
                          : "border-border hover:border-primary/50"
                      )}
                    >
                      None
                    </button>
                    <button
                      onClick={() => {
                        // Toggle behavior - click again to deselect
                        if (freeExtendedCover === '3months') {
                          setFreeExtendedCover('none');
                          setAdditionalNotes(prev => prev.replace(/\s*\|\s*FREE EXTENDED COVER: \d+ months\s*/g, '').replace(/^FREE EXTENDED COVER: \d+ months\s*\|?\s*/g, '').trim());
                        } else {
                          setFreeExtendedCover('3months');
                          setAdditionalNotes(prev => {
                            const cleaned = prev.replace(/\s*\|\s*FREE EXTENDED COVER: \d+ months\s*/g, '').replace(/^FREE EXTENDED COVER: \d+ months\s*\|?\s*/g, '').trim();
                            return cleaned ? `${cleaned} | FREE EXTENDED COVER: 3 months` : 'FREE EXTENDED COVER: 3 months';
                          });
                        }
                      }}
                      className={cn(
                        "flex-1 py-3 px-4 rounded-lg border-2 text-center font-semibold transition-all",
                        freeExtendedCover === '3months'
                          ? "border-green-500 bg-green-100 text-green-700 ring-2 ring-green-500"
                          : "border-border hover:border-green-400 hover:bg-green-50"
                      )}
                    >
                      + 3 Months Free
                    </button>
                    <button
                      onClick={() => {
                        // Toggle behavior - click again to deselect
                        if (freeExtendedCover === '6months') {
                          setFreeExtendedCover('none');
                          setAdditionalNotes(prev => prev.replace(/\s*\|\s*FREE EXTENDED COVER: \d+ months\s*/g, '').replace(/^FREE EXTENDED COVER: \d+ months\s*\|?\s*/g, '').trim());
                        } else {
                          setFreeExtendedCover('6months');
                          setAdditionalNotes(prev => {
                            const cleaned = prev.replace(/\s*\|\s*FREE EXTENDED COVER: \d+ months\s*/g, '').replace(/^FREE EXTENDED COVER: \d+ months\s*\|?\s*/g, '').trim();
                            return cleaned ? `${cleaned} | FREE EXTENDED COVER: 6 months` : 'FREE EXTENDED COVER: 6 months';
                          });
                        }
                      }}
                      className={cn(
                        "flex-1 py-3 px-4 rounded-lg border-2 text-center font-semibold transition-all",
                        freeExtendedCover === '6months'
                          ? "border-green-500 bg-green-100 text-green-700 ring-2 ring-green-500"
                          : "border-border hover:border-green-400 hover:bg-green-50"
                      )}
                    >
                      + 6 Months Free
                    </button>
                  </div>
                  {freeExtendedCover !== 'none' && (
                    <div className="mt-2 p-2 bg-green-100 rounded border border-green-300">
                      <p className="text-sm text-green-800">
                        ✓ Customer will see <strong>+{freeExtendedCover === '3months' ? '3' : '6'} FREE months</strong> on their quote page and email
                      </p>
                    </div>
                  )}
                </div>

                {/* Additional Notes */}
                <div className="space-y-2">
                  <Label className="text-base font-semibold">Additional Notes for Warranties Register</Label>
                  <Textarea
                    value={additionalNotes}
                    onChange={(e) => setAdditionalNotes(e.target.value)}
                    placeholder="Any special notes for this warranty (e.g., specific conditions, customer requests)..."
                    rows={3}
                  />
                  <p className="text-xs text-muted-foreground">These notes will be sent to Warranties Register when the customer completes their purchase</p>
                  
                  {/* Warning if admin types about free months without selecting the toggle */}
                  {freeExtendedCover === 'none' && 
                   additionalNotes && 
                   /\b(free|extra|bonus|additional)\b.*\b(month|months)\b/i.test(additionalNotes) && 
                   !/FREE EXTENDED COVER:/i.test(additionalNotes) && (
                    <Alert className="mt-2 border-amber-400 bg-amber-50">
                      <AlertCircle className="h-4 w-4 text-amber-600" />
                      <AlertDescription className="text-amber-800">
                        <strong>Did you mean to add free months?</strong> It looks like you're writing about extra cover. 
                        Click the <strong>+3 Months</strong> or <strong>+6 Months</strong> button above to add this to the customer's quote page and email.
                      </AlertDescription>
                    </Alert>
                  )}
                </div>

                {/* Custom Pricing Override */}
                <div className="border-t pt-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <Label className="text-base font-semibold">Custom Pricing</Label>
                      <p className="text-sm text-muted-foreground">
                        {isPriceOverridden 
                          ? "Using custom price — edit fields or reset to calculated" 
                          : "Auto-calculated based on selections — edit to override"}
                      </p>
                    </div>
                    {isPriceOverridden && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={resetToCalculatedPrice}
                        className="text-xs"
                      >
                        Reset to Calculated
                      </Button>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="custom-monthly">Monthly Price (£)</Label>
                      <Input
                        id="custom-monthly"
                        type="text"
                        inputMode="numeric"
                        value={customMonthlyPrice}
                        onChange={(e) => handleCustomMonthlyChange(e.target.value)}
                        onFocus={(e) => e.target.select()}
                        placeholder="0"
                        className={cn(
                          "font-semibold",
                          isPriceOverridden ? "border-amber-400 bg-amber-50" : "border-green-400 bg-green-50"
                        )}
                      />
                      <p className="text-xs text-muted-foreground">
                        {isPriceOverridden ? "Custom override" : `Calculated: £${basePrice.monthlyPrice}`}
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="custom-full">Total Price (£)</Label>
                      <Input
                        id="custom-full"
                        type="text"
                        inputMode="numeric"
                        value={customFullPrice}
                        onChange={(e) => handleCustomFullChange(e.target.value)}
                        onFocus={(e) => e.target.select()}
                        placeholder="0"
                        className={cn(
                          "font-semibold",
                          isPriceOverridden ? "border-amber-400 bg-amber-50" : "border-green-400 bg-green-50"
                        )}
                      />
                      <p className="text-xs text-muted-foreground">
                        {isPriceOverridden ? "Custom override" : `Calculated: £${basePrice.totalPrice}`}
                      </p>
                    </div>
                  </div>
                  
                  {/* Pay in Full Discount Toggle */}
                  <div className="flex items-center justify-between p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <div className="space-y-0.5">
                      <Label className="text-sm font-medium text-amber-900">Include 10% Pay in Full Discount</Label>
                      <p className="text-xs text-amber-700">
                        {includePayInFullDiscount 
                          ? `Discount applied: £${Math.floor(currentPrice.totalPrice * 0.1)} off` 
                          : "Toggle ON to offer 10% off for upfront payment via Stripe"}
                      </p>
                    </div>
                    <Switch
                      checked={includePayInFullDiscount}
                      onCheckedChange={setIncludePayInFullDiscount}
                      className="data-[state=checked]:bg-amber-500"
                    />
                  </div>
                </div>

                {/* Sticky Price Summary Bar */}
                <div className="sticky bottom-0 -mx-6 -mb-6 p-4 bg-gray-50 rounded-b-lg shadow-lg border-t-4 border-green-400">
                  <div className="flex items-center justify-center gap-6 text-center">
                    <div>
                      <div className="text-sm text-gray-700 font-medium">Monthly (12 payments via Bumper)</div>
                      <div className="text-2xl font-bold text-gray-900">£{currentPrice.monthlyPrice}/month</div>
                    </div>
                    <div className="text-gray-400 text-2xl">|</div>
                    <div>
                      <div className="text-sm text-gray-700 font-medium">
                        Pay in Full {includePayInFullDiscount ? "(10% off)" : "(No discount)"} via Stripe
                      </div>
                      <div className="text-2xl font-bold text-gray-900">
                        £{currentPrice.payInFullPrice}
                        {includePayInFullDiscount && (
                          <span className="text-sm text-green-600 ml-2">Save £{Math.floor(currentPrice.totalPrice * 0.1)}</span>
                        )}
                      </div>
                    </div>
                    <div className="text-gray-400 text-2xl">|</div>
                    <div className="text-sm text-gray-700 font-medium">
                      <div>Total: £{currentPrice.monthlyPrice * 12}</div>
                      <div>Claim: £{(boostAddon ? getDisplayClaimLimitValue(claimLimit) + 1000 : getDisplayClaimLimitValue(claimLimit)).toLocaleString()} | Labour: £{labourRate}/hr</div>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button 
                    variant="outline"
                    onClick={() => setStep(1)}
                    className="flex-1"
                  >
                    Back
                  </Button>
                  <Button 
                    onClick={() => {
                      // Save quote data to localStorage for later
                      const savedQuote = {
                        vehicleData,
                        customerName,
                        customerEmail,
                        customerPhone,
                        paymentType,
                        excessAmount,
                        claimLimit,
                        labourRate,
                        boostAddon,
                        selectedAddOns,
                        currentPrice,
                        freeExtendedCover,
                        additionalNotes,
                        savedAt: new Date().toISOString()
                      };
                      const savedQuotes = JSON.parse(localStorage.getItem('admin_saved_quotes') || '[]');
                      savedQuotes.unshift(savedQuote);
                      localStorage.setItem('admin_saved_quotes', JSON.stringify(savedQuotes.slice(0, 50)));
                      toast({
                        title: "Quote saved",
                        description: "Quote saved for later. You can find it in your saved quotes.",
                      });
                    }}
                    className="flex-1 bg-blue-100 text-blue-700 border-blue-300 hover:bg-blue-200"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    Save Quote
                  </Button>
                  <Button 
                    onClick={handleCalculateQuote}
                    className="flex-1"
                  >
                    Preview Quote
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 3: Choose Action */}
          {step === 3 && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Step 3: Complete Order</CardTitle>
                    <CardDescription>
                      Choose to send a quote or confirm payment received elsewhere
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        setVehicleData(null);
                        setRegNumber('');
                        setMileage('');
                        setSliderMileage(0);
                        setQuoteGenerated(false);
                        setQuoteLink(null);
                        setStep(1);
                      }}
                      className="text-orange-600 border-orange-200 hover:bg-orange-50 hover:text-orange-700"
                    >
                      <RefreshCw className="w-3 h-3 mr-1" />
                      Edit Vehicle
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => {
                        setQuoteGenerated(false);
                        setQuoteLink(null);
                        setStep(2);
                      }}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      ← Back
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Quote Summary */}
                <div className="bg-muted p-4 rounded-lg">
                  <h3 className="font-semibold mb-2">Order Summary</h3>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <p><strong>Customer:</strong> {customerName}</p>
                    <p><strong>Email:</strong> {customerEmail}</p>
                    <p><strong>Vehicle:</strong> {vehicleData?.make} {vehicleData?.model} ({vehicleData?.year})</p>
                    <p><strong>Registration:</strong> {vehicleData?.regNumber}</p>
                    <p><strong>Mileage:</strong> {parseInt(vehicleData?.mileage || '0').toLocaleString()} miles</p>
                    <p><strong>Duration:</strong> {termOptions.find(t => t.id === paymentType)?.label}{freeExtendedCover !== 'none' && <span className="ml-1 text-green-600 font-semibold">+ {freeExtendedCover === '3months' ? '3' : '6'} months FREE</span>}</p>
                    <p><strong>Excess:</strong> £{excessAmount}</p>
                    <p><strong>Claim Limit:</strong> £{(boostAddon ? getDisplayClaimLimitValue(claimLimit) + 1000 : getDisplayClaimLimitValue(claimLimit)).toLocaleString()}{boostAddon ? ' (boost)' : ''}</p>
                    <p><strong>Labour Rate:</strong> £{labourRate}/hr</p>
                    <p><strong>Total Price:</strong> £{currentPrice.monthlyPrice * 12}</p>
                    {additionalNotes && <p className="col-span-2"><strong>Notes:</strong> {additionalNotes}</p>}
                  </div>
                  {freeExtendedCover !== 'none' && (
                    <div className="mt-3 p-2 bg-green-100 border border-green-300 rounded-md">
                      <p className="text-sm text-green-800 font-medium">🎁 Customer will receive {freeExtendedCover === '3months' ? '3' : '6'} FREE bonus months on their cover</p>
                    </div>
                  )}
                </div>

                {/* Two Action Cards */}
                <div className="grid md:grid-cols-2 gap-4">
                  {/* Option 1: Send Quote */}
                  <div className="p-5 rounded-lg border-2 border-blue-200 bg-blue-50/50 space-y-4">
                    <div className="flex items-center gap-2">
                      <Send className="w-5 h-5 text-blue-600" />
                      <h4 className="font-semibold text-blue-900">Send Quote to Customer</h4>
                    </div>
                    <p className="text-sm text-blue-700">
                      Customer will receive a link to complete payment via Bumper (monthly) or Stripe (pay in full).
                    </p>
                    <div className="flex gap-2 text-sm">
                      <span className="px-2 py-1 rounded bg-blue-100 text-blue-800">£{currentPrice.monthlyPrice}/mo</span>
                      <span className="px-2 py-1 rounded bg-orange-100 text-orange-800">£{currentPrice.payInFullPrice || Math.floor(currentPrice.totalPrice * 0.9)} upfront</span>
                    </div>
                    
                    {isGeneratingQuoteLink ? (
                      <div className="flex items-center gap-2 text-blue-600">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span className="text-sm">Generating quote link...</span>
                      </div>
                    ) : quoteLink ? (
                      <div className="space-y-2">
                        <div className="flex gap-2">
                          <Button
                            onClick={handleCopyQuoteLink}
                            size="sm"
                            variant="outline"
                            className="flex-1"
                          >
                            📋 Copy Link
                          </Button>
                          <Button
                            onClick={() => window.open(quoteLink, '_blank')}
                            size="sm"
                            variant="outline"
                            title="Open quote page"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                        </div>
                        <Button 
                          onClick={() => window.open(quoteLink, '_blank')}
                          variant="outline"
                          className="w-full border-purple-300 text-purple-700 hover:bg-purple-50"
                        >
                          <Eye className="w-4 h-4 mr-2" />
                          Preview Quote
                        </Button>
                        <Button 
                          onClick={handlePreviewEmail}
                          className="w-full bg-blue-600 hover:bg-blue-700"
                        >
                          <Mail className="w-4 h-4 mr-2" />
                          Email Quote
                        </Button>
                        <Button 
                          onClick={() => {
                            const message = `Hi ${customerName?.split(' ')[0] || 'there'},\n\nYour warranty quote for ${vehicleData?.make} ${vehicleData?.model} (${vehicleData?.regNumber}) is ready!\n\n💰 £${currentPrice.monthlyPrice}/month via Bumper\n💳 £${currentPrice.payInFullPrice || Math.floor(currentPrice.totalPrice * 0.9)} pay in full (10% off)\n\n🔗 Complete your purchase: ${quoteLink}\n\nBuyawarranty Customer Care\n📞 0330 229 5040`;
                            const encodedMessage = encodeURIComponent(message);
                            window.open(`https://api.whatsapp.com/send?text=${encodedMessage}`, '_blank');
                          }}
                          variant="outline"
                          className="w-full border-green-500 text-green-600 hover:bg-green-50"
                        >
                          <MessageCircle className="w-4 h-4 mr-2" />
                          WhatsApp
                        </Button>
                      </div>
                    ) : (
                      <Button onClick={handleRetryQuoteLink} variant="outline" size="sm">
                        Retry Link Generation
                      </Button>
                    )}
                  </div>

                  {/* Option 2: Confirm External Payment */}
                  <div className="p-5 rounded-lg border-2 border-green-200 bg-green-50/50 space-y-4">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-green-600" />
                      <h4 className="font-semibold text-green-900">Confirm External Payment</h4>
                    </div>
                    <p className="text-sm text-green-700">
                      Use this if payment was taken via phone, bank transfer, or another portal.
                    </p>
                    <p className="text-xs text-green-600 italic">
                      This creates the warranty, customer login, and sends welcome email.
                    </p>
                    
                    <Button 
                      onClick={handleOpenConfirmPaymentDialog}
                      className="w-full bg-green-600 hover:bg-green-700"
                    >
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      Confirm External Payment...
                    </Button>
                  </div>
                </div>

                {adminEmail && (
                  <div className="text-sm text-muted-foreground text-center">
                    ✉️ Email copy will be sent to: {adminEmail}
                  </div>
                )}

                <Button 
                  variant="outline"
                  onClick={() => {
                    setQuoteGenerated(false);
                    setQuoteLink(null);
                    setStep(2);
                  }}
                  className="w-full"
                >
                  ← Back to Edit Details
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Email Preview Dialog */}
          <Dialog open={showEmailDialog} onOpenChange={setShowEmailDialog}>
            <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Review & Send Email</DialogTitle>
                <DialogDescription>
                  Review the email details before sending
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4">
                {/* Primary Recipient */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Mail className="w-4 h-4" />
                    Sending to
                  </Label>
                  <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                    <p className="font-medium text-green-800">{customerEmail}</p>
                    <p className="text-xs text-green-600 mt-1">Primary recipient (customer)</p>
                  </div>
                </div>

                {/* Agent Copy Notice */}
                {adminEmail && adminEmail !== customerEmail && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <Copy className="w-4 h-4 text-blue-600 flex-shrink-0" />
                      <p className="text-sm text-blue-800">
                        <span className="font-bold">A copy will also be sent to you: {adminName ? `${adminName} (${adminEmail})` : adminEmail}</span>
                      </p>
                    </div>
                  </div>
                )}

                {/* Additional CC Recipients (Optional) */}
                <div className="space-y-2">
                  <Label>CC Recipients <span className="text-muted-foreground font-normal">(optional)</span></Label>
                  <div className="space-y-2">
                    {additionalEmails.map((email, index) => (
                      <div key={index} className="flex items-center gap-2 p-2 bg-muted rounded text-sm">
                        <span className="flex-1">{email}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                          onClick={() => setAdditionalEmails(prev => prev.filter((_, i) => i !== index))}
                        >
                          ×
                        </Button>
                      </div>
                    ))}
                    <Input
                      type="email"
                      placeholder="Add another email address (optional)..."
                      value={newEmailInput}
                      onChange={(e) => {
                        setNewEmailInput(e.target.value);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ',' || e.key === ' ') {
                          e.preventDefault();
                          const email = newEmailInput.trim().replace(/,+$/, '');
                          if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && !additionalEmails.includes(email)) {
                            setAdditionalEmails(prev => [...prev, email]);
                            setNewEmailInput('');
                          }
                        }
                      }}
                      onBlur={() => {
                        const email = newEmailInput.trim().replace(/,+$/, '');
                        if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && !additionalEmails.includes(email)) {
                          setAdditionalEmails(prev => [...prev, email]);
                          setNewEmailInput('');
                        }
                      }}
                    />
                  </div>
                </div>

                <div>
                  <Label>Subject</Label>
                  <Input
                    value={emailSubject}
                    onChange={(e) => setEmailSubject(e.target.value)}
                    className="mt-2"
                  />
                </div>
                
                <div className="p-4 bg-muted rounded-lg space-y-3">
                  <p className="text-sm font-medium">Email will include:</p>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>✓ Professional HTML quote template</li>
                    <li>✓ Vehicle & coverage details summary</li>
                    <li>✓ "What's Included" benefits list</li>
                    <li>✓ Payment options explanation</li>
                    <li>✓ Direct "Activate My Warranty Now" button</li>
                    <li>✓ Link: {quoteLink ? <span className="text-primary break-all">{quoteLink}</span> : 'Generating...'}</li>
                  </ul>
                  {freeExtendedCover !== 'none' && (
                    <div className="mt-2 p-2 bg-green-100 border border-green-300 rounded-md">
                      <p className="text-sm text-green-800 font-medium">🎁 Includes {freeExtendedCover === '3months' ? '3' : '6'} FREE bonus months</p>
                    </div>
                  )}
                </div>
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setShowEmailDialog(false)}
                  disabled={isSendingEmail}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSendEmail}
                  disabled={isSendingEmail}
                >
                  {isSendingEmail ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Mail className="w-4 h-4 mr-2" />
                      Send Email
                    </>
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Quote Preview Dialog */}
          <Dialog open={showPreviewDialog} onOpenChange={setShowPreviewDialog}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Eye className="w-5 h-5 text-purple-600" />
                  Quote Preview - What Customer Will See
                </DialogTitle>
                <DialogDescription>
                  Review exactly what will be shown in the email and on the quote page
                </DialogDescription>
              </DialogHeader>
              
              <Tabs defaultValue="email" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="email">📧 Email Preview</TabsTrigger>
                  <TabsTrigger value="summary">📋 Quote Summary</TabsTrigger>
                </TabsList>
                
                <TabsContent value="email" className="mt-4">
                  <div className="border rounded-lg overflow-hidden bg-gray-100">
                    <div className="bg-gray-200 p-3 border-b flex items-center gap-2">
                      <Mail className="w-4 h-4" />
                      <span className="text-sm font-medium">Email to: {customerEmail}</span>
                    </div>
                    <div className="p-4 bg-white">
                      {/* Email Header Preview */}
                      <div className="text-center mb-6">
                        <img src="https://buyawarranty.co.uk/lovable-uploads/baw-logo-new-2025.png" alt="Buy A Warranty" className="h-12 mx-auto mb-4" />
                        <h2 className="text-xl font-bold text-gray-900">
                          Here's your {vehicleData?.make} {vehicleData?.model} warranty quote
                        </h2>
                        <p className="text-sm text-gray-600 mt-2">
                          Protect your {vehicleData?.make} {vehicleData?.model} from unexpected repair bills
                        </p>
                      </div>
                      
                      {/* Greeting */}
                      <div className="mb-4">
                        <p className="text-gray-800">Hi {customerName?.split(' ')[0] || 'there'},</p>
                        <p className="text-gray-600 text-sm mt-2">
                          Thanks for requesting your personalised warranty quote. Please review your cover details below.
                        </p>
                      </div>
                      
                      {/* Quote Summary Box */}
                      <div className="bg-slate-50 rounded-lg border p-4 mb-4">
                        <p className="text-sm font-bold text-blue-700 uppercase tracking-wide mb-3">Your Cover at a Glance</p>
                        <table className="w-full text-sm">
                          <tbody>
                            <tr className="border-b">
                              <td className="py-2 text-gray-500">Vehicle</td>
                              <td className="py-2 text-right font-semibold">{vehicleData?.make} {vehicleData?.model} ({vehicleData?.regNumber})</td>
                            </tr>
                            <tr className="border-b">
                              <td className="py-2 text-gray-500">Mileage</td>
                              <td className="py-2 text-right font-semibold">{parseInt(vehicleData?.mileage || '0').toLocaleString()} miles</td>
                            </tr>
                            <tr className="border-b">
                              <td className="py-2 text-gray-500">Plan</td>
                              <td className="py-2 text-right font-semibold">Platinum cover</td>
                            </tr>
                            <tr className="border-b">
                              <td className="py-2 text-gray-500">Cover period</td>
                              <td className="py-2 text-right font-semibold">
                                {termOptions.find(t => t.id === paymentType)?.months} months
                                {freeExtendedCover !== 'none' && (
                                  <span className="text-green-600"> + {freeExtendedCover === '3months' ? '3' : '6'} months FREE</span>
                                )}
                              </td>
                            </tr>
                            <tr className="border-b">
                              <td className="py-2 text-gray-500">Claim limit</td>
                              <td className="py-2 text-right font-semibold">£{(boostAddon ? claimLimit + 1000 : claimLimit).toLocaleString()} per claim</td>
                            </tr>
                            <tr className="border-b">
                              <td className="py-2 text-gray-500">Excess</td>
                              <td className="py-2 text-right font-semibold">£{excessAmount}</td>
                            </tr>
                            <tr className="border-b">
                              <td className="py-2 text-gray-500">Labour rate covered</td>
                              <td className="py-2 text-right font-semibold">Up to £{labourRate} per hour</td>
                            </tr>
                            <tr>
                              <td className="py-3 text-gray-900 font-bold">Total price</td>
                              <td className="py-3 text-right text-xl font-bold text-orange-600">£{currentPrice.monthlyPrice * 12}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                      
                      {/* What's Included */}
                      <div className="bg-green-50 rounded-lg p-4 mb-4">
                        <p className="text-sm font-bold text-green-800 uppercase tracking-wide mb-2">What Your Warranty Includes</p>
                        <ul className="text-sm text-green-700 space-y-1">
                          <li><span className="text-green-500 font-bold mr-2">✔</span>Mechanical and electrical component cover</li>
                          <li><span className="text-green-500 font-bold mr-2">✔</span>Labour costs included</li>
                          <li><span className="text-green-500 font-bold mr-2">✔</span>Repairs at VAT-registered garages</li>
                          <li><span className="text-green-500 font-bold mr-2">✔</span>No waiting period once activated</li>
                          <li><span className="text-green-500 font-bold mr-2">✔</span>Unlimited claims up to vehicle value</li>
                          <li><span className="text-green-500 font-bold mr-2">✔</span>Fast, UK-based claims support</li>
                        </ul>
                      </div>
                      
                      {/* CTA Button Preview */}
                      <div className="text-center">
                        <div className="inline-block bg-gradient-to-r from-orange-600 to-orange-500 text-white px-8 py-4 rounded-lg font-bold shadow-lg">
                          Choose how to pay and activate my warranty
                        </div>
                        <p className="text-xs text-gray-500 mt-2">Links to: {quoteLink}</p>
                      </div>
                    </div>
                  </div>
                </TabsContent>
                
                <TabsContent value="summary" className="mt-4">
                  <div className="space-y-4">
                    {/* Customer Info */}
                    <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                      <h4 className="font-semibold text-blue-900 mb-2">👤 Customer Details</h4>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <span className="text-blue-700">Name:</span>
                        <span className="font-medium">{customerName || 'Not provided'}</span>
                        <span className="text-blue-700">Email:</span>
                        <span className="font-medium">{customerEmail}</span>
                        <span className="text-blue-700">Phone:</span>
                        <span className="font-medium">{customerPhone || 'Not provided'}</span>
                      </div>
                    </div>
                    
                    {/* Vehicle Info */}
                    <div className="bg-gray-50 rounded-lg p-4 border">
                      <h4 className="font-semibold text-gray-900 mb-2">🚗 Vehicle Details</h4>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <span className="text-gray-600">Registration:</span>
                        <span className="font-medium font-mono">{vehicleData?.regNumber}</span>
                        <span className="text-gray-600">Make/Model:</span>
                        <span className="font-medium">{vehicleData?.make} {vehicleData?.model}</span>
                        <span className="text-gray-600">Year:</span>
                        <span className="font-medium">{vehicleData?.year}</span>
                        <span className="text-gray-600">Mileage:</span>
                        <span className="font-medium">{parseInt(vehicleData?.mileage || '0').toLocaleString()} miles</span>
                        <span className="text-gray-600">Fuel Type:</span>
                        <span className="font-medium">{vehicleData?.fuelType || 'N/A'}</span>
                        <span className="text-gray-600">Transmission:</span>
                        <span className="font-medium">{vehicleData?.transmission || 'N/A'}</span>
                      </div>
                    </div>
                    
                    {/* Cover Details */}
                    <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
                      <h4 className="font-semibold text-purple-900 mb-2">🛡️ Cover Details</h4>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <span className="text-purple-700">Plan:</span>
                        <span className="font-medium">Platinum</span>
                        <span className="text-purple-700">Duration:</span>
                        <span className="font-medium">
                          {termOptions.find(t => t.id === paymentType)?.label}
                          {freeExtendedCover !== 'none' && (
                            <span className="text-green-600 font-semibold ml-1">+ {freeExtendedCover === '3months' ? '3' : '6'} FREE months</span>
                          )}
                        </span>
                        <span className="text-purple-700">Claim Limit:</span>
                        <span className="font-medium">£{(boostAddon ? claimLimit + 1000 : claimLimit).toLocaleString()}{boostAddon ? ' (boosted)' : ''}</span>
                        <span className="text-purple-700">Excess:</span>
                        <span className="font-medium">£{excessAmount}</span>
                        <span className="text-purple-700">Labour Rate:</span>
                        <span className="font-medium">£{labourRate}/hr</span>
                      </div>
                    </div>
                    
                    {/* Pricing */}
                    <div className="bg-orange-50 rounded-lg p-4 border border-orange-200">
                      <h4 className="font-semibold text-orange-900 mb-2">💰 Pricing</h4>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <span className="text-orange-700">Total Price:</span>
                        <span className="font-bold text-lg text-orange-600">£{currentPrice.monthlyPrice * 12}</span>
                        <span className="text-orange-700">Monthly Price:</span>
                        <span className="font-medium">£{currentPrice.monthlyPrice}/month</span>
                        <span className="text-orange-700">Pay in Full (10% off):</span>
                        <span className="font-medium">£{currentPrice.payInFullPrice || Math.floor(currentPrice.totalPrice * 0.9)}</span>
                      </div>
                    </div>
                    
                    {/* Quote Link */}
                    <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                      <h4 className="font-semibold text-green-900 mb-2">🔗 Quote Link</h4>
                      <p className="text-sm text-green-700 break-all font-mono">{quoteLink}</p>
                    </div>
                    
                    {/* Additional Notes */}
                    {additionalNotes && (
                      <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
                        <h4 className="font-semibold text-yellow-900 mb-2">📝 Additional Notes</h4>
                        <p className="text-sm text-yellow-800 whitespace-pre-wrap">{additionalNotes}</p>
                      </div>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
              
              <DialogFooter className="flex gap-2 mt-4">
                <Button variant="outline" onClick={() => setShowPreviewDialog(false)}>
                  Close Preview
                </Button>
                <Button onClick={() => { setShowPreviewDialog(false); handlePreviewEmail(); }}>
                  <Mail className="w-4 h-4 mr-2" />
                  Proceed to Send Email
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* External Payment Confirmation Dialog - Two Step Flow */}
          <Dialog open={showConfirmPaymentDialog} onOpenChange={(open) => {
            setShowConfirmPaymentDialog(open);
            if (!open) setExternalPaymentStep('details');
          }}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-white" largeCloseButton>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-lg">
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                  {externalPaymentStep === 'details' 
                    ? 'Confirm External Payment' 
                    : externalPaymentStep === 'preview' 
                      ? 'Review Before Submission'
                      : 'Order Complete'}
                </DialogTitle>
                <DialogDescription className="text-muted-foreground">
                  {externalPaymentStep === 'details' 
                    ? 'Step 2: Verify details and enter payment information' 
                    : externalPaymentStep === 'preview'
                      ? 'Step 3: Review all data before creating the policy'
                      : 'Step 4: Confirmation status'}
                </DialogDescription>
              </DialogHeader>

              {existingPolicyWarning && externalPaymentStep !== 'complete' && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{existingPolicyWarning}</AlertDescription>
                </Alert>
              )}

              {externalPaymentStep === 'details' ? (
                <div className="space-y-3">
                  {/* Customer & Vehicle Details - Collapsible */}
                  <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                    <button
                      type="button"
                      onClick={() => toggleSection('customerVehicle')}
                      className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <UserCheck className="w-4 h-4 text-blue-600" />
                        <div className="text-left">
                          <h4 className="font-semibold text-gray-800 text-sm">Customer & Vehicle Details</h4>
                          {!expandedSections.customerVehicle && (
                            <p className="text-xs text-gray-500 mt-0.5">
                              {editableCustomerName || 'No name'} • {editableRegNumber || 'No reg'} • {vehicleData?.make} {vehicleData?.model}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-blue-600 font-medium">
                          {expandedSections.customerVehicle ? 'Close' : 'Edit'}
                        </span>
                        <ChevronDown className={cn(
                          "w-4 h-4 text-gray-400 transition-transform",
                          expandedSections.customerVehicle && "rotate-180"
                        )} />
                      </div>
                    </button>
                    
                    {expandedSections.customerVehicle && (
                      <div className="px-4 pb-4 pt-0 border-t border-gray-100">
                        <div className="grid grid-cols-2 gap-4 pt-4">
                          <div className="space-y-1.5">
                            <Label className="text-xs font-medium text-gray-600">Customer Name *</Label>
                            <Input
                              value={editableCustomerName}
                              onChange={(e) => setEditableCustomerName(e.target.value)}
                              className="bg-gray-50 border-gray-200 focus:bg-white focus:border-blue-400 transition-colors"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs font-medium text-gray-600">Email *</Label>
                            <Input
                              value={editableCustomerEmail}
                              onChange={(e) => setEditableCustomerEmail(e.target.value)}
                              className="bg-gray-50 border-gray-200 focus:bg-white focus:border-blue-400 transition-colors"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs font-medium text-gray-600">Phone</Label>
                            <Input
                              value={editableCustomerPhone}
                              onChange={(e) => setEditableCustomerPhone(e.target.value)}
                              placeholder="07xxx xxxxxx"
                              className="bg-gray-50 border-gray-200 focus:bg-white focus:border-blue-400 transition-colors"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs font-medium text-gray-600">Registration *</Label>
                            <Input
                              value={editableRegNumber}
                              onChange={(e) => setEditableRegNumber(e.target.value.toUpperCase())}
                              className="bg-gray-50 border-gray-200 focus:bg-white focus:border-blue-400 transition-colors font-mono"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs font-medium text-gray-600">Vehicle</Label>
                            <p className="text-sm text-gray-800 py-2 px-3 bg-gray-50 rounded-md border border-gray-200">{vehicleData?.make} {vehicleData?.model} ({vehicleData?.year})</p>
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs font-medium text-gray-600 flex items-center gap-2">
                              Mileage
                              {motMileageLoading && (
                                <span className="flex items-center gap-1 text-xs text-blue-600">
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                  Looking up MOT...
                                </span>
                              )}
                            </Label>
                            <div className="relative">
                              <Input
                                value={editableMileage}
                                onChange={(e) => {
                                  setEditableMileage(e.target.value.replace(/\D/g, ''));
                                  setMileagePrefilledFromMot(false);
                                }}
                                placeholder="e.g. 45000"
                                className={cn(
                                  "bg-gray-50 border-gray-200 focus:bg-white focus:border-blue-400 transition-colors",
                                  mileagePrefilledFromMot && "pr-8"
                                )}
                              />
                              {mileagePrefilledFromMot && (
                                <CheckCircle2 className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-green-500" />
                              )}
                            </div>
                            {mileagePrefilledFromMot && motDate && (
                              <p className="text-xs text-green-600 flex items-center gap-1">
                                <Car className="w-3 h-3" />
                                Pre-filled from MOT ({format(new Date(motDate), 'MMM yyyy')})
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Address Section - Collapsible */}
                  <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                    <button
                      type="button"
                      onClick={() => toggleSection('address')}
                      className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-lg">📍</span>
                        <div className="text-left">
                          <h4 className="font-semibold text-gray-800 text-sm">Customer Address</h4>
                          {!expandedSections.address && (
                            <p className="text-xs text-gray-500 mt-0.5">
                              {skipAddressDetails ? 'Customer will complete in dashboard' : (customerPostcode ? `${customerBuildingNumber} ${customerStreet}, ${customerPostcode}` : 'Not entered')}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-blue-600 font-medium">
                          {expandedSections.address ? 'Close' : 'Edit'}
                        </span>
                        <ChevronDown className={cn(
                          "w-4 h-4 text-gray-400 transition-transform",
                          expandedSections.address && "rotate-180"
                        )} />
                      </div>
                    </button>
                    
                    {expandedSections.address && (
                      <div className="px-4 pb-4 pt-0 border-t border-gray-100">
                        <div className="flex items-center gap-2 pt-3 pb-2">
                          <Checkbox
                            id="skip-address"
                            checked={skipAddressDetails}
                            onCheckedChange={(checked) => setSkipAddressDetails(checked === true)}
                          />
                          <Label htmlFor="skip-address" className="text-xs text-gray-600 cursor-pointer">
                            Customer will complete in dashboard
                          </Label>
                        </div>
                        
                        {!skipAddressDetails && (
                          <div className="grid grid-cols-2 gap-4 pt-2">
                            <div className="space-y-1.5">
                              <Label className="text-xs font-medium text-gray-600">House/Building Number</Label>
                              <Input
                                value={customerBuildingNumber}
                                onChange={(e) => setCustomerBuildingNumber(e.target.value)}
                                placeholder="e.g. 42"
                                className="bg-gray-50 border-gray-200 focus:bg-white focus:border-blue-400 transition-colors"
                              />
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-xs font-medium text-gray-600">Street</Label>
                              <Input
                                value={customerStreet}
                                onChange={(e) => setCustomerStreet(e.target.value)}
                                placeholder="e.g. High Street"
                                className="bg-gray-50 border-gray-200 focus:bg-white focus:border-blue-400 transition-colors"
                              />
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-xs font-medium text-gray-600">Town/City</Label>
                              <Input
                                value={customerTown}
                                onChange={(e) => setCustomerTown(e.target.value)}
                                placeholder="e.g. Manchester"
                                className="bg-gray-50 border-gray-200 focus:bg-white focus:border-blue-400 transition-colors"
                              />
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-xs font-medium text-gray-600">County</Label>
                              <Input
                                value={customerCounty}
                                onChange={(e) => setCustomerCounty(e.target.value)}
                                placeholder="e.g. Greater Manchester"
                                className="bg-gray-50 border-gray-200 focus:bg-white focus:border-blue-400 transition-colors"
                              />
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-xs font-medium text-gray-600">Postcode *</Label>
                              <Input
                                value={customerPostcode}
                                onChange={(e) => setCustomerPostcode(e.target.value.toUpperCase())}
                                placeholder="e.g. M1 1AA"
                                className="bg-gray-50 border-gray-200 focus:bg-white focus:border-blue-400 transition-colors"
                              />
                            </div>
                          </div>
                        )}
                        
                        {skipAddressDetails && (
                          <Alert className="bg-gray-50 border-gray-200 mt-2">
                            <Info className="h-4 w-4 text-gray-500" />
                            <AlertDescription className="text-gray-600 text-sm">
                              The customer will be prompted to complete their address when they log into their dashboard.
                            </AlertDescription>
                          </Alert>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Policy Configuration - Collapsible & Editable */}
                  <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                    <button
                      type="button"
                      onClick={() => toggleSection('policyConfig')}
                      className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <Zap className="w-4 h-4 text-purple-600" />
                        <div className="text-left">
                          <h4 className="font-semibold text-gray-800 text-sm">Policy Configuration</h4>
                          {!expandedSections.policyConfig && (
                            <p className="text-xs text-gray-500 mt-0.5">
                              {termOptions.find(t => t.id === paymentType)?.label} • £{excessAmount} excess • £{currentPrice.totalPrice} total
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-blue-600 font-medium">
                          {expandedSections.policyConfig ? 'Close' : 'Edit'}
                        </span>
                        <ChevronDown className={cn(
                          "w-4 h-4 text-gray-400 transition-transform",
                          expandedSections.policyConfig && "rotate-180"
                        )} />
                      </div>
                    </button>
                    
                    {expandedSections.policyConfig && (
                      <div className="px-4 pb-4 pt-0 border-t border-gray-100">
                        <div className="grid grid-cols-2 gap-4 text-sm pt-4">
                          {/* Plan - Read only */}
                          <div className="space-y-1.5">
                            <Label className="text-xs font-medium text-gray-500">Plan</Label>
                            <div className="px-3 py-2 bg-gray-100 rounded-md text-gray-800 font-medium text-sm">Platinum</div>
                          </div>
                          
                          {/* Duration - Editable */}
                          <div className="space-y-1.5">
                            <Label className="text-xs font-medium text-gray-500">Duration</Label>
                            <select
                              value={paymentType}
                              onChange={(e) => setPaymentType(e.target.value as '12months' | '24months' | '36months')}
                              className="w-full px-3 py-2 border border-gray-200 rounded-md bg-gray-50 focus:bg-white focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400 transition-colors text-sm"
                            >
                              {termOptions.map(term => (
                                <option key={term.id} value={term.id}>{term.label}</option>
                              ))}
                            </select>
                          </div>
                          
                          {/* Excess - Editable */}
                          <div className="space-y-1.5">
                            <Label className="text-xs font-medium text-gray-500">Excess</Label>
                            <select
                              value={excessAmount}
                              onChange={(e) => setExcessAmount(parseInt(e.target.value))}
                              className="w-full px-3 py-2 border border-gray-200 rounded-md bg-gray-50 focus:bg-white focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400 transition-colors text-sm"
                            >
                              {[0, 50, 100, 150, 200, 250, 300].map(val => (
                                <option key={val} value={val}>£{val}</option>
                              ))}
                            </select>
                          </div>
                          
                          {/* Claim Limit - Editable */}
                          <div className="space-y-1.5">
                            <Label className="text-xs font-medium text-gray-500">Claim Limit</Label>
                            <select
                              value={claimLimit === 2000 && boostAddon ? 3000 : claimLimit}
                              onChange={(e) => {
                                const val = parseInt(e.target.value);
                                if (val === 3000) {
                                  setClaimLimit(2000);
                                  setBoostAddon(true);
                                } else if (val === 5000) {
                                  setClaimLimit(5000);
                                  setBoostAddon(false);
                                } else {
                                  setClaimLimit(val);
                                  setBoostAddon(false);
                                }
                              }}
                              className="w-full px-3 py-2 border border-gray-200 rounded-md bg-gray-50 focus:bg-white focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400 transition-colors text-sm"
                            >
                              {getVisibleClaimLimits(vehicleData?.make).map(opt => (
                                <option key={opt.value} value={opt.value}>£{opt.value.toLocaleString()} - {opt.description}</option>
                              ))}
                            </select>
                          </div>
                          
                          {/* Labour Rate - Editable */}
                          <div className="space-y-1.5">
                            <Label className="text-xs font-medium text-gray-500">Labour Rate</Label>
                            <select
                              value={labourRate}
                              onChange={(e) => setLabourRate(parseInt(e.target.value))}
                              className="w-full px-3 py-2 border border-gray-200 rounded-md bg-gray-50 focus:bg-white focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400 transition-colors text-sm"
                            >
                              {labourRateOptions.map(opt => (
                                <option key={opt.rate} value={opt.rate}>£{opt.rate}/hr</option>
                              ))}
                            </select>
                          </div>
                          
                          {/* Quoted Price - Display only, auto-updates */}
                          <div className="space-y-1.5">
                            <Label className="text-xs font-medium text-gray-500">Quoted Price</Label>
                            <div className="px-3 py-2 bg-green-50 border border-green-200 rounded-md text-green-800 font-semibold text-base">
                              £{currentPrice.totalPrice}
                            </div>
                          </div>
                          
                          {/* Boost Add-on Toggle */}
                          <div className="col-span-2 flex items-center gap-3 pt-2">
                            <Checkbox
                              id="boost-addon-confirm"
                              checked={boostAddon}
                              onCheckedChange={(checked) => setBoostAddon(checked === true)}
                            />
                            <Label htmlFor="boost-addon-confirm" className="text-sm cursor-pointer">
                              Boost Add-on (+£1,000 claim limit)
                            </Label>
                          </div>
                          
                          {/* Included Add-ons Info */}
                          {getAutoIncludedAddOns(paymentType).length > 0 && (
                            <div className="col-span-2 p-2 bg-blue-50 border border-blue-200 rounded-md">
                              <span className="text-xs font-medium text-blue-700">Included Add-ons: </span>
                              <span className="text-xs text-blue-800">
                                {getAutoIncludedAddOns(paymentType).includes('breakdown') && 'Vehicle Recovery'}
                                {getAutoIncludedAddOns(paymentType).includes('breakdown') && getAutoIncludedAddOns(paymentType).includes('rental') && ', '}
                                {getAutoIncludedAddOns(paymentType).includes('rental') && 'Hire Car'}
                              </span>
                            </div>
                          )}
                          
                          {/* Free Extended Cover */}
                          {freeExtendedCover !== 'none' && (
                            <div className="col-span-2 p-2 bg-green-50 border border-green-200 rounded-md">
                              <span className="text-xs font-medium text-green-700">🎁 FREE Extended Cover: </span>
                              <span className="text-xs text-green-800">
                                {freeExtendedCover === '3months' ? '3' : '6'} bonus months
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Payment Details Section */}
                  <div className="p-5 bg-white border border-gray-200 rounded-xl shadow-sm space-y-4">
                    <h4 className="font-semibold text-gray-800 flex items-center gap-2 text-base">
                      💳 Payment Details
                    </h4>
                    
                    {/* Payment Source */}
                    <div className="space-y-1.5">
                      <Label htmlFor="payment-source" className="text-xs font-medium text-gray-600">Payment Source *</Label>
                      <select
                        id="payment-source"
                        value={paymentSource}
                        onChange={(e) => setPaymentSource(e.target.value)}
                        className="w-full px-3 py-2.5 border border-gray-200 rounded-md bg-gray-50 focus:bg-white focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400 transition-colors text-sm"
                      >
                        <option value="">Select payment source...</option>
                        <option value="stripe_dashboard">Stripe Dashboard</option>
                        <option value="bumper_portal">Bumper Portal</option>
                        <option value="payment_assist">Payment Assist</option>
                        <option value="bank_transfer">Bank Transfer</option>
                        <option value="phone_card">Phone Card Payment</option>
                        <option value="dealer_portal">Dealer Portal</option>
                        <option value="other">Other</option>
                      </select>
                    </div>

                    {/* Amount */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label htmlFor="payment-amount" className="text-xs font-medium text-gray-600">Amount Received (£) *</Label>
                        <Input
                          id="payment-amount"
                          type="number"
                          value={paymentAmount}
                          onChange={(e) => setPaymentAmount(e.target.value)}
                          placeholder={currentPrice.totalPrice.toString()}
                          className="bg-gray-50 border-gray-200 focus:bg-white focus:border-blue-400 transition-colors"
                        />
                        {paymentAmount && Math.abs(parseFloat(paymentAmount) - currentPrice.totalPrice) > 1 && (
                          <p className="text-xs text-amber-600">
                            ⚠️ Differs from quoted price (£{currentPrice.totalPrice})
                          </p>
                        )}
                      </div>
                    </div>
                    
                    {/* Warranty Start Date Picker */}
                    <div className="space-y-3">
                      <Label className="flex items-center gap-2 text-xs font-medium text-gray-600">
                        <CalendarIcon className="w-4 h-4" />
                        Warranty Start Date *
                      </Label>
                      
                      {/* Start Date Options */}
                      <div className="grid grid-cols-2 gap-3">
                        {/* Today Option */}
                        <button
                          type="button"
                          onClick={() => setWarrantyStartDate(new Date())}
                          className={cn(
                            "flex items-center gap-2 p-3 rounded-lg border-2 transition-all duration-200 text-left",
                            isToday(warrantyStartDate)
                              ? "border-green-500 bg-green-50 text-green-700"
                              : "border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50"
                          )}
                        >
                          <CheckCircle2 className={cn(
                            "w-4 h-4 flex-shrink-0",
                            isToday(warrantyStartDate) ? "text-green-600" : "text-gray-400"
                          )} />
                          <div>
                            <span className="font-medium text-sm">Start Today</span>
                            <p className="text-xs text-muted-foreground">{format(new Date(), 'd MMM yyyy')}</p>
                          </div>
                        </button>

                        {/* Future Date Picker */}
                        <Popover open={isStartDateCalendarOpen} onOpenChange={setIsStartDateCalendarOpen}>
                          <PopoverTrigger asChild>
                            <button
                              type="button"
                              className={cn(
                                "flex items-center gap-2 p-3 rounded-lg border-2 transition-all duration-200 text-left",
                                !isToday(warrantyStartDate)
                                  ? "border-green-500 bg-green-50 text-green-700"
                                  : "border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50"
                              )}
                            >
                              <CalendarIcon className={cn(
                                "w-4 h-4 flex-shrink-0",
                                !isToday(warrantyStartDate) ? "text-green-600" : "text-gray-400"
                              )} />
                              <div>
                                <span className="font-medium text-sm">
                                  {!isToday(warrantyStartDate) ? format(warrantyStartDate, 'd MMM yyyy') : 'Future Date'}
                                </span>
                                <p className="text-xs text-muted-foreground">Select from calendar</p>
                              </div>
                            </button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="center" sideOffset={8}>
                            <CalendarComponent
                              mode="single"
                              selected={warrantyStartDate}
                              onSelect={(date) => {
                                if (date) {
                                  setWarrantyStartDate(date);
                                  setIsStartDateCalendarOpen(false);
                                }
                              }}
                              disabled={(date) => isBefore(startOfDay(date), startOfDay(new Date()))}
                              initialFocus
                              className="p-3 pointer-events-auto"
                            />
                          </PopoverContent>
                        </Popover>
                      </div>

                      {/* Future Start Date Note */}
                      {!isToday(warrantyStartDate) && (
                        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                          <div className="flex items-start gap-2">
                            <Info className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                            <div className="text-sm text-blue-800">
                              <p className="font-medium">Payment is processed today</p>
                              <p className="text-blue-700 mt-1">
                                The warranty will be activated on <span className="font-semibold">{format(warrantyStartDate, 'd MMMM yyyy')}</span>.
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Notes */}
                    <div className="space-y-1.5">
                      <Label htmlFor="payment-notes" className="text-xs font-medium text-gray-600">Internal Notes (optional)</Label>
                      <Textarea
                        id="payment-notes"
                        value={paymentNotes}
                        onChange={(e) => setPaymentNotes(e.target.value)}
                        placeholder="Any additional notes about this payment..."
                        rows={2}
                        className="bg-gray-50 border-gray-200 focus:bg-white focus:border-blue-400 transition-colors"
                      />
                    </div>
                  </div>

                  {/* Options */}
                  <div className="space-y-2 pt-2 border-t">
                    <div className="flex items-center space-x-2">
                      <Checkbox 
                        id="confirm-send-w2k" 
                        checked={sendToW2k}
                        onCheckedChange={(checked) => setSendToW2k(checked === true)}
                      />
                      <Label htmlFor="confirm-send-w2k" className="text-sm cursor-pointer">
                        Send to Warranties Register
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox 
                        id="confirm-send-welcome" 
                        checked={sendWelcomeEmail}
                        onCheckedChange={(checked) => setSendWelcomeEmail(checked === true)}
                      />
                      <Label htmlFor="confirm-send-welcome" className="text-sm cursor-pointer">
                        Send welcome email with login details
                      </Label>
                    </div>
                  </div>
                </div>
              ) : externalPaymentStep === 'preview' ? (
                /* Preview Step */
                <div className="space-y-4">
                  {(() => {
                    const preview = getExternalPaymentPreviewData();
                    const hasPriceDifference = Math.abs(parseFloat(paymentAmount) - currentPrice.totalPrice) > 1;
                    return (
                      <>
                        <Alert className="bg-amber-50 border-amber-200">
                          <Eye className="h-4 w-4 text-amber-600" />
                          <AlertDescription className="text-amber-800">
                            Please review all information carefully before confirming. This data will be saved to your Customer Dashboard{sendToW2k ? ' and Warranties Register' : ''}.
                          </AlertDescription>
                        </Alert>

                        {/* Customer Dashboard Data with Edit Button */}
                        <div className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg space-y-3">
                          <div className="flex items-center justify-between">
                            <h4 className="font-semibold text-green-900 flex items-center gap-2">
                              <UserCheck className="w-4 h-4" />
                              Customer Dashboard Record
                            </h4>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setExternalPaymentStep('details')}
                              className="text-xs h-7"
                            >
                              ✏️ Edit Details
                            </Button>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div><span className="font-medium">Name:</span> {preview.customer.name}</div>
                            <div><span className="font-medium">Email:</span> {preview.customer.email}</div>
                            <div><span className="font-medium">Phone:</span> {preview.customer.phone}</div>
                            <div><span className="font-medium">Registration:</span> {preview.vehicle.registration}</div>
                            <div><span className="font-medium">Vehicle:</span> {preview.vehicle.make} {preview.vehicle.model} ({preview.vehicle.year})</div>
                            <div><span className="font-medium">Mileage:</span> {preview.vehicle.mileage} miles</div>
                            <div><span className="font-medium">Plan:</span> {preview.policy.planType}</div>
                            <div><span className="font-medium">Duration:</span> {preview.policy.duration}</div>
                            <div><span className="font-medium">Start Date:</span> {preview.policy.startDate}</div>
                            <div><span className="font-medium">End Date:</span> {preview.policy.endDate}</div>
                            <div><span className="font-medium">Excess:</span> £{preview.policy.excess}</div>
                            <div><span className="font-medium">Claim Limit:</span> £{preview.policy.claimLimit.toLocaleString()}</div>
                            <div><span className="font-medium">Labour Rate:</span> £{preview.policy.labourRate}/hr</div>
                            <div><span className="font-medium">Payment Amount:</span> £{preview.payment.amount}</div>
                            <div><span className="font-medium">Payment Source:</span> {preview.payment.source}</div>
                            {preview.policy.breakdownRecovery && <div className="text-green-700">✓ Breakdown Recovery</div>}
                            {preview.policy.vehicleRental && <div className="text-green-700">✓ Hire Car Cover</div>}
                            {preview.policy.boostAddon && <div className="text-green-700">✓ Boost Add-on</div>}
                            {preview.policy.freeExtendedCover !== 'none' && (
                              <div className="col-span-2 text-green-700 font-medium">
                                🎁 FREE Extended Cover: {preview.policy.freeExtendedCover === '3months' ? '3' : '6'} bonus months
                              </div>
                            )}
                            {preview.policy.isFutureStart && (
                              <div className="col-span-2 p-2 bg-blue-100 border border-blue-200 rounded text-blue-800 text-sm">
                                <span className="font-medium">📅 Future Start:</span> Payment today, warranty activates on {preview.policy.startDate}
                              </div>
                            )}
                          </div>
                          
                          {/* Price difference info (non-blocking) */}
                          {hasPriceDifference && (
                            <div className="p-2 bg-amber-50 border border-amber-200 rounded text-amber-800 text-sm">
                              <span className="font-medium">💰 Price Override:</span> Payment amount (£{preview.payment.amount}) differs from quoted price (£{currentPrice.totalPrice}). 
                              {paymentNotes ? <span className="text-green-700"> Note added.</span> : <span className="text-amber-700"> Consider adding a note.</span>}
                            </div>
                          )}
                        </div>

                        {/* Warranties Register Confirmation - Simplified */}
                        {sendToW2k && (
                          <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg space-y-3">
                            <div className="flex items-center gap-2">
                              <Send className="w-4 h-4 text-blue-600" />
                              <h4 className="font-semibold text-blue-900">Confirm on Warranties Register</h4>
                            </div>
                            <p className="text-sm text-blue-800">
                              The same customer and vehicle details shown above will be registered with Warranties Register for claims processing.
                            </p>
                            {preview.integrations.w2kNotes && (
                              <div className="p-2 bg-white/50 rounded text-sm">
                                <span className="font-medium text-blue-900">Notes:</span>
                                <p className="text-blue-700 mt-1">{preview.integrations.w2kNotes}</p>
                              </div>
                            )}
                            {preview.policy.isFutureStart && (
                              <div className="p-2 bg-amber-100 border border-amber-200 rounded text-sm text-amber-800">
                                <span className="font-medium">⏰ Scheduled:</span> Registration will be processed on {preview.policy.startDate}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Welcome Email */}
                        {sendWelcomeEmail && (
                          <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
                            <p className="text-sm text-orange-800">
                              <Mail className="w-4 h-4 inline mr-1" />
                              Welcome email with dashboard login will be sent to: <strong>{preview.customer.email}</strong>
                            </p>
                          </div>
                        )}

                        {/* Final Confirmation */}
                        <div className="p-3 border rounded-md bg-green-50 border-green-200">
                          <div className="flex items-start space-x-3">
                            <Checkbox 
                              id="confirm-payment-final"
                              checked={paymentConfirmed}
                              onCheckedChange={(checked) => setPaymentConfirmed(checked === true)}
                              className="mt-1"
                            />
                            <Label htmlFor="confirm-payment-final" className="text-sm text-green-800 cursor-pointer leading-relaxed">
                              <strong>I confirm</strong> all the above information is correct and payment has been received. This will activate the warranty immediately.
                            </Label>
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </div>
              ) : null}

              {/* Complete Step - Show confirmation status */}
              {externalPaymentStep === 'complete' && completionStatus && (
                <div className="space-y-4 py-4">
                  <div className="text-center mb-6">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <CheckCircle2 className="w-10 h-10 text-green-600" />
                    </div>
                    <h3 className="text-xl font-semibold text-green-800">
                      {completionStatus.isFutureStart ? 'Policy Scheduled!' : 'Policy Activated!'}
                    </h3>
                    <p className="text-muted-foreground mt-1">
                      Warranty Reference: <strong>{completionStatus.warrantyReference}</strong>
                    </p>
                  </div>

                  {/* Status Items */}
                  <div className="space-y-3">
                    {/* Policy Created */}
                    <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
                      <div className="flex items-center gap-3">
                        <CheckCircle2 className="w-5 h-5 text-green-600" />
                        <span className="font-medium">Policy Created in Dashboard</span>
                      </div>
                      <Badge variant="outline" className="bg-green-100 text-green-700 border-green-300">
                        ✓ Complete
                      </Badge>
                    </div>

                    {/* Email Status */}
                    {sendWelcomeEmail && (
                      <div className={cn(
                        "flex items-center justify-between p-3 border rounded-lg",
                        completionStatus.emailSent === true 
                          ? "bg-green-50 border-green-200" 
                          : completionStatus.emailSent === false 
                            ? "bg-red-50 border-red-200"
                            : "bg-gray-50 border-gray-200"
                      )}>
                        <div className="flex items-center gap-3">
                          {completionStatus.emailSent === true ? (
                            <CheckCircle2 className="w-5 h-5 text-green-600" />
                          ) : completionStatus.emailSent === false ? (
                            <AlertCircle className="w-5 h-5 text-red-600" />
                          ) : (
                            <Loader2 className="w-5 h-5 text-gray-500 animate-spin" />
                          )}
                          <div>
                            <span className="font-medium">Welcome Email to Customer</span>
                            <p className="text-xs text-muted-foreground">{customerEmail}</p>
                          </div>
                        </div>
                        <Badge 
                          variant="outline" 
                          className={cn(
                            completionStatus.emailSent === true 
                              ? "bg-green-100 text-green-700 border-green-300"
                              : completionStatus.emailSent === false
                                ? "bg-red-100 text-red-700 border-red-300"
                                : "bg-gray-100 text-gray-700 border-gray-300"
                          )}
                        >
                          {completionStatus.emailSent === true ? '✓ Sent' : completionStatus.emailSent === false ? '✗ Failed' : 'Pending'}
                        </Badge>
                      </div>
                    )}

                    {/* Warranty Registration Status - Note: Only shown as info, detailed status in dashboard */}
                    {sendToW2k && (
                      <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <div className="flex items-center gap-3">
                          <Info className="w-5 h-5 text-blue-600" />
                          <div>
                            <span className="font-medium text-blue-800">Warranty Registered</span>
                            <p className="text-xs text-blue-600">
                              {completionStatus.isFutureStart 
                                ? 'Scheduled - will be registered on warranty start date' 
                                : completionStatus.w2000Sent === true 
                                  ? 'Successfully registered' 
                                  : completionStatus.w2000Sent === false 
                                    ? 'Registration failed - check customer dashboard for details'
                                    : 'Processing registration...'}
                            </p>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground mt-2 pl-8">
                          Full warranty registration status available in the Customer Dashboard
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Professional Note */}
                  <Alert className="mt-4">
                    <Info className="h-4 w-4" />
                    <AlertDescription>
                      {completionStatus.isFutureStart ? (
                        <>
                          <strong>Payment processed today.</strong> The warranty will be activated on the scheduled start date. 
                          The customer has received confirmation of their upcoming cover.
                        </>
                      ) : (
                        <>
                          <strong>Order complete.</strong> The customer now has access to their warranty dashboard 
                          and has been sent their policy documentation.
                        </>
                      )}
                    </AlertDescription>
                  </Alert>
                </div>
              )}

              <DialogFooter className="flex flex-col gap-2">
                {externalPaymentStep === 'details' ? (
                  <>
                    {/* Validation helper - show what's missing */}
                    {(!paymentSource || !paymentAmount) && (
                      <div className="w-full text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-md p-2 flex items-center gap-2">
                        <span>⚠️</span>
                        <span>
                          {!paymentSource && !paymentAmount 
                            ? 'Please select a payment source and enter the amount received'
                            : !paymentSource 
                              ? 'Please select a payment source'
                              : 'Please enter the amount received'}
                        </span>
                      </div>
                    )}
                    <div className="flex gap-2 w-full justify-end">
                      <Button
                        variant="outline"
                        onClick={() => setShowConfirmPaymentDialog(false)}
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={() => setExternalPaymentStep('preview')}
                        disabled={!paymentSource || !paymentAmount}
                        className="bg-blue-600 hover:bg-blue-700"
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        Preview Before Submit
                      </Button>
                    </div>
                  </>
                ) : externalPaymentStep === 'preview' ? (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => setExternalPaymentStep('details')}
                      disabled={isConfirmingPaid}
                    >
                      ← Back to Edit
                    </Button>
                    <Button
                      onClick={handleConfirmExternalPayment}
                      disabled={isConfirmingPaid || !paymentConfirmed}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      {isConfirmingPaid ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Creating Policy...
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4 mr-2" />
                          Confirm & Activate Policy
                        </>
                      )}
                    </Button>
                  </>
                ) : (
                  <Button
                    onClick={() => {
                      setShowConfirmPaymentDialog(false);
                      resetForm();
                    }}
                    className="bg-brand-orange hover:bg-brand-orange/90"
                  >
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Done - Close
                  </Button>
                )}
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Age Override Confirmation Dialog */}
          <Dialog open={showAgeOverrideConfirm} onOpenChange={setShowAgeOverrideConfirm}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-orange-600">
                  <AlertCircle className="h-5 w-5" />
                  Override Age Limit
                </DialogTitle>
                <DialogDescription>
                  You are about to allow a vehicle older than 15 years to be quoted/ordered. This vehicle will be priced using the same pricing as vehicles between 12 years 1 day and 15 years old.
                </DialogDescription>
              </DialogHeader>
              <div className="py-2">
                <p className="text-sm font-semibold text-gray-900">Are you sure you are authorised to do this?</p>
              </div>
              <DialogFooter className="gap-2 sm:gap-0">
                <Button variant="outline" onClick={() => setShowAgeOverrideConfirm(false)}>
                  Cancel
                </Button>
                <Button 
                  className="bg-orange-600 hover:bg-orange-700"
                  onClick={() => {
                    setAgeOverrideEnabled(true);
                    setShowAgeOverrideConfirm(false);
                    toast({
                      title: "Age Override Enabled",
                      description: "You can now proceed with vehicles older than 15 years.",
                    });
                  }}
                >
                  Yes, I'm Authorised
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* History Quote View Dialog */}
          <Dialog open={showHistoryDialog} onOpenChange={setShowHistoryDialog}>
            <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Quote Details</DialogTitle>
                <DialogDescription>
                  {selectedHistoryQuote && `Sent to ${selectedHistoryQuote.customer_email} on ${new Date(selectedHistoryQuote.sent_at).toLocaleString()}`}
                </DialogDescription>
              </DialogHeader>
              
              {selectedHistoryQuote && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
                    <div>
                      <p className="text-sm font-semibold">Customer</p>
                      <p className="text-sm">{selectedHistoryQuote.customer_name}</p>
                      <p className="text-xs text-muted-foreground">{selectedHistoryQuote.customer_email}</p>
                    </div>
                    <div>
                      <p className="text-sm font-semibold">Vehicle</p>
                      <p className="text-sm">{selectedHistoryQuote.vehicle_reg}</p>
                      <p className="text-xs text-muted-foreground">{selectedHistoryQuote.vehicle_make} {selectedHistoryQuote.vehicle_model}</p>
                    </div>
                    <div>
                      <p className="text-sm font-semibold">Price</p>
                      <p className="text-sm">£{selectedHistoryQuote.total_price}</p>
                      <p className="text-xs text-muted-foreground">£{selectedHistoryQuote.monthly_price}/month</p>
                    </div>
                    <div>
                      <p className="text-sm font-semibold">Coverage</p>
                      <p className="text-sm">£{selectedHistoryQuote.excess_amount} excess | £{selectedHistoryQuote.claim_limit} limit</p>
                      <p className="text-xs text-muted-foreground">
                        £{selectedHistoryQuote.labour_rate || 70}/hr labour
                        {selectedHistoryQuote.boost_addon && ' | Boost enabled'}
                      </p>
                    </div>
                    {selectedHistoryQuote.additional_notes && (
                      <div className="col-span-2">
                        <p className="text-sm font-semibold">Additional Notes</p>
                        <p className="text-sm text-muted-foreground">{selectedHistoryQuote.additional_notes}</p>
                      </div>
                    )}
                  </div>

                  <div>
                    <Label>Subject</Label>
                    <Input value={selectedHistoryQuote.email_subject} readOnly className="mt-2" />
                  </div>
                  
                  <div>
                    <Label>Email Content</Label>
                    <Textarea
                      value={selectedHistoryQuote.email_content}
                      readOnly
                      rows={15}
                      className="mt-2 font-mono text-sm"
                    />
                  </div>
                </div>
              )}

              <DialogFooter>
                <Button variant="outline" onClick={() => setShowHistoryDialog(false)}>
                  Close
                </Button>
                {selectedHistoryQuote && (
                  <Button onClick={() => handleResendQuote(selectedHistoryQuote)} disabled={isSendingEmail}>
                    {isSendingEmail ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Resending...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Resend Quote
                      </>
                    )}
                  </Button>
                )}
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent value="history" className="space-y-6 mt-6">
          {/* Sub-tabs for Sent vs Saved */}
          <div className="flex gap-2 mb-4">
            <Button
              variant={historySubTab === 'sent' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setHistorySubTab('sent')}
              className="gap-2"
            >
              <Send className="w-4 h-4" />
              Sent Quotes ({sentQuotes.length})
            </Button>
            <Button
              variant={historySubTab === 'saved' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setHistorySubTab('saved')}
              className="gap-2"
            >
              <BookOpen className="w-4 h-4" />
              Saved Drafts ({savedQuotes.length})
            </Button>
          </div>

          {/* Sent Quotes Section */}
          {historySubTab === 'sent' && (
            <Card>
              <CardHeader>
                <CardTitle>Quote & Order History</CardTitle>
                <CardDescription>View and resend previously sent quotes</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingHistory ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin" />
                  </div>
                ) : sentQuotes.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No quotes sent yet</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Vehicle</TableHead>
                        <TableHead>Duration</TableHead>
                        <TableHead>Coverage</TableHead>
                        <TableHead>Price</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sentQuotes.map((quote) => (
                        <TableRow key={quote.id}>
                          <TableCell>
                            <div className="text-sm">
                              {new Date(quote.sent_at).toLocaleDateString()}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {new Date(quote.sent_at).toLocaleTimeString()}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm font-medium">{quote.customer_name}</div>
                            <div className="text-xs text-muted-foreground">{quote.customer_email}</div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm font-medium">{quote.vehicle_reg}</div>
                            <div className="text-xs text-muted-foreground">
                              {quote.vehicle_make} {quote.vehicle_model}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">{quote.payment_type}</div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">£{quote.excess_amount} / £{quote.claim_limit}</div>
                            <div className="text-xs text-muted-foreground">
                              £{quote.labour_rate || 70}/hr
                              {quote.boost_addon && <Badge variant="outline" className="ml-1 text-[10px]">Boost</Badge>}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm font-medium">£{quote.total_price}</div>
                            <div className="text-xs text-muted-foreground">
                              £{quote.monthly_price}/mo
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-1">
                              {quote.resent_count > 0 && (
                                <Badge variant="outline" className="text-xs">
                                  Resent {quote.resent_count}x
                                </Badge>
                              )}
                              {quote.customer_purchased && (
                                <Badge variant="default" className="text-xs">Purchased</Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setSelectedHistoryQuote(quote);
                                  setShowHistoryDialog(true);
                                }}
                                title="View details"
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleEditQuote(quote)}
                                title="Edit & resend"
                                className="text-blue-600 hover:bg-blue-50"
                              >
                                <Pencil className="w-4 h-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleResendQuote(quote)}
                                disabled={isSendingEmail}
                                title="Quick resend"
                              >
                                <RefreshCw className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          )}

          {/* Saved Drafts Section */}
          {historySubTab === 'saved' && (
            <Card>
              <CardHeader>
                <CardTitle>Saved Quote Drafts</CardTitle>
                <CardDescription>Resume working on previously saved quotes</CardDescription>
              </CardHeader>
              <CardContent>
                {savedQuotes.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No saved drafts yet. Use "Save Quote" in Step 2 to save a draft.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Saved</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Vehicle</TableHead>
                        <TableHead>Duration</TableHead>
                        <TableHead>Coverage</TableHead>
                        <TableHead>Price</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {savedQuotes.map((quote, index) => (
                        <TableRow key={index}>
                          <TableCell>
                            <div className="text-sm">
                              {quote.savedAt ? new Date(quote.savedAt).toLocaleDateString() : 'N/A'}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {quote.savedAt ? new Date(quote.savedAt).toLocaleTimeString() : ''}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm font-medium">{quote.customerName || 'Not set'}</div>
                            <div className="text-xs text-muted-foreground">{quote.customerEmail || ''}</div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm font-medium">{quote.vehicleData?.regNumber || 'N/A'}</div>
                            <div className="text-xs text-muted-foreground">
                              {quote.vehicleData?.make} {quote.vehicleData?.model}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">{quote.paymentType || '24months'}</div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">£{quote.excessAmount || 100} / £{quote.claimLimit || 1250}</div>
                            <div className="text-xs text-muted-foreground">
                              £{quote.labourRate || 70}/hr
                              {quote.boostAddon && <Badge variant="outline" className="ml-1 text-[10px]">Boost</Badge>}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm font-medium">£{quote.currentPrice?.totalPrice || 'N/A'}</div>
                            <div className="text-xs text-muted-foreground">
                              £{quote.currentPrice?.monthlyPrice || 'N/A'}/mo
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="default"
                                onClick={() => loadSavedQuote(quote)}
                                className="gap-1"
                              >
                                <ArrowRight className="w-4 h-4" />
                                Load
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => deleteSavedQuote(index)}
                                className="text-red-600 hover:bg-red-50 hover:text-red-700"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Paid Orders Tab */}
        <TabsContent value="paid" className="space-y-6 mt-6">
          <PaidOrdersTab onRefresh={loadPaidOrdersCount} />
        </TabsContent>

        {/* Customer Logins Tab */}
        <TabsContent value="logins" className="space-y-6 mt-6">
          <CustomerLoginsTab />
        </TabsContent>

        {/* Update Policy Tab */}
        <TabsContent value="update" className="space-y-6 mt-6">
          <CustomerPolicyUpdateTab />
        </TabsContent>
      </Tabs>
    </div>
    </>
  );
};
