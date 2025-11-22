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
import { UserPlus, Shield, Eye, Users, Trash2, RotateCcw, Mail } from 'lucide-react';

interface AdminUser {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  permissions: any;
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

export const UserPermissionsTab = () => {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [inviteData, setInviteData] = useState({
    email: '',
    firstName: '',
    lastName: '',
    role: 'guest' as 'admin' | 'member' | 'viewer' | 'guest' | 'blog_writer',
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

      toast.success(`User invited successfully! Temporary password: ${data.tempPassword}`, {
        duration: 10000
      });
      
      setShowInviteDialog(false);
      setInviteData({
        email: '',
        firstName: '',
        lastName: '',
        role: 'guest',
        permissions: {}
      });
      
      fetchUsers();
    } catch (error) {
      console.error('Error inviting user:', error);
      toast.error('Failed to invite user');
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

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin': return <Shield className="h-4 w-4" />;
      case 'member': return <Users className="h-4 w-4" />;
      case 'viewer': return <Eye className="h-4 w-4" />;
      case 'blog_writer': return <UserPlus className="h-4 w-4" />;
      default: return <UserPlus className="h-4 w-4" />;
    }
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'admin': return 'destructive';
      case 'member': return 'default';
      case 'viewer': return 'secondary';
      case 'blog_writer': return 'default';
      default: return 'outline';
    }
  };

  const groupedPermissions = permissions.reduce((acc, permission) => {
    if (!acc[permission.category]) {
      acc[permission.category] = [];
    }
    acc[permission.category].push(permission);
    return acc;
  }, {} as Record<string, Permission[]>);

  if (loading) {
    return <div className="flex items-center justify-center p-8">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-foreground">User Permissions</h2>
          <p className="text-muted-foreground">Manage admin dashboard access and permissions</p>
        </div>
        
        <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
          <DialogTrigger asChild>
            <Button>
              <UserPlus className="h-4 w-4 mr-2" />
              Invite User
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
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
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={inviteData.email}
                  onChange={(e) => setInviteData(prev => ({ ...prev, email: e.target.value }))}
                />
              </div>

              <div>
                <Label htmlFor="role">Role</Label>
                <Select value={inviteData.role} onValueChange={(value: any) => setInviteData(prev => ({ ...prev, role: value }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                     <SelectItem value="admin">Admin - Full access</SelectItem>
                    <SelectItem value="member">Member - Limited access</SelectItem>
                    <SelectItem value="viewer">Viewer - Read-only access</SelectItem>
                    <SelectItem value="guest">Guest - Minimal access</SelectItem>
                    <SelectItem value="blog_writer">Blog Writer - Blog Writing access only</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {inviteData.role !== 'admin' && inviteData.role !== 'blog_writer' && (
                <div className="space-y-4">
                  <Label>Permissions</Label>
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

              <div className="flex justify-end gap-2">
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
                <TableHead>Status</TableHead>
                <TableHead>Invited</TableHead>
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
                    <Badge variant={user.is_active ? 'default' : 'secondary'}>
                      {user.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell>{new Date(user.invited_at).toLocaleDateString()}</TableCell>
                  <TableCell>{user.last_login ? new Date(user.last_login).toLocaleDateString() : 'Never'}</TableCell>
                   <TableCell>
                    <div className="flex gap-2">
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