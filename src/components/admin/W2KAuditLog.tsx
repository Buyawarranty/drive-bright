import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, User, Send, AlertCircle, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';

interface W2KAuditLogProps {
  policyId: string;
}

interface AuditEntry {
  id: string;
  action_type: string;
  admin_email: string;
  created_at: string;
  notes: string | null;
  w2k_response: any;
}

export const W2KAuditLog: React.FC<W2KAuditLogProps> = ({ policyId }) => {
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAuditLog();
  }, [policyId]);

  const fetchAuditLog = async () => {
    try {
      const { data, error } = await supabase
        .from('warranties_2000_audit_log')
        .select('id, action_type, admin_email, created_at, notes, w2k_response')
        .eq('policy_id', policyId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAuditEntries(data || []);
    } catch (error) {
      console.error('Error fetching audit log:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="text-sm text-muted-foreground">Loading audit log...</div>;
  }

  if (auditEntries.length === 0) {
    return (
      <div className="text-sm text-muted-foreground p-4 bg-muted/50 rounded-lg">
        No warranty submissions recorded yet
      </div>
    );
  }

  const getActionBadge = (actionType: string) => {
    switch (actionType) {
      case 'initial_send':
        return (
          <Badge variant="secondary" className="bg-green-100 text-green-800">
            <CheckCircle className="h-3 w-3 mr-1" />
            Initial Send
          </Badge>
        );
      case 'manual_resend':
        return (
          <Badge variant="secondary" className="bg-orange-100 text-orange-800">
            <Send className="h-3 w-3 mr-1" />
            Manual Resend
          </Badge>
        );
      default:
        return <Badge variant="outline">{actionType}</Badge>;
    }
  };

  const getResponseStatus = (response: any) => {
    if (!response) return null;
    const status = response.status;
    if (status >= 200 && status < 300) {
      return (
        <Badge variant="secondary" className="bg-green-100 text-green-800 text-xs">
          <CheckCircle className="h-3 w-3 mr-1" />
          Success
        </Badge>
      );
    } else {
      return (
        <Badge variant="destructive" className="text-xs">
          <AlertCircle className="h-3 w-3 mr-1" />
          Failed ({status})
        </Badge>
      );
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Clock className="h-4 w-4" />
          Warranties 2000 Submission History
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {auditEntries.map((entry) => (
            <div
              key={entry.id}
              className="border border-border rounded-lg p-3 space-y-2 bg-muted/30"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {getActionBadge(entry.action_type)}
                  {getResponseStatus(entry.w2k_response)}
                </div>
                <span className="text-xs text-muted-foreground">
                  {format(new Date(entry.created_at), 'dd/MM/yyyy HH:mm')}
                </span>
              </div>
              
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <User className="h-3 w-3" />
                <span>{entry.admin_email}</span>
              </div>
              
              {entry.notes && (
                <div className="text-xs text-muted-foreground italic">
                  {entry.notes}
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
