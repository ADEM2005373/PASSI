import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';
import { getOrCreateProfile } from '@/lib/supabase/profile-guard';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const body = await req.json();
    const { instagramHandle, instagramUrl, firstName, lastName, fullName } = body || {};

    const rawHandle = (instagramHandle || instagramUrl || '').trim();
    if (!rawHandle) {
      return NextResponse.json({ error: 'Profil ou identifiant Instagram requis' }, { status: 400 });
    }

    // Defensive Guard: Ensure profile row exists before updating
    await getOrCreateProfile(user);

    const resolvedFirstName = (firstName || '').trim();
    const resolvedLastName = (lastName || '').trim();
    const resolvedFullName = (fullName || [resolvedFirstName, resolvedLastName].filter(Boolean).join(' ') || '').trim();

    const updatePayload: Record<string, any> = {
      instagram_handle: rawHandle,
      ...(resolvedFullName && { full_name: resolvedFullName }),
      ...(resolvedFirstName && { first_name: resolvedFirstName }),
      ...(resolvedLastName && { last_name: resolvedLastName }),
    };

    let { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update(updatePayload)
      .eq('id', user.id);

    // If first_name or last_name columns are not yet in the DB table, retry without them
    if (updateError && (updateError.message?.includes('first_name') || updateError.message?.includes('last_name'))) {
      delete updatePayload.first_name;
      delete updatePayload.last_name;
      const retryResult = await supabaseAdmin
        .from('profiles')
        .update(updatePayload)
        .eq('id', user.id);
      updateError = retryResult.error;
    }

    if (updateError) {
      console.error('[api/user/onboarding] Erreur mise à jour profil:', updateError);
      return NextResponse.json({ error: "Impossible d'enregistrer le profil: " + updateError.message }, { status: 500 });
    }

    // Sync Auth metadata as well
    try {
      await supabaseAdmin.auth.admin.updateUserById(user.id, {
        user_metadata: {
          ...user.user_metadata,
          ...(resolvedFirstName && { first_name: resolvedFirstName }),
          ...(resolvedLastName && { last_name: resolvedLastName }),
          ...(resolvedFullName && { full_name: resolvedFullName }),
          instagram: rawHandle,
          instagram_handle: rawHandle,
        }
      });
    } catch (metaErr) {
      console.warn('[api/user/onboarding] Auth metadata sync warning:', metaErr);
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[api/user/onboarding] Erreur interne:', err);
    return NextResponse.json({ error: err.message || 'Erreur interne du serveur' }, { status: 500 });
  }
}
