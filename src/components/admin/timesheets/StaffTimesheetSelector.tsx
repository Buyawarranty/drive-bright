import React, { useState, useEffect } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface StaffMember {
  id: string;
  user_id: string | null;
  email: string;
  first_name: string | null;
  last_name: string | null;
  role: string;
}

interface StaffTimesheetSelectorProps {
  currentUserId: string;
  selectedUserId: string;
  onUserChange: (userId: string) => void;
}

export function StaffTimesheetSelector({ currentUserId, selectedUserId, onUserChange }: StaffTimesheetSelectorProps) {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStaff() {
      setLoading(true);
      const { data, error } = await supabase
        .from('admin_users')
        .select('id, user_id, email, first_name, last_name, role')
        .eq('is_active', true)
        .order('first_name', { ascending: true });

      if (!error && data) {
        setStaff(data);
      }
      setLoading(false);
    }
    fetchStaff();
  }, []);

  const getDisplayName = (member: StaffMember) => {
    if (member.first_name || member.last_name) {
      return `${member.first_name || ''} ${member.last_name || ''}`.trim();
    }
    return member.email;
  };

  const getRoleBadge = (role: string) => {
    const labels: Record<string, string> = {
      super_admin: 'Super Admin',
      admin: 'Admin',
      sales: 'Sales',
      sales_lead: 'Sales Lead',
      accounts_manager: 'Accounts Manager',
      accounts_payroll: 'Payroll',
      accounts: 'Accounts',
      member: 'Member',
      viewer: 'Viewer',
    };
    return labels[role] || role;
  };

  if (loading) return null;

  return (
    <div className="flex items-center gap-2">
      <Users className="h-4 w-4 text-muted-foreground" />
      <Select value={selectedUserId} onValueChange={onUserChange}>
        <SelectTrigger className="w-[220px] h-9 text-sm">
          <SelectValue placeholder="Select staff member" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={currentUserId}>
            <span className="font-medium">My Timesheet</span>
          </SelectItem>
          {staff
            .filter(s => s.user_id && s.user_id !== currentUserId)
            .map(member => (
              <SelectItem key={member.user_id!} value={member.user_id!}>
                <span>{getDisplayName(member)}</span>
                <span className="ml-2 text-xs text-muted-foreground">({getRoleBadge(member.role)})</span>
              </SelectItem>
            ))}
        </SelectContent>
      </Select>
    </div>
  );
}
