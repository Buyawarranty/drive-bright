import React, { useState } from 'react';
import { format } from 'date-fns';
import { Calendar, TrendingUp, Coins, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useTimesheets } from '@/hooks/useTimesheets';
import { TimesheetCalendar } from './TimesheetCalendar';
import { TimesheetStats } from './TimesheetStats';
import { DealsSection } from './DealsSection';
import { CommissionsSection } from './CommissionsSection';

export function TimesheetsTab() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const {
    entries,
    deals,
    commissions,
    stats,
    loading,
    upsertEntry,
    deleteEntry,
    addDeal,
    deleteDeal,
    refresh,
  } = useTimesheets(currentMonth);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Timesheets & Performance</h1>
          <p className="text-gray-500 mt-1">
            Track your work hours, record deals, and monitor your commissions
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={refresh}
          disabled={loading}
          className="gap-2 self-start"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Stats Overview */}
      <TimesheetStats stats={stats} />

      {/* Main Content - Mobile Tabs / Desktop Grid */}
      <div className="block lg:hidden">
        <Tabs defaultValue="calendar" className="w-full">
          <TabsList className="w-full grid grid-cols-3">
            <TabsTrigger value="calendar" className="gap-1.5">
              <Calendar className="h-4 w-4" />
              <span className="hidden sm:inline">Calendar</span>
            </TabsTrigger>
            <TabsTrigger value="deals" className="gap-1.5">
              <TrendingUp className="h-4 w-4" />
              <span className="hidden sm:inline">Deals</span>
            </TabsTrigger>
            <TabsTrigger value="commissions" className="gap-1.5">
              <Coins className="h-4 w-4" />
              <span className="hidden sm:inline">Commissions</span>
            </TabsTrigger>
          </TabsList>
          <TabsContent value="calendar" className="mt-4">
            <TimesheetCalendar
              entries={entries}
              currentMonth={currentMonth}
              onMonthChange={setCurrentMonth}
              onEntryUpdate={upsertEntry}
              onEntryDelete={deleteEntry}
            />
          </TabsContent>
          <TabsContent value="deals" className="mt-4">
            <DealsSection
              deals={deals}
              onAddDeal={addDeal}
              onDeleteDeal={deleteDeal}
            />
          </TabsContent>
          <TabsContent value="commissions" className="mt-4">
            <CommissionsSection commissions={commissions} />
          </TabsContent>
        </Tabs>
      </div>

      {/* Desktop Layout */}
      <div className="hidden lg:grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <TimesheetCalendar
            entries={entries}
            currentMonth={currentMonth}
            onMonthChange={setCurrentMonth}
            onEntryUpdate={upsertEntry}
            onEntryDelete={deleteEntry}
          />
        </div>
        <div className="space-y-6">
          <DealsSection
            deals={deals}
            onAddDeal={addDeal}
            onDeleteDeal={deleteDeal}
          />
          <CommissionsSection commissions={commissions} />
        </div>
      </div>
    </div>
  );
}
