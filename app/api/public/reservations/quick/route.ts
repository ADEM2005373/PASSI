import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { getPassWebLink } from '@/lib/utils/url';

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
      quantity,
      passes: passesInput,
      selectedDrink,
      drinkName,
      selectedAromas,
      aromas,
      instagram,
      instagramHandle,
      promoCode,
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

    // Format default drink and aromas
    const resolvedDrink = (selectedDrink || drinkName || '').trim() || null;
    const rawAromas = selectedAromas || aromas || [];
    const formattedAromas: string[] = Array.isArray(rawAromas)
      ? rawAromas.filter((a: any) => typeof a === 'string' && a.trim().length > 0).map((a: string) => a.trim())
      : typeof rawAromas === 'string' && rawAromas.trim().length > 0
      ? [rawAromas.trim()]
      : [];

    // Quantity normalization (1 to 10 passes)
    const requestedQuantity = parseInt(String(quantity || 1), 10);
    const parsedQuantity = Math.max(1, Math.min(10, isNaN(requestedQuantity) ? 1 : requestedQuantity));

    // 2. Fetch event details & verify capacity/inventory
    const { data: event, error: eventError } = await supabaseAdmin
      .from('events')
      .select('id, title, base_price, date, location, capacity, promo_codes')
      .eq('id', eventId.trim())
      .single();

    if (eventError || !event) {
      return NextResponse.json(
        { error: 'Événement introuvable.' },
        { status: 404 }
      );
    }

    // Capacity check
    if (event.capacity && typeof event.capacity === 'number' && event.capacity > 0) {
      const { count: activeCount } = await supabaseAdmin
        .from('passes')
        .select('id', { count: 'exact', head: true })
        .eq('event_id', event.id)
        .not('entry_status', 'in', '("rejected","cancelled","expired","EXPIRED","CANCELLED")')
        .not('status', 'in', '("EXPIRED","CANCELLED")');

      if (activeCount !== null && (activeCount + parsedQuantity) > event.capacity) {
        const remaining = Math.max(0, event.capacity - activeCount);
        return NextResponse.json(
          { error: `Capacité maximale atteinte : seulement ${remaining} place(s) restante(s).` },
          { status: 400 }
        );
      }
    }

    // Compute pricing and promo discount
    let discount = 0;
    let promoUsed: string | null = null;
    const cleanPromo = typeof promoCode === 'string' ? promoCode.trim().toUpperCase() : null;
    if (cleanPromo && Array.isArray(event.promo_codes)) {
      const match = event.promo_codes.find(
        (p: any) => p && typeof p.code === 'string' && p.code.trim().toUpperCase() === cleanPromo
      );
      if (match) {
        discount = Number(match.discount_amount) || 0;
        promoUsed = match.code.trim().toUpperCase();
      }
    }

    const basePrice = Number(event.base_price) || 0;
    const unitPrice = Math.max(0, basePrice - discount);
    const totalAmount = unitPrice * parsedQuantity;

    // 3. Generate ONE unique reservation reference code for all passes (e.g. QCK-9A2E5B)
    const randomHex = crypto.randomBytes(3).toString('hex').toUpperCase();
    const reservationCode = `QCK-${randomHex}`;

    // 4. Set visual reference expires_at = createdAt + 48 hours
    const createdAt = new Date();
    const expiresAt = new Date(createdAt.getTime() + 48 * 60 * 60 * 1000).toISOString();

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

    // 6. Build pass insert rows (1 row per pass in this reservation)
    const rowsToInsert: Record<string, any>[] = [];

    for (let i = 0; i < parsedQuantity; i++) {
      const customPass = Array.isArray(passesInput) && passesInput[i] ? passesInput[i] : null;

      const pFirst = customPass?.guestFirstName ? String(customPass.guestFirstName).trim() : cleanFirstName;
      const pLast = customPass?.guestLastName
        ? String(customPass.guestLastName).trim()
        : (i === 0 ? cleanLastName : `${cleanLastName} (Invité ${i + 1})`);

      const pDrink = customPass?.selectedDrink !== undefined
        ? (String(customPass.selectedDrink || '').trim() || null)
        : resolvedDrink;

      const pAromas = customPass?.selectedAromas && Array.isArray(customPass.selectedAromas)
        ? customPass.selectedAromas
        : formattedAromas;

      // Cryptographically secure tracking tokens for Quick Reservation Web Pass view
      const secretToken = crypto.randomBytes(18).toString('base64url');
      const entryToken = crypto.randomBytes(24).toString('hex');
      const drinkToken = crypto.randomBytes(24).toString('hex');

      rowsToInsert.push({
        event_id: event.id,
        user_id: matchedUserId,
        source: 'QUICK_RESERVATION',
        pass_origin: 'QUICK_RESERVATION',
        pass_type: 'NORMAL',
        guest_first_name: pFirst,
        guest_last_name: pLast,
        phone: cleanPhone,
        email: cleanEmail,
        instagram: cleanInstagram,
        selected_drink: pDrink,
        drink_name: pDrink,
        selected_aromas: pAromas,
        reservation_code: reservationCode,
        status: 'PENDING_PAYMENT',
        entry_status: 'awaiting_payment',
        final_price: unitPrice,
        promo_used: promoUsed,
        expires_at: expiresAt,
        secret_token: secretToken,
        entry_token: entryToken,
        entry_qr_uuid: entryToken,
        is_entry_used: false,
        entry_used_at: null,
        drink_token: drinkToken,
        drink_qr_uuid: drinkToken,
        drink_qr_code: drinkToken,
        is_drink_used: false,
        drink_used_at: null,
        created_at: createdAt.toISOString(),
        updated_at: createdAt.toISOString(),
      });
    }

    let { data: insertedPasses, error: insertError } = await supabaseAdmin
      .from('passes')
      .insert(rowsToInsert)
      .select('id, event_id, user_id, source, reservation_code, guest_first_name, guest_last_name, phone, email, selected_drink, drink_name, status, entry_status, final_price, expires_at, secret_token, entry_token, is_entry_used, entry_used_at, drink_token, is_drink_used, drink_used_at, created_at');

    // Fallback if newly added columns aren't yet in table
    if (insertError) {
      console.warn('[POST /api/public/reservations/quick] Insert retry without optional columns:', insertError.message);

      const fallbackRows = rowsToInsert.map(r => {
        const row: Record<string, any> = {
          event_id: r.event_id,
          user_id: r.user_id,
          guest_first_name: r.guest_first_name,
          guest_last_name: r.guest_last_name,
          entry_status: 'awaiting_payment',
          drink_name: r.drink_name,
          selected_drink: r.selected_drink,
          selected_aromas: r.selected_aromas,
          final_price: r.final_price,
          entry_qr_uuid: r.entry_qr_uuid,
          drink_qr_uuid: r.drink_qr_uuid,
        };
        if (!insertError.message.includes('source')) row.source = 'QUICK_RESERVATION';
        if (!insertError.message.includes('phone')) row.phone = r.phone;
        if (!insertError.message.includes('email')) row.email = r.email;
        if (!insertError.message.includes('reservation_code')) row.reservation_code = r.reservation_code;
        if (!insertError.message.includes('status')) row.status = 'PENDING_PAYMENT';
        if (!insertError.message.includes('expires_at')) row.expires_at = r.expires_at;
        if (!insertError.message.includes('secret_token')) row.secret_token = r.secret_token;
        if (!insertError.message.includes('entry_token')) row.entry_token = r.entry_token;
        if (!insertError.message.includes('is_entry_used')) row.is_entry_used = r.is_entry_used;
        if (!insertError.message.includes('drink_token')) row.drink_token = r.drink_token;
        if (!insertError.message.includes('is_drink_used')) row.is_drink_used = r.is_drink_used;
        return row;
      });

      const fallbackResult = await supabaseAdmin
        .from('passes')
        .insert(fallbackRows)
        .select();

      if (fallbackResult.error || !fallbackResult.data) {
        console.error('[POST /api/public/reservations/quick] Fallback insert failed:', fallbackResult.error);
        return NextResponse.json(
          { error: fallbackResult.error?.message || 'Erreur lors de la création de la réservation express.' },
          { status: 500 }
        );
      }
      insertedPasses = fallbackResult.data;
    }

    if (!insertedPasses || insertedPasses.length === 0) {
      return NextResponse.json(
        { error: 'Erreur inattendue : la réservation n\'a pas pu être créée.' },
        { status: 500 }
      );
    }

    const firstPass = insertedPasses[0];

    // 7. Return 201 Created with exact required confirmation message
    return NextResponse.json(
      {
        success: true,
        message: 'Reservation complete. Please pay for your pass at our physical sell points within 48 hours.',
        reservation: {
          id: firstPass.id,
          reservationCode: firstPass.reservation_code || reservationCode,
          eventId: event.id,
          eventTitle: event.title,
          guestFirstName: cleanFirstName,
          guestLastName: cleanLastName,
          email: cleanEmail,
          phone: cleanPhone,
          quantity: parsedQuantity,
          unitPrice,
          finalPrice: unitPrice,
          totalPrice: totalAmount,
          selectedDrink: resolvedDrink,
          status: 'PENDING_PAYMENT',
          expiresAt: firstPass.expires_at || expiresAt,
          createdAt: firstPass.created_at || createdAt.toISOString(),
          passes: insertedPasses.map((p: any) => ({
            id: p.id,
            guestFirstName: p.guest_first_name,
            guestLastName: p.guest_last_name,
            selectedDrink: p.selected_drink || p.drink_name,
            finalPrice: p.final_price,
            secretToken: p.secret_token,
            webPassUrl: p.secret_token ? getPassWebLink(p.secret_token) : getPassWebLink(p.id),
          })),
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
