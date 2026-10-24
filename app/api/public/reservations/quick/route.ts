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
      const entryUuid = crypto.randomUUID();
      const drinkUuid = crypto.randomUUID();

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
        entry_token: entryUuid,
        entry_qr_uuid: entryUuid,
        is_entry_used: false,
        entry_used_at: null,
        drink_token: drinkUuid,
        drink_qr_uuid: drinkUuid,
        drink_qr_code: drinkUuid,
        is_drink_used: false,
        drink_used_at: null,
        created_at: createdAt.toISOString(),
        updated_at: createdAt.toISOString(),
      });
    }

    let currentRows = rowsToInsert.map(r => ({ ...r }));
    let insertedPasses: any[] | null = null;
    let insertError: any = null;

    // Retry loop dynamically removing any column reported missing by PostgREST schema cache
    for (let attempt = 0; attempt < 15; attempt++) {
      const { data, error } = await supabaseAdmin
        .from('passes')
        .insert(currentRows)
        .select();

      if (!error && data) {
        insertedPasses = data;
        insertError = null;
        break;
      }

      insertError = error;
      const colMatch = (error?.message || '').match(/Could not find the '([^']+)' column/i);
      if (colMatch && colMatch[1]) {
        const missingCol = colMatch[1];
        console.warn(`[POST /api/public/reservations/quick] Pruning missing column '${missingCol}' from insert payload (attempt ${attempt + 1})`);
        currentRows.forEach(r => {
          delete (r as any)[missingCol];
        });
      } else {
        // If not a missing column error or unrecognized, break and report error
        break;
      }
    }

    if (insertError || !insertedPasses || insertedPasses.length === 0) {
      console.error('[POST /api/public/reservations/quick] Final insert failed:', insertError);
      return NextResponse.json(
        { error: insertError?.message || 'Erreur lors de la création de la réservation express.' },
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
          passes: insertedPasses.map((p: any) => {
            const token = p.secret_token || p.id;
            return {
              id: p.id,
              guestFirstName: p.guest_first_name,
              guestLastName: p.guest_last_name,
              selectedDrink: p.selected_drink || p.drink_name,
              finalPrice: p.final_price,
              secretToken: token,
              webPassUrl: getPassWebLink(token),
            };
          }),
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
