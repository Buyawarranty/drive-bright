import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { CheckCircle2, Clock, AlertTriangle, XCircle, Mail } from 'lucide-react';

interface Quote {
  delivery_status?: string | null;
  delivery_status_at?: string | null;
  delivery_error?: string | null;
  provider_message_id?: string | null;
  sent_at?: string | null;
}

const STATUS_MAP: Record<string, { label: string; className: string; Icon: any }> = {
  delivered: { label: 'Delivered', className: 'bg-green-100 text-green-800 border-green-300', Icon: CheckCircle2 },
  sent: { label: 'Sent', className: 'bg-blue-100 text-blue-800 border-blue-300', Icon: Mail },
  pending: { label: 'Pending', className: 'bg-slate-100 text-slate-700 border-slate-300', Icon: Clock },
  delayed: { label: 'Delayed', className: 'bg-amber-100 text-amber-800 border-amber-300', Icon: Clock },
  bounced: { label: 'Bounced', className: 'bg-red-100 text-red-800 border-red-300', Icon: XCircle },
  complained: { label: 'Complained', className: 'bg-red-100 text-red-800 border-red-300', Icon: AlertTriangle },
  failed: { label: 'Failed', className: 'bg-red-100 text-red-800 border-red-300', Icon: XCircle },
  opened: { label: 'Opened', className: 'bg-emerald-100 text-emerald-800 border-emerald-300', Icon: CheckCircle2 },
  clicked: { label: 'Clicked', className: 'bg-emerald-100 text-emerald-800 border-emerald-300', Icon: CheckCircle2 },
};

export function DeliveryStatusBadge({ quote }: { quote: Quote }) {
  const status = (quote.delivery_status || 'pending').toLowerCase();
  const cfg = STATUS_MAP[status] || STATUS_MAP.pending;
  const Icon = cfg.Icon;
  const when = quote.delivery_status_at || quote.sent_at;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="outline" className={`text-xs gap-1 ${cfg.className}`}>
            <Icon className="w-3 h-3" />
            {cfg.label}
          </Badge>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <div className="text-xs space-y-1">
            <div><span className="font-semibold">Status:</span> {cfg.label}</div>
            {when && (
              <div><span className="font-semibold">At:</span> {new Date(when).toLocaleString()}</div>
            )}
            {quote.provider_message_id && (
              <div className="break-all"><span className="font-semibold">ID:</span> {quote.provider_message_id}</div>
            )}
            {quote.delivery_error && (
              <div className="text-red-600"><span className="font-semibold">Error:</span> {quote.delivery_error}</div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
