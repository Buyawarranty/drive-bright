import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface CopyablePromoCodeProps {
  code: string;
  className?: string;
  label?: string;
}

/**
 * Renders a promo/discount code as a clickable chip that copies the code
 * to the clipboard. The code text itself stays selectable for manual copy.
 */
export const CopyablePromoCode: React.FC<CopyablePromoCodeProps> = ({ code, className, label }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      // Fallback for browsers/contexts without clipboard permissions
      const el = document.createElement('textarea');
      el.value = code;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    }
    setCopied(true);
    toast.success(`Code "${code}" copied`);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={`Copy code ${code}`}
      title="Click to copy"
      className={cn(
        'inline-flex items-center gap-2 rounded-md border border-dashed border-current/40 bg-background/60 px-2 py-1 font-mono text-sm font-semibold tracking-wide transition-colors hover:bg-background',
        className
      )}
    >
      {label && <span className="font-sans font-medium">{label}</span>}
      <span className="select-all">{code}</span>
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
};

export default CopyablePromoCode;
