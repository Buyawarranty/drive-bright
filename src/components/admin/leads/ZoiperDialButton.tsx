import React from 'react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Phone } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { dialWithZoiper, normalizeDialNumber, type DialWithZoiperOptions } from '@/utils/zoiperDial';

interface ZoiperDialButtonProps extends DialWithZoiperOptions {
  phone: string;
  className?: string;
  /** Called after a successful dial so the parent can add a note/activity entry. */
  onDialed?: (number: string) => void;
}

export const ZoiperDialButton: React.FC<ZoiperDialButtonProps> = ({
  phone,
  className,
  onDialed,
  ...opts
}) => {
  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!phone) {
      toast.error('No phone number to dial');
      return;
    }
    const number = normalizeDialNumber(phone);
    dialWithZoiper(phone, opts);
    // Copy to clipboard as a safety net in case Zoiper isn't installed / registered.
    let copied = false;
    try { await navigator.clipboard.writeText(number); copied = true; } catch { /* noop */ }
    toast.success(`Dialling ${number} via Zoiper`, {
      duration: 3500,
      description: copied
        ? "If Zoiper didn't open, the number is on your clipboard — paste it into Zoiper."
        : "If Zoiper didn't open, check it's running and set as the callto:/tel: handler.",
    });
    onDialed?.(number);
  };

  return (
    <TooltipProvider>
      <Tooltip delayDuration={100}>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              'h-7 w-7 text-green-600 hover:text-green-700 hover:bg-green-50 transition-all duration-150',
              className,
            )}
            onClick={handleClick}
            aria-label="Dial via Zoiper"
          >
            <Phone className="h-3.5 w-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          Dial via Zoiper
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default ZoiperDialButton;
