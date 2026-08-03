import React, { useEffect, useState } from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Search, RefreshCw, Upload, Download, X, Filter, ArrowUpDown, Users, Globe, UserPlus, ChevronDown, Zap, Ban, XCircle, RotateCcw } from 'lucide-react';
import { LeadStatus } from '@/hooks/useLeads';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

export type AssignmentFilter = 'all' | 'all_leads' | 'total' | 'awaiting_contact' | 'assigned';
export type SortOption = 'newest' | 'oldest' | 'latest_submitted' | 'contacted' | 'follow_up' | 'quote_sent' | 'reminder_soonest' | 'reminder_latest';
export type SourceFilter = 'all' | 'google_ad' | 'social_ad' | 'bing_ad' | 'website';

interface SalesUser {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  role?: string;
}

interface LeadsFiltersProps {
  filter: LeadStatus | 'all' | 'all_leads' | 'live' | 'high_priority' | 'fake' | 'lost' | 'quote_sent' | 'urgent_callback' | 'converted' | 'callbacks' | 'recovered' | 'reminders' | 'due_today' | 'checkout_struggle' | 'repeat_today' | 'not_spoken_to' | 'no_answer' | 'left_voicemail' | 'wrong_number' | 'callback_booked' | 'bought_elsewhere' | 'vehicle_sold' | 'do_not_contact';
  onFilterChange: (filter: LeadStatus | 'all' | 'all_leads' | 'live' | 'high_priority' | 'fake' | 'lost' | 'quote_sent' | 'urgent_callback' | 'converted' | 'callbacks' | 'recovered' | 'reminders' | 'due_today' | 'checkout_struggle' | 'repeat_today' | 'not_spoken_to' | 'no_answer' | 'left_voicemail' | 'wrong_number' | 'callback_booked' | 'bought_elsewhere' | 'vehicle_sold' | 'do_not_contact') => void;
  /** Multi-select support — every pill in this set renders active and contributes to the union filter. */
  selectedFilters?: Set<string>;
  onToggleFilter?: (value: string) => void;
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
    overnight_queue?: number;
    checkout_struggle?: number;
    repeat_today?: number;
    not_spoken_to?: number;
    no_answer?: number;
    left_voicemail?: number;
    wrong_number?: number;
    callback_booked?: number;
    bought_elsewhere?: number;
    vehicle_sold?: number;
    do_not_contact?: number;
    source_total?: number;
    source_google?: number;
    source_facebook?: number;
    source_bing?: number;
    source_organic?: number;
    source_google_live?: number;
    source_facebook_live?: number;
    source_bing_live?: number;
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

  // Pagination + selection controls (merged from LeadsTableControlBar to save a row)
  totalItems?: number;
  pageSize?: number;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: number[];
  selectedCount?: number;
  totalVisible?: number;
  allSelected?: boolean;
  onSelectAll?: () => void;
  onBulkAssign?: (userId: string | null) => void;
  /** Split the selected leads evenly (round-robin) across several agents. */
  onBulkAssignMulti?: (userIds: string[]) => void;
  onBulkAutoAssign?: () => void;
  onBulkMarkFake?: () => void;
  onBulkMarkLost?: () => void;
  onBulkRestore?: () => void;
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
  { value: 'repeat_today', label: 'Back in this period', icon: '🔁', colorClass: 'data-[state=active]:bg-indigo-600 data-[state=active]:text-white', countKey: 'repeat_today' },
  { value: 'callbacks', label: 'Callbacks', icon: '📞', colorClass: 'data-[state=active]:bg-teal-600 data-[state=active]:text-white', countKey: 'callbacks' },
  { value: 'new', label: 'Not spoken to', icon: '🤐', colorClass: 'data-[state=active]:bg-green-600 data-[state=active]:text-white', countKey: 'new' },
  { value: 'no_answer', label: 'No answer', icon: '📵', colorClass: 'data-[state=active]:bg-slate-500 data-[state=active]:text-white', countKey: 'no_answer' },
  { value: 'left_voicemail', label: 'Left voicemail', icon: '🎙️', colorClass: 'data-[state=active]:bg-sky-600 data-[state=active]:text-white', countKey: 'left_voicemail' },
  { value: 'wrong_number', label: 'Wrong number', icon: '❌', colorClass: 'data-[state=active]:bg-rose-600 data-[state=active]:text-white', countKey: 'wrong_number' },
  { value: 'callback_booked', label: 'Callback booked', icon: '📅', colorClass: 'data-[state=active]:bg-blue-600 data-[state=active]:text-white', countKey: 'callback_booked' },
  { value: 'awaiting_contact', label: 'Awaiting', colorClass: 'data-[state=active]:bg-amber-500 data-[state=active]:text-white', countKey: 'all_leads', isAssignment: true },
  { value: 'contacted', label: 'Spoken to', colorClass: 'data-[state=active]:bg-yellow-500 data-[state=active]:text-white', countKey: 'contacted' },
  { value: 'follow_up', label: 'Follow-up', colorClass: 'data-[state=active]:bg-purple-600 data-[state=active]:text-white', countKey: 'follow_up' },
  { value: 'quote_sent', label: 'Quoted', colorClass: 'data-[state=active]:bg-indigo-600 data-[state=active]:text-white', countKey: 'quote_sent' },
  { value: 'paid', label: 'Paid', colorClass: 'data-[state=active]:bg-emerald-600 data-[state=active]:text-white', countKey: 'paid' },
  { value: 'converted', label: 'Won', icon: '✅', colorClass: 'data-[state=active]:bg-teal-600 data-[state=active]:text-white', countKey: 'converted' },
  { value: 'high_priority', label: 'Hot', icon: '🔥', colorClass: 'data-[state=active]:bg-orange-600 data-[state=active]:text-white', countKey: 'high_priority' },
  { value: 'bought_elsewhere', label: 'Bought elsewhere', icon: '🛒', colorClass: 'data-[state=active]:bg-zinc-600 data-[state=active]:text-white', countKey: 'bought_elsewhere' },
  { value: 'vehicle_sold', label: 'Vehicle sold', icon: '🚗', colorClass: 'data-[state=active]:bg-stone-600 data-[state=active]:text-white', countKey: 'vehicle_sold' },
  { value: 'do_not_contact', label: 'Do not contact', icon: '⛔', colorClass: 'data-[state=active]:bg-red-800 data-[state=active]:text-white', countKey: 'do_not_contact' },
  { value: 'lost', label: 'Lost', icon: '💀', colorClass: 'data-[state=active]:bg-gray-700 data-[state=active]:text-white', countKey: 'lost' },
  { value: 'fake', label: 'Fake 404', icon: '🚫', colorClass: 'data-[state=active]:bg-red-900 data-[state=active]:text-white', countKey: 'fake' },
  { value: 'reminders', label: 'Reminders', icon: '⏰', colorClass: 'data-[state=active]:bg-amber-600 data-[state=active]:text-white', countKey: 'reminders' },
  { value: 'due_today', label: 'Due Today', icon: '🔔', colorClass: 'data-[state=active]:bg-orange-500 data-[state=active]:text-white', countKey: 'due_today' },
  { value: 'overnight_queue', label: 'Overnight queue', icon: '🌙', colorClass: 'data-[state=active]:bg-indigo-600 data-[state=active]:text-white', countKey: 'overnight_queue' },
  { value: 'recovered', label: 'Recovered', icon: '🔄', colorClass: 'data-[state=active]:bg-cyan-700 data-[state=active]:text-white', countKey: 'recovered' },
];

export const LeadsFilters: React.FC<LeadsFiltersProps> = ({
  filter,
  onFilterChange,
  selectedFilters,
  onToggleFilter,
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

  totalItems = 0,
  pageSize = 250,
  onPageSizeChange,
  pageSizeOptions = [25, 50, 100, 200, 250],
  selectedCount = 0,
  totalVisible = 0,
  allSelected = false,
  onSelectAll,
  onBulkAssign,
  onBulkAssignMulti,
  onBulkAutoAssign,
  onBulkMarkFake,
  onBulkMarkLost,
  onBulkRestore,
}) => {
  const isAwaitingActive = assignmentFilter === 'awaiting_contact';

  // Multi-agent split: tick several agents and share the selected leads out
  // between them one-at-a-time (round-robin) in a single action.
  const [assignMenuOpen, setAssignMenuOpen] = useState(false);
  const [splitAgentIds, setSplitAgentIds] = useState<string[]>([]);
  const toggleSplitAgent = (id: string) =>
    setSplitAgentIds(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));



  // Fetch RR/ORR assignment mode per agent for the manager badge in the agent dropdown
  const isManagement = ['admin', 'super_admin', 'sales_manager'].includes((userRole || '').toLowerCase());
  const [agentModes, setAgentModes] = useState<Record<string, 'round_robin' | 'open_pool'>>({});
  useEffect(() => {
    if (!isManagement || !salesUsers?.length) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('agent_distribution_caps')
        .select('admin_user_id, assignment_mode');
      if (cancelled || !data) return;
      const map: Record<string, 'round_robin' | 'open_pool'> = {};
      for (const row of data as any[]) {
        map[row.admin_user_id] = (row.assignment_mode ?? 'round_robin') as any;
      }
      setAgentModes(map);
    })();
    return () => { cancelled = true; };
  }, [isManagement, salesUsers?.length]);

  // Multi-select support: if the parent passes selectedFilters/onToggleFilter,
  // pills toggle independently and the union drives the table. Otherwise fall
  // back to single-select via the original filter/onFilterChange contract.
  const multiSelect = !!(selectedFilters && onToggleFilter);

  const handlePillClick = (value: string, e?: React.MouseEvent) => {
    if (value === 'awaiting_contact') {
      onAssignmentFilterChange?.('awaiting_contact');
      return;
    }
    if (isAwaitingActive) onAssignmentFilterChange?.('all');
    if (multiSelect) {
      // Plain click = show ONLY this pill (what people expect from a filter).
      // Cmd/Ctrl/Shift-click = add or remove it from a combined selection.
      const additive = !!(e && (e.metaKey || e.ctrlKey || e.shiftKey));
      if (additive) onToggleFilter!(value);
      else onFilterChange(value as any);
      return;
    }
    onFilterChange(value as any);
  };

  const isPillActive = (value: string) => {
    if (isAwaitingActive && value === 'awaiting_contact') return true;
    if (multiSelect) return selectedFilters!.has(value);
    return filter === value;
  };

  const getCount = (pill: typeof STATUS_PILLS[0]) => {
    if (pill.isAssignment) return assignmentCounts?.awaiting_contact ?? 0;
    return leadCounts[pill.countKey] ?? 0;
  };

  // Convert "data-[state=active]:bg-X data-[state=active]:text-Y" into raw
  // "bg-X text-Y" classes so the plain-button pills can render the active look
  // without relying on Radix's Tabs state attribute.
  const activeColorClass = (colorClass: string) =>
    colorClass.replace(/data-\[state=active\]:/g, '');

  const getInitials = (user: SalesUser) => {
    if (user.first_name || user.last_name) {
      return `${user.first_name?.[0] || ''}${user.last_name?.[0] || ''}`.toUpperCase();
    }
    return user.email[0].toUpperCase();
  };

  const getDisplayName = (user: SalesUser) => {
    if (user.first_name || user.last_name) {
      return `${user.first_name || ''} ${user.last_name || ''}`.trim();
    }
    return user.email;
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

      {/* Row 2: Status pills — multi-select. Click any pill to toggle it into
          the active filter set; the table shows the union across all selected
          pills. Awaiting is still driven by assignmentFilter (single-select). */}
      <div className="h-auto p-1 bg-muted/40 border border-border rounded-xl flex flex-wrap gap-1">
        {STATUS_PILLS.filter(pill => {
          if (pill.value === 'recovered' && !showRecoveredPill) return false;
          return true;
        }).map(pill => {
          const count = getCount(pill);
          const isActive = isPillActive(pill.value);
          return (
            <button
              key={pill.value}
              type="button"
              onClick={(e) => handlePillClick(pill.value, e)}
              aria-pressed={isActive}
              className={cn(
                "h-9 px-3 rounded-lg text-xs font-semibold transition-all duration-150 gap-1.5 inline-flex items-center",
                isActive
                  ? cn("shadow-sm", activeColorClass(pill.colorClass))
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/80"
              )}
              title={multiSelect ? `Toggle ${pill.label} — combines with other selected pills` : undefined}
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
            </button>
          );
        })}
      </div>

      {/* Row 3: Filters + Actions + Selection + Pagination — merged into one compact row */}
      <div className="flex items-center gap-2">
        {/* Select all + selection count */}
        {onSelectAll && (
          <label
            className="flex items-center gap-1.5 h-7 px-2 rounded-md border border-border bg-background hover:bg-muted cursor-pointer select-none"
            title={allSelected ? 'Clear selection' : 'Select all visible leads'}
          >
            <Checkbox
              checked={allSelected && totalVisible > 0}
              onCheckedChange={onSelectAll}
              aria-label="Select all leads"
              className="h-4 w-4"
            />
            <span className="text-[11px] font-medium">
              {selectedCount > 0 ? (
                <span className="text-primary">{selectedCount} selected</span>
              ) : (
                <span className="text-muted-foreground">Select all</span>
              )}
            </span>
          </label>
        )}


        {/* Bulk actions — always visible for management (greyed out until leads
            are ticked) so the Assign to / multi-agent split is discoverable
            without having to hit "Select all" first. */}
        {(selectedCount > 0 || isManagement) && (
          <div className="flex items-center gap-1.5">
            {/* Assign dropdown */}
            {onBulkAssign && salesUsers && salesUsers.length > 0 && (
              <DropdownMenu open={assignMenuOpen} onOpenChange={(o) => { setAssignMenuOpen(o); if (!o) setSplitAgentIds([]); }}>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs gap-1.5"
                    disabled={selectedCount === 0}
                    title={selectedCount === 0 ? 'Tick some leads (or Select all) to assign them' : 'Assign the selected leads'}
                  >
                    <UserPlus className="h-3.5 w-3.5" />
                    Assign to
                    <ChevronDown className="h-3 w-3 opacity-60" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-72 p-0">
                  <div className="max-h-80 overflow-y-auto p-1">
                    <DropdownMenuItem onClick={() => onBulkAssign(null)} className="gap-2">
                      <X className="h-4 w-4 text-muted-foreground" />
                      <span>Remove assignment</span>
                    </DropdownMenuItem>
                    {onBulkAutoAssign && (
                      <DropdownMenuItem onClick={onBulkAutoAssign} className="gap-2 text-green-600">
                        <Zap className="h-4 w-4" />
                        <span>Auto-assign (next available)</span>
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    {onBulkAssignMulti && (
                      <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Tick more than one agent to share the leads out
                      </div>
                    )}
                    {salesUsers.map((user) => {
                      const ticked = splitAgentIds.includes(user.id);
                      return (
                        <div
                          key={user.id}
                          className={cn(
                            'flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent',
                            ticked && 'bg-primary/5'
                          )}
                        >
                          {onBulkAssignMulti && (
                            <Checkbox
                              checked={ticked}
                              onCheckedChange={() => toggleSplitAgent(user.id)}
                              aria-label={`Include ${getDisplayName(user)} in split`}
                              className="h-4 w-4"
                            />
                          )}
                          <button
                            type="button"
                            className="flex flex-1 items-center gap-2 min-w-0 text-left"
                            onClick={() => {
                              if (splitAgentIds.length > 0 && onBulkAssignMulti) {
                                toggleSplitAgent(user.id);
                                return;
                              }
                              onBulkAssign(user.id);
                              setAssignMenuOpen(false);
                            }}
                          >
                            <Avatar className="h-6 w-6">
                              <AvatarFallback className="text-xs bg-primary/10 text-primary">
                                {getInitials(user)}
                              </AvatarFallback>
                            </Avatar>
                            <span className="truncate">{getDisplayName(user)}</span>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                  {onBulkAssignMulti && splitAgentIds.length > 0 && (
                    <div className="border-t p-2 space-y-1.5 bg-muted/30">
                      <p className="text-[11px] text-muted-foreground">
                        {selectedCount} lead{selectedCount === 1 ? '' : 's'} shared one-at-a-time
                        across {splitAgentIds.length} agent{splitAgentIds.length === 1 ? '' : 's'}
                        {splitAgentIds.length > 1 && ` (~${Math.floor(selectedCount / splitAgentIds.length)} each)`}
                      </p>
                      <Button
                        size="sm"
                        className="w-full h-7 text-xs"
                        onClick={() => {
                          onBulkAssignMulti(splitAgentIds);
                          setSplitAgentIds([]);
                          setAssignMenuOpen(false);
                        }}
                      >
                        <Users className="h-3.5 w-3.5 mr-1" />
                        Split across {splitAgentIds.length} agent{splitAgentIds.length === 1 ? '' : 's'}
                      </Button>
                    </div>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {onBulkMarkFake && (
              <Button variant="outline" size="sm" disabled={selectedCount === 0} title={selectedCount === 0 ? 'Tick some leads first' : undefined} className="h-7 text-xs gap-1.5 border-destructive/40 text-destructive hover:bg-destructive/10" onClick={onBulkMarkFake}>
                <Ban className="h-3.5 w-3.5" />
                Fake 404
              </Button>
            )}

            {onBulkMarkLost && (
              <Button variant="outline" size="sm" disabled={selectedCount === 0} title={selectedCount === 0 ? 'Tick some leads first' : undefined} className="h-7 text-xs gap-1.5 text-muted-foreground hover:bg-muted" onClick={onBulkMarkLost}>
                <XCircle className="h-3.5 w-3.5" />
                Lost
              </Button>
            )}

            {onBulkRestore && (
              <Button variant="outline" size="sm" disabled={selectedCount === 0} title={selectedCount === 0 ? 'Tick some leads first' : undefined} className="h-7 text-xs gap-1.5 text-green-700 border-green-300 hover:bg-green-50" onClick={onBulkRestore}>
                <RotateCcw className="h-3.5 w-3.5" />
                Restore
              </Button>
            )}
          </div>
        )}

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
              {salesUsers
                // Only actual sales people belong in this list. Non-sales staff
                // (claims, admin, accounts) are never lead owners, so they must
                // not appear as random names. Anyone who still holds leads stays
                // visible so historical filtering keeps working.
                .filter(user => {
                  const isSalesRole = user.role === 'sales' || user.role === 'sales_lead';
                  const holdsLeads =
                    (agentLeadCounts?.[user.id] || 0) > 0 ||
                    (agentLiveLeadCounts?.[user.id] || 0) > 0;
                  return isSalesRole || holdsLeads;
                })
                .map(user => {
                const mode = agentModes[user.id];
                const isORR = mode === 'open_pool';
                return (
                <SelectItem key={user.id} value={user.id}>
                  {user.first_name} {user.last_name}
                  {isManagement && mode && (
                    <Badge
                      variant="outline"
                      className={cn(
                        'ml-1.5 h-4 px-1 text-[9px] font-bold',
                        isORR ? 'bg-emerald-100 text-emerald-700 border-emerald-300' : 'bg-blue-100 text-blue-700 border-blue-300'
                      )}
                    >
                      {isORR ? 'ORR' : 'RR'}
                    </Badge>
                  )}
                  <Badge variant="secondary" className="ml-1.5 h-4 px-1 text-[10px]">{agentLeadCounts?.[user.id] || 0} allocated</Badge>
                  <span className="ml-1 text-[10px] text-muted-foreground">{agentLiveLeadCounts?.[user.id] ?? agentLeadCounts?.[user.id] ?? 0} live</span>
                </SelectItem>
                );
              })}
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
              <SelectItem value="bing_ad">
                <span className="text-teal-700 font-bold">B</span> Bing Ads <Badge variant="secondary" className="ml-1.5 h-4 px-1 text-[10px] bg-teal-100 text-teal-800">{leadCounts.source_bing ?? 0}</Badge>
                {(leadCounts.source_bing_live ?? 0) !== (leadCounts.source_bing ?? 0) && (
                  <span className="text-[10px] text-muted-foreground ml-1">({leadCounts.source_bing_live ?? 0} live)</span>
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

        {/* Total leads + pagination */}
        {onPageSizeChange && (
          <div className="flex items-center gap-2">
            <div className="text-[11px] text-muted-foreground">
              <span className="font-semibold text-foreground">{totalItems.toLocaleString()}</span>
              {' '}leads
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-muted-foreground">Per page</span>
              <Select value={String(pageSize)} onValueChange={(v) => onPageSizeChange(Number(v))}>
                <SelectTrigger className="h-6 w-[64px] text-[10px] px-2 py-0 rounded-md">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent align="end" className="min-w-[64px]">
                  {pageSizeOptions.map((size) => (
                    <SelectItem key={size} value={String(size)} className="text-[11px] py-1">
                      {size}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {/* Action buttons */}
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
