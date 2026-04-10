
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
                  .eq('user_id', session.user.id);
                
                if (mounted) {
                  // Get the highest priority role
                  const adminRoles = ['super_admin', 'admin', 'member', 'viewer', 'guest', 'sales', 'sales_lead', 'blog_writer', 'lead_gen', 'dev_tester', 'accounts_manager', 'accounts_payroll', 'accounts'];
                  const rolePriority = ['super_admin', 'admin', 'member', 'sales_lead', 'lead_gen', 'accounts', 'accounts_manager', 'accounts_payroll', 'viewer', 'guest', 'sales', 'blog_writer', 'dev_tester'];
                  const userRoles = roleData?.map(r => r.role) || [];
                  const primaryRole = rolePriority.find(role => userRoles.includes(role as any)) || userRoles[0] || null;
                  setUserRole(primaryRole);
                  console.log('User roles:', userRoles, 'Primary:', primaryRole);
                  
                  // Update last_login for admin users on sign in
                  if (event === 'SIGNED_IN' && userRoles.some(r => adminRoles.includes(r as string))) {
                    supabase
                      .from('admin_users')
                      .update({ last_login: new Date().toISOString() })
                      .eq('user_id', session.user.id)
                      .then(() => console.log('Updated admin last_login'));
                  }
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
