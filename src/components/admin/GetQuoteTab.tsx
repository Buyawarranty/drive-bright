import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { ArrowRight, Mail, MessageCircle, Loader2, History, RefreshCw, Eye, Zap, CreditCard, Calendar } from 'lucide-react';
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

export const GetQuoteTab = () => {
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [regNumber, setRegNumber] = useState('');
  const [mileage, setMileage] = useState('');
  const [sliderMileage, setSliderMileage] = useState(0);
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [vehicleData, setVehicleData] = useState<VehicleData | null>(null);
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerName, setCustomerName] = useState('');
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

  // Calculate price using pricingMatrix.ts with add-ons
  const calculatePrice = () => {
    if (customFullPrice && parseFloat(customFullPrice) > 0) {
      return { totalPrice: parseFloat(customFullPrice), monthlyPrice: Math.floor(parseFloat(customFullPrice) / 12) };
    }
    if (customMonthlyPrice && parseFloat(customMonthlyPrice) > 0) {
      const total = parseFloat(customMonthlyPrice) * 12;
      return { totalPrice: total, monthlyPrice: parseFloat(customMonthlyPrice) };
    }
    
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

  const currentPrice = calculatePrice();

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

  const generateEmailContent = (): { subject: string; content: string } => {
    const firstName = customerName.split(' ')[0];
    const termOption = termOptions.find(t => t.id === paymentType);
    const months = termOption?.months || 12;
    const bonus = termOption?.bonus || 3;
    const totalMonths = months + bonus;
    const displayClaimLimit = boostAddon ? claimLimit + 1000 : claimLimit;

    const subject = `Your Warranty Quote for ${vehicleData?.make} ${vehicleData?.model} - ${vehicleData?.regNumber}`;

    const content = `Hi ${firstName},

Thank you for considering BuyAWarranty.co.uk for your vehicle protection. Please find your quote details below:

Quote Summary:

Vehicle: ${vehicleData?.make || ''} ${vehicleData?.model || ''}
Registration: ${vehicleData?.regNumber}
Mileage: ${parseInt(vehicleData?.mileage || '0').toLocaleString()} miles
Plan: Platinum
Payment: Monthly (interest-free)
Price: £${currentPrice.monthlyPrice}/month
Total: £${currentPrice.totalPrice}
Excess: £${excessAmount}
Claim Limit: £${displayClaimLimit.toLocaleString()}${boostAddon ? ' (includes +£1,000 boost)' : ''}
Labour Rate: £${labourRate}/hr
Cover Period: ${months} months + ${bonus} extra months free (total ${totalMonths} months)
Coverage: All mechanical and electrical parts, including labour.
Unlimited Claims up to the value of your vehicle

Breakdowns Happen. Don't Risk It!

For full details on what's covered, please visit:
https://buyawarranty.co.uk/what-is-covered/

If you have any questions or would like to proceed, please call us on 0330 229 5040 or click the link sent separately from our payment partner, Bumper.

Your peace of mind is our priority.

If It Breaks, We'll Fix It!

Thank you for choosing BuyAWarranty.co.uk.

The BuyAWarranty.co.uk Team
Customer Service & Sales: 0330 229 5040
Claims Line: 0330 229 5045
www.buyawarranty.co.uk | info@buyawarranty.co.uk`;

    return { subject, content };
  };

  const handlePreviewEmail = () => {
    const { subject, content } = generateEmailContent();
    setEmailSubject(subject);
    setEmailContent(content);
    setShowEmailDialog(true);
  };

  const handleSendEmail = async () => {
    setIsSendingEmail(true);
    try {
      console.log('🚀 Starting quote send process...');
      const { data: { user } } = await supabase.auth.getUser();
      
      // Generate unique quote ID for restoration
      const quoteId = `ADMIN-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const displayClaimLimit = boostAddon ? claimLimit + 1000 : claimLimit;

      // Build recipients - customer + admin copy
      const recipients = [customerEmail];
      if (adminEmail && adminEmail !== customerEmail) {
        recipients.push(adminEmail);
      }

      console.log('📧 Sending email to:', recipients);
      
      // Send the email (to both customer and admin)
      const { error: emailError } = await supabase.functions.invoke('send-admin-quote', {
        body: {
          to: customerEmail,
          cc: adminEmail !== customerEmail ? adminEmail : undefined,
          subject: emailSubject,
          content: emailContent,
          vehicleData,
          quoteDetails: {
            plan: 'Platinum',
            paymentType,
            price: currentPrice.totalPrice,
            excessAmount,
            claimLimit: displayClaimLimit,
            labourRate,
            boostAddon
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
    const { content } = generateEmailContent();
    const encodedMessage = encodeURIComponent(content);
    const whatsappUrl = `https://api.whatsapp.com/send?phone=&text=${encodedMessage}`;
    window.open(whatsappUrl, '_blank');
  };

  // Generate Bumper payment link (monthly instalments)
  const [isGeneratingBumperLink, setIsGeneratingBumperLink] = useState(false);
  const [isGeneratingStripeLink, setIsGeneratingStripeLink] = useState(false);

  const handleGenerateBumperLink = async () => {
    if (!customerEmail || !customerName || !vehicleData) {
      toast({
        title: "Missing Information",
        description: "Please complete all customer and vehicle details first",
        variant: "destructive",
      });
      return;
    }

    setIsGeneratingBumperLink(true);
    try {
      const displayClaimLimit = boostAddon ? claimLimit + 1000 : claimLimit;
      
      const { data, error } = await supabase.functions.invoke('create-bumper-checkout', {
        body: {
          planId: 'platinum',
          vehicleData: {
            regNumber: vehicleData.regNumber,
            make: vehicleData.make,
            model: vehicleData.model,
            year: vehicleData.year,
            fuelType: vehicleData.fuelType,
            transmission: vehicleData.transmission,
            mileage: vehicleData.mileage
          },
          paymentType,
          voluntaryExcess: excessAmount,
          claimLimit: displayClaimLimit,
          labourRate,
          customerData: {
            firstName: customerName.split(' ')[0],
            lastName: customerName.split(' ').slice(1).join(' ') || '',
            email: customerEmail,
            phone: '',
            final_amount: currentPrice.totalPrice
          },
          protectionAddOns: {
            breakdown: getAutoIncludedAddOns(paymentType).includes('breakdown'),
            rental: getAutoIncludedAddOns(paymentType).includes('rental'),
          },
          additionalNotes
        }
      });

      if (error) throw error;

      if (data?.checkout_url || data?.url) {
        const paymentUrl = data.checkout_url || data.url;
        // Copy to clipboard
        await navigator.clipboard.writeText(paymentUrl);
        toast({
          title: "✅ Bumper Payment Link Generated!",
          description: "Link copied to clipboard. Send this to customer for monthly payments.",
          duration: 5000,
        });
        // Open in new tab
        window.open(paymentUrl, '_blank');
      } else {
        throw new Error('No payment URL returned');
      }
    } catch (error: any) {
      console.error('Error generating Bumper link:', error);
      toast({
        title: "❌ Failed to Generate Bumper Link",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingBumperLink(false);
    }
  };

  // Generate Stripe payment link (pay in full with 10% discount)
  const handleGenerateStripeLink = async () => {
    if (!customerEmail || !customerName || !vehicleData) {
      toast({
        title: "Missing Information",
        description: "Please complete all customer and vehicle details first",
        variant: "destructive",
      });
      return;
    }

    setIsGeneratingStripeLink(true);
    try {
      const displayClaimLimit = boostAddon ? claimLimit + 1000 : claimLimit;
      const payInFullPrice = currentPrice.payInFullPrice || Math.floor(currentPrice.totalPrice * 0.90);
      
      const { data, error } = await supabase.functions.invoke('create-stripe-checkout', {
        body: {
          planId: 'platinum',
          vehicleData: {
            regNumber: vehicleData.regNumber,
            make: vehicleData.make,
            model: vehicleData.model,
            year: vehicleData.year,
            fuelType: vehicleData.fuelType,
            transmission: vehicleData.transmission,
            mileage: vehicleData.mileage
          },
          paymentType,
          voluntaryExcess: excessAmount,
          claimLimit: displayClaimLimit,
          labourRate,
          customerData: {
            firstName: customerName.split(' ')[0],
            lastName: customerName.split(' ').slice(1).join(' ') || '',
            email: customerEmail,
            phone: '',
            final_amount: payInFullPrice
          },
          protectionAddOns: {
            breakdown: getAutoIncludedAddOns(paymentType).includes('breakdown'),
            rental: getAutoIncludedAddOns(paymentType).includes('rental'),
          },
          additionalNotes
        }
      });

      if (error) throw error;

      if (data?.url) {
        // Copy to clipboard
        await navigator.clipboard.writeText(data.url);
        toast({
          title: "✅ Stripe Payment Link Generated!",
          description: "Link copied to clipboard. Send this to customer for pay-in-full (10% off).",
          duration: 5000,
        });
        // Open in new tab
        window.open(data.url, '_blank');
      } else {
        throw new Error('No payment URL returned');
      }
    } catch (error: any) {
      console.error('Error generating Stripe link:', error);
      toast({
        title: "❌ Failed to Generate Stripe Link",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingStripeLink(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Send a Quote</h1>
        <p className="text-gray-600 mt-2">Generate and send quotes with tracking history</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="new">New Quote</TabsTrigger>
          <TabsTrigger value="history">
            <History className="w-4 h-4 mr-2" />
            Quote History ({sentQuotes.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="new" className="space-y-6 mt-6">
          {/* Step 1: Vehicle Details */}
          {step === 1 && (
            <Card>
              <CardHeader>
                <CardTitle>Step 1: Vehicle Details</CardTitle>
                <CardDescription>Enter the customer's vehicle registration and mileage</CardDescription>
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
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Customer Email</Label>
                    <Input
                      type="email"
                      value={customerEmail}
                      onChange={(e) => setCustomerEmail(e.target.value)}
                      placeholder="customer@example.com"
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
                  <div className="space-y-2">
                    <Label className="text-base font-semibold">Custom Pricing (Optional)</Label>
                    <p className="text-sm text-muted-foreground">Override calculated price with custom values</p>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="custom-monthly">Custom Monthly (£)</Label>
                      <Input
                        id="custom-monthly"
                        type="number"
                        step="0.01"
                        min="0"
                        value={customMonthlyPrice}
                        onChange={(e) => setCustomMonthlyPrice(e.target.value)}
                        placeholder="e.g. 45.99"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="custom-full">Custom Full Price (£)</Label>
                      <Input
                        id="custom-full"
                        type="number"
                        step="0.01"
                        min="0"
                        value={customFullPrice}
                        onChange={(e) => setCustomFullPrice(e.target.value)}
                        placeholder="e.g. 499.99"
                      />
                    </div>
                  </div>
                </div>

                {/* Sticky Price Summary Bar */}
                <div className="sticky bottom-0 -mx-6 -mb-6 p-4 bg-gradient-to-r from-primary to-primary/90 text-primary-foreground rounded-b-lg shadow-lg">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-baseline gap-3">
                        <div>
                          <div className="text-sm opacity-90">Monthly (12 payments via Bumper)</div>
                          <div className="text-2xl font-bold">£{currentPrice.monthlyPrice}/month</div>
                        </div>
                        <div className="text-primary-foreground/60">|</div>
                        <div>
                          <div className="text-sm opacity-90">Pay in Full (10% off via Stripe)</div>
                          <div className="text-2xl font-bold">£{currentPrice.payInFullPrice || Math.floor(currentPrice.totalPrice * 0.9)}</div>
                        </div>
                      </div>
                      <div className="text-xs opacity-75 mt-1">
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

          {/* Step 3: Send Quote */}
          {step === 3 && (
            <Card>
              <CardHeader>
                <CardTitle>Step 3: Send Quote</CardTitle>
                <CardDescription>
                  Quote: £{currentPrice.monthlyPrice}/month for {customerName}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-muted p-4 rounded-lg">
                  <h3 className="font-semibold mb-2">Quote Summary</h3>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <p><strong>Vehicle:</strong> {vehicleData?.make} {vehicleData?.model} ({vehicleData?.year})</p>
                    <p><strong>Registration:</strong> {vehicleData?.regNumber}</p>
                    <p><strong>Mileage:</strong> {parseInt(vehicleData?.mileage || '0').toLocaleString()} miles</p>
                    <p><strong>Duration:</strong> {termOptions.find(t => t.id === paymentType)?.label}</p>
                    <p><strong>Excess:</strong> £{excessAmount}</p>
                    <p><strong>Claim Limit:</strong> £{(boostAddon ? claimLimit + 1000 : claimLimit).toLocaleString()}{boostAddon ? ' (boost)' : ''}</p>
                    <p><strong>Labour Rate:</strong> £{labourRate}/hr</p>
                    {additionalNotes && <p className="col-span-2"><strong>Notes:</strong> {additionalNotes}</p>}
                  </div>
                </div>

                {/* Payment Options Card */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-lg border-2 border-blue-200 bg-blue-50">
                    <div className="flex items-center gap-2 mb-2">
                      <Calendar className="w-5 h-5 text-blue-600" />
                      <h4 className="font-semibold text-blue-900">Monthly Instalments</h4>
                    </div>
                    <div className="text-2xl font-bold text-blue-800 mb-1">£{currentPrice.monthlyPrice}/month</div>
                    <p className="text-sm text-blue-600 mb-3">12 interest-free payments via Bumper</p>
                    <Button
                      onClick={handleGenerateBumperLink}
                      disabled={isGeneratingBumperLink}
                      className="w-full bg-blue-600 hover:bg-blue-700"
                    >
                      {isGeneratingBumperLink ? (
                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Generating...</>
                      ) : (
                        <>Generate Bumper Link</>
                      )}
                    </Button>
                  </div>
                  
                  <div className="p-4 rounded-lg border-2 border-green-200 bg-green-50">
                    <div className="flex items-center gap-2 mb-2">
                      <CreditCard className="w-5 h-5 text-green-600" />
                      <h4 className="font-semibold text-green-900">Pay in Full</h4>
                      <Badge className="bg-green-600 text-xs">10% OFF</Badge>
                    </div>
                    <div className="text-2xl font-bold text-green-800 mb-1">£{currentPrice.payInFullPrice || Math.floor(currentPrice.totalPrice * 0.9)}</div>
                    <p className="text-sm text-green-600 mb-3">One-time payment via Stripe</p>
                    <Button
                      onClick={handleGenerateStripeLink}
                      disabled={isGeneratingStripeLink}
                      className="w-full bg-green-600 hover:bg-green-700"
                    >
                      {isGeneratingStripeLink ? (
                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Generating...</>
                      ) : (
                        <>Generate Stripe Link</>
                      )}
                    </Button>
                  </div>
                </div>

                {adminEmail && (
                  <div className="text-sm text-muted-foreground">
                    ✉️ A copy will also be sent to: {adminEmail}
                  </div>
                )}

                <div className="flex gap-3">
                  <Button 
                    variant="outline"
                    onClick={() => setStep(2)}
                  >
                    Back
                  </Button>
                  <Button 
                    onClick={handlePreviewEmail}
                    className="flex-1"
                  >
                    <Mail className="w-4 h-4 mr-2" />
                    Email Quote
                  </Button>
                  <Button 
                    onClick={generateWhatsAppMessage}
                    variant="outline"
                  >
                    <MessageCircle className="w-4 h-4 mr-2" />
                    WhatsApp
                  </Button>
                </div>
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
                
                <div>
                  <Label>Email Content</Label>
                  <Textarea
                    value={emailContent}
                    onChange={(e) => setEmailContent(e.target.value)}
                    rows={20}
                    className="mt-2 font-mono text-sm"
                  />
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
              <CardTitle>Sent Quotes History</CardTitle>
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
