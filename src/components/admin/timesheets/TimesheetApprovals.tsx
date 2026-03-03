import React, { useState, useEffect, useCallback } from 'react';
import { format, startOfMonth, endOfMonth, subMonths, addMonths } from 'date-fns';
import { Check, ChevronLeft, ChevronRight, Clock, User, CheckCircle2, XCircle, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface AgentTimesheet {
  admin_user_id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  entries: {
    id: string;
    entry_date: string;
    entry_type: string;
    hours_worked: number;
    is_approved: boolean;
    start_time: string | null;
    end_time: string | null;
    notes: string | null;
  }[];
  deals: {
    id: string;
    deal_date: string;
    vehicle_reg: string | null;
    plan_type: string | null;
    notes: string | null;
  }[];
  fullDays: number;
  halfDays: number;
  weekendDays: number;
  sickDays: number;
  holidayDays: number;
  totalDays: number;
  allApproved: boolean;
}

export function TimesheetApprovals() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [agents, setAgents] = useState<AgentTimesheet[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [approvingId, setApprovingId] = useState<string | null>(null);

  const monthStart = startOfMonth(currentMonth).toISOString().split('T')[0];
  const monthEnd = endOfMonth(currentMonth).toISOString().split('T')[0];

  const fetchAllTimesheets = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch all admin users who are sales/sales_lead
      const { data: adminUsers, error: usersError } = await supabase
        .from('admin_users')
        .select('id, email, first_name, last_name, user_id')
        .in('role', ['sales', 'sales_lead', 'accounts_manager'])
        .eq('is_active', true);

      if (usersError) throw usersError;
      if (!adminUsers?.length) {
        setAgents([]);
        setLoading(false);
        return;
      }

      // Fetch all timesheet entries for this month
      const { data: allEntries, error: entriesError } = await supabase
        .from('staff_timesheets')
        .select('*')
        .gte('entry_date', monthStart)
        .lte('entry_date', monthEnd)
        .order('entry_date', { ascending: true });

      if (entriesError) throw entriesError;

      // Fetch all deals for this month
      const { data: allDeals, error: dealsError } = await supabase
        .from('deal_records')
        .select('*')
        .gte('deal_date', monthStart)
        .lte('deal_date', monthEnd)
        .order('deal_date', { ascending: false });

      if (dealsError) throw dealsError;

      // Group by agent
      const agentMap: AgentTimesheet[] = adminUsers.map(user => {
        const userEntries = (allEntries || []).filter(e => e.admin_user_id === user.id || e.user_id === user.user_id);
        const userDeals = (allDeals || []).filter(d => d.admin_user_id === user.id || d.user_id === user.user_id);

        const workedEntries = userEntries.filter(e => ['worked', 'wfh', 'training'].includes(e.entry_type));
        const fullDays = workedEntries.filter(e => (Number(e.hours_worked) || 0) > 5).length;
        const halfDays = workedEntries.filter(e => {
          const h = Number(e.hours_worked) || 0;
          return h > 0 && h <= 5;
        }).length;
        const weekendDays = workedEntries.filter(e => {
          const d = new Date(e.entry_date);
          return d.getDay() === 0 || d.getDay() === 6;
        }).length;

        return {
          admin_user_id: user.id,
          email: user.email,
          first_name: user.first_name,
          last_name: user.last_name,
          entries: userEntries.map(e => ({
            id: e.id,
            entry_date: e.entry_date,
            entry_type: e.entry_type,
            hours_worked: Number(e.hours_worked) || 0,
            is_approved: e.is_approved ?? false,
            start_time: e.start_time,
            end_time: e.end_time,
            notes: e.notes,
          })),
          deals: userDeals.map(d => ({
            id: d.id,
            deal_date: d.deal_date,
            vehicle_reg: d.vehicle_reg,
            plan_type: d.plan_type,
            notes: d.notes,
          })),
          fullDays,
          halfDays,
          weekendDays,
          sickDays: userEntries.filter(e => e.entry_type === 'sick').length,
          holidayDays: userEntries.filter(e => e.entry_type === 'holiday').length,
          totalDays: workedEntries.length,
          allApproved: userEntries.length > 0 && userEntries.every(e => e.is_approved),
        };
      });

      setAgents(agentMap);
    } catch (err) {
      console.error('Error fetching timesheets for approval:', err);
      toast.error('Failed to load timesheets');
    } finally {
      setLoading(false);
    }
  }, [monthStart, monthEnd]);

  useEffect(() => {
    fetchAllTimesheets();
  }, [fetchAllTimesheets]);

  const approveAllForAgent = async (agentUserId: string) => {
    setApprovingId(agentUserId);
    try {
      const agent = agents.find(a => a.admin_user_id === agentUserId);
      if (!agent) return;

      const entryIds = agent.entries.filter(e => !e.is_approved).map(e => e.id);
      if (entryIds.length === 0) {
        toast.info('All entries already approved');
        return;
      }

      const { error } = await supabase
        .from('staff_timesheets')
        .update({
          is_approved: true,
          approved_at: new Date().toISOString(),
        })
        .in('id', entryIds);

      if (error) throw error;
      toast.success(`Approved ${entryIds.length} entries for ${agent.first_name || agent.email}`);
      await fetchAllTimesheets();
    } catch (err) {
      console.error('Error approving timesheet:', err);
      toast.error('Failed to approve timesheet');
    } finally {
      setApprovingId(null);
    }
  };

  const filteredAgents = agents.filter(a => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      a.email.toLowerCase().includes(q) ||
      (a.first_name || '').toLowerCase().includes(q) ||
      (a.last_name || '').toLowerCase().includes(q)
    );
  });

  const isCurrentMonth = currentMonth.getMonth() === new Date().getMonth() && currentMonth.getFullYear() === new Date().getFullYear();

  return (
    <div className="space-y-6">
      {/* Month navigation */}
      <div className="bg-white rounded-xl shadow-sm border p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h2 className="text-lg font-semibold text-gray-900 min-w-[160px] text-center">
              {format(currentMonth, 'MMMM yyyy')}
            </h2>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            {!isCurrentMonth && (
              <Button variant="outline" size="sm" className="ml-2 text-xs" onClick={() => setCurrentMonth(new Date())}>
                This Month
              </Button>
            )}
          </div>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search employees..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm border p-4 text-center">
          <p className="text-2xl font-bold text-gray-900">{agents.length}</p>
          <p className="text-xs text-gray-500 mt-1">Total Staff</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border p-4 text-center">
          <p className="text-2xl font-bold text-amber-600">{agents.filter(a => a.entries.length > 0 && !a.allApproved).length}</p>
          <p className="text-xs text-gray-500 mt-1">Pending Approval</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border p-4 text-center">
          <p className="text-2xl font-bold text-green-600">{agents.filter(a => a.allApproved && a.entries.length > 0).length}</p>
          <p className="text-xs text-gray-500 mt-1">Approved</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border p-4 text-center">
          <p className="text-2xl font-bold text-gray-400">{agents.filter(a => a.entries.length === 0).length}</p>
          <p className="text-xs text-gray-500 mt-1">No Submissions</p>
        </div>
      </div>

      {/* Agent list */}
      {loading ? (
        <div className="bg-white rounded-xl shadow-sm border p-8 text-center text-gray-500">Loading timesheets...</div>
      ) : filteredAgents.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border p-8 text-center text-gray-500">No staff found</div>
      ) : (
        <div className="space-y-3">
          {filteredAgents.map(agent => (
            <div key={agent.admin_user_id} className="bg-white rounded-xl shadow-sm border overflow-hidden">
              {/* Agent row */}
              <div
                className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => setExpandedAgent(expandedAgent === agent.admin_user_id ? null : agent.admin_user_id)}
              >
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-gray-100 flex items-center justify-center">
                    <User className="h-5 w-5 text-gray-500" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">
                      {agent.first_name || agent.last_name
                        ? `${agent.first_name || ''} ${agent.last_name || ''}`.trim()
                        : agent.email}
                    </p>
                    <p className="text-xs text-gray-500">{agent.email}</p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="hidden sm:flex items-center gap-3 text-sm text-gray-600">
                    <span>{agent.fullDays} full</span>
                    <span className="text-gray-300">|</span>
                    <span>{agent.halfDays} half</span>
                    <span className="text-gray-300">|</span>
                    <span>{agent.weekendDays} wknd</span>
                    <span className="text-gray-300">|</span>
                    <span>{agent.deals.length} deals</span>
                  </div>

                  {agent.entries.length === 0 ? (
                    <Badge variant="outline" className="text-gray-400">No data</Badge>
                  ) : agent.allApproved ? (
                    <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Approved
                    </Badge>
                  ) : (
                    <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">
                      <Clock className="h-3 w-3 mr-1" />
                      Pending
                    </Badge>
                  )}

                  {!agent.allApproved && agent.entries.length > 0 && (
                    <Button
                      size="sm"
                      className="bg-green-600 hover:bg-green-700 text-white gap-1"
                      onClick={e => {
                        e.stopPropagation();
                        approveAllForAgent(agent.admin_user_id);
                      }}
                      disabled={approvingId === agent.admin_user_id}
                    >
                      <Check className="h-3.5 w-3.5" />
                      Approve
                    </Button>
                  )}
                </div>
              </div>

              {/* Expanded detail */}
              {expandedAgent === agent.admin_user_id && (
                <div className="border-t px-4 py-4 space-y-4 bg-gray-50">
                  {/* Entries table */}
                  <div>
                    <h4 className="font-medium text-sm text-gray-700 mb-2">Timesheet Entries</h4>
                    {agent.entries.length === 0 ? (
                      <p className="text-sm text-gray-400">No entries submitted</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-left text-gray-500 border-b">
                              <th className="pb-2 pr-4">Date</th>
                              <th className="pb-2 pr-4">Type</th>
                              <th className="pb-2 pr-4">Hours</th>
                              <th className="pb-2 pr-4">Time</th>
                              <th className="pb-2 pr-4">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {agent.entries.map(entry => (
                              <tr key={entry.id} className="border-b border-gray-100">
                                <td className="py-2 pr-4">{format(new Date(entry.entry_date), 'EEE dd/MM')}</td>
                                <td className="py-2 pr-4 capitalize">{entry.entry_type.replace('_', ' ')}</td>
                                <td className="py-2 pr-4">{entry.hours_worked > 5 ? 'Full Day' : 'Half Day'}</td>
                                <td className="py-2 pr-4 text-gray-500">{entry.start_time || '-'} – {entry.end_time || '-'}</td>
                                <td className="py-2 pr-4">
                                  {entry.is_approved ? (
                                    <span className="text-green-600 text-xs font-medium">✓ Approved</span>
                                  ) : (
                                    <span className="text-amber-600 text-xs font-medium">Pending</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* Deals */}
                  {agent.deals.length > 0 && (
                    <div>
                      <h4 className="font-medium text-sm text-gray-700 mb-2">Deals ({agent.deals.length})</h4>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-left text-gray-500 border-b">
                              <th className="pb-2 pr-4">Date</th>
                              <th className="pb-2 pr-4">Reg Plate</th>
                              <th className="pb-2 pr-4">Plan</th>
                              <th className="pb-2 pr-4">Notes</th>
                            </tr>
                          </thead>
                          <tbody>
                            {agent.deals.map(deal => (
                              <tr key={deal.id} className="border-b border-gray-100">
                                <td className="py-2 pr-4">{format(new Date(deal.deal_date), 'dd/MM')}</td>
                                <td className="py-2 pr-4 font-mono text-xs">{deal.vehicle_reg || '-'}</td>
                                <td className="py-2 pr-4">{deal.plan_type || '-'}</td>
                                <td className="py-2 pr-4 text-gray-500 truncate max-w-[200px]">{deal.notes || '-'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
