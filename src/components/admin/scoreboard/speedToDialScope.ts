/**
 * Row visibility for the speed-to-dial panel. Kept apart from the panel itself
 * so the rule can be checked without mounting the dashboard.
 */

/**
 * Keep only the rows belonging to agents who are allowed to see them. A sales
 * agent's set is their own id only; management's is null (everyone) or the one
 * person the scoreboard is focused on.
 */
export function filterStatsByAgent<T extends { ownerAgentId: string | null }>(
  stats: T[],
  visibleIds: Set<string> | null
): T[] {
  if (!visibleIds) return stats;
  return stats.filter(s => s.ownerAgentId != null && visibleIds.has(s.ownerAgentId));
}
