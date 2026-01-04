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
import { UserPlus, Shield, Eye, Users, Trash2, RotateCcw, Mail, Settings } from 'lucide-react';
import { AccessRequestsPanel } from './AccessRequestsPanel';
import { TeamActivityPanel } from './TeamActivityPanel';

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
  { id: 'get-quote', label: 'Send a Quote', description: 'Generate and send quotes to customers' },
  { id: 'customers', label: 'Customers', description: 'Manage customer accounts and policies' },
  { id: 'plans', label: 'Standard Plans', description: 'Manage Basic, Gold, and Platinum plans' },
  { id: 'bulk-pricing', label: 'Bulk Pricing', description: 'Update pricing using CSV files' },
  { id: 'special-plans', label: 'Special Vehicle Plans', description: 'Manage EV, PHEV, and Motorbike plans' },
  { id: 'discount-codes', label: 'Discount Codes', description: 'Manage discount codes and promotions' },
  { id: 'referrals', label: 'Referrals', description: 'Track customer referrals and conversions' },
  { id: 'claims', label: 'Claims', description: 'Manage customer claim submissions' },
  { id: 'contact', label: 'Contact Submissions', description: 'Manage customer contact form submissions' },
  { id: 'abandoned-carts', label: 'Abandoned Carts', description: 'Track and follow up with incomplete purchases' },
  { id: 'pending-w2000', label: 'Pending W2000', description: 'Scheduled warranty submissions to W2000' },
  { id: 'emails', label: 'Email Hub', description: 'Unified email management' },
  { id: 'analytics', label: 'Analytics', description: 'View reports and analytics' },
  { id: 'user-permissions', label: 'User Permissions', description: 'Manage admin user access and permissions' },
  { id: 'document-mapping', label: 'Document Mapping', description: 'Manage plan to document mappings' },
  { id: 'blog-writing', label: 'Blog Writing', description: 'Create and manage blog content with AI tools' },
  { id: 'landing-pages', label: 'Landing Pages', description: 'Create SEO-optimised landing pages' },
  { id: 'testing', label: 'Testing', description: 'Test APIs and create test data' },
  { id: 'account', label: 'Account Settings', description: 'Manage your account and password' },
];

export const UserPermissionsTab = () => {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [inviteData, setInviteData] = useState({
    email: '',
    firstName: '',
    lastName: '',
    username: '',
    password: '',
    role: 'member' as 'admin' | 'member' | 'viewer' | 'guest' | 'blog_writer' | 'sales',
    permissions: {} as Record<string, boolean>
  });

  useEffect(() => {
    fetchUsers();
    fetchPermissions();
  }, []);

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
      const validRoles = ['admin', 'member', 'viewer', 'guest', 'blog_writer', 'sales', 'customer'] as const;
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
    if (!confirm('Are you sure you want to remove this user?')) return;

    try {
      const { error } = await supabase
        .from('admin_users')
        .delete()
        .eq('id', userId);

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
      case 'admin': return <Shield className="h-4 w-4" />;
      case 'member': return <Users className="h-4 w-4" />;
      case 'viewer': return <Eye className="h-4 w-4" />;
      case 'blog_writer': return <UserPlus className="h-4 w-4" />;
      case 'sales': return <Users className="h-4 w-4" />;
      default: return <UserPlus className="h-4 w-4" />;
    }
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'admin': return 'destructive';
      case 'member': return 'default';
      case 'viewer': return 'secondary';
      case 'blog_writer': return 'default';
      case 'sales': return 'default';
      default: return 'outline';
    }
  };

  const countActiveTabPermissions = (permissions: Record<string, boolean>) => {
    return ADMIN_TABS.filter(tab => permissions[`tab_${tab.id}`]).length;
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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[300px] overflow-y-auto border rounded-lg p-4">
        {ADMIN_TABS.map((tab) => {
          const permKey = `tab_${tab.id}`;
          const isChecked = perms[permKey] || false;
          
          return (
            <div 
              key={tab.id} 
              className={`flex items-start space-x-3 p-3 rounded-lg border transition-colors ${
                isChecked ? 'bg-primary/5 border-primary/20' : 'bg-background hover:bg-muted/50'
              }`}
            >
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
      {/* Team Activity Panel */}
      <TeamActivityPanel />
      
      {/* Access Requests Panel */}
      <AccessRequestsPanel />
      
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
                <Select value={inviteData.role} onValueChange={(value: any) => setInviteData(prev => ({ ...prev, role: value }))}>
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
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  {inviteData.role === 'admin' && 'Admins have access to all tabs automatically'}
                  {inviteData.role !== 'admin' && 'Select which tabs this user can access below'}
                </p>
              </div>

              {/* Show tab permissions for all non-admin roles */}
              {inviteData.role !== 'admin' && (
                renderTabPermissionsSection(inviteData.permissions, false)
              )}

              {/* Legacy permissions section */}
              {inviteData.role !== 'admin' && Object.keys(groupedPermissions).length > 0 && (
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
                  onValueChange={(value: any) => setEditingUser(prev => prev ? { ...prev, role: value } : null)}
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
                  </SelectContent>
                </Select>
              </div>

              {/* Show tab permissions for all non-admin roles */}
              {editingUser.role !== 'admin' && (
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
                <TableHead>User</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Tab Access</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Login</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{user.first_name} {user.last_name}</div>
                      <div className="text-sm text-muted-foreground">{user.email}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={getRoleBadgeVariant(user.role)} className="flex items-center gap-1 w-fit">
                      {getRoleIcon(user.role)}
                      {user.role}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {user.role === 'admin' ? (
                      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                        All Tabs
                      </Badge>
                    ) : user.role === 'blog_writer' ? (
                      <Badge variant="outline">2 tabs</Badge>
                    ) : user.role === 'sales' ? (
                      <Badge variant="outline">5 tabs</Badge>
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
                      <Button
                        size="sm"
                        variant={user.is_active ? "outline" : "default"}
                        onClick={() => toggleUserStatus(user.id, user.is_active)}
                      >
                        {user.is_active ? 'Deactivate' : 'Activate'}
                      </Button>
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
                        onClick={() => handleResetPassword(user.id, user.email)}
                        title="Reset Password"
                      >
                        <RotateCcw className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDeleteUser(user.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
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
