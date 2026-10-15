import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireRole } from '@/lib/supabase/api-security';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(req: NextRequest) {
  const { error: authError } = await requireRole(['admin']);
  if (authError) return authError;

  try {
    const body = await req.json();
    const { 
      userId, 
      eventId, 
      passType,
      status, 
      guestFirstName, 
      guestLastName,
      drink_name,
      drinkName,
      selected_aromas,
      selectedAromas
    } = body || {};

    if (!userId || !eventId) {
      return NextResponse.json(
        { error: 'L\'utilisateur cible et l\'événement sont obligatoires.' }, 
        { status: 400 }
      );
    }

    const rawType = String(passType || status || 'NORMAL').toUpperCase().trim();
    const normalizedPassType = rawType === 'CADEAU' 
      ? 'GIFT' 
      : ['NORMAL', 'GIFT', 'INVITATION', 'VIP'].includes(rawType) 
        ? rawType 
        : 'NORMAL';

    // 1. Fetch target user profile
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, email, instagram_handle, full_name')
      .eq('id', userId)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Utilisateur introuvable.' }, { status: 404 });
    }

    // 2. Fetch event details
    const { data: event, error: eventError } = await supabaseAdmin
      .from('events')
      .select('id, title, base_price, date')
      .eq('id', eventId)
      .single();

    if (eventError || !event) {
      return NextResponse.json({ error: 'Événement introuvable.' }, { status: 404 });
    }

    // 3. Determine status and QR logic based on passType
    let entryStatus: 'pending' | 'awaiting_payment' | 'activated' = 'pending';
    let entryQrUuid: string | null = null;
    let invitationStatus: 'PENDING' | 'ACCEPTED' | 'DECLINED' | null = null;
    let finalPrice = event.base_price ?? 0;

    if (normalizedPassType === 'GIFT' || normalizedPassType === 'VIP') {
      // Gift & VIP are instantly active, paid (free), and QR generated immediately
      entryStatus = 'activated';
      entryQrUuid = crypto.randomUUID();
      finalPrice = 0;
      invitationStatus = null;
    } else if (normalizedPassType === 'INVITATION') {
      // Invitation is pending until user accepts on dashboard
      entryStatus = 'pending';
      entryQrUuid = null;
      finalPrice = 0;
      invitationStatus = 'PENDING';
    } else {
      // NORMAL pass
      entryStatus = 'pending';
      entryQrUuid = null;
      finalPrice = event.base_price ?? 0;
      invitationStatus = null;
    }

    // 4. Resolve Drink & Aromas
    const resolvedDrinkName = (drink_name || drinkName || '').trim() || null;
    const rawAromas = selected_aromas || selectedAromas || [];
    const formattedAromas: string[] = Array.isArray(rawAromas)
      ? rawAromas.filter((a: any) => typeof a === 'string' && a.trim().length > 0).map((a: string) => a.trim())
      : [];

    let drinkStatus: 'activated' | 'pending' | null = null;
    let drinkQrUuid: string | null = null;

    if (resolvedDrinkName) {
      if (normalizedPassType === 'GIFT' || normalizedPassType === 'VIP') {
        // Special passes get instantly activated drink with QR code
        drinkStatus = 'activated';
        drinkQrUuid = crypto.randomUUID();
      } else {
        // Normal/Invitation passes await entry activation / acceptance
        drinkStatus = 'pending';
        drinkQrUuid = null;
      }
    }

    // Determine guest first/last names
    const resolvedFirstName = guestFirstName?.trim() 
      || (profile.full_name ? profile.full_name.split(' ')[0] : (profile.instagram_handle || 'Invité'));
    const resolvedLastName = guestLastName?.trim() 
      || (profile.full_name && profile.full_name.split(' ').length > 1 ? profile.full_name.split(' ').slice(1).join(' ') : '');

    // 5. Insert pass with drink_name and selected_aromas
    const insertPayload: Record<string, any> = {
      user_id: userId,
      event_id: eventId,
      guest_first_name: resolvedFirstName,
      guest_last_name: resolvedLastName,
      pass_type: normalizedPassType,
      invitation_status: invitationStatus,
      entry_status: entryStatus,
      entry_qr_uuid: entryQrUuid,
      final_price: finalPrice,
      drink_name: resolvedDrinkName,
      drink_id: resolvedDrinkName,
      selected_aromas: formattedAromas,
      drink_status: drinkStatus,
      drink_qr_uuid: drinkQrUuid,
      drink_qr_code: drinkQrUuid,
    };

    let { data: newPass, error: insertError } = await supabaseAdmin
      .from('passes')
      .insert(insertPayload)
      .select('*, events(title, date, location)')
      .single();

    if (insertError) {
      console.warn('Initial pass insert failed, retrying without drink_qr_code:', insertError);
      delete insertPayload.drink_qr_code;
      const { data: retryPass, error: retryError } = await supabaseAdmin
        .from('passes')
        .insert(insertPayload)
        .select('*, events(title, date, location)')
        .single();

      if (retryError) {
        console.error('Error creating manual pass:', retryError);
        return NextResponse.json(
          { error: 'Erreur lors de la création du pass: ' + retryError.message }, 
          { status: 500 }
        );
      }
      newPass = retryPass;
    }

    return NextResponse.json({
      success: true,
      message: `Pass ${normalizedPassType} créé avec succès pour ${profile.email}.`,
      pass: newPass,
    });
  } catch (err: any) {
    console.error('Manual pass creation error:', err);
    return NextResponse.json(
      { error: err.message || 'Erreur interne du serveur' }, 
      { status: 500 }
    );
  }
}
