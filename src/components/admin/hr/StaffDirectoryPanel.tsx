import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Loader2, Users } from 'lucide-react';
import { format } from 'date-fns';

interface StaffRow {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  role: string;
  department: string | null;
  is_active: boolean;
  created_at: string;
  last_login: string | null;
  sip_extension: string | null;
}

export const StaffDirectoryPanel: React.FC = () => {
  const [rows, setRows] = useState<StaffRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('admin_users')
        .select('id, email, first_name, last_name, role, department, is_active, created_at, last_login, sip_extension')
        .order('is_active', { ascending: false })
        .order('first_name', { ascending: true });
      setRows((data || []) as StaffRow[]);
      setLoading(false);
    })();
  }, []);

  const filtered = rows.filter((r) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (
      `${r.first_name || ''} ${r.last_name || ''}`.toLowerCase().includes(q) ||
      r.email.toLowerCase().includes(q) ||
      r.role.toLowerCase().includes(q) ||
      (r.department || '').toLowerCase().includes(q)
    );
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" /> Staff directory
            </CardTitle>
            <CardDescription>Everyone with a staff account, their role, department and start date.</CardDescription>
          </div>
          <Input
            className="max-w-xs"
            placeholder="Search name, email, role"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="border rounded-lg overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Extension</TableHead>
                  <TableHead>Start date</TableHead>
                  <TableHead>Last login</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <div className="font-medium">
                        {`${r.first_name || ''} ${r.last_name || ''}`.trim() || r.email}
                      </div>
                      <div className="text-xs text-muted-foreground">{r.email}</div>
                    </TableCell>
                    <TableCell><Badge variant="outline">{r.role}</Badge></TableCell>
                    <TableCell className="text-sm">{r.department || '—'}</TableCell>
                    <TableCell className="text-sm">{r.sip_extension || '—'}</TableCell>
                    <TableCell className="text-sm whitespace-nowrap">
                      {format(new Date(r.created_at), 'dd MMM yyyy')}
                    </TableCell>
                    <TableCell className="text-sm whitespace-nowrap">
                      {r.last_login ? format(new Date(r.last_login), 'dd MMM yyyy HH:mm') : 'Never'}
                    </TableCell>
                    <TableCell>
                      {r.is_active ? (
                        <Badge className="bg-green-600 hover:bg-green-600">Active</Badge>
                      ) : (
                        <Badge variant="secondary">Inactive</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default StaffDirectoryPanel;
