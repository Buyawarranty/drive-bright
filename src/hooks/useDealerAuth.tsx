import { useState, useEffect } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';

interface DealerProfile {
  id: string;
  user_id: string;
  name: string;
  email: string;
  phone: string | null;
  company_name: string;
}

export const useDealerAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [dealer, setDealer] = useState<DealerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          setTimeout(async () => {
            const { data } = await supabase
              .from('dealers')
              .select('*')
              .eq('user_id', session.user.id)
              .maybeSingle();
            if (mounted) {
              setDealer(data as DealerProfile | null);
              setLoading(false);
            }
          }, 0);
        } else {
          setDealer(null);
          setLoading(false);
        }
      }
    );

    const getInitialSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!mounted) return;
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        const { data } = await supabase
          .from('dealers')
          .select('*')
          .eq('user_id', session.user.id)
          .maybeSingle();
        if (mounted) {
          setDealer(data as DealerProfile | null);
        }
      }
      setLoading(false);
    };

    getInitialSession();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate('/dealer-portal/login');
  };

  return { user, session, dealer, loading, signOut };
};
