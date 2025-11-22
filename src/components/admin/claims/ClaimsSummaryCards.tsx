import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, TrendingDown, DollarSign, FileText, CheckCircle, Clock } from 'lucide-react';

interface SummaryData {
  totalClaims: number;
  approvedClaims: number;
  pendingClaims: number;
  totalPaid: number;
  avgClaimValue: number;
  monthlyChange: number;
}

interface ClaimsSummaryCardsProps {
  summaryData: SummaryData;
}

export const ClaimsSummaryCards: React.FC<ClaimsSummaryCardsProps> = ({ summaryData }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Claims</CardTitle>
          <FileText className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{summaryData.totalClaims}</div>
          {summaryData.monthlyChange !== 0 && (
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
              {summaryData.monthlyChange > 0 ? (
                <>
                  <TrendingUp className="h-3 w-3 text-green-500" />
                  <span className="text-green-500">+{summaryData.monthlyChange}%</span>
                </>
              ) : (
                <>
                  <TrendingDown className="h-3 w-3 text-red-500" />
                  <span className="text-red-500">{summaryData.monthlyChange}%</span>
                </>
              )}
              <span>from last month</span>
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Approved Claims</CardTitle>
          <CheckCircle className="h-4 w-4 text-green-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-600">{summaryData.approvedClaims}</div>
          <p className="text-xs text-muted-foreground mt-1">
            {summaryData.totalClaims > 0 
              ? `${Math.round((summaryData.approvedClaims / summaryData.totalClaims) * 100)}% approval rate`
              : '0% approval rate'
            }
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Paid Out</CardTitle>
          <DollarSign className="h-4 w-4 text-orange-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">£{summaryData.totalPaid.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          <p className="text-xs text-muted-foreground mt-1">
            This month
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Avg Claim Value</CardTitle>
          <Clock className="h-4 w-4 text-blue-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">£{summaryData.avgClaimValue.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          <p className="text-xs text-muted-foreground mt-1">
            {summaryData.pendingClaims} pending review
          </p>
        </CardContent>
      </Card>
    </div>
  );
};
