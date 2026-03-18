import React from 'react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { AdminUser } from '@/hooks/useLeads';

interface AgentSelectorProps {
  label: string;
  agents: AdminUser[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export const getInitials = (user: AdminUser) => {
  if (user.first_name || user.last_name) {
    return `${user.first_name?.[0] || ''}${user.last_name?.[0] || ''}`.toUpperCase();
  }
  return user.email[0].toUpperCase();
};

export const getDisplayName = (user: AdminUser) => {
  if (user.first_name || user.last_name) {
    return `${user.first_name || ''} ${user.last_name || ''}`.trim();
  }
  return user.email;
};

export const AgentSelector: React.FC<AgentSelectorProps> = ({
  label,
  agents,
  selectedId,
  onSelect,
}) => (
  <div className="space-y-2">
    <label className="text-sm font-medium text-muted-foreground">{label}</label>
    <div className="grid grid-cols-1 gap-2 max-h-40 overflow-y-auto">
      {agents.map((user) => (
        <button
          key={user.id}
          onClick={() => onSelect(user.id)}
          className={`flex items-center gap-3 p-2.5 rounded-lg border-2 text-left transition-colors ${
            selectedId === user.id
              ? 'border-primary bg-primary/5'
              : 'border-border hover:border-muted-foreground/30 hover:bg-muted/30'
          }`}
        >
          <Avatar className="h-8 w-8">
            <AvatarFallback className="text-xs bg-primary/10 text-primary">
              {getInitials(user)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{getDisplayName(user)}</p>
            <p className="text-xs text-muted-foreground truncate">{user.role}</p>
          </div>
          {!user.is_active && (
            <Badge variant="outline" className="text-[10px] border-destructive/30 text-destructive">Inactive</Badge>
          )}
        </button>
      ))}
    </div>
  </div>
);
