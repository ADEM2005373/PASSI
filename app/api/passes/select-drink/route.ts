import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { getOrCreateProfile, normalizeRole } from '@/lib/supabase/profile-guard';

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
    const { passId, drinkId, selectedAromas } = body || {};

    if (!passId || !drinkId) {
      return NextResponse.json(
        { error: 'ID du pass et ID de la boisson requis.' }, 
        { status: 400 }
      );
    }

    // 1. Fetch pass
    const { data: pass, error: fetchError } = await supabaseAdmin
      .from('passes')
      .select('*, events(title, id)')
      .eq('id', passId)
      .single();

    if (fetchError || !pass) {
      return NextResponse.json({ error: 'Pass introuvable.' }, { status: 404 });
    }

    // 2. Ownership check (Allow owner OR admin in simulation/management mode)
    const { profile: userProfile } = await getOrCreateProfile(user);
    const isAdmin = normalizeRole(userProfile.role) === 'admin';
    if (!isAdmin && pass.user_id !== user.id) {
      return NextResponse.json({ error: 'Accès non autorisé à ce pass.' }, { status: 403 });
    }

    // 3. Verify drink menu or event drinks
    let resolvedDrinkName = drinkId;
    let matchedDrink: any = null;

    // Check drink_menus first
    const { data: drink, error: drinkError } = await supabaseAdmin
      .from('drink_menus')
      .select('*')
      .eq('id', drinkId)
      .maybeSingle();

    if (drink && drink.event_id === pass.event_id) {
      matchedDrink = drink;
      resolvedDrinkName = drink.name;
    } else {
      // Check event drinks JSONB
      const { data: eventData } = await supabaseAdmin
        .from('events')
        .select('drinks')
        .eq('id', pass.event_id)
        .single();

      let eventDrinksList: any[] = [];
      if (Array.isArray(eventData?.drinks)) {
        eventDrinksList = eventData.drinks;
      } else if (typeof eventData?.drinks === 'string') {
        try { eventDrinksList = JSON.parse(eventData.drinks); } catch {}
      }

      const found = eventDrinksList.find(d => 
        (d.name && d.name.toLowerCase() === drinkId.toLowerCase()) || 
        (d.id && d.id === drinkId)
      );

      if (found) {
        matchedDrink = found;
        resolvedDrinkName = found.name;
      } else if (!drink) {
        // Fallback: accept drinkId directly as drink_name
        resolvedDrinkName = drinkId;
        matchedDrink = { name: drinkId };
      }
    }

    // 4. Drink QR & Status determination
    const passType = (pass.pass_type || 'NORMAL').toUpperCase();
    const isSpecialPass = 
      passType === 'VIP' || 
      passType === 'GIFT' || 
      (passType === 'INVITATION' && pass.invitation_status === 'ACCEPTED');

    const formattedAromas = Array.isArray(selectedAromas)
      ? selectedAromas.filter((a: any) => typeof a === 'string' && a.trim().length > 0)
      : [];

    const updateData: any = {
      drink_id: resolvedDrinkName,
      drink_name: resolvedDrinkName,
      selected_aromas: formattedAromas,
      updated_at: new Date().toISOString(),
    };

    if (isSpecialPass || pass.entry_status === 'activated') {
      // Free/Pre-authorized Drink: Instant QR generation and activation (Bypass payment)
      const drinkQr = pass.drink_qr_uuid || crypto.randomUUID();
      updateData.drink_status = 'activated';
      updateData.drink_qr_uuid = drinkQr;
      updateData.drink_qr_code = drinkQr;
    } else {
      // Normal pass awaiting payment
      updateData.drink_status = 'pending';
    }

    // 5. Update pass
    let updatedPass: any = null;
    const { data: passUpdated, error: updateError } = await supabaseAdmin
      .from('passes')
      .update(updateData)
      .eq('id', passId)
      .select('*, events(title, date, location)')
      .single();

    if (updateError) {
      console.warn("Update pass failed with selected_aromas, retrying without column:", updateError);
      delete updateData.selected_aromas;
      const { data: retryPass, error: retryError } = await supabaseAdmin
        .from('passes')
        .update(updateData)
        .eq('id', passId)
        .select('*, events(title, date, location)')
        .single();

      if (retryError) {
        throw retryError;
      }
      updatedPass = { ...retryPass, selected_aromas: formattedAromas };
    } else {
      updatedPass = passUpdated;
    }

    // Attach drink details to returned pass
    (updatedPass as any).drink_menus = drink;

    return NextResponse.json({
      success: true,
      message: `Boisson "${drink.name}" sélectionnée avec succès !`,
      pass: updatedPass,
      drink,
    });
  } catch (err: any) {
    console.error('Select drink error:', err);
    return NextResponse.json(
      { error: err.message || 'Erreur interne du serveur' }, 
      { status: 500 }
    );
  }
}
