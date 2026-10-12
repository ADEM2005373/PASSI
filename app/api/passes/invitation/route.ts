import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '@/lib/supabase/server';

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
    const { passId, action } = body || {};

    if (!passId || !['accept', 'decline'].includes(action)) {
      return NextResponse.json(
        { error: 'ID de pass et action (accept ou decline) requis.' }, 
        { status: 400 }
      );
    }

    // 1. Fetch pass
    const { data: pass, error: fetchError } = await supabaseAdmin
      .from('passes')
      .select('*, events(title)')
      .eq('id', passId)
      .single();

    if (fetchError || !pass) {
      return NextResponse.json({ error: 'Pass introuvable.' }, { status: 404 });
    }

    // 2. Ownership check
    if (pass.user_id !== user.id) {
      return NextResponse.json({ error: 'Accès non autorisé à ce pass.' }, { status: 403 });
    }

    // 3. Validation: Must be an invitation
    if (pass.pass_type !== 'INVITATION') {
      return NextResponse.json({ error: 'Ce pass n\'est pas une invitation.' }, { status: 400 });
    }

    if (pass.invitation_status !== 'PENDING') {
      return NextResponse.json({ 
        error: `Cette invitation a déjà été traitée (${pass.invitation_status}).` 
      }, { status: 400 });
    }

    // 4. Handle accept or decline
    if (action === 'accept') {
      const qrUuid = pass.entry_qr_uuid || crypto.randomUUID();
      const updateData: any = {
        invitation_status: 'ACCEPTED',
        entry_status: 'activated',
        entry_qr_uuid: qrUuid,
        updated_at: new Date().toISOString(),
      };

      // If drink was already selected, activate drink QR too
      if (pass.drink_id) {
        const drinkQr = pass.drink_qr_uuid || crypto.randomUUID();
        updateData.drink_status = 'activated';
        updateData.drink_qr_uuid = drinkQr;
        updateData.drink_qr_code = drinkQr;
      }

      const { data: updatedPass, error: updateError } = await supabaseAdmin
        .from('passes')
        .update(updateData)
        .eq('id', passId)
        .select('*, events(title, date, location)')
        .single();

      if (updateError) {
        throw updateError;
      }

      return NextResponse.json({
        success: true,
        message: 'Invitation acceptée ! Votre QR Code d\'accès est activé.',
        pass: updatedPass,
      });
    } else {
      // Decline
      const { data: updatedPass, error: updateError } = await supabaseAdmin
        .from('passes')
        .update({
          invitation_status: 'DECLINED',
          entry_status: 'rejected',
          rejection_reason: 'Invitation déclinée par le festivalier.',
          updated_at: new Date().toISOString(),
        })
        .eq('id', passId)
        .select('*, events(title, date, location)')
        .single();

      if (updateError) {
        throw updateError;
      }

      return NextResponse.json({
        success: true,
        message: 'Vous avez décliné l\'invitation.',
        pass: updatedPass,
      });
    }
  } catch (err: any) {
    console.error('Invitation response error:', err);
    return NextResponse.json(
      { error: err.message || 'Erreur interne du serveur' }, 
      { status: 500 }
    );
  }
}
