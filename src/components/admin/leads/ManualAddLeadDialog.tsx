import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { UserPlus, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import type { AdminUser } from '@/hooks/useLeads';

interface ManualAddLeadDialogProps {
  salesUsers: AdminUser[];
  currentAdminId: string | null;
  canAssignToOthers: boolean;
  onCreated: () => void;
}

const initialState = {
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  vehicle_reg: '',
  vehicle_make: '',
  vehicle_model: '',
  vehicle_year: '',
  mileage: '',
  notes: '',
};

export const ManualAddLeadDialog: React.FC<ManualAddLeadDialogProps> = ({
  salesUsers,
  currentAdminId,
  canAssignToOthers,
  onCreated,
}) => {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState(initialState);
  const [assignee, setAssignee] = useState<string>(currentAdminId || '');

  React.useEffect(() => {
    if (open && currentAdminId && !assignee) setAssignee(currentAdminId);
  }, [open, currentAdminId, assignee]);

  const displayName = (u: AdminUser) => {
    const n = `${u.first_name || ''} ${u.last_name || ''}`.trim();
    return n || u.email;
  };

  const update = (k: keyof typeof form, v: string) => setForm(s => ({ ...s, [k]: v }));

  const reset = () => {
    setForm(initialState);
    setAssignee(currentAdminId || '');
  };

  const handleSubmit = async () => {
    const email = form.email.trim().toLowerCase();
    const phone = form.phone.trim();
    if (!email && !phone) {
      toast.error('Please provide at least an email or phone number');
      return;
    }
    if (!form.first_name.trim() && !form.last_name.trim()) {
      toast.error('Please provide a name');
      return;
    }
    setSubmitting(true);
    try {
      const payload: any = {
        first_name: form.first_name.trim() || null,
        last_name: form.last_name.trim() || null,
        email: email || `no-email+${Date.now()}@buyawarranty.co.uk`,
        phone: phone || null,
        vehicle_reg: form.vehicle_reg.trim().toUpperCase() || null,
        vehicle_make: form.vehicle_make.trim() || null,
        vehicle_model: form.vehicle_model.trim() || null,
        vehicle_year: form.vehicle_year.trim() || null,
        mileage: form.mileage.trim() || null,
        notes: form.notes.trim() || null,
        lead_source: 'phone',
        status: 'new',
        priority: 'medium',
        assigned_to: assignee || currentAdminId || null,
        assigned_at: (assignee || currentAdminId) ? new Date().toISOString() : null,
        last_activity_date: new Date().toISOString(),
      };

      const { error } = await supabase.from('sales_leads').insert(payload);
      if (error) throw error;

      toast.success('Lead added');
      reset();
      setOpen(false);
      onCreated();
    } catch (e: any) {
      console.error('[ManualAddLead] error', e);
      toast.error(e?.message || 'Failed to add lead');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          className="h-8 gap-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white"
        >
          <UserPlus className="h-3.5 w-3.5" />
          Add Lead
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add a new lead</DialogTitle>
          <DialogDescription>
            Capture a lead you spoke to on the phone and assign it.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3 py-2">
          <div className="space-y-1">
            <Label className="text-xs">First name</Label>
            <Input value={form.first_name} onChange={(e) => update('first_name', e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Last name</Label>
            <Input value={form.last_name} onChange={(e) => update('last_name', e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Phone</Label>
            <Input value={form.phone} onChange={(e) => update('phone', e.target.value)} placeholder="07…" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Email</Label>
            <Input type="email" value={form.email} onChange={(e) => update('email', e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Reg plate</Label>
            <Input value={form.vehicle_reg} onChange={(e) => update('vehicle_reg', e.target.value)} className="uppercase" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Mileage</Label>
            <Input value={form.mileage} onChange={(e) => update('mileage', e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Make</Label>
            <Input value={form.vehicle_make} onChange={(e) => update('vehicle_make', e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Model</Label>
            <Input value={form.vehicle_model} onChange={(e) => update('vehicle_model', e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Year</Label>
            <Input value={form.vehicle_year} onChange={(e) => update('vehicle_year', e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Assign to</Label>
            <Select
              value={assignee}
              onValueChange={setAssignee}
              disabled={!canAssignToOthers && !!currentAdminId}
            >
              <SelectTrigger><SelectValue placeholder="Select agent" /></SelectTrigger>
              <SelectContent>
                {currentAdminId && (
                  <SelectItem value={currentAdminId}>Me</SelectItem>
                )}
                {canAssignToOthers && salesUsers
                  .filter(u => u.id !== currentAdminId)
                  .map(u => (
                    <SelectItem key={u.id} value={u.id}>{displayName(u)}</SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2 space-y-1">
            <Label className="text-xs">Notes</Label>
            <Textarea rows={3} value={form.notes} onChange={(e) => update('notes', e.target.value)} placeholder="What did they say on the call?" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={submitting}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={submitting} className="bg-blue-600 hover:bg-blue-700">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <UserPlus className="h-4 w-4 mr-1.5" />}
            Add lead
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
