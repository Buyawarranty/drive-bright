import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { UserPlus, Shield, Eye, Users, Trash2, RotateCcw, Mail, Settings, Download, ShieldCheck, Key, Copy, Check, TestTube } from 'lucide-react';
import { AccessRequestsPanel } from './AccessRequestsPanel';
import { TeamActivityPanel } from './TeamActivityPanel';
import { useAuth } from '@/hooks/useAuth';

interface AdminUser {
  id: string;
  user_id: string | null;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  permissions: Record<string, boolean> | any;
  is_active: boolean;
  invited_at: string;
  last_login: string | null;
}

interface Permission {
  permission_key: string;
  permission_name: string;
  description: string;
  category: string;
}

// Define all admin tabs that can be granted as permissions
const ADMIN_TABS = [
  { id: 'new-leads', label: 'New Leads', description: 'Manage sales pipeline and lead assignments', hasGranular: true },
  { id: 'get-quote', label: 'Quotes & Orders', description: 'Generate quotes and process manual orders' },
  { id: 'selling-tips', label: 'Sales Script', description: 'Sales script, tips and customer feedback' },
  { id: 'customers', label: 'Customers', description: 'Manage customer accounts and policies', hasGranular: true },
  { id: 'plans', label: 'Standard Plans', description: 'Manage Basic, Gold, and Platinum plans' },
  { id: 'bulk-pricing', label: 'Bulk Pricing', description: 'Update pricing using CSV files' },
  { id: 'special-plans', label: 'Special Vehicle Plans', description: 'Manage EV, PHEV, and Motorbike plans' },
  { id: 'discount-codes', label: 'Discount Codes', description: 'Manage discount codes and promotions' },
  { id: 'referrals', label: 'Referrals', description: 'Track customer referrals and conversions' },
  { id: 'claims', label: 'Claims', description: 'Manage customer claim submissions' },
  { id: 'reviews', label: 'Reviews', description: 'Monitor Trustpilot and Google reviews' },
  { id: 'contact', label: 'Contact Submissions', description: 'Manage customer contact form submissions' },
  { id: 'abandoned-carts', label: 'Abandoned Carts', description: 'Track and follow up with incomplete purchases' },
  { id: 'pending-w2000', label: 'Pending Register', description: 'Scheduled warranty submissions to register' },
  { id: 'marketing-audience', label: 'Marketing Contacts', description: 'Unified mailing list for remarketing' },
  { id: 'emails', label: 'Email Hub', description: 'Unified email management' },
  { id: 'analytics', label: 'Analytics', description: 'View reports and analytics' },
  { id: 'page-analytics', label: 'Page Analytics', description: 'Track page visits, traffic sources & Google Ads' },
  { id: 'google-ads', label: 'Marketing Analytics', description: 'Google Ads, Facebook Ads, conversions & ROAS' },
  { id: 'vehicle-stats', label: 'Vehicle Stats', description: 'Analyse which vehicles sell the most warranties' },
  { id: 'lead-backup', label: 'Lead Backup & Recovery', description: 'Backup all contacts, export & sync to marketing' },
  { id: 'user-permissions', label: 'User Permissions', description: 'Manage admin user access and permissions' },
  { id: 'document-mapping', label: 'Document Mapping', description: 'Manage plan to document mappings' },
  { id: 'policy-documents', label: 'Policy Letters', description: 'Generate printable A4 policy letters for customers' },
  { id: 'blog-writing', label: 'Blog Writing', description: 'Create and manage blog content with AI tools' },
  { id: 'landing-pages', label: 'Landing Pages', description: 'Create SEO-optimised landing pages' },
  { id: 'testing', label: 'Testing', description: 'Test APIs and create test data' },
  { id: 'timesheets', label: 'Timesheets', description: 'Track work hours, deals and commissions' },
  { id: 'sales-scoreboard', label: 'Sales Scoreboard', description: 'Leaderboard, awards and sales competition' },
  { id: 'account', label: 'Account Settings', description: 'Manage your account and password' },
];

// Granular permissions for specific tabs
const GRANULAR_PERMISSIONS = {
  'customers': [
    { key: 'view', label: 'View', description: 'Can view customer data' },
    { key: 'own-only', label: 'Own Customers Only', description: 'Only see customers from their own orders (via Quotes & Orders)' },
    { key: 'export', label: 'Export', description: 'Can export customer data to CSV/Excel' },
    { key: 'delete', label: 'Delete', description: 'Can delete customer records' },
  ],
  'new-leads': [
    { key: 'view', label: 'View', description: 'Can view lead data' },
    { key: 'assign', label: 'Assign Leads', description: 'Can assign or reassign leads to agents' },
    { key: 'export', label: 'Export', description: 'Can export lead data to CSV/Excel' },
    { key: 'delete', label: 'Delete', description: 'Can delete lead records' },
    { key: 'all-leads', label: 'See All Leads', description: 'Can see all leads (OFF = only their own assigned leads)' },
    { key: 'my-dashboard', label: 'My Dashboard', description: 'Can view My Dashboard section' },
    { key: 'team-view', label: 'Team View', description: 'Can view Team View (manager view)' },
  ],
};

// Default tab permissions per role - auto-applied when role is selected
const ROLE_DEFAULT_PERMISSIONS: Record<string, Record<string, boolean>> = {
  super_admin: ADMIN_TABS.reduce((acc, tab) => { acc[`tab_${tab.id}`] = true; return acc; }, {} as Record<string, boolean>),
  admin: ADMIN_TABS.reduce((acc, tab) => { acc[`tab_${tab.id}`] = true; return acc; }, {} as Record<string, boolean>),
  dev_tester: ADMIN_TABS.reduce((acc, tab) => { acc[`tab_${tab.id}`] = true; return acc; }, {} as Record<string, boolean>),
  sales_lead: {
    'tab_new-leads': true,
    'tab_get-quote': true,
    'tab_customers': true,
    'tab_selling-tips': true,
    'tab_sales-scoreboard': true,
    'tab_timesheets': true,
    'tab_new-leads_view': true,
    'tab_new-leads_assign': true,
    'tab_new-leads_all-leads': true,
    'tab_new-leads_team-view': true,
    'tab_new-leads_my-dashboard': true,
    'tab_customers_view': true,
  },
  sales: {
    'tab_new-leads': true,
    'tab_get-quote': true,
    'tab_customers': true,
    'tab_selling-tips': true,
    'tab_abandoned-carts': true,
    'tab_discount-codes': true,
    'tab_sales-scoreboard': true,
    'tab_timesheets': true,
    'tab_new-leads_view': true,
    'tab_new-leads_my-dashboard': true,
    'tab_customers_view': true,
    'tab_customers_own-only': true,
  },
  blog_writer: {
    'tab_blog-writing': true,
    'tab_landing-pages': true,
  },
  lead_gen: {
    'tab_google-ads': true,
    'tab_new-leads': true,
    'tab_new-leads_view': true,
  },
  accounts: {
    'tab_new-leads': true,
    'tab_get-quote': true,
    'tab_customers': true,
    'tab_discount-codes': true,
    'tab_claims': true,
    'tab_policy-documents': true,
    'tab_timesheets': true,
    'tab_customers_view': true,
  },
  viewer: ADMIN_TABS.reduce((acc, tab) => { acc[`tab_${tab.id}`] = true; return acc; }, {} as Record<string, boolean>),
  member: {},
  guest: {},
};

export const UserPermissionsTab = () => {
  const { user } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [currentAdminUser, setCurrentAdminUser] = useState<AdminUser | null>(null);
  const [inviteData, setInviteData] = useState({
    email: '',
    firstName: '',
    lastName: '',
    username: '',
    password: '',
    role: 'member' as 'super_admin' | 'admin' | 'member' | 'viewer' | 'guest' | 'blog_writer' | 'sales' | 'sales_lead' | 'dev_tester' | 'lead_gen',
    permissions: {} as Record<string, boolean>
  });
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [passwordUser, setPasswordUser] = useState<AdminUser | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [settingPassword, setSettingPassword] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchUsers();
    fetchPermissions();
    fetchCurrentAdmin();
  }, [user?.id]);

  const fetchCurrentAdmin = async () => {
    if (!user?.id) return;
    try {
      const { data, error } = await supabase
        .from('admin_users')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (!error && data) {
        setCurrentAdminUser(data as AdminUser);
      }
    } catch (error) {
      console.error('Error fetching current admin:', error);
    }
  };

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('admin_users')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const fetchPermissions = async () => {
    try {
      const { data, error } = await supabase
        .from('admin_permissions')
        .select('*')
        .order('category', { ascending: true });

      if (error) throw error;
      setPermissions(data || []);
    } catch (error) {
      console.error('Error fetching permissions:', error);
    }
  };

  const handleInviteUser = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('invite-admin-user', {
        body: inviteData
      });

      if (error) throw error;

      toast.success(`User invited successfully! Password: ${data.tempPassword}`, {
        duration: 10000
      });
      
      setShowInviteDialog(false);
      setInviteData({
        email: '',
        firstName: '',
        lastName: '',
        username: '',
        password: '',
        role: 'member',
        permissions: {}
      });
      
      fetchUsers();
    } catch (error) {
      console.error('Error inviting user:', error);
      toast.error('Failed to invite user');
    }
  };

  const handleUpdatePermissions = async () => {
    if (!editingUser) return;

    try {
      const validRoles = ['admin', 'member', 'viewer', 'guest', 'blog_writer', 'sales', 'sales_lead', 'dev_tester', 'customer', 'lead_gen'] as const;
      const roleValue = validRoles.includes(editingUser.role as any) 
        ? editingUser.role as typeof validRoles[number]
        : 'guest';

      const { error } = await supabase
        .from('admin_users')
        .update({ 
          permissions: editingUser.permissions,
          role: roleValue
        })
        .eq('id', editingUser.id);

      if (error) throw error;
      
      // Also update user_roles table for role changes using the correct user_id
      if (editingUser.user_id) {
        const { error: roleError } = await supabase
          .from('user_roles')
          .update({ role: roleValue })
          .eq('user_id', editingUser.user_id);

        if (roleError) {
          console.warn('Could not update user_roles:', roleError);
        }
      }

      toast.success('Permissions updated successfully');
      setShowEditDialog(false);
      setEditingUser(null);
      fetchUsers();
    } catch (error) {
      console.error('Error updating permissions:', error);
      toast.error('Failed to update permissions');
    }
  };

  const handleDeleteUser = async (userId: string) => {
    // Find the user being deleted
    const targetUser = users.find(u => u.id === userId);
    
    // Administrators cannot delete super_admin or other admin users
    if (currentAdminUser?.role === 'admin') {
      if (targetUser?.role === 'super_admin') {
        toast.error('Administrators cannot remove Super Administrators');
        return;
      }
      if (targetUser?.role === 'admin') {
        toast.error('Administrators cannot remove other Administrators');
        return;
      }
    }
    
    if (!confirm('Are you sure you want to permanently remove this user and clean up all their references? This cannot be undone.')) return;

    try {
      const { error } = await supabase.rpc('delete_admin_user_cascade', {
        p_admin_user_id: userId
      });

      if (error) throw error;
      
      toast.success('User removed successfully');
      fetchUsers();
    } catch (error) {
      console.error('Error deleting user:', error);
      toast.error('Failed to remove user');
    }
  };

  const toggleUserStatus = async (userId: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from('admin_users')
        .update({ is_active: !isActive })
        .eq('id', userId);

      if (error) throw error;
      
      toast.success(`User ${!isActive ? 'activated' : 'deactivated'} successfully`);
      fetchUsers();
    } catch (error) {
      console.error('Error updating user status:', error);
      toast.error('Failed to update user status');
    }
  };

  const handleResetPassword = async (userId: string, email: string) => {
    if (!confirm(`Are you sure you want to reset password for ${email}? This will send them a new temporary password.`)) return;

    try {
      const { data, error } = await supabase.functions.invoke('reset-admin-password', {
        body: { 
          userId,
          email
        }
      });

      if (error) throw error;
      
      toast.success(`Password reset email sent to ${email}. New temporary password: ${data.tempPassword}`, {
        duration: 15000
      });
    } catch (error) {
      console.error('Error resetting password:', error);
      toast.error('Failed to reset password');
    }
  };

  const handleResendInvite = async (userId: string, email: string) => {
    if (!confirm(`Are you sure you want to resend the invitation to ${email}?`)) return;

    try {
      const { data, error } = await supabase.functions.invoke('resend-admin-invite', {
        body: { 
          userId,
          email
        }
      });

      if (error) throw error;
      
      toast.success(`Invitation resent to ${email}. New temporary password: ${data.tempPassword}`, {
        duration: 15000
      });
    } catch (error) {
      console.error('Error resending invite:', error);
      toast.error('Failed to resend invitation');
    }
  };

  const openEditDialog = (user: AdminUser) => {
    setEditingUser({ ...user, permissions: user.permissions || {} });
    setShowEditDialog(true);
  };

  const openPasswordDialog = (user: AdminUser) => {
    setPasswordUser(user);
    setNewPassword('');
    setShowPasswordDialog(true);
  };

  const handleSetPassword = async () => {
    if (!passwordUser || !newPassword) {
      toast.error('Please enter a password');
      return;
    }

    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    setSettingPassword(true);
    try {
      const { data, error } = await supabase.functions.invoke('set-admin-password', {
        body: { 
          userId: passwordUser.user_id,
          email: passwordUser.email,
          password: newPassword
        }
      });

      if (error) throw error;
      
      toast.success(`Password set successfully for ${passwordUser.email}`, {
        duration: 5000
      });
      setShowPasswordDialog(false);
      setPasswordUser(null);
      setNewPassword('');
    } catch (error: any) {
      console.error('Error setting password:', error);
      toast.error(error.message || 'Failed to set password');
    } finally {
      setSettingPassword(false);
    }
  };

  const copyToClipboard = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
      toast.success('Copied to clipboard');
    } catch (err) {
      toast.error('Failed to copy');
    }
  };

  const generateRandomPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
    let password = '';
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setNewPassword(password);
  };

  const toggleTabPermission = (tabId: string, isEditing: boolean) => {
    const permKey = `tab_${tabId}`;
    if (isEditing && editingUser) {
      setEditingUser(prev => prev ? {
        ...prev,
        permissions: {
          ...prev.permissions,
          [permKey]: !prev.permissions[permKey]
        }
      } : null);
    } else {
      setInviteData(prev => ({
        ...prev,
        permissions: {
          ...prev.permissions,
          [permKey]: !prev.permissions[permKey]
        }
      }));
    }
  };

  const selectAllTabs = (isEditing: boolean) => {
    const allTabPerms = ADMIN_TABS.reduce((acc, tab) => {
      acc[`tab_${tab.id}`] = true;
      return acc;
    }, {} as Record<string, boolean>);

    if (isEditing && editingUser) {
      setEditingUser(prev => prev ? {
        ...prev,
        permissions: { ...prev.permissions, ...allTabPerms }
      } : null);
    } else {
      setInviteData(prev => ({
        ...prev,
        permissions: { ...prev.permissions, ...allTabPerms }
      }));
    }
  };

  const clearAllTabs = (isEditing: boolean) => {
    const clearedTabPerms = ADMIN_TABS.reduce((acc, tab) => {
      acc[`tab_${tab.id}`] = false;
      return acc;
    }, {} as Record<string, boolean>);

    if (isEditing && editingUser) {
      setEditingUser(prev => prev ? {
        ...prev,
        permissions: { ...prev.permissions, ...clearedTabPerms }
      } : null);
    } else {
      setInviteData(prev => ({
        ...prev,
        permissions: { ...prev.permissions, ...clearedTabPerms }
      }));
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'super_admin': return <ShieldCheck className="h-4 w-4" />;
      case 'admin': return <Shield className="h-4 w-4" />;
      case 'member': return <Users className="h-4 w-4" />;
      case 'viewer': return <Eye className="h-4 w-4" />;
      case 'blog_writer': return <UserPlus className="h-4 w-4" />;
      case 'sales': return <Users className="h-4 w-4" />;
      case 'dev_tester': return <TestTube className="h-4 w-4" />;
      default: return <UserPlus className="h-4 w-4" />;
    }
  };

  const getRoleBadgeVariant = (role: string): "destructive" | "default" | "secondary" | "outline" => {
    switch (role) {
      case 'super_admin': return 'destructive';
      case 'admin': return 'destructive';
      case 'sales_lead': return 'destructive';
      case 'dev_tester': return 'default';
      case 'member': return 'default';
      case 'viewer': return 'secondary';
      case 'blog_writer': return 'default';
      case 'sales': return 'default';
      default: return 'outline';
    }
  };

  const getRoleBadgeClassName = (role: string) => {
    if (role === 'super_admin') return 'bg-amber-600 hover:bg-amber-700 text-white border-amber-600';
    if (role === 'sales_lead') return 'bg-violet-600 hover:bg-violet-700 text-white border-violet-600';
    if (role === 'sales') return 'bg-blue-600 hover:bg-blue-700 text-white border-blue-600';
    if (role === 'lead_gen') return 'bg-teal-600 hover:bg-teal-700 text-white border-teal-600';
    if (role === 'dev_tester') return 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600';
    return '';
  };

  const countActiveTabPermissions = (permissions: Record<string, boolean>) => {
    return ADMIN_TABS.filter(tab => permissions[`tab_${tab.id}`]).length;
  };

  const toggleGranularPermission = (tabId: string, permKey: string, isEditing: boolean) => {
    const fullKey = `tab_${tabId}_${permKey}`;
    
    if (isEditing && editingUser) {
      setEditingUser(prev => prev ? {
        ...prev,
        permissions: {
          ...prev.permissions,
          [fullKey]: !prev.permissions[fullKey]
        }
      } : null);
    } else {
      setInviteData(prev => ({
        ...prev,
        permissions: {
          ...prev.permissions,
          [fullKey]: !prev.permissions[fullKey]
        }
      }));
    }
  };

  const groupedPermissions = permissions.reduce((acc, permission) => {
    if (!acc[permission.category]) {
      acc[permission.category] = [];
    }
    acc[permission.category].push(permission);
    return acc;
  }, {} as Record<string, Permission[]>);

  const renderTabPermissionsSection = (perms: Record<string, boolean>, isEditing: boolean) => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-base font-semibold">Tab Access Permissions</Label>
        <div className="flex gap-2">
          <Button 
            type="button" 
            variant="outline" 
            size="sm"
            onClick={() => selectAllTabs(isEditing)}
          >
            Select All
          </Button>
          <Button 
            type="button" 
            variant="outline" 
            size="sm"
            onClick={() => clearAllTabs(isEditing)}
          >
            Clear All
          </Button>
        </div>
      </div>
      <p className="text-sm text-muted-foreground">
        Select which admin panel tabs this user can access
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[400px] overflow-y-auto border rounded-lg p-4">
        {ADMIN_TABS.map((tab) => {
          const permKey = `tab_${tab.id}`;
          const isChecked = perms[permKey] || false;
          const granularPerms = GRANULAR_PERMISSIONS[tab.id as keyof typeof GRANULAR_PERMISSIONS];
          
          return (
            <div 
              key={tab.id} 
              className={`flex flex-col p-3 rounded-lg border transition-colors ${
                isChecked ? 'bg-primary/5 border-primary/20' : 'bg-background hover:bg-muted/50'
              }`}
            >
              <div className="flex items-start space-x-3">
                <Checkbox
                  id={`${isEditing ? 'edit' : 'invite'}-${permKey}`}
                  checked={isChecked}
                  onCheckedChange={() => toggleTabPermission(tab.id, isEditing)}
                  className="mt-0.5"
                />
                <div className="flex-1 min-w-0">
                  <Label 
                    htmlFor={`${isEditing ? 'edit' : 'invite'}-${permKey}`} 
                    className="text-sm font-medium cursor-pointer"
                  >
                    {tab.label}
                  </Label>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    {tab.description}
                  </p>
                </div>
              </div>
              
              {/* Granular permissions for specific tabs */}
              {isChecked && granularPerms && (
                <div className="ml-7 mt-3 pt-3 border-t border-border/50 space-y-2">
                  <p className="text-xs font-medium text-muted-foreground mb-2">Permissions:</p>
                  <div className="flex flex-wrap gap-3">
                    {granularPerms.map((gPerm) => {
                      const gPermKey = `tab_${tab.id}_${gPerm.key}`;
                      const gIsChecked = perms[gPermKey] || false;
                      
                      return (
                        <div key={gPerm.key} className="flex items-center space-x-2">
                          <Checkbox
                            id={`${isEditing ? 'edit' : 'invite'}-${gPermKey}`}
                            checked={gIsChecked}
                            onCheckedChange={() => toggleGranularPermission(tab.id, gPerm.key, isEditing)}
                            className="h-3.5 w-3.5"
                          />
                          <Label 
                            htmlFor={`${isEditing ? 'edit' : 'invite'}-${gPermKey}`}
                            className="text-xs cursor-pointer"
                            title={gPerm.description}
                          >
                            {gPerm.label}
                          </Label>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  if (loading) {
    return <div className="flex items-center justify-center p-8">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Logged-in Admin Banner */}
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="py-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-primary/10">
              <ShieldCheck className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Logged in as</p>
              <p className="font-semibold text-foreground">
                {currentAdminUser 
                  ? `${currentAdminUser.first_name || ''} ${currentAdminUser.last_name || ''}`.trim() || currentAdminUser.email
                  : user?.email || 'Unknown'}
              </p>
              <p className="text-xs text-muted-foreground">
                {currentAdminUser?.email || user?.email} • <Badge variant="destructive" className="text-xs py-0 px-1.5">{currentAdminUser?.role === 'super_admin' ? 'Super Administrator' : currentAdminUser?.role === 'admin' ? 'Administrator' : currentAdminUser?.role || 'admin'}</Badge>
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Team Activity Panel */}
      <TeamActivityPanel />
      
      {/* Access Requests Panel */}
      <AccessRequestsPanel />

      {/* Super Admin Only: User Credentials Overview */}
      {currentAdminUser?.role === 'super_admin' && (
        <Card className="border-amber-200 bg-amber-50/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-800">
              <Key className="h-5 w-5" />
              User Credentials
              <Badge variant="outline" className="ml-2 bg-amber-100 text-amber-700 border-amber-300 text-xs">Super Admin Only</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Login Email / Username</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Password Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={`cred-${u.id}`}>
                    <TableCell className="font-medium">
                      {u.first_name} {u.last_name}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <code className="text-xs bg-muted px-2 py-1 rounded font-mono">{u.email}</code>
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          className="h-6 w-6 p-0"
                          onClick={() => copyToClipboard(u.email, `cred-email-${u.id}`)}
                          title="Copy email"
                        >
                          {copiedField === `cred-email-${u.id}` ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getRoleBadgeVariant(u.role)} className={`text-xs ${getRoleBadgeClassName(u.role)}`}>
                        {u.role === 'super_admin' ? 'Super Admin' : u.role === 'admin' ? 'Admin' : u.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={u.is_active ? 'default' : 'secondary'} className="text-xs">
                        {u.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() => openPasswordDialog(u)}
                          title="Set Password Manually"
                          className="bg-orange-500 hover:bg-orange-600 text-xs"
                        >
                          <Key className="h-3 w-3 mr-1" />
                          Set Password
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => handleResetPassword(u.user_id || u.id, u.email)}
                          title="Reset Password (Sends Email)"
                          className="text-xs"
                        >
                          <RotateCcw className="h-3 w-3 mr-1" />
                          Reset
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
      
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-foreground">User Permissions</h2>
          <p className="text-muted-foreground">Manage admin dashboard access and permissions</p>
        </div>
        
        {/* Invite User Dialog */}
        <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
          <DialogTrigger asChild>
            <Button>
              <UserPlus className="h-4 w-4 mr-2" />
              Invite User
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Invite New User</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pr-2">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="firstName">First Name</Label>
                  <Input
                    id="firstName"
                    value={inviteData.firstName}
                    onChange={(e) => setInviteData(prev => ({ ...prev, firstName: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input
                    id="lastName"
                    value={inviteData.lastName}
                    onChange={(e) => setInviteData(prev => ({ ...prev, lastName: e.target.value }))}
                  />
                </div>
              </div>
              
              <div>
                <Label htmlFor="email">Email (Login Username)</Label>
                <Input
                  id="email"
                  type="email"
                  value={inviteData.email}
                  onChange={(e) => setInviteData(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="user@example.com"
                />
                <p className="text-xs text-muted-foreground mt-1">This email will be used as the login username</p>
              </div>
              
              <div>
                <Label htmlFor="password">Initial Password</Label>
                <Input
                  id="password"
                  type="text"
                  value={inviteData.password}
                  onChange={(e) => setInviteData(prev => ({ ...prev, password: e.target.value }))}
                  placeholder="Leave empty to auto-generate"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Set a custom password or leave empty to auto-generate a secure one
                </p>
              </div>

              <div>
                <Label htmlFor="role">Role</Label>
                <Select 
                  value={inviteData.role} 
                  onValueChange={(value: any) => {
                    const defaults = ROLE_DEFAULT_PERMISSIONS[value] || {};
                    // Clear all tab permissions first, then apply role defaults
                    const clearedPerms = Object.keys(inviteData.permissions).reduce((acc, key) => {
                      if (key.startsWith('tab_')) return acc;
                      acc[key] = inviteData.permissions[key];
                      return acc;
                    }, {} as Record<string, boolean>);
                    setInviteData(prev => ({ ...prev, role: value, permissions: { ...clearedPerms, ...defaults } }));
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="super_admin">Super Administrator - Full unrestricted access</SelectItem>
                    <SelectItem value="admin">Administrator - Full access (can be restricted by Super Admin)</SelectItem>
                    <SelectItem value="member">Member - Custom tab access</SelectItem>
                    <SelectItem value="viewer">Viewer - Read-only access</SelectItem>
                    <SelectItem value="guest">Guest - Minimal access</SelectItem>
                    <SelectItem value="blog_writer">Blog Writer - Blog & Landing Pages only</SelectItem>
                    <SelectItem value="sales">Sales - Sales team tabs only</SelectItem>
                    <SelectItem value="sales_lead">Sales Lead - Team management & lead assignment</SelectItem>
                    <SelectItem value="lead_gen">Lead Gen - Marketing analytics only (Google/Facebook Ads)</SelectItem>
                    <SelectItem value="dev_tester">Dev/Tester - Full access, no destructive actions</SelectItem>
                    <SelectItem value="accounts">Accounts - Leads, customers, claims, discount codes & timesheets</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  {(inviteData.role === 'admin' || inviteData.role === 'super_admin') && 'Full access to all tabs (Super Admin can restrict Administrator access)'}
                  {!['admin', 'super_admin'].includes(inviteData.role) && 'Select which tabs this user can access below'}
                </p>
              </div>

              {/* Show tab permissions for all non-admin roles */}
              {!['super_admin', 'admin', 'dev_tester'].includes(inviteData.role) && (
                renderTabPermissionsSection(inviteData.permissions, false)
              )}

              {/* Legacy permissions section */}
              {!['super_admin', 'admin', 'dev_tester'].includes(inviteData.role) && Object.keys(groupedPermissions).length > 0 && (
                <div className="space-y-4">
                  <Label className="text-base font-semibold">Additional Permissions</Label>
                  {Object.entries(groupedPermissions).map(([category, categoryPermissions]) => (
                    <Card key={category} className="p-4">
                      <h4 className="font-medium capitalize mb-3">{category}</h4>
                      <div className="space-y-2">
                        {categoryPermissions.map((permission) => (
                          <div key={permission.permission_key} className="flex items-center space-x-2">
                            <Checkbox
                              id={permission.permission_key}
                              checked={inviteData.permissions[permission.permission_key] || false}
                              onCheckedChange={(checked) => {
                                setInviteData(prev => ({
                                  ...prev,
                                  permissions: {
                                    ...prev.permissions,
                                    [permission.permission_key]: checked as boolean
                                  }
                                }));
                              }}
                            />
                            <div>
                              <Label htmlFor={permission.permission_key} className="text-sm font-medium">
                                {permission.permission_name}
                              </Label>
                              <p className="text-xs text-muted-foreground">{permission.description}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </Card>
                  ))}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setShowInviteDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={handleInviteUser}>
                  Send Invitation
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Set Password Dialog */}
      <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              Set Password
            </DialogTitle>
          </DialogHeader>
          {passwordUser && (
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">User:</span>
                  <span className="font-medium">{passwordUser.first_name} {passwordUser.last_name}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Email (Username):</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm">{passwordUser.email}</span>
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      className="h-6 w-6 p-0"
                      onClick={() => copyToClipboard(passwordUser.email, 'email')}
                    >
                      {copiedField === 'email' ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                    </Button>
                  </div>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="newPassword">New Password</Label>
                <div className="flex gap-2">
                  <Input
                    id="newPassword"
                    type="text"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password"
                    className="font-mono"
                  />
                  <Button 
                    type="button" 
                    variant="outline"
                    onClick={generateRandomPassword}
                  >
                    Generate
                  </Button>
                </div>
                {newPassword && (
                  <div className="flex items-center gap-2 mt-2">
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      className="h-6 px-2 text-xs"
                      onClick={() => copyToClipboard(newPassword, 'password')}
                    >
                      {copiedField === 'password' ? <Check className="h-3 w-3 text-green-500 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
                      Copy Password
                    </Button>
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  Minimum 6 characters. Share this password securely with the user.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button variant="outline" onClick={() => setShowPasswordDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSetPassword} disabled={settingPassword || !newPassword}>
                  {settingPassword ? 'Setting...' : 'Set Password'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Permissions Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit User Permissions</DialogTitle>
          </DialogHeader>
          {editingUser && (
            <div className="space-y-4 pr-2">
              <div className="p-4 bg-muted rounded-lg">
                <div className="font-medium">{editingUser.first_name} {editingUser.last_name}</div>
                <div className="text-sm text-muted-foreground">{editingUser.email}</div>
              </div>

              <div>
                <Label htmlFor="editRole">Role</Label>
                <Select 
                  value={editingUser.role} 
                  onValueChange={(value: any) => {
                    const defaults = ROLE_DEFAULT_PERMISSIONS[value] || {};
                    setEditingUser(prev => {
                      if (!prev) return null;
                      // Clear all tab permissions first, then apply role defaults
                      const clearedPerms = Object.keys(prev.permissions).reduce((acc, key) => {
                        if (key.startsWith('tab_')) return acc;
                        acc[key] = prev.permissions[key];
                        return acc;
                      }, {} as Record<string, boolean>);
                      return { ...prev, role: value, permissions: { ...clearedPerms, ...defaults } };
                    });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin - Full access to all tabs</SelectItem>
                    <SelectItem value="member">Member - Custom tab access</SelectItem>
                    <SelectItem value="viewer">Viewer - Read-only access</SelectItem>
                    <SelectItem value="guest">Guest - Minimal access</SelectItem>
                    <SelectItem value="blog_writer">Blog Writer - Blog & Landing Pages only</SelectItem>
                    <SelectItem value="sales">Sales - Sales team tabs only</SelectItem>
                    <SelectItem value="sales_lead">Sales Lead - Team management & lead assignment</SelectItem>
                    <SelectItem value="lead_gen">Lead Gen - Marketing analytics only (Google/Facebook Ads)</SelectItem>
                    <SelectItem value="dev_tester">Dev/Tester - Full access, no destructive actions</SelectItem>
                    <SelectItem value="accounts">Accounts - Leads, customers, claims, discount codes & timesheets</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Show tab permissions for all non-admin roles */}
              {editingUser.role !== 'admin' && editingUser.role !== 'dev_tester' && (
                renderTabPermissionsSection(editingUser.permissions, true)
              )}

              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setShowEditDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={handleUpdatePermissions}>
                  Save Changes
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader>
          <CardTitle>Admin Users</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={selectedUsers.size === users.length && users.length > 0}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSelectedUsers(new Set(users.map(u => u.id)));
                      } else {
                        setSelectedUsers(new Set());
                      }
                    }}
                    aria-label="Select all users"
                  />
                </TableHead>
                <TableHead>User</TableHead>
                <TableHead>Login Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Tab Access</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Login</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id} data-state={selectedUsers.has(user.id) ? 'selected' : undefined}>
                  <TableCell>
                    <Checkbox
                      checked={selectedUsers.has(user.id)}
                      onCheckedChange={(checked) => {
                        setSelectedUsers(prev => {
                          const next = new Set(prev);
                          if (checked) { next.add(user.id); } else { next.delete(user.id); }
                          return next;
                        });
                      }}
                      aria-label={`Select ${user.first_name} ${user.last_name}`}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">
                      {user.first_name} {user.last_name}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <code className="text-xs bg-muted px-2 py-1 rounded font-mono">
                        {user.email}
                      </code>
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        className="h-6 w-6 p-0"
                        onClick={() => copyToClipboard(user.email, `email-${user.id}`)}
                        title="Copy email"
                      >
                        {copiedField === `email-${user.id}` ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={getRoleBadgeVariant(user.role)} className={`flex items-center gap-1 w-fit ${getRoleBadgeClassName(user.role)}`}>
                      {getRoleIcon(user.role)}
                      {user.role === 'super_admin' ? 'Super Administrator' : user.role === 'dev_tester' ? 'Dev/Tester' : user.role === 'admin' ? 'Administrator' : user.role}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {(user.role === 'super_admin' || user.role === 'admin' || user.role === 'dev_tester') ? (
                      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                        {user.role === 'admin' ? 'Filtered' : 'All Tabs'}
                      </Badge>
                    ) : user.role === 'blog_writer' ? (
                      <Badge variant="outline">2 tabs</Badge>
                    ) : (
                      <Badge variant="outline">
                        {countActiveTabPermissions(user.permissions || {})} tabs
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={user.is_active ? 'default' : 'secondary'}>
                      {user.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell>{user.last_login ? new Date(user.last_login).toLocaleDateString() : 'Never'}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openEditDialog(user)}
                        title="Edit Permissions"
                      >
                        <Settings className="h-4 w-4" />
                      </Button>
                      {currentAdminUser?.role !== 'dev_tester' && !(currentAdminUser?.role === 'admin' && (user.role === 'super_admin' || user.role === 'admin')) && (
                      <Button
                        size="sm"
                        variant={user.is_active ? "outline" : "default"}
                        onClick={() => toggleUserStatus(user.id, user.is_active)}
                      >
                        {user.is_active ? 'Deactivate' : 'Activate'}
                      </Button>
                      )}
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleResendInvite(user.id, user.email)}
                        title="Resend Invite"
                      >
                        <Mail className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleResetPassword(user.user_id || user.id, user.email)}
                        title="Reset Password (Sends Email)"
                      >
                        <RotateCcw className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => openPasswordDialog(user)}
                        title="Set Password Manually"
                        className="bg-orange-500 hover:bg-orange-600"
                      >
                        <Key className="h-4 w-4" />
                      </Button>
                      {currentAdminUser?.role !== 'dev_tester' && !(currentAdminUser?.role === 'admin' && (user.role === 'super_admin' || user.role === 'admin')) && (
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDeleteUser(user.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};
