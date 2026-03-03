import React, { useState, useEffect, useCallback } from 'react';
import { format, startOfMonth, endOfMonth, subMonths, addMonths } from 'date-fns';
import { Check, ChevronLeft, ChevronRight, Clock, User, CheckCircle2, Search, MessageSquare, Send, AlertTriangle, XCircle, ChevronDown, ChevronUp, Gift } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface CommissionClaim {
  id: string;
  claim_reason: string;
  claim_notes: string | null;
  evidence_type: string | null;
  deal_value: number | null;
  status: string;
  created_at: string;
  customer_id: string | null;
}

interface TimesheetComment {
  id: string;
  message: string;
  is_from_accounts: boolean;
  created_at: string;
  author_name: string;
}

interface BonusEntry {
  id: string;
  bonus_type: string;
  description: string | null;
  quantity: number;
  amount: number | null;
  status: string;
  created_at: string;
}

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
  commissionClaims: CommissionClaim[];
  comments: TimesheetComment[];
  bonuses: BonusEntry[];
  fullDays: number;
  halfDays: number;
  weekendDays: number;
  sickDays: number;
  holidayDays: number;
  totalDays: number;
  allApproved: boolean;
}

export function TimesheetApprovals() {
  const { session } = useAuth();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [agents, setAgents] = useState<AgentTimesheet[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState<Record<string, string>>({});
  const [sendingReply, setSendingReply] = useState<string | null>(null);
  const [currentAdminId, setCurrentAdminId] = useState<string | null>(null);
  const [approvingClaimId, setApprovingClaimId] = useState<string | null>(null);
  const [approvingBonusId, setApprovingBonusId] = useState<string | null>(null);

  const monthStart = startOfMonth(currentMonth).toISOString().split('T')[0];
  const monthEnd = endOfMonth(currentMonth).toISOString().split('T')[0];
  const monthKey = format(currentMonth, 'yyyy-MM');

  // Get current admin user id
  useEffect(() => {
    async function getAdminId() {
      if (!session?.user?.id) return;
      const { data } = await supabase
        .from('admin_users')
        .select('id')
        .eq('user_id', session.user.id)
        .maybeSingle();
      setCurrentAdminId(data?.id || null);
    }
    getAdminId();
  }, [session?.user?.id]);

  const fetchAllTimesheets = useCallback(async () => {
    setLoading(true);
    try {
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

      // Fetch entries, deals, commission claims, comments, and bonuses in parallel
      const [entriesRes, dealsRes, claimsRes, commentsRes, bonusesRes] = await Promise.all([
        supabase
          .from('staff_timesheets')
          .select('*')
          .gte('entry_date', monthStart)
          .lte('entry_date', monthEnd)
          .order('entry_date', { ascending: true }),
        supabase
          .from('deal_records')
          .select('*')
          .gte('deal_date', monthStart)
          .lte('deal_date', monthEnd)
          .order('deal_date', { ascending: false }),
        supabase
          .from('commission_claims')
          .select('*')
          .gte('created_at', `${monthStart}T00:00:00`)
          .lte('created_at', `${monthEnd}T23:59:59`)
          .order('created_at', { ascending: false }),
        supabase
          .from('timesheet_comments')
          .select('*, author:author_id(first_name, last_name, email)')
          .eq('month_year', monthKey)
          .order('created_at', { ascending: true }),
        supabase
          .from('timesheet_bonuses')
          .select('*')
          .eq('month_year', monthKey)
          .order('created_at', { ascending: false }),
      ]);

      if (entriesRes.error) throw entriesRes.error;
      if (dealsRes.error) throw dealsRes.error;

      const allEntries = entriesRes.data || [];
      const allDeals = dealsRes.data || [];
      const allClaims = claimsRes.data || [];
      const allComments = commentsRes.data || [];
      const allBonuses = bonusesRes.data || [];

      const agentMap: AgentTimesheet[] = adminUsers.map(user => {
        const userEntries = allEntries.filter(e => e.admin_user_id === user.id || e.user_id === user.user_id);
        const userDeals = allDeals.filter(d => d.admin_user_id === user.id || d.user_id === user.user_id);
        const userClaims = allClaims.filter(c => c.agent_id === user.id);
        const userComments = allComments
          .filter(c => c.admin_user_id === user.id)
          .map(c => {
            const author = c.author as any;
            return {
              id: c.id,
              message: c.message,
              is_from_accounts: c.is_from_accounts ?? false,
              created_at: c.created_at,
              author_name: author ? `${author.first_name || ''} ${author.last_name || ''}`.trim() || author.email : 'Unknown',
            };
          });

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
          commissionClaims: userClaims.map(c => ({
            id: c.id,
            claim_reason: c.claim_reason,
            claim_notes: c.claim_notes,
            evidence_type: c.evidence_type,
            deal_value: c.deal_value,
            status: c.status,
            created_at: c.created_at,
            customer_id: c.customer_id,
          })),
          comments: userComments,
          bonuses: allBonuses
            .filter((b: any) => b.admin_user_id === user.id || b.user_id === user.user_id)
            .map((b: any) => ({
              id: b.id,
              bonus_type: b.bonus_type,
              description: b.description,
              quantity: b.quantity,
              amount: b.amount ? Number(b.amount) : null,
              status: b.status,
              created_at: b.created_at,
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
  }, [monthStart, monthEnd, monthKey]);

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
        .update({ is_approved: true, approved_at: new Date().toISOString() })
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

  const handleClaimAction = async (claimId: string, action: 'approved' | 'rejected') => {
    if (!currentAdminId) return;
    setApprovingClaimId(claimId);
    try {
      const { error } = await supabase
        .from('commission_claims')
        .update({
          status: action,
          reviewed_by: currentAdminId,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', claimId);

      if (error) throw error;
      toast.success(`Commission claim ${action}`);
      await fetchAllTimesheets();
    } catch (err) {
      console.error('Error updating claim:', err);
      toast.error('Failed to update claim');
    } finally {
      setApprovingClaimId(null);
    }
  };

  const sendReply = async (agentAdminId: string) => {
    const text = replyText[agentAdminId]?.trim();
    if (!text || !currentAdminId) return;

    setSendingReply(agentAdminId);
    try {
      const { error } = await supabase
        .from('timesheet_comments')
        .insert({
          admin_user_id: agentAdminId,
          author_id: currentAdminId,
          month_year: monthKey,
          message: text,
          is_from_accounts: true,
        });

      if (error) throw error;
      setReplyText(prev => ({ ...prev, [agentAdminId]: '' }));
      toast.success('Reply sent');
      await fetchAllTimesheets();
    } catch (err) {
      console.error('Error sending reply:', err);
      toast.error('Failed to send reply');
    } finally {
      setSendingReply(null);
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
  const pendingClaimsCount = agents.reduce((sum, a) => sum + a.commissionClaims.filter(c => c.status === 'pending').length, 0);

  return (
    <div className="space-y-6">
      {/* Month navigation */}
      <div className="bg-white rounded-xl shadow-sm border p-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
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
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input placeholder="Search employees..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-9 h-9" />
          </div>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
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
        <div className="bg-white rounded-xl shadow-sm border p-4 text-center">
          <p className="text-2xl font-bold text-orange-600">{pendingClaimsCount}</p>
          <p className="text-xs text-gray-500 mt-1">Commission Claims</p>
        </div>
      </div>

      {/* Agent list */}
      {loading ? (
        <div className="bg-white rounded-xl shadow-sm border p-8 text-center text-gray-500">Loading timesheets...</div>
      ) : filteredAgents.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border p-8 text-center text-gray-500">No staff found</div>
      ) : (
        <div className="space-y-3">
          {filteredAgents.map(agent => {
            const pendingClaims = agent.commissionClaims.filter(c => c.status === 'pending').length;
            const pendingBonuses = agent.bonuses.filter(b => b.status === 'pending').length;
            const unreadComments = agent.comments.filter(c => !c.is_from_accounts).length;

            return (
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
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-gray-900">
                          {agent.first_name || agent.last_name
                            ? `${agent.first_name || ''} ${agent.last_name || ''}`.trim()
                            : agent.email}
                        </p>
                        {pendingClaims > 0 && (
                          <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-100 text-[10px] px-1.5">
                            {pendingClaims} claim{pendingClaims > 1 ? 's' : ''}
                          </Badge>
                        )}
                        {pendingBonuses > 0 && (
                          <Badge className="bg-purple-100 text-purple-700 hover:bg-purple-100 text-[10px] px-1.5">
                            <Gift className="h-2.5 w-2.5 mr-0.5" />
                            {pendingBonuses} bonus{pendingBonuses > 1 ? 'es' : ''}
                          </Badge>
                        )}
                        {unreadComments > 0 && (
                          <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 text-[10px] px-1.5">
                            <MessageSquare className="h-2.5 w-2.5 mr-0.5" />
                            {unreadComments}
                          </Badge>
                        )}
                      </div>
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
                        onClick={e => { e.stopPropagation(); approveAllForAgent(agent.admin_user_id); }}
                        disabled={approvingId === agent.admin_user_id}
                      >
                        <Check className="h-3.5 w-3.5" />
                        Approve
                      </Button>
                    )}

                    {expandedAgent === agent.admin_user_id ? (
                      <ChevronUp className="h-4 w-4 text-gray-400" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-gray-400" />
                    )}
                  </div>
                </div>

                {/* Expanded detail */}
                {expandedAgent === agent.admin_user_id && (
                  <div className="border-t px-4 py-4 space-y-5 bg-gray-50">
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
                                <th className="pb-2 pr-4">Day</th>
                                <th className="pb-2 pr-4">Time</th>
                                <th className="pb-2 pr-4">Notes</th>
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
                                  <td className="py-2 pr-4 text-gray-500 max-w-[150px] truncate">{entry.notes || '-'}</td>
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

                    {/* Commission Claims */}
                    {agent.commissionClaims.length > 0 && (
                      <div>
                        <h4 className="font-medium text-sm text-gray-700 mb-2 flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-orange-500" />
                          Commission Claims ({agent.commissionClaims.length})
                        </h4>
                        <div className="space-y-3">
                          {agent.commissionClaims.map(claim => (
                            <div key={claim.id} className={`border rounded-lg p-3 ${claim.status === 'pending' ? 'border-orange-200 bg-orange-50' : claim.status === 'approved' ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex-1 space-y-1">
                                  <div className="flex items-center gap-2">
                                    <Badge className={
                                      claim.status === 'pending' ? 'bg-amber-100 text-amber-700 hover:bg-amber-100' :
                                      claim.status === 'approved' ? 'bg-green-100 text-green-700 hover:bg-green-100' :
                                      'bg-red-100 text-red-700 hover:bg-red-100'
                                    }>
                                      {claim.status.charAt(0).toUpperCase() + claim.status.slice(1)}
                                    </Badge>
                                    {claim.deal_value && (
                                      <span className="text-sm font-medium text-gray-700">£{claim.deal_value.toLocaleString()}</span>
                                    )}
                                    <span className="text-xs text-gray-500">{format(new Date(claim.created_at), 'dd/MM HH:mm')}</span>
                                  </div>
                                  <p className="text-sm text-gray-800">
                                    <span className="font-medium">Reason:</span> {claim.claim_reason}
                                  </p>
                                  {claim.evidence_type && (
                                    <p className="text-sm text-gray-600">
                                      <span className="font-medium">Evidence:</span> {claim.evidence_type}
                                    </p>
                                  )}
                                  {claim.claim_notes && (
                                    <p className="text-sm text-gray-600 italic">"{claim.claim_notes}"</p>
                                  )}
                                </div>
                                {claim.status === 'pending' && (
                                  <div className="flex gap-2 flex-shrink-0">
                                    <Button
                                      size="sm"
                                      className="bg-green-600 hover:bg-green-700 text-white h-8 px-3"
                                      onClick={() => handleClaimAction(claim.id, 'approved')}
                                      disabled={approvingClaimId === claim.id}
                                    >
                                      <Check className="h-3.5 w-3.5 mr-1" />
                                      Approve
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="text-red-600 border-red-200 hover:bg-red-50 h-8 px-3"
                                      onClick={() => handleClaimAction(claim.id, 'rejected')}
                                      disabled={approvingClaimId === claim.id}
                                    >
                                      <XCircle className="h-3.5 w-3.5 mr-1" />
                                      Reject
                                    </Button>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Additional Bonuses */}
                    {agent.bonuses.length > 0 && (
                      <div>
                        <h4 className="font-medium text-sm text-gray-700 mb-2 flex items-center gap-2">
                          <Gift className="h-4 w-4 text-purple-500" />
                          Additional Bonuses ({agent.bonuses.length})
                        </h4>
                        <div className="space-y-2">
                          {agent.bonuses.map(bonus => {
                            const bonusLabel = bonus.bonus_type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                            return (
                              <div key={bonus.id} className={`border rounded-lg p-3 ${bonus.status === 'pending' ? 'border-purple-200 bg-purple-50' : bonus.status === 'approved' ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
                                <div className="flex items-start justify-between gap-3">
                                  <div className="flex-1 space-y-1">
                                    <div className="flex items-center gap-2">
                                      <span className="font-medium text-sm text-gray-900">{bonusLabel}</span>
                                      {bonus.quantity > 1 && <span className="text-xs text-gray-500">×{bonus.quantity}</span>}
                                      {bonus.amount && <span className="text-sm font-medium text-gray-700">£{bonus.amount.toFixed(2)}</span>}
                                      <Badge className={
                                        bonus.status === 'pending' ? 'bg-amber-100 text-amber-700 hover:bg-amber-100' :
                                        bonus.status === 'approved' ? 'bg-green-100 text-green-700 hover:bg-green-100' :
                                        'bg-red-100 text-red-700 hover:bg-red-100'
                                      }>
                                        {bonus.status.charAt(0).toUpperCase() + bonus.status.slice(1)}
                                      </Badge>
                                    </div>
                                    {bonus.description && (
                                      <p className="text-sm text-gray-600 italic">"{bonus.description}"</p>
                                    )}
                                  </div>
                                  {bonus.status === 'pending' && (
                                    <div className="flex gap-2 flex-shrink-0">
                                      <Button
                                        size="sm"
                                        className="bg-green-600 hover:bg-green-700 text-white h-8 px-3"
                                        onClick={async () => {
                                          setApprovingBonusId(bonus.id);
                                          const { error } = await supabase
                                            .from('timesheet_bonuses')
                                            .update({ status: 'approved', reviewed_by: currentAdminId, reviewed_at: new Date().toISOString() })
                                            .eq('id', bonus.id);
                                          if (!error) { toast.success('Bonus approved'); fetchAllTimesheets(); }
                                          else toast.error('Failed to approve');
                                          setApprovingBonusId(null);
                                        }}
                                        disabled={approvingBonusId === bonus.id}
                                      >
                                        <Check className="h-3.5 w-3.5 mr-1" /> Approve
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="text-red-600 border-red-200 hover:bg-red-50 h-8 px-3"
                                        onClick={async () => {
                                          setApprovingBonusId(bonus.id);
                                          const { error } = await supabase
                                            .from('timesheet_bonuses')
                                            .update({ status: 'rejected', reviewed_by: currentAdminId, reviewed_at: new Date().toISOString() })
                                            .eq('id', bonus.id);
                                          if (!error) { toast.success('Bonus rejected'); fetchAllTimesheets(); }
                                          else toast.error('Failed to reject');
                                          setApprovingBonusId(null);
                                        }}
                                        disabled={approvingBonusId === bonus.id}
                                      >
                                        <XCircle className="h-3.5 w-3.5 mr-1" /> Reject
                                      </Button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Comments / Messages */}
                    <div>
                      <h4 className="font-medium text-sm text-gray-700 mb-2 flex items-center gap-2">
                        <MessageSquare className="h-4 w-4 text-blue-500" />
                        Messages
                      </h4>
                      <div className="border rounded-lg bg-white">
                        {/* Message list */}
                        <div className="max-h-[250px] overflow-y-auto p-3 space-y-2">
                          {agent.comments.length === 0 ? (
                            <p className="text-sm text-gray-400 text-center py-4">No messages yet</p>
                          ) : (
                            agent.comments.map(comment => (
                              <div
                                key={comment.id}
                                className={`p-2.5 rounded-lg text-sm max-w-[85%] ${
                                  comment.is_from_accounts
                                    ? 'bg-blue-50 border border-blue-100 ml-auto text-right'
                                    : 'bg-gray-100 border border-gray-200 mr-auto'
                                }`}
                              >
                                <div className="flex items-center gap-2 mb-1">
                                  <span className={`text-xs font-medium ${comment.is_from_accounts ? 'text-blue-600' : 'text-gray-600'}`}>
                                    {comment.is_from_accounts ? 'Accounts' : comment.author_name}
                                  </span>
                                  <span className="text-[10px] text-gray-400">{format(new Date(comment.created_at), 'dd/MM HH:mm')}</span>
                                </div>
                                <p className="text-gray-800">{comment.message}</p>
                              </div>
                            ))
                          )}
                        </div>
                        {/* Reply input */}
                        <div className="border-t p-3 flex gap-2">
                          <Textarea
                            placeholder="Reply to this employee..."
                            value={replyText[agent.admin_user_id] || ''}
                            onChange={e => setReplyText(prev => ({ ...prev, [agent.admin_user_id]: e.target.value }))}
                            className="min-h-[60px] text-sm resize-none"
                          />
                          <Button
                            size="sm"
                            className="self-end bg-blue-600 hover:bg-blue-700 text-white h-9 px-3"
                            onClick={() => sendReply(agent.admin_user_id)}
                            disabled={!replyText[agent.admin_user_id]?.trim() || sendingReply === agent.admin_user_id}
                          >
                            <Send className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
