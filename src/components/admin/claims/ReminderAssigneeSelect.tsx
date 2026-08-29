import React, { useMemo } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAllAdminUsersMap, type AdminUserLite } from '@/hooks/useAllAdminUsersMap';

export const adminUserName = (u?: AdminUserLite | null) =>
  u ? ([u.first_name, u.last_name].filter(Boolean).join(' ').trim() || u.email) : '';

/** Resolve a claim reminder's assignee name from an admin_users id. */
export const useAssigneeName = (assignedTo?: string | null) => {
  const map = useAllAdminUsersMap(assignedTo);
  return assignedTo ? (adminUserName(map.get(assignedTo)) || 'Unknown') : null;
};

interface Props {
  value?: string | null;
  onChange: (adminUserId: string | null) => void;
  /** Compact trigger for inline use inside a reminder row. */
  compact?: boolean;
  className?: string;
}

/**
 * Picks the person responsible for a reminder. Values are admin_users.id,
 * matching claim_reminders.assigned_to.
 */
export const ReminderAssigneeSelect: React.FC<Props> = ({ value, onChange, compact, className }) => {
  const map = useAllAdminUsersMap(value);

  const options = useMemo(() => {
    const list = Array.from(map.values())
      .filter(u => u.is_active || u.id === value)
      .map(u => ({ id: u.id, name: adminUserName(u) || 'Staff' }))
      .sort((a, b) => a.name.localeCompare(b.name));
    return list;
  }, [map, value]);

  return (
    <Select
      value={value || 'unassigned'}
      onValueChange={(v) => onChange(v === 'unassigned' ? null : v)}
    >
      <SelectTrigger className={`${compact ? 'h-8 text-xs w-[150px]' : ''} ${className || ''}`}>
        <SelectValue placeholder="Unassigned" />
      </SelectTrigger>
      <SelectContent className="max-h-72">
        <SelectItem value="unassigned">Unassigned</SelectItem>
        {options.map(o => (
          <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

export default ReminderAssigneeSelect;
