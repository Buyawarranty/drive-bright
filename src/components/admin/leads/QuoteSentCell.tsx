import React, { memo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { SentQuote } from '@/hooks/useLeadQuotes';
import { FileText, ExternalLink, Check, Clock, Send } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface QuoteSentCellProps {
  quotes: SentQuote[];
  leadEmail: string;
}

export const QuoteSentCell = memo<QuoteSentCellProps>(({ quotes, leadEmail }) => {
  const [open, setOpen] = useState(false);

  if (!quotes || quotes.length === 0) {
    return (
      <span className="text-muted-foreground text-xs">—</span>
    );
  }

  const latestQuote = quotes[0];
  const totalQuotes = quotes.length;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "h-7 px-2 text-xs font-medium gap-1",
            latestQuote.customer_purchased 
              ? "text-green-600 hover:text-green-700 hover:bg-green-50"
              : "text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50"
          )}
        >
          <FileText className="h-3 w-3" />
          <span>
            {totalQuotes > 1 ? `${totalQuotes} quotes` : 'View'}
          </span>
          {latestQuote.customer_purchased && (
            <Check className="h-3 w-3 text-green-600" />
          )}
        </Button>
      </DialogTrigger>
      
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5 text-indigo-600" />
            Quotes Sent to {leadEmail}
          </DialogTitle>
        </DialogHeader>
        
        <ScrollArea className="max-h-[400px]">
          <div className="space-y-3 pr-2">
            {quotes.map((quote, index) => (
              <div 
                key={quote.id} 
                className={cn(
                  "p-3 rounded-lg border",
                  index === 0 ? "bg-indigo-50 border-indigo-200" : "bg-muted/30 border-muted"
                )}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-medium">{quote.quote_reference}</span>
                      {index === 0 && (
                        <Badge variant="secondary" className="text-[10px]">Latest</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {quote.vehicle_reg} • {quote.plan_name}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-sm">
                      £{quote.total_price?.toFixed(2)}
                    </p>
                    {quote.monthly_price && (
                      <p className="text-[10px] text-muted-foreground">
                        or £{quote.monthly_price?.toFixed(2)}/mo
                      </p>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {format(new Date(quote.sent_at), 'dd MMM yyyy, HH:mm')}
                    {quote.resent_count > 0 && (
                      <span className="text-amber-600 ml-1">
                        (resent {quote.resent_count}x)
                      </span>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {quote.customer_purchased ? (
                      <Badge className="bg-green-500 text-white text-[10px]">
                        <Check className="h-2.5 w-2.5 mr-0.5" />Purchased
                      </Badge>
                    ) : quote.customer_responded ? (
                      <Badge variant="secondary" className="text-[10px]">Responded</Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px]">Pending</Badge>
                    )}
                  </div>
                </div>
                
                <div className="mt-2 pt-2 border-t flex items-center justify-between">
                  <span className="text-xs text-muted-foreground capitalize">
                    {quote.payment_type?.replace('_', ' ')}
                  </span>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs"
                        onClick={() => {
                          navigator.clipboard.writeText(quote.quote_reference);
                        }}
                      >
                        <ExternalLink className="h-3 w-3 mr-1" />
                        Copy Ref
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Copy quote reference</TooltipContent>
                  </Tooltip>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
});

QuoteSentCell.displayName = 'QuoteSentCell';
