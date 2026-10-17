import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';
import { approvePassPaymentAction } from '@/lib/actions/pass-lifecycle';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { passId } = body || {};

    if (!passId || typeof passId !== 'string') {
      return NextResponse.json({ error: 'Identifiant de pass manquant ou invalide' }, { status: 400 });
    }

    // 1. Authenticate user session dynamically
    const supabase = await createServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Non authentifié : veuillez vous reconnecter." }, { status: 401 });
    }

    // 2. Check profile with auto-recovery to prevent "Profil utilisateur introuvable"
    let { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('id, role, is_suspended, full_name, email')
      .eq('id', user.id)
      .maybeSingle();

    if (!profile) {
      console.warn(`[payment-point/approve] Profil manquant pour ${user.email} (${user.id}), auto-création...`);
      const meta = user.user_metadata || {};
      const isStaff = user.email?.includes('passi.com');
      const inferredRole = (meta.role || (isStaff ? 'admin' : 'payment_point')).toLowerCase();
      const fullName = meta.full_name || [meta.first_name, meta.last_name].filter(Boolean).join(' ') || (user.email ? user.email.split('@')[0] : 'Caissier');

      const { data: newProfile, error: profileInsertError } = await supabaseAdmin
        .from('profiles')
        .upsert({
          id: user.id,
          email: user.email || '',
          full_name: fullName,
          role: inferredRole === 'admin' ? 'admin' : 'payment_point',
          is_suspended: false,
        }, { onConflict: 'id' })
        .select('id, role, is_suspended, full_name, email')
        .maybeSingle();

      if (profileInsertError) {
        console.error('[payment-point/approve] Erreur auto-création profil:', profileInsertError);
      } else {
        profile = newProfile;
      }
    }

    if (!profile) {
      return NextResponse.json({ error: "Profil utilisateur introuvable. Veuillez recharger la page." }, { status: 404 });
    }

    if (profile.is_suspended) {
      return NextResponse.json({ error: "Compte suspendu. Veuillez contacter un administrateur." }, { status: 403 });
    }

    const role = (profile.role || '').toLowerCase();
    if (!['payment_point', 'admin'].includes(role)) {
      return NextResponse.json({ error: "Droits insuffisants pour approuver le paiement." }, { status: 403 });
    }

    // 3. Execute payment approval action
    const result = await approvePassPaymentAction(passId);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Server error in payment-point approve:', error);
    const status = error.message?.includes('non autorisée') || error.message?.includes('Droits insuffisants')
      ? 403 
      : error.message?.includes('Pass introuvable')
      ? 404
      : 500;
    return NextResponse.json({ error: error.message || 'Une erreur interne est survenue' }, { status });
  }
}

