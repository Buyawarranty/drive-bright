import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { toast } from 'sonner';
import { PoundSterling, Plus, X, CalendarIcon } from 'lucide-react';
import { format, isPast, isToday } from 'date-fns';
import { cn } from '@/lib/utils';

interface PaymentDueDatePickerProps {
  customerId: string;
  paymentDueDate?: string | null;
  onUpdate?: () => void;
}

export const PaymentDueDatePicker: React.FC<PaymentDueDatePickerProps> = ({
  customerId,
  paymentDueDate,
  onUpdate
}) => {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const dueDate = paymentDueDate ? new Date(paymentDueDate) : null;
  const isOverdue = dueDate && isPast(dueDate) && !isToday(dueDate);
  const isDueToday = dueDate && isToday(dueDate);

  const handleSelectDate = async (date: Date | undefined) => {
    if (!date) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('customers')
        .update({ payment_due_date: format(date, 'yyyy-MM-dd') } as any)
        .eq('id', customerId);

      if (error) throw error;
      toast.success(`Payment due date set to ${format(date, 'dd/MM/yyyy')}`);
      setOpen(false);
      onUpdate?.();
    } catch (error) {
      console.error('Error setting payment due date:', error);
      toast.error('Failed to set payment due date');
    } finally {
      setSaving(false);
    }
  };

  const handleClearDate = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setSaving(true);
    try {
      const { error } = await supabase
        .from('customers')
        .update({ payment_due_date: null } as any)
        .eq('id', customerId);

      if (error) throw error;
      toast.success('Payment due date cleared');
      onUpdate?.();
    } catch (error) {
      console.error('Error clearing payment due date:', error);
      toast.error('Failed to clear payment due date');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex items-center gap-1">
      {dueDate && (
        <Badge 
          variant="outline" 
          className={cn(
            "text-xs font-semibold flex items-center gap-1 whitespace-nowrap",
            isOverdue && "bg-red-50 text-red-700 border-red-300 animate-pulse",
            isDueToday && "bg-orange-50 text-orange-700 border-orange-300",
            !isOverdue && !isDueToday && "bg-amber-50 text-amber-700 border-amber-300"
          )}
        >
          <PoundSterling className="h-3 w-3" />
          Collect {format(dueDate, 'dd/MM')}
          <button 
            onClick={handleClearDate} 
            className="ml-0.5 hover:text-red-600 transition-colors"
            disabled={saving}
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      )}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5 rounded-full"
            title={dueDate ? "Change payment due date" : "Set payment collection date"}
          >
            {dueDate ? (
              <CalendarIcon className="h-3 w-3 text-amber-600" />
            ) : (
              <Plus className="h-3 w-3 text-muted-foreground" />
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <div className="p-2 border-b">
            <p className="text-xs font-medium text-muted-foreground">Set payment collection date</p>
          </div>
          <Calendar
            mode="single"
            selected={dueDate || undefined}
            onSelect={handleSelectDate}
            disabled={saving}
            className={cn("p-3 pointer-events-auto")}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
};
