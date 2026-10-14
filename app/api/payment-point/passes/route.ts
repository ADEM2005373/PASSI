import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireRole } from '@/lib/supabase/api-security';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

/**
 * GET /api/payment-point/passes?eventId=...
 * Strictly returns passes awaiting payment (pre-approved by admin, awaiting cash payment at payment point)
 */
export async function GET(req: NextRequest) {
  const { error: authError } = await requireRole(['payment_point', 'admin']);
  if (authError) return authError;

  const { searchParams } = new URL(req.url);
  const eventId = searchParams.get('eventId') || searchParams.get('event_id');

  try {
    let query = supabaseAdmin
      .from('passes')
      .select('*, events(title, base_price), drink_menus(name)')
      .eq('entry_status', 'awaiting_payment')
      .order('created_at', { ascending: true });

    if (eventId) {
      query = query.eq('event_id', eventId);
    }

    const { data: passesData, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Defensive check: explicitly exclude 'pending', 'rejected', and 'activated'/'scanned'
    const preApprovedPasses = (passesData || []).filter((pass: any) => {
      const s = pass.entry_status || pass.status;
      return s === 'awaiting_payment' || s === 'PENDING_PAYMENT';
    });

    return NextResponse.json({
      success: true,
      passes: preApprovedPasses.map((p: any) => ({
        ...p,
        status: 'PENDING_PAYMENT',
      })),
    });
  } catch (err: any) {
    console.error('Server error in /api/payment-point/passes:', err);
    return NextResponse.json({ error: 'Une erreur interne est survenue' }, { status: 500 });
  }
}
