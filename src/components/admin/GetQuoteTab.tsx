import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { ArrowRight, Mail, MessageCircle, Loader2 } from 'lucide-react';
import MileageSlider from '@/components/MileageSlider';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

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

interface QuoteData {
  vehicleData: VehicleData;
  selectedPlan: string;
  paymentType: string;
  finalPrice: number;
  coverageDetails: string[];
}

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
  const [selectedPlan, setSelectedPlan] = useState('platinum');
  const [paymentType, setPaymentType] = useState('12months');
  const [finalPrice, setFinalPrice] = useState(0);
  const [excessAmount, setExcessAmount] = useState(100);
  const [claimLimit, setClaimLimit] = useState(1250);
  const [customMonthlyPrice, setCustomMonthlyPrice] = useState('');
  const [customFullPrice, setCustomFullPrice] = useState('');
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [emailContent, setEmailContent] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [isSendingEmail, setIsSendingEmail] = useState(false);

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

      if (error) {
        console.error('DVLA lookup error:', error);
        toast({
          title: "Vehicle Not Found",
          description: "Unable to find vehicle details. Please check the registration number and try again.",
          variant: "destructive",
        });
        setIsLookingUp(false);
        return;
      }

      // Check if the API returned an error message or no vehicle data
      if (data?.error || !data?.make || !data?.model) {
        toast({
          title: "Vehicle Not Recognized",
          description: data?.error || "We couldn't find this vehicle in the DVLA database. Please verify the registration number.",
          variant: "destructive",
        });
        setIsLookingUp(false);
        return;
      }

      // Only validate age if we have valid year data
      if (data.yearOfManufacture || data.year) {
        const currentYear = new Date().getFullYear();
        const vehicleYear = parseInt(data.yearOfManufacture || data.year, 10);
        
        // Only validate if we got a valid year (not 0 or NaN)
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

      // Set vehicle data with confirmed lookup results
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

  // Use the same pricing logic as the customer journey
  const getPricingData = (excess: number, claimLimit: number, paymentPeriod: string) => {
    const pricingTable = {
      '12months': {
        0: { 750: 547, 1250: 587, 2000: 697, 2500: 747, 3000: 797, 4000: 897, 5000: 997, 6000: 1097 },
        50: { 750: 517, 1250: 537, 2000: 647, 2500: 697, 3000: 747, 4000: 847, 5000: 947, 6000: 1047 },
        100: { 750: 457, 1250: 497, 2000: 597, 2500: 647, 3000: 697, 4000: 797, 5000: 897, 6000: 997 },
        150: { 750: 427, 1250: 457, 2000: 567, 2500: 617, 3000: 667, 4000: 767, 5000: 867, 6000: 967 }
      },
      '24months': {
        0: { 750: 1057, 1250: 1097, 2000: 1207, 2500: 1307, 3000: 1407, 4000: 1607, 5000: 1807, 6000: 2007 },
        50: { 750: 967, 1250: 1037, 2000: 1127, 2500: 1227, 3000: 1327, 4000: 1527, 5000: 1727, 6000: 1927 },
        100: { 750: 867, 1250: 927, 2000: 1037, 2500: 1137, 3000: 1237, 4000: 1437, 5000: 1637, 6000: 1837 },
        150: { 750: 817, 1250: 867, 2000: 967, 2500: 1067, 3000: 1167, 4000: 1367, 5000: 1567, 6000: 1767 }
      },
      '36months': {
        0: { 750: 1587, 1250: 1637, 2000: 1757, 2500: 1907, 3000: 2057, 4000: 2357, 5000: 2657, 6000: 2957 },
        50: { 750: 1467, 1250: 1517, 2000: 1637, 2500: 1787, 3000: 1937, 4000: 2237, 5000: 2537, 6000: 2837 },
        100: { 750: 1287, 1250: 1387, 2000: 1507, 2500: 1657, 3000: 1807, 4000: 2107, 5000: 2407, 6000: 2707 },
        150: { 750: 1237, 1250: 1287, 2000: 1407, 2500: 1557, 3000: 1707, 4000: 2007, 5000: 2307, 6000: 2607 }
      }
    };
    
    const periodData = pricingTable[paymentPeriod as keyof typeof pricingTable] || pricingTable['12months'];
    const excessData = periodData[excess as keyof typeof periodData] || periodData[0];
    return excessData[claimLimit as keyof typeof excessData] || excessData[1250];
  };

  const handleCalculateQuote = () => {
    if (!selectedPlan || !customerEmail || !customerName) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    // Use custom prices if provided, otherwise calculate using pricing table
    let totalPrice = 0;
    if (customFullPrice && parseFloat(customFullPrice) > 0) {
      totalPrice = parseFloat(customFullPrice);
    } else if (customMonthlyPrice && parseFloat(customMonthlyPrice) > 0) {
      totalPrice = parseFloat(customMonthlyPrice) * 12;
    } else {
      totalPrice = getPricingData(excessAmount, claimLimit, paymentType);
    }
    
    setFinalPrice(totalPrice);
    setStep(3);
  };

  const generateEmailContent = (): { subject: string; content: string } => {
    const firstName = customerName.split(' ')[0];
    
    const paymentLabels = {
      '12months': 'Monthly',
      '24months': 'Monthly',
      '36months': 'Monthly'
    };

    const durationMonths = {
      '12months': 12,
      '24months': 24,
      '36months': 36
    };

    const bonusMonths = {
      '12months': 3,
      '24months': 3,
      '36months': 3
    };

    const months = durationMonths[paymentType as keyof typeof durationMonths];
    const bonus = bonusMonths[paymentType as keyof typeof bonusMonths];
    const totalMonths = months + bonus;
    const monthlyPrice = Math.round(finalPrice / 12);

    const subject = `Your Warranty Quote for ${vehicleData?.make} ${vehicleData?.model} - ${vehicleData?.regNumber}`;

    const content = `Hi ${firstName},

Thank you for considering BuyAWarranty.co.uk for your vehicle protection. Please find your quote details below:

Quote Summary:

Vehicle: ${vehicleData?.make || ''} ${vehicleData?.model || ''}
Registration: ${vehicleData?.regNumber}
Mileage: ${parseInt(vehicleData?.mileage || '0').toLocaleString()} miles
Plan: Platinum
Payment: ${paymentLabels[paymentType as keyof typeof paymentLabels]}
Price: £${monthlyPrice}/month (interest-free)
Excess: £${excessAmount}
Claim Limit: £${claimLimit.toLocaleString()}
Unlimited Claims up to the value of your vehicle
Cover Period: ${months} months + ${bonus} extra months free (total ${totalMonths} months)
Coverage: All mechanical and electrical parts, including labour.

Breakdowns Happen. Don't Risk It!

For full details on what's covered, please visit:
https://buyawarranty.co.uk/what-is-covered/

If you have any questions or would like to proceed, please call Mike Swan on 0330 229 5040 or follow the link sent separately from our payment partner, Bumper.

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
      // First send the email
      const { error: emailError } = await supabase.functions.invoke('send-admin-quote', {
        body: {
          to: customerEmail,
          subject: emailSubject,
          content: emailContent,
          vehicleData,
          quoteDetails: {
            plan: selectedPlan,
            paymentType,
            price: finalPrice,
            excessAmount,
            claimLimit
          }
        }
      });

      if (emailError) throw emailError;

      // Then add to abandoned_carts for tracking as incomplete customer
      const { error: abandonedCartError } = await supabase
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
            claimLimit: claimLimit,
            totalPrice: finalPrice,
            quoteSource: 'admin_sent'
          }
        });

      if (abandonedCartError) {
        console.error('Error adding to abandoned carts:', abandonedCartError);
      }

      toast({
        title: "Quote Sent Successfully",
        description: `Quote email sent to ${customerEmail} and added to incomplete customers`,
      });
      setShowEmailDialog(false);
      // Reset form
      setStep(1);
      setRegNumber('');
      setMileage('');
      setSliderMileage(0);
      setVehicleData(null);
      setCustomerEmail('');
      setCustomerName('');
      setSelectedPlan('platinum');
      setFinalPrice(0);
      setExcessAmount(100);
      setClaimLimit(1250);
      setCustomMonthlyPrice('');
      setCustomFullPrice('');
      setPaymentType('12months');
    } catch (error) {
      console.error('Error sending quote:', error);
      toast({
        title: "Error",
        description: "Failed to send quote. Please try again.",
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

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Send a Quote</h1>
        <p className="text-gray-600 mt-2">Generate and send quotes while on the phone with customers</p>
      </div>

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
          <CardContent className="space-y-4">
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

            <div className="space-y-2">
              <Label>Plan Type</Label>
              <div className="p-3 bg-muted rounded-md">
                <p className="text-sm font-medium">Platinum Plan (All customers receive the same comprehensive coverage)</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Warranty Duration</Label>
              <RadioGroup value={paymentType} onValueChange={setPaymentType}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="12months" id="12months" />
                  <Label htmlFor="12months" className="cursor-pointer">12 Months</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="24months" id="24months" />
                  <Label htmlFor="24months" className="cursor-pointer">24 Months</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="36months" id="36months" />
                  <Label htmlFor="36months" className="cursor-pointer">36 Months</Label>
                </div>
              </RadioGroup>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Excess Amount (£)</Label>
                <RadioGroup value={excessAmount.toString()} onValueChange={(val) => setExcessAmount(parseInt(val))}>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="0" id="excess-0" />
                    <Label htmlFor="excess-0" className="cursor-pointer">£0</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="50" id="excess-50" />
                    <Label htmlFor="excess-50" className="cursor-pointer">£50</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="100" id="excess-100" />
                    <Label htmlFor="excess-100" className="cursor-pointer">£100</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="150" id="excess-150" />
                    <Label htmlFor="excess-150" className="cursor-pointer">£150</Label>
                  </div>
                </RadioGroup>
              </div>
              <div className="space-y-2">
                <Label>Claim Limit (£)</Label>
                <RadioGroup value={claimLimit.toString()} onValueChange={(val) => setClaimLimit(parseInt(val))}>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="750" id="claim-750" />
                    <Label htmlFor="claim-750" className="cursor-pointer">£750</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="1250" id="claim-1250" />
                    <Label htmlFor="claim-1250" className="cursor-pointer">£1,250</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="2000" id="claim-2000" />
                    <Label htmlFor="claim-2000" className="cursor-pointer">£2,000</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="2500" id="claim-2500" />
                    <Label htmlFor="claim-2500" className="cursor-pointer">£2,500</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="3000" id="claim-3000" />
                    <Label htmlFor="claim-3000" className="cursor-pointer">£3,000</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="4000" id="claim-4000" />
                    <Label htmlFor="claim-4000" className="cursor-pointer">£4,000</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="5000" id="claim-5000" />
                    <Label htmlFor="claim-5000" className="cursor-pointer">£5,000</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="6000" id="claim-6000" />
                    <Label htmlFor="claim-6000" className="cursor-pointer">£6,000</Label>
                  </div>
                </RadioGroup>
              </div>
            </div>

            <div className="border-t pt-4 space-y-4">
              <div className="space-y-2">
                <Label className="text-base font-semibold">Custom Pricing (Optional)</Label>
                <p className="text-sm text-muted-foreground">Override calculated price with custom values</p>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="custom-monthly">Custom Monthly Price (£)</Label>
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
              <p className="text-xs text-muted-foreground">Leave empty to use automatic pricing calculation</p>
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
                Calculate Quote
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
              Quote: £{Math.round(finalPrice / 12)}/month for {customerName}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted p-4 rounded-lg">
              <h3 className="font-semibold mb-2">Quote Summary</h3>
              <div className="space-y-1 text-sm">
                <p><strong>Vehicle:</strong> {vehicleData?.make} {vehicleData?.model} ({vehicleData?.year})</p>
                <p><strong>Registration:</strong> {vehicleData?.regNumber}</p>
                <p><strong>Mileage:</strong> {parseInt(vehicleData?.mileage || '0').toLocaleString()} miles</p>
                <p><strong>Plan:</strong> Platinum</p>
                <p><strong>Duration:</strong> {paymentType === '12months' ? '12' : paymentType === '24months' ? '24' : '36'} months</p>
                <p><strong>Total Price:</strong> £{finalPrice}</p>
                <p><strong>Monthly Price:</strong> £{Math.round(finalPrice / 12)}/month</p>
                <p><strong>Excess:</strong> £{excessAmount}</p>
                <p><strong>Claim Limit:</strong> £{claimLimit.toLocaleString()}</p>
              </div>
            </div>

            <div className="flex gap-3">
              <Button 
                variant="outline"
                onClick={() => setStep(2)}
                className="flex-1"
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
                className="flex-1"
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
    </div>
  );
};
