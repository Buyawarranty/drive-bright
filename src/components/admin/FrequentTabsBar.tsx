import React, { useMemo } from 'react';
import { Zap, X } from 'lucide-react';
import { defaultTabs } from '@/components/admin/AdminSidebar';
import { useTopTabs, clearTabUsage } from '@/hooks/useTabUsage';
import { cn } from '@/lib/utils';

interface Props {
  userId: string | null | undefined;
  activeTab: string;
  onSelect: (tabId: string) => void;
  /** Optional min visits before a shortcut is shown for a tab. */
  minVisits?: number;
  /** How many shortcut pills to display. */
  limit?: number;
}

/**
 * Personalised quick-shortcut bar rendered at the top of the admin dashboard.
 * Shows the user's most-visited tabs so they can jump straight to them.
 * Usage counts are stored per user in localStorage via `recordTabVisit`.
 */
export const FrequentTabsBar: React.FC<Props> = ({
  userId,
  activeTab,
  onSelect,
  limit = 5,
}) => {
  const topIds = useTopTabs(userId, limit);

  const items = useMemo(() => {
    return topIds
      .map((id) => defaultTabs.find((t) => t.id === id))
      .filter((t): t is (typeof defaultTabs)[number] => !!t);
  }, [topIds]);

  if (items.length === 0) return null;

  return (
    <div className="border-b border-border bg-muted/40">
      <div className="flex items-center gap-2 px-4 lg:px-6 py-2">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground shrink-0">
          <Zap className="h-3.5 w-3.5 text-orange-500" />
          Your shortcuts
        </div>
        <div className="flex items-center gap-1.5 flex-1 min-w-0 overflow-x-auto scrollbar-none">

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
                    ? 'bg-foreground text-background border-foreground'
                    : 'bg-background text-foreground border-border hover:bg-accent hover:text-accent-foreground'
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={() => clearTabUsage(userId)}
          title="Reset shortcuts"
          className="shrink-0 p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted"
          aria-label="Reset shortcuts"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
};
