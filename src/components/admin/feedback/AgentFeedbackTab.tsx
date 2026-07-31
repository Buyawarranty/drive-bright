import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MessageSquare, Bug, Clock, User, CheckCircle2, Eye, Loader2, Filter } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type FeedbackType = 'technical_issue' | 'customer_feedback' | 'lead_timestamp';
type FeedbackStatus = 'new' | 'reviewed' | 'resolved';

const TYPE_META: Record<FeedbackType, { label: string; icon: React.ComponentType<any>; color: string }> = {
  technical_issue: { label: 'Technical issue', icon: Bug, color: 'bg-red-100 text-red-700 border-red-200' },
  customer_feedback: { label: 'Customer feedback', icon: MessageSquare, color: 'bg-blue-100 text-blue-700 border-blue-200' },
  lead_timestamp: { label: 'Lead timestamp', icon: Clock, color: 'bg-amber-100 text-amber-700 border-amber-200' },
};

const STATUS_META: Record<FeedbackStatus, { label: string; className: string }> = {
  new: { label: 'New', className: 'bg-orange-100 text-orange-700 border-orange-200' },
  reviewed: { label: 'Reviewed', className: 'bg-blue-100 text-blue-700 border-blue-200' },
  resolved: { label: 'Resolved', className: 'bg-green-100 text-green-700 border-green-200' },
};

interface FeedbackRow {
  id: string;
  submitted_by: string;
  feedback_type: FeedbackType;
  lead_reference_text: string | null;
  message: string;
  status: FeedbackStatus;
  resolution_note: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
  submitter_name?: string;
  reviewer_name?: string;
}

const isManagement = (role: string | null) =>
  ['admin', 'super_admin', 'sales_manager', 'performance_manager'].includes(role || '');

export const AgentFeedbackTab: React.FC<{ userRole: string | null }> = ({ userRole }) => {
  const { session } = useAuth();
  const [adminUserId, setAdminUserId] = useState<string | null>(null);
  const [feedbackList, setFeedbackList] = useState<FeedbackRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // form state
  const [feedbackType, setFeedbackType] = useState<FeedbackType>('technical_issue');
  const [leadReference, setLeadReference] = useState('');
  const [message, setMessage] = useState('');

  // filter state
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const canManage = isManagement(userRole);

  // Resolve admin user id for the current session
  useEffect(() => {
    if (!session?.user?.id) return;
    supabase
      .from('admin_users')
      .select('id')
      .eq('user_id', session.user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setAdminUserId(data.id);
      });
  }, [session?.user?.id]);

  const adminUsersMap = React.useMemo(() => {
    const map = new Map<string, string>();
    feedbackList.forEach((f) => {
      if (f.submitter_name) map.set(f.submitted_by, f.submitter_name);
      if (f.reviewer_name && f.reviewed_by) map.set(f.reviewed_by, f.reviewer_name);
    });
    return map;
  }, [feedbackList]);

  const fetchFeedback = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('agent_feedback')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch submitter + reviewer names
      const rows = (data || []) as FeedbackRow[];
      const allUserIds = Array.from(
        new Set([
          ...rows.map((r) => r.submitted_by),
          ...rows.map((r) => r.reviewed_by).filter(Boolean) as string[],
        ]),
      );

      if (allUserIds.length > 0) {
        const { data: users } = await supabase
          .from('admin_users')
          .select('id, first_name, last_name, email')
          .in('id', allUserIds);

        const nameMap = new Map<string, string>();
        (users || []).forEach((u: any) => {
          nameMap.set(u.id, `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email?.split('@')[0] || 'Unknown');
        });

        rows.forEach((r) => {
          r.submitter_name = nameMap.get(r.submitted_by) || 'Unknown agent';
          if (r.reviewed_by) r.reviewer_name = nameMap.get(r.reviewed_by);
        });
      }

      setFeedbackList(rows);
    } catch (err) {
      console.error('[AgentFeedbackTab] fetch error:', err);
      toast.error('Could not load feedback');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFeedback();
  }, [fetchFeedback]);

  const handleSubmit = async () => {
    if (!message.trim()) {
      toast.error('Please enter a message');
      return;
    }
    if (!adminUserId) {
      toast.error('Could not identify your account. Please refresh.');
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.from('agent_feedback').insert({
        submitted_by: adminUserId,
        feedback_type: feedbackType,
        lead_reference_text: leadReference.trim() || null,
        message: message.trim(),
        status: 'new',
      });

      if (error) throw error;

      toast.success('Feedback submitted — thank you!');
      setMessage('');
      setLeadReference('');
      setFeedbackType('technical_issue');
      fetchFeedback();
    } catch (err) {
      console.error('[AgentFeedbackTab] submit error:', err);
      toast.error('Failed to submit feedback');
    } finally {
      setSubmitting(false);
    }
  };

  const updateStatus = async (id: string, status: FeedbackStatus, resolutionNote?: string) => {
    if (!canManage) return;
    try {
      const update: Record<string, any> = {
        status,
        reviewed_by: adminUserId,
        reviewed_at: new Date().toISOString(),
      };
      if (resolutionNote !== undefined) update.resolution_note = resolutionNote;

      const { error } = await supabase.from('agent_feedback').update(update).eq('id', id);
      if (error) throw error;
      toast.success(`Marked as ${STATUS_META[status].label}`);
      fetchFeedback();
    } catch (err) {
      console.error('[AgentFeedbackTab] update error:', err);
      toast.error('Failed to update status');
    }
  };

  const filtered = feedbackList.filter((f) => {
    if (filterType !== 'all' && f.feedback_type !== filterType) return false;
    if (filterStatus !== 'all' && f.status !== filterStatus) return false;
    return true;
  });

  const newCount = feedbackList.filter((f) => f.status === 'new').length;

  return (
    <div className="space-y-6 p-1">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <MessageSquare className="h-6 w-6 text-primary" />
          Agent Feedback
        </h1>
        <p className="text-muted-foreground mt-1">
          Log technical issues, customer feedback, and lead timestamp problems for the management team to review.
        </p>
      </div>

      {/* Submit form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Submit new feedback</CardTitle>
          <CardDescription>Help the team improve by reporting issues as you spot them</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Feedback type</Label>
              <Select value={feedbackType} onValueChange={(v) => setFeedbackType(v as FeedbackType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(TYPE_META) as FeedbackType[]).map((key) => {
                    const Meta = TYPE_META[key];
                    const Icon = Meta.icon;
                    return (
                      <SelectItem key={key} value={key}>
                        <span className="flex items-center gap-2">
                          <Icon className="h-4 w-4" />
                          {Meta.label}
                        </span>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                Lead reference <span className="text-muted-foreground">(optional)</span>
              </Label>
              <input
                type="text"
                placeholder="e.g. reg plate, lead name, or lead ID"
                value={leadReference}
                onChange={(e) => setLeadReference(e.target.value)}
                className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background"
                maxLength={200}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium">Details</Label>
            <Textarea
              placeholder="Describe the issue, what happened, and what you expected…"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="min-h-[100px]"
              maxLength={2000}
            />
            <p className="text-xs text-muted-foreground text-right">{message.length}/2000</p>
          </div>
          <div className="flex justify-end">
            <Button onClick={handleSubmit} disabled={submitting || !message.trim()} className="gap-2">
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Submitting…
                </>
              ) : (
                'Submit feedback'
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-[160px] h-9">
              <SelectValue placeholder="All types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {(Object.keys(TYPE_META) as FeedbackType[]).map((key) => (
                <SelectItem key={key} value={key}>
                  {TYPE_META[key].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[140px] h-9">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {(Object.keys(STATUS_META) as FeedbackStatus[]).map((key) => (
                <SelectItem key={key} value={key}>
                  {STATUS_META[key].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {newCount > 0 && canManage && (
          <Badge className="bg-orange-100 text-orange-700 border-orange-200">
            {newCount} new{newCount === 1 ? '' : ''} to review
          </Badge>
        )}
      </div>

      {/* Feedback list */}
      {loading ? (
        <div className="flex items-center justify-center h-40">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <MessageSquare className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p>No feedback submitted yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((item) => {
            const Meta = TYPE_META[item.feedback_type];
            const Icon = Meta.icon;
            const StatusBadge = STATUS_META[item.status];
            return (
              <Card key={item.id} className={cn('transition-colors', item.status === 'new' && 'border-orange-200')}>
                <CardContent className="p-4">
                  <div className="flex flex-col gap-3">
                    {/* Header row */}
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className={cn('gap-1', Meta.color)}>
                          <Icon className="h-3.5 w-3.5" />
                          {Meta.label}
                        </Badge>
                        <Badge variant="outline" className={StatusBadge.className}>
                          {StatusBadge.label}
                        </Badge>
                        {item.lead_reference_text && (
                          <Badge variant="outline" className="bg-muted/50">
                            <Clock className="h-3 w-3 mr-1" />
                            {item.lead_reference_text}
                          </Badge>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(item.created_at).toLocaleString('en-GB', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                          timeZone: 'Europe/London',
                        })}{' '}
                        GMT
                      </span>
                    </div>

                    {/* Message */}
                    <p className="text-sm whitespace-pre-wrap">{item.message}</p>

                    {/* Footer */}
                    <div className="flex items-center justify-between gap-3 flex-wrap pt-1 border-t">
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {item.submitter_name || 'Unknown agent'}
                        </span>
                        {item.reviewer_name && (
                          <span className="flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3" />
                            Reviewed by {item.reviewer_name}
                          </span>
                        )}
                      </div>

                      {/* Manager actions */}
                      {canManage && (
                        <div className="flex items-center gap-2">
                          {item.status === 'new' && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 gap-1"
                              onClick={() => updateStatus(item.id, 'reviewed')}
                            >
                              <Eye className="h-3.5 w-3.5" /> Mark reviewed
                            </Button>
                          )}
                          {item.status !== 'resolved' && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 gap-1 border-green-300 text-green-700 hover:bg-green-50"
                              onClick={() => {
                                const note = window.prompt('Add a resolution note (optional):', item.resolution_note || '');
                                if (note !== null) updateStatus(item.id, 'resolved', note);
                              }}
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" /> Resolve
                            </Button>
                          )}
                          {item.status === 'resolved' && item.resolution_note && (
                            <span className="text-xs text-muted-foreground italic">
                              {item.resolution_note}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};
