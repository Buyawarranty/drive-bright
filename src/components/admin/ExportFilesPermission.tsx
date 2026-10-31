import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Download, Tag } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

type GrantFlags = {
  can_export_new_leads: boolean;
  can_export_customers: boolean;
  can_see_lead_source: boolean;
};

const EMPTY: GrantFlags = {
  can_export_new_leads: false,
  can_export_customers: false,
  can_see_lead_source: false,
};

const OPTIONS: { key: keyof GrantFlags; label: string; hint: string }[] = [
  { key: 'can_export_new_leads', label: 'New leads export', hint: 'Download lead data from New Leads and Recontacted Leads' },
  { key: 'can_export_customers', label: 'Customer management export', hint: 'Download customer data from Customer Management' },
];

export function ExportFilesPermission({ adminUserId, role, canManage }: { adminUserId: string; role: string; canManage: boolean }) {
  const [flags, setFlags] = useState<GrantFlags>(EMPTY);
  const [loading, setLoading] = useState(true);
  const queryClient = useQueryClient();
  const automatic = role === 'admin' || role === 'super_admin';

  useEffect(() => {
    let active = true;
    setLoading(true);
    void supabase
      .from('staff_export_grants')
      .select('can_export_new_leads, can_export_customers, can_see_lead_source')
      .eq('admin_user_id', adminUserId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!active) return;
        setFlags(!error && data ? {
          can_export_new_leads: data.can_export_new_leads === true,
          can_export_customers: data.can_export_customers === true,
          can_see_lead_source: data.can_see_lead_source === true,
        } : EMPTY);
        setLoading(Boolean(error));
      });
    return () => { active = false; };
  }, [adminUserId]);

  const change = async (key: keyof GrantFlags, enabled: boolean) => {
    if (!canManage || automatic) return;
    setLoading(true);
    const next = { ...flags, [key]: enabled };
    const { error } = await supabase
      .from('staff_export_grants')
      .upsert({ admin_user_id: adminUserId, ...next }, { onConflict: 'admin_user_id' });
    if (error) {
      toast.error('Access could not be changed. Only admins and super admins can change it.');
    } else {
      setFlags(next);
      toast.success(enabled ? 'Access enabled' : 'Access removed');
      void queryClient.invalidateQueries({ queryKey: ['customer-data-export-access'] });
      void queryClient.invalidateQueries({ queryKey: ['export-permissions'] });
    }
    setLoading(false);
  };

  return (
    <div className="border-y py-4 space-y-3">
      <div className="flex items-center gap-2">
        <Download className="h-4 w-4 text-primary" />
        <h3 className="font-semibold">Export files</h3>
      </div>
      <div className="flex items-center justify-between gap-4 border-t pt-4">
        <div className="space-y-1">
          <Label htmlFor={`can_see_lead_source-${adminUserId}`} className="flex items-center gap-2 font-semibold">
            <Tag className="h-4 w-4 text-primary" />
            Lead source
          </Label>
          <p className="text-xs text-muted-foreground">Where an enquiry came from, such as Google, Facebook or Organic.</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="text-sm text-muted-foreground">{automatic || flags.can_see_lead_source ? 'On' : 'Off'}</span>
          <Switch
            id={`can_see_lead_source-${adminUserId}`}
            checked={automatic || flags.can_see_lead_source}
            disabled={loading || !canManage || automatic}
            onCheckedChange={checked => void change('can_see_lead_source', checked)}
          />
        </div>
      </div>
      <div className="space-y-3">
        {OPTIONS.map(opt => (
          <div key={opt.key} className="flex items-start gap-3">
            <Checkbox
              id={`${opt.key}-${adminUserId}`}
              checked={automatic || flags[opt.key]}
              disabled={loading || !canManage || automatic}
              onCheckedChange={checked => void change(opt.key, checked === true)}
            />
            <div className="grid gap-0.5 leading-none">
              <Label htmlFor={`${opt.key}-${adminUserId}`}>{opt.label}</Label>
              <p className="text-xs text-muted-foreground">{opt.hint}</p>
            </div>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        {automatic
          ? 'Included for admin and super admin.'
          : 'All off by default. Only an admin or super admin can switch these on.'}
      </p>
    </div>
  );
}
