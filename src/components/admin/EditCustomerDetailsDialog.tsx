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
  name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
});

interface EditCustomerDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId: string;
  currentEmail: string;
  currentPhone?: string | null;
  currentName?: string | null;
  onSaved?: () => void;
}

export const EditCustomerDetailsDialog: React.FC<EditCustomerDetailsDialogProps> = ({
  open,
  onOpenChange,
  customerId,
  currentEmail,
  currentPhone,
  currentName,
  onSaved,
}) => {
  const [email, setEmail] = useState(currentEmail);
  const [phone, setPhone] = useState(currentPhone || '');
  const [name, setName] = useState(currentName || '');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      setEmail(currentEmail);
      setPhone(currentPhone || '');
      setName(currentName || '');
      setErrors({});
    }
  }, [open, currentEmail, currentPhone, currentName]);

  const handleSave = async () => {
    // Validate
    const result = customerDetailsSchema.safeParse({ email, phone, name });
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

    setSaving(true);
    try {
      // Update customers table
      const { error: customerError } = await supabase
        .from('customers')
        .update({
          email: email.toLowerCase().trim(),
          phone: phone.trim() || null,
          name: name.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', customerId);

      if (customerError) throw customerError;

      // Also update customer_policies table with the new email
      const { error: policyError } = await supabase
        .from('customer_policies')
        .update({
          email: email.toLowerCase().trim(),
          customer_full_name: name.trim(),
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
          <div className="space-y-2">
            <Label htmlFor="edit-name" className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              Full Name
            </Label>
            <Input
              id="edit-name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setErrors(prev => ({ ...prev, name: '' }));
              }}
              placeholder="John Smith"
            />
            {errors.name && <p className="text-sm text-red-500">{errors.name}</p>}
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
