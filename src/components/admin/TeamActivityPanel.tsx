import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Users, Circle, Clock, Monitor, History, ChevronDown, ChevronUp, Search, CalendarDays } from 'lucide-react';
import { formatDistanceToNow, format, startOfDay, endOfDay, subDays } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface TeamMember {
  id: string;
  user_id: string;
  admin_user_id: string | null;
  status: 'online' | 'away' | 'busy' | 'offline';
  last_seen_at: string;
  last_activity_at: string;
  current_tab: string | null;
  session_started_at: string | null;
  admin_user: {
    first_name: string | null;
    last_name: string | null;
    email: string;
    role: string;
  } | null;
}

interface ActivityLog {
  id: string;
  user_id: string;
  admin_user_id: string | null;
  activity_type: string;
  current_tab: string | null;
  created_at: string;
  admin_user: {
    first_name: string | null;
    last_name: string | null;
    email: string;
  } | null;
}

interface DailyOnlineTime {
  id: string;
  user_id: string;
  admin_user_id: string | null;
  date: string;
  total_online_seconds: number;
  first_online_at: string | null;
  last_online_at: string | null;
  session_count: number;
  admin_user: {
    first_name: string | null;
    last_name: string | null;
    email: string;
  } | null;
}

const TAB_LABELS: Record<string, string> = {
  'get-quote': 'Quotes & Orders',
  'customers': 'Customers',
  'plans': 'Standard Plans',
  'claims': 'Claims',
  'contact': 'Contact',
  'abandoned-carts': 'Abandoned Carts',
  'discount-codes': 'Discount Codes',
  'analytics': 'Analytics',
  'user-permissions': 'User Permissions',
  'emails': 'Email Hub',
  'blog-writing': 'Blog Writing',
  'landing-pages': 'Landing Pages',
  'testing': 'Testing',
  'account': 'Account Settings',
};

const formatDuration = (seconds: number): string => {
  if (seconds < 60) return `${seconds}s`;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
};

export const TeamActivityPanel = () => {
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [dailyTimes, setDailyTimes] = useState<DailyOnlineTime[]>([]);
  const [loading, setLoading] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const [searchDate, setSearchDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [activityTab, setActivityTab] = useState<'current' | 'daily'>('current');

  const fetchTeamPresence = async () => {
    try {
      const { data, error } = await supabase
        .from('user_presence')
        .select(`
          *,
          admin_user:admin_users!user_presence_admin_user_id_fkey (
            first_name,
            last_name,
            email,
            role
          )
        `)
        .order('last_seen_at', { ascending: false });

      if (error) throw error;
      setTeamMembers((data as TeamMember[]) || []);
    } catch (error) {
      console.error('Error fetching team presence:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchActivityLogs = async () => {
    try {
      const { data, error } = await supabase
        .from('user_activity_log')
        .select(`
          *,
          admin_user:admin_users!user_activity_log_admin_user_id_fkey (
            first_name,
            last_name,
            email
          )
        `)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setActivityLogs((data as ActivityLog[]) || []);
    } catch (error) {
      console.error('Error fetching activity logs:', error);
    }
  };

  const fetchDailyOnlineTime = async (dateStr: string) => {
    try {
      const { data, error } = await supabase
        .from('user_daily_online_time')
        .select(`
          *,
          admin_user:admin_users!user_daily_online_time_admin_user_id_fkey (
            first_name,
            last_name,
            email
          )
        `)
        .eq('date', dateStr)
        .order('total_online_seconds', { ascending: false });

      if (error) throw error;
      setDailyTimes((data as DailyOnlineTime[]) || []);
    } catch (error) {
      console.error('Error fetching daily online time:', error);
    }
  };

  useEffect(() => {
    fetchTeamPresence();
    fetchActivityLogs();
    fetchDailyOnlineTime(searchDate);

    // Subscribe to realtime updates
    const presenceChannel = supabase
      .channel('team-presence')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_presence'
        },
        () => {
          fetchTeamPresence();
        }
      )
      .subscribe();

    const activityChannel = supabase
      .channel('activity-logs')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'user_activity_log'
        },
        () => {
          fetchActivityLogs();
        }
      )
      .subscribe();

    // Refresh every 30 seconds as backup
    const interval = setInterval(() => {
      fetchTeamPresence();
      fetchActivityLogs();
    }, 30000);

    return () => {
      supabase.removeChannel(presenceChannel);
      supabase.removeChannel(activityChannel);
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    fetchDailyOnlineTime(searchDate);
  }, [searchDate]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return 'bg-green-500';
      case 'away': return 'bg-yellow-500';
      case 'busy': return 'bg-red-500';
      default: return 'bg-gray-400';
    }
  };

  const getActivityIcon = (activityType: string) => {
    switch (activityType) {
      case 'online': return <Circle className="h-2.5 w-2.5 fill-green-500 text-green-500" />;
      case 'away': return <Circle className="h-2.5 w-2.5 fill-yellow-500 text-yellow-500" />;
      case 'busy': return <Circle className="h-2.5 w-2.5 fill-red-500 text-red-500" />;
      case 'offline': return <Circle className="h-2.5 w-2.5 fill-gray-400 text-gray-400" />;
      default: return <Circle className="h-2.5 w-2.5 fill-gray-400 text-gray-400" />;
    }
  };

  const getStatusLabel = (status: string, lastSeen: string) => {
    if (status === 'online') return 'Online';
    if (status === 'away') return 'Away';
    if (status === 'busy') return 'Busy';
    
    const lastSeenDate = new Date(lastSeen);
    const now = new Date();
    const diffMinutes = Math.floor((now.getTime() - lastSeenDate.getTime()) / (1000 * 60));
    
    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffMinutes < 1440) return `${Math.floor(diffMinutes / 60)}h ago`;
    return formatDistanceToNow(lastSeenDate, { addSuffix: true });
  };

  const getInitials = (firstName: string | null, lastName: string | null, email: string) => {
    if (firstName && lastName) {
      return `${firstName[0]}${lastName[0]}`.toUpperCase();
    }
    return email.substring(0, 2).toUpperCase();
  };

  const getUserName = (log: ActivityLog | DailyOnlineTime) => {
    if (log.admin_user) {
      const name = `${log.admin_user.first_name || ''} ${log.admin_user.last_name || ''}`.trim();
      return name || log.admin_user.email;
    }
    return 'Unknown User';
  };

  const onlineCount = teamMembers.filter(m => m.status === 'online').length;
  const awayCount = teamMembers.filter(m => m.status === 'away').length;

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="h-5 w-5" />
            Team Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">Loading...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="h-5 w-5" />
            Team Activity
          </CardTitle>
          <div className="flex items-center gap-3 text-sm">
            <span className="flex items-center gap-1.5">
              <Circle className="h-2.5 w-2.5 fill-green-500 text-green-500" />
              {onlineCount} online
            </span>
            {awayCount > 0 && (
              <span className="flex items-center gap-1.5">
                <Circle className="h-2.5 w-2.5 fill-yellow-500 text-yellow-500" />
                {awayCount} away
              </span>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current Status */}
        {teamMembers.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-4">
            No team activity recorded yet
          </div>
        ) : (
          <div className="space-y-3">
            <TooltipProvider>
              {teamMembers.map((member) => {
                const name = member.admin_user 
                  ? `${member.admin_user.first_name || ''} ${member.admin_user.last_name || ''}`.trim() || member.admin_user.email
                  : 'Unknown User';
                const email = member.admin_user?.email || '';
                const role = member.admin_user?.role || 'user';
                const currentTabLabel = member.current_tab ? TAB_LABELS[member.current_tab] || member.current_tab : null;

                return (
                  <div 
                    key={member.id} 
                    className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                      member.status === 'online' 
                        ? 'bg-green-50/50 border-green-100 dark:bg-green-950/20 dark:border-green-900/30' 
                        : member.status === 'away'
                        ? 'bg-yellow-50/50 border-yellow-100 dark:bg-yellow-950/20 dark:border-yellow-900/30'
                        : 'bg-muted/30'
                    }`}
                  >
                    <div className="relative">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback className="text-sm font-medium">
                          {getInitials(member.admin_user?.first_name || null, member.admin_user?.last_name || null, email)}
                        </AvatarFallback>
                      </Avatar>
                      <span 
                        className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-background ${getStatusColor(member.status)}`}
                      />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm truncate">{name}</span>
                        <Badge variant="outline" className="text-xs capitalize">
                          {role}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                        {member.status === 'online' && currentTabLabel && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="flex items-center gap-1 truncate">
                                <Monitor className="h-3 w-3" />
                                {currentTabLabel}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              Currently viewing: {currentTabLabel}
                            </TooltipContent>
                          </Tooltip>
                        )}
                        {member.status !== 'online' && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {getStatusLabel(member.status, member.last_seen_at)}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              Last seen: {new Date(member.last_seen_at).toLocaleString()}
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    </div>

                    <div className="text-right">
                      <Badge 
                        variant={member.status === 'online' ? 'default' : 'secondary'}
                        className={`text-xs ${
                          member.status === 'online' 
                            ? 'bg-green-100 text-green-700 hover:bg-green-100 dark:bg-green-900/50 dark:text-green-300' 
                            : member.status === 'away'
                            ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-100 dark:bg-yellow-900/50 dark:text-yellow-300'
                            : ''
                        }`}
                      >
                        {member.status === 'online' ? 'Online' : member.status === 'away' ? 'Away' : 'Offline'}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </TooltipProvider>
          </div>
        )}

        {/* Activity Tabs */}
        <Tabs value={activityTab} onValueChange={(v) => setActivityTab(v as 'current' | 'daily')} className="mt-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="current" className="flex items-center gap-2">
              <History className="h-4 w-4" />
              Recent Activity
            </TabsTrigger>
            <TabsTrigger value="daily" className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4" />
              Daily Online Time
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="current" className="mt-3">
            {activityLogs.length > 0 && (
              <div className="border rounded-lg divide-y max-h-64 overflow-y-auto">
                {activityLogs.map((log) => (
                  <div key={log.id} className="flex items-center gap-3 p-2.5 text-sm">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      {getActivityIcon(log.activity_type)}
                      <span className="font-medium truncate">{getUserName(log)}</span>
                      <span className="text-muted-foreground">
                        went <span className="capitalize">{log.activity_type}</span>
                      </span>
                      {log.current_tab && (
                        <span className="text-muted-foreground hidden sm:inline">
                          on {TAB_LABELS[log.current_tab] || log.current_tab}
                        </span>
                      )}
                    </div>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          {format(new Date(log.created_at), 'PPpp')}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="daily" className="mt-3 space-y-3">
            {/* Date Search */}
            <div className="flex items-center gap-2">
              <Input
                type="date"
                value={searchDate}
                onChange={(e) => setSearchDate(e.target.value)}
                className="w-auto"
              />
              <div className="flex gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSearchDate(format(new Date(), 'yyyy-MM-dd'))}
                >
                  Today
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSearchDate(format(subDays(new Date(), 1), 'yyyy-MM-dd'))}
                >
                  Yesterday
                </Button>
              </div>
            </div>
            
            {/* Daily Time Summary */}
            {dailyTimes.length === 0 ? (
              <div className="text-sm text-muted-foreground text-center py-4 border rounded-lg">
                No activity recorded for {format(new Date(searchDate), 'MMMM d, yyyy')}
              </div>
            ) : (
              <div className="border rounded-lg divide-y">
                {dailyTimes.map((record) => (
                  <div key={record.id} className="flex items-center justify-between p-3">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="text-xs">
                          {getInitials(
                            record.admin_user?.first_name || null,
                            record.admin_user?.last_name || null,
                            record.admin_user?.email || ''
                          )}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium text-sm">{getUserName(record)}</p>
                        <p className="text-xs text-muted-foreground">
                          {record.session_count} session{record.session_count !== 1 ? 's' : ''}
                          {record.first_online_at && (
                            <> • First online: {format(new Date(record.first_online_at), 'HH:mm')}</>
                          )}
                          {record.last_online_at && (
                            <> • Last seen: {format(new Date(record.last_online_at), 'HH:mm')}</>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge variant="secondary" className="font-mono">
                        <Clock className="h-3 w-3 mr-1" />
                        {formatDuration(record.total_online_seconds)}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};