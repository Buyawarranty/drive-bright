import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface MonthlyData {
  month: string;
  totalClaims: number;
  approvedClaims: number;
  totalPaid: number;
}

interface ClaimsChartProps {
  monthlyData: MonthlyData[];
}

export const ClaimsChart: React.FC<ClaimsChartProps> = ({ monthlyData }) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Claims Submitted vs Approved</CardTitle>
          <CardDescription>Monthly trend comparison</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="month" 
                tick={{ fontSize: 12 }}
              />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="totalClaims" 
                stroke="#f97316" 
                strokeWidth={2}
                name="Total Claims"
              />
              <Line 
                type="monotone" 
                dataKey="approvedClaims" 
                stroke="#22c55e" 
                strokeWidth={2}
                name="Approved Claims"
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Amount Paid Out</CardTitle>
          <CardDescription>Monthly payout in £</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="month" 
                tick={{ fontSize: 12 }}
              />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip 
                formatter={(value: number) => `£${value.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              />
              <Legend />
              <Bar 
                dataKey="totalPaid" 
                fill="#f97316" 
                name="Total Paid (£)"
              />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
};
