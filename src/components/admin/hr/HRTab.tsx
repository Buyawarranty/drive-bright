import React, { lazy, Suspense, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, MapPin, Users, CalendarClock, Wifi, History } from 'lucide-react';
import { StaffLocationPanel } from '@/components/admin/hr/StaffLocationPanel';
import { StaffDirectoryPanel } from '@/components/admin/hr/StaffDirectoryPanel';
import AdminAccessLogPanel from '@/components/admin/AdminAccessLogPanel';

const TimesheetsTab = lazy(() =>
  import('@/components/admin/timesheets/TimesheetsTab').then((m) => ({ default: m.TimesheetsTab }))
);
const AttendanceTab = lazy(() =>
  import('@/components/admin/AttendanceTab').then((m) => ({ default: m.AttendanceTab }))
);

const MANAGEMENT_ROLES = ['admin', 'super_admin', 'sales_manager', 'accounts_manager', 'accounts_payroll', 'claims_manager', 'performance_manager'];

interface HRTabProps {
  userRole?: string;
}

const Fallback = () => (
  <div className="flex justify-center py-10">
    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
  </div>
);

export const HRTab: React.FC<HRTabProps> = ({ userRole }) => {
  const [tab, setTab] = useState('locations');

  if (userRole && !MANAGEMENT_ROLES.includes(userRole)) {
    return (
      <Card>
        <CardContent className="p-6">
          <h2 className="text-xl font-semibold">Access denied</h2>
          <p className="text-sm text-muted-foreground mt-1">
            The HR section is restricted to managers and administrators.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">HR</h1>
        <p className="text-sm text-muted-foreground">
          People management for remote staff — work locations, directory, attendance, hours and access history.
        </p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="locations" className="gap-2"><MapPin className="w-4 h-4" /> Work locations</TabsTrigger>
          <TabsTrigger value="directory" className="gap-2"><Users className="w-4 h-4" /> Staff directory</TabsTrigger>
          <TabsTrigger value="attendance" className="gap-2"><Wifi className="w-4 h-4" /> Attendance</TabsTrigger>
          <TabsTrigger value="timesheets" className="gap-2"><CalendarClock className="w-4 h-4" /> Timesheets</TabsTrigger>
          <TabsTrigger value="access" className="gap-2"><History className="w-4 h-4" /> Access history</TabsTrigger>
        </TabsList>

        <TabsContent value="locations" className="mt-4">
          <StaffLocationPanel />
        </TabsContent>
        <TabsContent value="directory" className="mt-4">
          <StaffDirectoryPanel />
        </TabsContent>
        <TabsContent value="attendance" className="mt-4">
          <Suspense fallback={<Fallback />}><AttendanceTab /></Suspense>
        </TabsContent>
        <TabsContent value="timesheets" className="mt-4">
          <Suspense fallback={<Fallback />}><TimesheetsTab /></Suspense>
        </TabsContent>
        <TabsContent value="access" className="mt-4">
          <AdminAccessLogPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default HRTab;
