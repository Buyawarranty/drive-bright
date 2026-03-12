import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useSalesStats } from '@/hooks/useSalesStats';
import { 
  TrendingUp, Users, 
  Award, BarChart3, PieChart, ArrowUp, ArrowDown, CalendarIcon, X,
  Phone, UserCheck, Gauge, Clock, ShieldCheck, PoundSterling
} from 'lucide-react';
import { subDays, startOfDay, endOfDay, startOfMonth, startOfWeek } from 'date-fns';

type QuickPeriod = 'all' | 'today' | 'yesterday' | '7days' | '14days' | '30days' | 'this_month' | 'this_week';

const getDateRange = (period: QuickPeriod): { from: Date | undefined; to: Date | undefined } => {
  const now = new Date();
  switch (period) {
    case 'today':
      return { from: startOfDay(now), to: endOfDay(now) };
    case 'yesterday': {
      const y = subDays(now, 1);
      return { from: startOfDay(y), to: endOfDay(y) };
    }
    case '7days':
      return { from: startOfDay(subDays(now, 6)), to: endOfDay(now) };
    case '14days':
      return { from: startOfDay(subDays(now, 13)), to: endOfDay(now) };
    case '30days':
      return { from: startOfDay(subDays(now, 29)), to: endOfDay(now) };
    case 'this_month':
      return { from: startOfMonth(now), to: endOfDay(now) };
    case 'this_week':
      return { from: startOfWeek(now, { weekStartsOn: 1 }), to: endOfDay(now) };
    case 'all':
    default:
      return { from: undefined, to: undefined };
  }
};

const periodLabels: Record<QuickPeriod, string> = {
  all: 'All Time',
  today: 'Today',
  yesterday: 'Yesterday',
  this_week: 'This Week',
  '7days': 'Last 7 Days',
  '14days': 'Last 14 Days',
  this_month: 'This Month',
  '30days': 'Last 30 Days',
};

export const ManagerDashboard: React.FC = () => {
  const [period, setPeriod] = useState<QuickPeriod>('all');
  const [agentFilter, setAgentFilter] = useState<string>('all');

  const dateRange = useMemo(() => getDateRange(period), [period]);

  const teamFilters = useMemo(() => ({
    dateFrom: dateRange.from,
    dateTo: dateRange.to,
    agentId: agentFilter,
  }), [dateRange.from, dateRange.to, agentFilter]);

  const { teamStats, salesUsers, loading } = useSalesStats(undefined, teamFilters);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
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

  const hasFilters = period !== 'all' || agentFilter !== 'all';

  return (
    <div className="space-y-6">
      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <CalendarIcon className="h-4 w-4 text-muted-foreground" />
          <Select value={period} onValueChange={(v) => setPeriod(v as QuickPeriod)}>
            <SelectTrigger className="w-[160px] h-9 border-2 border-border">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(periodLabels).map(([key, label]) => (
                <SelectItem key={key} value={key}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          <Select value={agentFilter} onValueChange={setAgentFilter}>
            <SelectTrigger className="w-[200px] h-9 border-2 border-border">
              <SelectValue placeholder="All Agents" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Agents</SelectItem>
              <SelectItem value="unassigned">Unassigned</SelectItem>
              {salesUsers.map(u => (
                <SelectItem key={u.id} value={u.id}>
                  {u.first_name} {u.last_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setPeriod('all'); setAgentFilter('all'); }}
            className="gap-1 text-xs"
          >
            <X className="h-3.5 w-3.5" />
            Clear Filters
          </Button>
        )}

        {hasFilters && (
          <Badge variant="secondary" className="text-xs">
            {periodLabels[period]}
            {agentFilter !== 'all' && ` · ${agentFilter === 'unassigned' ? 'Unassigned' : salesUsers.find(u => u.id === agentFilter)?.first_name || 'Agent'}`}
          </Badge>
        )}
      </div>

      {/* Overview Stats - Row 1 */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Leads</CardDescription>
            <CardTitle className="text-3xl">{teamStats.totalLeads}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-sm">
              <Badge variant="secondary">
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

      {/* Performance KPIs - Row 2 */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5">
              <Phone className="h-3.5 w-3.5" />
              Total Calls Made
            </CardDescription>
            <CardTitle className="text-3xl">
              {teamStats.leaderboard.reduce((sum, a) => sum + a.totalCalls, 0)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground">Activity tracking</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5">
              <UserCheck className="h-3.5 w-3.5" />
              Contacts Made
            </CardDescription>
            <CardTitle className="text-3xl">
              {teamStats.leaderboard.reduce((sum, a) => sum + a.contactedLeads, 0)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground">Engagement quality</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5">
              <PoundSterling className="h-3.5 w-3.5" />
              Avg Policy Value
            </CardDescription>
            <CardTitle className="text-3xl">
              £{teamStats.totalConverted > 0 
                ? Math.round(teamStats.totalRevenue / teamStats.totalConverted).toLocaleString()
                : '0'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground">Revenue quality</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              Avg Speed-to-Lead
            </CardDescription>
            <CardTitle className="text-3xl">
              {(() => {
                const stlValues = teamStats.leaderboard
                  .filter(a => a.avgSpeedToLeadHours !== null)
                  .map(a => a.avgSpeedToLeadHours!);
                if (stlValues.length === 0) return 'N/A';
                const avg = stlValues.reduce((a, b) => a + b, 0) / stlValues.length;
                if (avg < 1) return `${Math.round(avg * 60)}m`;
                return `${avg.toFixed(1)}h`;
              })()}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground">Critical KPI</div>
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
                <TableRow className="border-b-2 border-border">
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
                        value={teamStats.totalLeads > 0 ? (item.count / teamStats.totalLeads) * 100 : 0} 
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
                        value={teamStats.totalLeads > 0 ? (item.count / teamStats.totalLeads) * 100 : 0} 
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
            <Gauge className="h-5 w-5" />
            Real-Time Agent Performance
          </CardTitle>
          <CardDescription>Live metrics for coaching and instant corrections</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-b-2 border-border">
                <TableHead>Agent</TableHead>
                <TableHead className="text-right">Calls</TableHead>
                <TableHead className="text-right">Contacts</TableHead>
                <TableHead className="text-right">Sales</TableHead>
                <TableHead className="text-right">Conv %</TableHead>
                <TableHead className="text-right">Avg Policy</TableHead>
                <TableHead className="text-right">Speed-to-Lead</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {teamStats.leaderboard.map((person) => (
                <TableRow key={person.userId}>
                  <TableCell className="font-medium">{person.userName}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <Phone className="h-3 w-3 text-muted-foreground" />
                      {person.totalCalls}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">{person.contactedLeads}</TableCell>
                  <TableCell className="text-right text-green-600 font-medium">{person.convertedLeads}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Badge 
                        variant="secondary"
                        className={person.conversionRate >= 50 ? 'bg-green-100 text-green-800' : person.conversionRate >= 25 ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800'}
                      >
                        {person.conversionRate.toFixed(1)}%
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    £{person.avgPolicyValue > 0 ? Math.round(person.avgPolicyValue).toLocaleString() : '—'}
                  </TableCell>
                  <TableCell className="text-right">
                    {person.avgSpeedToLeadHours !== null
                      ? person.avgSpeedToLeadHours < 1
                        ? `${Math.round(person.avgSpeedToLeadHours * 60)}m`
                        : `${person.avgSpeedToLeadHours.toFixed(1)}h`
                      : '—'}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    £{person.totalRevenue.toLocaleString()}
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
