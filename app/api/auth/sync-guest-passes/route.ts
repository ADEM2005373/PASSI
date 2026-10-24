import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { linkGuestPassesToUser } from '@/lib/services/account-sync';

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user || !user.email) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const result = await linkGuestPassesToUser(user.id, user.email);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[api/auth/sync-guest-passes] Error:', error);
    return NextResponse.json({ error: error.message || 'Erreur interne' }, { status: 500 });
  }
}
