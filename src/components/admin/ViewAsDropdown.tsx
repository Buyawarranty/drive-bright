import React from 'react';
import { useViewAs } from '@/contexts/ViewAsContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Eye, EyeOff } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

const roleBadgeColors: Record<string, string> = {
  super_admin: 'bg-red-100 text-red-800',
  admin: 'bg-purple-100 text-purple-800',
  sales: 'bg-blue-100 text-blue-800',
  sales_lead: 'bg-indigo-100 text-indigo-800',
  lead_gen: 'bg-teal-100 text-teal-800',
  accounts_manager: 'bg-amber-100 text-amber-800',
  accounts: 'bg-orange-100 text-orange-800',
  blog_writer: 'bg-green-100 text-green-800',
};

export const ViewAsDropdown: React.FC = () => {
  const { viewAsAgent, setViewAsAgent, isImpersonating, availableAgents, loadingAgents } = useViewAs();

  if (loadingAgents) return null;

  return (
    <div className="flex items-center gap-2">
      {isImpersonating && (
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-300 rounded-lg px-3 py-1.5 animate-pulse">
          <Eye className="h-4 w-4 text-amber-600" />
          <span className="text-xs font-semibold text-amber-700">
            Viewing as: {viewAsAgent?.firstName} {viewAsAgent?.lastName}
          </span>
          <Badge className={`text-[10px] px-1.5 py-0 ${roleBadgeColors[viewAsAgent?.role || ''] || 'bg-gray-100 text-gray-700'}`}>
            {viewAsAgent?.role?.replace('_', ' ')}
          </Badge>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 hover:bg-amber-200"
            onClick={() => setViewAsAgent(null)}
            title="Stop impersonating"
          >
            <EyeOff className="h-3.5 w-3.5 text-amber-700" />
          </Button>
        </div>
      )}

      <Select
        value={viewAsAgent?.id || '__self__'}
        onValueChange={(val) => {
          if (val === '__self__') {
            setViewAsAgent(null);
          } else {
            const agent = availableAgents.find(a => a.id === val);
            if (agent) setViewAsAgent(agent);
          }
        }}
      >
        <SelectTrigger className="w-[180px] h-8 text-xs border-dashed">
          <Eye className="h-3.5 w-3.5 mr-1 text-muted-foreground" />
          <SelectValue placeholder="View as..." />
        </SelectTrigger>
        <SelectContent className="max-h-[300px]">
          <SelectItem value="__self__" className="text-xs font-medium">
            👤 Myself (Super Admin)
          </SelectItem>
          {availableAgents.map(agent => (
            <SelectItem key={agent.id} value={agent.id} className="text-xs">
              <div className="flex items-center gap-2">
                <span>{agent.firstName} {agent.lastName}</span>
                <Badge variant="outline" className={`text-[10px] px-1 py-0 ${roleBadgeColors[agent.role] || ''}`}>
                  {agent.role?.replace('_', ' ')}
                </Badge>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};
