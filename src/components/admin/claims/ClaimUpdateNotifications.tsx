import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Bell, CheckCircle, FileText, ExternalLink } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export const ClaimUpdateNotifications = () => {
  const { toast } = useToast();
  const [unreadResponses, setUnreadResponses] = useState<any[]>([]);
  const [selectedResponse, setSelectedResponse] = useState<any>(null);
  const [showPopup, setShowPopup] = useState(false);

  const fetchUnread = async () => {
    const { data } = await supabase
      .from('claim_update_responses')
      .select('*, claim_update_requests(vehicle_registration, customer_name, claim_reason)')
      .eq('is_read', false)
      .order('created_at', { ascending: false });
    
    if (data) {
      // Show toast for new responses
      if (data.length > unreadResponses.length && unreadResponses.length > 0) {
        const newest = data[0];
        const reg = (newest as any).claim_update_requests?.vehicle_registration?.toUpperCase() || 'N/A';
        toast({
          title: `📬 Claim Update Received: ${reg}`,
          description: `Status: ${newest.status_update} — from ${newest.respondent_name || 'Unknown'}`,
          duration: 8000,
        });
      }
      setUnreadResponses(data);
    }
  };

  useEffect(() => {
    fetchUnread();
    const interval = setInterval(fetchUnread, 30000); // Poll every 30s
    return () => clearInterval(interval);
  }, []);

  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel('claim-update-responses')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'claim_update_responses',
      }, () => {
        fetchUnread();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const markAsRead = async (id: string) => {
    await supabase.from('claim_update_responses').update({ is_read: true }).eq('id', id);
    setUnreadResponses(prev => prev.filter(r => r.id !== id));
    setSelectedResponse(null);
  };

  const viewResponse = (response: any) => {
    setSelectedResponse(response);
    setShowPopup(true);
  };

  if (unreadResponses.length === 0) return null;

  return (
    <>
      {/* Notification bar */}
      <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 mb-4 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-emerald-600 animate-pulse" />
          <span className="text-sm font-medium text-emerald-800">
            {unreadResponses.length} new claim update{unreadResponses.length > 1 ? 's' : ''} received
          </span>
        </div>
        <div className="flex gap-2 flex-wrap">
          {unreadResponses.slice(0, 5).map((resp) => {
            const reg = (resp as any).claim_update_requests?.vehicle_registration?.toUpperCase() || '?';
            return (
              <Badge
                key={resp.id}
                variant="outline"
                className="cursor-pointer hover:bg-emerald-100 border-emerald-300 text-emerald-700"
                onClick={() => viewResponse(resp)}
              >
                <span className="bg-yellow-400 border border-black px-1 py-0.5 rounded text-[9px] font-black mr-1.5">{reg}</span>
                {resp.status_update}
              </Badge>
            );
          })}
        </div>
      </div>

      {/* Detail popup */}
      <Dialog open={showPopup} onOpenChange={setShowPopup}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-emerald-500" />
              Claim Update Response
            </DialogTitle>
            <DialogDescription>
              {selectedResponse && (
                <>
                  From {selectedResponse.respondent_name || 'Unknown'} ({selectedResponse.respondent_email || 'N/A'})
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          {selectedResponse && (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="bg-yellow-400 border-[3px] border-black px-3 py-1 rounded font-black text-base tracking-wider" style={{ fontFamily: "'Arial Black', Arial, sans-serif" }}>
                  {(selectedResponse as any).claim_update_requests?.vehicle_registration?.toUpperCase() || 'N/A'}
                </div>
                <div>
                  <p className="font-medium text-sm">{(selectedResponse as any).claim_update_requests?.customer_name}</p>
                  <p className="text-xs text-muted-foreground">{(selectedResponse as any).claim_update_requests?.claim_reason}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm border rounded-lg p-3 bg-muted/20">
                <div>
                  <span className="text-muted-foreground text-xs">Status</span>
                  <p className="font-semibold text-emerald-700">{selectedResponse.status_update}</p>
                </div>
                {selectedResponse.invoice_number && (
                  <div>
                    <span className="text-muted-foreground text-xs">Invoice #</span>
                    <p className="font-medium">{selectedResponse.invoice_number}</p>
                  </div>
                )}
                {selectedResponse.invoice_amount && (
                  <div>
                    <span className="text-muted-foreground text-xs">Amount</span>
                    <p className="font-semibold">£{Number(selectedResponse.invoice_amount).toFixed(2)}</p>
                  </div>
                )}
                {selectedResponse.estimated_completion && (
                  <div>
                    <span className="text-muted-foreground text-xs">Est. Completion</span>
                    <p className="font-medium">{selectedResponse.estimated_completion}</p>
                  </div>
                )}
              </div>

              {selectedResponse.notes && (
                <div>
                  <span className="text-muted-foreground text-xs">Notes</span>
                  <p className="text-sm mt-1 whitespace-pre-wrap bg-muted/20 rounded p-2">{selectedResponse.notes}</p>
                </div>
              )}

              {selectedResponse.file_url && (
                <a href={selectedResponse.file_url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800">
                  <FileText className="h-4 w-4" />
                  {selectedResponse.file_name || 'View Attachment'}
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}

              <div className="flex gap-2 pt-2">
                <Button onClick={() => markAsRead(selectedResponse.id)} className="flex-1">
                  <CheckCircle className="h-4 w-4 mr-2" /> Mark as Read
                </Button>
                <Button variant="outline" onClick={() => setShowPopup(false)}>Close</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
