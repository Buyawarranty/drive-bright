import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { DealerLayout } from '@/components/dealer/DealerLayout';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useDealerAuth } from '@/hooks/useDealerAuth';
import { FilePlus, Search } from 'lucide-react';

const DealerQuotesList = () => {
  const { dealer } = useDealerAuth();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');

  const { data: quotes = [] } = useQuery({
    queryKey: ['dealer-quotes-list', dealer?.id],
    queryFn: async () => {
      if (!dealer?.id) return [];
      const { data } = await supabase
        .from('dealer_quotes')
        .select('*')
        .eq('dealer_id', dealer.id)
        .order('created_at', { ascending: false });
      return data || [];
    },
    enabled: !!dealer?.id,
  });

  const filtered = quotes.filter((q: any) =>
    q.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
    q.vehicle_reg?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <DealerLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h1 className="text-2xl font-bold text-white">Quotes</h1>
          <Button onClick={() => navigate('/dealer-portal/quotes/create')} className="bg-orange-500 hover:bg-orange-600 text-white">
            <FilePlus className="h-4 w-4 mr-2" /> Create Quote
          </Button>
        </div>

        <Card className="bg-gray-900 border-gray-800">
          <CardHeader>
            <div className="flex items-center gap-3">
              <Search className="h-4 w-4 text-gray-500" />
              <Input
                placeholder="Search by customer name or registration..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="max-w-sm bg-gray-800 border-gray-700 text-white placeholder:text-gray-500"
              />
            </div>
          </CardHeader>
          <CardContent>
            {filtered.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-8">
                {search ? 'No quotes match your search.' : 'No quotes yet. Create your first quote!'}
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-gray-800 hover:bg-transparent">
                    <TableHead className="text-gray-400">Customer</TableHead>
                    <TableHead className="text-gray-400">Vehicle</TableHead>
                    <TableHead className="text-gray-400">Plan</TableHead>
                    <TableHead className="text-gray-400">Price</TableHead>
                    <TableHead className="text-gray-400">Status</TableHead>
                    <TableHead className="text-gray-400">Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((q: any) => (
                    <TableRow key={q.id} className="cursor-pointer border-gray-800 hover:bg-gray-800/50">
                      <TableCell className="font-medium text-white">{q.customer_name}</TableCell>
                      <TableCell className="text-gray-300">
                        {q.vehicle_reg}
                        {q.vehicle_make && ` - ${q.vehicle_make}`}
                        {q.vehicle_model && ` ${q.vehicle_model}`}
                      </TableCell>
                      <TableCell className="capitalize text-gray-300">{q.plan_type}</TableCell>
                      <TableCell className="text-gray-300">{q.price ? `£${Number(q.price).toFixed(2)}` : '—'}</TableCell>
                      <TableCell>
                        <Badge
                          className={q.status === 'converted' ? 'bg-green-500 text-white' : 'bg-amber-500/20 text-amber-400'}
                        >
                          {q.status === 'converted' ? 'Converted' : 'Pending'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-gray-500">
                        {new Date(q.created_at).toLocaleDateString('en-GB')}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </DealerLayout>
  );
};

export default DealerQuotesList;
