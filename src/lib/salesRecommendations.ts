export type SalesSnapshot = {
  today: Date;
  target: number; // monthly goal in £, 0 when not set
  monthRevenue: number; // revenue so far this month (excl. cancelled/refunded)
  monthSales: number;
  lastMonthSameDayRevenue: number;
  lastMonthSameDaySales: number;
  bySource: Record<string, { sales: number; revenue: number }>;
};

export type Recommendation = { priority: 'high' | 'medium' | 'low'; title: string; detail: string };

export type SalesGap = {
  daysInMonth: number;
  dayOfMonth: number;
  daysLeft: number;
  expectedByNow: number;
  gap: number; // positive = behind target pace
  projected: number;
  neededPerDay: number;
  avgSale: number;
  salesNeeded: number;
};

export function computeSalesGap(s: SalesSnapshot): SalesGap {
  const y = s.today.getFullYear();
  const m = s.today.getMonth();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const dayOfMonth = s.today.getDate();
  const daysLeft = daysInMonth - dayOfMonth;
  const expectedByNow = s.target * (dayOfMonth / daysInMonth);
  const projected = dayOfMonth > 0 ? (s.monthRevenue / dayOfMonth) * daysInMonth : 0;
  const remaining = Math.max(0, s.target - s.monthRevenue);
  const avgSale = s.monthSales > 0 ? s.monthRevenue / s.monthSales : 0;
  return {
    daysInMonth,
    dayOfMonth,
    daysLeft,
    expectedByNow,
    gap: expectedByNow - s.monthRevenue,
    projected,
    neededPerDay: daysLeft > 0 ? remaining / daysLeft : remaining,
    avgSale,
    salesNeeded: avgSale > 0 ? Math.ceil(remaining / avgSale) : 0,
  };
}

const gbp = (n: number) => `£${Math.round(n).toLocaleString('en-GB')}`;

export function buildRecommendations(s: SalesSnapshot): Recommendation[] {
  const g = computeSalesGap(s);
  const recs: Recommendation[] = [];

  if (s.target <= 0) {
    recs.push({ priority: 'high', title: 'Set this month’s revenue goal', detail: 'No monthly goal is set yet, so gaps can’t be measured. Add it in Analytics.' });
  } else if (g.gap > 0) {
    recs.push({
      priority: 'high',
      title: `Behind target pace by ${gbp(g.gap)}`,
      detail: `You need about ${gbp(g.neededPerDay)} a day for the remaining ${g.daysLeft} days${g.salesNeeded ? ` (around ${g.salesNeeded} more sales at the current ${gbp(g.avgSale)} average)` : ''}. Focus agents on callbacks, warm recontact leads and abandoned carts first.`,
    });
  } else {
    recs.push({ priority: 'low', title: `Ahead of target pace by ${gbp(-g.gap)}`, detail: `Projected month: ${gbp(g.projected)}. Keep the current lead flow and consider stretching the goal.` });
  }

  if (s.lastMonthSameDayRevenue > 0) {
    const change = (s.monthRevenue - s.lastMonthSameDayRevenue) / s.lastMonthSameDayRevenue;
    if (change < -0.1) {
      recs.push({ priority: 'high', title: `Down ${Math.round(-change * 100)}% on last month at this point`, detail: `${gbp(s.monthRevenue)} vs ${gbp(s.lastMonthSameDayRevenue)}. Check lead volumes in Lead count and ad spend before the gap widens.` });
    } else if (change > 0.1) {
      recs.push({ priority: 'low', title: `Up ${Math.round(change * 100)}% on last month at this point`, detail: 'Find out what’s working (source, agent, offer) and do more of it.' });
    }
  }

  const prevAvg = s.lastMonthSameDaySales > 0 ? s.lastMonthSameDayRevenue / s.lastMonthSameDaySales : 0;
  if (prevAvg > 0 && g.avgSale > 0 && g.avgSale < prevAvg * 0.9) {
    recs.push({ priority: 'medium', title: 'Average sale value has dropped', detail: `${gbp(g.avgSale)} now vs ${gbp(prevAvg)} last month. Encourage 2- and 3-year cover and higher claim limits on calls.` });
  }

  const sources = Object.entries(s.bySource).filter(([, v]) => v.sales > 0);
  const total = sources.reduce((a, [, v]) => a + v.revenue, 0);
  if (total > 0) {
    const [topName, top] = sources.sort((a, b) => b[1].revenue - a[1].revenue)[0];
    if (top.revenue / total > 0.6) {
      recs.push({ priority: 'medium', title: `Over 60% of revenue comes from ${topName}`, detail: 'Relying on one channel is risky. Build up a second source (organic, renewals or another ad channel).' });
    }
  }

  recs.push({ priority: 'medium', title: 'Work renewals early', detail: 'Renewal leads (cyan rows) are warm customers — contact them before cover ends.' });
  return recs;
}
