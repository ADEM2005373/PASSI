import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export const dynamic = 'force-dynamic';

/**
 * POST /api/scanner/validate-entry
 * Endpoint for gate scanners to validate entry tokens for Quick Passes.
 * Input: { token: entry_token }
 * If is_entry_used === true: Return 409 Conflict ("Ce pass d'entrée a déjà été utilisé").
 * If valid: Set is_entry_used = true, entry_used_at = new Date(), return 200 OK.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const rawToken = body?.token || body?.entry_token || body?.qrUuid;

    if (!rawToken || typeof rawToken !== 'string' || !rawToken.trim()) {
      return NextResponse.json(
        { success: false, message: "Token d'entrée manquant ou invalide." },
        { status: 400 }
      );
    }

    const cleanToken = rawToken.trim();

    // 1. Query pass matching entry_token (or entry_qr_uuid / id as fallback)
    let pass: any = null;

    try {
      const { data: pToken, error: tokenErr } = await supabaseAdmin
        .from('passes')
        .select('*, events(title, date)')
        .eq('entry_token', cleanToken)
        .maybeSingle();

      if (!tokenErr && pToken) {
        pass = pToken;
      }
    } catch (e) {
      // Column might not exist in unmigrated schema
    }

    if (!pass) {
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanToken);
      if (isUUID) {
        const { data: fallbackPass } = await supabaseAdmin
          .from('passes')
          .select('*, events(title, date)')
          .or(`entry_qr_uuid.eq.${cleanToken},id.eq.${cleanToken}`)
          .maybeSingle();

        pass = fallbackPass;
      }
    }

    if (!pass) {
      return NextResponse.json(
        { success: false, message: 'Pass introuvable ou QR code invalide.' },
        { status: 404 }
      );
    }

    // 2. Check if already used
    if (pass.is_entry_used === true || pass.entry_status === 'scanned') {
      return NextResponse.json(
        {
          success: false,
          message: "Ce pass d'entrée a déjà été utilisé",
          entry_used_at: pass.entry_used_at,
        },
        { status: 409 }
      );
    }

    // 3. Check if pass is pending admin approval, unpaid or expired
    if (pass.entry_status === 'pending' || pass.status === 'pending' || pass.status === 'PENDING') {
      return NextResponse.json(
        {
          success: false,
          message: "Pass non valide : en attente d'approbation préalable par un administrateur.",
        },
        { status: 403 }
      );
    }

    if (pass.entry_status === 'awaiting_payment' || pass.status === 'PENDING_PAYMENT') {
      return NextResponse.json(
        {
          success: false,
          message: 'Pass non réglé : en attente de paiement au point de vente physique.',
        },
        { status: 403 }
      );
    }

    if (pass.entry_status === 'rejected' || pass.status === 'EXPIRED' || pass.status === 'CANCELLED') {
      return NextResponse.json(
        {
          success: false,
          message: 'Pass expiré, rejeté ou annulé.',
        },
        { status: 403 }
      );
    }

    const now = new Date().toISOString();

    // 4. Update pass status to used with schema resilience
    const updatePayload: Record<string, any> = {
      is_entry_used: true,
      entry_used_at: now,
      entry_status: 'scanned',
      updated_at: now,
    };

    for (let attempt = 0; attempt < 5; attempt++) {
      const { error: updateErr } = await supabaseAdmin
        .from('passes')
        .update(updatePayload)
        .eq('id', pass.id);

      if (!updateErr) break;
      const colMatch = (updateErr?.message || '').match(/Could not find the '([^']+)' column/i);
      if (colMatch && colMatch[1]) {
        delete updatePayload[colMatch[1]];
      } else {
        break;
      }
    }

    const guestName = [pass.guest_first_name, pass.guest_last_name].filter(Boolean).join(' ') || 'Invité';
    const eventTitle = (pass.events as any)?.title || 'Événement Passi';

    return NextResponse.json({
      success: true,
      message: 'Entrée validée avec succès.',
      pass: {
        id: pass.id,
        reservationCode: pass.reservation_code,
        guestName,
        eventTitle,
        is_entry_used: true,
        entry_used_at: now,
      },
    });
  } catch (error: any) {
    console.error('Error validating entry token:', error);
    return NextResponse.json(
      { success: false, message: 'Erreur interne du serveur lors de la validation.' },
      { status: 500 }
    );
  }
}
