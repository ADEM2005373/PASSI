import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';
import { approvePassPaymentAction } from '@/lib/actions/pass-lifecycle';
import { getOrCreateProfile, normalizeRole } from '@/lib/supabase/profile-guard';

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

    // 2. Check profile with standardized defensive auto-recovery
    const { profile } = await getOrCreateProfile(user, { defaultRole: 'payment_point' });

    if (!profile) {
      return NextResponse.json({ error: "Profil utilisateur introuvable. Veuillez recharger la page." }, { status: 500 });
    }

    if (profile.is_suspended) {
      return NextResponse.json({ error: "Compte suspendu. Veuillez contacter un administrateur." }, { status: 403 });
    }

    const role = normalizeRole(profile.role);
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

