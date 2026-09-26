import React, { useMemo, useState } from 'react';
import { Zap, X, Settings2, Pin, RotateCcw } from 'lucide-react';
import { defaultTabs } from '@/components/admin/AdminSidebar';
import {
  useTopTabs,
  clearTabUsage,
  usePinnedTabs,
  writePinnedTabs,
} from '@/hooks/useTabUsage';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface Props {
  userId: string | null | undefined;
  activeTab: string;
  onSelect: (tabId: string) => void;
  /** Optional min visits before a shortcut is shown for a tab. */
  minVisits?: number;
  /** How many shortcut pills to display. */
  limit?: number;
  /** Restricts both the pills and the picker to tabs this user may open. */
  canAccessTab?: (tabId: string) => boolean;
}

const MAX_PINNED = 20;


/**
 * Personalised quick-shortcut bar rendered at the top of the admin dashboard.
 * By default it shows the user's most-visited tabs, but each user can pick
 * their own shortcuts via the "Customise" picker (stored per user locally).
 */
export const FrequentTabsBar: React.FC<Props> = ({
  userId,
  activeTab,
  onSelect,
  limit = 5,
  canAccessTab,
}) => {
  const topIds = useTopTabs(userId, limit);
  const pinned = usePinnedTabs(userId);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [query, setQuery] = useState('');

  const isCustom = pinned.length > 0;
  const shownIds = isCustom ? pinned.slice(0, MAX_PINNED) : topIds;

  const allowedTabs = useMemo(
    () => (canAccessTab ? defaultTabs.filter((t) => canAccessTab(t.id)) : defaultTabs),
    [canAccessTab]
  );

  const items = useMemo(() => {
    return shownIds
      .map((id) => allowedTabs.find((t) => t.id === id))
      .filter((t): t is (typeof defaultTabs)[number] => !!t);
  }, [shownIds, allowedTabs]);

  const options = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allowedTabs.filter(
      (t) => !q || t.label.toLowerCase().includes(q) || t.id.toLowerCase().includes(q)
    );
  }, [query, allowedTabs]);

  const togglePin = (id: string) => {
    const next = pinned.includes(id)
      ? pinned.filter((p) => p !== id)
      : pinned.length >= MAX_PINNED
        ? pinned
        : [...pinned, id];
    writePinnedTabs(userId, next);
  };

  return (
    <div className="border-b border-border bg-muted/40">
      <div className="flex items-center gap-2 px-4 lg:px-6 py-2">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground shrink-0">
          <Zap className="h-3.5 w-3.5 text-orange-500" />
          Your shortcuts
        </div>
        <div className="flex items-start gap-1.5 flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-1.5 flex-1 min-w-0 max-h-[4.25rem] overflow-y-auto scrollbar-none content-start">

          {items.length === 0 && (
            <span className="text-xs text-muted-foreground">
              Pick the sections you use most with Customise
            </span>
          )}
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
        </div>


        <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="shrink-0 inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full border border-border bg-background text-xs font-medium text-foreground hover:bg-accent hover:text-accent-foreground"
            >
              <Settings2 className="h-3.5 w-3.5" />
              Customise
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-80 p-0">
            <div className="p-3 border-b border-border space-y-2">
              <div className="text-sm font-semibold">Choose your shortcuts</div>
              <p className="text-xs text-muted-foreground">
                {isCustom
                  ? `${pinned.length} of ${MAX_PINNED} pinned. Leave empty to go back to most-visited.`
                  : 'Currently showing your most-visited sections. Pin any below to take over.'}
              </p>
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search sections..."
                className="h-8 text-sm"
              />
            </div>
            <div className="max-h-72 overflow-y-auto p-1.5">
              {options.map((tab) => {
                const Icon = tab.icon;
                const on = pinned.includes(tab.id);
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => togglePin(tab.id)}
                    className={cn(
                      'w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left text-sm transition-colors',
                      on ? 'bg-accent text-accent-foreground' : 'hover:bg-muted'
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="flex-1 truncate">{tab.label}</span>
                    {on && <Pin className="h-3.5 w-3.5 shrink-0" />}
                  </button>
                );
              })}
              {options.length === 0 && (
                <div className="px-2 py-3 text-xs text-muted-foreground">No sections match.</div>
              )}
            </div>
            <div className="p-2 border-t border-border flex items-center justify-between gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="text-xs"
                onClick={() => writePinnedTabs(userId, [])}
              >
                <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                Use most-visited
              </Button>
              <Button size="sm" className="text-xs" onClick={() => setPickerOpen(false)}>
                Done
              </Button>
            </div>
          </PopoverContent>
        </Popover>

        {!isCustom && (
          <button
            type="button"
            onClick={() => clearTabUsage(userId)}
            title="Reset shortcuts"
            className="shrink-0 p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted"
            aria-label="Reset shortcuts"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
};
