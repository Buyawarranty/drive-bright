import React, { useState, useEffect } from 'react';
import { Lead } from '@/hooks/useLeads';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { 
  CreditCard, Loader2, CheckCircle2, User, Car, Shield, 
  AlertTriangle, FileText, History, ChevronRight 
} from 'lucide-react';
import { format } from 'date-fns';
import { DuplicateWarrantyDialog } from '../DuplicateWarrantyDialog';

interface CustomerApplication {
  id: string;
  created_at: string;
  plan_name: string | null;
  payment_type: string | null;
  step_abandoned: number | null;
  cart_metadata: any;
  vehicle_reg: string | null;
}

interface MarkAsPaidDialogProps {
  lead: Lead;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  onNavigateToQuote?: () => void;
}

export const MarkAsPaidDialog: React.FC<MarkAsPaidDialogProps> = ({
  lead,
  open,
  onOpenChange,
  onSuccess,
  onNavigateToQuote
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState<{ show: boolean; record?: any }>({ show: false });
  const [isLoadingApplications, setIsLoadingApplications] = useState(false);
  const [applications, setApplications] = useState<CustomerApplication[]>([]);
  const [existingCustomer, setExistingCustomer] = useState<any>(null);
  const [selectedApplication, setSelectedApplication] = useState<CustomerApplication | null>(null);
  
  // Form state - editable plan details
  const [stripeSessionId, setStripeSessionId] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [planType, setPlanType] = useState('Platinum');
  const [paymentType, setPaymentType] = useState('12months');
  const [claimLimit, setClaimLimit] = useState(1250);
  const [voluntaryExcess, setVoluntaryExcess] = useState(100);
  const [labourRate, setLabourRate] = useState(70);
  const [additionalNotes, setAdditionalNotes] = useState('');
  const [sendToW2k, setSendToW2k] = useState(true);
  const [sendWelcomeEmail, setSendWelcomeEmail] = useState(true);
  
  // Add-ons
  const [breakdownRecovery, setBreakdownRecovery] = useState(false);
  const [vehicleRental, setVehicleRental] = useState(false);
  const [europeCover, setEuropeCover] = useState(false);
  const [tyreCover, setTyreCover] = useState(false);
  const [wearTear, setWearTear] = useState(false);
  const [motFee, setMotFee] = useState(false);
  const [transferCover, setTransferCover] = useState(false);

  const customerName = lead.first_name && lead.last_name 
    ? `${lead.first_name} ${lead.last_name}` 
    : lead.full_name || '';
  
  const vehicleInfo = `${lead.vehicle_make || ''} ${lead.vehicle_model || ''} ${lead.vehicle_year ? `(${lead.vehicle_year})` : ''}`.trim();

  // Fetch all applications and existing customer data
  useEffect(() => {
    if (open && lead.email) {
      fetchApplicationsAndCustomer();
    }
  }, [open, lead.email]);

  const fetchApplicationsAndCustomer = async () => {
    setIsLoadingApplications(true);
    try {
      // Fetch all abandoned cart entries for this email
      const { data: carts, error: cartsError } = await supabase
        .from('abandoned_carts')
        .select('id, created_at, plan_name, payment_type, step_abandoned, cart_metadata, vehicle_reg')
        .eq('email', lead.email.toLowerCase())
        .order('created_at', { ascending: false });

      if (cartsError) throw cartsError;
      setApplications(carts || []);

      // Check for existing customer with same email + reg plate
      const { data: customer, error: customerError } = await supabase
        .from('customers')
        .select('id, name, email, registration_plate, plan_type, status, created_at')
        .eq('email', lead.email.toLowerCase())
        .maybeSingle();

      if (!customerError && customer) {
        setExistingCustomer(customer);
      }

      // Pre-populate from current lead data or latest application
      const latestApp = carts?.[0];
      if (latestApp?.cart_metadata) {
        populateFromCartMetadata(latestApp.cart_metadata, latestApp);
      } else if (lead.cart_metadata) {
        populateFromCartMetadata(lead.cart_metadata, lead);
      } else {
        // Use lead defaults
        setPaymentAmount(lead.payment_amount?.toString() || '');
        setPlanType(lead.plan_name || 'Platinum');
        setPaymentType(lead.payment_type || '12months');
      }
    } catch (error) {
      console.error('Error fetching applications:', error);
    } finally {
      setIsLoadingApplications(false);
    }
  };

  const populateFromCartMetadata = (metadata: any, app: any) => {
    setClaimLimit(metadata.claim_limit || 1250);
    setVoluntaryExcess(metadata.voluntary_excess || 100);
    setLabourRate(metadata.labour_rate || 70);
    setPaymentAmount(metadata.total_price?.toString() || '');
    setPlanType(app.plan_name || 'Platinum');
    setPaymentType(app.payment_type || '12months');
    
    const addons = metadata.protection_addons || {};
    setBreakdownRecovery(addons.breakdown || false);
    setVehicleRental(addons.rental || false);
    setEuropeCover(addons.european || false);
    setTyreCover(addons.tyre || false);
    setWearTear(addons.wearAndTear || false);
    setMotFee(addons.motFee || false);
    setTransferCover(addons.transfer || false);
  };

  const handleSelectApplication = (app: CustomerApplication) => {
    setSelectedApplication(app);
    if (app.cart_metadata) {
      populateFromCartMetadata(app.cart_metadata, app);
    }
    toast.success(`Loaded application from ${format(new Date(app.created_at), 'dd MMM yyyy HH:mm')}`);
  };

  const handleMarkAsPaid = async () => {
    if (!paymentAmount || parseFloat(paymentAmount) <= 0) {
      toast.error('Please enter a valid payment amount');
      return;
    }

    // Check for duplicate warranty before proceeding
    const { checkDuplicateWarranty } = await import('@/lib/duplicateWarrantyCheck');
    const regPlate = lead.vehicle_reg?.toUpperCase() || '';
    const duplicateCheck = await checkDuplicateWarranty(regPlate, lead.email);
    if (duplicateCheck.isDuplicate) {
      setDuplicateWarning({ show: true, record: duplicateCheck.existingRecord });
      return;
    }

    setIsProcessing(true);

    try {
      const amount = parseFloat(paymentAmount);
      const now = new Date().toISOString();
      const { data: { user } } = await supabase.auth.getUser();

      // 1. Check for existing customer by email + reg plate (deduplication)
      console.log('📝 Checking for existing customer...');
      
      let customerId: string;
      const regPlate = lead.vehicle_reg?.toUpperCase() || '';
      
      // First try to find by email + reg plate (exact match)
      let existingCust = null;
      if (regPlate) {
        const { data: byRegAndEmail } = await supabase
          .from('customers')
          .select('id')
          .eq('email', lead.email.toLowerCase())
          .eq('registration_plate', regPlate)
          .maybeSingle();
        existingCust = byRegAndEmail;
      }
      
      // If not found, try by email only
      if (!existingCust) {
        const { data: byEmail } = await supabase
          .from('customers')
          .select('id')
          .eq('email', lead.email.toLowerCase())
          .maybeSingle();
        existingCust = byEmail;
      }

      const customerData = {
        name: customerName || lead.email.split('@')[0],
        email: lead.email.toLowerCase(),
        first_name: lead.first_name || null,
        last_name: lead.last_name || null,
        phone: lead.phone || null,
        registration_plate: regPlate || null,
        vehicle_make: lead.vehicle_make || null,
        vehicle_model: lead.vehicle_model || null,
        vehicle_year: lead.vehicle_year || null,
        mileage: lead.mileage || null,
        plan_type: planType,
        payment_type: paymentType,
        final_amount: amount,
        original_amount: amount,
        status: 'Active',
        stripe_session_id: stripeSessionId || `manual_stripe_${Date.now()}`,
        is_manual_entry: true,
        payment_verified: true,
        voluntary_excess: voluntaryExcess,
        claim_limit: claimLimit,
        labour_rate: labourRate,
        breakdown_recovery: breakdownRecovery,
        vehicle_rental: vehicleRental,
        europe_cover: europeCover,
        tyre_cover: tyreCover,
        wear_tear: wearTear,
        mot_fee: motFee,
        transfer_cover: transferCover,
        updated_at: now,
      };

      if (existingCust) {
        // Update existing customer
        const { error: updateError } = await supabase
          .from('customers')
          .update(customerData)
          .eq('id', existingCust.id);
        
        if (updateError) throw updateError;
        customerId = existingCust.id;
        console.log('✅ Updated existing customer:', customerId);
      } else {
        // Create new customer
        const { data: newCustomer, error: createError } = await supabase
          .from('customers')
          .insert({
            ...customerData,
            signup_date: now,
          })
          .select('id')
          .single();
        
        if (createError) throw createError;
        customerId = newCustomer.id;
        console.log('✅ Created new customer:', customerId);
      }

      // 2. Create customer policy record
      console.log('📋 Creating policy record...');
      
      const startDate = new Date();
      let months = 12;
      if (paymentType === '24months') months = 24;
      if (paymentType === '36months') months = 36;
      
      const bonusMonths = 3;
      const endDate = new Date(startDate);
      endDate.setMonth(endDate.getMonth() + months + bonusMonths);

      const datePart = format(startDate, 'yyyyMMdd');
      const randomPart = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
      const policyNumber = `POL-${datePart}-${randomPart}`;

      const { data: policyData, error: policyError } = await supabase
        .from('customer_policies')
        .insert({
          customer_id: customerId,
          email: lead.email.toLowerCase(),
          customer_full_name: customerName,
          plan_type: planType,
          payment_type: paymentType,
          payment_amount: amount,
          payment_currency: 'GBP',
          payment_verified: true,
          policy_start_date: startDate.toISOString(),
          policy_end_date: endDate.toISOString(),
          policy_number: policyNumber,
          warranty_number: policyNumber, // Use same reference to prevent trigger from generating a duplicate
          status: 'active',
          stripe_session_id: stripeSessionId || `manual_stripe_${Date.now()}`,
          is_manual_entry: true,
          claim_limit: claimLimit,
          voluntary_excess: voluntaryExcess,
          seasonal_bonus_months: bonusMonths,
          breakdown_recovery: breakdownRecovery,
          vehicle_rental: vehicleRental,
          europe_cover: europeCover,
          tyre_cover: tyreCover,
          wear_tear: wearTear,
          mot_fee: motFee,
          transfer_cover: transferCover,
        })
        .select('id, policy_number, warranty_number')
        .single();

      if (policyError) throw policyError;
      console.log('✅ Created policy:', policyData.policy_number);

      // 3. Update all related records to mark as converted
      console.log('📊 Updating lead and cart records...');
      
      // Update sales_leads
      if (!lead.is_from_abandoned_cart) {
        await supabase
          .from('sales_leads')
          .update({
            is_paid: true,
            payment_amount: amount,
            payment_method: 'stripe',
            payment_date: now,
            status: 'converted' as const,
            converted_at: now,
            last_activity_date: now,
            notes: `PAID via Stripe - £${amount.toFixed(2)} - Marked by admin${additionalNotes ? `\n\nW2K Notes: ${additionalNotes}` : ''}`
          })
          .eq('id', lead.id);
      }

      // Mark ALL abandoned carts for this email as converted (dedup)
      await supabase
        .from('abandoned_carts')
        .update({
          is_converted: true,
          converted_at: now,
          contact_status: 'converted',
          contact_notes: `PAID via Stripe - £${amount.toFixed(2)} - Policy: ${policyData.policy_number}`
        })
        .eq('email', lead.email.toLowerCase())
        .eq('is_converted', false);

      // 4. Add admin note
      if (additionalNotes) {
        await supabase
          .from('admin_notes')
          .insert({
            customer_id: customerId,
            note: `Manual Stripe Payment - W2K Notes: ${additionalNotes}`,
            created_by: user?.id
          });
      }

      // 5. Send to Warranties Register
      if (sendToW2k) {
        console.log('🔄 Sending to Warranties Register...');
        try {
          const { error: w2kError } = await supabase.functions.invoke(
            'send-to-warranties-2000',
            {
              body: {
                customerId: customerId,
                policyId: policyData.id,
                force: true,
                additionalNotes: additionalNotes || undefined
              }
            }
          );

          if (w2kError) {
            console.error('W2K Error:', w2kError);
            toast.warning('Order created but failed to send to Warranties Register');
          } else {
            console.log('✅ Sent to Warranties Register');
          }
        } catch (w2kErr) {
          console.error('W2K Exception:', w2kErr);
          toast.warning('Order created but Warranties Register submission failed');
        }
      }

      // 6. Send welcome email
      if (sendWelcomeEmail) {
        console.log('📧 Sending welcome email...');
        try {
          const { error: emailError } = await supabase.functions.invoke(
            'send-welcome-email-manual',
            {
              body: {
                policyId: policyData.id,
                customerId: customerId
              }
            }
          );

          if (emailError) {
            console.error('Email Error:', emailError);
            toast.warning('Order created but welcome email failed');
          } else {
            console.log('✅ Welcome email sent');
          }
        } catch (emailErr) {
          console.error('Email Exception:', emailErr);
          toast.warning('Order created but welcome email failed');
        }
      }

      // Send sale notification email (fire and forget)
      try {
        await supabase.functions.invoke('send-sale-notification', {
          body: {
            customerName: customerName || lead.email,
            customerEmail: lead.email,
            customerPhone: lead.phone || null,
            regPlate: lead.vehicle_reg || null,
            planName: planType,
            saleValue: amount,
            paymentMethod: 'Stripe',
            warrantyReference: policyData.policy_number,
            vehicleMake: lead.vehicle_make || null,
            vehicleModel: lead.vehicle_model || null,
            agentId: lead.assigned_to || null,
          }
        });
      } catch (e) {
        console.warn('Sale notification email failed (non-critical):', e);
      }

      toast.success(`Successfully marked as paid! Policy: ${policyData.policy_number}`);
      onOpenChange(false);
      onSuccess?.();

    } catch (error) {
      console.error('Error marking as paid:', error);
      toast.error(`Failed to process: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCreateQuoteFirst = () => {
    onOpenChange(false);
    onNavigateToQuote?.();
  };

  return (
    <>
    <DuplicateWarrantyDialog
      isOpen={duplicateWarning.show}
      onClose={() => setDuplicateWarning({ show: false })}
      record={duplicateWarning.record}
    />
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
            Mark as Paid via Stripe
          </DialogTitle>
          <DialogDescription>
            Process this lead as a completed Stripe payment. Review the plan details before confirming.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="space-y-4 py-2">
            {/* Customer Summary */}
            <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{customerName || lead.email}</span>
              </div>
              <div className="flex items-center gap-2">
                <Car className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{lead.vehicle_reg || 'No reg'} {vehicleInfo && `- ${vehicleInfo}`}</span>
              </div>
            </div>

            {/* Warning if existing customer */}
            {existingCustomer && (
              <Alert variant="default" className="border-amber-200 bg-amber-50">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <AlertDescription className="text-amber-800">
                  <strong>Existing customer found:</strong> {existingCustomer.name} ({existingCustomer.registration_plate || 'no reg'}) - 
                  Created {format(new Date(existingCustomer.created_at), 'dd MMM yyyy')}. 
                  This will update their existing record.
                </AlertDescription>
              </Alert>
            )}

            {/* Multiple Applications Warning */}
            {applications.length > 1 && (
              <div className="rounded-lg border p-3 space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <History className="h-4 w-4" />
                  {applications.length} applications found for this email
                </div>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {applications.map((app, index) => (
                    <button
                      key={app.id}
                      onClick={() => handleSelectApplication(app)}
                      className={`w-full text-left text-xs p-2 rounded border transition-colors ${
                        selectedApplication?.id === app.id 
                          ? 'border-primary bg-primary/5' 
                          : 'border-transparent hover:bg-muted/50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span>{format(new Date(app.created_at), 'dd MMM yyyy HH:mm')}</span>
                        <div className="flex items-center gap-1">
                          {app.plan_name && <Badge variant="secondary" className="text-xs">{app.plan_name}</Badge>}
                          {app.step_abandoned && <Badge variant="outline" className="text-xs">Step {app.step_abandoned}</Badge>}
                          {app.vehicle_reg && <span className="text-muted-foreground">{app.vehicle_reg}</span>}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <Separator />

            {/* Create Quote Option */}
            {onNavigateToQuote && (
              <Button
                variant="outline"
                className="w-full justify-between"
                onClick={handleCreateQuoteFirst}
              >
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  <span>Create Quote First (Recommended)</span>
                </div>
                <ChevronRight className="h-4 w-4" />
              </Button>
            )}

            <Tabs defaultValue="details" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="details">Plan Details</TabsTrigger>
                <TabsTrigger value="addons">Add-ons</TabsTrigger>
              </TabsList>

              <TabsContent value="details" className="space-y-3 mt-3">
                {/* Payment Details */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="stripeSessionId">Stripe Session ID</Label>
                    <Input
                      id="stripeSessionId"
                      value={stripeSessionId}
                      onChange={(e) => setStripeSessionId(e.target.value)}
                      placeholder="cs_live_xxx (optional)"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="paymentAmount">Payment Amount (£) *</Label>
                    <Input
                      id="paymentAmount"
                      type="number"
                      step="0.01"
                      min="0"
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value)}
                      placeholder="Amount paid"
                      className="mt-1"
                      required
                    />
                  </div>
                </div>

                {/* Plan Selection */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Plan Type</Label>
                    <Select value={planType} onValueChange={setPlanType}>
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Platinum">Platinum</SelectItem>
                        <SelectItem value="Gold">Gold</SelectItem>
                        <SelectItem value="Basic">Basic</SelectItem>
                        <SelectItem value="EV">EV</SelectItem>
                        <SelectItem value="PHEV">PHEV</SelectItem>
                        <SelectItem value="Motorbike">Motorbike</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Payment Type</Label>
                    <Select value={paymentType} onValueChange={setPaymentType}>
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="12months">12 Months</SelectItem>
                        <SelectItem value="24months">24 Months</SelectItem>
                        <SelectItem value="36months">36 Months</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Claim Details */}
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label>Claim Limit (£)</Label>
                    <Input
                      type="number"
                      value={claimLimit}
                      onChange={(e) => setClaimLimit(parseInt(e.target.value) || 1250)}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>Excess (£)</Label>
                    <Input
                      type="number"
                      value={voluntaryExcess}
                      onChange={(e) => setVoluntaryExcess(parseInt(e.target.value) || 100)}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>Labour Rate (£/hr)</Label>
                    <Input
                      type="number"
                      value={labourRate}
                      onChange={(e) => setLabourRate(parseInt(e.target.value) || 70)}
                      className="mt-1"
                    />
                  </div>
                </div>

                {/* W2K Notes */}
                <div>
                  <Label htmlFor="additionalNotes">Additional Notes for Warranties Register</Label>
                  <Textarea
                    id="additionalNotes"
                    value={additionalNotes}
                    onChange={(e) => setAdditionalNotes(e.target.value)}
                    placeholder="Special instructions for W2K..."
                    rows={2}
                    className="mt-1"
                  />
                </div>
              </TabsContent>

              <TabsContent value="addons" className="space-y-3 mt-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center space-x-2">
                    <Checkbox id="breakdown" checked={breakdownRecovery} onCheckedChange={(c) => setBreakdownRecovery(!!c)} />
                    <Label htmlFor="breakdown" className="cursor-pointer">Breakdown Recovery</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox id="rental" checked={vehicleRental} onCheckedChange={(c) => setVehicleRental(!!c)} />
                    <Label htmlFor="rental" className="cursor-pointer">Vehicle Rental</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox id="europe" checked={europeCover} onCheckedChange={(c) => setEuropeCover(!!c)} />
                    <Label htmlFor="europe" className="cursor-pointer">European Cover</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox id="tyre" checked={tyreCover} onCheckedChange={(c) => setTyreCover(!!c)} />
                    <Label htmlFor="tyre" className="cursor-pointer">Tyre Cover</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox id="wearTear" checked={wearTear} onCheckedChange={(c) => setWearTear(!!c)} />
                    <Label htmlFor="wearTear" className="cursor-pointer">Wear & Tear</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox id="transfer" checked={transferCover} onCheckedChange={(c) => setTransferCover(!!c)} />
                    <Label htmlFor="transfer" className="cursor-pointer">Transfer Cover</Label>
                  </div>
                </div>
              </TabsContent>
            </Tabs>

            <Separator />

            {/* Options */}
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox id="sendToW2k" checked={sendToW2k} onCheckedChange={(c) => setSendToW2k(!!c)} />
                <Label htmlFor="sendToW2k" className="cursor-pointer">Send to Warranties Register</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox id="sendWelcomeEmail" checked={sendWelcomeEmail} onCheckedChange={(c) => setSendWelcomeEmail(!!c)} />
                <Label htmlFor="sendWelcomeEmail" className="cursor-pointer">Send welcome email with portal login</Label>
              </div>
            </div>

            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription>
                This creates a customer record, policy, marks all cart entries as converted, and sends to W2K.
              </AlertDescription>
            </Alert>
          </div>
        </ScrollArea>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isProcessing}>
            Cancel
          </Button>
          <Button onClick={handleMarkAsPaid} disabled={isProcessing || !paymentAmount} className="gap-2">
            {isProcessing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <CreditCard className="h-4 w-4" />
                Mark as Paid
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
};
