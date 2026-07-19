import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Search, Loader2, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import { useDebounce } from '@/hooks/useDebounce';

type Action = 'cancelled' | 'refunded' | 'partial_refund';

interface CustomerHit {
  id: string;
  name: string | null;
  email: string | null;
  registration_plate: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  status: string | null;
  final_amount: number | null;
  warranty_number: string | null;
}

interface Props {
  onUpdated?: () => void;
}

export const QuickCancellationAdd: React.FC<Props> = ({ onUpdated }) => {
  const [search, setSearch] = useState('');
  const debounced = useDebounce(search, 300);
  const [results, setResults] = useState<CustomerHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<CustomerHit | null>(null);
  const [action, setAction] = useState<Action>('cancelled');
  const [refundAmount, setRefundAmount] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const term = debounced.trim();
    if (term.length < 2) { setResults([]); return; }
    let cancelled = false;
    setSearching(true);
    (async () => {
      const like = `%${term}%`;
      const compact = term.replace(/\s+/g, '').toUpperCase();
      const regVariants = new Set<string>([term]);
      if (compact.length >= 5) {
        regVariants.add(compact);
        regVariants.add(`${compact.slice(0, -3)} ${compact.slice(-3)}`);
      }
      const regClauses = Array.from(regVariants).map(v => `registration_plate.ilike.%${v}%`).join(',');
      const { data, error } = await supabase
        .from('customers')
        .select('id, name, email, registration_plate, vehicle_make, vehicle_model, status, final_amount, warranty_number')
        .eq('is_deleted', false)
        .or(`name.ilike.${like},email.ilike.${like},${regClauses},warranty_number.ilike.${like}`)
        .order('updated_at', { ascending: false })
        .limit(15);
      if (cancelled) return;
      if (error) {
        console.error(error);
        toast.error('Search failed');
        setResults([]);
      } else {
        setResults((data || []) as CustomerHit[]);
      }
      setSearching(false);
    })();
    return () => { cancelled = true; };
  }, [debounced]);

  const requireAmount = action === 'partial_refund' || action === 'refunded';

  const actionLabel = useMemo(() => ({
    cancelled: 'Cancelled',
    refunded: 'Refunded',
    partial_refund: 'Partial Refund',
  })[action], [action]);

  const reset = () => {
    setSelected(null);
    setSearch('');
    setResults([]);
    setRefundAmount('');
    setNote('');
    setAction('cancelled');
  };

  const handleSave = async () => {
    if (!selected) return;
    if (requireAmount) {
      const amt = parseFloat(refundAmount);
      if (!isFinite(amt) || amt <= 0) {
        toast.error('Enter a valid refund amount');
        return;
      }
    }
    setSaving(true);
    try {
      const nowIso = new Date().toISOString();
      const { data: authData } = await supabase.auth.getUser();
      const updaterId = authData?.user?.id ?? null;

      const newStatus =
        action === 'cancelled' ? 'Cancelled'
        : action === 'refunded' ? 'Refunded'
        : 'Partial Refund';

      const noteParts: string[] = [];
      noteParts.push(`[${actionLabel}]`);
      if (requireAmount) noteParts.push(`Refund: £${parseFloat(refundAmount).toFixed(2)}`);
      if (note.trim()) noteParts.push(note.trim());
      const combinedNote = noteParts.join(' — ');

      const { error } = await supabase
        .from('customers')
        .update({
          status: newStatus,
          cancellation_note: combinedNote,
          cancellation_note_updated_at: nowIso,
          cancellation_note_updated_by: updaterId,
          updated_at: nowIso,
        })
        .eq('id', selected.id);

      if (error) throw error;
      toast.success(`Marked as ${actionLabel}`);
      reset();
      onUpdated?.();
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || 'Failed to update');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="p-4 border-2 border-dashed">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-base font-semibold">Quick Add Cancellation / Refund</h3>
          <p className="text-xs text-muted-foreground">
            Search by name, email, reg plate, or warranty number — then mark as cancelled, refunded, or partial refund.
          </p>
        </div>
        {selected && (
          <Button size="sm" variant="ghost" onClick={reset}>
            <X className="h-4 w-4 mr-1" /> Clear
          </Button>
        )}
      </div>

      {!selected && (
        <div className="space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              autoFocus
              placeholder="Type a name, email, reg plate or warranty number..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
            {searching && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
            )}
          </div>

          {results.length > 0 && (
            <div className="border rounded-md divide-y max-h-72 overflow-auto bg-background">
              {results.map(r => (
                <button
                  key={r.id}
                  onClick={() => setSelected(r)}
                  className="w-full text-left p-2 hover:bg-muted/50 transition-colors flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="font-medium text-sm truncate">{r.name || '(no name)'}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {[r.registration_plate, r.email, r.warranty_number].filter(Boolean).join(' · ')}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant="outline" className="text-[10px]">{r.status || 'unknown'}</Badge>
                    <span className="text-xs text-muted-foreground">£{(r.final_amount || 0).toFixed(2)}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
          {debounced.length >= 2 && !searching && results.length === 0 && (
            <p className="text-xs text-muted-foreground">No matches.</p>
          )}
        </div>
      )}

      {selected && (
        <div className="space-y-3">
          <div className="bg-muted/40 rounded-md p-3 flex items-center justify-between flex-wrap gap-2">
            <div className="min-w-0">
              <div className="font-semibold text-sm">{selected.name || '(no name)'}</div>
              <div className="text-xs text-muted-foreground">
                {[selected.registration_plate, selected.email, [selected.vehicle_make, selected.vehicle_model].filter(Boolean).join(' ')]
                  .filter(Boolean).join(' · ')}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline">Current: {selected.status || 'unknown'}</Badge>
              <Badge>£{(selected.final_amount || 0).toFixed(2)}</Badge>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-sm">Action</Label>
              <Select value={action} onValueChange={(v) => setAction(v as Action)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                  <SelectItem value="refunded">Refunded (full)</SelectItem>
                  <SelectItem value="partial_refund">Partial Refund</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {requireAmount && (
              <div className="space-y-1">
                <Label className="text-sm">Refund amount (£)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={refundAmount}
                  onChange={(e) => setRefundAmount(e.target.value)}
                />
              </div>
            )}

            <div className={`space-y-1 ${requireAmount ? '' : 'md:col-span-2'}`}>
              <Label className="text-sm">Reason / note (optional)</Label>
              <Input
                placeholder="e.g. customer sold vehicle"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center gap-2 justify-end">
            <Button variant="outline" onClick={reset} disabled={saving}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Check className="h-4 w-4 mr-2" />}
              Mark as {actionLabel}
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
};

export default QuickCancellationAdd;
