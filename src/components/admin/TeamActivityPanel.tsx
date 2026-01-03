import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Users, Circle, Clock, Monitor } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

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

const TAB_LABELS: Record<string, string> = {
  'get-quote': 'Send a Quote',
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

export const TeamActivityPanel = () => {
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);

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

  useEffect(() => {
    fetchTeamPresence();

    // Subscribe to realtime updates
    const channel = supabase
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

    // Refresh every 30 seconds as backup
    const interval = setInterval(fetchTeamPresence, 30000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return 'bg-green-500';
      case 'away': return 'bg-yellow-500';
      case 'busy': return 'bg-red-500';
      default: return 'bg-gray-400';
    }
  };

  const getStatusLabel = (status: string, lastSeen: string) => {
    if (status === 'online') return 'Online';
    if (status === 'away') return 'Away';
    if (status === 'busy') return 'Busy';
    
    // For offline, show time since last seen
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
      <CardContent>
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
                    {/* Avatar with status indicator */}
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

                    {/* User info */}
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

                    {/* Status indicator text */}
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
      </CardContent>
    </Card>
  );
};
