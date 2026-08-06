import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Loader2,
  Save,
  Settings,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Plus,
} from 'lucide-react';
import { toast } from 'sonner';

interface Agent {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  role: Database['public']['Enums']['user_role'];
  is_active: boolean;
}

interface AgentUsage {
  used3mo: number;
  used6mo: number;
  allow3mo: number;
  allow6mo: number;
  remaining3mo: number;
  remaining6mo: number;
}

interface RequestRow {
  id: string;
  admin_user_id: string;
  request_type: string;
  reason: string;
  status: string;
  decided_by_name: string | null;
  decision_note: string | null;
  created_at: string;
}

interface Props {
  open?: boolean;
  onOpenChange?: (o: boolean) => void;
  standalone?: boolean;
}


const SALES_ROLES: Database['public']['Enums']['user_role'][] = ['sales', 'sales_lead', 'claims_agent', 'lead_gen'];


function getLondonYearMonth(): string {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(now);
  const year = parts.find((p) => p.type === 'year')?.value;
  const month = parts.find((p) => p.type === 'month')?.value;
  return `${year}-${month}`;
}

export function ConcessionAllowanceManager({ open, onOpenChange, standalone }: Props) {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [drafts, setDrafts] = useState<Record<string, { allow3mo: string; allow6mo: string }>>({});
  const [bulk3mo, setBulk3mo] = useState('');
  const [bulk6mo, setBulk6mo] = useState('');
  const [saving, setSaving] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('caps');
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [decisionNote, setDecisionNote] = useState<Record<string, string>>({});

  const yearMonth = getLondonYearMonth();
  const isOpen = standalone ? true : open;

  const agentIds = useMemo(() => agents.map((a) => a.id), [agents]);

  useEffect(() => {
    if (!isOpen) return;
    (async () => {
      setLoading(true);

      const [{ data: rows, error: agentsError }, { data: allowances, error: allowancesError }] =
        await Promise.all([
          supabase
            .from('admin_users')
            .select('id, first_name, last_name, email, role, is_active')
            .in('role', SALES_ROLES)
            .order('is_active', { ascending: false })
            .order('first_name'),
          supabase
            .from('concession_allowances')
            .select('*')
            .eq('year_month', yearMonth),
        ]);

      if (agentsError || allowancesError) {
        toast.error('Could not load agents');
      }

      const agentsData = (rows || []) as Agent[];
      setAgents(agentsData);

      const allowanceMap: Record<string, { allow3mo: number; allow6mo: number }> = {};
      (allowances || []).forEach((a) => {
        allowanceMap[a.admin_user_id] = {
          allow3mo: a.allow_3mo,
          allow6mo: a.allow_6mo,
        };
      });

      const draftsMap: Record<string, { allow3mo: string; allow6mo: string }> = {};
      agentsData.forEach((a) => {
        draftsMap[a.id] = {
          allow3mo: allowanceMap[a.id]?.allow3mo == null ? '10' : String(allowanceMap[a.id].allow3mo),
          allow6mo: allowanceMap[a.id]?.allow6mo == null ? '3' : String(allowanceMap[a.id].allow6mo),
        };
      });
      setDrafts(draftsMap);

      await fetchRequests();
      setLoading(false);
    })();
  }, [open, yearMonth]);

  const fetchRequests = async () => {
    const { data, error } = await supabase
      .from('concession_auth_requests')
      .select('*')
      .eq('year_month', yearMonth)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
    if (error) {
      toast.error('Could not load requests');
      return;
    }
    setRequests((data || []) as RequestRow[]);
  };

  const [usage, setUsage] = useState<Record<string, AgentUsage>>({});

  useEffect(() => {
    if (!open || agentIds.length === 0) return;
    (async () => {
      const { data: usageRows, error: usageError } = await supabase.rpc('get_concession_usage', {
        p_admin_user_id: agentIds[0],
        p_year_month: yearMonth,
      });
      // Individual RPC per agent is simplest; there are only a handful of sales agents.
      const map: Record<string, AgentUsage> = {};
      for (const id of agentIds) {
        const { data } = await supabase.rpc('get_concession_usage', {
          p_admin_user_id: id,
          p_year_month: yearMonth,
        });
        const u = data?.[0] || { used_3mo: 0, used_6mo: 0 };
        const a3 = Number(drafts[id]?.allow3mo ?? '10');
        const a6 = Number(drafts[id]?.allow6mo ?? '3');
        map[id] = {
          used3mo: Number(u.used_3mo || 0),
          used6mo: Number(u.used_6mo || 0),
          allow3mo: a3,
          allow6mo: a6,
          remaining3mo: Math.max(0, a3 - Number(u.used_3mo || 0)),
          remaining6mo: Math.max(0, a6 - Number(u.used_6mo || 0)),
        };
      }
      if (!usageError) {
        setUsage(map);
      }
    })();
  }, [open, agentIds, yearMonth, drafts]);

  const parseIntSafe = (raw: string): number | null => {
    const t = raw.trim();
    if (t === '') return null;
    const n = parseInt(t, 10);
    if (!Number.isFinite(n) || n < 0) return null;
    return n;
  };

  const handleSaveAgent = async (a: Agent) => {
    const v3 = parseIntSafe(drafts[a.id]?.allow3mo ?? '10');
    const v6 = parseIntSafe(drafts[a.id]?.allow6mo ?? '3');
    if (v3 === null || v6 === null) {
      toast.error('Allowances must be whole numbers of 0 or more');
      return;
    }
    setSaving(a.id);
    const { error } = await supabase.from('concession_allowances').upsert(
      {
        admin_user_id: a.id,
        year_month: yearMonth,
        allow_3mo: v3,
        allow_6mo: v6,
      },
      { onConflict: 'admin_user_id, year_month' }
    );
    setSaving(null);
    if (error) {
      toast.error(error.message || 'Could not save');
      return;
    }
    setUsage((prev) => ({
      ...prev,
      [a.id]: {
        ...prev[a.id],
        allow3mo: v3,
        allow6mo: v6,
        remaining3mo: Math.max(0, v3 - (prev[a.id]?.used3mo || 0)),
        remaining6mo: Math.max(0, v6 - (prev[a.id]?.used6mo || 0)),
      },
    }));
    toast.success(`${a.first_name || a.email}: allowance saved`);
  };

  const applyBulk = async () => {
    const v3 = parseIntSafe(bulk3mo);
    const v6 = parseIntSafe(bulk6mo);
    if (v3 === null || v6 === null) {
      toast.error('Enter valid numbers for both allowances');
      return;
    }
    const rows = agents.map((a) => ({
      admin_user_id: a.id,
      year_month: yearMonth,
      allow_3mo: v3,
      allow_6mo: v6,
    }));
    const { error } = await supabase.from('concession_allowances').upsert(rows, {
      onConflict: 'admin_user_id, year_month',
    });
    if (error) {
      toast.error(error.message || 'Could not apply bulk values');
      return;
    }
    const next: Record<string, { allow3mo: string; allow6mo: string }> = {};
    agents.forEach((a) => {
      next[a.id] = { allow3mo: String(v3), allow6mo: String(v6) };
    });
    setDrafts(next);
    toast.success('Bulk defaults applied');
  };

  const resetDefaults = async () => {
    const rows = agents.map((a) => ({
      admin_user_id: a.id,
      year_month: yearMonth,
      allow_3mo: 10,
      allow_6mo: 3,
    }));
    const { error } = await supabase.from('concession_allowances').upsert(rows, {
      onConflict: 'admin_user_id, year_month',
    });
    if (error) {
      toast.error(error.message || 'Could not reset defaults');
      return;
    }
    const next: Record<string, { allow3mo: string; allow6mo: string }> = {};
    agents.forEach((a) => {
      next[a.id] = { allow3mo: '10', allow6mo: '3' };
    });
    setDrafts(next);
    toast.success('Reset to 10 × 3mo and 3 × 6mo');
  };

  const handleDecision = async (req: RequestRow, status: 'approved' | 'rejected') => {
    const note = decisionNote[req.id]?.trim() || '';
    const { data: auth } = await supabase.auth.getUser();
    const decider = auth.user?.id;
    const { data: admin } = await supabase
      .from('admin_users')
      .select('first_name, last_name')
      .eq('user_id', decider || '')
      .maybeSingle();
    const deciderName = [admin?.first_name, admin?.last_name].filter(Boolean).join(' ');

    if (status === 'approved') {
      // Increase that agent's allowance by 1 for the requested type.
      const { data: row } = await supabase
        .from('concession_allowances')
        .select('allow_3mo, allow_6mo')
        .eq('admin_user_id', req.admin_user_id)
        .eq('year_month', yearMonth)
        .maybeSingle();
      const current3 = row?.allow_3mo ?? 10;
      const current6 = row?.allow_6mo ?? 3;
      const { error: upsertError } = await supabase.from('concession_allowances').upsert(
        {
          admin_user_id: req.admin_user_id,
          year_month: yearMonth,
          allow_3mo: req.request_type === '3mo' ? current3 + 1 : current3,
          allow_6mo: req.request_type === '6mo' ? current6 + 1 : current6,
        },
        { onConflict: 'admin_user_id, year_month' }
      );
      if (upsertError) {
        toast.error(upsertError.message || 'Could not update allowance');
        return;
      }
    }

    const { error } = await supabase
      .from('concession_auth_requests')
      .update({
        status,
        decided_by: decider,
        decided_by_name: deciderName || null,
        decision_note: note || null,
        decided_at: new Date().toISOString(),
      })
      .eq('id', req.id);
    if (error) {
      toast.error(error.message || 'Could not update request');
      return;
    }
    toast.success(`Request ${status}`);
    await fetchRequests();
    // Refresh the draft values for the affected agent so the manager sees the new cap.
    if (status === 'approved') {
      const { data: row } = await supabase
        .from('concession_allowances')
        .select('allow_3mo, allow_6mo')
        .eq('admin_user_id', req.admin_user_id)
        .eq('year_month', yearMonth)
        .maybeSingle();
      setDrafts((prev) => ({
        ...prev,
        [req.admin_user_id]: {
          allow3mo: String(row?.allow_3mo ?? 10),
          allow6mo: String(row?.allow_6mo ?? 3),
        },
      }));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Monthly concession allowance
          </DialogTitle>
          <DialogDescription>
            Set per-agent caps for free-month extensions and approve requests when they run out.
            Month: {yearMonth}.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-3">
            <TabsTrigger value="caps">Caps</TabsTrigger>
            <TabsTrigger value="requests">
              Requests
              {requests.length > 0 && (
                <Badge variant="destructive" className="ml-2 text-[10px] px-1.5 py-0">
                  {requests.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="caps">
            {loading ? (
              <div className="flex items-center gap-2 py-8 text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading agents…
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-end gap-3 mb-4">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">Bulk +3mo</Label>
                      <Input
                        value={bulk3mo}
                        onChange={(e) => setBulk3mo(e.target.value)}
                        placeholder="10"
                        className="w-24 h-8"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Bulk +6mo</Label>
                      <Input
                        value={bulk6mo}
                        onChange={(e) => setBulk6mo(e.target.value)}
                        placeholder="3"
                        className="w-24 h-8"
                      />
                    </div>
                  </div>
                  <Button variant="secondary" size="sm" onClick={applyBulk}>
                    <Plus className="w-4 h-4 mr-1" />
                    Apply to all
                  </Button>
                  <Button variant="outline" size="sm" onClick={resetDefaults}>
                    <RotateCcw className="w-4 h-4 mr-1" />
                    Reset to 10/3
                  </Button>
                </div>

                <div className="border rounded-md overflow-hidden">
                  <table className="min-w-full text-sm">
                    <thead className="bg-muted">
                      <tr>
                        <th className="text-left px-3 py-2 font-medium">Agent</th>
                        <th className="text-left px-3 py-2 font-medium">+3mo cap</th>
                        <th className="text-left px-3 py-2 font-medium">+6mo cap</th>
                        <th className="text-left px-3 py-2 font-medium">Used</th>
                        <th className="text-right px-3 py-2 font-medium">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {agents.map((a) => {
                        const u = usage[a.id];
                        const draft = drafts[a.id] || { allow3mo: '10', allow6mo: '3' };
                        return (
                          <tr key={a.id} className="border-t">
                            <td className="px-3 py-2">
                              <div className="font-medium">
                                {a.first_name} {a.last_name}
                              </div>
                              <div className="text-xs text-muted-foreground">{a.email}</div>
                              {!a.is_active && (
                                <Badge variant="outline" className="text-[10px] mt-1">
                                  inactive
                                </Badge>
                              )}
                            </td>
                            <td className="px-3 py-2">
                              <Input
                                value={draft.allow3mo}
                                onChange={(e) =>
                                  setDrafts((prev) => ({
                                    ...prev,
                                    [a.id]: { ...prev[a.id], allow3mo: e.target.value },
                                  }))
                                }
                                className="w-20 h-8"
                              />
                            </td>
                            <td className="px-3 py-2">
                              <Input
                                value={draft.allow6mo}
                                onChange={(e) =>
                                  setDrafts((prev) => ({
                                    ...prev,
                                    [a.id]: { ...prev[a.id], allow6mo: e.target.value },
                                  }))
                                }
                                className="w-20 h-8"
                              />
                            </td>
                            <td className="px-3 py-2 text-xs">
                              {u ? (
                                <div>
                                  <div>3mo: {u.used3mo} used</div>
                                  <div>6mo: {u.used6mo} used</div>
                                  <div className="text-muted-foreground">
                                    Remaining: {u.remaining3mo} / {u.remaining6mo}
                                  </div>
                                </div>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-right">
                              <Button
                                size="sm"
                                disabled={saving === a.id}
                                onClick={() => handleSaveAgent(a)}
                              >
                                {saving === a.id ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <Save className="w-4 h-4 mr-1" />
                                )}
                                Save
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </TabsContent>

          <TabsContent value="requests">
            {requests.length === 0 ? (
              <div className="text-sm text-muted-foreground py-6">No pending requests.</div>
            ) : (
              <div className="space-y-3">
                {requests.map((req) => (
                  <div key={req.id} className="border rounded-md p-3">
                    <div className="flex items-center justify-between mb-2">
                      <Badge variant="outline">
                        {req.request_type === '3mo' ? '+3 months' : '+6 months'}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {new Date(req.created_at).toLocaleString('en-GB')}
                      </span>
                    </div>
                    <p className="text-sm mb-3">{req.reason}</p>
                    <div className="grid gap-2">
                      <Textarea
                        placeholder="Manager note (optional)"
                        value={decisionNote[req.id] || ''}
                        onChange={(e) =>
                          setDecisionNote((prev) => ({ ...prev, [req.id]: e.target.value }))
                        }
                        className="min-h-[60px] text-sm"
                      />
                      <div className="flex gap-2 justify-end">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDecision(req, 'rejected')}
                        >
                          <XCircle className="w-4 h-4 mr-1" />
                          Reject
                        </Button>
                        <Button size="sm" onClick={() => handleDecision(req, 'approved')}>
                          <CheckCircle2 className="w-4 h-4 mr-1" />
                          Approve (+1)
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
