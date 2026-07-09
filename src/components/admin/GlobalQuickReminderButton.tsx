import React, { useState } from 'react';
import { Bell, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { addMinutes, addHours, format, setHours, setMinutes, startOfTomorrow } from 'date-fns';
import { requestNotificationPermission } from '@/lib/reminderAlerts';

const toLocalInput = (d: Date) => {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const GlobalQuickReminderButton: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState('');
  const [when, setWhen] = useState<string>(() => toLocalInput(addMinutes(new Date(), 15)));
  const [saving, setSaving] = useState(false);

  const applyPreset = (preset: '15m' | '1h' | 'today5' | 'tomorrow9') => {
    let d = new Date();
    if (preset === '15m') d = addMinutes(d, 15);
    else if (preset === '1h') d = addHours(d, 1);
    else if (preset === 'today5') d = setMinutes(setHours(new Date(), 17), 0);
    else if (preset === 'tomorrow9') d = setMinutes(setHours(startOfTomorrow(), 9), 0);
    setWhen(toLocalInput(d));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        toast.error('Not signed in');
        return;
      }
      const { data: adminUser } = await supabase
        .from('admin_users')
        .select('id')
        .eq('user_id', userData.user.id)
        .maybeSingle();
      if (!adminUser?.id) {
        toast.error('Admin profile not found');
        return;
      }
      const dt = new Date(when);
      if (isNaN(dt.getTime())) {
        toast.error('Pick a valid time');
        return;
      }
      // Personal reminders use a per-user "personal_<adminId>" lead_id so
      // they never collide with lead-linked reminders.
      const { error } = await (supabase.from('lead_reminders' as any).insert({
        lead_id: `personal_${adminUser.id}`,
        user_id: adminUser.id,
        reminder_time: dt.toISOString(),
        label: label.trim() || 'Personal reminder',
        status: 'pending',
      }) as any);
      if (error) throw error;
      await requestNotificationPermission();
      toast.success(`Reminder set for ${format(dt, 'MMM d, h:mm a')}`);
      setOpen(false);
      setLabel('');
      setWhen(toLocalInput(addMinutes(new Date(), 15)));
    } catch (err: any) {
      console.error('Quick reminder save failed:', err);
      toast.error('Could not save reminder');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-800 px-2 sm:px-3"
          title="Quick reminder"
        >
          <Bell className="h-4 w-4 sm:mr-1" />
          <span className="hidden sm:inline text-xs font-medium">Remind me</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-amber-600" /> Quick reminder
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label htmlFor="reminder-label" className="text-sm">
              What's it about?
            </Label>
            <Input
              id="reminder-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Call John back / Send quote / ..."
              autoFocus
            />
          </div>
          <div>
            <Label className="text-sm">When?</Label>
            <div className="flex flex-wrap gap-1 mt-1 mb-2">
              <button
                type="button"
                onClick={() => applyPreset('15m')}
                className="text-xs px-2 py-1 rounded border bg-white hover:bg-amber-50"
              >
                +15 min
              </button>
              <button
                type="button"
                onClick={() => applyPreset('1h')}
                className="text-xs px-2 py-1 rounded border bg-white hover:bg-amber-50"
              >
                +1 hour
              </button>
              <button
                type="button"
                onClick={() => applyPreset('today5')}
                className="text-xs px-2 py-1 rounded border bg-white hover:bg-amber-50"
              >
                Today 5pm
              </button>
              <button
                type="button"
                onClick={() => applyPreset('tomorrow9')}
                className="text-xs px-2 py-1 rounded border bg-white hover:bg-amber-50"
              >
                Tomorrow 9am
              </button>
            </div>
            <Input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
          </div>
          <p className="text-xs text-muted-foreground">
            You'll get a desktop notification and a chime when it's due — even if you're on a different tab.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving} className="bg-amber-600 hover:bg-amber-700">
            <Plus className="h-4 w-4 mr-1" /> Set reminder
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default GlobalQuickReminderButton;
