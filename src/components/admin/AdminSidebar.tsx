import React, { useState, useEffect } from 'react';
import { Users, FileText, Car, BarChart3, Mail, Settings, Menu, X, TestTube, Percent, Shield, FolderOpen, Receipt, MessageSquare, PenTool, ShoppingCart, Calculator, GripVertical, UserPlus } from 'lucide-react';
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
    id: 'get-quote',
    label: 'Send a Quote',
    icon: Calculator,
    description: 'Generate and send quotes to customers'
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
    id: 'blog-writing',
    label: 'Blog Writing',
    icon: PenTool,
    description: 'Create and manage blog content with AI tools'
  },
  {
    id: 'testing',
    label: 'Testing',
    icon: TestTube,
    description: 'Test APIs and create test data'
  },
  {
    id: 'account',
    label: 'Account Settings',
    icon: Settings,
    description: 'Manage your account and password'
  }
];

export const AdminSidebar: React.FC<AdminSidebarProps> = ({ activeTab, onTabChange, userRole }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [tabs, setTabs] = useState<Tab[]>(defaultTabs);

  // Filter tabs based on user role
  const getVisibleTabs = () => {
    if (userRole === 'blog_writer') {
      // Blog writers only see the blog-writing tab
      return defaultTabs.filter(tab => tab.id === 'blog-writing');
    }
    // All other roles see all tabs
    return defaultTabs;
  };

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Load saved order from localStorage (only for non-blog writers)
  useEffect(() => {
    const visibleTabs = getVisibleTabs();
    
    // Blog writers don't need custom ordering
    if (userRole === 'blog_writer') {
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
  }, [userRole]);

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
        fixed left-0 top-0 h-full w-64 bg-white shadow-lg border-r z-50 transform transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0 lg:z-10
      `}>
        <div className="p-4 lg:p-6 border-b">
          <h2 className="text-lg lg:text-xl font-bold text-gray-800">Admin Panel</h2>
          <p className="text-sm text-gray-600">Manage your warranty business</p>
        </div>
        
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <nav className="mt-6 overflow-y-auto h-[calc(100vh-160px)] scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
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
