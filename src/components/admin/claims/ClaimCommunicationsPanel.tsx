import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Mail, Phone, FileText, ArrowDownLeft, ArrowUpRight, RefreshCw, MessageCircle } from 'lucide-react';

interface Communication {
  id: string;
  claim_id: string;
  direction: 'inbound' | 'outbound';
  communication_type: 'email' | 'phone' | 'note';
  subject?: string;
  message: string;
  sender_email?: string;
  recipient_email?: string;
  sent_by?: string;
  created_at: string;
  metadata?: any;
}

interface ClaimCommunicationsPanelProps {
  claimId: string;
  onRefresh?: () => void;
}

export const ClaimCommunicationsPanel: React.FC<ClaimCommunicationsPanelProps> = ({
  claimId,
  onRefresh,
}) => {
  const [communications, setCommunications] = useState<Communication[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCommunications();
  }, [claimId]);

  const fetchCommunications = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('claim_communications')
        .select('*')
        .eq('claim_id', claimId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCommunications((data || []) as Communication[]);
    } catch (error) {
      console.error('Error fetching communications:', error);
    } finally {
      setLoading(false);
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'email':
        return <Mail className="h-4 w-4" />;
      case 'phone':
        return <Phone className="h-4 w-4" />;
      case 'note':
        return <FileText className="h-4 w-4" />;
      default:
        return <MessageCircle className="h-4 w-4" />;
    }
  };

  const getDirectionIcon = (direction: string) => {
    return direction === 'inbound' 
      ? <ArrowDownLeft className="h-3 w-3 text-blue-500" />
      : <ArrowUpRight className="h-3 w-3 text-green-500" />;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-32">
          <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <MessageCircle className="h-5 w-5" />
            Communication History
          </CardTitle>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => {
              fetchCommunications();
              onRefresh?.();
            }}
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {communications.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Mail className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No communications recorded yet</p>
          </div>
        ) : (
          <ScrollArea className="h-[300px] pr-4">
            <div className="space-y-4">
              {communications.map((comm) => (
                <div 
                  key={comm.id}
                  className={`p-3 rounded-lg border ${
                    comm.direction === 'inbound' 
                      ? 'bg-blue-50 border-blue-200' 
                      : 'bg-green-50 border-green-200'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      {getTypeIcon(comm.communication_type)}
                      {getDirectionIcon(comm.direction)}
                      <Badge variant="outline" className="text-xs">
                        {comm.communication_type.toUpperCase()}
                      </Badge>
                      {comm.direction === 'outbound' && (
                        <span className="text-xs text-muted-foreground">
                          → {comm.recipient_email}
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatDate(comm.created_at)}
                    </span>
                  </div>
                  
                  {comm.subject && (
                    <p className="font-medium text-sm mb-1">{comm.subject}</p>
                  )}
                  
                  <p className="text-sm text-gray-700 whitespace-pre-wrap line-clamp-4">
                    {comm.message}
                  </p>
                  
                  {comm.sender_email && (
                    <p className="text-xs text-muted-foreground mt-2">
                      From: {comm.sender_email}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
};
