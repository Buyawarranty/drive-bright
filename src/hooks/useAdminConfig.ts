import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export function useAdminConfig(configKey: string) {
  const [value, setValue] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchConfig = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('admin_config')
        .select('config_value')
        .eq('config_key', configKey)
        .maybeSingle();

      if (error) {
        console.error('Error fetching admin config:', error);
        setValue(null);
      } else {
        setValue(data?.config_value ?? null);
      }
    } catch (err) {
      console.error('Error fetching admin config:', err);
    } finally {
      setLoading(false);
    }
  }, [configKey]);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const updateConfig = useCallback(async (newValue: boolean) => {
    try {
      // Upsert the config value
      const { error } = await supabase
        .from('admin_config')
        .upsert(
          { config_key: configKey, config_value: newValue },
          { onConflict: 'config_key' }
        );

      if (error) throw error;
      setValue(newValue);
      return true;
    } catch (err) {
      console.error('Error updating admin config:', err);
      return false;
    }
  }, [configKey]);

  return { value, loading, updateConfig, refresh: fetchConfig };
}
