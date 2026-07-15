import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

interface Agent {
  id: string;            // admin_users.id
  name: string;
  email?: string;
  is_active?: boolean;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId: string;
  customerName?: string | null;
  currentCreditAdminUserId: string | null;
  defaultAgentId?: string | null; // usually assigned_to
  onSaved?: () => void;
}

const CLEAR_VALUE = '__clear__';

export const SaleCreditOverrideDialog: React.FC<Props> = ({
  open,
  onOpenChange,
  customerId,
  customerName,
  currentCreditAdminUserId,
  defaultAgentId,
  onSaved,
}) => {
  const { toast } = useToast();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selected, setSelected] = useState<string>('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSelected(currentCreditAdminUserId || '');
    setReason('');
    (async () => {
      const { data } = await supabase
        .from('admin_users')
        .select('id, first_name, last_name, email, is_active')
        .in('role', ['sales', 'sales_lead'])
        .order('first_name');
      setAgents(
        (data || []).map((u: any) => ({
          id: u.id,
          name: `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email,
          email: u.email,
          is_active: u.is_active !== false,
        }))
      );
    })();
  }, [open, currentCreditAdminUserId]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: authData } = await supabase.auth.getUser();
      const clearing = selected === CLEAR_VALUE;
      const targetAdminId = clearing ? null : (selected || null);

      const { error } = await supabase
        .from('customers')
        .update({
          sale_credit_admin_user_id: targetAdminId,
          sale_credit_overridden_by: targetAdminId ? authData.user?.id ?? null : null,
          sale_credit_overridden_at: targetAdminId ? new Date().toISOString() : null,
          sale_credit_override_reason: targetAdminId ? (reason.trim() || null) : null,
        })
        .eq('id', customerId);

      if (error) throw error;

      toast({
        title: clearing ? 'Sale credit override cleared' : 'Sale credit reassigned',
        description: clearing
          ? 'Attribution reverted to the default (payment confirmer / assigned agent).'
          : `Credit for this deal now goes to ${agents.find(a => a.id === targetAdminId)?.name ?? 'selected agent'}.`,
      });
      onSaved?.();
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: 'Failed to save', description: e.message || String(e), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reassign sale credit</DialogTitle>
          <DialogDescription>
            Manager override for who gets credit for this deal
            {customerName ? ` — ${customerName}` : ''}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Give credit to</Label>
            <Select value={selected || undefined} onValueChange={setSelected}>
              <SelectTrigger>
                <SelectValue placeholder="Select agent…" />
              </SelectTrigger>
              <SelectContent>
                {currentCreditAdminUserId && (
                  <SelectItem value={CLEAR_VALUE}>
                    Clear override (use default attribution)
                  </SelectItem>
                )}
                {agents.map(a => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}{!a.is_active ? ' (inactive)' : ''}
                    {defaultAgentId === a.id ? ' — assigned agent' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              This overrides the default (payment confirmer → quote sent by → assigned agent).
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="credit-reason">Reason (optional)</Label>
            <Textarea
              id="credit-reason"
              placeholder="e.g. Freddie did all the work; Thomas only confirmed payment."
              value={reason}
              onChange={e => setReason(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || !selected}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SaleCreditOverrideDialog;
