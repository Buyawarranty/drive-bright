import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, MailX, CheckCircle, Ban, Download, UserX } from 'lucide-react';
import { useEmailUnsubscribes } from '@/hooks/useEmailUnsubscribes';
import { EmailBlockButton } from './EmailBlockButton';
import { format } from 'date-fns';

export const EmailBlocklistView: React.FC = () => {
  const { unsubscribes, isLoading, unblockEmail } = useEmailUnsubscribes();
  const [searchTerm, setSearchTerm] = useState('');

  const filtered = unsubscribes.filter(u =>
    u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (u.customer_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (u.vehicle_reg || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleExportCSV = () => {
    const headers = ['Email', 'Customer Name', 'Vehicle Reg', 'Reason', 'Source', 'Blocked By', 'Date'];
    const rows = filtered.map(u => [
      u.email,
      u.customer_name || '',
      u.vehicle_reg || '',
      u.reason || '',
      u.source || '',
      u.unsubscribed_by_name || '',
      format(new Date(u.created_at), 'dd/MM/yyyy HH:mm'),
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `email-blocklist-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Ban className="h-6 w-6 text-destructive" />
            Email Blocklist
          </h2>
          <p className="text-muted-foreground">
            Customers who have been opted out of all marketing emails ({unsubscribes.length} blocked)
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleExportCSV}>
          <Download className="h-4 w-4 mr-1.5" />
          Export CSV
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
        <Input
          placeholder="Search by email, name, or registration..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <p className="text-center py-8 text-muted-foreground">Loading blocklist...</p>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <UserX className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>{searchTerm ? 'No blocked emails match your search' : 'No blocked emails yet'}</p>
            </div>
          ) : (
            <div className="max-h-[600px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Vehicle Reg</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Blocked By</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.email}</TableCell>
                      <TableCell>{item.customer_name || '—'}</TableCell>
                      <TableCell>
                        {item.vehicle_reg ? (
                          <Badge variant="outline" className="bg-yellow-100 text-yellow-900 border-yellow-300 font-mono">
                            {item.vehicle_reg}
                          </Badge>
                        ) : '—'}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">
                        {item.reason || '—'}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-xs capitalize">{item.source || 'manual'}</Badge>
                      </TableCell>
                      <TableCell className="text-sm">{item.unsubscribed_by_name || '—'}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(item.created_at), 'dd/MM/yyyy HH:mm')}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-green-600 border-green-200 hover:bg-green-50"
                          onClick={() => unblockEmail.mutate(item.email)}
                        >
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Unblock
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
