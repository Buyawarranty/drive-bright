import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useSalesStats } from '@/hooks/useSalesStats';
import { 
  TrendingUp, Users, DollarSign, Target, 
  Award, BarChart3, PieChart, ArrowUp, ArrowDown
} from 'lucide-react';

export const ManagerDashboard: React.FC = () => {
  const { teamStats, allBadges, loading } = useSalesStats();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  if (!teamStats) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No data available
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Leads</CardDescription>
            <CardTitle className="text-3xl">{teamStats.totalLeads}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-sm">
              <Badge variant="secondary" className="bg-yellow-100">
                {teamStats.unassignedLeads} awaiting contact
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Revenue</CardDescription>
            <CardTitle className="text-3xl">
              £{teamStats.totalRevenue.toLocaleString()}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-sm text-green-600">
              <TrendingUp className="h-4 w-4" />
              <span>{teamStats.totalConverted} paid deals</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Conversion Rate</CardDescription>
            <CardTitle className="text-3xl">
              {teamStats.overallConversionRate.toFixed(1)}%
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Progress value={teamStats.overallConversionRate} className="h-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Lost Deals</CardDescription>
            <CardTitle className="text-3xl">{teamStats.totalLost}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground">
              {teamStats.totalLeads > 0 
                ? `${((teamStats.totalLost / teamStats.totalLeads) * 100).toFixed(1)}% loss rate`
                : 'No data'
              }
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Leaderboard and Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Leaderboard */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="h-5 w-5 text-orange-500" />
              Sales Leaderboard
            </CardTitle>
            <CardDescription>Top performers by revenue</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">#</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                  <TableHead className="text-right">Deals</TableHead>
                  <TableHead className="text-right">Rate</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {teamStats.leaderboard.slice(0, 10).map((person, index) => (
                  <TableRow key={person.userId}>
                    <TableCell>
                      {index === 0 && '🥇'}
                      {index === 1 && '🥈'}
                      {index === 2 && '🥉'}
                      {index > 2 && index + 1}
                    </TableCell>
                    <TableCell className="font-medium">{person.userName}</TableCell>
                    <TableCell className="text-right font-medium">
                      £{person.totalRevenue.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">{person.convertedLeads}</TableCell>
                    <TableCell className="text-right">
                      <Badge 
                        variant="secondary"
                        className={person.conversionRate >= 50 ? 'bg-green-100' : 'bg-gray-100'}
                      >
                        {person.conversionRate.toFixed(0)}%
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Lead Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChart className="h-5 w-5" />
              Lead Distribution
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* By Status */}
            <div>
              <h4 className="text-sm font-medium mb-3">By Status</h4>
              <div className="space-y-2">
                {teamStats.leadsByStatus.map((item) => (
                  <div key={item.status} className="flex items-center gap-2">
                    <div className="w-24 text-sm capitalize">{item.status.replace('_', ' ')}</div>
                    <div className="flex-1">
                      <Progress 
                        value={(item.count / teamStats.totalLeads) * 100} 
                        className="h-2"
                      />
                    </div>
                    <div className="w-12 text-sm text-right">{item.count}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* By Source */}
            <div>
              <h4 className="text-sm font-medium mb-3">By Source</h4>
              <div className="space-y-2">
                {teamStats.leadsBySource.slice(0, 5).map((item) => (
                  <div key={item.source} className="flex items-center gap-2">
                    <div className="w-24 text-sm capitalize">{item.source.replace('_', ' ')}</div>
                    <div className="flex-1">
                      <Progress 
                        value={(item.count / teamStats.totalLeads) * 100} 
                        className="h-2"
                      />
                    </div>
                    <div className="w-12 text-sm text-right">{item.count}</div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tag Distribution */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Tag Analysis
          </CardTitle>
          <CardDescription>Most common lead tags</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            {teamStats.tagDistribution.map((tag) => (
              <Badge 
                key={tag.tag}
                style={{ backgroundColor: tag.color }}
                className="text-white px-3 py-1.5 text-sm"
              >
                {tag.tag}: {tag.count}
              </Badge>
            ))}
            {teamStats.tagDistribution.length === 0 && (
              <span className="text-muted-foreground">No tags assigned yet</span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Team Performance Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Team Performance Details
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Team Member</TableHead>
                <TableHead className="text-right">Total Leads</TableHead>
                <TableHead className="text-right">New</TableHead>
                <TableHead className="text-right">Contacted</TableHead>
                <TableHead className="text-right">Paid</TableHead>
                <TableHead className="text-right">Lost</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
                <TableHead className="text-right">Conversion %</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {teamStats.leaderboard.map((person) => (
                <TableRow key={person.userId}>
                  <TableCell className="font-medium">{person.userName}</TableCell>
                  <TableCell className="text-right">{person.totalLeads}</TableCell>
                  <TableCell className="text-right">{person.newLeads}</TableCell>
                  <TableCell className="text-right">{person.contactedLeads}</TableCell>
                  <TableCell className="text-right text-green-600">{person.convertedLeads}</TableCell>
                  <TableCell className="text-right text-red-600">{person.lostLeads}</TableCell>
                  <TableCell className="text-right font-medium">
                    £{person.totalRevenue.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {person.conversionRate.toFixed(1)}%
                      {person.conversionRate >= 50 ? (
                        <ArrowUp className="h-3 w-3 text-green-500" />
                      ) : (
                        <ArrowDown className="h-3 w-3 text-red-500" />
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
