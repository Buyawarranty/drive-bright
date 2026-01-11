import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { ArrowRight, Mail, MessageCircle, Loader2, History, RefreshCw, Eye, Zap, CreditCard, Calendar, Link as LinkIcon, UserCheck, CheckCircle2, Send, AlertCircle } from 'lucide-react';
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
import { calculateAddOnPrice, getAutoIncludedAddOns } from '@/lib/addOnsUtils';

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
  { value: 750, label: '£750', description: 'Minor repairs' },
  { value: 1250, label: '£1,250', description: 'Most popular' },
  { value: 2000, label: '£2,000', description: 'Comprehensive' },
  { value: 3000, label: '£3,000', description: 'Maximum protection' }
];

const labourRateOptions = [
  { rate: 50, label: '£50/hr', description: 'Local Garages', isBestValue: true },
  { rate: 70, label: '£70/hr', description: 'Independent Garages', isPopular: true },
  { rate: 100, label: '£100/hr', description: 'Approved Garages' },
  { rate: 200, label: '£200/hr', description: 'Expert Garages' }
];

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
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [paymentType, setPaymentType] = useState<PaymentPeriod>('24months');
  const [excessAmount, setExcessAmount] = useState(100);
  const [claimLimit, setClaimLimit] = useState(1250);
  const [labourRate, setLabourRate] = useState(70);
  const [boostAddon, setBoostAddon] = useState(false);
  const [additionalNotes, setAdditionalNotes] = useState('');
  const [customMonthlyPrice, setCustomMonthlyPrice] = useState('');
  const [customFullPrice, setCustomFullPrice] = useState('');
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [emailContent, setEmailContent] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [sentQuotes, setSentQuotes] = useState<any[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [showHistoryDialog, setShowHistoryDialog] = useState(false);
  const [selectedHistoryQuote, setSelectedHistoryQuote] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('new');
  const [adminEmail, setAdminEmail] = useState<string | null>(null);
  
  // Confirm External Payment state
  const [isConfirmingPaid, setIsConfirmingPaid] = useState(false);
  const [showConfirmPaymentDialog, setShowConfirmPaymentDialog] = useState(false);
  const [paymentSource, setPaymentSource] = useState('');
  const [paymentReference, setPaymentReference] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);
  const [paymentNotes, setPaymentNotes] = useState('');
  const [sendToW2k, setSendToW2k] = useState(true);
  const [sendWelcomeEmail, setSendWelcomeEmail] = useState(true);
  const [existingPolicyWarning, setExistingPolicyWarning] = useState<string | null>(null);

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

  // Get admin email on mount
  useEffect(() => {
    const getAdminEmail = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: adminUser } = await supabase
          .from('admin_users')
          .select('email')
          .eq('user_id', user.id)
          .single();
        setAdminEmail(adminUser?.email || user.email || null);
      }
    };
    getAdminEmail();
    loadSentQuotesHistory();
  }, []);

  // Track if custom prices have been manually overridden
  const [isPriceOverridden, setIsPriceOverridden] = useState(false);

  // Calculate base price (before any custom overrides)
  const calculateBasePrice = () => {
    // Get duration months for add-on calculation
    const durationMonths = DURATION_MONTHS[paymentType] || 12;
    
    // Auto-included add-ons based on duration (2yr gets breakdown, 3yr gets breakdown+rental)
    const autoIncluded = getAutoIncludedAddOns(paymentType);
    const autoAddOns: { [key: string]: boolean } = {};
    autoIncluded.forEach(addon => { autoAddOns[addon] = true; });
    
    // Calculate add-on price (auto-included ones are free, so this will be 0 for auto-included)
    const addOnPrice = calculateAddOnPrice(autoAddOns, paymentType, durationMonths);
    
    const result = calculateTotalWarrantyPrice({
      paymentPeriod: paymentType,
      voluntaryExcess: excessAmount,
      claimLimit: claimLimit,
      labourRate: labourRate,
      boostEnabled: boostAddon,
      addOnPrice: addOnPrice
    });
    
    // Calculate pay-in-full with 10% discount
    const payInFullPrice = Math.floor(result.totalPrice * 0.90);
    
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
        return { 
          totalPrice: fullPrice, 
          monthlyPrice: Math.floor(fullPrice / 12),
          payInFullPrice: Math.floor(fullPrice * 0.90),
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
          payInFullPrice: Math.floor(total * 0.90),
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
  }, [paymentType, excessAmount, claimLimit, labourRate, boostAddon]);

  // Auto-populate custom price fields when selections change (if not manually overridden)
  useEffect(() => {
    if (!isPriceOverridden) {
      setCustomMonthlyPrice(basePrice.monthlyPrice.toString());
      setCustomFullPrice(basePrice.totalPrice.toString());
    }
  }, [paymentType, excessAmount, claimLimit, labourRate, boostAddon, isPriceOverridden]);

  // Handle custom price field changes
  const handleCustomMonthlyChange = (value: string) => {
    setCustomMonthlyPrice(value);
    if (value && parseFloat(value) > 0) {
      setIsPriceOverridden(true);
      // Sync full price when monthly is changed
      const fullPrice = parseFloat(value) * 12;
      setCustomFullPrice(fullPrice.toString());
    } else if (!value) {
      setIsPriceOverridden(false);
    }
  };

  const handleCustomFullChange = (value: string) => {
    setCustomFullPrice(value);
    if (value && parseFloat(value) > 0) {
      setIsPriceOverridden(true);
      // Sync monthly price when full is changed
      const monthly = Math.floor(parseFloat(value) / 12);
      setCustomMonthlyPrice(monthly.toString());
    } else if (!value) {
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
      const { data, error } = await supabase.functions.invoke('dvla-vehicle-lookup', {
        body: { registrationNumber: regNumber }
      });

      if (error || data?.error || !data?.make || !data?.model) {
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
          if (vehicleAge > 15) {
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
    } catch (error) {
      console.error('Error looking up vehicle:', error);
      toast({
        title: "Lookup Failed",
        description: "Unable to connect to vehicle database. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLookingUp(false);
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
    if (!customerEmail || !customerName) {
      toast({
        title: "Missing Information",
        description: "Please fill in customer name and email",
        variant: "destructive",
      });
      return;
    }
    setStep(3);
  };

  const generateEmailSubject = (): string => {
    return `Your Warranty Quote for ${vehicleData?.make} ${vehicleData?.model} - ${vehicleData?.regNumber}`;
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
      const displayClaimLimit = boostAddon ? claimLimit + 1000 : claimLimit;
      const termOption = termOptions.find(t => t.id === paymentType);
      const coverMonths = termOption?.months || 12;
      const bonusMonths = termOption?.bonus || 3;

      // Build recipients - customer + admin copy
      const recipients = [customerEmail];
      if (adminEmail && adminEmail !== customerEmail) {
        recipients.push(adminEmail);
      }

      console.log('📧 Sending email to:', recipients);
      console.log('📎 Quote link:', quoteLink);
      
      // Send the email with HTML template (to both customer and admin)
      const { error: emailError } = await supabase.functions.invoke('send-admin-quote', {
        body: {
          to: customerEmail,
          cc: adminEmail !== customerEmail ? adminEmail : undefined,
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

      // Add to abandoned_carts
      console.log('📋 Adding to abandoned_carts...');
      await supabase
        .from('abandoned_carts')
        .insert({
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
          contact_status: 'contacted',
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
        });

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
      setPaymentType('24months');
      setExcessAmount(100);
      setClaimLimit(1250);
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

  const generateWhatsAppMessage = () => {
    const termOption = termOptions.find(t => t.id === paymentType);
    const months = termOption?.months || 12;
    const bonus = termOption?.bonus || 3;
    const displayClaimLimit = boostAddon ? claimLimit + 1000 : claimLimit;
    
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
    
    const displayClaimLimit = boostAddon ? claimLimit + 1000 : claimLimit;
    const payInFullPrice = currentPrice.payInFullPrice || Math.floor(currentPrice.totalPrice * 0.90);
    
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
          claimLimit: displayClaimLimit,
          labourRate,
          boostAddon,
          monthlyPrice: currentPrice.monthlyPrice,
          upfrontPrice: payInFullPrice,
          breakdownIncluded: getAutoIncludedAddOns(paymentType).includes('breakdown'),
          rentalIncluded: getAutoIncludedAddOns(paymentType).includes('rental'),
          additionalNotes,
          createdByName: 'Admin'
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

  // Generate warranty reference for confirmed orders
  const generateWarrantyReference = (): string => {
    const date = new Date();
    const year = String(date.getFullYear()).slice(-2);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const dateCode = `${year}${month}`;
    const randomSerial = Math.floor(Math.random() * 100000) + 500000;
    return `ADM-${dateCode}-${randomSerial}`;
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
    setShowConfirmPaymentDialog(true);
  };

  // Validate payment confirmation form
  const isPaymentFormValid = () => {
    return (
      paymentSource.trim() !== '' &&
      paymentReference.trim() !== '' &&
      paymentAmount.trim() !== '' &&
      paymentDate.trim() !== '' &&
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

    // Price validation
    const confirmedAmount = parseFloat(paymentAmount);
    if (Math.abs(confirmedAmount - currentPrice.totalPrice) > 1 && !paymentNotes) {
      toast({
        title: "Price Mismatch",
        description: "Payment amount differs from quoted price. Please add a note explaining the difference.",
        variant: "destructive",
      });
      return;
    }

    setIsConfirmingPaid(true);
    const warrantyReference = generateWarrantyReference();
    const displayClaimLimit = boostAddon ? claimLimit + 1000 : claimLimit;
    const termOption = termOptions.find(t => t.id === paymentType);
    const durationMonths = termOption?.months || 12;
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const adminUserId = user?.id;

      // === ATOMIC TRANSACTION START ===
      
      // 1. Check for existing customer by email (case insensitive)
      const { data: existingCustomer } = await supabase
        .from('customers')
        .select('id, name, email, registration_plate')
        .ilike('email', customerEmail)
        .maybeSingle();

      let customerId: string;
      
      // 2. Customer record data with payment confirmation details
      const customerData = {
        name: customerName,
        email: customerEmail.toLowerCase(),
        phone: customerPhone || null,
        registration_plate: vehicleData.regNumber?.toUpperCase() || null,
        vehicle_make: vehicleData.make || null,
        vehicle_model: vehicleData.model || null,
        vehicle_year: vehicleData.year || null,
        vehicle_fuel_type: vehicleData.fuelType || null,
        vehicle_transmission: vehicleData.transmission || null,
        mileage: vehicleData.mileage || null,
        plan_type: 'Platinum',
        payment_type: paymentType,
        status: 'Active',
        warranty_reference_number: warrantyReference,
        voluntary_excess: excessAmount,
        claim_limit: displayClaimLimit,
        labour_rate: labourRate,
        final_amount: confirmedAmount,
        is_manual_entry: true,
        payment_verified: true,
        breakdown_recovery: getAutoIncludedAddOns(paymentType).includes('breakdown'),
        vehicle_rental: getAutoIncludedAddOns(paymentType).includes('rental'),
      };

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
          .insert(customerData)
          .select('id')
          .single();
        
        if (insertError) throw insertError;
        customerId = newCustomer.id;
      }

      // 4. Calculate policy dates
      const startDate = new Date(paymentDate);
      const endDate = new Date(paymentDate);
      endDate.setMonth(endDate.getMonth() + durationMonths);

      // 5. Create policy record with payment confirmation metadata
      const { data: newPolicy, error: policyError } = await supabase
        .from('customer_policies')
        .insert({
          customer_id: customerId,
          email: customerEmail.toLowerCase(),
          customer_full_name: customerName,
          plan_type: 'platinum',
          payment_type: paymentType,
          policy_number: warrantyReference,
          policy_start_date: startDate.toISOString(),
          policy_end_date: endDate.toISOString(),
          status: 'active',
          voluntary_excess: excessAmount,
          claim_limit: displayClaimLimit,
          payment_amount: confirmedAmount,
          breakdown_recovery: getAutoIncludedAddOns(paymentType).includes('breakdown'),
          vehicle_rental: getAutoIncludedAddOns(paymentType).includes('rental'),
          is_manual_entry: true,
          payment_verified: true,
        })
        .select('id')
        .single();

      if (policyError) throw policyError;

      // 6. Add admin note with payment confirmation details
      await supabase
        .from('admin_notes')
        .insert({
          customer_id: customerId,
          note: `External Payment Confirmed:\n• Source: ${paymentSource}\n• Reference: ${paymentReference}\n• Amount: £${confirmedAmount}\n• Date: ${paymentDate}\n• Confirmed by: ${adminEmail || 'Admin'}${paymentNotes ? `\n• Notes: ${paymentNotes}` : ''}`,
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
              payment_source: paymentSource,
              payment_reference: paymentReference
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

      // 10. Send to Warranties 2000 if checked
      if (sendToW2k) {
        try {
          await supabase.functions.invoke('send-to-warranties-2000', {
            body: { 
              email: customerEmail.toLowerCase(), 
              notes: `External payment confirmed via ${paymentSource}. Ref: ${paymentReference}. ${additionalNotes || ''}`.trim()
            }
          });
        } catch (w2kError) {
          console.error('W2K error:', w2kError);
        }
      }

      // 11. Send welcome email with warranty number and dashboard login
      if (sendWelcomeEmail) {
        try {
          await supabase.functions.invoke('send-welcome-email-manual', {
            body: { 
              customerEmail: customerEmail.toLowerCase(),
              customerName,
              warrantyReference,
              planType: 'Platinum',
              vehicleReg: vehicleData.regNumber,
              policyStartDate: startDate.toISOString(),
              policyEndDate: endDate.toISOString(),
              createDashboardLogin: true
            }
          });
        } catch (emailError) {
          console.error('Welcome email error:', emailError);
        }
      }

      // Success!
      toast({
        title: "✅ Policy Activated!",
        description: `Warranty ${warrantyReference} created. Customer will receive login details.`,
        duration: 6000,
      });

      // Close dialog and reset form
      setShowConfirmPaymentDialog(false);
      resetForm();

    } catch (error: any) {
      console.error('Error confirming external payment:', error);
      toast({
        title: "❌ Payment Confirmation Failed",
        description: error.message || "Failed to create policy. No changes were made.",
        variant: "destructive",
      });
    } finally {
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
    setPaymentType('24months');
    setExcessAmount(100);
    setClaimLimit(1250);
    setLabourRate(70);
    setBoostAddon(false);
    setAdditionalNotes('');
    setQuoteLink(null);
    setQuoteGenerated(false);
    setSelectedLeadId(null);
    // Reset payment confirmation fields
    setPaymentSource('');
    setPaymentReference('');
    setPaymentAmount('');
    setPaymentDate(new Date().toISOString().split('T')[0]);
    setPaymentConfirmed(false);
    setPaymentNotes('');
    setExistingPolicyWarning(null);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Quotes & Orders</h1>
        <p className="text-gray-600 mt-2">Create quotes to send customers or confirm orders paid elsewhere</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="new">New Quote/Order</TabsTrigger>
          <TabsTrigger value="history">
            <History className="w-4 h-4 mr-2" />
            History ({sentQuotes.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="new" className="space-y-6 mt-6">
          {/* Step 1: Vehicle Details */}
          {step === 1 && (
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <CardTitle>Step 1: Vehicle Details</CardTitle>
                    <CardDescription>Enter the customer's vehicle registration and mileage</CardDescription>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <LeadSearchPopover onSelectLead={handleLeadSelect} />
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
                  <Input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={mileage}
                    onChange={handleMileageChange}
                    placeholder="e.g. 45000"
                    className="text-lg py-4"
                  />
                  <MileageSlider
                    value={sliderMileage}
                    onChange={handleSliderChange}
                    min={0}
                    max={150000}
                  />
                </div>

                <Button 
                  onClick={handleVehicleLookup}
                  disabled={isLookingUp}
                  className="w-full"
                  size="lg"
                >
                  {isLookingUp ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Looking up vehicle...
                    </>
                  ) : (
                    <>
                      Continue
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Step 2: Quote Details */}
          {step === 2 && vehicleData && (
            <Card>
              <CardHeader>
                <CardTitle>Step 2: Quote Details</CardTitle>
                <CardDescription>
                  Vehicle: {vehicleData.make} {vehicleData.model} ({vehicleData.year}) - {vehicleData.regNumber}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Customer Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Customer Name</Label>
                    <Input
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="e.g. John Smith"
                      className="bg-amber-50 border-amber-200 focus:border-amber-400"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Customer Email</Label>
                    <Input
                      type="email"
                      value={customerEmail}
                      onChange={(e) => setCustomerEmail(e.target.value)}
                      placeholder="customer@example.com"
                      className="bg-amber-50 border-amber-200 focus:border-amber-400"
                    />
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
                        <div className="text-xs text-muted-foreground">+{term.bonus} months free</div>
                      </button>
                    ))}
                  </div>
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
                  <Label className="text-base font-semibold">Claim Limit</Label>
                  <div className="grid grid-cols-4 gap-2">
                    {claimLimitOptions.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => setClaimLimit(option.value)}
                        className={cn(
                          "py-3 px-2 rounded-lg border-2 text-center transition-all",
                          claimLimit === option.value
                            ? "border-primary bg-primary/10"
                            : "border-border hover:border-primary/50"
                        )}
                      >
                        <div className="font-semibold">{option.label}</div>
                        <div className="text-xs text-muted-foreground">{option.description}</div>
                      </button>
                    ))}
                  </div>
                </div>

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

                {/* Boost Addon */}
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

                {/* Additional Notes */}
                <div className="space-y-2">
                  <Label className="text-base font-semibold">Additional Notes (for Warranties 2000)</Label>
                  <Textarea
                    value={additionalNotes}
                    onChange={(e) => setAdditionalNotes(e.target.value)}
                    placeholder="Any special notes for this warranty (e.g., specific conditions, customer requests)..."
                    rows={3}
                  />
                  <p className="text-xs text-muted-foreground">These notes will be sent to Warranties 2000 when the customer completes their purchase</p>
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
                        type="number"
                        step="1"
                        min="0"
                        value={customMonthlyPrice}
                        onChange={(e) => handleCustomMonthlyChange(e.target.value)}
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
                        type="number"
                        step="1"
                        min="0"
                        value={customFullPrice}
                        onChange={(e) => handleCustomFullChange(e.target.value)}
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
                </div>

                {/* Sticky Price Summary Bar */}
                <div className="sticky bottom-0 -mx-6 -mb-6 p-4 bg-gray-100 text-foreground rounded-b-lg shadow-lg border-t">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-baseline gap-3">
                        <div>
                          <div className="text-sm text-muted-foreground">Monthly (12 payments via Bumper)</div>
                          <div className="text-2xl font-bold text-foreground">£{currentPrice.monthlyPrice}/month</div>
                        </div>
                        <div className="text-muted-foreground">|</div>
                        <div>
                          <div className="text-sm text-muted-foreground">Pay in Full (10% off via Stripe)</div>
                          <div className="text-2xl font-bold text-foreground">£{currentPrice.payInFullPrice || Math.floor(currentPrice.totalPrice * 0.9)}</div>
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Total: £{currentPrice.totalPrice} | Claim Limit: £{(boostAddon ? claimLimit + 1000 : claimLimit).toLocaleString()} | Labour: £{labourRate}/hr
                      </div>
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
                <CardTitle>Step 3: Complete Order</CardTitle>
                <CardDescription>
                  Choose to send a quote or confirm payment received elsewhere
                </CardDescription>
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
                    <p><strong>Duration:</strong> {termOptions.find(t => t.id === paymentType)?.label}</p>
                    <p><strong>Excess:</strong> £{excessAmount}</p>
                    <p><strong>Claim Limit:</strong> £{(boostAddon ? claimLimit + 1000 : claimLimit).toLocaleString()}{boostAddon ? ' (boost)' : ''}</p>
                    <p><strong>Labour Rate:</strong> £{labourRate}/hr</p>
                    <p><strong>Total Price:</strong> £{currentPrice.totalPrice}</p>
                    {additionalNotes && <p className="col-span-2"><strong>Notes:</strong> {additionalNotes}</p>}
                  </div>
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
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                        </div>
                        <Button 
                          onClick={handlePreviewEmail}
                          className="w-full bg-blue-600 hover:bg-blue-700"
                        >
                          <Mail className="w-4 h-4 mr-2" />
                          Email Quote
                        </Button>
                        <Button 
                          onClick={() => window.open('https://wa.me/447467703287', '_blank')}
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
                  Review and edit the email before sending to {customerEmail}
                  {adminEmail && ` (copy to ${adminEmail})`}
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4">
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

          {/* External Payment Confirmation Dialog */}
          <Dialog open={showConfirmPaymentDialog} onOpenChange={setShowConfirmPaymentDialog}>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                  Confirm External Payment
                </DialogTitle>
                <DialogDescription>
                  This will create an active policy and send login details to the customer.
                </DialogDescription>
              </DialogHeader>

              {existingPolicyWarning && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{existingPolicyWarning}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-4">
                {/* Payment Source */}
                <div className="space-y-2">
                  <Label htmlFor="payment-source">Payment Source *</Label>
                  <select
                    id="payment-source"
                    value={paymentSource}
                    onChange={(e) => setPaymentSource(e.target.value)}
                    className="w-full px-3 py-2 border rounded-md bg-background"
                  >
                    <option value="">Select payment source...</option>
                    <option value="stripe_dashboard">Stripe Dashboard</option>
                    <option value="bumper_portal">Bumper Portal</option>
                    <option value="bank_transfer">Bank Transfer</option>
                    <option value="phone_card">Phone Card Payment</option>
                    <option value="dealer_portal">Dealer Portal</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                {/* Payment Reference */}
                <div className="space-y-2">
                  <Label htmlFor="payment-reference">Payment Reference / Transaction ID *</Label>
                  <Input
                    id="payment-reference"
                    value={paymentReference}
                    onChange={(e) => setPaymentReference(e.target.value)}
                    placeholder="e.g. pi_xxxx, BAC123456, etc."
                  />
                </div>

                {/* Amount */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="payment-amount">Amount Received (£) *</Label>
                    <Input
                      id="payment-amount"
                      type="number"
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value)}
                      placeholder={currentPrice.totalPrice.toString()}
                    />
                    {paymentAmount && Math.abs(parseFloat(paymentAmount) - currentPrice.totalPrice) > 1 && (
                      <p className="text-xs text-amber-600">
                        ⚠️ Differs from quoted price (£{currentPrice.totalPrice})
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="payment-date">Payment Date *</Label>
                    <Input
                      id="payment-date"
                      type="date"
                      value={paymentDate}
                      onChange={(e) => setPaymentDate(e.target.value)}
                    />
                  </div>
                </div>

                {/* Notes */}
                <div className="space-y-2">
                  <Label htmlFor="payment-notes">Internal Notes (optional)</Label>
                  <Textarea
                    id="payment-notes"
                    value={paymentNotes}
                    onChange={(e) => setPaymentNotes(e.target.value)}
                    placeholder="Any additional notes about this payment..."
                    rows={2}
                  />
                </div>

                {/* Confirmation Checkbox */}
                <div className="p-3 border rounded-md bg-green-50 border-green-200">
                  <div className="flex items-start space-x-3">
                    <Checkbox 
                      id="confirm-payment"
                      checked={paymentConfirmed}
                      onCheckedChange={(checked) => setPaymentConfirmed(checked === true)}
                      className="mt-1"
                    />
                    <Label htmlFor="confirm-payment" className="text-sm text-green-800 cursor-pointer leading-relaxed">
                      <strong>I confirm</strong> that payment has been received externally and verified. This will activate the warranty immediately.
                    </Label>
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
                      Send to Warranties 2000
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

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setShowConfirmPaymentDialog(false)}
                  disabled={isConfirmingPaid}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleConfirmExternalPayment}
                  disabled={isConfirmingPaid || !isPaymentFormValid()}
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
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedHistoryQuote(quote);
                                setShowHistoryDialog(true);
                              }}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleResendQuote(quote)}
                              disabled={isSendingEmail}
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
        </TabsContent>
      </Tabs>
    </div>
  );
};
