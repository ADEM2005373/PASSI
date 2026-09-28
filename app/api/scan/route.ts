import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireRole } from '@/lib/supabase/api-security';

export async function POST(request: Request) {
  try {
    const { qrUuid, type, eventId } = await request.json();

    if (!qrUuid || !type) {
      return NextResponse.json({ success: false, message: "DENIED: Missing payload" }, { status: 400 });
    }

    const { error: authError, role } = await requireRole(['admin', 'security', 'barman']);
    if (authError) return authError;

    // Since RLS blocks non-owners from reading/updating passes, we use the Service Role Key here
    // to bypass RLS safely, AFTER we have verified the user is actually security or barman.
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    if (type === 'entry') {
      if (role !== 'security' && role !== 'admin') {
        return NextResponse.json({ success: false, message: "DENIED: Not Security" }, { status: 403 });
      }

      // Query Passes table using admin client
      const { data: pass, error } = await supabaseAdmin
        .from('passes')
        .select('*, events(title, date)')
        .eq('entry_qr_uuid', qrUuid)
        .single();
        
      if (error || !pass) return NextResponse.json({ success: false, message: "DENIED: Invalid QR Code" });
      if (eventId && pass.event_id !== eventId) {
        return NextResponse.json({ success: false, message: "DENIED: Mauvais Événement!" });
      }
      if (pass.entry_status === 'scanned') return NextResponse.json({ success: false, message: "DENIED: Pass Already Used!" });
      if (pass.entry_status !== 'activated') return NextResponse.json({ success: false, message: "DENIED: Pass Not Activated" });
      
      const eventTitle = pass.events?.title || 'Unknown Event';

      // Update to scanned using admin client
      const { error: updateError } = await supabaseAdmin
        .from('passes')
        .update({ entry_status: 'scanned' })
        .eq('id', pass.id);

      if (updateError) return NextResponse.json({ success: false, message: "DENIED: Database Error" });

      return NextResponse.json({ success: true, message: `SUCCESS: ${eventTitle}` });

    } else if (type === 'drink') {
      if (role !== 'barman' && role !== 'admin') {
        return NextResponse.json({ success: false, message: "DENIED: Not Barman" }, { status: 403 });
      }

      // Query passes table directly using admin client
      const { data: passDrink, error } = await supabaseAdmin
        .from('passes')
        .select('id, drink_status, drink_menus(name)')
        .eq('drink_qr_uuid', qrUuid)
        .single();

      if (error || !passDrink) return NextResponse.json({ success: false, message: "DENIED: Invalid QR Code" });
      if (passDrink.drink_status === 'scanned') return NextResponse.json({ success: false, message: "DENIED: Déjà Scanné" });
      if (passDrink.drink_status !== 'activated') return NextResponse.json({ success: false, message: `DENIED: Statut: ${passDrink.drink_status}` });

      const { error: updateError } = await supabaseAdmin
        .from('passes')
        .update({ drink_status: 'scanned' })
        .eq('id', passDrink.id);
        
      if (updateError) return NextResponse.json({ success: false, message: "DENIED: Database Error" });

      const drinkMenu: any = passDrink.drink_menus;
      const drinkName = drinkMenu?.name || 'Inconnue';

      return NextResponse.json({ success: true, message: "SUCCESS: BOISSON VALIDE", drinkDetails: drinkName });
    }

    return NextResponse.json({ success: false, message: "DENIED: Invalid Type" }, { status: 400 });

  } catch (error) {
    return NextResponse.json({ success: false, message: "DENIED: Internal Server Error" }, { status: 500 });
  }
}
