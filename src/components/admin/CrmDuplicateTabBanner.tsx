import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { useCrmTabs } from '@/hooks/useCrmTabs';

/**
 * Warns the agent when the CRM is open in more than one tab — the usual cause
 * of "blank screen with just a spinner", because every extra tab competes for
 * the same handful of browser connections.
 */
export const CrmDuplicateTabBanner: React.FC = () => {
  const { tabCount, isPrimary } = useCrmTabs();

  if (tabCount < 2) return null;

  return (
    <div className="bg-amber-50 border-b-2 border-amber-300 px-4 py-2 text-sm text-amber-900">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-center gap-2 text-center">
        <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
        <span className="font-semibold">
          The CRM is open in {tabCount} tabs.
        </span>
        <span>
          {isPrimary
            ? 'Close the other CRM tabs — extra tabs slow this one down and can leave lists stuck loading.'
            : 'This tab is running in quiet mode so your main tab stays fast. Close it and work in one tab, or click here to use this one.'}
        </span>
        {!isPrimary && (
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-md border border-amber-400 bg-white px-2 py-1 font-semibold hover:bg-amber-100"
          >
            Use this tab
          </button>
        )}
      </div>
    </div>
  );
};
