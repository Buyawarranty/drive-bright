import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Bar, BarChart, CartesianGrid, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, ComposedChart } from 'recharts';
import { AlertTriangle, Check, ClipboardList, Download, Minus, User } from 'lucide-react';
import { useCurrentAdminId } from '@/hooks/useCurrentAdminId';
import {
  CRM_RATING_LABELS,
  LEADS_ISSUE_OPTIONS,
  ORDERS_ISSUE_OPTIONS,
  SURVEY_START_DATE,
  surveyWindowLabel,
} from './DailyCrmSurvey';

/**
 * Daily CRM survey results.
 *
 * Managers: who has filled it in each day (from the survey launch date, never
 * earlier), overall issue charts, and a chart per agent of their own problems.
 * Agents (selfOnly): only their own answers and their own chart.
 */

type SurveyRow = {
  id: string;
  admin_user_id: string | null;
  admin_name: string | null;
  admin_email: string | null;
  survey_date: string;
  speed_rating: number;
  orders_issues: string[] | null;
  orders_other: string | null;
  leads_issues: string[] | null;
  leads_other: string | null;
  biggest_issue: string | null;
  other_comments: string | null;
  created_at: string;
};

type Agent = { id: string; name: string };

const SOFT = new Set(['No issues', 'Very little issues - did not affect my work much']);

const ratingTone = (avg: number) => {
  if (avg < 2.5) return 'bg-destructive/10 text-destructive border-destructive/30';
  if (avg < 3.5) return 'bg-amber-100 text-amber-800 border-amber-300';
  return 'bg-emerald-100 text-emerald-800 border-emerald-300';
};

const ukDate = (d: Date) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);

const fmtShort = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short' });

const fmtLong = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

const realIssues = (r: SurveyRow) => [...(r.orders_issues || []), ...(r.leads_issues || [])].filter((i) => !SOFT.has(i));

const countIssues = (rows: SurveyRow[], key: 'orders_issues' | 'leads_issues', options: readonly string[]) =>
  options
    .map((opt) => ({ label: opt, count: rows.filter((r) => (r[key] || []).includes(opt)).length }))
    .filter((o) => o.count > 0)
    .sort((a, b) => b.count - a.count);

const IssueBars: React.FC<{ data: Array<{ label: string; count: number }>; height?: number }> = ({ data, height = 220 }) => (
  <div style={{ height }}>
    {data.length === 0 ? (
      <p className="text-xs text-muted-foreground">No answers yet.</p>
    ) : (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
          <XAxis type="number" allowDecimals={false} fontSize={11} />
          <YAxis type="category" dataKey="label" width={170} fontSize={11} tickFormatter={(v: string) => (v.length > 28 ? `${v.slice(0, 27)}…` : v)} />
          <Tooltip />
          <Bar dataKey="count" name="Times reported" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    )}
  </div>
);

export const DailyCrmSurveyResults: React.FC<{ days: number; selfOnly?: boolean }> = ({ days, selfOnly = false }) => {
  const currentAdminId = useCurrentAdminId();
  const [rows, setRows] = useState<SurveyRow[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    if (selfOnly && !currentAdminId) return;
    // Never look further back than the day the survey went live.
    const rangeSince = ukDate(new Date(Date.now() - (days - 1) * 86400_000));
    const since = rangeSince < SURVEY_START_DATE ? SURVEY_START_DATE : rangeSince;
    (async () => {
      let q = (supabase as any)
        .from('staff_system_reports')
        .select(
          'id, admin_user_id, admin_name, admin_email, survey_date, speed_rating, orders_issues, orders_other, leads_issues, leads_other, biggest_issue, other_comments, created_at',
        )
        .eq('report_kind', 'daily_survey')
        .gte('survey_date', since)
        .order('survey_date', { ascending: false })
        .limit(2000);
      if (selfOnly) q = q.eq('admin_user_id', currentAdminId);

      const [{ data: surveys }, staffRes] = await Promise.all([
        q,
        selfOnly
          ? Promise.resolve({ data: [] as any[] })
          : supabase
              .from('admin_users')
              .select('id, first_name, last_name, email, role, is_active')
              .in('role', ['sales', 'sales_lead'])
              .eq('is_active', true),
      ]);
      setRows((surveys || []) as SurveyRow[]);
      setAgents(
        ((staffRes.data || []) as any[]).map((a) => ({
          id: a.id,
          name: [a.first_name, a.last_name].filter(Boolean).join(' ') || a.email,
        })),
      );
    })();
  }, [days, selfOnly, currentAdminId]);

  /** Days shown in the completion grid: launch date → today, capped at 14 columns. */
  const dayList = useMemo(() => {
    const today = ukDate(new Date());
    const all: string[] = [];
    for (let i = 0; i < 400; i++) {
      const d = ukDate(new Date(Date.now() - i * 86400_000));
      if (d < SURVEY_START_DATE) break;
      all.unshift(d);
    }
    if (!all.length) all.push(today);
    return all.slice(-Math.min(days, 14));
  }, [days]);

  const byAgentDay = useMemo(() => {
    const m = new Map<string, SurveyRow>();
    rows.forEach((r) => r.admin_user_id && m.set(`${r.admin_user_id}|${r.survey_date}`, r));
    return m;
  }, [rows]);

  const ordersCounts = useMemo(() => countIssues(rows, 'orders_issues', ORDERS_ISSUE_OPTIONS), [rows]);
  const leadsCounts = useMemo(() => countIssues(rows, 'leads_issues', LEADS_ISSUE_OPTIONS), [rows]);

  const trend = useMemo(() => {
    const m = new Map<string, { sum: number; n: number; problems: number }>();
    rows.forEach((r) => {
      const e = m.get(r.survey_date) || { sum: 0, n: 0, problems: 0 };
      e.sum += r.speed_rating;
      e.n += 1;
      if (realIssues(r).length) e.problems += 1;
      m.set(r.survey_date, e);
    });
    return Array.from(m.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([d, e]) => ({ label: fmtShort(d), responses: e.n, withProblems: e.problems, avgRating: +(e.sum / e.n).toFixed(2) }));
  }, [rows]);

  /** One chart per agent: which problems they personally keep hitting. */
  const perAgent = useMemo(() => {
    const groups = new Map<string, { name: string; rows: SurveyRow[] }>();
    rows.forEach((r) => {
      const key = r.admin_user_id || r.admin_email || 'unknown';
      const g = groups.get(key) || { name: r.admin_name || r.admin_email || 'Unknown', rows: [] };
      g.rows.push(r);
      groups.set(key, g);
    });
    return Array.from(groups.entries())
      .map(([id, g]) => {
        const avg = g.rows.reduce((s, r) => s + r.speed_rating, 0) / g.rows.length;
        const problemDays = g.rows.filter((r) => realIssues(r).length > 0).length;
        const issues = [
          ...countIssues(g.rows, 'orders_issues', ORDERS_ISSUE_OPTIONS).map((i) => ({ ...i, label: `Orders: ${i.label}` })),
          ...countIssues(g.rows, 'leads_issues', LEADS_ISSUE_OPTIONS).map((i) => ({ ...i, label: `New Leads: ${i.label}` })),
        ]
          .filter((i) => !SOFT.has(i.label.replace(/^(Orders|New Leads): /, '')))
          .sort((a, b) => b.count - a.count);
        const ratings = [...g.rows]
          .sort((a, b) => a.survey_date.localeCompare(b.survey_date))
          .map((r) => ({ label: fmtShort(r.survey_date), rating: r.speed_rating, problems: realIssues(r).length }));
        return { id, name: g.name, count: g.rows.length, avg, problemDays, issues, ratings };
      })
      .sort((a, b) => a.avg - b.avg || b.problemDays - a.problemDays);
  }, [rows]);

  const avg = rows.length ? rows.reduce((s, r) => s + r.speed_rating, 0) / rows.length : null;
  const expected = agents.length * dayList.length;
  const received = dayList.reduce((n, d) => n + agents.filter((a) => byAgentDay.has(`${a.id}|${d}`)).length, 0);
  const today = ukDate(new Date());
  const todayReceived = agents.filter((a) => byAgentDay.has(`${a.id}|${today}`)).length;
  const todayRows = rows.filter((r) => r.survey_date === today);
  const todayProblems = todayRows.filter((r) => realIssues(r).length > 0).length;
  const todayCompletion = agents.length ? Math.round((todayReceived / agents.length) * 100) : 0;

  const exportCsv = () => {
    const headers = ['Survey day', 'Agent', 'CRM rating', 'Orders page issues', 'Orders other', 'New Leads issues', 'New Leads other', 'Biggest issue', 'Anything else', 'Sent at (UK)'];
    const body = rows.map((r) => [
      r.survey_date,
      r.admin_name || r.admin_email || '',
      `${r.speed_rating} (${CRM_RATING_LABELS[r.speed_rating] || ''})`,
      (r.orders_issues || []).join('; '),
      r.orders_other || '',
      (r.leads_issues || []).join('; '),
      r.leads_other || '',
      r.biggest_issue || '',
      r.other_comments || '',
      new Date(r.created_at).toLocaleString('en-GB', { timeZone: 'Europe/London' }),
    ]);
    const csv = [headers, ...body].map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `daily-crm-survey-${days}d.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const answerList = (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{selfOnly ? 'Your answers' : 'Every answer'}</CardTitle>
        <CardDescription>Click a row to see the full answers.</CardDescription>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            {selfOnly ? "You haven't sent a survey yet." : 'No surveys in this period.'}
          </p>
        ) : (
          <div className="rounded-md border divide-y">
            {rows.map((r) => {
              const real = realIssues(r);
              return (
                <div key={r.id} className="px-3 py-2.5 text-sm cursor-pointer hover:bg-muted/50" onClick={() => setExpanded(expanded === r.id ? null : r.id)}>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <Badge variant="outline" className={ratingTone(r.speed_rating)}>
                      {r.speed_rating} · {CRM_RATING_LABELS[r.speed_rating] || ''}
                    </Badge>
                    {!selfOnly && <span className="font-medium">{r.admin_name || r.admin_email || 'Unknown'}</span>}
                    <span className="text-xs text-muted-foreground">{fmtShort(r.survey_date)}</span>
                    <span className={`text-xs ${real.length ? 'text-destructive' : 'text-muted-foreground'}`}>
                      {real.length ? real.join(', ') : 'No real issues'}
                    </span>
                  </div>
                  {r.biggest_issue && <p className="mt-1 text-sm">{r.biggest_issue}</p>}
                  {expanded === r.id && (
                    <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                      <p><span className="font-medium text-foreground">Orders page:</span> {(r.orders_issues || []).join(', ') || '—'}{r.orders_other ? ` — ${r.orders_other}` : ''}</p>
                      <p><span className="font-medium text-foreground">New Leads page:</span> {(r.leads_issues || []).join(', ') || '—'}{r.leads_other ? ` — ${r.leads_other}` : ''}</p>
                      {r.other_comments && <p><span className="font-medium text-foreground">Anything else:</span> {r.other_comments}</p>}
                      <p>Sent {new Date(r.created_at).toLocaleString('en-GB', { timeZone: 'Europe/London' })}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );

  const agentCard = (a: (typeof perAgent)[number]) => (
    <Card key={a.id}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex flex-wrap items-center gap-2">
          <User className="h-4 w-4" />
          {a.name}
          <Badge variant="outline" className={ratingTone(a.avg)}>avg {a.avg.toFixed(1)}</Badge>
          <span className="text-xs font-normal text-muted-foreground">
            {a.count} survey{a.count === 1 ? '' : 's'} · {a.problemDays} day{a.problemDays === 1 ? '' : 's'} with a real issue
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 lg:grid-cols-2">
        <div>
          <p className="text-xs font-medium mb-1">Problems reported</p>
          {a.issues.length === 0 ? (
            <p className="text-xs text-muted-foreground">No real issues reported.</p>
          ) : (
            <IssueBars data={a.issues} height={Math.max(120, a.issues.length * 28 + 40)} />
          )}
        </div>
        <div>
          <p className="text-xs font-medium mb-1">Rating by day (1 = very poor, 5 = very good)</p>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={a.ratings}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" fontSize={11} />
                <YAxis yAxisId="left" fontSize={11} allowDecimals={false} />
                <YAxis yAxisId="right" orientation="right" domain={[0, 5]} fontSize={11} />
                <Tooltip />
                <Bar yAxisId="left" dataKey="problems" name="Issues ticked" fill="hsl(var(--destructive))" />
                <Line yAxisId="right" type="monotone" dataKey="rating" name="Rating" stroke="#8b5cf6" strokeWidth={2} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  if (selfOnly) {
    return (
      <div className="crm-survey-theme space-y-5 font-crm-body">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <Card className="border-primary/20 bg-primary text-primary-foreground"><CardContent className="p-4"><p className="text-xs opacity-80">Surveys sent</p><p className="font-crm-heading text-3xl font-bold">{rows.length}</p></CardContent></Card>
          <Card className="border-primary/20"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Your average rating</p><p className="font-crm-heading text-3xl font-bold">{avg ? avg.toFixed(1) : '—'}</p></CardContent></Card>
          <Card className="border-accent/30 bg-accent/5"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Days with a real issue</p><p className="font-crm-heading text-3xl font-bold text-accent">{rows.filter((r) => realIssues(r).length > 0).length}</p></CardContent></Card>
        </div>
        {perAgent.map(agentCard)}
        {answerList}
      </div>
    );
  }

  return (
    <div className="crm-survey-theme space-y-5 font-crm-body">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-crm-heading text-xl font-semibold flex items-center gap-2">
            <ClipboardList className="h-5 w-5" />
            Daily CRM survey
          </h3>
          <p className="text-sm text-muted-foreground">
            Agents get a pop-up every day between {surveyWindowLabel()} UK time. One answer per agent per day, tracked from {fmtLong(SURVEY_START_DATE)}.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={exportCsv} disabled={rows.length === 0}>
          <Download className="h-4 w-4 mr-1.5" />
          Export survey
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-primary/20 bg-primary text-primary-foreground"><CardContent className="p-4"><p className="text-xs opacity-80">Today’s completion</p><p className="font-crm-heading text-3xl font-bold">{todayReceived}/{agents.length}</p><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-primary-foreground/20"><div className="h-full bg-primary-foreground" style={{ width: `${todayCompletion}%` }} /></div></CardContent></Card>
        <Card className="border-accent/30 bg-accent/5"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Problems today</p><p className="font-crm-heading text-3xl font-bold text-accent">{todayProblems}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Average CRM rating</p><p className="font-crm-heading text-3xl font-bold">{avg ? avg.toFixed(1) : '—'}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Period completion</p><p className="font-crm-heading text-3xl font-bold">{expected ? Math.round((received / expected) * 100) : 0}%</p></CardContent></Card>
      </div>

      {todayProblems > 0 && (
        <div className="flex items-center gap-3 rounded-md border border-accent/30 bg-accent/10 px-4 py-3 text-sm">
          <AlertTriangle className="h-5 w-5 shrink-0 text-accent" />
          <p><span className="font-semibold">{todayProblems} agent{todayProblems === 1 ? '' : 's'} reported a problem today.</span> Review their answers below.</p>
        </div>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Who has filled it in</CardTitle>
          <CardDescription>Starts from {fmtLong(SURVEY_START_DATE)}. Tick = sent that day. Click a tick to read the answers.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {agents.length === 0 ? (
            <p className="text-sm text-muted-foreground">No active sales agents found.</p>
          ) : (
            <table className="text-sm w-full">
              <thead>
                <tr>
                  <th className="text-left font-medium py-1 pr-3">Agent</th>
                  {dayList.map((d) => (
                    <th key={d} className="font-medium py-1 px-1 text-xs whitespace-nowrap">{fmtShort(d)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {agents.map((a) => (
                  <tr key={a.id} className="border-t">
                    <td className="py-1.5 pr-3 whitespace-nowrap">{a.name}</td>
                    {dayList.map((d) => {
                      const r = byAgentDay.get(`${a.id}|${d}`);
                      return (
                        <td key={d} className="text-center px-1">
                          {r ? (
                            <button
                              type="button"
                              title={`Rated ${r.speed_rating}/5`}
                              onClick={() => setExpanded(expanded === r.id ? null : r.id)}
                              className={`inline-flex h-6 w-6 items-center justify-center rounded border ${ratingTone(r.speed_rating)}`}
                            >
                              <Check className="h-3.5 w-3.5" />
                            </button>
                          ) : (
                            <Minus className="h-3.5 w-3.5 mx-auto text-muted-foreground/50" />
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Rating trend</CardTitle>
          <CardDescription>Responses per day, how many reported a real issue, and the average rating (1 = very poor, 5 = very good).</CardDescription>
        </CardHeader>
        <CardContent className="h-64">
          {trend.length === 0 ? (
            <p className="text-sm text-muted-foreground py-10 text-center">No surveys yet — the first answers arrive after today's {surveyWindowLabel()} window.</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" fontSize={12} />
                <YAxis yAxisId="left" fontSize={12} allowDecimals={false} />
                <YAxis yAxisId="right" orientation="right" domain={[0, 5]} fontSize={12} />
                <Tooltip />
                <Legend />
                <Bar yAxisId="left" dataKey="responses" name="Responses" fill="hsl(var(--primary))" />
                <Bar yAxisId="left" dataKey="withProblems" name="Reported a real issue" fill="hsl(var(--destructive))" />
                <Line yAxisId="right" type="monotone" dataKey="avgRating" name="Avg rating" stroke="hsl(var(--accent))" strokeWidth={2} />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-3 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Orders page — issues reported (all agents)</CardTitle></CardHeader>
          <CardContent><IssueBars data={ordersCounts} /></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">New Leads page — issues reported (all agents)</CardTitle></CardHeader>
          <CardContent><IssueBars data={leadsCounts} /></CardContent>
        </Card>
      </div>

      <div>
        <h4 className="text-base font-semibold">Problems by agent</h4>
        <p className="text-sm text-muted-foreground">What each agent keeps running into, and how they rated the CRM day by day. Worst average first.</p>
      </div>
      {perAgent.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">No agent answers yet.</p>
      ) : (
        <div className="space-y-3">{perAgent.map(agentCard)}</div>
      )}

      {answerList}
    </div>
  );
};

export default DailyCrmSurveyResults;
