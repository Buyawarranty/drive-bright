import React from 'react';
import { Copy, Check } from 'lucide-react';

interface Props {
  /** Plain text placed on the clipboard. */
  text: string;
  /** Accessible label, e.g. "Copy stuck checkout alert". */
  label: string;
  /** Optional visible caption next to the icon. */
  caption?: string;
  /** Extra classes for the button. */
  className?: string;
}

/**
 * Small copy button for Live Alerts pop-ups. Copies the whole alert as plain
 * text (name, reg, plan, price, phone — not just the number) so it can be
 * pasted straight into WhatsApp or any other message to the sales team.
 */
export const CopyAlertButton: React.FC<Props> = ({ text, label, caption, className }) => {
  const [copied, setCopied] = React.useState(false);

  const copy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Fallback for browsers without clipboard permission.
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); } catch { /* ignore */ }
      ta.remove();
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      type="button"
      onClick={copy}
      title={label}
      aria-label={label}
      className={
        className ??
        'inline-flex items-center gap-1 rounded border border-gray-300 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-gray-700 hover:bg-gray-50'
      }
    >
      {copied ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3" />}
      {caption ? (copied ? 'Copied' : caption) : null}
    </button>
  );
};

export default CopyAlertButton;
