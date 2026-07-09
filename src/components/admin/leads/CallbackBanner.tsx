import React, { memo } from 'react';
import { Lead } from '@/hooks/useLeads';
import { Phone, User, X, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface CallbackBannerProps {
  leads: Lead[];
  className?: string;
  onDismiss?: () => void;
}

const formatUKPhone = (phone: string | null | undefined): string => {
  if (!phone) return '';
  const cleaned = phone.replace(/\s/g, '');
  if (cleaned.startsWith('07') && cleaned.length === 11) {
    return `${cleaned.slice(0, 5)} ${cleaned.slice(5, 8)} ${cleaned.slice(8)}`;
  }
  if (cleaned.startsWith('+44') && cleaned.length >= 12) {
    const withoutCode = cleaned.slice(3);
    return `+44 ${withoutCode.slice(0, 4)} ${withoutCode.slice(4, 7)} ${withoutCode.slice(7)}`;
  }
  return phone;
};

const CallbackCard = memo<{ lead: Lead }>(({ lead }) => {
  const name = [lead.first_name, lead.last_name].filter(Boolean).join(' ') || lead.email || 'Unknown';
  const phone = lead.phone || '';
  const formatted = formatUKPhone(phone);
  const vehicle = [lead.vehicle_make, lead.vehicle_model].filter(Boolean).join(' ');
  const reg = lead.vehicle_reg || '';

  return (
    <div className="flex-shrink-0 w-[260px] p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold truncate flex items-center gap-1.5">
            <User className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
            {name}
          </p>
          {(vehicle || reg) && (
            <p className="text-xs text-muted-foreground truncate mt-0.5">
              {vehicle} {reg && <span className="font-mono uppercase">{reg}</span>}
            </p>
          )}
        </div>
        <Badge variant="secondary" className="text-[10px] h-5 flex-shrink-0">CB</Badge>
      </div>
      {phone ? (
        <a
          href={`tel:${phone}`}
          className={cn(
            "inline-flex items-center gap-1.5 text-sm font-bold text-emerald-600 hover:text-emerald-700",
            "underline underline-offset-2 decoration-current select-text"
          )}
        >
          <Phone className="h-3.5 w-3.5 flex-shrink-0" />
          {formatted || phone}
        </a>
      ) : (
        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
          <AlertCircle className="h-3.5 w-3.5" />
          No number on record
        </p>
      )}
    </div>
  );
});
CallbackCard.displayName = 'CallbackCard';

export const CallbackBanner: React.FC<CallbackBannerProps> = ({ leads, className, onDismiss }) => {
  const callbacks = React.useMemo(() => leads.filter((l) => l.is_callback), [leads]);

  if (callbacks.length === 0) return null;

  return (
    <div className={cn("rounded-lg border-2 border-amber-200 bg-amber-50/60 dark:bg-amber-950/20 p-3", className)}>
      <div className="flex items-center justify-between gap-3 mb-2">
        <div className="flex items-center gap-2">
          <Phone className="h-4 w-4 text-amber-600" />
          <h3 className="text-sm font-semibold text-amber-900 dark:text-amber-100">
            Callback requests
          </h3>
          <Badge variant="secondary" className="text-[10px] h-5 tabular-nums">
            {callbacks.length}
          </Badge>
        </div>
        {onDismiss && (
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onDismiss}>
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
      <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-thin">
        {callbacks.map((lead) => (
          <CallbackCard key={lead.id} lead={lead} />
        ))}
      </div>
    </div>
  );
};
