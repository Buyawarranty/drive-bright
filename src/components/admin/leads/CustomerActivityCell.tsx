import React from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import { CustomerActivity, getCustomerActivityLabel } from '@/hooks/useCustomerActivity';

interface Props {
  activity?: CustomerActivity;
}

/**
 * Shows the last time the CUSTOMER themselves did something:
 * requested another quote, filled step 2, logged into the portal, etc.
 */
export const CustomerActivityCell: React.FC<Props> = ({ activity }) => {
  if (!activity) {
    return (
      <span
        className="text-xs text-muted-foreground italic"
        title="No customer-side activity recorded (no new quote, step 2 submission, or portal login)"
      >
        No customer activity
      </span>
    );
  }
  const label = getCustomerActivityLabel(activity.source);
  return (
    <div className="flex flex-col leading-tight">
      <span
        className="text-xs text-foreground"
        title={`${label} — ${format(new Date(activity.lastAt), 'MMM d, yyyy HH:mm')}`}
      >
        {formatDistanceToNow(new Date(activity.lastAt), { addSuffix: true })}
      </span>
      <span className="text-[10px] text-muted-foreground/80 truncate max-w-[130px]" title={label}>
        {label}
      </span>
    </div>
  );
};

export default CustomerActivityCell;
