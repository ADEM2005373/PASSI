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
      .select('*')
      .eq('id', passId)
      .single();

    if (fetchError || !pass) {
      return NextResponse.json({ error: 'Pass introuvable' }, { status: 404 });
    }

    // Strict Security Guard: Only passes pre-approved by admin ('awaiting_payment' / 'PENDING_PAYMENT')
    // can be validated for payment at the payment point. Passes in 'pending', 'rejected', or 'activated'/'scanned' are forbidden.
    const isPreApproved = pass.entry_status === 'awaiting_payment' || (pass as any).status === 'PENDING_PAYMENT';
    if (!isPreApproved) {
      return NextResponse.json({ 
        error: `Ce pass ne peut pas être encaissé (statut actuel: ${pass.entry_status || (pass as any).status}). Seuls les pass pré-approuvés par l'administrateur en attente de paiement peuvent être validés au guichet.` 
      }, { status: 400 });
    }

    // 2. Generate entry QR UUID if missing so the pass is instantly scannable
    const entryQr = pass.entry_qr_uuid || crypto.randomUUID();
    const now = new Date().toISOString();

    const updatePayload: any = {
      entry_status: 'activated',
      payment_point_id: user.id,
      payment_approved_at: now,
      entry_qr_uuid: entryQr,
      updated_at: now,
    };

    // If the pass has an associated drink, activate it and generate drink QR code
    if ((pass as any).drink_name || (pass as any).drink_id) {
      const drinkQr = pass.drink_qr_uuid || crypto.randomUUID();
      updatePayload.drink_status = 'activated';
      updatePayload.drink_qr_uuid = drinkQr;
      updatePayload.drink_qr_code = drinkQr;
    }

    // 3. Update the pass to activated with payment approval metadata
    const { data: updatedPass, error: updateError } = await supabaseAdmin
      .from('passes')
      .update(updatePayload)
      .eq('id', passId)
      .select('id, entry_status, final_price, payment_point_id, payment_approved_at, drink_id, drink_name, drink_status, drink_qr_uuid, drink_qr_code')
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
