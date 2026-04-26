import React from 'react';
import { Download, FileText, Plus } from 'lucide-react';

const TABS = ['New Leads', 'Quotes & Orders', 'Claims', 'Customers', 'Analytics'] as const;
const ACTIVE_TAB = 'Claims';

export const Header: React.FC = () => {
  const fire = (label: string) => () => alert(label);

  return (
    <header className="sticky top-0 z-40 h-14 bg-white border-b border-border flex items-center px-4 gap-4">
      {/* Logo */}
      <div className="flex items-center shrink-0">
        <span className="text-lg font-bold tracking-tight">
          <span className="text-blue-600">buy</span>
          <span className="text-foreground">a</span>
          <span className="text-orange-500">warranty</span>
        </span>
      </div>

      {/* Centre nav */}
      <nav className="flex-1 flex items-center justify-center gap-1 overflow-x-auto">
        {TABS.map((tab) => {
          const active = tab === ACTIVE_TAB;
          return (
            <button
              key={tab}
              type="button"
              className={`h-14 px-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                active
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab}
            </button>
          );
        })}
      </nav>

      {/* Right actions */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={fire('Export CSV')}
          className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md border border-border bg-card text-sm font-medium text-foreground hover:bg-muted transition-colors"
        >
          <Download className="h-4 w-4" />
          CSV
        </button>
        <button
          type="button"
          onClick={fire('Export PDF')}
          className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md border border-border bg-card text-sm font-medium text-foreground hover:bg-muted transition-colors"
        >
          <FileText className="h-4 w-4" />
          PDF
        </button>
        <button
          type="button"
          onClick={fire('Add Claim')}
          className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Add Claim
        </button>
      </div>
    </header>
  );
};
