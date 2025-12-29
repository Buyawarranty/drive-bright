import React from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, RefreshCw, Upload, Download, Filter } from 'lucide-react';
import { LeadStatus } from '@/hooks/useLeads';

interface LeadsFiltersProps {
  filter: LeadStatus | 'all' | 'high_priority';
  onFilterChange: (filter: LeadStatus | 'all' | 'high_priority') => void;
  searchTerm: string;
  onSearchChange: (term: string) => void;
  onRefresh: () => void;
  onMigrate: () => void;
  leadCounts: {
    all: number;
    new: number;
    contacted: number;
    follow_up: number;
    converted: number;
    lost: number;
    high_priority: number;
  };
}

export const LeadsFilters: React.FC<LeadsFiltersProps> = ({
  filter,
  onFilterChange,
  searchTerm,
  onSearchChange,
  onRefresh,
  onMigrate,
  leadCounts
}) => {
  return (
    <div className="space-y-4">
      {/* Tabs for status filter */}
      <Tabs value={filter} onValueChange={(v) => onFilterChange(v as LeadStatus | 'all' | 'high_priority')}>
        <TabsList className="grid w-full grid-cols-7">
          <TabsTrigger value="all" className="relative">
            All
            <Badge variant="secondary" className="ml-1 h-5 px-1.5">{leadCounts.all}</Badge>
          </TabsTrigger>
          <TabsTrigger value="new" className="relative">
            New
            <Badge variant="secondary" className="ml-1 h-5 px-1.5 bg-blue-100">{leadCounts.new}</Badge>
          </TabsTrigger>
          <TabsTrigger value="contacted">
            Contacted
            <Badge variant="secondary" className="ml-1 h-5 px-1.5 bg-yellow-100">{leadCounts.contacted}</Badge>
          </TabsTrigger>
          <TabsTrigger value="follow_up">
            Follow-up
            <Badge variant="secondary" className="ml-1 h-5 px-1.5 bg-purple-100">{leadCounts.follow_up}</Badge>
          </TabsTrigger>
          <TabsTrigger value="converted">
            Converted
            <Badge variant="secondary" className="ml-1 h-5 px-1.5 bg-green-100">{leadCounts.converted}</Badge>
          </TabsTrigger>
          <TabsTrigger value="lost">
            Lost
            <Badge variant="secondary" className="ml-1 h-5 px-1.5 bg-gray-100">{leadCounts.lost}</Badge>
          </TabsTrigger>
          <TabsTrigger value="high_priority">
            🔥 High Priority
            <Badge variant="secondary" className="ml-1 h-5 px-1.5 bg-red-100">{leadCounts.high_priority}</Badge>
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Search and actions */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search leads by name, email, phone, reg..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9"
          />
        </div>
        
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onRefresh}>
            <RefreshCw className="h-4 w-4 mr-1" />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={onMigrate}>
            <Upload className="h-4 w-4 mr-1" />
            Import from Carts
          </Button>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-1" />
            Export
          </Button>
        </div>
      </div>
    </div>
  );
};
