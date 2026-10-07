import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireRole } from '@/lib/supabase/api-security';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export async function PATCH(req: NextRequest) {
  const { error: authError } = await requireRole(['admin']);
  if (authError) return authError;

  try {
    const { passId, action, rejectionReason } = await req.json();

    if (!passId || !action) {
      return NextResponse.json({ error: 'Pass ID and action are required' }, { status: 400 });
    }

    // Backend Validation Guards
    const { data: existingPass, error: fetchError } = await supabaseAdmin
      .from('passes')
      .select('entry_status, drink_id')
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
      // Step 1: Approve -> Awaiting Payment
      const { error } = await supabaseAdmin
        .from('passes')
        .update({ entry_status: 'awaiting_payment', updated_at: new Date().toISOString() })
        .eq('id', passId);

      if (error) throw error;
      return NextResponse.json({ success: true, status: 'awaiting_payment' });

    } else if (action === 'mark_paid') {
      // Step 2: Mark Paid -> Activated & Generate QR
      const qrUuid = crypto.randomUUID();
      
      const updateData: any = { 
        entry_status: 'activated',
        entry_qr_uuid: qrUuid,
        updated_at: new Date().toISOString()
      };
      
      if (existingPass.drink_id) {
        updateData.drink_status = 'activated';
        updateData.drink_qr_uuid = crypto.randomUUID();
      }

      const { error } = await supabaseAdmin
        .from('passes')
        .update(updateData)
        .eq('id', passId);

      if (error) throw error;
      
      return NextResponse.json({ success: true, status: 'activated' });

    } else if (action === 'reject') {
      // Soft delete / Reject
      const { error } = await supabaseAdmin
        .from('passes')
        .update({ 
          entry_status: 'rejected',
          rejection_reason: rejectionReason || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', passId);

      if (error) throw error;
      return NextResponse.json({ success: true, status: 'rejected' });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
