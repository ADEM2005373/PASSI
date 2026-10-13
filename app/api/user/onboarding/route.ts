import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';

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
    const { instagramHandle } = body || {};

    if (!instagramHandle || typeof instagramHandle !== 'string') {
      return NextResponse.json({ error: 'Identifiant Instagram requis' }, { status: 400 });
    }

    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({
        instagram_handle: instagramHandle.trim(),
      })
      .eq('id', user.id);

    if (updateError) {
      console.error('[api/user/onboarding] Erreur mise à jour profil:', updateError);
      return NextResponse.json({ error: "Impossible d'enregistrer le profil" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[api/user/onboarding] Erreur interne:', err);
    return NextResponse.json({ error: 'Erreur interne du serveur' }, { status: 500 });
  }
}
