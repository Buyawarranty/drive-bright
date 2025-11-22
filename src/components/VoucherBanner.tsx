import React, { useState } from 'react';
import { Copy, Check, Tag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

interface VoucherBannerProps {
  placement?: 'homepage' | 'pricing';
  className?: string;
  animate?: boolean;
}

export const VoucherBanner: React.FC<VoucherBannerProps> = ({ 
  placement = 'homepage',
  className = '',
  animate = false
}) => {
  const [hasCopied, setHasCopied] = useState(false);
  const { toast } = useToast();
  
  const voucherCode = 'SAVE25NOW';
  
  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(voucherCode);
      setHasCopied(true);
      toast({
        title: "Copied!",
        description: "Voucher code copied to clipboard",
      });
      setTimeout(() => setHasCopied(false), 2000);
    } catch (err) {
      toast({
        title: "Copy failed",
        description: "Please copy the code manually",
        variant: "destructive"
      });
    }
  };

  // Compact minimal style with animation option
  return (
    <div className={`bg-gradient-to-r from-green-500 to-emerald-600 text-white px-2 py-1 rounded-lg shadow-sm max-w-fit ${animate ? 'animate-float' : ''} ${className}`}>
      <div className="flex items-center gap-1.5">
        <Tag className="h-2.5 w-2.5" />
        <span className="text-[10px] font-medium">£25 OFF</span>
        <Button
          onClick={copyToClipboard}
          variant="ghost"
          size="sm"
          className="h-4 w-4 p-0 text-white hover:bg-white/20"
        >
          {hasCopied ? <Check className="h-2.5 w-2.5" /> : <Copy className="h-2.5 w-2.5" />}
        </Button>
      </div>
    </div>
  );
};