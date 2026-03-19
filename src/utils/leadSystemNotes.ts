import { supabase } from '@/integrations/supabase/client';

/**
 * Inserts a timestamped, attributed system note into lead_quick_notes (or abandoned_carts.contact_notes).
 * Fire-and-forget — errors are logged but never thrown.
 */
export const addSystemNote = async (
  leadId: string,
  noteText: string,
  adminUserId?: string | null
) => {
  try {
    const isAbandonedCart = leadId.startsWith('cart_');
    const actualId = isAbandonedCart ? leadId.replace('cart_', '') : leadId;

    const timestamp = new Date().toLocaleString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });

    // Resolve author name
    let authorLabel = '🤖 System';
    if (adminUserId) {
      const { data: adminUser } = await supabase
        .from('admin_users')
        .select('first_name, email')
        .eq('id', adminUserId)
        .maybeSingle();
      if (adminUser) {
        authorLabel = adminUser.first_name || adminUser.email?.split('@')[0] || 'Agent';
      }
    }

    const formattedNote = `[${timestamp} — ${authorLabel}] ${noteText}`;

    if (isAbandonedCart) {
      // Append to abandoned_carts.contact_notes (text column)
      const { data: cart } = await supabase
        .from('abandoned_carts')
        .select('contact_notes')
        .eq('id', actualId)
        .maybeSingle();

      const existing = cart?.contact_notes || '';
      const updated = existing ? `${existing}\n\n${formattedNote}` : formattedNote;

      await supabase
        .from('abandoned_carts')
        .update({ contact_notes: updated, updated_at: new Date().toISOString() })
        .eq('id', actualId);
    } else {
      // Insert into lead_quick_notes
      await supabase
        .from('lead_quick_notes')
        .insert({
          lead_id: actualId,
          note_text: formattedNote,
          created_by: adminUserId || '00000000-0000-0000-0000-000000000000',
          is_pinned: false,
        });
    }
  } catch (err) {
    console.warn('[addSystemNote] Failed to write system note:', err);
  }
};
