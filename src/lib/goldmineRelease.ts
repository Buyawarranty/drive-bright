export const GOLDMINE_RELEASE_MAX = 100;

export const canReleaseGoldmineLeads = (role: string | null | undefined) =>
  role === 'admin' || role === 'super_admin';

export const isValidGoldmineRelease = (count: number) =>
  Number.isInteger(count) && count >= 1 && count <= GOLDMINE_RELEASE_MAX;