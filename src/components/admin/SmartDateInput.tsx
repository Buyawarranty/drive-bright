import React, { useState, useEffect } from 'react';
import { format, parse, isValid } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface SmartDateInputProps {
  value?: string | Date | null;
  onChange: (date: Date | null) => void;
  id?: string;
  placeholder?: string;
  className?: string;
}

/**
 * Date input that accepts manual typing (dd/MM/yyyy) and provides
 * a quick popover calendar. Designed for fast admin data entry.
 */
export const SmartDateInput: React.FC<SmartDateInputProps> = ({
  value,
  onChange,
  id,
  placeholder = 'dd/mm/yyyy',
  className,
}) => {
  const dateValue = value ? new Date(value) : null;
  const [text, setText] = useState<string>(
    dateValue && isValid(dateValue) ? format(dateValue, 'dd/MM/yyyy') : ''
  );
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const d = value ? new Date(value) : null;
    setText(d && isValid(d) ? format(d, 'dd/MM/yyyy') : '');
  }, [value]);

  const tryParse = (raw: string): Date | null => {
    const cleaned = raw.trim().replace(/[.\-\s]/g, '/');
    const formats = ['dd/MM/yyyy', 'd/M/yyyy', 'dd/MM/yy', 'd/M/yy', 'yyyy-MM-dd'];
    for (const fmt of formats) {
      const parsed = parse(cleaned, fmt, new Date());
      if (isValid(parsed)) return parsed;
    }
    return null;
  };

  const handleBlur = () => {
    if (!text) {
      onChange(null);
      return;
    }
    const parsed = tryParse(text);
    if (parsed) {
      onChange(parsed);
      setText(format(parsed, 'dd/MM/yyyy'));
    } else {
      // revert
      setText(dateValue && isValid(dateValue) ? format(dateValue, 'dd/MM/yyyy') : '');
    }
  };

  return (
    <div className={cn('flex items-center gap-1', className)}>
      <Input
        id={id}
        value={text}
        placeholder={placeholder}
        onChange={(e) => setText(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            (e.target as HTMLInputElement).blur();
          }
        }}
        className="flex-1"
      />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" size="icon" aria-label="Open calendar">
            <CalendarIcon className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <Calendar
            mode="single"
            selected={dateValue && isValid(dateValue) ? dateValue : undefined}
            onSelect={(d) => {
              if (d) {
                onChange(d);
                setText(format(d, 'dd/MM/yyyy'));
                setOpen(false);
              }
            }}
            captionLayout="dropdown-buttons"
            fromYear={2000}
            toYear={new Date().getFullYear() + 10}
            initialFocus
            className="p-3 pointer-events-auto"
          />
        </PopoverContent>
      </Popover>
    </div>
  );
};
