import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Download } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

export function ExportFilesPermission({ adminUserId, role, canManage }: { adminUserId: string; role: string; canManage: boolean }) {
  const [granted, setGranted] = useState(false);
  const [loading, setLoading] = useState(true);
  const queryClient = useQueryClient();
  const automatic = role === 'admin' || role === 'super_admin';
  useEffect(() => {
    let active = true;
    setLoading(true);
    void supabase.from('staff_export_grants').select('admin_user_id').eq('admin_user_id', adminUserId).maybeSingle().then(({ data, error }) => {
      if (active) { setGranted(!error && Boolean(data)); setLoading(Boolean(error)); }
    });
    return () => { active = false; };
  }, [adminUserId]);
  const change = async (enabled: boolean) => {
    if (!canManage || automatic) return;
    setLoading(true);
    const { error } = enabled
      ? await supabase.from('staff_export_grants').insert({ admin_user_id: adminUserId })
      : await supabase.from('staff_export_grants').delete().eq('admin_user_id', adminUserId);
    if (error) toast.error('Export access could not be changed. Only admins and super admins can change it.');
    else { setGranted(enabled); toast.success(enabled ? 'Export files access enabled' : 'Export files access removed'); void queryClient.invalidateQueries({ queryKey: ['customer-data-export-access'] }); }
    setLoading(false);
  };
  return <div className="border-y py-4 space-y-2"><div className="flex items-center gap-2"><Download className="h-4 w-4 text-primary" /><h3 className="font-semibold">Export files</h3></div><div className="flex items-center gap-3"><Checkbox id={`export-files-${adminUserId}`} checked={automatic || granted} disabled={loading || !canManage || automatic} onCheckedChange={checked => void change(checked === true)} /><Label htmlFor={`export-files-${adminUserId}`}>Allow customer-data exports across CRM sections</Label></div><p className="text-xs text-muted-foreground">{automatic ? 'Included for admin and super admin.' : 'Off by default. Only an admin or super admin can enable this access.'}</p></div>;
}