import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { PoundSterling, Car, User, Mail, FileText, Calendar, Loader2, Search } from 'lucide-react';
import MileageSlider from '@/components/MileageSlider';

interface AddClaimDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerEmail?: string;
  customerName?: string;
  vehicleReg?: string;
  onClaimAdded?: () => void;
}

const CLAIM_STATUSES = [
  { value: 'new', label: 'New' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'awaiting_info', label: 'Awaiting Information' },
  { value: 'approved', label: 'Approved' },
  { value: 'paid', label: 'Paid' },
  { value: 'rejected', label: 'Rejected' },
];

export const AddClaimDialog: React.FC<AddClaimDialogProps> = ({
  open,
  onOpenChange,
  customerEmail = '',
  customerName = '',
  vehicleReg = '',
  onClaimAdded
}) => {
  const [loading, setLoading] = useState(false);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: customerName,
    email: customerEmail,
    vehicleRegistration: vehicleReg,
    claimReason: '',
    paymentAmount: '',
    status: 'new',
    internalNotes: '',
    dateOfIncident: '',
    mileageAtClaim: 0,
    vehicleMake: '',
    vehicleModel: '',
    vehicleYear: '',
  });

  // Update form when props change
  React.useEffect(() => {
    setFormData(prev => ({
      ...prev,
      name: customerName || prev.name,
      email: customerEmail || prev.email,
      vehicleRegistration: vehicleReg || prev.vehicleRegistration,
    }));
  }, [customerEmail, customerName, vehicleReg]);

  const handleVehicleLookup = async () => {
    if (!formData.vehicleRegistration || formData.vehicleRegistration.length < 2) {
      return;
    }

    setLookupLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('dvla-vehicle-lookup', {
        body: { registrationNumber: formData.vehicleRegistration.replace(/\s/g, '').toUpperCase() }
      });

      if (error) throw error;

      if (data && !data.error) {
        setFormData(prev => ({
          ...prev,
          vehicleMake: data.make || '',
          vehicleModel: data.model || '',
          vehicleYear: data.yearOfManufacture?.toString() || '',
        }));
        toast.success(`Found: ${data.make} ${data.model} (${data.yearOfManufacture})`);
      } else {
        toast.error(data?.error || 'Vehicle not found');
      }
    } catch (error: any) {
      console.error('Vehicle lookup error:', error);
      toast.error('Failed to lookup vehicle');
    } finally {
      setLookupLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.vehicleRegistration) {
      toast.error('Vehicle registration is required');
      return;
    }

    setLoading(true);
    try {
      const claimData: any = {
        name: formData.name || 'Unknown',
        email: formData.email?.toLowerCase() || 'unknown@unknown.com',
        vehicle_registration: formData.vehicleRegistration?.toUpperCase() || null,
        claim_reason: formData.claimReason || null,
        payment_amount: formData.paymentAmount ? parseFloat(formData.paymentAmount) : null,
        status: formData.status,
        internal_notes: formData.internalNotes || null,
        mileage_at_claim: formData.mileageAtClaim > 0 ? formData.mileageAtClaim : null,
      };

      if (formData.dateOfIncident) {
        claimData.date_of_incident = new Date(formData.dateOfIncident).toISOString();
      }

      if (formData.status === 'paid' && formData.paymentAmount) {
        claimData.paid_at = new Date().toISOString();
      }

      if (formData.status === 'approved') {
        claimData.approved_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('claims_submissions')
        .insert(claimData);

      if (error) throw error;

      toast.success('Claim added successfully');
      onClaimAdded?.();
      onOpenChange(false);
      
      // Reset form
      setFormData({
        name: customerName,
        email: customerEmail,
        vehicleRegistration: vehicleReg,
        claimReason: '',
        paymentAmount: '',
        status: 'new',
        internalNotes: '',
        dateOfIncident: '',
        mileageAtClaim: 0,
        vehicleMake: '',
        vehicleModel: '',
        vehicleYear: '',
      });
    } catch (error: any) {
      console.error('Error adding claim:', error);
      toast.error(error.message || 'Failed to add claim');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-brand-orange" />
            Add Claim Record
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Vehicle Registration with Lookup - REQUIRED */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1">
              <Car className="w-3 h-3" />
              Vehicle Registration *
            </Label>
            <div className="flex gap-2">
              <Input
                value={formData.vehicleRegistration}
                onChange={(e) => setFormData({ ...formData, vehicleRegistration: e.target.value.toUpperCase() })}
                placeholder="AB12 CDE"
                className="flex-1"
                required
              />
              <Button
                type="button"
                variant="outline"
                onClick={handleVehicleLookup}
                disabled={lookupLoading || !formData.vehicleRegistration}
              >
                {lookupLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Search className="w-4 h-4" />
                )}
              </Button>
            </div>
            {formData.vehicleMake && (
              <p className="text-sm text-muted-foreground">
                {formData.vehicleMake} {formData.vehicleModel} ({formData.vehicleYear})
              </p>
            )}
          </div>

          {/* Mileage Slider */}
          <div className="space-y-2">
            <Label>Mileage at Claim: {formData.mileageAtClaim.toLocaleString()} miles</Label>
            <MileageSlider
              value={formData.mileageAtClaim}
              onChange={(value) => setFormData({ ...formData, mileageAtClaim: value })}
              min={0}
              max={150000}
            />
          </div>

          {/* Customer Info - Optional */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-1">
                <User className="w-3 h-3" />
                Customer Name
              </Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="John Smith"
              />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1">
                <Mail className="w-3 h-3" />
                Email
              </Label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="john@example.com"
              />
            </div>
          </div>

          {/* Claim Details */}
          <div className="space-y-2">
            <Label>Claim Reason / Description</Label>
            <Textarea
              value={formData.claimReason}
              onChange={(e) => setFormData({ ...formData, claimReason: e.target.value })}
              placeholder="Describe the claim reason..."
              rows={2}
            />
          </div>

          {/* Status and Amount */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => setFormData({ ...formData, status: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CLAIM_STATUSES.map((status) => (
                    <SelectItem key={status.value} value={status.value}>
                      {status.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1">
                <PoundSterling className="w-3 h-3" />
                Amount Paid (£)
              </Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={formData.paymentAmount}
                onChange={(e) => setFormData({ ...formData, paymentAmount: e.target.value })}
                placeholder="0.00"
              />
            </div>
          </div>

          {/* Date */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              Date of Incident
            </Label>
            <Input
              type="date"
              value={formData.dateOfIncident}
              onChange={(e) => setFormData({ ...formData, dateOfIncident: e.target.value })}
            />
          </div>

          {/* Internal Notes */}
          <div className="space-y-2">
            <Label>Internal Notes</Label>
            <Textarea
              value={formData.internalNotes}
              onChange={(e) => setFormData({ ...formData, internalNotes: e.target.value })}
              placeholder="Internal notes (not visible to customer)..."
              rows={2}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Adding...
                </>
              ) : (
                <>
                  <FileText className="w-4 h-4 mr-2" />
                  Add Claim
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
