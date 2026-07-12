import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Check, Copy, Mail, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface EmailActionsButtonProps {
  email: string;
  className?: string;
  /** Fires after any successful action (copy / open in Gmail) so callers can
   *  log the row activity ("Copied email address" / "Opened in Gmail"). */
  onAction?: (action: 'copy' | 'gmail') => void;
}

/**
 * Row-level email action for the leads tables (New Leads, Recontact, Renewals).
 * Small envelope icon; opens a compact menu with:
 *   - Copy email address
 *   - Open in Gmail (compose window prefilled to the lead)
 * Kept as a dropdown (not two separate icons) so the row action strip stays tight.
 */
export const EmailActionsButton: React.FC<EmailActionsButtonProps> = ({
  email,
  className,
  onAction,
}) => {
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(email);
      setCopied(true);
      onAction?.('copy');
      toast.success('Email copied to clipboard', { duration: 1500 });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy');
    } finally {
      setOpen(false);
    }
  };

  const handleGmail = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Gmail web compose deep-link — works for anyone signed in to Gmail.
    const url = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(email)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
    onAction?.('gmail');
    setOpen(false);
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            'h-7 w-7 transition-all duration-150 text-blue-600 hover:text-blue-700 hover:bg-blue-50',
            copied && 'scale-110',
            className,
          )}
          onClick={(e) => e.stopPropagation()}
          aria-label="Email actions"
          title={email}
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Mail className="h-3.5 w-3.5" />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-52 bg-popover z-50">
        <DropdownMenuItem onClick={handleCopy} className="text-xs cursor-pointer">
          <Copy className="h-3.5 w-3.5 mr-2" />
          Copy email address
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleGmail} className="text-xs cursor-pointer">
          <ExternalLink className="h-3.5 w-3.5 mr-2" />
          Open in Gmail
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
