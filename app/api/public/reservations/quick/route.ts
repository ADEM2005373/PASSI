import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const {
      eventId,
      firstName,
      lastName,
      phone,
      email,
      selectedDrink,
      drinkName,
      selectedAromas,
      aromas,
      instagram,
      instagramHandle,
    } = body || {};

    // 1. Lightweight Payload Validation
    if (!eventId || typeof eventId !== 'string' || !eventId.trim()) {
      return NextResponse.json(
        { error: "L'identifiant de l'événement est requis." },
        { status: 400 }
      );
    }

    const cleanFirstName = String(firstName || '').trim();
    const cleanLastName = String(lastName || '').trim();
    if (!cleanFirstName || !cleanLastName) {
      return NextResponse.json(
        { error: 'Le prénom et le nom sont requis.' },
        { status: 400 }
      );
    }

    const cleanPhone = String(phone || '').trim();
    if (!cleanPhone || cleanPhone.length < 6) {
      return NextResponse.json(
        { error: 'Un numéro de téléphone valide est requis.' },
        { status: 400 }
      );
    }

    const cleanEmail = String(email || '').trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!cleanEmail || !emailRegex.test(cleanEmail)) {
      return NextResponse.json(
        { error: 'Une adresse e-mail valide est requise.' },
        { status: 400 }
      );
    }

    // Instagram is strictly OPTIONAL or NULL for this express flow
    const rawInstagram = instagram ?? instagramHandle;
    const cleanInstagram = rawInstagram && typeof rawInstagram === 'string' && rawInstagram.trim().length > 0
      ? rawInstagram.trim()
      : null;

    // Format drink and aromas
    const resolvedDrink = (selectedDrink || drinkName || '').trim() || null;
    const rawAromas = selectedAromas || aromas || [];
    const formattedAromas: string[] = Array.isArray(rawAromas)
      ? rawAromas.filter((a: any) => typeof a === 'string' && a.trim().length > 0).map((a: string) => a.trim())
      : typeof rawAromas === 'string' && rawAromas.trim().length > 0
      ? [rawAromas.trim()]
      : [];

    // 2. Fetch event details & verify capacity/inventory
    const { data: event, error: eventError } = await supabaseAdmin
      .from('events')
      .select('id, title, base_price, date, location, capacity')
      .eq('id', eventId.trim())
      .single();

    if (eventError || !event) {
      return NextResponse.json(
        { error: 'Événement introuvable.' },
        { status: 404 }
      );
    }

    // Optional capacity check (if configured on event)
    if (event.capacity && typeof event.capacity === 'number' && event.capacity > 0) {
      const { count: activeCount } = await supabaseAdmin
        .from('passes')
        .select('id', { count: 'exact', head: true })
        .eq('event_id', event.id)
        .not('entry_status', 'in', '("rejected","cancelled","expired","EXPIRED","CANCELLED")')
        .not('status', 'in', '("EXPIRED","CANCELLED")');

      if (activeCount !== null && activeCount >= event.capacity) {
        return NextResponse.json(
          { error: 'Cet événement est complet. Plus de places disponibles pour le moment.' },
          { status: 400 }
        );
      }
    }

    // 3. Generate unique reservation reference code (e.g. QCK-9A2E5B)
    const randomHex = crypto.randomBytes(3).toString('hex').toUpperCase();
    const reservationCode = `QCK-${randomHex}`;

    // 4. Set visual reference expires_at = createdAt + 48 hours
    // (Strict rule: NEVER expire automatically via cron or TTL, visual only)
    const createdAt = new Date();
    const expiresAt = new Date(createdAt.getTime() + 48 * 60 * 60 * 1000).toISOString();
    const finalPrice = Number(event.base_price) || 0;

    // 5. Account sync check: If an account matching this email already exists, link userId immediately
    let matchedUserId: string | null = null;
    try {
      const { data: matchedProfile } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .ilike('email', cleanEmail)
        .maybeSingle();

      if (matchedProfile?.id) {
        matchedUserId = matchedProfile.id;
      }
    } catch (e) {
      // non-blocking
    }

    // 6. Build pass insert payload
    const insertPayload: Record<string, any> = {
      event_id: event.id,
      user_id: matchedUserId,
      source: 'QUICK_RESERVATION',
      pass_origin: 'QUICK_RESERVATION',
      pass_type: 'NORMAL',
      guest_first_name: cleanFirstName,
      guest_last_name: cleanLastName,
      phone: cleanPhone,
      email: cleanEmail,
      instagram: cleanInstagram,
      selected_drink: resolvedDrink,
      drink_name: resolvedDrink,
      selected_aromas: formattedAromas,
      reservation_code: reservationCode,
      status: 'PENDING_PAYMENT',
      entry_status: 'awaiting_payment', // Compatible with sell points waiting for payment
      final_price: finalPrice,
      expires_at: expiresAt,
      created_at: createdAt.toISOString(),
      updated_at: createdAt.toISOString(),
    };

    let { data: newPass, error: insertError } = await supabaseAdmin
      .from('passes')
      .insert(insertPayload)
      .select('id, event_id, user_id, source, reservation_code, guest_first_name, guest_last_name, phone, email, selected_drink, drink_name, status, entry_status, final_price, expires_at, created_at')
      .single();

    // Fallback if newly added columns like selected_drink, source, or phone aren't yet in table
    if (insertError) {
      console.warn('[POST /api/public/reservations/quick] Insert retry without optional columns:', insertError.message);
      
      const fallbackPayload: Record<string, any> = {
        event_id: event.id,
        user_id: matchedUserId,
        guest_first_name: cleanFirstName,
        guest_last_name: cleanLastName,
        entry_status: 'awaiting_payment',
        drink_name: resolvedDrink,
        selected_aromas: formattedAromas,
        final_price: finalPrice,
      };

      // Try selectively adding columns that work
      if (!insertError.message.includes('source')) fallbackPayload.source = 'QUICK_RESERVATION';
      if (!insertError.message.includes('phone')) fallbackPayload.phone = cleanPhone;
      if (!insertError.message.includes('email')) fallbackPayload.email = cleanEmail;
      if (!insertError.message.includes('reservation_code')) fallbackPayload.reservation_code = reservationCode;
      if (!insertError.message.includes('status')) fallbackPayload.status = 'PENDING_PAYMENT';
      if (!insertError.message.includes('expires_at')) fallbackPayload.expires_at = expiresAt;

      const fallbackResult = await supabaseAdmin
        .from('passes')
        .insert(fallbackPayload)
        .select()
        .single();

      if (fallbackResult.error || !fallbackResult.data) {
        console.error('[POST /api/public/reservations/quick] Fallback insert failed:', fallbackResult.error);
        return NextResponse.json(
          { error: fallbackResult.error?.message || 'Erreur lors de la création de la réservation express.' },
          { status: 500 }
        );
      }
      newPass = fallbackResult.data;
    }

    if (!newPass) {
      return NextResponse.json(
        { error: 'Erreur inattendue : la réservation n\'a pas pu être créée.' },
        { status: 500 }
      );
    }

    // 7. Return 201 Created with exact required confirmation message
    return NextResponse.json(
      {
        success: true,
        message: 'Reservation complete. Please pay for your pass at our physical sell points within 48 hours.',
        reservation: {
          id: newPass.id,
          reservationCode: newPass.reservation_code || reservationCode,
          eventId: event.id,
          eventTitle: event.title,
          guestFirstName: cleanFirstName,
          guestLastName: cleanLastName,
          email: cleanEmail,
          phone: cleanPhone,
          selectedDrink: resolvedDrink,
          finalPrice,
          status: 'PENDING_PAYMENT',
          expiresAt: newPass.expires_at || expiresAt,
          createdAt: newPass.created_at || createdAt.toISOString(),
          isAccountLinked: Boolean(matchedUserId),
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('[POST /api/public/reservations/quick] Uncaught server error:', error);
    return NextResponse.json(
      { error: error?.message || 'Erreur interne du serveur lors de la réservation express.' },
      { status: 500 }
    );
  }
}
