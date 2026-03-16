import React, { useState, useMemo, useEffect } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, RefreshCw, UserRoundCog } from 'lucide-react';
import { AdminUser } from '@/hooks/useLeads';

interface BulkReassignDialogProps {
  salesUsers: AdminUser[];
  onComplete: () => void;
}

export const BulkReassignDialog: React.FC<BulkReassignDialogProps> = ({
  salesUsers,
  onComplete,
}) => {
  const [open, setOpen] = useState(false);
  const [fromAgent, setFromAgent] = useState<string | null>(null);
  const [toAgent, setToAgent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [leadCount, setLeadCount] = useState<number | null>(null);
  const [step, setStep] = useState<'select' | 'confirm'>('select');
  const [allAgents, setAllAgents] = useState<AdminUser[]>([]);

  // Fetch all agents (including inactive) when dialog opens
  useEffect(() => {
    if (!open) return;
    const fetchAll = async () => {
      const { data } = await supabase
        .from('admin_users')
        .select('id, user_id, first_name, last_name, email, is_active, role')
        .in('role', ['sales', 'sales_lead', 'admin', 'super_admin'])
        .order('first_name');
      setAllAgents((data as AdminUser[]) || []);
    };
    fetchAll();
  }, [open]);

  const getInitials = (user: AdminUser) => {
    if (user.first_name || user.last_name) {
      return `${user.first_name?.[0] || ''}${user.last_name?.[0] || ''}`.toUpperCase();
    }
    return user.email[0].toUpperCase();
  };

  const getDisplayName = (user: AdminUser) => {
    if (user.first_name || user.last_name) {
      return `${user.first_name || ''} ${user.last_name || ''}`.trim();
    }
    return user.email;
  };

  const fromUser = useMemo(() => allAgents.find(u => u.id === fromAgent), [allAgents, fromAgent]);
  const toUser = useMemo(() => salesUsers.find(u => u.id === toAgent), [salesUsers, toAgent]);

  // "To" agents: only active users, excluding the "from" agent
  const toAgents = useMemo(() => salesUsers.filter(u => u.id !== fromAgent), [salesUsers, fromAgent]);

  const handleCheckCount = async () => {
    if (!fromAgent) return;
    setLoading(true);
    try {
      const [leadsResult, customersResult] = await Promise.all([
        supabase
          .from('sales_leads')
          .select('*', { count: 'exact', head: true })
          .eq('assigned_to', fromAgent),
        supabase
          .from('customers')
          .select('*', { count: 'exact', head: true })
          .eq('assigned_to', fromAgent)
          .eq('is_deleted', false),
      ]);

      if (leadsResult.error) throw leadsResult.error;
      if (customersResult.error) throw customersResult.error;

      setLeadCount((leadsResult.count || 0) + (customersResult.count || 0));
      setStep('confirm');
    } catch (err) {
      console.error('Error checking lead count:', err);
      toast.error('Failed to check lead count');
    } finally {
      setLoading(false);
    }
  };

  const handleReassign = async () => {
    if (!fromAgent || !toAgent) return;
    setLoading(true);
    try {
      const now = new Date().toISOString();

      const [leadsResult, customersResult] = await Promise.all([
        supabase
          .from('sales_leads')
          .update({ 
            assigned_to: toAgent,
            assigned_at: now,
            updated_at: now,
          })
          .eq('assigned_to', fromAgent),
        supabase
          .from('customers')
          .update({ 
            assigned_to: toAgent,
            updated_at: now,
          })
          .eq('assigned_to', fromAgent),
      ]);

      if (leadsResult.error) throw leadsResult.error;
      if (customersResult.error) throw customersResult.error;

      toast.success(`Successfully reassigned ${leadCount} record${leadCount !== 1 ? 's' : ''} from ${getDisplayName(fromUser!)} to ${getDisplayName(toUser!)}`);
      setOpen(false);
      resetState();
      onComplete();
    } catch (err) {
      console.error('Error reassigning leads:', err);
      toast.error('Failed to reassign leads');
    } finally {
      setLoading(false);
    }
  };

  const resetState = () => {
    setFromAgent(null);
    setToAgent(null);
    setLeadCount(null);
    setStep('select');
  };

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) resetState();
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
          <UserRoundCog className="h-3.5 w-3.5" />
          Reassign All
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserRoundCog className="h-5 w-5" />
            Bulk Reassign Leads
          </DialogTitle>
          <DialogDescription>
            Transfer all leads and customer records from one agent to another. Statuses, notes, and other data will not be changed.
          </DialogDescription>
        </DialogHeader>

        {step === 'select' && (
          <div className="space-y-4 py-2">
            {/* FROM agent */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">From agent</label>
              <div className="grid grid-cols-1 gap-2 max-h-40 overflow-y-auto">
                {allAgents.map((user) => (
                  <button
                    key={user.id}
                    onClick={() => { setFromAgent(user.id); setToAgent(null); setLeadCount(null); }}
                    className={`flex items-center gap-3 p-2.5 rounded-lg border-2 text-left transition-colors ${
                      fromAgent === user.id
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

            {/* TO agent */}
            {fromAgent && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">To agent</label>
                <div className="grid grid-cols-1 gap-2 max-h-40 overflow-y-auto">
                  {toAgents.map((user) => (
                    <button
                      key={user.id}
                      onClick={() => setToAgent(user.id)}
                      className={`flex items-center gap-3 p-2.5 rounded-lg border-2 text-left transition-colors ${
                        toAgent === user.id
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
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {step === 'confirm' && fromUser && toUser && (
          <div className="space-y-4 py-2">
            <div className="flex items-center justify-center gap-4 py-4">
              <div className="text-center">
                <Avatar className="h-12 w-12 mx-auto mb-2">
                  <AvatarFallback className="bg-destructive/10 text-destructive font-semibold">
                    {getInitials(fromUser)}
                  </AvatarFallback>
                </Avatar>
                <p className="text-sm font-medium">{getDisplayName(fromUser)}</p>
              </div>
              <ArrowRight className="h-6 w-6 text-muted-foreground flex-shrink-0" />
              <div className="text-center">
                <Avatar className="h-12 w-12 mx-auto mb-2">
                  <AvatarFallback className="bg-green-100 text-green-700 font-semibold">
                    {getInitials(toUser)}
                  </AvatarFallback>
                </Avatar>
                <p className="text-sm font-medium">{getDisplayName(toUser)}</p>
              </div>
            </div>
            <div className="bg-muted/50 rounded-lg p-4 text-center border-2 border-border">
              <p className="text-2xl font-bold text-foreground">{leadCount}</p>
              <p className="text-sm text-muted-foreground">lead{leadCount !== 1 ? 's' : ''} will be transferred</p>
            </div>
            <p className="text-xs text-muted-foreground text-center">
              ⚠️ This will only change the assigned agent. All statuses, notes, call counts, and other data remain untouched.
            </p>
          </div>
        )}

        <DialogFooter>
          {step === 'select' && (
            <Button
              onClick={handleCheckCount}
              disabled={!fromAgent || !toAgent || loading}
              className="w-full gap-2"
            >
              {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
              Continue
            </Button>
          )}
          {step === 'confirm' && (
            <div className="flex gap-2 w-full">
              <Button variant="outline" onClick={() => setStep('select')} className="flex-1">
                Back
              </Button>
              <Button
                onClick={handleReassign}
                disabled={loading || leadCount === 0}
                className="flex-1 bg-primary hover:bg-primary/90 gap-2"
              >
                {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : null}
                Reassign {leadCount} Lead{leadCount !== 1 ? 's' : ''}
              </Button>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
