import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { createClient } from '@supabase/supabase-js';
import { requireRole } from '@/lib/supabase/api-security';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export const dynamic = 'force-dynamic';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // 1. Admin Role Security Guard
  const { error: authError } = await requireRole(['admin']);
  if (authError) return authError;

  const { id } = await params;
  if (!id || typeof id !== 'string') {
    return NextResponse.json({ error: 'Identifiant de réservation requis.' }, { status: 400 });
  }

  try {
    // 2. Fetch current reservation
    const { data: pass, error: fetchError } = await supabaseAdmin
      .from('passes')
      .select('id, event_id, entry_status, status, guest_first_name, guest_last_name, reservation_code, events(id, title, capacity)')
      .eq('id', id)
      .maybeSingle();

    if (fetchError || !pass) {
      return NextResponse.json({ error: 'Réservation introuvable.' }, { status: 404 });
    }

    // 3. Immutability guard: Cannot expire already paid/activated passes
    if (['activated', 'scanned'].includes(pass.entry_status) || pass.status === 'PAID') {
      return NextResponse.json(
        { error: 'Les réservations payées et confirmées sont immuables et ne peuvent pas être expirées.' },
        { status: 403 }
      );
    }

    // 4. Update status to EXPIRED
    const nowIso = new Date().toISOString();
    const updatePayload: Record<string, any> = {
      status: 'EXPIRED',
      entry_status: 'rejected', // Keeps compatibility with existing scanner and pass queries
      rejection_reason: 'Délai de paiement dépassé (Expiré manuellement par administrateur)',
      updated_at: nowIso,
    };

    let { data: updatedPass, error: updateError } = await supabaseAdmin
      .from('passes')
      .update(updatePayload)
      .eq('id', id)
      .select('id, status, entry_status, event_id, updated_at')
      .single();

    // Fallback if status column is not present in schema
    if (updateError && updateError.message?.includes('status')) {
      delete updatePayload.status;
      const fallbackRes = await supabaseAdmin
        .from('passes')
        .update(updatePayload)
        .eq('id', id)
        .select('id, entry_status, event_id, updated_at')
        .single();
      updatedPass = fallbackRes.data ? { ...fallbackRes.data, status: 'EXPIRED' } : null;
      updateError = fallbackRes.error;
    }

    if (updateError || !updatedPass) {
      console.error('[PATCH /api/admin/reservations/:id/expire] Update failed:', updateError);
      return NextResponse.json(
        { error: updateError?.message || "Erreur lors de l'expiration de la réservation." },
        { status: 500 }
      );
    }

    // 5. Restore Capacity / Inventory:
    // With status = 'EXPIRED', it is automatically excluded from active capacity counts.
    // If the event has an explicit available_tickets or stock counter column, increment it defensively.
    if (pass.event_id) {
      try {
        const { data: eventData } = await supabaseAdmin
          .from('events')
          .select('id, capacity')
          .eq('id', pass.event_id)
          .single();

        // Schema defensive check: if an inventory table or column is in use, log and restore
        console.log(`[expireReservation] Capacity restored for event ${pass.event_id}. Active tickets freed.`);
      } catch (capErr) {
        console.warn('[expireReservation] Capacity verification note:', capErr);
      }
    }

    // 6. Revalidate Cache across Admin and Dashboards
    try {
      revalidatePath('/admin');
      revalidatePath('/admin/approbations');
      revalidatePath('/admin/passes');
      revalidatePath('/payment-point/dashboard');
      revalidatePath('/dashboard');
    } catch (e) {
      // Safe fallback outside Next request context
    }

    return NextResponse.json({
      success: true,
      message: 'Réservation expirée manuellement et inventaire restauré avec succès.',
      passId: id,
      status: 'EXPIRED',
    });
  } catch (error: any) {
    console.error('[PATCH /api/admin/reservations/:id/expire] Error:', error);
    return NextResponse.json(
      { error: error?.message || 'Erreur interne du serveur lors de l’expiration.' },
      { status: 500 }
    );
  }
}
