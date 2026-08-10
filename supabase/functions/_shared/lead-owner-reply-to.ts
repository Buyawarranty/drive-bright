// Maps marketing-email recipients to the sales agent who owns their lead, so
// any customer reply (including "unsubscribe me") also lands in that agent's inbox.
// Purely additive: if no owner is found, callers keep their existing reply_to list.

export async function getLeadOwnerEmails(
  supabase: any,
  emails: string[],
): Promise<Record<string, string>> {
  const map: Record<string, string> = {};
  const lower = Array.from(new Set(emails.map((e) => e.trim().toLowerCase()).filter(Boolean)));
  if (lower.length === 0) return map;

  try {
    const { data: leads, error } = await supabase
      .from('sales_leads')
      .select('email, assigned_to, created_at')
      .in('email', lower)
      .not('assigned_to', 'is', null)
      .order('created_at', { ascending: false });
    if (error || !leads?.length) return map;

    const ownerIds = Array.from(new Set(leads.map((l: any) => l.assigned_to).filter(Boolean)));
    const { data: admins } = await supabase
      .from('admin_users')
      .select('id, email')
      .in('id', ownerIds);

    const adminEmailById = new Map<string, string>();
    (admins || []).forEach((a: any) => {
      if (a?.email) adminEmailById.set(a.id, String(a.email).trim());
    });

    // Most recent lead wins (list is ordered newest first).
    for (const lead of leads) {
      const key = String(lead.email || '').trim().toLowerCase();
      if (!key || map[key]) continue;
      const agentEmail = adminEmailById.get(lead.assigned_to);
      if (agentEmail) map[key] = agentEmail;
    }
  } catch (e) {
    console.error('getLeadOwnerEmails failed (continuing without agent CC):', e);
  }

  return map;
}

/** Adds the owning agent to a reply_to list without duplicating addresses. */
export function withLeadOwnerReplyTo(baseReplyTo: string[], agentEmail?: string): string[] {
  if (!agentEmail) return baseReplyTo;
  const seen = new Set(baseReplyTo.map((e) => e.toLowerCase()));
  return seen.has(agentEmail.toLowerCase()) ? baseReplyTo : [...baseReplyTo, agentEmail];
}
