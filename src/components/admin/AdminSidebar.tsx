import React, { useState, useEffect, useMemo } from 'react';
import { Users, FileText, Car, BarChart3, Mail, Settings, Menu, X, TestTube, Percent, Shield, FolderOpen, Receipt, MessageSquare, PenTool, ShoppingCart, Calculator, GripVertical, UserPlus, Clock, Globe, Target, Lightbulb, CalendarClock, Star, Megaphone, Eye, Trophy, Database, ChevronsUpDown, Check } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { cn } from '@/lib/utils';
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
}

const SortableTab: React.FC<SortableTabProps> = ({ tab, isActive, onClick }) => {
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
    label: 'Standard Plans',
    icon: FileText,
    description: 'Manage Basic, Gold, and Platinum plans'
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
    id: 'pending-w2000',
    label: 'Pending Register',
    icon: Clock,
    description: 'Scheduled warranty submissions to register'
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
    id: 'account',
    label: 'Account Settings',
    icon: Settings,
    description: 'Manage your account and password'
  }
];

export const AdminSidebar: React.FC<AdminSidebarProps> = ({ activeTab, onTabChange, userRole, userPermissions }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [tabs, setTabs] = useState<Tab[]>(defaultTabs);

  // Filter tabs based on user role and permissions
  const getVisibleTabs = () => {
    // Super admins, admins and dev_testers see all tabs (admins filtered by permissions)
    if (userRole === 'super_admin' || userRole === 'dev_tester') {
      return defaultTabs;
    }
    
    // Administrators: full access except tabs explicitly denied in permissions
    if (userRole === 'admin') {
      if (userPermissions && Object.keys(userPermissions).length > 0) {
        return defaultTabs.filter(tab => {
          const permKey = `tab_${tab.id}`;
          // If explicitly set to false, hide it
          if (permKey in userPermissions && userPermissions[permKey] === false) return false;
          return true;
        });
      }
      return defaultTabs;
    }
    
    if (userRole === 'blog_writer') {
      // Blog writers see blog-writing and landing-pages tabs
      return defaultTabs.filter(tab => tab.id === 'blog-writing' || tab.id === 'landing-pages');
    }
    
    if (userRole === 'sales_lead') {
      // Sales leads: manage team, assign leads, view customers, quotes, tips, analytics (restricted), account
      const salesLeadTabIds = ['new-leads', 'get-quote', 'sales-scoreboard', 'customers', 'analytics', 'selling-tips', 'timesheets', 'account'];
      return defaultTabs.filter(tab => salesLeadTabIds.includes(tab.id));
    }

    if (userRole === 'accounts_manager' || userRole === 'accounts_payroll') {
      // Accounts Manager/Payroll: customers, timesheets (with approvals), analytics, user permissions, account
      const accountsTabIds = ['customers', 'timesheets', 'analytics', 'user-permissions', 'discounts-given', 'account'];
      return defaultTabs.filter(tab => accountsTabIds.includes(tab.id));
    }

    if (userRole === 'accounts') {
      // Accounts role: new leads, quotes, customers, discount codes, claims, policy letters, timesheets
      const accountsTabIds = ['new-leads', 'get-quote', 'customers', 'discount-codes', 'discounts-given', 'claims', 'policy-documents', 'timesheets', 'account'];
      return defaultTabs.filter(tab => accountsTabIds.includes(tab.id));
    }

    if (userRole === 'sales') {
      // Sales agents: check if they have custom permissions first
      if (userPermissions && Object.keys(userPermissions).length > 0) {
        const allowedTabs = defaultTabs.filter(tab => {
          const permKey = `tab_${tab.id}`;
          // Always show account settings
          if (tab.id === 'account') return true;
          // Always show selling-tips for sales staff
          if (tab.id === 'selling-tips') return true;
          return userPermissions[permKey] === true;
        });
        
        if (allowedTabs.length > 1) { // More than just account
          return allowedTabs;
        }
      }
      
      // Fallback: restricted view for sales without custom permissions
      // Only their dashboard, quotes, and tips
      const salesTabIds = ['new-leads', 'get-quote', 'sales-scoreboard', 'selling-tips', 'timesheets', 'account'];
      return defaultTabs.filter(tab => salesTabIds.includes(tab.id));
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

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Load saved order from localStorage (only for non-blog writers and non-sales)
  useEffect(() => {
    const visibleTabs = getVisibleTabs();
    
    // Blog writers and sales users don't need custom ordering
    if (userRole === 'blog_writer' || userRole === 'sales' || userRole === 'sales_lead' || userRole === 'dev_tester' || userRole === 'accounts_payroll' || userRole === 'lead_gen' || userRole === 'accounts') {
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
    <>
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
      <div className={`
        fixed left-0 top-[104px] h-[calc(100vh-104px)] w-64 bg-white shadow-lg border-r z-40 transform transition-transform duration-300 ease-in-out overflow-hidden
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0
      `}>
        <div className="p-4 lg:p-6 border-b space-y-3">
          <div>
            <h2 className="text-lg lg:text-xl font-bold text-gray-800">Admin Panel</h2>
            <p className="text-sm text-gray-600">Manage your warranty business</p>
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
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>
        
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <nav className="mt-4 overflow-y-auto h-[calc(100%-100px)] scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100 pb-4">
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
                />
              ))}
            </SortableContext>
          </nav>
        </DndContext>
      </div>
    </>
  );
};
