import React, { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { Plus, Star, Trash2, Check, Clock, XCircle, Gift } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

const BONUS_TYPES = [
  { value: 'trustpilot_review', label: 'Trustpilot Review' },
  { value: 'negative_review_removal', label: 'Negative Review Removal' },
  { value: 'google_review', label: 'Google Review' },
  { value: 'upsell_addon', label: 'Upsell / Add-on Sale' },
  { value: 'referral_bonus', label: 'Referral Bonus' },
  { value: 'other', label: 'Other' },
];

interface BonusEntry {
  id: string;
  bonus_type: string;
  description: string | null;
  quantity: number;
  amount: number | null;
  status: string;
  created_at: string;
}

interface AdditionalBonusesProps {
  currentMonth: Date;
}

export function AdditionalBonuses({ currentMonth }: AdditionalBonusesProps) {
  const { session } = useAuth();
  const [bonuses, setBonuses] = useState<BonusEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState({
    bonus_type: '',
    description: '',
    quantity: 1,
    amount: '',
  });

  const monthKey = format(currentMonth, 'yyyy-MM');

  const fetchBonuses = useCallback(async () => {
    if (!session?.user?.id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('timesheet_bonuses')
        .select('*')
        .eq('user_id', session.user.id)
        .eq('month_year', monthKey)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setBonuses((data || []) as BonusEntry[]);
    } catch (err) {
      console.error('Error fetching bonuses:', err);
    } finally {
      setLoading(false);
    }
  }, [session?.user?.id, monthKey]);

  useEffect(() => {
    fetchBonuses();
  }, [fetchBonuses]);

  const handleSubmit = async () => {
    if (!session?.user?.id || !form.bonus_type) {
      toast.error('Please select a bonus type');
      return;
    }

    try {
      const { data: adminUser } = await supabase
        .from('admin_users')
        .select('id')
        .eq('user_id', session.user.id)
        .maybeSingle();

      const { error } = await supabase
        .from('timesheet_bonuses')
        .insert({
          user_id: session.user.id,
          admin_user_id: adminUser?.id || null,
          month_year: monthKey,
          bonus_type: form.bonus_type,
          description: form.description || null,
          quantity: form.quantity || 1,
          amount: form.amount ? parseFloat(form.amount) : null,
        });

      if (error) throw error;
      toast.success('Bonus item added');
      setForm({ bonus_type: '', description: '', quantity: 1, amount: '' });
      setIsOpen(false);
      fetchBonuses();
    } catch (err: any) {
      console.error('Error adding bonus:', err);
      toast.error('Failed to add bonus: ' + err.message);
    }
  };

  const statusConfig: Record<string, { icon: React.ElementType; label: string; className: string }> = {
    pending: { icon: Clock, label: 'Pending', className: 'bg-amber-100 text-amber-700' },
    approved: { icon: Check, label: 'Approved', className: 'bg-green-100 text-green-700' },
    rejected: { icon: XCircle, label: 'Rejected', className: 'bg-red-100 text-red-700' },
  };

  const getBonusLabel = (type: string) => BONUS_TYPES.find(b => b.value === type)?.label || type;

  return (
    <div className="bg-white rounded-xl shadow-sm border">
      <div className="p-5 border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Gift className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Additional Bonuses</h3>
              <p className="text-sm text-gray-500">Reviews, referrals & extras</p>
            </div>
          </div>
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5 bg-purple-600 hover:bg-purple-700">
                <Plus className="h-4 w-4" />
                Add Bonus
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Add Bonus Item</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div>
                  <Label className="text-sm">Bonus Type <span className="text-red-500">*</span></Label>
                  <Select value={form.bonus_type} onValueChange={v => setForm(p => ({ ...p, bonus_type: v }))}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {BONUS_TYPES.map(b => (
                        <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-sm">Quantity</Label>
                    <Input
                      type="number"
                      min={1}
                      value={form.quantity}
                      onChange={e => setForm(p => ({ ...p, quantity: parseInt(e.target.value) || 1 }))}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-sm">Amount (£) <span className="text-gray-400 text-xs">optional</span></Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={form.amount}
                      onChange={e => setForm(p => ({ ...p, amount: e.target.value }))}
                      placeholder="0.00"
                      className="mt-1"
                    />
                  </div>
                </div>

                <div>
                  <Label className="text-sm">Description (optional)</Label>
                  <Textarea
                    value={form.description}
                    onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                    placeholder="e.g. Customer left 5-star Trustpilot review after purchase"
                    className="mt-1 h-16 resize-none"
                  />
                </div>

                <Button onClick={handleSubmit} className="w-full bg-purple-600 hover:bg-purple-700 gap-2">
                  <Check className="h-4 w-4" />
                  Submit for Approval
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4 p-5 border-b bg-gray-50">
        <div className="text-center">
          <div className="text-2xl font-bold text-gray-900">{bonuses.length}</div>
          <div className="text-xs text-gray-500">Total</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-green-600">{bonuses.filter(b => b.status === 'approved').length}</div>
          <div className="text-xs text-gray-500">Approved</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-amber-600">{bonuses.filter(b => b.status === 'pending').length}</div>
          <div className="text-xs text-gray-500">Pending</div>
        </div>
      </div>

      {/* List */}
      <div className="max-h-[250px] overflow-y-auto">
        {loading ? (
          <div className="p-6 text-center text-gray-400 text-sm">Loading...</div>
        ) : bonuses.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <Star className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No bonus items this month</p>
            <p className="text-xs mt-1">Add Trustpilot reviews, referral bonuses, etc.</p>
          </div>
        ) : (
          <div className="divide-y">
            {bonuses.map(bonus => {
              const config = statusConfig[bonus.status] || statusConfig.pending;
              const Icon = config.icon;
              return (
                <div key={bonus.id} className="p-4 hover:bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900 text-sm">{getBonusLabel(bonus.bonus_type)}</span>
                        {bonus.quantity > 1 && (
                          <span className="text-xs text-gray-500">×{bonus.quantity}</span>
                        )}
                      </div>
                      {bonus.description && (
                        <p className="text-xs text-gray-500 mt-0.5 truncate max-w-[200px]">{bonus.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {bonus.amount && (
                        <span className="text-sm font-medium text-gray-700">£{Number(bonus.amount).toFixed(2)}</span>
                      )}
                      <Badge className={`${config.className} hover:${config.className} text-[10px] gap-1`}>
                        <Icon className="h-2.5 w-2.5" />
                        {config.label}
                      </Badge>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
