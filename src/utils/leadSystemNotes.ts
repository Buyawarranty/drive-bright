import { supabase } from '@/integrations/supabase/client';

/**
 * Inserts a timestamped, attributed system note into lead_quick_notes (or abandoned_carts.contact_notes).
 * Returns whether the database confirmed the save.
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

    // Resolve author name — if no adminUserId provided, try to get current user
    let authorLabel = '🤖 System';
    let resolvedAdminId = adminUserId;
    
    if (!resolvedAdminId) {
      // Try to resolve from current auth session
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: adminUser } = await supabase
          .from('admin_users')
          .select('id, first_name, email')
          .eq('user_id', user.id)
          .maybeSingle();
        if (adminUser) {
          resolvedAdminId = adminUser.id;
          authorLabel = adminUser.first_name || adminUser.email?.split('@')[0] || 'Agent';
        }
      }
    } else {
      const { data: adminUser } = await supabase
        .from('admin_users')
        .select('first_name, email')
        .eq('id', resolvedAdminId)
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

      const { error } = await supabase
        .from('abandoned_carts')
        .update({ contact_notes: updated, updated_at: new Date().toISOString() })
        .eq('id', actualId);
      if (error) throw error;
    } else {
      const { data, error } = await (supabase.rpc as any)('save_lead_quick_note', {
        p_lead_id: actualId,
        p_note_text: formattedNote,
      });
      if (error) throw error;
      if (!data?.id) throw new Error('System note was not confirmed as saved');
    }
    return true;
  } catch (err) {
    console.warn('[addSystemNote] Failed to write system note:', err);
    return false;
  }
};
