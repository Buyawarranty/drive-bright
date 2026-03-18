import React, { useState, useEffect } from 'react';
import { format, subMonths, addMonths, subDays } from 'date-fns';
import { Calendar, TrendingUp, Coins, RefreshCw, FileDown, Mail, ChevronLeft, ChevronRight, ClipboardCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useTimesheets } from '@/hooks/useTimesheets';
import { useAuth } from '@/hooks/useAuth';
import { TimesheetCalendar } from './TimesheetCalendar';
import { TimesheetStats } from './TimesheetStats';
import { DealsSection } from './DealsSection';
import { CommissionsSection } from './CommissionsSection';
import { TimesheetApprovals } from './TimesheetApprovals';
import { TimesheetComments } from './TimesheetComments';
import { AdditionalBonuses } from './AdditionalBonuses';
import { CommissionClaimsSection } from './CommissionClaimsSection';
import { StaffTimesheetSelector } from './StaffTimesheetSelector';
import { UnwindsSection } from './UnwindsSection';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export function TimesheetsTab() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [activeView, setActiveView] = useState<'my-timesheet' | 'approvals'>('my-timesheet');
  const { session } = useAuth();
  const [userRole, setUserRole] = useState<string | null>(null);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [viewingUserId, setViewingUserId] = useState<string | null>(null);

  const effectiveViewingUserId = viewingUserId && viewingUserId !== session?.user?.id ? viewingUserId : undefined;
  const isViewingOther = !!effectiveViewingUserId;

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
  } = useTimesheets(currentMonth, effectiveViewingUserId);

  // Check if user has accounts/payroll role
  useEffect(() => {
    async function checkRole() {
      if (!session?.user?.id) return;
      const { data } = await supabase
        .from('admin_users')
        .select('role')
        .eq('user_id', session.user.id)
        .maybeSingle();
      setUserRole(data?.role || null);
    }
    checkRole();
  }, [session?.user?.id]);

  const isAccountsRole = userRole === 'accounts_manager' || userRole === 'accounts_payroll' || userRole === 'super_admin' || userRole === 'admin';
  const generateTimesheetHTML = () => {
    const monthLabel = format(currentMonth, 'MMMM yyyy');
    const userEmail = session?.user?.email || 'Unknown';
    
    const rows = entries.map(e => {
      const type = e.entry_type === 'wfh' ? 'Worked' : (e.entry_type.charAt(0).toUpperCase() + e.entry_type.slice(1).replace('_', ' '));
      return `<tr>
        <td style="padding:8px;border:1px solid #ddd">${format(new Date(e.entry_date), 'EEE dd/MM/yyyy')}</td>
        <td style="padding:8px;border:1px solid #ddd">${type}</td>
        <td style="padding:8px;border:1px solid #ddd">${e.start_time || '-'}</td>
        <td style="padding:8px;border:1px solid #ddd">${e.end_time || '-'}</td>
        <td style="padding:8px;border:1px solid #ddd">${e.hours_worked || 0}</td>
        <td style="padding:8px;border:1px solid #ddd">${e.break_minutes || 0}</td>
        <td style="padding:8px;border:1px solid #ddd">${e.notes || ''}</td>
      </tr>`;
    }).join('');

    return `<html><body style="font-family:Arial,sans-serif">
      <h2 style="color:#333">Timesheet — ${monthLabel}</h2>
      <p><strong>Employee:</strong> ${userEmail}</p>
      <p><strong>Days Worked:</strong> ${stats.totalWorkedDays} | <strong>Hours:</strong> ${stats.totalWorkedHours.toFixed(1)} | <strong>Sick:</strong> ${stats.sickDays} | <strong>Holiday:</strong> ${stats.holidayDays} | <strong>Training:</strong> ${stats.trainingDays}</p>
      <table style="border-collapse:collapse;width:100%;margin-top:16px">
        <thead><tr style="background:#f5f5f5">
          <th style="padding:8px;border:1px solid #ddd;text-align:left">Date</th>
          <th style="padding:8px;border:1px solid #ddd;text-align:left">Type</th>
          <th style="padding:8px;border:1px solid #ddd;text-align:left">Start</th>
          <th style="padding:8px;border:1px solid #ddd;text-align:left">End</th>
          <th style="padding:8px;border:1px solid #ddd;text-align:left">Hours</th>
          <th style="padding:8px;border:1px solid #ddd;text-align:left">Break</th>
          <th style="padding:8px;border:1px solid #ddd;text-align:left">Notes</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <p style="margin-top:16px;color:#888;font-size:12px">Generated ${format(new Date(), 'dd/MM/yyyy HH:mm')}</p>
    </body></html>`;
  };

  const handleDownloadPDF = () => {
    const html = generateTimesheetHTML();
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const printWindow = window.open(url, '_blank');
    if (printWindow) {
      printWindow.onload = () => {
        printWindow.print();
      };
    }
    toast.success('Print dialog opened — save as PDF');
  };

  const handleEmailToAccounts = async () => {
    if (!session?.user?.id) return;
    setSendingEmail(true);
    try {
      const html = generateTimesheetHTML();
      const monthLabel = format(currentMonth, 'MMMM yyyy');
      const userEmail = session.user.email || 'Unknown';

      const { data, error } = await supabase.functions.invoke('send-timesheet-email', {
        body: {
          html,
          monthLabel,
          userEmail,
        },
      });

      if (error) throw error;
      toast.success('Timesheet emailed to accounts@buyawarranty.co.uk');
    } catch (err) {
      console.error('Error sending timesheet email:', err);
      toast.error('Failed to send timesheet email');
    } finally {
      setSendingEmail(false);
    }
  };

  const isCurrentMonth = currentMonth.getMonth() === new Date().getMonth() && currentMonth.getFullYear() === new Date().getFullYear();

  // If accounts role and viewing approvals, show the approvals UI
  if (isAccountsRole && activeView === 'approvals') {
    return (
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Timesheet Approvals</h1>
            <p className="text-gray-500 mt-1">Review and approve staff timesheets and deals</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setActiveView('my-timesheet')} className="gap-2">
              <Calendar className="h-4 w-4" />
              My Timesheet
            </Button>
          </div>
        </div>
        <TimesheetApprovals />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Timesheets & Performance</h1>
          <p className="text-muted-foreground mt-1">
            {isViewingOther ? 'Viewing staff member\'s timesheet (read-only)' : 'Track your work hours, record deals, and monitor your commissions'}
          </p>
        </div>
        <div className="flex items-center gap-2 self-start flex-wrap">
          {isAccountsRole && session?.user?.id && (
            <StaffTimesheetSelector
              currentUserId={session.user.id}
              selectedUserId={viewingUserId || session.user.id}
              onUserChange={(uid) => setViewingUserId(uid)}
            />
          )}
          {isAccountsRole && (
            <Button variant="default" size="sm" onClick={() => setActiveView('approvals')} className="gap-2 bg-orange-600 hover:bg-orange-700">
              <ClipboardCheck className="h-4 w-4" />
              Approve Timesheets
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={handleDownloadPDF} className="gap-2">
            <FileDown className="h-4 w-4" />
            Download PDF
          </Button>
          <Button variant="outline" size="sm" onClick={handleEmailToAccounts} disabled={sendingEmail} className="gap-2">
            <Mail className={`h-4 w-4 ${sendingEmail ? 'animate-pulse' : ''}`} />
            {sendingEmail ? 'Sending...' : 'Email to Accounts'}
          </Button>
          <Button variant="outline" size="sm" onClick={refresh} disabled={loading} className="gap-2">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Month Selector Bar */}
      <div className="bg-white rounded-xl shadow-sm border p-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h2 className="text-lg font-semibold text-gray-900 min-w-[160px] text-center">
              {format(currentMonth, 'MMMM yyyy')}
            </h2>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            {!isCurrentMonth && (
              <Button variant="outline" size="sm" className="ml-2 text-xs" onClick={() => setCurrentMonth(new Date())}>
                This Month
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={() => {
                const thirtyDaysAgo = subDays(new Date(), 30);
                setCurrentMonth(thirtyDaysAgo);
              }}
            >
              Last 30 Days
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={() => setCurrentMonth(subMonths(new Date(), 1))}
            >
              Last Month
            </Button>
          </div>
        </div>
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
            <TimesheetCalendar entries={entries} currentMonth={currentMonth} onMonthChange={setCurrentMonth} onEntryUpdate={upsertEntry} onEntryDelete={deleteEntry} />
          </TabsContent>
          <TabsContent value="deals" className="mt-4">
            <DealsSection deals={deals} onAddDeal={addDeal} onDeleteDeal={deleteDeal} currentMonth={currentMonth} />
          </TabsContent>
          <TabsContent value="commissions" className="mt-4">
            <CommissionClaimsSection currentMonth={currentMonth} />
            <div className="mt-4">
              <UnwindsSection currentMonth={currentMonth} viewingUserId={effectiveViewingUserId || session?.user?.id || undefined} />
            </div>
            <div className="mt-4">
              <CommissionsSection commissions={commissions} />
            </div>
            <div className="mt-4">
              <AdditionalBonuses currentMonth={currentMonth} />
            </div>
            <div className="mt-4">
              <TimesheetComments currentMonth={currentMonth} />
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Desktop Layout */}
      <div className="hidden lg:grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <TimesheetCalendar entries={entries} currentMonth={currentMonth} onMonthChange={setCurrentMonth} onEntryUpdate={upsertEntry} onEntryDelete={deleteEntry} />
        </div>
        <div className="space-y-6">
          <DealsSection deals={deals} onAddDeal={addDeal} onDeleteDeal={deleteDeal} currentMonth={currentMonth} />
          <CommissionClaimsSection currentMonth={currentMonth} />
          <UnwindsSection currentMonth={currentMonth} viewingUserId={effectiveViewingUserId || session?.user?.id || undefined} />
          <CommissionsSection commissions={commissions} />
          <AdditionalBonuses currentMonth={currentMonth} />
          <TimesheetComments currentMonth={currentMonth} />
        </div>
      </div>
    </div>
  );
}
