import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { AlertTriangle, CheckCircle, Eye, ChevronDown, ChevronUp, X } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { format } from 'date-fns';
import { toast } from 'sonner';

interface DetailIssue {
  id: string;
  quote_id: string;
  customer_name: string;
  customer_email: string;
  vehicle_reg: string;
  issue_message: string;
  status: string;
  created_at: string;
}

export const QuoteDetailIssuesAlert = () => {
  const [issues, setIssues] = useState<DetailIssue[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchIssues = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('quote_detail_issues')
        .select('*')
        .eq('status', 'open')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setIssues((data as DetailIssue[]) || []);
    } catch (err) {
      console.error('Error fetching detail issues:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchIssues();

    // Real-time subscription
    const channel = supabase
      .channel('quote-detail-issues')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'quote_detail_issues',
      }, () => {
        toast.error('⚠️ Customer flagged details as incorrect!', {
          description: 'Check the detail issues alert in the leads section.',
          duration: 10000,
        });
        fetchIssues();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchIssues]);

  const handleResolve = async (issueId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: adminUser } = await supabase
        .from('admin_users')
        .select('id')
        .eq('user_id', user?.id || '')
        .maybeSingle();

      await supabase
        .from('quote_detail_issues')
        .update({
          status: 'resolved',
          resolved_by: adminUser?.id || null,
          resolved_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', issueId);

      toast.success('Issue marked as resolved');
      fetchIssues();
    } catch (err) {
      toast.error('Failed to resolve issue');
    }
  };

  if (loading || issues.length === 0) return null;

  return (
    <Card className="border-2 border-red-300 bg-red-50 mb-4">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <CardContent className="py-3 cursor-pointer hover:bg-red-100 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-red-600 animate-pulse" />
                <span className="font-bold text-red-800">
                  ⚠️ Customer Detail Issues
                </span>
                <Badge variant="destructive" className="text-xs">
                  {issues.length} {issues.length === 1 ? 'issue' : 'issues'}
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-red-600">
                  {isOpen ? 'Hide' : 'View'}
                </span>
                {isOpen ? (
                  <ChevronUp className="h-4 w-4 text-red-600" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-red-600" />
                )}
              </div>
            </div>
          </CardContent>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="px-4 pb-4 space-y-3">
            {issues.map((issue) => (
              <div
                key={issue.id}
                className="bg-white rounded-lg border border-red-200 p-4 flex items-start justify-between gap-4"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge className="bg-yellow-400 text-black font-bold text-xs">
                      {issue.vehicle_reg || 'NO REG'}
                    </Badge>
                    <span className="text-sm font-semibold text-gray-900 truncate">
                      {issue.customer_name || 'Unknown Customer'}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 truncate">
                    {issue.customer_email}
                  </p>
                  <p className="text-sm text-red-700 mt-1">
                    {issue.issue_message}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    Flagged: {format(new Date(issue.created_at), 'dd MMM yyyy, HH:mm')}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-green-300 text-green-700 hover:bg-green-50 flex-shrink-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleResolve(issue.id);
                  }}
                >
                  <CheckCircle className="h-4 w-4 mr-1" />
                  Resolve
                </Button>
              </div>
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
};
