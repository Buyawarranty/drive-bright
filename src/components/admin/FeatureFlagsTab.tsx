import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Settings, ShieldAlert } from 'lucide-react';
import { invalidateFeatureFlagsCache, type FeatureFlag } from '@/hooks/useFeatureFlags';

interface FeatureFlagsTabProps {
  userRole: string | null;
}

const FeatureFlagsTab: React.FC<FeatureFlagsTabProps> = ({ userRole }) => {
  const { toast } = useToast();
  const isAuthorised = userRole === 'admin' || userRole === 'super_admin';
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('feature_flags')
      .select('*')
      .order('category', { ascending: true })
      .order('label', { ascending: true });
    if (error) {
      toast({ title: 'Failed to load feature flags', description: error.message, variant: 'destructive' });
    } else {
      setFlags((data as FeatureFlag[]) || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (isAuthorised) load();
  }, [isAuthorised]);

  const handleToggle = async (flag: FeatureFlag, next: boolean) => {
    setSavingKey(flag.key);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase
      .from('feature_flags')
      .update({ enabled: next, updated_by: user?.id ?? null })
      .eq('key', flag.key);
    setSavingKey(null);
    if (error) {
      toast({ title: 'Could not update flag', description: error.message, variant: 'destructive' });
      return;
    }
    setFlags((prev) => prev.map((f) => (f.key === flag.key ? { ...f, enabled: next } : f)));
    invalidateFeatureFlagsCache();
    toast({
      title: next ? `${flag.label} enabled` : `${flag.label} disabled`,
      description: next
        ? 'Customers and agents will see this feature.'
        : 'This feature is now hidden from customers and agents.',
    });
  };

  if (!isAuthorised) {
    return (
      <Card className="m-6">
        <CardHeader>
          <div className="flex items-center gap-3">
            <ShieldAlert className="w-6 h-6 text-destructive" />
            <CardTitle>Access denied</CardTitle>
          </div>
          <CardDescription>
            Feature Flags can only be managed by admin and super admin users.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const grouped: Record<string, FeatureFlag[]> = flags.reduce((acc, f) => {
    (acc[f.category] ||= []).push(f);
    return acc;
  }, {} as Record<string, FeatureFlag[]>);

  const categoryLabels: Record<string, string> = {
    addon: 'Add-on protections',
    page: 'Pages & sections',
    integration: 'Integrations',
    admin: 'Admin tools',
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-4xl">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-primary/10 text-primary">
          <Settings className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Feature flags</h1>
          <p className="text-sm text-muted-foreground">
            Switch features on or off across the public website and admin tools. Changes apply
            immediately to new page loads.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : flags.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            No feature flags configured yet.
          </CardContent>
        </Card>
      ) : (
        Object.entries(grouped).map(([category, items]) => (
          <Card key={category}>
            <CardHeader>
              <CardTitle className="text-lg">{categoryLabels[category] || category}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {items.map((flag) => (
                <div
                  key={flag.key}
                  className="flex items-start justify-between gap-4 p-4 rounded-lg border bg-card hover:bg-accent/30 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <Label htmlFor={`flag-${flag.key}`} className="text-base font-semibold cursor-pointer">
                      {flag.label}
                    </Label>
                    {flag.description && (
                      <p className="text-sm text-muted-foreground mt-1">{flag.description}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-2">
                      Status:{' '}
                      <span className={flag.enabled ? 'text-green-600 font-medium' : 'text-gray-500 font-medium'}>
                        {flag.enabled ? 'Live' : 'Hidden'}
                      </span>
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {savingKey === flag.key && (
                      <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                    )}
                    <Switch
                      id={`flag-${flag.key}`}
                      checked={flag.enabled}
                      disabled={savingKey === flag.key}
                      onCheckedChange={(checked) => handleToggle(flag, checked)}
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
};

export default FeatureFlagsTab;
