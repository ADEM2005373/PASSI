import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireRole } from '@/lib/supabase/api-security';
import { approvePhase1PassAction, rejectPassAction } from '@/lib/actions/pass-lifecycle';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export async function PATCH(req: NextRequest) {
  const { error: authError } = await requireRole(['admin']);
  if (authError) return authError;

  try {
    const body = await req.json();
    const { passId, action, rejectionReason } = body || {};

    if (!passId || typeof passId !== 'string' || !action || typeof action !== 'string') {
      return NextResponse.json({ error: 'Pass ID and valid action are required' }, { status: 400 });
    }

    if (!['approve', 'mark_paid', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'Action non autorisée' }, { status: 400 });
    }

    // Backend Validation Guards
    const { data: existingPass, error: fetchError } = await supabaseAdmin
      .from('passes')
      .select('entry_status, drink_id, entry_qr_uuid, drink_qr_uuid')
      .eq('id', passId)
      .single();

    if (fetchError || !existingPass) {
      return NextResponse.json({ error: 'Pass not found' }, { status: 404 });
    }

    if (['activated', 'scanned'].includes(existingPass.entry_status)) {
      return NextResponse.json(
        { error: 'Finalized and paid passes are immutable and cannot be rejected, modified, or deleted.' },
        { status: 403 }
      );
    }

    if (action === 'approve') {
      const result = await approvePhase1PassAction(passId);
      return NextResponse.json(result);

    } else if (action === 'mark_paid') {
      // Step 2: Mark Paid -> Activated & Generate QR
      const qrUuid = existingPass.entry_qr_uuid || crypto.randomUUID();
      
      const updateData: any = { 
        entry_status: 'activated',
        entry_qr_uuid: qrUuid,
        updated_at: new Date().toISOString()
      };
      
      if (existingPass.drink_id) {
        const drinkQr = existingPass.drink_qr_uuid || crypto.randomUUID();
        updateData.drink_status = 'activated';
        updateData.drink_qr_uuid = drinkQr;
        updateData.drink_qr_code = drinkQr;
      }

      const { error } = await supabaseAdmin
        .from('passes')
        .update(updateData)
        .eq('id', passId);

      if (error) {
        console.error("Database error in passes PATCH mark_paid:", error);
        return NextResponse.json({ error: "Impossible d'activer le pass" }, { status: 500 });
      }
      
      return NextResponse.json({ success: true, status: 'activated' });

    } else if (action === 'reject') {
      const result = await rejectPassAction(passId, rejectionReason);
      return NextResponse.json(result);
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error: any) {
    console.error("Server error in passes PATCH:", error);
    return NextResponse.json({ error: "Une erreur interne est survenue" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const { error: authError } = await requireRole(['admin']);
  if (authError) return authError;

  try {
    const body = await req.json();
    const { passId, holderNameConfirmation } = body || {};

    if (!passId || typeof passId !== 'string') {
      return NextResponse.json({ error: 'Identifiant du pass requis' }, { status: 400 });
    }

    if (!holderNameConfirmation || typeof holderNameConfirmation !== 'string') {
      return NextResponse.json(
        { error: 'Veuillez saisir le nom du titulaire pour confirmer la suppression.' },
        { status: 400 }
      );
    }

    // 1. Fetch pass to inspect holder identity
    const { data: pass, error: fetchError } = await supabaseAdmin
      .from('passes')
      .select('id, guest_first_name, guest_last_name, user_id, entry_status, profiles(full_name)')
      .eq('id', passId)
      .single();

    if (fetchError || !pass) {
      return NextResponse.json({ error: 'Pass introuvable' }, { status: 404 });
    }

    // 2. Compute expected holder names with whitespace normalization
    const normalize = (s: string) => (s || '').trim().replace(/\s+/g, ' ').toLowerCase();

    const guestFullName = [pass.guest_first_name, pass.guest_last_name]
      .map(s => (s || '').trim())
      .filter(Boolean)
      .join(' ');
    const profileFullName = ((pass.profiles as any)?.full_name || '').trim();
    const expectedCandidates = [guestFullName, profileFullName]
      .filter(n => n.length > 0)
      .map(normalize);

    const inputClean = normalize(holderNameConfirmation);
    const isMatched = expectedCandidates.includes(inputClean);

    if (!isMatched) {
      return NextResponse.json(
        {
          error: `Le nom saisi ne correspond pas. Nom attendu : "${guestFullName || profileFullName || 'Inconnu'}"`,
        },
        { status: 400 }
      );
    }

    // 3. Delete pass from database
    const { error: deleteError } = await supabaseAdmin
      .from('passes')
      .delete()
      .eq('id', passId);

    if (deleteError) {
      console.error('Error deleting pass in admin DELETE:', deleteError);
      if (deleteError.message?.includes('immutable and cannot be deleted')) {
        return NextResponse.json(
          {
            error:
              "Ce pass est finalisé/payé. Pour autoriser sa suppression par les administrateurs, appliquez la migration 'supabase/allow_admin_delete_pass.sql'.",
          },
          { status: 403 }
        );
      }
      return NextResponse.json({ error: 'Impossible de supprimer le pass: ' + deleteError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Pass supprimé avec succès' });
  } catch (err: any) {
    console.error('Server error in admin passes DELETE:', err);
    return NextResponse.json({ error: 'Une erreur interne est survenue' }, { status: 500 });
  }
}

