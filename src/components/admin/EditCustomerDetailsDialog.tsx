import React, { useState, useEffect } from 'react';
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
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Save, Mail, Phone, User, MapPin } from 'lucide-react';
import { z } from 'zod';
import { CustomerLoginActivity } from './CustomerLoginActivity';
import { logLoginAttempt } from '@/lib/loginActivityLogger';
import { AddressAutocomplete, AddressData } from '@/components/ui/address-autocomplete';


const customerDetailsSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  phone: z.string().max(20, 'Phone number too long').optional(),
  firstName: z.string().min(1, 'First name is required').max(50, 'First name too long'),
  lastName: z.string().min(1, 'Surname is required').max(50, 'Surname too long'),
});

interface EditCustomerDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId: string;
  currentEmail: string;
  currentPhone?: string | null;
  currentFirstName?: string | null;
  currentLastName?: string | null;
  currentName?: string | null;
  onSaved?: () => void;
}

export const EditCustomerDetailsDialog: React.FC<EditCustomerDetailsDialogProps> = ({
  open,
  onOpenChange,
  customerId,
  currentEmail,
  currentPhone,
  currentFirstName,
  currentLastName,
  currentName,
  onSaved,
}) => {
  // Parse existing name into first/last if first_name/last_name not provided
  const parseNameParts = () => {
    if (currentFirstName || currentLastName) {
      return { first: currentFirstName || '', last: currentLastName || '' };
    }
    // Fallback: split the combined name
    const nameParts = (currentName || '').trim().split(' ');
    const first = nameParts[0] || '';
    const last = nameParts.slice(1).join(' ') || '';
    return { first, last };
  };

  const [email, setEmail] = useState(currentEmail);
  const [phone, setPhone] = useState(currentPhone || '');
  const [firstName, setFirstName] = useState(parseNameParts().first);
  const [lastName, setLastName] = useState(parseNameParts().last);
  const [flatNumber, setFlatNumber] = useState('');
  const [buildingName, setBuildingName] = useState('');
  const [buildingNumber, setBuildingNumber] = useState('');
  const [street, setStreet] = useState('');
  const [town, setTown] = useState('');
  const [county, setCounty] = useState('');
  const [postcode, setPostcode] = useState('');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      setEmail(currentEmail);
      setPhone(currentPhone || '');
      const { first, last } = parseNameParts();
      setFirstName(first);
      setLastName(last);
      setErrors({});

      // Address isn't passed in as a prop — load the current values from the record
      (async () => {
        const { data } = await supabase
          .from('customers')
          .select('flat_number, building_name, building_number, street, town, county, postcode')
          .eq('id', customerId)
          .maybeSingle();
        setFlatNumber(data?.flat_number || '');
        setBuildingName(data?.building_name || '');
        setBuildingNumber(data?.building_number || '');
        setStreet(data?.street || '');
        setTown(data?.town || '');
        setCounty(data?.county || '');
        setPostcode(data?.postcode || '');
      })();
    }
  }, [open, customerId, currentEmail, currentPhone, currentFirstName, currentLastName, currentName]);


  const handleSave = async () => {
    // Validate
    const result = customerDetailsSchema.safeParse({ email, phone, firstName, lastName });
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach(err => {
        if (err.path[0]) {
          fieldErrors[err.path[0] as string] = err.message;
        }
      });
      setErrors(fieldErrors);
      return;
    }

    const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();

    setSaving(true);
    try {
      const addressPayload = {
        flat_number: flatNumber.trim() || null,
        building_name: buildingName.trim() || null,
        building_number: buildingNumber.trim() || null,
        street: street.trim() || null,
        town: town.trim() || null,
        county: county.trim() || null,
        postcode: postcode.trim().toUpperCase() || null,
      };

      // Update customers table
      const { data: updatedRows, error: customerError } = await supabase
        .from('customers')
        .update({
          email: email.toLowerCase().trim(),
          phone: phone.trim() || null,
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          name: fullName,
          ...addressPayload,
          updated_at: new Date().toISOString(),
        })
        .eq('id', customerId)
        .select('id');

      if (customerError) throw customerError;

      // A permissions problem returns no error but updates zero rows — never
      // report success in that case.
      if (!updatedRows || updatedRows.length === 0) {
        throw new Error(
          "Nothing was saved — your account doesn't have permission to edit this customer. Ask a manager to check your staff account is active."
        );
      }


      // Also update customer_policies table with the new email, name and address
      const { error: policyError } = await supabase
        .from('customer_policies')
        .update({
          email: email.toLowerCase().trim(),
          customer_full_name: fullName,
          address: {
            flat_number: addressPayload.flat_number || '',
            building_name: addressPayload.building_name || '',
            building_number: addressPayload.building_number || '',
            street: addressPayload.street || '',
            town: addressPayload.town || '',
            county: addressPayload.county || '',
            postcode: addressPayload.postcode || '',
          },
          updated_at: new Date().toISOString(),
        })
        .eq('customer_id', customerId);


      if (policyError) {
        console.error('Error updating policies:', policyError);
        // Don't fail the whole operation for policy update
      }

      // Log this admin edit into the login-activity timeline
      const changes: Record<string, { from: string; to: string }> = {};
      if (currentEmail !== email.toLowerCase().trim())
        changes.email = { from: currentEmail, to: email.toLowerCase().trim() };
      if ((currentPhone || '') !== phone.trim())
        changes.phone = { from: currentPhone || '', to: phone.trim() };
      const oldFull = `${currentFirstName || ''} ${currentLastName || ''}`.trim() || (currentName || '');
      if (oldFull !== fullName) changes.name = { from: oldFull, to: fullName };
      if (Object.keys(changes).length > 0) {
        logLoginAttempt({
          email: email.toLowerCase().trim(),
          event_type: 'admin_details_edited',
          success: true,
          customer_id: customerId,
          metadata: { changes },
        });
      }

      toast.success('Customer details updated successfully');
      onSaved?.();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error updating customer:', error);
      toast.error(error.message || 'Failed to update customer details');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Edit Customer Details
          </DialogTitle>
          <DialogDescription>
            Update the customer's contact information. Changes will be saved to their account.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-first-name" className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                First Name
              </Label>
              <Input
                id="edit-first-name"
                value={firstName}
                onChange={(e) => {
                  setFirstName(e.target.value);
                  setErrors(prev => ({ ...prev, firstName: '' }));
                }}
                placeholder="John"
              />
              {errors.firstName && <p className="text-sm text-red-500">{errors.firstName}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-last-name" className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                Surname
              </Label>
              <Input
                id="edit-last-name"
                value={lastName}
                onChange={(e) => {
                  setLastName(e.target.value);
                  setErrors(prev => ({ ...prev, lastName: '' }));
                }}
                placeholder="Smith"
              />
              {errors.lastName && <p className="text-sm text-red-500">{errors.lastName}</p>}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-email" className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              Email Address
            </Label>
            <Input
              id="edit-email"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setErrors(prev => ({ ...prev, email: '' }));
              }}
              placeholder="customer@example.com"
            />
            {errors.email && <p className="text-sm text-red-500">{errors.email}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-phone" className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-muted-foreground" />
              Phone Number
            </Label>
            <Input
              id="edit-phone"
              type="tel"
              value={phone}
              onChange={(e) => {
                setPhone(e.target.value);
                setErrors(prev => ({ ...prev, phone: '' }));
              }}
              placeholder="07123 456789"
            />
            {errors.phone && <p className="text-sm text-red-500">{errors.phone}</p>}
          </div>

          <div className="space-y-3 rounded-lg border p-3">
            <Label className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              Address
            </Label>
            <AddressAutocomplete
              placeholder="Start typing postcode or address..."
              onAddressSelect={(address: AddressData) => {
                if (address.building_number) setBuildingNumber(address.building_number);
                if (address.building_name) setBuildingName(address.building_name);
                if (address.line_1) setStreet(address.line_1);
                if (address.town) setTown(address.town);
                if (address.county) setCounty(address.county);
                if (address.postcode) setPostcode(address.postcode.toUpperCase());
              }}
            />
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="edit-flat" className="text-xs">Flat / apartment</Label>
                <Input id="edit-flat" value={flatNumber} onChange={(e) => setFlatNumber(e.target.value)} placeholder="Flat 2" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="edit-building-name" className="text-xs">Building name</Label>
                <Input id="edit-building-name" value={buildingName} onChange={(e) => setBuildingName(e.target.value)} placeholder="Rose Court" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="edit-building-number" className="text-xs">House number</Label>
                <Input id="edit-building-number" value={buildingNumber} onChange={(e) => setBuildingNumber(e.target.value)} placeholder="42" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="edit-street" className="text-xs">Street</Label>
                <Input id="edit-street" value={street} onChange={(e) => setStreet(e.target.value)} placeholder="High Street" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="edit-town" className="text-xs">Town / city</Label>
                <Input id="edit-town" value={town} onChange={(e) => setTown(e.target.value)} placeholder="Manchester" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="edit-county" className="text-xs">County</Label>
                <Input id="edit-county" value={county} onChange={(e) => setCounty(e.target.value)} placeholder="Greater Manchester" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="edit-postcode" className="text-xs">Postcode</Label>
                <Input id="edit-postcode" value={postcode} onChange={(e) => setPostcode(e.target.value.toUpperCase())} placeholder="M1 1AA" />
              </div>
            </div>
          </div>



          <div className="pt-2">
            <CustomerLoginActivity email={currentEmail} customerId={customerId} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                Save Changes
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EditCustomerDetailsDialog;
