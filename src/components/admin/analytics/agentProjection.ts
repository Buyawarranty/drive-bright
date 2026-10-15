/** Straight-line month-end projection for one agent, same pace rule as the company projection. */
export function projectAgent(revenue: number, sales: number, dayOfMonth: number, daysInMonth: number, target: number) {
  const pace = daysInMonth / Math.max(1, dayOfMonth);
  const projectedRevenue = Math.round(revenue * pace);
  const projectedSales = Math.round(sales * pace);
  return {
    projectedRevenue,
    projectedSales,
    target,
    projectedPct: target > 0 ? Math.round((projectedRevenue / target) * 100) : null,
  };
}
