import React, { useMemo } from 'react';
import { Compass } from 'lucide-react';
import { defaultTabs } from '@/components/admin/AdminSidebar';
import { cn } from '@/lib/utils';

interface Props {
  activeTab: string;
  onSelect: (tabId: string) => void;
  /** Returns true when the user is permitted to see the given tab id. */
  isAllowed: (tabId: string) => boolean;
}

/**
 * Curated, always-visible quicklink bar rendered as a second row inside the
 * sticky admin header. Shows the most-used admin sections so any user can
 * jump to the key areas in one click from the top of every admin page
 * (including Lead Allocation / lead-teams).
 *
 * Only links the user is actually allowed to open are rendered, so role
 * permissions and per-user grants are respected automatically.
 */
export const QuickLinksBar: React.FC<Props> = ({ activeTab, onSelect, isAllowed }) => {
  // Curated set of the most-used admin sections, in priority order.
  const QUICK_LINK_IDS = useMemo(
    () => [
      'new-leads',
      'recontact-leads',
      'get-quote',
      'customers',
      'lead-teams',
      'analytics',
      'sales-scoreboard',
      'claims',
      'renewals',
      'collect-payments',
      'call-tracking',
      'timesheets',
    ],
    [],
  );

  const items = useMemo(
    () =>
      QUICK_LINK_IDS.map((id) => defaultTabs.find((t) => t.id === id))
        .filter((t): t is (typeof defaultTabs)[number] => !!t)
        .filter((t) => isAllowed(t.id)),
    [QUICK_LINK_IDS, isAllowed],
  );

  if (items.length === 0) return null;

  return (
    <div className="border-t border-gray-200 bg-gray-50/95 backdrop-blur">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center gap-2 py-1.5 overflow-x-auto scrollbar-none">
          <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400 shrink-0 pr-1">
            <Compass className="h-3.5 w-3.5 text-orange-500" />
          </div>
          {items.map((tab) => {
            const Icon = tab.icon;
            const active = tab.id === activeTab;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onSelect(tab.id)}
                title={tab.description}
                className={cn(
                  'inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full border text-xs font-medium whitespace-nowrap transition-colors',
                  active
                    ? 'bg-orange-600 text-white border-orange-600 shadow-sm'
                    : 'bg-white text-gray-700 border-gray-200 hover:bg-orange-50 hover:text-orange-700 hover:border-orange-300',
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
