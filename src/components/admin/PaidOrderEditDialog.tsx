import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { 
  User, 
  Car, 
  Shield, 
  Save, 
  Send, 
  Mail, 
  Loader2, 
  CheckCircle2,
  KeyRound,
  AlertCircle
} from 'lucide-react';
import { format } from 'date-fns';

interface PaidOrder {
  id: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  vehicle_reg: string;
  vehicle_make: string;
  vehicle_model: string;
  vehicle_year: string;
  vehicle_mileage: string;
  claim_limit: number;
  labour_rate: number;
  excess_amount: number;
  boost_addon: boolean;
  monthly_price: number;
  upfront_price: number;
  breakdown_included: boolean;
  rental_included: boolean;
  additional_notes: string;
  paid_at: string;
  payment_method: string;
  payment_source: string;
  policy_number: string;
  status: string;
  duration_months: number;
  bonus_months: number;
  customer_id?: string;
  policy_id?: string;
  customer_address?: {
    street?: string;
    town?: string;
    county?: string;
    postcode?: string;
    building_number?: string;
  };
  payment_confirmed_by?: string;
  payment_confirmed_by_name?: string;
}

interface AdminUser {
  id: string;       // admin_users.id - for assigned_to FK
  user_id: string;  // auth.users.id - for payment_confirmed_by
  name: string;
}

interface PaidOrderEditDialogProps {
  isOpen: boolean;
  onClose: () => void;
  order: PaidOrder | null;
  onSave: () => void;
  adminUsers?: AdminUser[];
}

export const PaidOrderEditDialog: React.FC<PaidOrderEditDialogProps> = ({
  isOpen,
  onClose,
  order,
  onSave,
  adminUsers = [],
}) => {
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [isResendingEmail, setIsResendingEmail] = useState(false);
  const [isCompletingOrder, setIsCompletingOrder] = useState(false);
  
  // Customer details
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [street, setStreet] = useState('');
  const [town, setTown] = useState('');
  const [county, setCounty] = useState('');
  const [postcode, setPostcode] = useState('');
  const [buildingNumber, setBuildingNumber] = useState('');
  const [accessibilityNotes, setAccessibilityNotes] = useState('');
  
  // Vehicle details
  const [vehicleReg, setVehicleReg] = useState('');
  const [vehicleMake, setVehicleMake] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');
  const [vehicleMileage, setVehicleMileage] = useState('');
  const [vehicleYear, setVehicleYear] = useState('');
  
  // Warranty details
  const [claimLimit, setClaimLimit] = useState(1250);
  const [labourRate, setLabourRate] = useState(70);
  const [excessAmount, setExcessAmount] = useState(100);
  const [boostAddon, setBoostAddon] = useState(false);
  const [breakdownIncluded, setBreakdownIncluded] = useState(false);
  const [rentalIncluded, setRentalIncluded] = useState(false);
  const [notes, setNotes] = useState('');
  
  // Agent attribution - who closed the deal
  // Store the admin_users.id - we'll look up the user_id when saving
  const [selectedAgentId, setSelectedAgentId] = useState(''); // admin_users.id

  // Reset form when order changes
  useEffect(() => {
    if (order) {
      setCustomerName(order.customer_name || '');
      setCustomerEmail(order.customer_email || '');
      setCustomerPhone(order.customer_phone || '');
      setStreet(order.customer_address?.street || '');
      setTown(order.customer_address?.town || '');
      setCounty(order.customer_address?.county || '');
      setPostcode(order.customer_address?.postcode || '');
      setBuildingNumber(order.customer_address?.building_number || '');
      setVehicleReg(order.vehicle_reg || '');
      setVehicleMake(order.vehicle_make || '');
      setVehicleModel(order.vehicle_model || '');
      setVehicleMileage(order.vehicle_mileage || '');
      setVehicleYear(order.vehicle_year || '');
      setClaimLimit(order.claim_limit || 1250);
      setLabourRate(order.labour_rate || 70);
      setExcessAmount(order.excess_amount || 100);
      setBoostAddon(order.boost_addon || false);
      setBreakdownIncluded(order.breakdown_included || false);
      setRentalIncluded(order.rental_included || false);
      setNotes(order.additional_notes || '');
      setAccessibilityNotes('');
      // Find the admin_users.id that matches payment_confirmed_by (which stores user_id)
      const matchingAgent = adminUsers.find(a => a.user_id === order.payment_confirmed_by);
      setSelectedAgentId(matchingAgent?.id || '');
    }
  }, [order, adminUsers]);

  const handleSaveChanges = async (updateDashboard: boolean) => {
    if (!order) return;
    
    setIsSaving(true);
    try {
      // Update live_quotes table
      const { error: quoteError } = await supabase
        .from('live_quotes')
        .update({
          customer_name: customerName,
          customer_email: customerEmail,
          customer_phone: customerPhone,
          vehicle_reg: vehicleReg.toUpperCase(),
          vehicle_make: vehicleMake,
          vehicle_model: vehicleModel,
          vehicle_mileage: vehicleMileage,
          vehicle_year: vehicleYear,
          claim_limit: claimLimit,
          labour_rate: labourRate,
          excess_amount: excessAmount,
          boost_addon: boostAddon,
          breakdown_included: breakdownIncluded,
          rental_included: rentalIncluded,
          additional_notes: notes,
          // Look up the user_id for the selected agent (payment_confirmed_by uses user_id)
          payment_confirmed_by: selectedAgentId 
            ? adminUsers.find(a => a.id === selectedAgentId)?.user_id || null 
            : null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', order.id);

      if (quoteError) throw quoteError;

      // Parse customer name into first/last
      const nameParts = customerName.trim().split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';

      let customerId = order.customer_id;

      // If customer exists, update customers table
      if (order.customer_id && updateDashboard) {
        const { error: customerError } = await supabase
          .from('customers')
          .update({
            name: customerName,
            first_name: firstName,
            last_name: lastName,
            email: customerEmail,
            phone: customerPhone,
            registration_plate: vehicleReg.toUpperCase(),
            vehicle_make: vehicleMake,
            vehicle_model: vehicleModel,
            mileage: vehicleMileage,
            vehicle_year: vehicleYear,
            claim_limit: claimLimit,
            labour_rate: labourRate,
            voluntary_excess: excessAmount,
            street: street,
            town: town,
            county: county,
            postcode: postcode,
            building_number: buildingNumber,
            // Update sales agent assignment (uses admin_users.id)
            assigned_to: selectedAgentId || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', order.customer_id);

        if (customerError) {
          console.error('Error updating customer:', customerError);
        }
      } else if (!order.customer_id && updateDashboard) {
        // CREATE customer record if it doesn't exist (critical fix for data integrity)
        const { data: newCustomer, error: createError } = await supabase
          .from('customers')
          .insert({
            name: customerName,
            first_name: firstName,
            last_name: lastName,
            email: customerEmail,
            phone: customerPhone,
            registration_plate: vehicleReg.toUpperCase(),
            vehicle_make: vehicleMake,
            vehicle_model: vehicleModel,
            mileage: vehicleMileage,
            vehicle_year: vehicleYear,
            claim_limit: claimLimit,
            labour_rate: labourRate,
            voluntary_excess: excessAmount,
            street: street,
            town: town,
            county: county,
            postcode: postcode,
            building_number: buildingNumber,
            plan_type: 'Platinum', // Default plan type
            status: 'active',
            payment_type: order.payment_method || order.payment_source || 'external',
            final_amount: order.upfront_price || (order.monthly_price * 12),
            signup_date: order.paid_at || new Date().toISOString(),
            payment_verified: true,
            // payment_confirmed_by uses user_id, assigned_to uses admin_users.id
            payment_confirmed_by: selectedAgentId 
              ? adminUsers.find(a => a.id === selectedAgentId)?.user_id || null 
              : null,
            assigned_to: selectedAgentId || null, // admin_users.id for FK relationship
          })
          .select('id')
          .single();

        if (createError) {
          console.error('Error creating customer:', createError);
          toast({
            title: "Warning",
            description: "Order saved but customer record could not be created. Please try again.",
            variant: "destructive",
          });
        } else {
          customerId = newCustomer?.id;
          toast({
            title: "Customer Created",
            description: `Customer record created for ${customerName}. They can now be found in Customer Logins.`,
          });
        }
      }

      // If policy exists, update customer_policies table
      if (order.policy_id && updateDashboard) {
        const { error: policyError } = await supabase
          .from('customer_policies')
          .update({
            email: customerEmail,
            customer_full_name: customerName,
            claim_limit: claimLimit,
            voluntary_excess: excessAmount,
            breakdown_recovery: breakdownIncluded,
            vehicle_rental: rentalIncluded,
            address: {
              street,
              town,
              county,
              postcode,
              building_number: buildingNumber,
            },
            updated_at: new Date().toISOString(),
          })
          .eq('id', order.policy_id);

        if (policyError) {
          console.error('Error updating policy:', policyError);
        }
      }

      toast({
        title: updateDashboard ? "Dashboard Updated" : "Changes Saved",
        description: updateDashboard 
          ? "Customer dashboard has been updated with the new information." 
          : "Changes saved internally. Customer dashboard not updated.",
      });

      onSave();
    } catch (error: any) {
      console.error('Error saving changes:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to save changes",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCompleteOrder = async () => {
    if (!order) return;
    
    setIsCompletingOrder(true);
    try {
      // Parse name
      const nameParts = customerName.trim().split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';
      const totalMonths = (order.duration_months || 12) + (order.bonus_months || 0);
      const paymentType = `${totalMonths}months`;
      const finalAmount = order.upfront_price || (order.monthly_price * 12);

      // Call confirm-external-payment — handles dedup, customer creation, policy, and email
      // Calculate duration months from the order data
      const durationMonths = order.duration_months || 12;
      const bonusMonths = order.bonus_months || 0;

      const { data, error } = await supabase.functions.invoke('confirm-external-payment', {
        body: {
          liveQuoteId: order.id,
          customerEmail: customerEmail,
          customerName: customerName,
          customerFirstName: firstName,
          customerLastName: lastName,
          customerPhone: customerPhone,
          vehicleReg: vehicleReg.toUpperCase(),
          vehicleMake: vehicleMake,
          vehicleModel: vehicleModel,
          vehicleYear: vehicleYear,
          mileage: vehicleMileage,
          planType: 'Platinum',
          paymentType: paymentType,
          durationMonths: durationMonths,
          bonusMonths: bonusMonths,
          finalAmount: finalAmount,
          claimLimit: claimLimit,
          labourRate: labourRate,
          excessAmount: excessAmount,
          boostAddon: boostAddon,
          paymentSource: order.payment_method || order.payment_source || 'external',
          assigneeId: selectedAgentId || null,
          sendWelcomeEmail: true,
          additionalNotes: notes,
          address: {
            buildingNumber: buildingNumber,
            street: street,
            town: town,
            county: county,
            postcode: postcode,
          },
        }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      // Update live_quotes with the final confirmation details
      const policyNumber = data?.warrantyReference || data?.warrantyNumber || data?.policyNumber;
      if (policyNumber) {
        await supabase
          .from('live_quotes')
          .update({ 
            customer_name: customerName,
            customer_email: customerEmail,
            customer_phone: customerPhone,
            vehicle_reg: vehicleReg.toUpperCase(),
            vehicle_make: vehicleMake,
            vehicle_model: vehicleModel,
            vehicle_mileage: vehicleMileage,
            vehicle_year: vehicleYear,
            claim_limit: boostAddon ? claimLimit + 1000 : claimLimit,
            labour_rate: labourRate,
            excess_amount: excessAmount,
            boost_addon: boostAddon,
            breakdown_included: breakdownIncluded,
            rental_included: rentalIncluded,
            additional_notes: notes,
            status: 'paid_externally',
            payment_confirmed_at: new Date().toISOString(),
            policy_number: policyNumber,
            payment_confirmed_by: selectedAgentId 
              ? adminUsers.find(a => a.id === selectedAgentId)?.user_id || null 
              : null,
          })
          .eq('id', order.id);
      }

      toast({
        title: "Order Completed ✅",
        description: `Warranty ${policyNumber || ''} created and welcome email sent to ${customerEmail}.`,
      });

      onSave();
    } catch (error: any) {
      console.error('Error completing order:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to complete order",
        variant: "destructive",
      });
    } finally {
      setIsCompletingOrder(false);
    }
  };

  const handleResendLoginEmail = async () => {
    if (!order?.customer_email) return;
    
    setIsResendingEmail(true);
    try {
      const { error } = await supabase.functions.invoke('resend-welcome-email', {
        body: { 
          email: customerEmail,
          customerName: customerName,
        }
      });

      if (error) throw error;

      toast({
        title: "Login Email Sent",
        description: `Login credentials have been sent to ${customerEmail}`,
      });
    } catch (error: any) {
      console.error('Error resending email:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to send login email",
        variant: "destructive",
      });
    } finally {
      setIsResendingEmail(false);
    }
  };

  if (!order) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl">
            {!order.policy_number ? (
              <>
                <AlertCircle className="h-5 w-5 text-amber-600" />
                <span className="text-amber-800">Review & Confirm Order</span>
              </>
            ) : (
              <>Edit Order: {order.policy_number || order.vehicle_reg}</>
            )}
          </DialogTitle>
        </DialogHeader>

        {/* Prominent alert for unprocessed orders */}
        {!order.policy_number && (
          <div className="bg-amber-100 border-2 border-amber-400 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="h-6 w-6 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-amber-900 text-base">Payment received. Confirm all details below.</p>
              <p className="text-sm text-amber-800 mt-1">
                The customer has paid but NO warranty has been created yet. Review and update ALL information below, 
                then click <strong>"Confirm Details & Create Warranty"</strong> at the bottom. The customer will receive their 
                welcome email and warranty details only after you confirm.
              </p>
            </div>
          </div>
        )}

        {/* Alert if customer record exists but no policy */}
        {order.customer_id && !order.policy_number && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start gap-2">
            <CheckCircle2 className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-blue-800">Existing customer found</p>
              <p className="text-sm text-blue-700">
                A customer record already exists for this email. The warranty will be linked to the existing customer.
              </p>
            </div>
          </div>
        )}

        <div className="grid gap-4 sm:gap-6 mt-4">
          {/* Section A: Customer Details */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                <User className="h-4 w-4 sm:h-5 sm:w-5" />
                Customer Details
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="customerName">Full Name</Label>
                  <Input
                    id="customerName"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Customer name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="customerEmail">Email (Login Username)</Label>
                  <Input
                    id="customerEmail"
                    type="email"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    placeholder="customer@email.com"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="customerPhone">Phone</Label>
                <Input
                  id="customerPhone"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="Phone number"
                />
              </div>

              <Separator />
              
              <div className="space-y-2">
                <Label className="text-sm font-medium">Address</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input
                    placeholder="Building Number"
                    value={buildingNumber}
                    onChange={(e) => setBuildingNumber(e.target.value)}
                  />
                  <Input
                    placeholder="Street"
                    value={street}
                    onChange={(e) => setStreet(e.target.value)}
                  />
                  <Input
                    placeholder="Town/City"
                    value={town}
                    onChange={(e) => setTown(e.target.value)}
                  />
                  <Input
                    placeholder="County"
                    value={county}
                    onChange={(e) => setCounty(e.target.value)}
                  />
                  <Input
                    placeholder="Postcode"
                    value={postcode}
                    onChange={(e) => setPostcode(e.target.value.toUpperCase())}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="accessibilityNotes">Accessibility Notes (optional)</Label>
                <Textarea
                  id="accessibilityNotes"
                  value={accessibilityNotes}
                  onChange={(e) => setAccessibilityNotes(e.target.value)}
                  placeholder="Notes about customer accessibility needs or communication preferences..."
                  rows={2}
                />
              </div>
            </CardContent>
          </Card>

          {/* Section B: Vehicle & Warranty Details */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                <Car className="h-4 w-4 sm:h-5 sm:w-5" />
                Vehicle Details
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="vehicleReg">Registration</Label>
                  <Input
                    id="vehicleReg"
                    value={vehicleReg}
                    onChange={(e) => setVehicleReg(e.target.value.toUpperCase())}
                    placeholder="AB12 CDE"
                    className="uppercase font-bold"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="vehicleMake">Make</Label>
                  <Input
                    id="vehicleMake"
                    value={vehicleMake}
                    onChange={(e) => setVehicleMake(e.target.value)}
                    placeholder="Make"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="vehicleModel">Model</Label>
                  <Input
                    id="vehicleModel"
                    value={vehicleModel}
                    onChange={(e) => setVehicleModel(e.target.value)}
                    placeholder="Model"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="vehicleMileage">Mileage</Label>
                  <Input
                    id="vehicleMileage"
                    value={vehicleMileage}
                    onChange={(e) => setVehicleMileage(e.target.value.replace(/[^0-9]/g, ''))}
                    placeholder="45000"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="vehicleYear">Year</Label>
                  <Input
                    id="vehicleYear"
                    value={vehicleYear}
                    onChange={(e) => setVehicleYear(e.target.value)}
                    placeholder="2020"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Warranty Coverage */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                <Shield className="h-4 w-4 sm:h-5 sm:w-5" />
                Warranty Coverage
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Claim Limit</Label>
                  <Select value={claimLimit.toString()} onValueChange={(v) => setClaimLimit(parseInt(v))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="750">£1,000</SelectItem>
                      <SelectItem value="1250">£1,250</SelectItem>
                      <SelectItem value="2000">£2,000</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Labour Rate</Label>
                  <Select value={labourRate.toString()} onValueChange={(v) => setLabourRate(parseInt(v))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="50">£50/hr</SelectItem>
                      <SelectItem value="70">£70/hr</SelectItem>
                      <SelectItem value="100">£100/hr</SelectItem>
                      <SelectItem value="200">£200/hr</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Excess</Label>
                  <Select value={excessAmount.toString()} onValueChange={(v) => setExcessAmount(parseInt(v))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">£0</SelectItem>
                      <SelectItem value="50">£50</SelectItem>
                      <SelectItem value="100">£100</SelectItem>
                      <SelectItem value="150">£150</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex flex-wrap gap-4">
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="boost" 
                    checked={boostAddon}
                    onCheckedChange={(checked) => setBoostAddon(checked as boolean)}
                  />
                  <Label htmlFor="boost" className="text-sm">Boost (+£1000)</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="breakdown" 
                    checked={breakdownIncluded}
                    onCheckedChange={(checked) => setBreakdownIncluded(checked as boolean)}
                  />
                  <Label htmlFor="breakdown" className="text-sm">Breakdown Cover</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="rental" 
                    checked={rentalIncluded}
                    onCheckedChange={(checked) => setRentalIncluded(checked as boolean)}
                  />
                  <Label htmlFor="rental" className="text-sm">Vehicle Rental</Label>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Additional Notes</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Any additional notes about the order..."
                  rows={2}
                />
              </div>

              {/* Agent Attribution */}
              <div className="space-y-2">
                <Label>Sales Agent Who Closed This Deal</Label>
                <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select sales agent..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Not assigned</SelectItem>
                    {adminUsers.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Select the agent who closed this deal for commission tracking
                </p>
              </div>

              {/* Order Info Display */}
              <div className="bg-muted/50 rounded-lg p-3 sm:p-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground">Total Paid:</span>
                  <div className="font-semibold">£{order.upfront_price || (order.monthly_price * 12)}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Monthly:</span>
                  <div className="font-semibold">£{order.monthly_price}/mo</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Payment:</span>
                  <div className="font-semibold">{order.payment_method || order.payment_source || 'N/A'}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Order Date:</span>
                  <div className="font-semibold">
                    {order.paid_at ? format(new Date(order.paid_at), 'dd/MM/yyyy') : 'N/A'}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Section C: System Actions */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base sm:text-lg">Actions</CardTitle>
            </CardHeader>
            <CardContent>
              {/* Primary action: Complete Order (only shown when no policy exists yet) */}
              {!order.policy_number && (
                <div className="mb-4 p-4 bg-green-50 border-2 border-green-400 rounded-lg">
                  <p className="text-base font-bold text-green-900 mb-2">Ready to confirm?</p>
                  <p className="text-sm text-green-800 mb-4">
                    Once you click below, the system will create the customer record, generate the warranty, 
                    and send the welcome email to <strong>{customerEmail}</strong>.
                  </p>
                  <Button
                    onClick={handleCompleteOrder}
                    disabled={isCompletingOrder || isSaving || !selectedAgentId}
                    size="lg"
                    className="w-full bg-green-600 hover:bg-green-700 text-white text-base py-6"
                  >
                    {isCompletingOrder ? (
                      <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                    ) : (
                      <Send className="h-5 w-5 mr-2" />
                    )}
                    Confirm Details & Create Warranty
                  </Button>
                  {!selectedAgentId && (
                    <p className="text-xs text-red-600 mt-2 font-medium">
                      Please select a sales agent above before confirming.
                    </p>
                  )}
                </div>
              )}

              {/* Secondary actions (for already-processed orders) */}
              {order.policy_number && (
                <div className="flex flex-col sm:flex-row gap-3">
                  <Button
                    variant="outline"
                    onClick={() => handleSaveChanges(false)}
                    disabled={isSaving}
                    className="flex-1"
                  >
                    {isSaving ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4 mr-2" />
                    )}
                    Save Changes
                  </Button>
                  
                  <Button
                    onClick={() => handleSaveChanges(true)}
                    disabled={isSaving}
                    className="flex-1"
                  >
                    {isSaving ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                    )}
                    Save & Update Dashboard
                  </Button>
                  
                  <Button
                    variant="secondary"
                    onClick={handleResendLoginEmail}
                    disabled={isResendingEmail}
                    className="flex-1"
                  >
                    {isResendingEmail ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Mail className="h-4 w-4 mr-2" />
                    )}
                    Resend Login Email
                  </Button>
                </div>
              )}
              
              {order.policy_number && (
                <p className="text-xs text-muted-foreground mt-3">
                  <AlertCircle className="h-3 w-3 inline mr-1" />
                  "Save Changes" updates records internally. "Save & Update Dashboard" pushes changes to the customer's dashboard.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
};
