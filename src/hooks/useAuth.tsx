
import { useState, useEffect } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isMasterAdmin, setIsMasterAdmin] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    
    console.log("=== useAuth: Initializing ===");
    
    // Check for master admin status
    const masterAdminStatus = localStorage.getItem('masterAdmin') === 'true';
    setIsMasterAdmin(masterAdminStatus);

    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (mounted) {
          console.log('=== Auth state changed ===', { 
            event, 
            email: session?.user?.email,
            userId: session?.user?.id,
            hasSession: !!session 
          });
          
          setSession(session);
          setUser(session?.user ?? null);
          
          // Fetch user role when session changes
          if (session?.user) {
            // Use setTimeout to defer the Supabase call and prevent deadlock
            setTimeout(async () => {
              try {
                const { data: roleData } = await supabase
                  .from('user_roles')
                  .select('role')
                  .eq('user_id', session.user.id)
                  .maybeSingle();
                
                if (mounted) {
                  setUserRole(roleData?.role || null);
                  console.log('User role:', roleData?.role);
                }
              } catch (error) {
                console.error('Error fetching user role:', error);
              }
            }, 0);
            
            setIsMasterAdmin(false);
            localStorage.removeItem('masterAdmin');
          } else {
            setUserRole(null);
          }
          
          setLoading(false);
        }
      }
    );

    // Get initial session AFTER setting up listener
    const getInitialSession = async () => {
      try {
        console.log('=== Fetching initial session ===');
        const { data: { session }, error } = await supabase.auth.getSession();
        if (mounted) {
          if (error) {
            console.error('Error getting initial session:', error);
          } else {
            console.log('Initial session:', { 
              hasSession: !!session, 
              email: session?.user?.email,
              userId: session?.user?.id 
            });
          }
          setSession(session);
          setUser(session?.user ?? null);
          setLoading(false);
        }
      } catch (error) {
        console.error('Error getting initial session:', error);
        if (mounted) {
          setLoading(false);
        }
      }
    };

    getInitialSession();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    console.log('=== Signing out ===');
    await supabase.auth.signOut();
    // Also clear master admin status
    setIsMasterAdmin(false);
    localStorage.removeItem('masterAdmin');
  };

  return {
    user,
    session,
    loading,
    signOut,
    isMasterAdmin,
    userRole
  };
};
