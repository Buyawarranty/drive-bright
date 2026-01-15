import React from 'react';
import { format } from 'date-fns';
import { 
  CheckCircle, Clock, AlertCircle, Mail, 
  CreditCard, FileCheck, Download, Phone,
  MessageSquare
} from 'lucide-react';

interface Order {
  id: string;
  email_sent_status: string | null;
  email_sent_at: string | null;
  payment_verified: boolean | null;
  warranties_2000_status: string | null;
  warranties_2000_sent_at: string | null;
  created_at: string;
  policy_start_date: string;
}

interface OrderCommunicationTimelineProps {
  order: Order;
}

interface TimelineEvent {
  id: string;
  label: string;
  date: string | null;
  status: 'complete' | 'pending' | 'failed';
  icon: React.ElementType;
  color: string;
}

export const OrderCommunicationTimeline: React.FC<OrderCommunicationTimelineProps> = ({ order }) => {
  const events: TimelineEvent[] = [
    {
      id: 'created',
      label: 'Order Created',
      date: order.created_at,
      status: 'complete',
      icon: FileCheck,
      color: 'text-green-500'
    },
    {
      id: 'invoice',
      label: 'Email Invoice Sent',
      date: order.email_sent_at,
      status: order.email_sent_status === 'sent' ? 'complete' : 
              order.email_sent_status === 'failed' ? 'failed' : 'pending',
      icon: Mail,
      color: order.email_sent_status === 'sent' ? 'text-green-500' : 
             order.email_sent_status === 'failed' ? 'text-red-500' : 'text-yellow-500'
    },
    {
      id: 'payment',
      label: 'Payment Confirmed',
      date: order.payment_verified ? order.created_at : null,
      status: order.payment_verified ? 'complete' : 'pending',
      icon: CreditCard,
      color: order.payment_verified ? 'text-green-500' : 'text-yellow-500'
    },
    {
      id: 'registration',
      label: 'Registration Completed',
      date: order.warranties_2000_sent_at,
      status: order.warranties_2000_status === 'sent' ? 'complete' :
              order.warranties_2000_status === 'failed' ? 'failed' : 'pending',
      icon: CheckCircle,
      color: order.warranties_2000_status === 'sent' ? 'text-green-500' :
             order.warranties_2000_status === 'failed' ? 'text-red-500' : 'text-yellow-500'
    },
    {
      id: 'documents',
      label: 'Documents Downloaded',
      date: null, // Track this separately if needed
      status: 'pending',
      icon: Download,
      color: 'text-gray-400'
    }
  ];

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'complete':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-yellow-500" />;
    }
  };

  return (
    <div className="space-y-1">
      <p className="text-sm font-medium text-muted-foreground mb-3">Communication Timeline</p>
      <div className="space-y-2">
        {events.map((event, index) => {
          const Icon = event.icon;
          return (
            <div 
              key={event.id}
              className="flex items-center gap-3 text-sm"
            >
              <div className="flex items-center justify-center w-6 h-6">
                {getStatusIcon(event.status)}
              </div>
              <div className={`flex-1 ${event.status === 'pending' ? 'text-muted-foreground' : ''}`}>
                <span className="flex items-center gap-2">
                  <Icon className={`h-4 w-4 ${event.color}`} />
                  {event.label}
                </span>
              </div>
              <div className="text-xs text-muted-foreground">
                {event.status === 'complete' && event.date
                  ? format(new Date(event.date), 'MMM d')
                  : event.status === 'failed' 
                    ? 'Failed'
                    : 'Pending'}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
