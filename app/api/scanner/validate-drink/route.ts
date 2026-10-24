import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export const dynamic = 'force-dynamic';

/**
 * POST /api/scanner/validate-drink
 * Endpoint for bar scanners to validate drink voucher tokens for Quick Passes.
 * Input: { token: drink_token }
 * If is_drink_used === true: Return 409 Conflict ("Boisson déjà récupérée").
 * If valid: Set is_drink_used = true, drink_used_at = new Date(), return 200 OK.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const rawToken = body?.token || body?.drink_token || body?.qrUuid;

    if (!rawToken || typeof rawToken !== 'string' || !rawToken.trim()) {
      return NextResponse.json(
        { success: false, message: 'Token de boisson manquant ou invalide.' },
        { status: 400 }
      );
    }

    const cleanToken = rawToken.trim();

    // 1. Query pass matching drink_token (or drink_qr_uuid or drink_qr_code)
    let { data: pass, error: fetchErr } = await supabaseAdmin
      .from('passes')
      .select('id, entry_status, drink_status, status, is_drink_used, drink_used_at, selected_drink, drink_name, selected_aromas, guest_first_name, guest_last_name, reservation_code, events(title)')
      .eq('drink_token', cleanToken)
      .maybeSingle();

    if (!pass) {
      const { data: fallbackPass } = await supabaseAdmin
        .from('passes')
        .select('id, entry_status, drink_status, status, is_drink_used, drink_used_at, selected_drink, drink_name, selected_aromas, guest_first_name, guest_last_name, reservation_code, events(title)')
        .or(`drink_qr_uuid.eq.${cleanToken},drink_qr_code.eq.${cleanToken}`)
        .maybeSingle();

      pass = fallbackPass;
    }

    if (!pass) {
      return NextResponse.json(
        { success: false, message: 'Voucher boisson introuvable ou QR code invalide.' },
        { status: 404 }
      );
    }

    // 2. Check if already claimed
    if (pass.is_drink_used === true || pass.drink_status === 'scanned') {
      return NextResponse.json(
        {
          success: false,
          message: 'Boisson déjà récupérée',
          drink_used_at: pass.drink_used_at,
        },
        { status: 409 }
      );
    }

    // 3. Check if pass is paid/activated
    if (pass.entry_status === 'awaiting_payment' || pass.status === 'PENDING_PAYMENT') {
      return NextResponse.json(
        {
          success: false,
          message: 'Pass non réglé : en attente de paiement au point de vente physique.',
        },
        { status: 403 }
      );
    }

    const now = new Date().toISOString();

    // 4. Update drink status to claimed
    const { error: updateErr } = await supabaseAdmin
      .from('passes')
      .update({
        is_drink_used: true,
        drink_used_at: now,
        drink_status: 'scanned',
        updated_at: now,
      })
      .eq('id', pass.id);

    if (updateErr) {
      // Fallback if is_drink_used column is missing
      await supabaseAdmin
        .from('passes')
        .update({
          drink_status: 'scanned',
          updated_at: now,
        })
        .eq('id', pass.id);
    }

    const drinkName = pass.selected_drink || pass.drink_name || 'Boisson standard';
    const guestName = [pass.guest_first_name, pass.guest_last_name].filter(Boolean).join(' ') || 'Invité';

    return NextResponse.json({
      success: true,
      message: 'Boisson validée avec succès.',
      drink: {
        name: drinkName,
        selectedAromas: pass.selected_aromas || [],
      },
      pass: {
        id: pass.id,
        reservationCode: pass.reservation_code,
        guestName,
        is_drink_used: true,
        drink_used_at: now,
      },
    });
  } catch (error: any) {
    console.error('Error validating drink token:', error);
    return NextResponse.json(
      { success: false, message: 'Erreur interne du serveur lors de la validation boisson.' },
      { status: 500 }
    );
  }
}
