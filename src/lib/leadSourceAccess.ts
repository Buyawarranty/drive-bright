/** The protected scoped grant is authoritative; legacy tab flags do not confer source access. */
export function canDisplayLeadSource(granted: boolean): boolean {
  return granted === true;
}