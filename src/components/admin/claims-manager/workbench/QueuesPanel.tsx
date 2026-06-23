import React from 'react';
import type { Claim } from '@/types/claim';
import { QUEUES, countQueue, type QueueContext, type QueueKey } from './queues';
import { cn } from '@/lib/utils';

interface QueuesPanelProps {
  claims: Claim[];
  activeQueue: QueueKey;
  onSelectQueue: (key: QueueKey) => void;
  ctx: QueueContext;
}

export const QueuesPanel: React.FC<QueuesPanelProps> = ({ claims, activeQueue, onSelectQueue, ctx }) => {
  const grouped = {
    work: QUEUES.filter((q) => q.group === 'work'),
    workflow: QUEUES.filter((q) => q.group === 'workflow'),
    review: QUEUES.filter((q) => q.group === 'review'),
  };

  const renderGroup = (label: string, items: typeof QUEUES) => (
    <div className="space-y-0.5">
      <div className="px-3 pt-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      {items.map((q) => {
        const count = countQueue(claims, q, ctx);
        const active = activeQueue === q.key;
        const danger = (q.key === 'overdue' || q.key === 'unassigned') && count > 0;
        return (
          <button
            key={q.key}
            type="button"
            onClick={() => onSelectQueue(q.key)}
            className={cn(
              'w-full flex items-center justify-between gap-2 px-3 py-1.5 text-sm rounded-md transition-colors text-left',
              active
                ? 'bg-primary/10 text-foreground font-semibold border-l-2 border-primary'
                : 'hover:bg-muted/60 text-foreground/80 border-l-2 border-transparent',
            )}
          >
            <span className="truncate">{q.label}</span>
            <span
              className={cn(
                'shrink-0 inline-flex items-center justify-center min-w-[22px] h-5 px-1.5 rounded-full text-[11px] font-semibold',
                count === 0
                  ? 'bg-muted text-muted-foreground'
                  : danger
                  ? 'bg-red-100 text-red-700'
                  : active
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-foreground',
              )}
            >
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );

  return (
    <aside className="w-full lg:w-60 shrink-0 bg-card border border-border rounded-lg overflow-hidden">
      <div className="px-3 py-3 border-b border-border">
        <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Queues</div>
        <div className="text-xs text-muted-foreground/80 mt-0.5">{claims.length} total claims</div>
      </div>
      <div className="pb-2">
        {renderGroup('Work', grouped.work)}
        {renderGroup('Workflow', grouped.workflow)}
        {renderGroup('Review', grouped.review)}
      </div>
    </aside>
  );
};
