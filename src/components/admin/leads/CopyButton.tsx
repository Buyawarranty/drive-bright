import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Check, Copy, Mail, Phone } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface CopyButtonProps {
  value: string;
  type: 'email' | 'phone';
  className?: string;
}

export const CopyButton: React.FC<CopyButtonProps> = ({ value, type, className }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      
      // Show toast with appropriate message
      toast.success(
        type === 'email' 
          ? 'Email copied to clipboard' 
          : 'Phone number copied to clipboard',
        { duration: 1500 }
      );
      
      // Reset after delay
      setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch (error) {
      toast.error('Failed to copy');
    }
  };

  const Icon = type === 'email' ? Mail : Phone;
  const label = type === 'email' ? 'Copy email address' : 'Copy phone number';

  return (
    <TooltipProvider>
      <Tooltip delayDuration={100}>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "h-7 w-7 transition-all duration-150",
              type === 'email' 
                ? "text-blue-600 hover:text-blue-700 hover:bg-blue-50" 
                : "text-green-600 hover:text-green-700 hover:bg-green-50",
              copied && "scale-110",
              className
            )}
            onClick={handleCopy}
            aria-label={label}
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 animate-scale-in" />
            ) : (
              <Icon className="h-3.5 w-3.5" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          {copied ? 'Copied ✓' : label}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
