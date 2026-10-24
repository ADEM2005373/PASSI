import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireRole } from '@/lib/supabase/api-security';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { qrUuid, type, eventId } = body || {};

    if (!qrUuid || typeof qrUuid !== 'string' || !type || typeof type !== 'string') {
      return NextResponse.json({ success: false, message: "DENIED: Missing payload" }, { status: 400 });
    }

    if (!['entry', 'drink'].includes(type)) {
      return NextResponse.json({ success: false, message: "DENIED: Invalid Type" }, { status: 400 });
    }

    const { error: authError, role } = await requireRole(['admin', 'security', 'barman']);
    if (authError) return authError;

    // Since RLS blocks non-owners from reading/updating passes, we use the Service Role Key here
    // to bypass RLS safely, AFTER we have verified the user is actually security or barman.
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const normalizedRole = (role || '').toLowerCase();

    if (type === 'entry') {
      if (normalizedRole !== 'security' && normalizedRole !== 'admin') {
        return NextResponse.json({ success: false, message: "DENIED: Not Security" }, { status: 403 });
      }

      // Query Passes table using admin client (supports entry_qr_uuid or entry_token)
      let pass: any = null;
      let error: any = null;

      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(qrUuid);
      if (isUUID) {
        const { data: byUuid, error: err } = await supabaseAdmin
          .from('passes')
          .select('*, events(title, date)')
          .or(`entry_qr_uuid.eq.${qrUuid},id.eq.${qrUuid}`)
          .maybeSingle();
        pass = byUuid;
        error = err;
      }

      if (!pass) {
        try {
          const { data: byToken } = await supabaseAdmin
            .from('passes')
            .select('*, events(title, date)')
            .eq('entry_token', qrUuid)
            .maybeSingle();
          if (byToken) pass = byToken;
        } catch (e) {
          // ignore if column doesn't exist
        }
      }
        
      if (error || !pass) return NextResponse.json({ success: false, message: "DENIED: Invalid QR Code" });
      if (eventId && pass.event_id !== eventId) {
        return NextResponse.json({ success: false, message: "DENIED: Mauvais Événement!" });
      }
      if (pass.entry_status === 'scanned' || pass.is_entry_used) return NextResponse.json({ success: false, message: "DENIED: Pass Already Used!" });
      if (pass.entry_status !== 'activated') return NextResponse.json({ success: false, message: "DENIED: Pass Not Activated" });
      
      const eventTitle = pass.events?.title || 'Unknown Event';
      const now = new Date().toISOString();

      // Update to scanned using admin client with schema resilience
      const updatePayload: Record<string, any> = { 
        entry_status: 'scanned',
        is_entry_used: true,
        entry_used_at: now,
        updated_at: now
      };

      for (let attempt = 0; attempt < 4; attempt++) {
        const { error: updateError } = await supabaseAdmin
          .from('passes')
          .update(updatePayload)
          .eq('id', pass.id);

        if (!updateError) break;
        const colMatch = (updateError?.message || '').match(/Could not find the '([^']+)' column/i);
        if (colMatch && colMatch[1]) {
          delete updatePayload[colMatch[1]];
        } else {
          break;
        }
      }

      return NextResponse.json({ success: true, message: `SUCCESS: ${eventTitle}` });

    } else if (type === 'drink') {
      if (normalizedRole !== 'barman' && normalizedRole !== 'admin') {
        return NextResponse.json({ success: false, message: "DENIED: Not Barman" }, { status: 403 });
      }

      // Query passes table directly using admin client (supports drink_qr_uuid, drink_token, or drink_qr_code)
      let passDrink: any = null;
      let error: any = null;

      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(qrUuid);
      if (isUUID) {
        const { data: byUuid, error: err } = await supabaseAdmin
          .from('passes')
          .select('*, events(title)')
          .or(`drink_qr_uuid.eq.${qrUuid},id.eq.${qrUuid}`)
          .maybeSingle();
        passDrink = byUuid;
        error = err;
      }

      if (!passDrink) {
        try {
          const { data: byToken } = await supabaseAdmin
            .from('passes')
            .select('*, events(title)')
            .eq('drink_token', qrUuid)
            .maybeSingle();
          if (byToken) passDrink = byToken;
        } catch (e) {
          // ignore
        }
      }

      // Fallback matching by drink_qr_code if needed
      if (!passDrink) {
        const { data: byCode } = await supabaseAdmin
          .from('passes')
          .select('*, events(title)')
          .eq('drink_qr_code', qrUuid)
          .maybeSingle();
        passDrink = byCode;
      }

      if (error || !passDrink) return NextResponse.json({ success: false, message: "DENIED: QR Code Invalide" });
      if (passDrink.drink_status === 'scanned' || passDrink.is_drink_used) return NextResponse.json({ success: false, message: "DENIED: Déjà Scanné / Consommé" });
      if (passDrink.drink_status !== 'activated') return NextResponse.json({ success: false, message: `DENIED: Non Activé (${passDrink.drink_status || 'en attente'})` });

      const now = new Date().toISOString();
      const updatePayload: Record<string, any> = { 
        drink_status: 'scanned',
        is_drink_used: true,
        drink_used_at: now,
        updated_at: now
      };

      for (let attempt = 0; attempt < 4; attempt++) {
        const { error: updateError } = await supabaseAdmin
          .from('passes')
          .update(updatePayload)
          .eq('id', passDrink.id);

        if (!updateError) break;
        const colMatch = (updateError?.message || '').match(/Could not find the '([^']+)' column/i);
        if (colMatch && colMatch[1]) {
          delete updatePayload[colMatch[1]];
        } else {
          break;
        }
      }

      const drinkName = passDrink.drink_name || passDrink.drink_id || 'Boisson';
      const selectedAromas: string[] = Array.isArray(passDrink.selected_aromas)
        ? passDrink.selected_aromas.filter((a: any) => typeof a === 'string' && a.trim().length > 0)
        : [];
      const guestName = [passDrink.guest_first_name, passDrink.guest_last_name].filter(Boolean).join(' ') || undefined;

      return NextResponse.json({ 
        success: true, 
        message: "SUCCESS: BOISSON VALIDE", 
        drinkDetails: drinkName,
        drink_name: drinkName,
        selected_aromas: selectedAromas,
        guest_name: guestName,
        pass: {
          id: passDrink.id,
          drink_name: drinkName,
          selected_aromas: selectedAromas,
          guest_name: guestName,
          status: 'scanned'
        }
      });
    }

    return NextResponse.json({ success: false, message: "DENIED: Invalid Type" }, { status: 400 });

  } catch (error) {
    return NextResponse.json({ success: false, message: "DENIED: Internal Server Error" }, { status: 500 });
  }
}
