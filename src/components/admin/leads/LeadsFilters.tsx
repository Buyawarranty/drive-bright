import React from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, RefreshCw, Upload, Download, X, Filter, ArrowUpDown, Users, Globe } from 'lucide-react';
import { LeadStatus } from '@/hooks/useLeads';
import { cn } from '@/lib/utils';

export type AssignmentFilter = 'all' | 'all_leads' | 'total' | 'awaiting_contact' | 'assigned';
export type SortOption = 'newest' | 'oldest' | 'latest_submitted' | 'contacted' | 'follow_up' | 'quote_sent' | 'reminder_soonest' | 'reminder_latest';
export type SourceFilter = 'all' | 'google_ad' | 'social_ad' | 'website';

interface SalesUser {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  role?: string;
}

interface LeadsFiltersProps {
  filter: LeadStatus | 'all' | 'all_leads' | 'live' | 'high_priority' | 'fake' | 'lost' | 'quote_sent' | 'urgent_callback' | 'converted' | 'callbacks' | 'recovered' | 'reminders' | 'due_today' | 'checkout_struggle';
  onFilterChange: (filter: LeadStatus | 'all' | 'all_leads' | 'live' | 'high_priority' | 'fake' | 'lost' | 'quote_sent' | 'urgent_callback' | 'converted' | 'callbacks' | 'recovered' | 'reminders' | 'due_today' | 'checkout_struggle') => void;
  searchTerm: string;
  onSearchChange: (term: string) => void;
  onRefresh: () => void;
  onMigrate: () => void;
  onExport: (format: 'csv' | 'xlsx') => void;
  leadCounts: {
    all_leads: number;
    all: number;
    live: number;
    total: number;
    new: number;
    contacted: number;
    follow_up: number;
    quote_sent: number;
    urgent_callback: number;
    callbacks: number;
    paid: number;
    lost: number;
    converted: number;
    high_priority: number;
    fake: number;
    reminders: number;
    recovered: number;
    due_today: number;
    checkout_struggle?: number;
    source_total?: number;
    source_google?: number;
    source_facebook?: number;
    source_organic?: number;
    source_google_live?: number;
    source_facebook_live?: number;
    source_organic_live?: number;
  };
  showRecoveredPill?: boolean;
  assignmentFilter?: AssignmentFilter;
  onAssignmentFilterChange?: (filter: AssignmentFilter) => void;
  assignmentCounts?: {
    total: number;
    awaiting_contact: number;
    assigned: number;
  };
  sortOption?: SortOption;
  onSortChange?: (sort: SortOption) => void;
  salesUsers?: SalesUser[];
  agentFilter?: string;
  onAgentFilterChange?: (agentId: string) => void;
  agentLeadCounts?: Record<string, number>;
  agentLiveLeadCounts?: Record<string, number>;
  sourceFilter?: SourceFilter;
  onSourceFilterChange?: (source: SourceFilter) => void;
  userRole?: string;
}

// Status pill configuration — compact, color-coded for instant recognition
const STATUS_PILLS: { 
  value: string; 
  label: string; 
  icon?: string;
  colorClass: string;
  countKey: keyof LeadsFiltersProps['leadCounts'];
  isAssignment?: boolean;
}[] = [
  { value: 'all_leads', label: 'Total Leads', colorClass: 'data-[state=active]:bg-foreground data-[state=active]:text-background', countKey: 'all_leads' },
  { value: 'live', label: 'Live Leads', icon: '🟢', colorClass: 'data-[state=active]:bg-emerald-700 data-[state=active]:text-white', countKey: 'live' },
  { value: 'urgent_callback', label: 'Urgent', icon: '🔔', colorClass: 'data-[state=active]:bg-red-600 data-[state=active]:text-white', countKey: 'urgent_callback' },
  { value: 'checkout_struggle', label: 'Checkout Struggle', icon: '🚨', colorClass: 'data-[state=active]:bg-red-600 data-[state=active]:text-white', countKey: 'checkout_struggle' },
  { value: 'callbacks', label: 'Callbacks', icon: '📞', colorClass: 'data-[state=active]:bg-teal-600 data-[state=active]:text-white', countKey: 'callbacks' },
  { value: 'new', label: 'New', colorClass: 'data-[state=active]:bg-green-600 data-[state=active]:text-white', countKey: 'new' },
  { value: 'awaiting_contact', label: 'Awaiting', colorClass: 'data-[state=active]:bg-amber-500 data-[state=active]:text-white', countKey: 'all_leads', isAssignment: true },
  { value: 'contacted', label: 'Contacted', colorClass: 'data-[state=active]:bg-yellow-500 data-[state=active]:text-white', countKey: 'contacted' },
  { value: 'follow_up', label: 'Follow-up', colorClass: 'data-[state=active]:bg-purple-600 data-[state=active]:text-white', countKey: 'follow_up' },
  { value: 'quote_sent', label: 'Quoted', colorClass: 'data-[state=active]:bg-indigo-600 data-[state=active]:text-white', countKey: 'quote_sent' },
  { value: 'paid', label: 'Paid', colorClass: 'data-[state=active]:bg-emerald-600 data-[state=active]:text-white', countKey: 'paid' },
  { value: 'converted', label: 'Won', icon: '✅', colorClass: 'data-[state=active]:bg-teal-600 data-[state=active]:text-white', countKey: 'converted' },
  { value: 'high_priority', label: 'Hot', icon: '🔥', colorClass: 'data-[state=active]:bg-orange-600 data-[state=active]:text-white', countKey: 'high_priority' },
  { value: 'lost', label: 'Lost', icon: '💀', colorClass: 'data-[state=active]:bg-gray-700 data-[state=active]:text-white', countKey: 'lost' },
  { value: 'fake', label: 'Fake 404', icon: '🚫', colorClass: 'data-[state=active]:bg-red-900 data-[state=active]:text-white', countKey: 'fake' },
  { value: 'reminders', label: 'Reminders', icon: '⏰', colorClass: 'data-[state=active]:bg-amber-600 data-[state=active]:text-white', countKey: 'reminders' },
  { value: 'due_today', label: 'Due Today', icon: '🔔', colorClass: 'data-[state=active]:bg-orange-500 data-[state=active]:text-white', countKey: 'due_today' },
  { value: 'recovered', label: 'Recovered', icon: '🔄', colorClass: 'data-[state=active]:bg-cyan-700 data-[state=active]:text-white', countKey: 'recovered' },
];

export const LeadsFilters: React.FC<LeadsFiltersProps> = ({
  filter,
  onFilterChange,
  searchTerm,
  onSearchChange,
  onRefresh,
  onMigrate,
  onExport,
  leadCounts,
  assignmentFilter = 'all',
  onAssignmentFilterChange,
  assignmentCounts,
  sortOption = 'newest',
  onSortChange,
  salesUsers,
  agentFilter = 'all',
  onAgentFilterChange,
  agentLeadCounts,
  agentLiveLeadCounts,
  sourceFilter = 'all',
  onSourceFilterChange,
  showRecoveredPill = false,
  userRole,
}) => {
  const isAwaitingActive = assignmentFilter === 'awaiting_contact';

  const handleTabChange = (value: string) => {
    if (value === 'awaiting_contact') {
      onAssignmentFilterChange?.('awaiting_contact');
      return;
    }
    if (isAwaitingActive) onAssignmentFilterChange?.('all');
    onFilterChange(value as LeadStatus | 'all' | 'all_leads' | 'live' | 'high_priority' | 'fake' | 'quote_sent' | 'urgent_callback' | 'converted' | 'callbacks' | 'recovered' | 'reminders' | 'due_today');
  };

  const effectiveTabValue = isAwaitingActive ? 'awaiting_contact' : filter;

  const getCount = (pill: typeof STATUS_PILLS[0]) => {
    if (pill.isAssignment) return assignmentCounts?.awaiting_contact ?? 0;
    
    return leadCounts[pill.countKey] ?? 0;
  };

  return (
    <div className="space-y-3">
      {/* Row 1: Search (75%) + Recovered Leads (25%) */}
      <div className="flex items-stretch gap-3">
        <div className="relative flex-[3]">
          <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search leads — name, email, phone, vehicle reg..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="h-12 pl-12 pr-10 text-base font-medium bg-background border-2 border-border rounded-xl shadow-sm focus-visible:ring-primary/30 focus-visible:border-primary focus-visible:shadow-md transition-shadow"
            autoComplete="off"
          />
          {searchTerm && (
            <button 
              onClick={() => onSearchChange('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-muted transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Row 2: Status pills — small, compact, secondary */}
      <Tabs value={effectiveTabValue} onValueChange={handleTabChange}>
        <TabsList className="h-auto p-1 bg-muted/40 border border-border rounded-xl flex flex-wrap gap-1">
          {STATUS_PILLS.filter(pill => {
            // Hide recovered pill from non-admin users
            if (pill.value === 'recovered' && !showRecoveredPill) return false;
            return true;
          }).map(pill => {
            const count = getCount(pill);
            const isActive = effectiveTabValue === pill.value;
            return (
              <TabsTrigger 
                key={pill.value} 
                value={pill.value}
                className={cn(
                  "h-9 px-3 rounded-lg text-xs font-semibold transition-all duration-150 gap-1.5",
                  "data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:text-foreground data-[state=inactive]:hover:bg-muted/80",
                  "data-[state=active]:shadow-sm",
                  pill.colorClass
                )}
              >
                {pill.icon && <span className="text-sm leading-none">{pill.icon}</span>}
                <span>{pill.label}</span>
                <span className={cn(
                  "inline-flex items-center justify-center h-5 min-w-[20px] px-1 rounded-full text-[10px] font-bold tabular-nums",
                  isActive 
                    ? "bg-white/25 text-inherit" 
                    : count > 0 
                      ? "bg-background text-foreground border border-border" 
                      : "bg-muted/50 text-muted-foreground/60"
                )}>
                  {count}
                </span>
              </TabsTrigger>
            );
          })}
        </TabsList>
      </Tabs>

      {/* Row 3: Filters + Actions — tiny, compact row */}
      <div className="flex items-center gap-2">

        {/* Assignment filter */}
        {onAssignmentFilterChange && (
          <Select value={assignmentFilter} onValueChange={(v) => onAssignmentFilterChange(v as AssignmentFilter)}>
            <SelectTrigger className="w-[150px] h-8 text-xs rounded-lg border-2 border-border">
              <Filter className="h-3 w-3 mr-1.5 text-muted-foreground" />
              <SelectValue placeholder="Total Leads" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                Total Leads <Badge variant="secondary" className="ml-1.5 h-4 px-1 text-[10px]">{leadCounts.all_leads}</Badge>
              </SelectItem>
              <SelectItem value="total">
                Live Leads <Badge variant="secondary" className="ml-1.5 h-4 px-1 text-[10px] bg-green-100">{leadCounts.live}</Badge>
              </SelectItem>
              <SelectItem value="awaiting_contact">
                Unassigned <Badge variant="secondary" className="ml-1.5 h-4 px-1 text-[10px] bg-amber-100">{assignmentCounts?.awaiting_contact}</Badge>
              </SelectItem>
              <SelectItem value="assigned">
                Assigned <Badge variant="secondary" className="ml-1.5 h-4 px-1 text-[10px] bg-green-100">{assignmentCounts?.assigned}</Badge>
              </SelectItem>
            </SelectContent>
          </Select>
        )}

        {/* Agent filter */}
        {onAgentFilterChange && salesUsers && salesUsers.length > 0 && (
          <Select value={agentFilter} onValueChange={(v) => onAgentFilterChange(v)}>
            <SelectTrigger className="w-[160px] h-8 text-xs rounded-lg border-2 border-border">
              <Users className="h-3 w-3 mr-1.5 text-muted-foreground" />
              <SelectValue placeholder="All Agents" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Agents</SelectItem>
              <SelectItem value="unassigned">
                Unassigned <Badge variant="secondary" className="ml-1.5 h-4 px-1 text-[10px]">{agentLeadCounts?.['unassigned'] || 0} allocated</Badge>
                <span className="ml-1 text-[10px] text-muted-foreground">{agentLiveLeadCounts?.['unassigned'] ?? agentLeadCounts?.['unassigned'] ?? 0} live</span>
              </SelectItem>
              {salesUsers.map(user => (
                <SelectItem key={user.id} value={user.id}>
                  {user.first_name} {user.last_name}
                  <Badge variant="secondary" className="ml-1.5 h-4 px-1 text-[10px]">{agentLeadCounts?.[user.id] || 0} allocated</Badge>
                  <span className="ml-1 text-[10px] text-muted-foreground">{agentLiveLeadCounts?.[user.id] ?? agentLeadCounts?.[user.id] ?? 0} live</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Lead Source filter */}
        {onSourceFilterChange && (
          <Select value={sourceFilter} onValueChange={(v) => onSourceFilterChange(v as SourceFilter)}>
            <SelectTrigger className="w-[160px] h-8 text-xs rounded-lg border-2 border-border">
              <Globe className="h-3 w-3 mr-1.5 text-muted-foreground" />
              <SelectValue placeholder="All Sources" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                All Sources <Badge variant="secondary" className="ml-1.5 h-4 px-1 text-[10px]">{leadCounts.source_total ?? leadCounts.all_leads}</Badge>
              </SelectItem>
              <SelectItem value="google_ad">
                <span className="text-emerald-700 font-bold">G</span> Google Ads <Badge variant="secondary" className="ml-1.5 h-4 px-1 text-[10px] bg-emerald-100 text-emerald-800">{leadCounts.source_google ?? 0}</Badge>
                {(leadCounts.source_google_live ?? 0) !== (leadCounts.source_google ?? 0) && (
                  <span className="text-[10px] text-muted-foreground ml-1">({leadCounts.source_google_live ?? 0} live)</span>
                )}
              </SelectItem>
              <SelectItem value="social_ad">
                <span className="text-blue-700 font-bold">F</span> Facebook Ads <Badge variant="secondary" className="ml-1.5 h-4 px-1 text-[10px] bg-blue-100 text-blue-800">{leadCounts.source_facebook ?? 0}</Badge>
                {(leadCounts.source_facebook_live ?? 0) !== (leadCounts.source_facebook ?? 0) && (
                  <span className="text-[10px] text-muted-foreground ml-1">({leadCounts.source_facebook_live ?? 0} live)</span>
                )}
              </SelectItem>
              <SelectItem value="website">
                <span className="text-muted-foreground font-medium">O</span> Organic <Badge variant="secondary" className="ml-1.5 h-4 px-1 text-[10px]">{leadCounts.source_organic ?? 0}</Badge>
                {(leadCounts.source_organic_live ?? 0) !== (leadCounts.source_organic ?? 0) && (
                  <span className="text-[10px] text-muted-foreground ml-1">({leadCounts.source_organic_live ?? 0} live)</span>
                )}
              </SelectItem>
            </SelectContent>
          </Select>
        )}

        {/* Separator */}
        <div className="h-5 w-px bg-border/60" />

        {/* Sort */}
        {onSortChange && (
          <Select value={sortOption} onValueChange={(v) => onSortChange(v as SortOption)}>
            <SelectTrigger className="w-[130px] h-8 text-xs rounded-lg border-border/60">
              <ArrowUpDown className="h-3 w-3 mr-1.5 text-muted-foreground" />
              <SelectValue placeholder="Sort" />
            </SelectTrigger>
            <SelectContent className="bg-popover border shadow-lg z-50">
              {((filter as string) === 'reminders' || (filter as string) === 'due_today') && (
                <>
                  <SelectItem value="reminder_soonest">Reminder — Soonest</SelectItem>
                  <SelectItem value="reminder_latest">Reminder — Latest</SelectItem>
                </>
              )}
              <SelectItem value="latest_submitted">Newest submitted (default)</SelectItem>
              <SelectItem value="newest">Newest activity</SelectItem>
              <SelectItem value="oldest">Oldest first</SelectItem>
              <SelectItem value="contacted">Contacted first (bumps to top)</SelectItem>
              <SelectItem value="follow_up">Follow-up first (bumps to top)</SelectItem>
              <SelectItem value="quote_sent">Quote Sent first (bumps to top)</SelectItem>
            </SelectContent>
          </Select>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Action buttons — minimal, icon-forward */}
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => {
            onRefresh();
            const btn = document.getElementById('leads-refresh-btn');
            if (btn) {
              btn.classList.add('animate-spin');
              setTimeout(() => btn.classList.remove('animate-spin'), 1000);
            }
          }} 
          className="h-8 px-3 text-xs gap-1.5 rounded-md border-primary/30 bg-primary/5 hover:bg-primary/10 font-medium"
        >
          <RefreshCw id="leads-refresh-btn" className="h-3.5 w-3.5" /> Refresh Leads
        </Button>
        {(userRole === 'super_admin' || userRole === 'admin' || userRole === 'performance_manager' || userRole === 'lead_gen' || userRole === 'accounts_manager') && (
          <Button variant="ghost" size="sm" onClick={onMigrate} className="h-7 px-2 text-[11px] gap-1 rounded-md">
            <Upload className="h-3 w-3" /> Import
          </Button>
        )}
        {(userRole === 'super_admin' || userRole === 'admin' || userRole === 'performance_manager' || userRole === 'lead_gen' || userRole === 'accounts_manager') && (
          <Button variant="ghost" size="sm" onClick={() => onExport('csv')} className="h-7 px-2 text-[11px] gap-1 rounded-md">
            <Download className="h-3 w-3" /> CSV
          </Button>
        )}
      </div>
    </div>
  );
};
