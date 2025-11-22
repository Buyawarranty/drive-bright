import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Send, Mail, ExternalLink, Clock, CheckCircle, AlertCircle, Eye } from 'lucide-react';

interface WarrantyActionsProps {
  customerId: string;
  policyId?: string;
  customerEmail: string;
  warrantyNumber?: string;
  emailStatus?: string;
  warranties2000Status?: string;
  onActionComplete?: () => void;
}

interface AuditLog {
  id: string;
  event_type: string;
  event_data: any;
  event_timestamp: string;
  created_by: string;
}

export const WarrantyActions: React.FC<WarrantyActionsProps> = ({
  customerId,
  policyId,
  customerEmail,
  warrantyNumber,
  emailStatus = 'not_sent',
  warranties2000Status = 'not_sent',
  onActionComplete
}) => {
  const [isLoading, setIsLoading] = useState<{ [key: string]: boolean }>({});
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [showAuditLogs, setShowAuditLogs] = useState(false);

  const handleSendWelcomeEmail = async () => {
    if (!customerId) {
      toast.error('Customer ID is missing. Cannot send email.');
      return;
    }

    setIsLoading(prev => ({ ...prev, email: true }));
    
    try {
      console.log('Sending welcome email to:', customerEmail, 'Policy ID:', policyId, 'Customer ID:', customerId);
      
      const { data, error } = await supabase.functions.invoke('send-welcome-email-manual', {
        body: { 
          policyId: policyId || undefined,
          customerId: customerId,
          forceResend: true  // Always force resend
        }
      });

      console.log('Welcome email response:', { data, error });

      if (error) {
        console.error('Welcome email function error:', error);
        // Try to get more specific error info
        let errorMessage = error.message || 'Unknown error occurred';
        if (error.context && error.context.body) {
          try {
            const errorBody = JSON.parse(error.context.body);
            errorMessage = `${errorBody.code || 'ERROR'}: ${errorBody.error || errorBody.message || errorMessage}`;
          } catch (e) {
            // Use original error message
          }
        }
        toast.error(`Failed to send email: ${errorMessage}`, {
          duration: 5000,
          description: 'Please check the console for more details or contact support.'
        });
      } else if (data?.ok) {
        if (data.already) {
          toast.success('Email was already sent for this policy', {
            description: 'No new email was sent to avoid duplicates.'
          });
        } else {
          toast.success('Welcome email sent successfully!', {
            description: `Email sent to ${customerEmail}`
          });
        }
        onActionComplete?.();
      } else {
        const errorMsg = `${data?.code || 'Unknown error'}: ${data?.error || data?.message || 'Failed to send email'}`;
        console.error('Welcome email error:', data);
        toast.error(errorMsg, {
          duration: 5000,
          description: 'Please try again or contact support if the issue persists.'
        });
      }
    } catch (error: any) {
      console.error('Unexpected error sending welcome email:', error);
      toast.error(`Unexpected error: ${error.message || 'Unknown error'}`, {
        duration: 5000,
        description: 'Please check your internet connection and try again.'
      });
    } finally {
      setIsLoading(prev => ({ ...prev, email: false }));
    }
  };

  const handleSendToWarranties2000 = async () => {
    setIsLoading(prev => ({ ...prev, warranties2000: true }));
    
    try {
      const { data, error } = await supabase.functions.invoke('send-to-warranties-2000', {
        body: { 
          policyId: policyId || undefined,
          customerId: customerId 
        }
      });

      console.log('Warranties 2000 response:', { data, error });

      if (error) {
        console.error('Warranties 2000 function error:', error);
        // Try to get more specific error info
        let errorMessage = error.message || 'Unknown error occurred';
        if (error.context && error.context.body) {
          try {
            const errorBody = JSON.parse(error.context.body);
            errorMessage = `${errorBody.code || 'ERROR'}: ${errorBody.error || errorBody.message || errorMessage}`;
          } catch (e) {
            // Use original error message
          }
        }
        toast.error(`Failed to send to Warranties 2000: ${errorMessage}`);
      } else if (data?.ok) {
        if (data.already) {
          toast.success('Already sent to Warranties 2000 previously');
        } else {
          toast.success('Successfully sent to Warranties 2000!');
        }
        onActionComplete?.();
      } else {
        const errorMsg = `${data?.code || 'Unknown error'}: ${data?.error || data?.message || 'Failed to send to Warranties 2000'}`;
        console.error('Warranties 2000 error:', data);
        toast.error(errorMsg);
      }
    } catch (error: any) {
      console.error('Unexpected error sending to Warranties 2000:', error);
      toast.error(`Unexpected error: ${error.message}`);
    } finally {
      setIsLoading(prev => ({ ...prev, warranties2000: false }));
    }
  };

  const fetchAuditLogs = async () => {
    try {
      const { data, error } = await supabase
        .from('warranty_audit_log')
        .select('*')
        .eq('customer_id', customerId)
        .order('event_timestamp', { ascending: false })
        .limit(20);

      if (error) throw error;
      setAuditLogs(data || []);
    } catch (error: any) {
      console.error('Error fetching audit logs:', error);
      toast.error('Failed to load audit logs');
    }
  };

  const getStatusBadge = (status: string, type: 'email' | 'warranties2000') => {
    const baseClass = "text-xs font-medium px-2 py-1 rounded-full";
    
    switch (status) {
      case 'sent':
        return <Badge variant="secondary" className="bg-green-100 text-green-800">
          <CheckCircle className="w-3 h-3 mr-1" />
          Sent
        </Badge>;
      case 'failed':
        return <Badge variant="destructive" className="bg-red-100 text-red-800">
          <AlertCircle className="w-3 h-3 mr-1" />
          Failed
        </Badge>;
      case 'pending':
        return <Badge variant="outline" className="bg-yellow-100 text-yellow-800">
          <Clock className="w-3 h-3 mr-1" />
          Pending
        </Badge>;
      default:
        return <Badge variant="outline" className="bg-gray-100 text-gray-800">
          <Clock className="w-3 h-3 mr-1" />
          Not Sent
        </Badge>;
    }
  };

  const formatEventType = (eventType: string) => {
    return eventType
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const formatEventData = (eventData: any) => {
    if (!eventData) return '';
    
    try {
      return JSON.stringify(eventData, null, 2);
    } catch {
      return String(eventData);
    }
  };

  return (
    <div className="space-y-4">
      {/* Status Display */}
      <div className="flex flex-wrap gap-4 items-center">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Email:</span>
          {getStatusBadge(emailStatus, 'email')}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Warranties 2000:</span>
          {getStatusBadge(warranties2000Status, 'warranties2000')}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-2">
        <Button
          onClick={handleSendWelcomeEmail}
          disabled={isLoading.email}
          variant="outline"
          size="sm"
          className="flex items-center gap-2"
        >
          <Mail className="w-4 h-4" />
          {isLoading.email ? 'Sending...' : 'Send Welcome Email'}
        </Button>

        <Button
          onClick={handleSendToWarranties2000}
          disabled={isLoading.warranties2000}
          variant="outline"
          size="sm"
          className="flex items-center gap-2"
        >
          <ExternalLink className="w-4 h-4" />
          {isLoading.warranties2000 ? 'Sending...' : 'Send to Warranties 2000'}
        </Button>

        <Dialog open={showAuditLogs} onOpenChange={setShowAuditLogs}>
          <DialogTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="flex items-center gap-2"
              onClick={fetchAuditLogs}
            >
              <Eye className="w-4 h-4" />
              View Logs
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                Audit Logs - {customerEmail}
                {warrantyNumber && (
                  <span className="text-sm font-normal text-gray-600 ml-2">
                    ({warrantyNumber})
                  </span>
                )}
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              {auditLogs.length === 0 ? (
                <p className="text-gray-500 text-center py-4">No audit logs found</p>
              ) : (
                auditLogs.map((log) => (
                  <div key={log.id} className="border rounded-lg p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">
                          {formatEventType(log.event_type)}
                        </Badge>
                        <span className="text-sm text-gray-600">
                          by {log.created_by || 'System'}
                        </span>
                      </div>
                      <span className="text-xs text-gray-500">
                        {new Date(log.event_timestamp).toLocaleString()}
                      </span>
                    </div>
                    
                    {log.event_data && (
                      <details className="text-sm">
                        <summary className="cursor-pointer text-gray-600 hover:text-gray-800">
                          Event Details
                        </summary>
                        <pre className="mt-2 p-2 bg-gray-50 rounded text-xs overflow-x-auto">
                          {formatEventData(log.event_data)}
                        </pre>
                      </details>
                    )}
                  </div>
                ))
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};