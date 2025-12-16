import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Plus, Search, Car, Loader2 } from 'lucide-react';
import MileageSlider from '@/components/MileageSlider';

interface AddIncompleteCustomerDialogProps {
  onCustomerAdded: () => void;
}

export const AddIncompleteCustomerDialog: React.FC<AddIncompleteCustomerDialogProps> = ({ onCustomerAdded }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [sliderMileage, setSliderMileage] = useState(0);
  const [eligibilityError, setEligibilityError] = useState('');
  
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    registrationPlate: '',
    mileage: '',
    vehicleMake: '',
    vehicleModel: '',
    vehicleYear: '',
    vehicleType: '',
    planName: 'Platinum',
    notes: ''
  });

  const resetForm = () => {
    setFormData({
      fullName: '',
      email: '',
      phone: '',
      registrationPlate: '',
      mileage: '',
      vehicleMake: '',
      vehicleModel: '',
      vehicleYear: '',
      vehicleType: '',
      planName: 'Platinum',
      notes: ''
    });
    setSliderMileage(0);
    setEligibilityError('');
  };

  const handleMileageInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/[^0-9,]/g, '');
    setFormData(prev => ({ ...prev, mileage: value }));
    
    const numericValue = parseInt(value.replace(/,/g, ''));
    if (!isNaN(numericValue)) {
      setSliderMileage(numericValue);
    }
    
    // Check eligibility
    if (numericValue > 150000) {
      setEligibilityError('Vehicle mileage exceeds 150,000 miles limit');
    } else {
      setEligibilityError('');
    }
  };

  const handleSliderChange = (value: number) => {
    setSliderMileage(value);
    setFormData(prev => ({ ...prev, mileage: value.toLocaleString() }));
    
    // Check eligibility
    if (value > 150000) {
      setEligibilityError('Vehicle mileage exceeds 150,000 miles limit');
    } else {
      setEligibilityError('');
    }
  };

  const handleVehicleLookup = async () => {
    if (!formData.registrationPlate.trim()) {
      toast.error('Please enter a registration plate');
      return;
    }

    setIsLookingUp(true);
    setEligibilityError('');
    
    try {
      const { data, error } = await supabase.functions.invoke('dvla-vehicle-lookup', {
        body: { registrationNumber: formData.registrationPlate.replace(/\s+/g, '').toUpperCase() }
      });

      if (error) throw error;

      if (data?.found) {
        // Check vehicle age
        const vehicleYear = data.yearOfManufacture;
        if (vehicleYear) {
          const currentYear = new Date().getFullYear();
          const vehicleAge = currentYear - parseInt(vehicleYear);
          if (vehicleAge >= 15) {
            setEligibilityError('Vehicle is 15 years or older - not eligible');
          }
        }
        
        setFormData(prev => ({
          ...prev,
          vehicleMake: data.make || '',
          vehicleModel: data.model || '',
          vehicleYear: data.yearOfManufacture || '',
          vehicleType: data.fuelType?.toLowerCase().includes('electric') ? 'electric' : 
                      data.fuelType?.toLowerCase().includes('hybrid') ? 'hybrid' : 'standard'
        }));
        toast.success('Vehicle details found!');
      } else {
        toast.error('Vehicle not found. Please enter details manually.');
      }
    } catch (error) {
      console.error('Vehicle lookup error:', error);
      toast.error('Failed to lookup vehicle. Please enter details manually.');
    } finally {
      setIsLookingUp(false);
    }
  };

  const handleSubmit = async () => {
    // No required fields - allow saving with any data
    setIsLoading(true);
    try {
      const { error } = await supabase.from('abandoned_carts').insert({
        email: formData.email.toLowerCase().trim() || 'unknown@placeholder.com',
        full_name: formData.fullName.trim() || null,
        phone: formData.phone.trim() || null,
        vehicle_reg: formData.registrationPlate.replace(/\s+/g, '').toUpperCase() || null,
        mileage: formData.mileage || null,
        vehicle_make: formData.vehicleMake || null,
        vehicle_model: formData.vehicleModel || null,
        vehicle_year: formData.vehicleYear || null,
        vehicle_type: formData.vehicleType || 'standard',
        plan_name: formData.planName,
        contact_notes: formData.notes.trim() || null,
        contact_status: 'not_contacted',
        step_abandoned: 2,
        cart_metadata: {
          source: 'manual_admin_entry',
          created_by: 'admin',
          created_at: new Date().toISOString()
        }
      });

      if (error) throw error;

      toast.success('Incomplete customer added successfully');
      resetForm();
      setIsOpen(false);
      onCustomerAdded();
    } catch (error) {
      console.error('Error adding incomplete customer:', error);
      toast.error('Failed to add incomplete customer');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button className="flex items-center gap-2 bg-orange-600 hover:bg-orange-700">
          <Plus className="h-4 w-4" />
          Add Customer
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Car className="h-5 w-5" />
            Add Incomplete Customer
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* Vehicle Lookup Section */}
          <div className="p-4 bg-gray-50 rounded-lg space-y-3">
            <Label className="text-sm font-semibold text-gray-700">Vehicle Lookup</Label>
            <div className="flex gap-2">
              <Input
                placeholder="Enter registration plate"
                value={formData.registrationPlate}
                onChange={(e) => setFormData(prev => ({ 
                  ...prev, 
                  registrationPlate: e.target.value.toUpperCase() 
                }))}
                className="flex-1 uppercase"
              />
              <Button 
                type="button" 
                variant="outline" 
                onClick={handleVehicleLookup}
                disabled={isLookingUp}
              >
                {isLookingUp ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
              </Button>
            </div>

            {formData.vehicleMake && (
              <div className="text-sm text-gray-600 bg-white p-2 rounded border">
                <strong>Vehicle:</strong> {formData.vehicleYear} {formData.vehicleMake} {formData.vehicleModel}
              </div>
            )}
            
            {/* Mileage Input + Slider */}
            <div className="space-y-2">
              <Label className="text-sm text-gray-600">Mileage</Label>
              <Input
                placeholder="Enter mileage (e.g. 32,000)"
                value={formData.mileage}
                onChange={handleMileageInputChange}
                className="w-full"
              />
              <MileageSlider
                value={sliderMileage}
                onChange={handleSliderChange}
                min={0}
                max={150000}
              />
            </div>

            {/* Eligibility Error */}
            {eligibilityError && (
              <div className="text-sm text-red-600 bg-red-50 p-2 rounded border border-red-200">
                ⚠️ {eligibilityError}
              </div>
            )}
          </div>

          {/* Customer Details */}
          <div className="space-y-3">
            <div>
              <Label htmlFor="fullName">Full Name</Label>
              <Input
                id="fullName"
                placeholder="Customer name"
                value={formData.fullName}
                onChange={(e) => setFormData(prev => ({ ...prev, fullName: e.target.value }))}
              />
            </div>

            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="customer@email.com"
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
              />
            </div>

            <div>
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                placeholder="07XXXXXXXXX"
                value={formData.phone}
                onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
              />
            </div>

            <div>
              <Label htmlFor="planName">Plan Interest</Label>
              <Select 
                value={formData.planName} 
                onValueChange={(value) => setFormData(prev => ({ ...prev, planName: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Platinum">Platinum</SelectItem>
                  <SelectItem value="Gold">Gold</SelectItem>
                  <SelectItem value="Basic">Basic</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                placeholder="Add notes about the conversation..."
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                rows={3}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSubmit} 
              disabled={isLoading}
              className="bg-green-600 hover:bg-green-700"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Add Customer'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
