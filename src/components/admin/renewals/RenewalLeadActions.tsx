import { Button } from '@/components/ui/button';
import { ChevronDown, FileText, NotebookPen } from 'lucide-react';
import { ZoiperDialButton } from '@/components/admin/leads/ZoiperDialButton';
import { EmailActionsButton } from '@/components/admin/leads/EmailActionsButton';
import { RemindMePopover } from '@/components/admin/leads/RemindMePopover';

interface Props {
  leadId: string;
  phone: string;
  email: string;
  noteCount: number;
  expanded: boolean;
  onToggleNotes: () => void;
  onQuote?: () => void;
}

export function RenewalLeadActions({ leadId, phone, email, noteCount, expanded, onToggleNotes, onQuote }: Props) {
  return (
    <div className="flex items-center gap-1 flex-wrap">
      <Button variant={expanded ? 'default' : 'outline'} size="icon" className="h-9 w-9" onClick={onToggleNotes} aria-label={expanded ? 'Close renewal notes' : 'Open renewal notes'} title={expanded ? 'Close' : 'Click to open'}>
        <ChevronDown className={`h-5 w-5 transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </Button>
      {phone && <ZoiperDialButton phone={phone} leadId={leadId} leadType="sales_lead" />}
      <Button variant="outline" size="sm" className="h-7 px-2 gap-1" onClick={onToggleNotes} aria-label="Notes and quick update" title="Open full notes">
        <NotebookPen className="h-3.5 w-3.5" />
        <span className="text-[11px] tabular-nums">{noteCount || 'Notes'}</span>
      </Button>
      {email && <EmailActionsButton email={email} />}
      <RemindMePopover leadId={leadId} compact />
      {onQuote && <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={onQuote} title="Send renewal quote"><FileText className="h-3 w-3 mr-1" />Quote</Button>}
    </div>
  );
}