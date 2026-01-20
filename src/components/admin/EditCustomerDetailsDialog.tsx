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
import { Loader2, Save, Mail, Phone, User } from 'lucide-react';
import { z } from 'zod';

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
    }
  }, [open, currentEmail, currentPhone, currentFirstName, currentLastName, currentName]);

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
      // Update customers table
      const { error: customerError } = await supabase
        .from('customers')
        .update({
          email: email.toLowerCase().trim(),
          phone: phone.trim() || null,
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          name: fullName,
          updated_at: new Date().toISOString(),
        })
        .eq('id', customerId);

      if (customerError) throw customerError;

      // Also update customer_policies table with the new email and name
      const { error: policyError } = await supabase
        .from('customer_policies')
        .update({
          email: email.toLowerCase().trim(),
          customer_full_name: fullName,
          updated_at: new Date().toISOString(),
        })
        .eq('customer_id', customerId);

      if (policyError) {
        console.error('Error updating policies:', policyError);
        // Don't fail the whole operation for policy update
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
      <DialogContent className="sm:max-w-md">
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
