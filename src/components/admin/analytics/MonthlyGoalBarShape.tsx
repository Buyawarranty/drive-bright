export function MonthlyGoalBarShape({ x, y, width, height, payload }: any) {
  const revenue = Math.max(0, Number(payload?.revenue) || 0);
  const target = Math.max(0, Number(payload?.chartTarget) || 0);
  const chartValue = Math.max(revenue, target, 1);
  const baseline = y + height;
  const revenueHeight = height * (revenue / chartValue);
  const targetY = baseline - height * (target / chartValue);

  return (
    <g>
      <rect
        x={x + 3}
        y={baseline - revenueHeight}
        width={Math.max(width - 6, 0)}
        height={revenueHeight}
        rx={3}
        fill={payload?.isSelected ? 'hsl(var(--analytics-revenue-strong))' : 'hsl(var(--analytics-revenue))'}
        stroke={payload?.isSelected ? 'hsl(var(--analytics-revenue-strong))' : 'none'}
        strokeWidth={payload?.isSelected ? 2 : 0}
      />
      {target > 0 && (
        <line x1={x} x2={x + width} y1={targetY} y2={targetY}
          stroke="hsl(var(--analytics-goal-border))" strokeWidth={3} />
      )}
    </g>
  );
}