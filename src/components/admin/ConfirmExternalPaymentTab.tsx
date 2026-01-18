import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { 
  Loader2, Search, CheckCircle2, UserCheck, AlertCircle, 
  CalendarIcon, CreditCard, Car, Info, Users, Zap, ArrowRight
} from 'lucide-react';
import { format, isToday, addMonths } from 'date-fns';
import { cn } from '@/lib/utils';
import { LeadSearchPopover, LeadData } from './LeadSearchPopover';
import MileageSlider from '@/components/MileageSlider';
import { 
  calculateTotalWarrantyPrice, 
  DURATION_MONTHS,
  type PaymentPeriod 
} from '@/lib/pricingMatrix';
import { getAutoIncludedAddOns } from '@/lib/addOnsUtils';

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
  { value: 2000, label: '£2,000', description: 'Comprehensive' }
];

const labourRateOptions = [
  { rate: 50, label: '£50/hr', description: 'Local Garages', isBestValue: true },
  { rate: 70, label: '£70/hr', description: 'Independent Garages', isPopular: true },
  { rate: 100, label: '£100/hr', description: 'Approved Garages' },
  { rate: 200, label: '£200/hr', description: 'Expert Garages' }
];

// Mileage dropdown options
const mileageDropdownOptions = Array.from({ length: 131 }, (_, i) => 10000 + (i * 1000));

interface ConfirmExternalPaymentTabProps {
  onPaymentConfirmed?: () => void;
}

export const ConfirmExternalPaymentTab: React.FC<ConfirmExternalPaymentTabProps> = ({ onPaymentConfirmed }) => {
  const { toast } = useToast();
  
  // Vehicle lookup state
  const [regNumber, setRegNumber] = useState('');
  const [mileage, setMileage] = useState('');
  const [sliderMileage, setSliderMileage] = useState(0);
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [vehicleData, setVehicleData] = useState<VehicleData | null>(null);
  
  // Customer details
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  
  // Policy configuration
  const [paymentType, setPaymentType] = useState<PaymentPeriod>('24months');
  const [excessAmount, setExcessAmount] = useState(100);
  const [claimLimit, setClaimLimit] = useState(1250);
  const [labourRate, setLabourRate] = useState(70);
  const [boostAddon, setBoostAddon] = useState(false);
  const [freeExtendedCover, setFreeExtendedCover] = useState<'none' | '3months' | '6months'>('none');
  
  // Payment confirmation state
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [paymentSource, setPaymentSource] = useState('');
  const [paymentReference, setPaymentReference] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [warrantyStartDate, setWarrantyStartDate] = useState<Date>(new Date());
  const [isStartDateCalendarOpen, setIsStartDateCalendarOpen] = useState(false);
  const [existingPolicyWarning, setExistingPolicyWarning] = useState<string | null>(null);
  const [externalPaymentStep, setExternalPaymentStep] = useState<'details' | 'preview' | 'complete'>('details');
  
  // Address fields
  const [customerPostcode, setCustomerPostcode] = useState('');
  const [customerStreet, setCustomerStreet] = useState('');
  const [customerTown, setCustomerTown] = useState('');
  const [customerBuildingNumber, setCustomerBuildingNumber] = useState('');
  const [customerCounty, setCustomerCounty] = useState('');
  const [skipAddressDetails, setSkipAddressDetails] = useState(true);
  
  // Editable fields for dialog
  const [editableCustomerName, setEditableCustomerName] = useState('');
  const [editableCustomerEmail, setEditableCustomerEmail] = useState('');
  const [editableCustomerPhone, setEditableCustomerPhone] = useState('');
  const [editableMileage, setEditableMileage] = useState('');
  const [editableRegNumber, setEditableRegNumber] = useState('');
  
  // Options
  const [sendToW2k, setSendToW2k] = useState(true);
  const [sendWelcomeEmail, setSendWelcomeEmail] = useState(true);
  
  // Completion status
  const [completionStatus, setCompletionStatus] = useState<{
    policy?: boolean;
    customer?: boolean;
    w2k?: boolean;
    email?: boolean;
  }>({});

  // Calculate price
  const currentPrice = vehicleData ? calculateTotalWarrantyPrice({
    paymentPeriod: paymentType,
    voluntaryExcess: excessAmount,
    claimLimit: claimLimit,
    labourRate: labourRate,
    boostEnabled: boostAddon,
  }) : { totalPrice: 0, monthlyPrice: 0 };

  const formatRegNumber = (value: string): string => {
    const clean = value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 7);
    if (clean.length <= 4) return clean;
    return clean.slice(0, 4) + ' ' + clean.slice(4);
  };

  const handleMileageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/\D/g, '');
    const formatted = rawValue ? parseInt(rawValue, 10).toLocaleString() : '';
    setMileage(formatted);
    setSliderMileage(rawValue ? parseInt(rawValue, 10) : 0);
  };

  const handleSliderChange = (value: number) => {
    setSliderMileage(value);
    setMileage(value.toLocaleString());
  };

  const handleLeadSelect = (lead: LeadData) => {
    setSelectedLeadId(lead.id);
    if (lead.vehicle_reg) setRegNumber(formatRegNumber(lead.vehicle_reg));
    if (lead.email) setCustomerEmail(lead.email);
    const fullName = [lead.first_name, lead.last_name].filter(Boolean).join(' ');
    if (fullName) setCustomerName(fullName);
    if (lead.phone) setCustomerPhone(lead.phone);
    if (lead.mileage) {
      setMileage(parseInt(lead.mileage.replace(/\D/g, ''), 10).toLocaleString());
      setSliderMileage(parseInt(lead.mileage.replace(/\D/g, ''), 10));
    }
    
    toast({
      title: "Lead Imported",
      description: `Imported data for ${fullName || lead.email}`,
    });
  };

  const handleVehicleLookup = async () => {
    if (!regNumber.trim()) {
      toast({
        title: "Missing Registration",
        description: "Please enter a registration number",
        variant: "destructive",
      });
      return;
    }

    setIsLookingUp(true);
    try {
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Lookup timeout')), 15000);
      });
      
      const lookupPromise = supabase.functions.invoke('dvla-vehicle-lookup', {
        body: { registrationNumber: regNumber.replace(/\s/g, '') }
      });
      
      const { data, error } = await Promise.race([lookupPromise, timeoutPromise]) as any;

      if (error || data?.error || !data?.make || !data?.model) {
        toast({
          title: "Vehicle Not Found",
          description: data?.error || "Unable to find vehicle details. Please check the registration.",
          variant: "destructive",
        });
        return;
      }

      // Check vehicle age
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
            return;
          }
        }
      }

      setVehicleData({
        regNumber: regNumber.toUpperCase(),
        mileage: mileage || '0',
        make: data.make,
        model: data.model,
        fuelType: data.fuelType || '',
        transmission: data.transmission || '',
        year: data.yearOfManufacture || data.year || '',
        vehicleType: data.vehicleType || '',
      });
      
      toast({
        title: "Vehicle Found",
        description: `${data.make} ${data.model} (${data.yearOfManufacture || data.year})`,
      });
    } catch (error) {
      console.error('Error looking up vehicle:', error);
      toast({
        title: "Lookup Failed",
        description: "Unable to connect to vehicle database.",
        variant: "destructive",
      });
    } finally {
      setIsLookingUp(false);
    }
  };

  const handleOpenConfirmDialog = async () => {
    if (!vehicleData) {
      toast({
        title: "Vehicle Required",
        description: "Please look up a vehicle first",
        variant: "destructive",
      });
      return;
    }

    if (!customerName.trim() || !customerEmail.trim()) {
      toast({
        title: "Customer Details Required",
        description: "Please enter customer name and email",
        variant: "destructive",
      });
      return;
    }

    // Check for existing policy
    setExistingPolicyWarning(null);
    const { data: existingPolicy } = await supabase
      .from('customer_policies')
      .select('id, policy_number, status')
      .eq('email', customerEmail.toLowerCase())
      .eq('status', 'active')
      .maybeSingle();

    if (existingPolicy) {
      setExistingPolicyWarning(
        `Warning: This customer already has an active policy (${existingPolicy.policy_number}). Creating a new one may cause issues.`
      );
    }

    // Pre-fill editable fields
    setEditableCustomerName(customerName);
    setEditableCustomerEmail(customerEmail);
    setEditableCustomerPhone(customerPhone);
    setEditableMileage(mileage.replace(/,/g, ''));
    setEditableRegNumber(vehicleData.regNumber);
    setPaymentAmount(currentPrice.totalPrice.toString());
    setExternalPaymentStep('details');
    setShowConfirmDialog(true);
  };

  const handleProceedToPreview = () => {
    if (!paymentSource || !paymentReference || !paymentAmount) {
      toast({
        title: "Missing Payment Info",
        description: "Please fill in payment source, reference and amount",
        variant: "destructive",
      });
      return;
    }
    setExternalPaymentStep('preview');
  };

  const handleConfirmPayment = async () => {
    setIsConfirming(true);
    setCompletionStatus({});
    
    try {
      const termOption = termOptions.find(t => t.id === paymentType);
      const coverMonths = termOption?.months || 12;
      const bonusMonthsMap: Record<string, number> = { 'none': 0, '3months': 3, '6months': 6 };
      const bonusMonths = bonusMonthsMap[freeExtendedCover] || 0;
      const displayClaimLimit = boostAddon ? claimLimit + 1000 : claimLimit;

      const { data, error } = await supabase.functions.invoke('confirm-external-payment', {
        body: {
          customerName: editableCustomerName,
          customerEmail: editableCustomerEmail,
          customerPhone: editableCustomerPhone,
          vehicleReg: editableRegNumber,
          vehicleMake: vehicleData?.make,
          vehicleModel: vehicleData?.model,
          vehicleYear: vehicleData?.year,
          vehicleFuelType: vehicleData?.fuelType,
          vehicleTransmission: vehicleData?.transmission,
          mileage: editableMileage,
          paymentType,
          claimLimit: displayClaimLimit,
          labourRate,
          excessAmount,
          boostAddon,
          finalAmount: parseFloat(paymentAmount),
          paymentSource,
          paymentReference,
          warrantyStartDate: format(warrantyStartDate, 'yyyy-MM-dd'),
          durationMonths: coverMonths,
          bonusMonths,
          sendToW2k,
          sendWelcomeEmail,
          skipAddressDetails,
          address: skipAddressDetails ? null : {
            buildingNumber: customerBuildingNumber,
            street: customerStreet,
            town: customerTown,
            county: customerCounty,
            postcode: customerPostcode,
          },
        }
      });

      if (error) throw error;

      setCompletionStatus({
        policy: data?.policyCreated,
        customer: data?.customerCreated,
        w2k: data?.w2kSent,
        email: data?.emailSent,
      });
      
      setExternalPaymentStep('complete');
      onPaymentConfirmed?.();
      
      toast({
        title: "Payment Confirmed!",
        description: `Policy created for ${editableCustomerName}`,
      });
    } catch (error: any) {
      console.error('Error confirming payment:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to confirm payment",
        variant: "destructive",
      });
    } finally {
      setIsConfirming(false);
    }
  };

  const resetForm = () => {
    setRegNumber('');
    setMileage('');
    setSliderMileage(0);
    setVehicleData(null);
    setCustomerName('');
    setCustomerEmail('');
    setCustomerPhone('');
    setSelectedLeadId(null);
    setPaymentType('24months');
    setExcessAmount(100);
    setClaimLimit(1250);
    setLabourRate(70);
    setBoostAddon(false);
    setFreeExtendedCover('none');
    setPaymentSource('');
    setPaymentReference('');
    setPaymentAmount('');
    setExternalPaymentStep('details');
    setCompletionStatus({});
    setShowConfirmDialog(false);
  };

  return (
    <div className="space-y-6">
      {/* Step 1: Vehicle & Customer Lookup */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-green-600" />
                Confirm External Payment
              </CardTitle>
              <CardDescription>
                Look up vehicle and customer to confirm payment received elsewhere
              </CardDescription>
            </div>
            <LeadSearchPopover onSelectLead={handleLeadSelect} />
          </div>
          {selectedLeadId && (
            <Badge variant="secondary" className="gap-1 w-fit mt-2">
              <UserCheck className="h-3 w-3" />
              Lead imported
            </Badge>
          )}
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Registration Lookup */}
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Registration Number</Label>
              <div className="flex gap-2">
                <Input
                  value={regNumber}
                  onChange={(e) => setRegNumber(formatRegNumber(e.target.value))}
                  placeholder="e.g. AB12 CDE"
                  className="uppercase text-xl font-bold py-5 flex-1"
                  maxLength={8}
                />
                <Button 
                  onClick={handleVehicleLookup}
                  disabled={isLookingUp}
                  className="gap-2"
                >
                  {isLookingUp ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Search className="w-4 h-4" />
                  )}
                  Lookup
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Mileage</Label>
              <div className="flex gap-2">
                <Input
                  type="text"
                  inputMode="numeric"
                  value={mileage}
                  onChange={handleMileageChange}
                  placeholder="e.g. 45000"
                  className="flex-1"
                />
                <Select
                  value={sliderMileage.toString()}
                  onValueChange={(value) => {
                    const numValue = parseInt(value, 10);
                    setSliderMileage(numValue);
                    setMileage(numValue.toLocaleString());
                  }}
                >
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Quick" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    {mileageDropdownOptions.map((miles) => (
                      <SelectItem key={miles} value={miles.toString()}>
                        {miles.toLocaleString()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Vehicle Details Display */}
          {vehicleData && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Car className="h-4 w-4 text-green-600" />
                <span className="font-semibold text-green-800">Vehicle Found</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                <div><span className="text-green-600">Make:</span> {vehicleData.make}</div>
                <div><span className="text-green-600">Model:</span> {vehicleData.model}</div>
                <div><span className="text-green-600">Year:</span> {vehicleData.year}</div>
                <div><span className="text-green-600">Fuel:</span> {vehicleData.fuelType}</div>
              </div>
            </div>
          )}

          {/* Customer Details */}
          <div className="grid md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Customer Name *</Label>
              <Input
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="John Smith"
              />
            </div>
            <div className="space-y-2">
              <Label>Email *</Label>
              <Input
                type="email"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                placeholder="john@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="07xxx xxxxxx"
              />
            </div>
          </div>

          {/* Policy Configuration */}
          {vehicleData && (
            <div className="p-4 bg-muted/50 border rounded-lg space-y-4">
              <h4 className="font-semibold flex items-center gap-2">
                <Zap className="h-4 w-4" />
                Policy Configuration
              </h4>
              
              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Duration */}
                <div className="space-y-2">
                  <Label>Duration</Label>
                  <Select value={paymentType} onValueChange={(v) => setPaymentType(v as PaymentPeriod)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {termOptions.map((opt) => (
                        <SelectItem key={opt.id} value={opt.id}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                {/* Excess */}
                <div className="space-y-2">
                  <Label>Excess</Label>
                  <Select value={excessAmount.toString()} onValueChange={(v) => setExcessAmount(parseInt(v))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {excessOptions.map((opt) => (
                        <SelectItem key={opt} value={opt.toString()}>
                          £{opt}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                {/* Claim Limit */}
                <div className="space-y-2">
                  <Label>Claim Limit</Label>
                  <Select value={claimLimit.toString()} onValueChange={(v) => setClaimLimit(parseInt(v))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {claimLimitOptions.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value.toString()}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                {/* Labour Rate */}
                <div className="space-y-2">
                  <Label>Labour Rate</Label>
                  <Select value={labourRate.toString()} onValueChange={(v) => setLabourRate(parseInt(v))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {labourRateOptions.map((opt) => (
                        <SelectItem key={opt.rate} value={opt.rate.toString()}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex flex-wrap gap-4 pt-2">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="boost"
                    checked={boostAddon}
                    onCheckedChange={(c) => setBoostAddon(c === true)}
                  />
                  <Label htmlFor="boost" className="cursor-pointer">+£1,000 Boost (+£50)</Label>
                </div>
                
                <div className="flex items-center gap-4">
                  <Label>Free Extended Cover:</Label>
                  <Select value={freeExtendedCover} onValueChange={(v: any) => setFreeExtendedCover(v)}>
                    <SelectTrigger className="w-[120px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      <SelectItem value="3months">+3 Months</SelectItem>
                      <SelectItem value="6months">+6 Months</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="pt-2 border-t">
                <p className="text-lg font-semibold">
                  Total: £{currentPrice.totalPrice} 
                  <span className="text-sm text-muted-foreground ml-2">
                    (£{currentPrice.monthlyPrice}/month)
                  </span>
                </p>
              </div>
            </div>
          )}

          {/* Confirm Button */}
          <Button 
            onClick={handleOpenConfirmDialog}
            disabled={!vehicleData || !customerName || !customerEmail}
            className="w-full bg-green-600 hover:bg-green-700 text-white gap-2"
            size="lg"
          >
            <CheckCircle2 className="w-5 h-5" />
            Confirm External Payment
            <ArrowRight className="w-4 h-4" />
          </Button>
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={(open) => {
        setShowConfirmDialog(open);
        if (!open) setExternalPaymentStep('details');
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
              {externalPaymentStep === 'details' 
                ? 'Confirm External Payment' 
                : externalPaymentStep === 'preview' 
                  ? 'Review Before Submission'
                  : 'Order Complete'}
            </DialogTitle>
            <DialogDescription>
              {externalPaymentStep === 'details' 
                ? 'Step 1: Verify details and enter payment information' 
                : externalPaymentStep === 'preview'
                  ? 'Step 2: Review all data before creating the policy'
                  : 'Step 3: Confirmation status'}
            </DialogDescription>
          </DialogHeader>

          {existingPolicyWarning && externalPaymentStep !== 'complete' && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{existingPolicyWarning}</AlertDescription>
            </Alert>
          )}

          {externalPaymentStep === 'details' && (
            <div className="space-y-4">
              {/* Customer & Vehicle Details */}
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-3">
                <h4 className="font-semibold text-blue-900 flex items-center gap-2">
                  <UserCheck className="w-4 h-4" />
                  Customer & Vehicle Details
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-blue-600">Customer Name *</Label>
                    <Input
                      value={editableCustomerName}
                      onChange={(e) => setEditableCustomerName(e.target.value)}
                      className="bg-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-blue-600">Email *</Label>
                    <Input
                      value={editableCustomerEmail}
                      onChange={(e) => setEditableCustomerEmail(e.target.value)}
                      className="bg-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-blue-600">Phone</Label>
                    <Input
                      value={editableCustomerPhone}
                      onChange={(e) => setEditableCustomerPhone(e.target.value)}
                      placeholder="07xxx xxxxxx"
                      className="bg-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-blue-600">Registration *</Label>
                    <Input
                      value={editableRegNumber}
                      onChange={(e) => setEditableRegNumber(e.target.value.toUpperCase())}
                      className="bg-white font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-blue-600">Vehicle</Label>
                    <p className="text-sm text-blue-900 py-2">{vehicleData?.make} {vehicleData?.model} ({vehicleData?.year})</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-blue-600">Mileage</Label>
                    <Input
                      value={editableMileage}
                      onChange={(e) => setEditableMileage(e.target.value.replace(/\D/g, ''))}
                      className="bg-white"
                    />
                  </div>
                </div>
              </div>

              {/* Address Section */}
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-amber-900">📍 Customer Address</h4>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="skip-address"
                      checked={skipAddressDetails}
                      onCheckedChange={(checked) => setSkipAddressDetails(checked === true)}
                    />
                    <Label htmlFor="skip-address" className="text-xs text-amber-700 cursor-pointer">
                      Customer will complete in dashboard
                    </Label>
                  </div>
                </div>
                
                {!skipAddressDetails && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs text-amber-600">House/Building Number</Label>
                      <Input
                        value={customerBuildingNumber}
                        onChange={(e) => setCustomerBuildingNumber(e.target.value)}
                        className="bg-white"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-amber-600">Street</Label>
                      <Input
                        value={customerStreet}
                        onChange={(e) => setCustomerStreet(e.target.value)}
                        className="bg-white"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-amber-600">Town/City</Label>
                      <Input
                        value={customerTown}
                        onChange={(e) => setCustomerTown(e.target.value)}
                        className="bg-white"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-amber-600">County</Label>
                      <Input
                        value={customerCounty}
                        onChange={(e) => setCustomerCounty(e.target.value)}
                        className="bg-white"
                      />
                    </div>
                    <div className="space-y-1 col-span-2">
                      <Label className="text-xs text-amber-600">Postcode *</Label>
                      <Input
                        value={customerPostcode}
                        onChange={(e) => setCustomerPostcode(e.target.value.toUpperCase())}
                        className="bg-white w-1/2"
                      />
                    </div>
                  </div>
                )}
                
                {skipAddressDetails && (
                  <Alert className="bg-amber-100 border-amber-300">
                    <Info className="h-4 w-4 text-amber-600" />
                    <AlertDescription className="text-amber-800 text-sm">
                      The customer will be prompted to complete their address in their dashboard.
                    </AlertDescription>
                  </Alert>
                )}
              </div>

              {/* Policy Summary */}
              <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg space-y-3">
                <h4 className="font-semibold text-purple-900 flex items-center gap-2">
                  <Zap className="w-4 h-4" />
                  Policy Configuration
                </h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-purple-600">Plan:</span> Platinum</div>
                  <div>
                    <span className="text-purple-600">Duration:</span> {termOptions.find(t => t.id === paymentType)?.label}
                    {freeExtendedCover !== 'none' && (
                      <span className="ml-1 text-green-600">+ {freeExtendedCover === '3months' ? '3' : '6'} months FREE</span>
                    )}
                  </div>
                  <div><span className="text-purple-600">Excess:</span> £{excessAmount}</div>
                  <div><span className="text-purple-600">Claim Limit:</span> £{(boostAddon ? claimLimit + 1000 : claimLimit).toLocaleString()}</div>
                  <div><span className="text-purple-600">Labour Rate:</span> £{labourRate}/hr</div>
                  <div><span className="text-purple-600">Price:</span> <strong>£{currentPrice.totalPrice}</strong></div>
                </div>
              </div>

              {/* Payment Details */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Payment Source *</Label>
                  <select
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

                <div className="space-y-2">
                  <Label>Payment Reference *</Label>
                  <Input
                    value={paymentReference}
                    onChange={(e) => setPaymentReference(e.target.value)}
                    placeholder="e.g. pi_xxxx, BAC123456, etc."
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Amount Received (£) *</Label>
                    <Input
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
                    <Label className="flex items-center gap-2">
                      <CalendarIcon className="w-4 h-4" />
                      Warranty Start Date *
                    </Label>
                    <Popover open={isStartDateCalendarOpen} onOpenChange={setIsStartDateCalendarOpen}>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-start">
                          {format(warrantyStartDate, 'd MMM yyyy')}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <CalendarComponent
                          mode="single"
                          selected={warrantyStartDate}
                          onSelect={(date) => {
                            if (date) setWarrantyStartDate(date);
                            setIsStartDateCalendarOpen(false);
                          }}
                          disabled={(date) => date < new Date()}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
              </div>

              {/* Options */}
              <div className="flex flex-wrap gap-4">
                <div className="flex items-center gap-2">
                  <Checkbox id="w2k" checked={sendToW2k} onCheckedChange={(c) => setSendToW2k(c === true)} />
                  <Label htmlFor="w2k" className="cursor-pointer">Send to Warranties 2000</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox id="welcome" checked={sendWelcomeEmail} onCheckedChange={(c) => setSendWelcomeEmail(c === true)} />
                  <Label htmlFor="welcome" className="cursor-pointer">Send Welcome Email</Label>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setShowConfirmDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={handleProceedToPreview} className="bg-green-600 hover:bg-green-700">
                  Review & Confirm
                </Button>
              </DialogFooter>
            </div>
          )}

          {externalPaymentStep === 'preview' && (
            <div className="space-y-4">
              <Alert className="bg-blue-50 border-blue-200">
                <Info className="h-4 w-4 text-blue-600" />
                <AlertDescription className="text-blue-800">
                  Please review all details before confirming. This will create a policy and customer record.
                </AlertDescription>
              </Alert>

              <div className="space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-2 p-3 bg-muted rounded">
                  <div><strong>Customer:</strong> {editableCustomerName}</div>
                  <div><strong>Email:</strong> {editableCustomerEmail}</div>
                  <div><strong>Vehicle:</strong> {editableRegNumber}</div>
                  <div><strong>Mileage:</strong> {parseInt(editableMileage).toLocaleString()}</div>
                </div>
                <div className="grid grid-cols-2 gap-2 p-3 bg-muted rounded">
                  <div><strong>Duration:</strong> {termOptions.find(t => t.id === paymentType)?.label}</div>
                  <div><strong>Claim Limit:</strong> £{(boostAddon ? claimLimit + 1000 : claimLimit).toLocaleString()}</div>
                  <div><strong>Start Date:</strong> {format(warrantyStartDate, 'd MMM yyyy')}</div>
                  <div><strong>Amount:</strong> £{paymentAmount}</div>
                </div>
                <div className="grid grid-cols-2 gap-2 p-3 bg-muted rounded">
                  <div><strong>Payment Source:</strong> {paymentSource}</div>
                  <div><strong>Reference:</strong> {paymentReference}</div>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setExternalPaymentStep('details')}>
                  Back
                </Button>
                <Button 
                  onClick={handleConfirmPayment}
                  disabled={isConfirming}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {isConfirming ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Creating Policy...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      Confirm Payment
                    </>
                  )}
                </Button>
              </DialogFooter>
            </div>
          )}

          {externalPaymentStep === 'complete' && (
            <div className="space-y-4">
              <div className="text-center py-4">
                <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-green-700">Payment Confirmed!</h3>
                <p className="text-muted-foreground">Policy has been created successfully</p>
              </div>

              <div className="space-y-2">
                {completionStatus.policy && (
                  <div className="flex items-center gap-2 text-green-600">
                    <CheckCircle2 className="w-4 h-4" /> Policy created
                  </div>
                )}
                {completionStatus.customer && (
                  <div className="flex items-center gap-2 text-green-600">
                    <CheckCircle2 className="w-4 h-4" /> Customer account created
                  </div>
                )}
                {completionStatus.w2k && (
                  <div className="flex items-center gap-2 text-green-600">
                    <CheckCircle2 className="w-4 h-4" /> Sent to Warranties 2000
                  </div>
                )}
                {completionStatus.email && (
                  <div className="flex items-center gap-2 text-green-600">
                    <CheckCircle2 className="w-4 h-4" /> Welcome email sent
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button onClick={resetForm} className="w-full">
                  Confirm Another Payment
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ConfirmExternalPaymentTab;
