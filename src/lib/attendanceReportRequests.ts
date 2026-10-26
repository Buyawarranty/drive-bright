// Single-flight per selected range, not across unrelated date selections.
export class AttendanceReportRequests {
  private activeKey = '';
  private pending = new Map<string, symbol>();
  select(key: string) { this.activeKey = key; }
  begin(key: string): symbol | undefined {
    if (this.pending.has(key)) return undefined;
    const ticket = Symbol(key);
    this.pending.set(key, ticket);
    return ticket;
  }
  isCurrent(key: string, ticket: symbol) { return this.activeKey === key && this.pending.get(key) === ticket; }
  finish(key: string, ticket: symbol) { if (this.pending.get(key) === ticket) this.pending.delete(key); }
}