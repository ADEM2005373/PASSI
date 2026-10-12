import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireRole } from '@/lib/supabase/api-security';
import crypto from 'crypto';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(req: NextRequest) {
  const { error: authError, user } = await requireRole(['payment_point', 'admin']);
  if (authError || !user) return authError;

  try {
    const body = await req.json();
    const { passId } = body || {};

    if (!passId || typeof passId !== 'string') {
      return NextResponse.json({ error: 'Identifiant de pass manquant ou invalide' }, { status: 400 });
    }

    // 1. Fetch the pass to verify its existence and status
    const { data: pass, error: fetchError } = await supabaseAdmin
      .from('passes')
      .select('id, entry_status, event_id, user_id, final_price, entry_qr_uuid')
      .eq('id', passId)
      .single();

    if (fetchError || !pass) {
      return NextResponse.json({ error: 'Pass introuvable' }, { status: 404 });
    }

    if (pass.entry_status !== 'awaiting_payment' && pass.entry_status !== 'pending') {
      return NextResponse.json({ 
        error: `Ce pass a déjà été traité (statut actuel: ${pass.entry_status})` 
      }, { status: 400 });
    }

    // 2. Generate entry QR UUID if missing so the pass is instantly scannable
    const entryQr = pass.entry_qr_uuid || crypto.randomUUID();
    const now = new Date().toISOString();

    // 3. Update the pass to activated with payment approval metadata
    const { data: updatedPass, error: updateError } = await supabaseAdmin
      .from('passes')
      .update({
        entry_status: 'activated',
        payment_point_id: user.id,
        payment_approved_at: now,
        entry_qr_uuid: entryQr,
        updated_at: now,
      })
      .eq('id', passId)
      .select('id, entry_status, final_price, payment_point_id, payment_approved_at')
      .single();

    if (updateError) {
      console.error('Error approving pass payment:', updateError);
      return NextResponse.json({ error: "Échec de l'approbation du paiement" }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      pass: updatedPass,
      message: 'Paiement approuvé avec succès. Le pass est désormais activé.'
    });

  } catch (error: any) {
    console.error('Server error in payment-point approve:', error);
    return NextResponse.json({ error: 'Une erreur interne est survenue' }, { status: 500 });
  }
}
