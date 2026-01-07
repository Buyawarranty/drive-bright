import React from 'react';
import { Briefcase, Clock, HeartPulse, Umbrella, Home, GraduationCap } from 'lucide-react';
import { TimesheetStats as Stats } from '@/hooks/useTimesheets';

interface TimesheetStatsProps {
  stats: Stats;
}

export function TimesheetStats({ stats }: TimesheetStatsProps) {
  const statCards = [
    {
      label: 'Days Worked',
      value: stats.totalWorkedDays,
      icon: Briefcase,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-50',
    },
    {
      label: 'Hours Logged',
      value: stats.totalWorkedHours.toFixed(1),
      icon: Clock,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
    },
    {
      label: 'WFH Days',
      value: stats.wfhDays,
      icon: Home,
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-50',
    },
    {
      label: 'Sick Days',
      value: stats.sickDays,
      icon: HeartPulse,
      color: 'text-red-600',
      bgColor: 'bg-red-50',
    },
    {
      label: 'Holidays',
      value: stats.holidayDays,
      icon: Umbrella,
      color: 'text-amber-600',
      bgColor: 'bg-amber-50',
    },
    {
      label: 'Training',
      value: stats.trainingDays,
      icon: GraduationCap,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {statCards.map((stat) => {
        const Icon = stat.icon;
        return (
          <div
            key={stat.label}
            className={`${stat.bgColor} rounded-xl p-4 flex flex-col items-center justify-center text-center`}
          >
            <Icon className={`h-5 w-5 ${stat.color} mb-1`} />
            <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
            <div className="text-xs text-gray-600 mt-0.5">{stat.label}</div>
          </div>
        );
      })}
    </div>
  );
}
