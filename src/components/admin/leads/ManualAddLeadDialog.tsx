import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  UserPlus, Loader2, User, Mail, Phone, Car, Gauge, ChevronDown, ChevronUp, PhoneIncoming,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useMotMileage } from '@/hooks/useMotMileage';
import type { AdminUser } from '@/hooks/useLeads';
import { cn } from '@/lib/utils';

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

type SourceOption = 'phone' | 'website' | 'social_ad' | 'other';
const SOURCE_LABELS: Record<SourceOption, string> = {
  phone: 'Inbound call',
  website: 'Website',
  social_ad: 'Meta',
  other: 'Other',
};

// Big input styled like the step 2 form (icon prefix, large friendly field)
const BigInput = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement> & { icon?: React.ReactNode }
>(({ icon, className, ...props }, ref) => (
  <div className="relative">
    {icon && (
      <div className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted-foreground">
        {icon}
      </div>
    )}
    <Input
      ref={ref}
      className={cn(
        'h-12 rounded-xl border-gray-200 bg-[#F5F5F5] text-base',
        icon && 'pl-11',
        className,
      )}
      {...props}
    />
  </div>
));
BigInput.displayName = 'BigInput';

const FieldLabel: React.FC<React.LabelHTMLAttributes<HTMLLabelElement>> = ({ className, ...p }) => (
  <Label className={cn('text-[15px] font-bold text-foreground', className)} {...p} />
);

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
  const [source, setSource] = useState<SourceOption>('phone');
  const [expanded, setExpanded] = useState(false);

  const { motMileage, isLoading: motLoading } = useMotMileage(form.vehicle_reg || undefined);

  useEffect(() => {
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
    setSource('phone');
    setExpanded(false);
  };

  const applyMotMileage = () => {
    if (motMileage) update('mileage', String(motMileage));
  };

  const handleSubmit = async () => {
    const email = form.email.trim().toLowerCase();
    const phone = form.phone.trim();
    if (!form.vehicle_reg.trim()) {
      toast.error('Reg plate is required');
      return;
    }
    if (!email && !phone) {
      toast.error('Add an email or phone number');
      return;
    }
    if (!form.first_name.trim()) {
      toast.error('Add a first name');
      return;
    }
    if (!assignee) {
      toast.error('Assign the lead to someone');
      return;
    }
    setSubmitting(true);
    try {
      const nowIso = new Date().toISOString();
      const payload: any = {
        first_name: form.first_name.trim() || null,
        last_name: form.last_name.trim() || null,
        email: email || `no-email+${Date.now()}@buyawarranty.co.uk`,
        phone: phone || null,
        vehicle_reg: form.vehicle_reg.trim().toUpperCase(),
        vehicle_make: form.vehicle_make.trim() || null,
        vehicle_model: form.vehicle_model.trim() || null,
        vehicle_year: form.vehicle_year.trim() || null,
        mileage: form.mileage.trim() || null,
        notes: form.notes.trim() || null,
        lead_source: source,
        status: 'new',
        priority: 'medium',
        assigned_to: assignee,
        assigned_at: nowIso,
        last_activity_date: nowIso,
      };

      const { error } = await supabase.from('sales_leads').insert(payload);
      if (error) throw error;

      const assigneeName =
        salesUsers.find(u => u.id === assignee)?.first_name ||
        (assignee === currentAdminId ? 'you' : 'agent');
      toast.success(`Lead added and assigned to ${assigneeName}`);
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
          className="h-7 px-2.5 text-[11px] gap-1 rounded-md font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-sm whitespace-nowrap"
        >
          <UserPlus className="h-3 w-3" />
          + Add New Lead
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl p-0 gap-0 max-h-[92vh] overflow-hidden flex flex-col">
        <DialogHeader className="px-6 pt-6 pb-3 border-b">
          <DialogTitle className="text-xl">Add a new lead</DialogTitle>
          <DialogDescription>
            Same feel as the customer quote form — quick to fill in.
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 py-5 space-y-5 overflow-y-auto">
          {/* Reg plate first — matches step 2 vehicle context */}
          <div className="space-y-2">
            <FieldLabel>Reg plate</FieldLabel>
            <BigInput
              icon={<Car className="h-5 w-5" />}
              value={form.vehicle_reg}
              onChange={(e) => update('vehicle_reg', e.target.value.toUpperCase())}
              placeholder="e.g. AB12 CDE"
              className="uppercase font-mono tracking-wider"
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <FieldLabel>Your first name</FieldLabel>
            <BigInput
              icon={<User className="h-5 w-5" />}
              value={form.first_name}
              onChange={(e) => update('first_name', e.target.value)}
              placeholder="e.g. John"
            />
          </div>

          <div className="space-y-2">
            <FieldLabel>Your email address</FieldLabel>
            <BigInput
              icon={<Mail className="h-5 w-5" />}
              type="email"
              value={form.email}
              onChange={(e) => update('email', e.target.value)}
              placeholder="e.g. john@example.com"
            />
          </div>

          <div className="space-y-2">
            <FieldLabel>Your mobile number</FieldLabel>
            <BigInput
              icon={<Phone className="h-5 w-5" />}
              value={form.phone}
              onChange={(e) => update('phone', e.target.value)}
              placeholder="UK mobile number"
            />
          </div>

          <div className="space-y-2">
            <FieldLabel>Approximate mileage today</FieldLabel>
            {form.vehicle_reg && (
              <div className="rounded-lg bg-blue-50 border border-blue-100 px-3 py-2 text-sm text-blue-900 flex items-center justify-between gap-3">
                <span>
                  {motLoading
                    ? 'Checking MOT history…'
                    : motMileage
                      ? <>Last recorded MOT: <strong>{motMileage.toLocaleString()} miles</strong></>
                      : 'No MOT mileage found for this reg'}
                </span>
                {motMileage && (
                  <button
                    type="button"
                    onClick={applyMotMileage}
                    className="text-xs font-semibold text-blue-700 hover:text-blue-900 underline"
                  >
                    Use this
                  </button>
                )}
              </div>
            )}
            <BigInput
              icon={<Gauge className="h-5 w-5" />}
              value={form.mileage}
              onChange={(e) => update('mileage', e.target.value.replace(/[^\d]/g, ''))}
              placeholder="e.g. 45,000"
              inputMode="numeric"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <FieldLabel>Source</FieldLabel>
              <Select value={source} onValueChange={(v) => setSource(v as SourceOption)}>
                <SelectTrigger className="h-12 rounded-xl bg-[#F5F5F5] border-gray-200 text-base">
                  <div className="flex items-center gap-2">
                    <PhoneIncoming className="h-4 w-4 text-muted-foreground" />
                    <SelectValue />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(SOURCE_LABELS) as SourceOption[]).map(s => (
                    <SelectItem key={s} value={s}>{SOURCE_LABELS[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <FieldLabel>Assign to</FieldLabel>
              <Select
                value={assignee}
                onValueChange={setAssignee}
                disabled={!canAssignToOthers && !!currentAdminId}
              >
                <SelectTrigger className="h-12 rounded-xl bg-[#F5F5F5] border-gray-200 text-base">
                  <SelectValue placeholder="Select agent" />
                </SelectTrigger>
                <SelectContent>
                  {currentAdminId && <SelectItem value={currentAdminId}>Me</SelectItem>}
                  {canAssignToOthers && salesUsers
                    .filter(u => u.id !== currentAdminId)
                    .map(u => (
                      <SelectItem key={u.id} value={u.id}>{displayName(u)}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Expandable extras */}
          <button
            type="button"
            onClick={() => setExpanded(v => !v)}
            className="flex items-center gap-1.5 text-sm font-semibold text-blue-600 hover:text-blue-700"
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            {expanded ? 'Hide extra details' : 'Add more details (optional)'}
          </button>

          {expanded && (
            <div className="space-y-4 pt-1 border-t pt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <FieldLabel>Last name</FieldLabel>
                  <BigInput
                    value={form.last_name}
                    onChange={(e) => update('last_name', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <FieldLabel>Year</FieldLabel>
                  <BigInput
                    value={form.vehicle_year}
                    onChange={(e) => update('vehicle_year', e.target.value)}
                    placeholder="e.g. 2018"
                    inputMode="numeric"
                  />
                </div>
                <div className="space-y-2">
                  <FieldLabel>Make</FieldLabel>
                  <BigInput
                    value={form.vehicle_make}
                    onChange={(e) => update('vehicle_make', e.target.value)}
                    placeholder="e.g. Audi"
                  />
                </div>
                <div className="space-y-2">
                  <FieldLabel>Model</FieldLabel>
                  <BigInput
                    value={form.vehicle_model}
                    onChange={(e) => update('vehicle_model', e.target.value)}
                    placeholder="e.g. Q5"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <FieldLabel>Notes</FieldLabel>
                <Textarea
                  rows={3}
                  value={form.notes}
                  onChange={(e) => update('notes', e.target.value)}
                  placeholder="What did they say on the call?"
                  className="rounded-xl bg-[#F5F5F5] border-gray-200 text-base"
                />
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="px-6 py-4 border-t bg-white">
          <Button variant="outline" onClick={() => setOpen(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting}
            className="bg-blue-600 hover:bg-blue-700 h-11 px-6 font-semibold"
          >
            {submitting
              ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
              : <UserPlus className="h-4 w-4 mr-1.5" />}
            Add lead
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
