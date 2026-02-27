import { useState } from 'react';
import { format } from 'date-fns';
import { Calendar, Clock, AlertCircle, Pencil, X, Check, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface InlineFutureActivationEditProps {
  customerId: string;
  policyId?: string;
  currentDate: string | null;
  scheduledFor: string | null;
  w2000Status: string | null;
  onUpdate: () => void;
}

export function InlineFutureActivationEdit({
  customerId,
  policyId,
  currentDate,
  scheduledFor,
  w2000Status,
  onUpdate
}: InlineFutureActivationEditProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(
    scheduledFor ? new Date(scheduledFor) : currentDate ? new Date(currentDate) : undefined
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  const activationDate = scheduledFor || currentDate;
  const isFutureActivation = activationDate && new Date(activationDate) > new Date();
  const isScheduled = w2000Status === 'scheduled' && scheduledFor;
  const daysUntil = activationDate 
    ? Math.ceil((new Date(activationDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) 
    : 0;

  const handleSave = async () => {
    if (!selectedDate) return;

    setIsSubmitting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const adminId = user?.id;

      const newDateStr = selectedDate.toISOString();
      const oldDateStr = activationDate ? format(new Date(activationDate), 'dd MMM yyyy') : 'Not set';
      const newDateFormatted = format(selectedDate, 'dd MMM yyyy');

      // Update customer_policies table
      if (policyId) {
        const { error: policyError } = await supabase
          .from('customer_policies')
          .update({
            policy_start_date: newDateStr,
            warranties_2000_scheduled_for: newDateStr,
            warranties_2000_status: 'scheduled'
          })
          .eq('id', policyId);

        if (policyError) throw policyError;
      }

      // Add an admin note
      await supabase.from('admin_notes').insert({
        customer_id: customerId,
        note: `📅 Future Activation date changed: ${oldDateStr} → ${newDateFormatted}`,
        created_by: adminId
      });

      toast.success('Future activation date updated');
      onUpdate();
      setIsOpen(false);
    } catch (error) {
      console.error('Error updating activation date:', error);
      toast.error('Failed to update activation date');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Show content based on whether there's a future activation
  if (isFutureActivation || isScheduled) {
    return (
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <div className="inline-flex items-center gap-1.5 bg-amber-100 border border-amber-300 rounded-full px-2.5 py-1 cursor-pointer hover:bg-amber-200 transition-colors group text-xs">
            <Clock className="h-3 w-3 text-amber-700" />
            <span className="font-semibold text-amber-800">Future</span>
            <span className="text-amber-700">{format(new Date(activationDate!), 'dd MMM yyyy')}</span>
            <Pencil className="h-2.5 w-2.5 text-amber-600 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <div className="p-3 border-b">
            <h4 className="font-semibold text-sm">Edit Activation Date</h4>
            <p className="text-xs text-gray-500 mt-1">Select a new future activation date</p>
          </div>
          <CalendarComponent
            mode="single"
            selected={selectedDate}
            onSelect={setSelectedDate}
            disabled={(date) => date < new Date()}
            initialFocus
          />
          <div className="p-3 border-t flex gap-2 justify-end">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setIsOpen(false)}
              disabled={isSubmitting}
            >
              <X className="h-3 w-3 mr-1" />
              Cancel
            </Button>
            <Button 
              size="sm" 
              onClick={handleSave}
              disabled={isSubmitting || !selectedDate}
            >
              <Check className="h-3 w-3 mr-1" />
              {isSubmitting ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    );
  }

  // No future activation - show add button
  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button 
          variant="ghost" 
          size="sm" 
          className="h-7 w-7 p-0 text-muted-foreground hover:text-amber-600 hover:bg-amber-50"
          title="Set warranty activation date"
        >
          <Calendar className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="p-3 border-b">
          <h4 className="font-semibold text-sm">Set Future Activation</h4>
          <p className="text-xs text-gray-500 mt-1">Schedule warranty to start on a future date</p>
        </div>
        <CalendarComponent
          mode="single"
          selected={selectedDate}
          onSelect={setSelectedDate}
          disabled={(date) => date < new Date()}
          initialFocus
        />
        <div className="p-3 border-t flex gap-2 justify-end">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setIsOpen(false)}
            disabled={isSubmitting}
          >
            <X className="h-3 w-3 mr-1" />
            Cancel
          </Button>
          <Button 
            size="sm" 
            onClick={handleSave}
            disabled={isSubmitting || !selectedDate}
          >
            <Check className="h-3 w-3 mr-1" />
            {isSubmitting ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
