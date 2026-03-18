import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Search } from 'lucide-react';
import { format } from 'date-fns';

interface LeadRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  phone: string | null;
  vehicle_reg: string | null;
  status: string;
  created_at: string;
}

interface LeadPickerListProps {
  fromAgentId: string;
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  onSelectAll: (ids: string[]) => void;
  onDeselectAll: () => void;
}

export const LeadPickerList: React.FC<LeadPickerListProps> = ({
  fromAgentId,
  selectedIds,
  onToggle,
  onSelectAll,
  onDeselectAll,
}) => {
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const fetchLeads = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('sales_leads')
        .select('id, first_name, last_name, email, phone, vehicle_reg, status, created_at')
        .eq('assigned_to', fromAgentId)
        .order('created_at', { ascending: false })
        .limit(500);

      if (!error && data) {
        setLeads(data);
      }
      setLoading(false);
    };
    fetchLeads();
  }, [fromAgentId]);

  const filtered = search.trim()
    ? leads.filter(l => {
        const s = search.toLowerCase();
        return (
          l.email?.toLowerCase().includes(s) ||
          l.first_name?.toLowerCase().includes(s) ||
          l.last_name?.toLowerCase().includes(s) ||
          l.phone?.includes(s) ||
          l.vehicle_reg?.toLowerCase().includes(s)
        );
      })
    : leads;

  const allFilteredSelected = filtered.length > 0 && filtered.every(l => selectedIds.has(l.id));

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">Loading leads…</span>
      </div>
    );
  }

  if (leads.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-4">No leads found for this agent.</p>;
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search leads…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="h-8 text-xs pl-7"
          />
        </div>
        <Badge variant="secondary" className="text-xs shrink-0">
          {selectedIds.size} selected
        </Badge>
      </div>

      <div className="border rounded-lg max-h-52 overflow-y-auto">
        {/* Header row */}
        <div className="flex items-center gap-2 px-3 py-2 border-b bg-muted/50 sticky top-0 z-10">
          <Checkbox
            checked={allFilteredSelected}
            onCheckedChange={(checked) => {
              if (checked) {
                onSelectAll(filtered.map(l => l.id));
              } else {
                onDeselectAll();
              }
            }}
          />
          <span className="text-[11px] font-medium text-muted-foreground flex-1">
            {allFilteredSelected ? 'Deselect all' : `Select all ${filtered.length}`}
          </span>
        </div>

        {filtered.map((lead) => (
          <label
            key={lead.id}
            className={`flex items-center gap-2 px-3 py-2 border-b last:border-b-0 cursor-pointer hover:bg-muted/30 transition-colors ${
              selectedIds.has(lead.id) ? 'bg-primary/5' : ''
            }`}
          >
            <Checkbox
              checked={selectedIds.has(lead.id)}
              onCheckedChange={() => onToggle(lead.id)}
            />
            <div className="flex-1 min-w-0 flex items-center gap-2">
              <span className="text-xs font-medium truncate max-w-[120px]">
                {lead.first_name || lead.last_name
                  ? `${lead.first_name || ''} ${lead.last_name || ''}`.trim()
                  : lead.email}
              </span>
              {lead.vehicle_reg && (
                <span className="text-[10px] text-muted-foreground font-mono">{lead.vehicle_reg}</span>
              )}
            </div>
            <Badge variant="outline" className="text-[10px] shrink-0">{lead.status}</Badge>
            <span className="text-[10px] text-muted-foreground shrink-0">
              {format(new Date(lead.created_at), 'dd MMM')}
            </span>
          </label>
        ))}

        {filtered.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-4">No leads match your search.</p>
        )}
      </div>
    </div>
  );
};
