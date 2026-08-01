import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Loader2, Shield, Save } from 'lucide-react';
import { toast } from 'sonner';

type BlockedPromo = '3months_free' | '6months_free';
const PROMO_OPTIONS: { key: BlockedPromo; label: string }[] = [
  { key: '3months_free', label: '+3 months free' },
  { key: '6months_free', label: '+6 months free' },
];

interface Agent {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  role: string;
  is_active: boolean;
  max_discount_pct: number | null;
  blocked_promos: string[] | null;
}

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

/**
 * Managers only: set a maximum discount % each sales agent can apply
 * on the Get Quote (page 1) screen, and block specific promo features
 * (e.g. +3 or +6 months free extended cover).
 */
export function DiscountCapManagerDialog({ open, onOpenChange }: Props) {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [bulkValue, setBulkValue] = useState('');

  useEffect(() => {
    if (!open) return;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('admin_users')
        .select('id, first_name, last_name, email, role, is_active, max_discount_pct, blocked_promos')
        .in('role', ['sales', 'sales_lead', 'claims_agent', 'lead_gen'])
        .order('is_active', { ascending: false })
        .order('first_name');
      if (error) toast.error('Could not load agents');
      const rows = (data || []) as Agent[];
      setAgents(rows);
      const d: Record<string, string> = {};
      rows.forEach(r => { d[r.id] = r.max_discount_pct == null ? '' : String(r.max_discount_pct); });
      setDrafts(d);
      setLoading(false);
    })();
  }, [open]);

  const parseCap = (raw: string): number | null | 'invalid' => {
    const t = raw.trim();
    if (t === '') return null;
    const n = Number(t);
    if (!Number.isFinite(n) || n < 0 || n > 100) return 'invalid';
    return Math.round(n * 100) / 100;
  };

  const capLabel = (value: number | null) =>
    value === null ? 'default (20%)' : value === 0 ? 'no discounts' : `${value}% cap`;

  const handleSave = async (a: Agent) => {
    const parsed = parseCap(drafts[a.id] ?? '');
    if (parsed === 'invalid') {
      toast.error('Cap must be a number between 0 and 100');
      return;
    }
    const value = parsed;
    setSaving(a.id);
    const { data, error } = await supabase
      .from('admin_users')
      .update({ max_discount_pct: value })
      .eq('id', a.id)
      .select('id');
    setSaving(null);
    if (error) { toast.error(error.message); return; }
    if (!data || data.length === 0) {
      toast.error('Not saved — you need manager permissions to change discount caps');
      return;
    }
    setAgents(prev => prev.map(x => x.id === a.id ? { ...x, max_discount_pct: value } : x));
    toast.success(`${a.first_name || a.email}: ${capLabel(value)}`);
  };

  const applyToAll = async () => {
    const parsed = parseCap(bulkValue);
    if (parsed === 'invalid') {
      toast.error('Enter a number between 0 and 100 (or leave blank for the 20% default)');
      return;
    }
    const value = parsed;
    if (!confirm(`Set every agent below to ${capLabel(value)}?`)) return;
    setSaving('__all__');
    const ids = agents.map(a => a.id);
    const { data, error } = await supabase
      .from('admin_users')
      .update({ max_discount_pct: value })
      .in('id', ids)
      .select('id');
    setSaving(null);
    if (error) { toast.error(error.message); return; }
    if (!data || data.length === 0) {
      toast.error('Not saved — you need manager permissions to change discount caps');
      return;
    }
    setAgents(prev => prev.map(a => ({ ...a, max_discount_pct: value })));
    const d: Record<string, string> = {};
    ids.forEach(id => { d[id] = value === null ? '' : String(value); });
    setDrafts(d);
    toast.success(`All ${data.length} agents set to ${capLabel(value)}`);
  };

  const setDefaultAll = async () => {
    if (!confirm('Reset every agent to the default 20% cap? (Blocked promos are kept)')) return;
    setSaving('__all__');
    const ids = agents.map(a => a.id);
    const { data, error } = await supabase
      .from('admin_users')
      .update({ max_discount_pct: null })
      .in('id', ids)
      .select('id');
    setSaving(null);
    if (error) { toast.error(error.message); return; }
    if (!data || data.length === 0) {
      toast.error('Not saved — you need manager permissions to change discount caps');
      return;
    }
    setAgents(prev => prev.map(a => ({ ...a, max_discount_pct: null })));
    const d: Record<string, string> = {};
    agents.forEach(a => { d[a.id] = ''; });
    setDrafts(d);
    setBulkValue('');
    toast.success('All agents reset to default cap');
  };


  const togglePromo = async (a: Agent, key: BlockedPromo) => {
    const current = (a.blocked_promos || []).filter(v => v === '3months_free' || v === '6months_free');
    const next = current.includes(key) ? current.filter(v => v !== key) : [...current, key];
    setSaving(a.id + ':' + key);
    const { data, error } = await supabase
      .from('admin_users')
      .update({ blocked_promos: next })
      .eq('id', a.id)
      .select('id');
    setSaving(null);
    if (error) { toast.error(error.message); return; }
    if (!data || data.length === 0) {
      toast.error('Not saved — you need manager permissions to change promo blocks');
      return;
    }
    setAgents(prev => prev.map(x => x.id === a.id ? { ...x, blocked_promos: next } : x));

    const label = PROMO_OPTIONS.find(p => p.key === key)?.label || key;
    toast.success(`${a.first_name || a.email}: ${label} ${next.includes(key) ? 'blocked' : 'allowed'}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            Discount caps & promo blocks per agent
          </DialogTitle>
          <DialogDescription>
            Set the maximum discount % each agent can apply on the Get Quote page (page 1) and block specific promotional features (e.g. free months).
            Leave % blank for the default cap of 20%. Enter <strong>0</strong> to block them from applying any discount.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-end gap-2 rounded-lg border bg-muted/40 p-3">
          <div>
            <label className="block text-xs font-medium mb-1">Set one cap for every agent</label>
            <div className="flex items-center gap-1">
              <Input
                type="number"
                min={0}
                max={100}
                step="1"
                placeholder="e.g. 20"
                value={bulkValue}
                onChange={e => setBulkValue(e.target.value)}
                className="h-9 w-28"
              />
              <span className="text-xs text-muted-foreground">%</span>
            </div>
          </div>
          <Button onClick={applyToAll} disabled={saving === '__all__' || loading} className="h-9">
            {saving === '__all__' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Apply to all agents'}
          </Button>
          <p className="text-xs text-muted-foreground flex-1 min-w-[200px]">
            Applies the same maximum discount to all agents listed below in one go. Blank = default 20%, 0 = no discounts.
          </p>
        </div>


        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="max-h-[60vh] overflow-y-auto -mx-2 px-2">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-background">
                <tr className="border-b">
                  <th className="text-left py-2 font-semibold">Agent</th>
                  <th className="text-left py-2 font-semibold">Role</th>
                  <th className="text-left py-2 font-semibold w-32">Max discount %</th>
                  <th className="text-left py-2 font-semibold">Blocked promos</th>
                  <th className="w-16"></th>
                </tr>
              </thead>
              <tbody>
                {agents.map(a => {
                  const draft = drafts[a.id] ?? '';
                  const original = a.max_discount_pct == null ? '' : String(a.max_discount_pct);
                  const dirty = draft !== original;
                  const blocked = new Set((a.blocked_promos || []) as string[]);
                  return (
                    <tr key={a.id} className={`border-b ${!a.is_active ? 'opacity-50' : ''}`}>
                      <td className="py-2 align-top">
                        <div className="font-medium">
                          {a.first_name || ''} {a.last_name || ''}
                          {!a.is_active && <Badge variant="outline" className="ml-2 text-[10px]">Inactive</Badge>}
                        </div>
                        <div className="text-xs text-muted-foreground">{a.email}</div>
                      </td>
                      <td className="py-2 align-top"><Badge variant="secondary" className="text-[10px]">{a.role}</Badge></td>
                      <td className="py-2 align-top">
                        <div className="flex items-center gap-1">
                          <Input
                            type="number"
                            min={0}
                            max={100}
                            step="1"
                            placeholder="20 (default)"
                            value={draft}
                            onChange={e => setDrafts(prev => ({ ...prev, [a.id]: e.target.value }))}
                            className="h-8 w-24"
                          />
                          <span className="text-xs text-muted-foreground">%</span>
                        </div>
                      </td>
                      <td className="py-2 align-top">
                        <div className="flex flex-wrap gap-1.5">
                          {PROMO_OPTIONS.map(p => {
                            const isBlocked = blocked.has(p.key);
                            const busy = saving === a.id + ':' + p.key;
                            return (
                              <Button
                                key={p.key}
                                size="sm"
                                type="button"
                                variant={isBlocked ? 'destructive' : 'outline'}
                                onClick={() => togglePromo(a, p.key)}
                                disabled={busy}
                                className="h-7 px-2 text-[11px]"
                              >
                                {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : isBlocked ? `Blocked: ${p.label}` : `Allow ${p.label}`}
                              </Button>
                            );
                          })}
                        </div>
                      </td>
                      <td className="py-2 align-top text-right">
                        <Button
                          size="sm"
                          variant={dirty ? 'default' : 'outline'}
                          disabled={!dirty || saving === a.id}
                          onClick={() => handleSave(a)}
                          className="h-8 px-2"
                        >
                          {saving === a.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
                {agents.length === 0 && (
                  <tr><td colSpan={5} className="py-6 text-center text-muted-foreground">No sales agents found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={setDefaultAll} disabled={saving === '__all__' || loading}>
            {saving === '__all__' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Reset all to default'}
          </Button>
          <Button onClick={() => onOpenChange(false)}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
