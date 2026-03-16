import { Bell, X, Mail, FileText, UserPlus, RotateCw } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatDistanceToNow } from 'date-fns';
import { AdminNotification } from '@/hooks/useAdminNotifications';
export type { AdminNotification };

interface AdminNotificationBellProps {
  notifications: AdminNotification[];
  unreadCount: number;
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
  onNavigateToTab?: (tab: string) => void;
}

const getIcon = (type: AdminNotification['type']) => {
  switch (type) {
    case 'contact':
      return <Mail className="h-4 w-4 text-blue-500" />;
    case 'claim':
      return <FileText className="h-4 w-4 text-orange-500" />;
    case 'customer':
      return <UserPlus className="h-4 w-4 text-green-500" />;
    case 'lead_resubmission':
      return <RotateCw className="h-4 w-4 text-purple-500" />;
  }
};

const getTabFromType = (type: AdminNotification['type']) => {
  switch (type) {
    case 'contact':
      return 'contact-submissions';
    case 'claim':
      return 'claims';
    case 'customer':
      return 'customers';
    case 'lead_resubmission':
      return 'new-leads';
  }
};

export const AdminNotificationBell = ({
  notifications,
  unreadCount,
  onMarkAsRead,
  onMarkAllAsRead,
  onNavigateToTab,
}: AdminNotificationBellProps) => {
  const [open, setOpen] = useState(false);

  const handleNotificationClick = (notification: AdminNotification) => {
    onMarkAsRead(notification.id);
    if (onNavigateToTab) {
      onNavigateToTab(getTabFromType(notification.type));
    }
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge 
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 bg-orange-500 text-white border-0"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="end">
        <div className="flex items-center justify-between border-b p-4 bg-gray-50">
          <h3 className="font-semibold">Admin Notifications</h3>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onMarkAllAsRead}
              className="text-xs text-orange-600 hover:text-orange-700"
            >
              Mark all read
            </Button>
          )}
        </div>
        <ScrollArea className="h-[400px]">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
              <Bell className="h-12 w-12 mb-2 opacity-50" />
              <p>No new notifications</p>
              <p className="text-xs mt-1">New contacts, claims, customers & resubmissions will appear here</p>
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  onClick={() => handleNotificationClick(notification)}
                  className={`p-4 hover:bg-muted/50 transition-colors cursor-pointer ${
                    !notification.is_read 
                      ? notification.type === 'lead_resubmission' 
                        ? 'bg-purple-50' 
                        : 'bg-orange-50' 
                      : ''
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5">
                      {getIcon(notification.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className={`text-sm ${!notification.is_read ? 'font-semibold' : 'font-medium'}`}>
                            {notification.title}
                          </p>
                          <p className="text-sm text-gray-600 truncate">
                            {notification.message}
                          </p>
                        </div>
                        {!notification.is_read && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 shrink-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              onMarkAsRead(notification.id);
                            }}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatDistanceToNow(new Date(notification.created_at), {
                          addSuffix: true,
                        })}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
};
