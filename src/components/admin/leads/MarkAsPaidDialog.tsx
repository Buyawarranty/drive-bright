import React, { useState } from 'react';
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
import { toast } from 'sonner';
import { CreditCard, Loader2, CheckCircle2, Send, User, Car, Shield } from 'lucide-react';
import { format } from 'date-fns';

interface MarkAsPaidDialogProps {
  lead: Lead;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export const MarkAsPaidDialog: React.FC<MarkAsPaidDialogProps> = ({
  lead,
  open,
  onOpenChange,
  onSuccess
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [stripeSessionId, setStripeSessionId] = useState('');
  const [paymentAmount, setPaymentAmount] = useState(
    lead.cart_metadata?.total_price?.toString() || lead.payment_amount?.toString() || ''
  );
  const [additionalNotes, setAdditionalNotes] = useState('');
  const [sendToW2k, setSendToW2k] = useState(true);
  const [sendWelcomeEmail, setSendWelcomeEmail] = useState(true);

  // Extract customer data from lead
  const customerName = lead.first_name && lead.last_name 
    ? `${lead.first_name} ${lead.last_name}` 
    : lead.full_name || '';
  
  const vehicleInfo = `${lead.vehicle_make || ''} ${lead.vehicle_model || ''} ${lead.vehicle_year ? `(${lead.vehicle_year})` : ''}`.trim();

  const handleMarkAsPaid = async () => {
    if (!paymentAmount || parseFloat(paymentAmount) <= 0) {
      toast.error('Please enter a valid payment amount');
      return;
    }

    setIsProcessing(true);

    try {
      const amount = parseFloat(paymentAmount);
      const now = new Date().toISOString();

      // Get current user for audit trail
      const { data: { user } } = await supabase.auth.getUser();

      // 1. Create or update customer record
      console.log('📝 Creating customer record...');
      
      // Check for existing customer first
      const { data: existingCustomer } = await supabase
        .from('customers')
        .select('id')
        .eq('email', lead.email.toLowerCase())
        .maybeSingle();

      // Build customer data from lead and cart_metadata
      const cartMetadata = lead.cart_metadata || {};
      const protectionAddons = cartMetadata.protection_addons || {};
      
      const customerData: Record<string, any> = {
        name: customerName || lead.email.split('@')[0],
        email: lead.email.toLowerCase(),
        first_name: lead.first_name || null,
        last_name: lead.last_name || null,
        phone: lead.phone || null,
        registration_plate: lead.vehicle_reg || null,
        vehicle_make: lead.vehicle_make || null,
        vehicle_model: lead.vehicle_model || null,
        vehicle_year: lead.vehicle_year || null,
        mileage: lead.mileage || null,
        plan_type: lead.plan_name || 'Platinum',
        payment_type: lead.payment_type || '12months',
        final_amount: amount,
        original_amount: amount,
        status: 'Active',
        signup_date: now,
        stripe_session_id: stripeSessionId || `manual_stripe_${Date.now()}`,
        is_manual_entry: true,
        payment_verified: true,
        voluntary_excess: cartMetadata.voluntary_excess || 100,
        claim_limit: cartMetadata.claim_limit || 1250,
        labour_rate: cartMetadata.labour_rate || 70,
        // Add-ons from cart_metadata
        breakdown_recovery: protectionAddons.breakdown || false,
        vehicle_rental: protectionAddons.rental || false,
        europe_cover: protectionAddons.european || false,
        tyre_cover: protectionAddons.tyre || false,
        wear_tear: protectionAddons.wearAndTear || false,
        mot_fee: protectionAddons.motFee || false,
        transfer_cover: protectionAddons.transfer || false,
        updated_at: now,
      };

      let customerId: string;
      
      if (existingCustomer) {
        // Update existing customer
        const { error: updateError } = await supabase
          .from('customers')
          .update(customerData)
          .eq('id', existingCustomer.id);
        
        if (updateError) throw updateError;
        customerId = existingCustomer.id;
        console.log('✅ Updated existing customer:', customerId);
      } else {
        // Create new customer
        const { data: newCustomer, error: createError } = await supabase
          .from('customers')
          .insert({
            name: customerData.name,
            email: customerData.email,
            plan_type: customerData.plan_type,
            first_name: customerData.first_name,
            last_name: customerData.last_name,
            phone: customerData.phone,
            registration_plate: customerData.registration_plate,
            vehicle_make: customerData.vehicle_make,
            vehicle_model: customerData.vehicle_model,
            vehicle_year: customerData.vehicle_year,
            mileage: customerData.mileage,
            payment_type: customerData.payment_type,
            final_amount: customerData.final_amount,
            original_amount: customerData.original_amount,
            status: customerData.status,
            signup_date: customerData.signup_date,
            stripe_session_id: customerData.stripe_session_id,
            is_manual_entry: customerData.is_manual_entry,
            payment_verified: customerData.payment_verified,
            voluntary_excess: customerData.voluntary_excess,
            claim_limit: customerData.claim_limit,
            labour_rate: customerData.labour_rate,
            breakdown_recovery: customerData.breakdown_recovery,
            vehicle_rental: customerData.vehicle_rental,
            europe_cover: customerData.europe_cover,
            tyre_cover: customerData.tyre_cover,
            wear_tear: customerData.wear_tear,
            mot_fee: customerData.mot_fee,
            transfer_cover: customerData.transfer_cover,
            updated_at: customerData.updated_at,
          })
          .select('id')
          .single();
        
        if (createError) throw createError;
        customerId = newCustomer.id;
        console.log('✅ Created new customer:', customerId);
      }

      // 2. Create customer policy record
      console.log('📋 Creating policy record...');
      
      // Calculate policy dates based on payment type
      const startDate = new Date();
      const paymentType = lead.payment_type || '12months';
      let months = 12;
      if (paymentType === '24months') months = 24;
      if (paymentType === '36months') months = 36;
      
      // Add bonus months (typically 3)
      const bonusMonths = 3;
      const endDate = new Date(startDate);
      endDate.setMonth(endDate.getMonth() + months + bonusMonths);

      // Generate a policy number
      const datePart = format(startDate, 'yyyyMMdd');
      const randomPart = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
      const policyNumber = `POL-${datePart}-${randomPart}`;

      const policyInsertData = {
        customer_id: customerId,
        email: lead.email.toLowerCase(),
        customer_full_name: customerName,
        plan_type: customerData.plan_type as string,
        payment_type: paymentType,
        payment_amount: amount,
        payment_currency: 'GBP',
        payment_verified: true,
        policy_start_date: startDate.toISOString(),
        policy_end_date: endDate.toISOString(),
        policy_number: policyNumber,
        status: 'active',
        stripe_session_id: stripeSessionId || `manual_stripe_${Date.now()}`,
        is_manual_entry: true,
        claim_limit: customerData.claim_limit as number,
        voluntary_excess: customerData.voluntary_excess as number,
        seasonal_bonus_months: bonusMonths,
        // Add-ons
        breakdown_recovery: customerData.breakdown_recovery as boolean,
        vehicle_rental: customerData.vehicle_rental as boolean,
        europe_cover: customerData.europe_cover as boolean,
        tyre_cover: customerData.tyre_cover as boolean,
        wear_tear: customerData.wear_tear as boolean,
        mot_fee: customerData.mot_fee as boolean,
        transfer_cover: customerData.transfer_cover as boolean,
      };

      const { data: policyData, error: policyError } = await supabase
        .from('customer_policies')
        .insert([policyInsertData])
        .select('id, policy_number, warranty_number')
        .single();

      if (policyError) throw policyError;
      console.log('✅ Created policy:', policyData.policy_number);

      // 3. Update sales_leads table to mark as paid
      console.log('📊 Updating lead status...');
      
      const leadUpdateData = {
        is_paid: true,
        payment_amount: amount,
        payment_method: 'stripe',
        payment_date: now,
        status: 'converted' as const,
        converted_at: now,
        last_activity_date: now,
        notes: `PAID via Stripe - £${amount.toFixed(2)} - Marked by admin${additionalNotes ? `\n\nW2K Notes: ${additionalNotes}` : ''}`
      };

      // Update sales_leads if it exists
      if (!lead.is_from_abandoned_cart) {
        await supabase
          .from('sales_leads')
          .update(leadUpdateData)
          .eq('id', lead.id);
      }

      // Also update abandoned_carts if applicable
      if (lead.is_from_abandoned_cart) {
        await supabase
          .from('abandoned_carts')
          .update({
            is_converted: true,
            converted_at: now,
            contact_status: 'converted',
            contact_notes: `PAID via Stripe - £${amount.toFixed(2)} - Marked by admin${additionalNotes ? `\n\nW2K Notes: ${additionalNotes}` : ''}`
          })
          .eq('email', lead.email.toLowerCase());
      }

      console.log('✅ Lead marked as paid');

      // 4. Add admin note if there are additional notes
      if (additionalNotes) {
        await supabase
          .from('admin_notes')
          .insert({
            customer_id: customerId,
            note: `Manual Stripe Payment - W2K Notes: ${additionalNotes}`,
            created_by: user?.id
          });
      }

      // 5. Send to Warranties 2000 if enabled
      if (sendToW2k) {
        console.log('🔄 Sending to Warranties 2000...');
        try {
          const { data: w2kData, error: w2kError } = await supabase.functions.invoke(
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
            toast.warning('Order created but failed to send to Warranties 2000');
          } else {
            console.log('✅ Sent to Warranties 2000:', w2kData);
          }
        } catch (w2kErr) {
          console.error('W2K Exception:', w2kErr);
          toast.warning('Order created but Warranties 2000 submission failed');
        }
      }

      // 6. Send welcome email if enabled
      if (sendWelcomeEmail) {
        console.log('📧 Sending welcome email...');
        try {
          const { data: emailData, error: emailError } = await supabase.functions.invoke(
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
            console.log('✅ Welcome email sent:', emailData);
          }
        } catch (emailErr) {
          console.error('Email Exception:', emailErr);
          toast.warning('Order created but welcome email failed');
        }
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
            Mark as Paid via Stripe
          </DialogTitle>
          <DialogDescription>
            Process this lead as a completed Stripe payment. This will create the customer record, 
            policy, and optionally send to Warranties 2000.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
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
            {lead.plan_name && (
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-muted-foreground" />
                <Badge variant="secondary">{lead.plan_name}</Badge>
                {lead.payment_type && (
                  <Badge variant="outline">{lead.payment_type}</Badge>
                )}
              </div>
            )}
          </div>

          <Separator />

          {/* Payment Details */}
          <div className="space-y-3">
            <div>
              <Label htmlFor="stripeSessionId">Stripe Session ID (optional)</Label>
              <Input
                id="stripeSessionId"
                value={stripeSessionId}
                onChange={(e) => setStripeSessionId(e.target.value)}
                placeholder="cs_live_xxx or pi_xxx"
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Enter the Stripe session or payment intent ID for reconciliation
              </p>
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
                placeholder="Enter amount paid"
                className="mt-1"
                required
              />
            </div>

            <div>
              <Label htmlFor="additionalNotes">Additional Notes (for Warranties 2000)</Label>
              <Textarea
                id="additionalNotes"
                value={additionalNotes}
                onChange={(e) => setAdditionalNotes(e.target.value)}
                placeholder="Any special instructions or notes for W2K..."
                rows={3}
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">
                These notes will be included in the Warranties 2000 submission
              </p>
            </div>
          </div>

          <Separator />

          {/* Options */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="sendToW2k"
                checked={sendToW2k}
                onCheckedChange={(checked) => setSendToW2k(!!checked)}
              />
              <Label htmlFor="sendToW2k" className="cursor-pointer">
                Send to Warranties 2000 API
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="sendWelcomeEmail"
                checked={sendWelcomeEmail}
                onCheckedChange={(checked) => setSendWelcomeEmail(!!checked)}
              />
              <Label htmlFor="sendWelcomeEmail" className="cursor-pointer">
                Send welcome email with portal login details
              </Label>
            </div>
          </div>

          <Alert>
            <CheckCircle2 className="h-4 w-4" />
            <AlertDescription>
              This will create the customer record, policy, and mark the lead as converted.
              The customer will receive their dashboard login credentials.
            </AlertDescription>
          </Alert>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isProcessing}
          >
            Cancel
          </Button>
          <Button
            onClick={handleMarkAsPaid}
            disabled={isProcessing || !paymentAmount}
            className="gap-2"
          >
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
  );
};
