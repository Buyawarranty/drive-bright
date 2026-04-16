import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

interface Quote {
  id: string;
  customer_name: string;
  vehicle_reg: string;
  vehicle_make: string | null;
  vehicle_model: string | null;
  price: number | null;
  status: string;
  created_at: string;
}

interface DealerRecentQuotesProps {
  quotes: Quote[];
}

export const DealerRecentQuotes: React.FC<DealerRecentQuotesProps> = ({ quotes }) => {
  return (
    <Card className="border-2">
      <CardHeader>
        <CardTitle className="text-lg font-bold text-gray-800">Recent Quotes</CardTitle>
      </CardHeader>
      <CardContent>
        {quotes.length === 0 ? (
          <p className="text-gray-500 text-sm text-center py-8">No quotes yet. Create your first quote to get started.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Vehicle</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {quotes.slice(0, 5).map((quote) => (
                <TableRow key={quote.id}>
                  <TableCell className="font-medium">{quote.customer_name}</TableCell>
                  <TableCell>
                    {quote.vehicle_reg}
                    {quote.vehicle_make && ` - ${quote.vehicle_make}`}
                    {quote.vehicle_model && ` ${quote.vehicle_model}`}
                  </TableCell>
                  <TableCell>{quote.price ? `£${Number(quote.price).toFixed(2)}` : '—'}</TableCell>
                  <TableCell>
                    <Badge variant={quote.status === 'converted' ? 'default' : 'secondary'}
                      className={quote.status === 'converted' ? 'bg-green-500' : 'bg-amber-100 text-amber-800'}
                    >
                      {quote.status === 'converted' ? 'Converted' : 'Pending'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-gray-500">
                    {new Date(quote.created_at).toLocaleDateString('en-GB')}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};
