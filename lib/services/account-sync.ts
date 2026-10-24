import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export interface AccountSyncResult {
  success: boolean;
  linkedCount: number;
  passIds: string[];
  error?: string;
}

/**
 * Links all previously created guest passes (where user_id IS NULL or unassigned)
 * matching the given user's email to their newly created/logged-in profile ID.
 */
export async function linkGuestPassesToUser(
  userId: string, 
  email: string
): Promise<AccountSyncResult> {
  if (!userId || !email) {
    return { success: false, linkedCount: 0, passIds: [] };
  }

  const cleanEmail = email.trim().toLowerCase();

  try {
    // 1. Find all passes matching this email with no user_id (or guest passes)
    const { data: matchedPasses, error: findError } = await supabaseAdmin
      .from('passes')
      .select('id, email, guest_email, user_id, reservation_code, status, entry_status')
      .or(`email.ilike.${cleanEmail},guest_email.ilike.${cleanEmail}`)
      .is('user_id', null);

    if (findError) {
      console.warn('[AccountSync] Error finding unlinked guest passes:', findError.message);
    }

    const idsToLink = (matchedPasses || []).map((p: any) => p.id);

    if (idsToLink.length === 0) {
      // Also check if any passes have matching email but mismatched user_id (defense)
      const { data: fallbackMatches } = await supabaseAdmin
        .from('passes')
        .select('id')
        .ilike('email', cleanEmail)
        .is('user_id', null);

      if (fallbackMatches && fallbackMatches.length > 0) {
        fallbackMatches.forEach((p: any) => idsToLink.push(p.id));
      }
    }

    if (idsToLink.length === 0) {
      return { success: true, linkedCount: 0, passIds: [] };
    }

    // 2. Link all found passes to the new user_id
    const { data: updatedPasses, error: updateError } = await supabaseAdmin
      .from('passes')
      .update({
        user_id: userId,
        updated_at: new Date().toISOString(),
      })
      .in('id', idsToLink)
      .select('id');

    if (updateError) {
      console.error('[AccountSync] Failed to link passes to user:', updateError);
      return { success: false, linkedCount: 0, passIds: [], error: updateError.message };
    }

    const count = updatedPasses?.length || idsToLink.length;
    console.log(`[AccountSync] Successfully linked ${count} guest pass(es) to user ${userId} (${cleanEmail})`);

    return {
      success: true,
      linkedCount: count,
      passIds: (updatedPasses || []).map((p: any) => p.id),
    };
  } catch (err: any) {
    console.error('[AccountSync] Uncaught error during pass linking:', err);
    return { success: false, linkedCount: 0, passIds: [], error: err?.message };
  }
}
