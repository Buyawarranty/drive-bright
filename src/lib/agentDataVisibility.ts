/**
 * "See all sales agents data" rule (Lead Allocation switch, default OFF).
 *
 * Sales agents and sales leads only ever see their OWN name on their OWN
 * deals in Customer Management. Every other agent's name is hidden unless
 * management turns the per-agent switch on. Management roles
 * (admin / super_admin / sales_manager) always see everything.
 */
export const shouldHideOtherAgentNames = (
  role: string | null | undefined,
  canSeeAllAgentData: boolean,
): boolean => {
  const r = (role || '').trim().toLowerCase();
  const isSalesScoped = r === 'sales' || r === 'sales_lead';
  return isSalesScoped && !canSeeAllAgentData;
};

/**
 * Label for the agent who made a deal. Returns 'Sales agent' (no name, no
 * email) when the viewer may not see other agents' names and the deal belongs
 * to someone else. Own deals and management always show the real name.
 */
export const dealOwnerLabel = (
  hideOtherAgentNames: boolean,
  ownerId: string | null | undefined,
  viewerAdminId: string | null | undefined,
  realName: string,
): string => {
  if (hideOtherAgentNames && ownerId && ownerId !== viewerAdminId) return 'Sales agent';
  return realName;
};
