import React, { useEffect, useState } from 'react';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { addSystemNote } from '@/utils/leadSystemNotes';
import type { Lead } from '@/hooks/useLeads';

interface EditLeadInfoDialogProps {
  lead: Lead;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
}

/**
 * Edit a lead's contact / vehicle details. Available to EVERY signed-in staff
 * user on the New Leads section — no role gate (RLS already limits writes to
 * active admin_users).
 */
export const EditLeadInfoDialog: React.FC<EditLeadInfoDialogProps> = ({
  lead, open, onOpenChange, onSaved,
}) => {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    vehicle_reg: '',
    vehicle_make: '',
    vehicle_model: '',
    vehicle_year: '',
    mileage: '',
  });

  useEffect(() => {
    if (!open) return;
    setForm({
      first_name: lead.first_name || '',
      last_name: lead.last_name || '',
      email: lead.email || '',
      phone: lead.phone || '',
      vehicle_reg: lead.vehicle_reg || '',
      vehicle_make: lead.vehicle_make || '',
      vehicle_model: lead.vehicle_model || '',
      vehicle_year: lead.vehicle_year || '',
      mileage: lead.mileage || '',
    });
  }, [open, lead]);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(prev => ({ ...prev, [k]: e.target.value }));

  const handleSave = async () => {
    const email = form.email.trim();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error('Please enter a valid email address');
      return;
    }
    setSaving(true);
    try {
      const first = form.first_name.trim();
      const last = form.last_name.trim();
      const payload: Record<string, string | null> = {
        first_name: first || null,
        last_name: last || null,
        full_name: [first, last].filter(Boolean).join(' ') || null,
        email: email || null,
        phone: form.phone.trim() || null,
        vehicle_reg: form.vehicle_reg.trim().toUpperCase() || null,
        vehicle_make: form.vehicle_make.trim() || null,
        vehicle_model: form.vehicle_model.trim() || null,
        vehicle_year: form.vehicle_year.trim() || null,
        mileage: form.mileage.trim() || null,
      };

      const { error } = await supabase.from('sales_leads').update(payload).eq('id', lead.id);
      if (error) throw error;

      const changed = Object.entries(payload)
        .filter(([k, v]) => (((lead as any)[k] ?? null) || null) !== (v || null) && k !== 'full_name')
        .map(([k, v]) => `${k.replace(/_/g, ' ')} → ${v || '—'}`);
      if (changed.length) {
        await addSystemNote(lead.id, `✏️ Lead info updated: ${changed.join(', ')}`);
      }

      toast.success('Lead details updated');
      onOpenChange(false);
      onSaved?.();
    } catch (err: any) {
      console.error('Edit lead info failed', err);
      toast.error(err?.message || 'Could not save changes');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit lead details</DialogTitle>
          <DialogDescription>
            Correct the customer's contact or vehicle information. Changes are logged in the lead notes.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 py-1">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="el-first">First name</Label>
              <Input id="el-first" value={form.first_name} onChange={set('first_name')} maxLength={100} />
            </div>
            <div>
              <Label htmlFor="el-last">Last name</Label>
              <Input id="el-last" value={form.last_name} onChange={set('last_name')} maxLength={100} />
            </div>
          </div>
          <div>
            <Label htmlFor="el-email">Email</Label>
            <Input id="el-email" type="email" value={form.email} onChange={set('email')} maxLength={255} />
          </div>
          <div>
            <Label htmlFor="el-phone">Phone</Label>
            <Input id="el-phone" value={form.phone} onChange={set('phone')} maxLength={40} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="el-reg">Registration</Label>
              <Input id="el-reg" value={form.vehicle_reg} onChange={set('vehicle_reg')} className="uppercase font-mono" maxLength={12} />
            </div>
            <div>
              <Label htmlFor="el-mileage">Mileage</Label>
              <Input id="el-mileage" value={form.mileage} onChange={set('mileage')} maxLength={12} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label htmlFor="el-make">Make</Label>
              <Input id="el-make" value={form.vehicle_make} onChange={set('vehicle_make')} maxLength={60} />
            </div>
            <div>
              <Label htmlFor="el-model">Model</Label>
              <Input id="el-model" value={form.vehicle_model} onChange={set('vehicle_model')} maxLength={60} />
            </div>
            <div>
              <Label htmlFor="el-year">Year</Label>
              <Input id="el-year" value={form.vehicle_year} onChange={set('vehicle_year')} maxLength={4} />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (<><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving…</>) : 'Save changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EditLeadInfoDialog;
