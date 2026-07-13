import React, { useRef, useState } from 'react';
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

/**
 * Locks the button for CLICK_LOCK_MS after a click so double/triple taps
 * can't fire multiple Click2Dial requests. Belt-and-braces with the
 * module-level dedup in zoiperDial.ts — the button lock gives visual
 * feedback, the module guard catches every other callsite.
 */
const CLICK_LOCK_MS = 2500;

export const ZoiperDialButton: React.FC<ZoiperDialButtonProps> = ({
  phone,
  className,
  onDialed,
  ...opts
}) => {
  const [locked, setLocked] = useState(false);
  // Ref updates synchronously — React state does not — so we use both.
  const lockedAtRef = useRef(0);

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const now = Date.now();
    if (locked || (now - lockedAtRef.current) < CLICK_LOCK_MS) {
      // Double-click / re-entrant handler — swallow silently.
      return;
    }
    lockedAtRef.current = now;
    setLocked(true);
    window.setTimeout(() => setLocked(false), CLICK_LOCK_MS);

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
            disabled={locked}
            className={cn(
              'h-7 w-7 text-green-600 hover:text-green-700 hover:bg-green-50 transition-all duration-150',
              locked && 'opacity-60 cursor-not-allowed',
              className,
            )}
            onClick={handleClick}
            aria-label="Dial via Zoiper"
          >
            <Phone className="h-3.5 w-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          {locked ? 'Dialling…' : 'Dial via Zoiper'}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default ZoiperDialButton;
