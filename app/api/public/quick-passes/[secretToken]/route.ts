import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export const dynamic = 'force-dynamic';

/**
 * GET /api/public/quick-passes/:secretToken
 * Public endpoint to fetch dynamic web pass details without requiring authentication.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ secretToken: string }> }
) {
  try {
    const { secretToken: rawToken } = await params;
    const secretToken = rawToken?.trim();

    if (!secretToken) {
      return NextResponse.json(
        { error: 'Jeton de pass manquant ou invalide.' },
        { status: 400 }
      );
    }

    // 1. Look up pass by secret_token or fallback to id / reservation_code
    let pass: any = null;

    try {
      const { data: passBySecret, error: secretErr } = await supabaseAdmin
        .from('passes')
        .select(`
          *,
          events(title, date, location, doors_open, image_url)
        `)
        .eq('secret_token', secretToken)
        .maybeSingle();

      if (!secretErr && passBySecret) {
        pass = passBySecret;
      }
    } catch (e) {
      // Column might not exist in unmigrated schema
    }

    // Fallback: If not found by secret_token, search by pass id or reservation code
    if (!pass) {
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(secretToken);
      const query = supabaseAdmin
        .from('passes')
        .select(`
          *,
          events(title, date, location, doors_open, image_url)
        `);

      if (isUUID) {
        const { data: fallbackPass } = await query.eq('id', secretToken).maybeSingle();
        pass = fallbackPass;
      } else {
        const { data: fallbackPass } = await query.eq('reservation_code', secretToken).maybeSingle();
        pass = fallbackPass;
      }
    }

    if (!pass) {
      return NextResponse.json(
        { error: 'Pass introuvable ou lien expiré.' },
        { status: 404 }
      );
    }

    const event = (pass.events as any) || {};
    const isEntryUsed = Boolean(pass.is_entry_used || pass.entry_status === 'scanned');
    const isDrinkUsed = Boolean(pass.is_drink_used || pass.drink_status === 'scanned');
    const entryToken = pass.entry_token || pass.entry_qr_uuid || pass.id;
    const drinkToken = pass.drink_token || pass.drink_qr_uuid || pass.id;
    const selectedDrink = pass.selected_drink || pass.drink_name || 'Boisson standard';
    const guestName = [pass.guest_first_name, pass.guest_last_name].filter(Boolean).join(' ') || 'Invité';

    return NextResponse.json({
      success: true,
      pass: {
        id: pass.id,
        reservationCode: pass.reservation_code || `QCK-${pass.id.slice(0, 6).toUpperCase()}`,
        guestFirstName: pass.guest_first_name,
        guestLastName: pass.guest_last_name,
        guestName,
        phone: pass.phone,
        email: pass.email,
        status: pass.status || 'PAID',
        entryStatus: pass.entry_status || 'activated',
        finalPrice: pass.final_price,
        // Entry Gate QR Details
        entryToken,
        isEntryUsed,
        entryUsedAt: pass.entry_used_at,
        // Drink Voucher QR Details
        drinkToken,
        selectedDrink,
        selectedAromas: pass.selected_aromas || [],
        isDrinkUsed,
        drinkUsedAt: pass.drink_used_at,
        // Event Metadata
        eventTitle: event.title || 'Événement Passi',
        eventDate: event.date || null,
        eventLocation: event.location || "L'Agora Djerba",
        doorsOpen: event.doors_open || null,
        imageUrl: event.image_url || null,
        secretToken: pass.secret_token || secretToken,
      },
    });
  } catch (error: any) {
    console.error('Error fetching quick pass details:', error);
    return NextResponse.json(
      { error: 'Erreur interne du serveur lors de la récupération du pass.' },
      { status: 500 }
    );
  }
}
