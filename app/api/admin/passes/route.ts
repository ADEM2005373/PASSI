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
    const { passId, action } = await req.json();

    if (!passId || !action) {
      return NextResponse.json({ error: 'Pass ID and action are required' }, { status: 400 });
    }

    if (action === 'approve') {
      // Step 1: Approve -> Awaiting Payment
      const { error } = await supabaseAdmin
        .from('passes')
        .update({ entry_status: 'awaiting_payment' })
        .eq('id', passId);

      if (error) throw error;
      return NextResponse.json({ success: true, status: 'awaiting_payment' });

    } else if (action === 'mark_paid') {
      // Step 2: Mark Paid -> Activated & Generate QR
      const qrUuid = crypto.randomUUID();
      
      // First, get the pass to see if it has a drink
      const { data: pass } = await supabaseAdmin.from('passes').select('drink_id').eq('id', passId).single();
      
      const updateData: any = { 
        entry_status: 'activated',
        entry_qr_uuid: qrUuid
      };
      
      if (pass?.drink_id) {
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
      // Delete the pass request
      const { error } = await supabaseAdmin
        .from('passes')
        .delete()
        .eq('id', passId);

      if (error) throw error;
      return NextResponse.json({ success: true, status: 'deleted' });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
