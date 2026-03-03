import React from 'react';
import { Briefcase, Calendar, HeartPulse, Umbrella, GraduationCap } from 'lucide-react';
import { TimesheetStats as Stats } from '@/hooks/useTimesheets';

interface TimesheetStatsProps {
  stats: Stats;
}

export function TimesheetStats({ stats }: TimesheetStatsProps) {
  const statCards = [
    { label: 'Full Days Worked', value: stats.fullDays, icon: Briefcase, color: 'text-emerald-600', bgColor: 'bg-emerald-50' },
    { label: 'Half Days', value: stats.halfDays, icon: Calendar, color: 'text-blue-600', bgColor: 'bg-blue-50' },
    { label: 'Weekend Days', value: stats.weekendDays, icon: Calendar, color: 'text-indigo-600', bgColor: 'bg-indigo-50' },
    { label: 'Sick Days', value: stats.sickDays, icon: HeartPulse, color: 'text-red-600', bgColor: 'bg-red-50' },
    { label: 'Holidays', value: stats.holidayDays, icon: Umbrella, color: 'text-amber-600', bgColor: 'bg-amber-50' },
    { label: 'Training', value: stats.trainingDays, icon: GraduationCap, color: 'text-purple-600', bgColor: 'bg-purple-50' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {statCards.map((stat) => {
        const Icon = stat.icon;
        return (
          <div key={stat.label} className={`${stat.bgColor} rounded-xl p-4 flex flex-col items-center justify-center text-center`}>
            <Icon className={`h-5 w-5 ${stat.color} mb-1`} />
            <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
            <div className="text-xs text-gray-600 mt-0.5">{stat.label}</div>
          </div>
        );
      })}
    </div>
  );
}
