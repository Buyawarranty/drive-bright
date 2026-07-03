import React, { useState, useEffect, useMemo } from 'react';
import { Users, FileText, Car, BarChart3, Mail, MailX, Settings, Menu, X, TestTube, Percent, Shield, FolderOpen, Receipt, MessageSquare, PenTool, ShoppingCart, Calculator, GripVertical, UserPlus, Clock, Globe, Target, Lightbulb, CalendarClock, Star, Megaphone, Eye, Trophy, Database, ChevronsUpDown, Check, Ban, LogOut, UserCog, FlaskConical, AlertTriangle, RotateCcw, Repeat, Gem, Wifi, PanelLeftClose, PanelLeftOpen, PhoneCall } from 'lucide-react';
import { useAdminSidebarCollapsed } from '@/hooks/useAdminSidebarCollapsed';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { SidebarTeamSwitcher } from './SidebarTeamSwitcher';
import { useNewLeadAlert } from '@/hooks/useNewLeadAlert';
interface Tab {
  id: string;
  label: string;
  icon: React.ComponentType<any>;
  description: string;
}

interface AdminSidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  userRole?: string | null;
  userPermissions?: Record<string, boolean> | null;
}

interface SortableTabProps {
  tab: Tab;
  isActive: boolean;
  onClick: () => void;
  collapsed?: boolean;
}

const CLAIMS_AGENT_TABS = ['claims', 'complaints', 'customers', 'discount-codes', 'discounts-given', 'cancellations', 'refunds-paid', 'staff-hub', 'unsubscribe', 'account'];
const CLAIMS_MANAGER_TABS = ['claims', 'complaints', 'staff-hub', 'unsubscribe', 'account'];

const hasExplicitTopLevelTabPermissions = (permissions?: Record<string, boolean> | null) => {
  return !!permissions && Object.keys(permissions).some(key => /^tab_[^_]+$/.test(key));
};

const SortableTab: React.FC<SortableTabProps> = ({ tab, isActive, onClick, collapsed }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: tab.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const Icon = tab.icon;

  if (collapsed) {
    return (
      <div ref={setNodeRef} style={style} className="relative group">
        <Tooltip delayDuration={100}>
          <TooltipTrigger asChild>
            <button
              onClick={onClick}
              aria-label={tab.label}
              className={`w-full flex items-center justify-center py-3 hover:bg-gray-50 transition-colors ${
                isActive ? 'bg-orange-50 border-r-4 border-orange-600 text-orange-700' : 'text-gray-700'
              }`}
            >
              <Icon className={`h-5 w-5 ${isActive ? 'text-orange-600' : 'text-gray-500'}`} />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right" className="text-xs font-medium">{tab.label}</TooltipContent>
        </Tooltip>
      </div>
    );
  }

  return (
    <div ref={setNodeRef} style={style} className="relative group">
      <button
        onClick={onClick}
        className={`w-full text-left px-4 lg:px-6 py-3 lg:py-4 flex items-start space-x-3 hover:bg-gray-50 transition-colors ${
          isActive 
            ? 'bg-orange-50 border-r-4 border-orange-600 text-orange-700' 
            : 'text-gray-700'
        }`}
      >
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <GripVertical className="h-5 w-5 text-gray-400" />
        </div>
        <Icon className={`h-5 w-5 mt-0.5 flex-shrink-0 ${
          isActive ? 'text-orange-600' : 'text-gray-500'
        }`} />
        <div className="min-w-0">
          <div className="font-medium text-sm lg:text-base">{tab.label}</div>
          <div className="text-xs text-gray-500 mt-1 hidden lg:block">{tab.description}</div>
        </div>
      </button>
    </div>
  );
};

const defaultTabs: Tab[] = [
  {
    id: 'new-leads',
    label: 'New Leads',
    icon: Target,
    description: 'Manage sales pipeline and lead assignments'
  },
  {
    id: 'call-tracking',
    label: 'Call Tracking',
    icon: PhoneCall,
    description: 'CallRail tracker assignments, banners and inbound-call analytics'
  },
  {
    id: 'recontact-leads',
    label: 'Recontact Leads',
    icon: Gem,
    description: 'Past enquiries ready for follow-up'
  },
  {
    id: 'renewals',
    label: 'Renewals',
    icon: Repeat,
    description: 'Renewals + upsells for active customers'
  },
  {
    id: 'get-quote',
    label: 'Quotes & Orders',
    icon: Calculator,
    description: 'Create quotes or confirm paid orders'
  },
  {
    id: 'selling-tips',
    label: 'Sales Script',
    icon: Lightbulb,
    description: 'Sales script, tips and customer feedback'
  },
  {
    id: 'customers',
    label: 'Customers',
    icon: Users,
    description: 'Manage customer accounts and policies'
  },
  {
    id: 'plans',
    label: 'Terms & Conditions',
    icon: FileText,
    description: 'Upload Terms & Conditions and Platinum Plan PDFs'
  },
  {
    id: 'bulk-pricing',
    label: 'Bulk Pricing',
    icon: Receipt,
    description: 'Update pricing using CSV files'
  },
  {
    id: 'special-plans',
    label: 'Special Vehicle Plans',
    icon: Car,
    description: 'Manage EV, PHEV, and Motorbike plans'
  },
  {
    id: 'discount-codes',
    label: 'Discount Codes',
    icon: Percent,
    description: 'Manage discount codes and promotions'
  },
  {
    id: 'referrals',
    label: 'Referrals',
    icon: UserPlus,
    description: 'Track customer referrals and conversions'
  },
  {
    id: 'claims',
    label: 'Claims',
    icon: MessageSquare,
    description: 'Manage customer claim submissions'
  },
  {
    id: 'complaints',
    label: 'Complaints',
    icon: AlertTriangle,
    description: 'Manage customer complaints and resolutions'
  },
  {
    id: 'reviews',
    label: 'Reviews',
    icon: Star,
    description: 'Monitor Trustpilot and Google reviews'
  },
  {
    id: 'contact',
    label: 'Contact Submissions',
    icon: Mail,
    description: 'Manage customer contact form submissions'
  },
  {
    id: 'abandoned-carts',
    label: 'Abandoned Carts',
    icon: ShoppingCart,
    description: 'Track and follow up with incomplete purchases'
  },
  {
    id: 'marketing-audience',
    label: 'Marketing Contacts',
    icon: Megaphone,
    description: 'Unified mailing list for remarketing'
  },
  {
    id: 'emails',
    label: 'Email Hub',
    icon: Mail,
    description: 'Unified email management: templates, campaigns, analytics & automation'
  },
  {
    id: 'analytics',
    label: 'Analytics',
    icon: BarChart3,
    description: 'View reports and analytics'
  },
  {
    id: 'page-analytics',
    label: 'Page Analytics',
    icon: Eye,
    description: 'Track page visits, traffic sources & Google Ads'
  },
  {
    id: 'google-ads',
    label: 'Marketing Analytics',
    icon: Target,
    description: 'Google Ads, Facebook Ads, conversions & ROAS'
  },
  {
    id: 'ab-testing',
    label: 'A/B Testing',
    icon: FlaskConical,
    description: 'Compare A vs B variants: visits, submissions, conversions'
  },
  {
    id: 'vehicle-stats',
    label: 'Vehicle Stats',
    icon: Car,
    description: 'Analyse which vehicles sell the most warranties'
  },
  {
    id: 'lead-backup',
    label: 'Lead Backup & Recovery',
    icon: Database,
    description: 'Backup all contacts, export & sync to marketing'
  },
  {
    id: 'lead-teams',
    label: 'Lead Allocation',
    icon: Users,
    description: 'Assign agents to teams (red, blue, green) and manage lead routing'
  },
  {
    id: 'user-permissions',
    label: 'User Permissions',
    icon: Shield,
    description: 'Manage admin user access and permissions'
  },
  {
    id: 'document-mapping',
    label: 'Document Mapping',
    icon: FolderOpen,
    description: 'Manage plan to document mappings'
  },
  {
    id: 'policy-documents',
    label: 'Policy Letters',
    icon: FileText,
    description: 'Generate printable A4 policy letters for customers'
  },
  {
    id: 'blog-writing',
    label: 'Blog Writing',
    icon: PenTool,
    description: 'Create and manage blog content with AI tools'
  },
  {
    id: 'landing-pages',
    label: 'Landing Pages',
    icon: Globe,
    description: 'Create SEO-optimised landing pages from homepage template'
  },
  {
    id: 'testing',
    label: 'Testing',
    icon: TestTube,
    description: 'Test APIs and create test data'
  },
  {
    id: 'timesheets',
    label: 'Timesheets',
    icon: CalendarClock,
    description: 'Track work hours, deals and commissions'
  },
  {
    id: 'attendance',
    label: 'Attendance',
    icon: Wifi,
    description: 'See who is live in the CRM, idle, or offline (managers)'
  },
  {
    id: 'sales-scoreboard',
    label: 'Sales Scoreboard',
    icon: Trophy,
    description: 'Leaderboard, awards and sales competition'
  },
  {
    id: 'discounts-given',
    label: 'Discounts Given',
    icon: Percent,
    description: 'Track agent discounts vs retail pricing'
  },
  {
    id: 'cancellations',
    label: 'Cancellations',
    icon: Ban,
    description: 'Cancelled and refunded warranties for commission reconciliation'
  },
  {
    id: 'refunds-paid',
    label: 'Refunds Paid',
    icon: Ban,
    description: 'Refunds issued to customers for commission reconciliation'
  },
  {
    id: 'attribution-settings',
    label: 'Attribution Settings',
    icon: Target,
    description: 'Control how leads are tagged Organic / Google / Facebook'
  },
  {
    id: 'feature-flags',
    label: 'Feature Flags',
    icon: Settings,
    description: 'Switch features on or off across the site (admin only)'
  },
  {
    id: 'ghl-sync-log',
    label: 'GHL Sync Log',
    icon: Database,
    description: 'Success / Error log for every push to GoHighLevel'
  },
  {
    id: 'staff-hub',
    label: 'Staff Hub',
    icon: FolderOpen,
    description: 'Staff policies, timesheet rules, holiday & handbook documents'
  },
  {
    id: 'unsubscribe',
    label: 'Unsubscribe',
    icon: MailX,
    description: 'Opt a customer out of all marketing emails by entering their email'
  },
  {
    id: 'account',
    label: 'Account Settings',
    icon: Settings,
    description: 'Manage your account and password'
  }
];

export const AdminSidebar: React.FC<AdminSidebarProps> = ({ activeTab, onTabChange, userRole, userPermissions }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [tabs, setTabs] = useState<Tab[]>(defaultTabs);
  const { collapsed, toggle: toggleCollapsed } = useAdminSidebarCollapsed();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem('masterAdmin');
    navigate('/auth');
  };

  const handleChangeUser = async () => {
    // Sign out and return to login so a different user can sign in
    await supabase.auth.signOut();
    localStorage.removeItem('masterAdmin');
    navigate('/auth');
  };


  // Filter tabs based on user role and permissions
  const getVisibleTabs = () => {
    // Super admins, admins and dev_testers see all tabs (admins filtered by permissions)
    if (userRole === 'super_admin' || userRole === 'dev_tester') {
      return defaultTabs;
    }
    
    // Tabs that are super_admin / dev_tester only by default.
    // Even Admin role must be explicitly granted via tab_<id> = true.
    const SUPER_ADMIN_ONLY_TABS = new Set<string>(['plans']);

    // Administrators: full access except tabs explicitly denied in permissions,
    // and excluding super-admin-only tabs unless explicitly granted.
    if (userRole === 'admin') {
      return defaultTabs.filter(tab => {
        const permKey = `tab_${tab.id}`;
        if (SUPER_ADMIN_ONLY_TABS.has(tab.id)) {
          return userPermissions?.[permKey] === true;
        }
        if (userPermissions && permKey in userPermissions && userPermissions[permKey] === false) {
          return false;
        }
        return true;
      });
    }
    
    if (userRole === 'blog_writer') {
      // Blog writers see blog-writing and landing-pages tabs + Staff Hub
      return defaultTabs.filter(tab => tab.id === 'blog-writing' || tab.id === 'landing-pages' || tab.id === 'staff-hub' || tab.id === 'unsubscribe' || tab.id === 'account');
    }

    if (userRole === 'lead_gen') {
      const leadGenTabIds = new Set([
        'new-leads', 'recontact-leads', 'get-quote', 'customers',
        'abandoned-carts', 'marketing-audience', 'emails',
        'analytics', 'page-analytics', 'google-ads',
        'call-tracking',
        'selling-tips', 'discount-codes', 'staff-hub', 'unsubscribe', 'account'
      ]);
      if (userPermissions && Object.keys(userPermissions).length > 0) {
        defaultTabs.forEach(tab => {
          const permKey = `tab_${tab.id}`;
          if (userPermissions[permKey] === true) leadGenTabIds.add(tab.id);
          if (userPermissions[permKey] === false && tab.id !== 'unsubscribe') leadGenTabIds.delete(tab.id);
        });
      }
      return defaultTabs.filter(tab => leadGenTabIds.has(tab.id));
    }
    
    if (userRole === 'sales_lead') {
      const salesLeadTabIds = ['new-leads', 'call-tracking', 'recontact-leads', 'get-quote', 'sales-scoreboard', 'customers', 'analytics', 'selling-tips', 'discount-codes', 'timesheets', 'staff-hub', 'lead-teams', 'unsubscribe', 'account'];
      return defaultTabs.filter(tab => salesLeadTabIds.includes(tab.id));
    }

    if (userRole === 'sales_manager' || userRole === 'performance_manager') {
      // Managers should see exactly the saved tab access from User Permissions when set.
      if (hasExplicitTopLevelTabPermissions(userPermissions)) {
        return defaultTabs.filter(tab =>
          tab.id === 'account' ||
          tab.id === 'unsubscribe' ||
          tab.id === 'call-tracking' ||
          userPermissions?.[`tab_${tab.id}`] === true
        );
      }

      const baseIds = new Set(['new-leads', 'call-tracking', 'recontact-leads', 'get-quote', 'sales-scoreboard', 'customers', 'analytics', 'selling-tips', 'discount-codes', 'timesheets', 'staff-hub', 'lead-teams', 'user-permissions', 'claims', 'unsubscribe', 'account']);
      return defaultTabs.filter(tab => baseIds.has(tab.id));
    }

    if (userRole === 'accounts_manager' || userRole === 'accounts_payroll') {
      const accountsTabIds = ['customers', 'timesheets', 'analytics', 'user-permissions', 'discounts-given', 'cancellations', 'refunds-paid', 'staff-hub', 'unsubscribe', 'account'];
      return defaultTabs.filter(tab => accountsTabIds.includes(tab.id));
    }

    if (userRole === 'claims_agent' || userRole === 'claims_manager') {
      const defaultClaimsTabIds = userRole === 'claims_agent' ? CLAIMS_AGENT_TABS : CLAIMS_MANAGER_TABS;
      if (userPermissions && Object.keys(userPermissions).length > 0) {
        const allowedIds = new Set(defaultClaimsTabIds);
        defaultTabs.forEach(tab => {
          const permKey = `tab_${tab.id}`;
          if (userPermissions[permKey] === true) allowedIds.add(tab.id);
          if (userPermissions[permKey] === false && tab.id !== 'unsubscribe') allowedIds.delete(tab.id);
        });
        return defaultTabs.filter(tab => allowedIds.has(tab.id));
      }

      return defaultTabs.filter(tab => defaultClaimsTabIds.includes(tab.id));
    }

    if (userRole === 'accounts') {
      const accountsTabIds = ['new-leads', 'get-quote', 'customers', 'discount-codes', 'discounts-given', 'cancellations', 'refunds-paid', 'policy-documents', 'timesheets', 'staff-hub', 'unsubscribe', 'account'];
      return defaultTabs.filter(tab => accountsTabIds.includes(tab.id));
    }

    if (userRole === 'sales') {
      // Default sales agent tabs - always visible for Thomas, Ash and any new sales agent
      const defaultSalesTabIds = ['new-leads', 'recontact-leads', 'get-quote', 'sales-scoreboard', 'selling-tips', 'discount-codes', 'timesheets', 'staff-hub', 'unsubscribe', 'account'];

      if (userPermissions && Object.keys(userPermissions).length > 0) {
        const allowedIds = new Set(defaultSalesTabIds);
        defaultTabs.forEach(tab => {
          const permKey = `tab_${tab.id}`;
          if (userPermissions[permKey] === true) allowedIds.add(tab.id);
        });
        return defaultTabs.filter(tab => allowedIds.has(tab.id));
      }

      return defaultTabs.filter(tab => defaultSalesTabIds.includes(tab.id));
    }
    
    
    // For member, viewer, guest - check tab permissions
    if (userPermissions && Object.keys(userPermissions).length > 0) {
      const allowedTabs = defaultTabs.filter(tab => {
        const permKey = `tab_${tab.id}`;
        // Always show account settings
        if (tab.id === 'account') return true;
        // Check specific permission for the tab
        return userPermissions[permKey] === true;
      });
      
      // If no tabs are permitted, show at least account settings
      return allowedTabs.length > 0 ? allowedTabs : defaultTabs.filter(tab => tab.id === 'account');
    }
    
    // Fallback for member/viewer/guest without specific permissions - show common tabs
    // Admin role already returns all tabs above
    return defaultTabs;
  };

  // Staff Hub is available to all staff
  const filterRestricted = (tabs: Tab[]) => tabs;

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Load saved order from localStorage (only for non-blog writers and non-sales)
  useEffect(() => {
    const visibleTabs = filterRestricted(getVisibleTabs());
    
    // Blog writers and sales users don't need custom ordering
    if (userRole === 'blog_writer' || userRole === 'sales' || userRole === 'sales_lead' || userRole === 'sales_manager' || userRole === 'performance_manager' || userRole === 'dev_tester' || userRole === 'accounts_payroll' || userRole === 'lead_gen' || userRole === 'accounts' || userRole === 'claims_agent' || userRole === 'claims_manager') {
      setTabs(visibleTabs);
      return;
    }
    
    const savedOrder = localStorage.getItem('adminSidebarOrder');
    if (savedOrder) {
      try {
        const orderIds = JSON.parse(savedOrder);
        const orderedTabs = orderIds
          .map((id: string) => visibleTabs.find(tab => tab.id === id))
          .filter(Boolean);
        
        // Add any new tabs that weren't in saved order
        const existingIds = new Set(orderIds);
        const newTabs = visibleTabs.filter(tab => !existingIds.has(tab.id));
        
        setTabs([...orderedTabs, ...newTabs] as Tab[]);
      } catch (e) {
        console.error('Failed to load sidebar order:', e);
        setTabs(visibleTabs);
      }
    } else {
      setTabs(visibleTabs);
    }
  }, [userRole, userPermissions]);

  // Save order to localStorage whenever it changes
  const saveOrder = (newTabs: Tab[]) => {
    const orderIds = newTabs.map(tab => tab.id);
    localStorage.setItem('adminSidebarOrder', JSON.stringify(orderIds));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setTabs((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        const newTabs = arrayMove(items, oldIndex, newIndex);
        saveOrder(newTabs);
        return newTabs;
      });
    }
  };

  const handleTabClick = (tabId: string) => {
    onTabChange(tabId);
    setIsOpen(false);
  };

  const [jumpOpen, setJumpOpen] = useState(false);
  const sortedTabs = useMemo(() => [...tabs].sort((a, b) => a.label.localeCompare(b.label)), [tabs]);
  const activeLabel = tabs.find(t => t.id === activeTab)?.label || 'Select tab...';

  return (
    <TooltipProvider>
      {/* Mobile menu button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 bg-white p-2 rounded-lg shadow-md border"
      >
        {isOpen ? <X className="h-16 w-16" /> : <Menu className="h-16 w-16" />}
      </button>

      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={cn(
        'fixed left-0 top-[104px] h-[calc(100vh-104px)] bg-white shadow-lg border-r z-40 transform transition-all duration-300 ease-in-out overflow-hidden',
        collapsed ? 'lg:w-14 w-64' : 'w-64',
        isOpen ? 'translate-x-0' : '-translate-x-full',
        'lg:translate-x-0',
      )}>
        {collapsed ? (
          <div className="p-2 border-b flex justify-center">
            <Tooltip delayDuration={100}>
              <TooltipTrigger asChild>
                <button
                  onClick={toggleCollapsed}
                  aria-label="Expand sidebar"
                  className="h-9 w-9 inline-flex items-center justify-center rounded-md hover:bg-gray-100 text-gray-600"
                >
                  <PanelLeftOpen className="h-5 w-5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="text-xs">Expand sidebar</TooltipContent>
            </Tooltip>
          </div>
        ) : (
          <div className="p-4 lg:p-6 border-b space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="text-lg lg:text-xl font-bold text-gray-800">Admin Panel</h2>
                <p className="text-sm text-gray-600">Manage your warranty business</p>
              </div>
              <Tooltip delayDuration={100}>
                <TooltipTrigger asChild>
                  <button
                    onClick={toggleCollapsed}
                    aria-label="Collapse sidebar"
                    className="hidden lg:inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-gray-100 text-gray-500 shrink-0"
                  >
                    <PanelLeftClose className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="text-xs">Collapse sidebar</TooltipContent>
              </Tooltip>
            </div>
            {/* Searchable quick-jump dropdown */}
            <Popover open={jumpOpen} onOpenChange={setJumpOpen}>
              <PopoverTrigger asChild>
                <button
                  role="combobox"
                  aria-expanded={jumpOpen}
                  className="w-full flex items-center justify-between text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                >
                  <span className="truncate">{activeLabel}</span>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-[232px] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Search tabs..." />
                  <CommandList>
                    <CommandEmpty>No tab found.</CommandEmpty>
                    <CommandGroup>
                      {sortedTabs.map((tab) => (
                        <CommandItem
                          key={tab.id}
                          value={tab.label}
                          onSelect={() => {
                            handleTabClick(tab.id);
                            setJumpOpen(false);
                          }}
                        >
                          <Check className={cn("mr-2 h-4 w-4", activeTab === tab.id ? "opacity-100" : "opacity-0")} />
                          {tab.label}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                    <CommandSeparator />
                    <CommandGroup heading="Account">
                      <CommandItem
                        value="change user"
                        onSelect={() => { setJumpOpen(false); handleChangeUser(); }}
                      >
                        <UserCog className="mr-2 h-4 w-4" />
                        Change User
                      </CommandItem>
                      <CommandItem
                        value="sign out"
                        onSelect={() => { setJumpOpen(false); handleSignOut(); }}
                        className="text-red-600"
                      >
                        <LogOut className="mr-2 h-4 w-4" />
                        Sign Out
                      </CommandItem>
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            <SidebarTeamSwitcher userRole={userRole} />
          </div>
        )}


        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <nav className={cn(
            'mt-2 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100 pb-4',
            collapsed ? 'h-[calc(100%-120px)]' : 'h-[calc(100%-180px)]',
          )}>

            <SortableContext
              items={tabs.map(tab => tab.id)}
              strategy={verticalListSortingStrategy}
            >
              {tabs.map((tab) => (
                <SortableTab
                  key={tab.id}
                  tab={tab}
                  isActive={activeTab === tab.id}
                  onClick={() => handleTabClick(tab.id)}
                  collapsed={collapsed}
                />
              ))}
            </SortableContext>
          </nav>
        </DndContext>

        {/* Sticky footer: Change User + Sign Out */}
        <div className="absolute bottom-0 left-0 right-0 border-t bg-white p-2 space-y-1">
          {collapsed ? (
            <>
              <Tooltip delayDuration={100}>
                <TooltipTrigger asChild>
                  <button
                    onClick={handleChangeUser}
                    aria-label="Change user"
                    className="w-full flex items-center justify-center py-2 text-gray-700 hover:bg-gray-50 rounded-md transition-colors"
                  >
                    <UserCog className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="text-xs">Change user</TooltipContent>
              </Tooltip>
              <Tooltip delayDuration={100}>
                <TooltipTrigger asChild>
                  <button
                    onClick={handleSignOut}
                    aria-label="Sign out"
                    className="w-full flex items-center justify-center py-2 text-red-600 hover:bg-red-50 rounded-md transition-colors"
                  >
                    <LogOut className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="text-xs">Sign out</TooltipContent>
              </Tooltip>
            </>
          ) : (
            <>
              <button
                onClick={handleChangeUser}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-md transition-colors"
              >
                <UserCog className="h-4 w-4" />
                Change User
              </button>
              <button
                onClick={handleSignOut}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-md transition-colors"
              >
                <LogOut className="h-4 w-4" />
                Sign Out
              </button>
            </>
          )}
        </div>
      </div>

    </TooltipProvider>
  );
};
