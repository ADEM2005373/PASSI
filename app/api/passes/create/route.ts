import { NextRequest, NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '@/lib/supabase/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createAdminClient(supabaseUrl, supabaseServiceKey);

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { eventId, drinkName, aromas, promoCode } = body;

    if (!eventId) {
      return NextResponse.json(
        { error: 'ID de l\'événement requis.' },
        { status: 400 }
      );
    }

    // 1. Fetch user profile
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('id, first_name, last_name, full_name, instagram_handle')
      .eq('id', user.id)
      .maybeSingle();

    const meta = user.user_metadata || {};
    const firstName = (
      profile?.first_name ||
      meta.first_name ||
      (profile?.full_name ? profile.full_name.split(' ')[0] : '') ||
      (user.email ? user.email.split('@')[0] : 'Invité')
    ).trim() || 'Invité';

    const lastName = (
      profile?.last_name ||
      meta.last_name ||
      (profile?.full_name && profile.full_name.split(' ').length > 1
        ? profile.full_name.split(' ').slice(1).join(' ')
        : '')
    ).trim();

    // 2. Fetch event details & check capacity / limit
    const { data: event, error: eventError } = await supabaseAdmin
      .from('events')
      .select('id, title, max_passes_per_user, base_price')
      .eq('id', eventId)
      .single();

    if (eventError || !event) {
      return NextResponse.json(
        { error: 'Événement introuvable.' },
        { status: 404 }
      );
    }

    // Check existing passes for this user on this event
    const { data: existingPasses } = await supabaseAdmin
      .from('passes')
      .select('id')
      .eq('user_id', user.id)
      .eq('event_id', eventId);

    const maxAllowed = event.max_passes_per_user || 5;
    if (existingPasses && existingPasses.length >= maxAllowed) {
      return NextResponse.json(
        { error: `Limite de ${maxAllowed} pass atteinte pour cet événement.` },
        { status: 400 }
      );
    }

    // 3. Format inputs
    const formattedAromas: string[] = Array.isArray(aromas)
      ? aromas.filter((a: any) => typeof a === 'string' && a.trim().length > 0)
      : typeof aromas === 'string' && aromas.trim().length > 0
      ? [aromas.trim()]
      : [];

    const cleanDrinkName = (drinkName && typeof drinkName === 'string')
      ? drinkName.trim()
      : null;

    const cleanPromoCode = (promoCode && typeof promoCode === 'string')
      ? promoCode.trim()
      : null;

    // 4. Create pass via RPC with fallbacks matching api.bookPasses
    // Try primary RPC: create_pass_with_pricing
    const { data: rpcData, error: rpcError } = await supabaseAdmin.rpc('create_pass_with_pricing', {
      p_user_id: user.id,
      p_event_id: eventId,
      p_guest_first_name: firstName,
      p_guest_last_name: lastName,
      p_drink_name: cleanDrinkName,
      p_promo_code: cleanPromoCode,
      p_selected_aromas: formattedAromas,
    });

    if (!rpcError) {
      return NextResponse.json({
        success: true,
        message: 'Pass créé avec succès',
        pass: rpcData,
      });
    }

    console.warn('[passes/create] create_pass_with_pricing with aromas failed, trying without aromas:', rpcError);

    // Fallback 2: create_pass_with_pricing without p_selected_aromas
    const { data: retryData, error: retryError } = await supabaseAdmin.rpc('create_pass_with_pricing', {
      p_user_id: user.id,
      p_event_id: eventId,
      p_guest_first_name: firstName,
      p_guest_last_name: lastName,
      p_drink_name: cleanDrinkName,
      p_promo_code: cleanPromoCode,
    });

    if (!retryError) {
      return NextResponse.json({
        success: true,
        message: 'Pass créé avec succès',
        pass: retryData,
      });
    }

    console.warn('[passes/create] create_pass_with_pricing failed, trying legacy create_pass:', retryError);

    // Fallback 3: legacy create_pass RPC
    const { data: legacyData, error: legacyError } = await supabaseAdmin.rpc('create_pass', {
      p_user_id: user.id,
      p_event_id: eventId,
      p_guest_first_name: firstName,
      p_guest_last_name: lastName,
      p_drink_name: cleanDrinkName,
    });

    if (!legacyError) {
      return NextResponse.json({
        success: true,
        message: 'Pass créé avec succès',
        pass: legacyData,
      });
    }

    console.warn('[passes/create] create_pass failed, attempting direct table insert:', legacyError);

    // Fallback 4: Direct insert into passes table
    const { data: insertedPass, error: directInsertError } = await supabaseAdmin
      .from('passes')
      .insert({
        user_id: user.id,
        event_id: eventId,
        guest_first_name: firstName,
        guest_last_name: lastName,
        drink_name: cleanDrinkName,
        selected_aromas: formattedAromas,
        entry_status: 'pending',
      })
      .select()
      .single();

    if (directInsertError) {
      console.error('[passes/create] Direct insert failed:', directInsertError);
      return NextResponse.json(
        { error: directInsertError.message || 'Erreur lors de la réservation du pass.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Pass créé avec succès',
      pass: insertedPass,
    });
  } catch (error: any) {
    console.error('[passes/create] Uncaught error:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur interne du serveur' },
      { status: 500 }
    );
  }
}
