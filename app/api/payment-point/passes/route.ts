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

    // Fetch user profiles to attach full_name and identity
    const userIds = Array.from(new Set(preApprovedPasses.map((p: any) => p.user_id).filter(Boolean)));
    let profilesMap: Record<string, { email?: string; instagram_handle?: string; full_name?: string }> = {};

    if (userIds.length > 0) {
      const { data: profiles } = await supabaseAdmin
        .from('profiles')
        .select('id, email, instagram_handle, full_name')
        .in('id', userIds);
      if (profiles) {
        profiles.forEach((pr: any) => {
          profilesMap[pr.id] = pr;
        });
      }
    }

    return NextResponse.json({
      success: true,
      passes: preApprovedPasses.map((p: any) => {
        const userProf = profilesMap[p.user_id];
        const guestFirst = p.guest_first_name || '';
        const guestLast = p.guest_last_name || '';
        const profileName = userProf?.full_name || '';
        const parts = profileName.trim().split(' ');
        return {
          ...p,
          status: 'PENDING_PAYMENT',
          instagram_handle: userProf?.instagram_handle || '@inconnu',
          user_email: userProf?.email || '',
          user_name: profileName || [guestFirst, guestLast].filter(Boolean).join(' '),
          user: {
            first_name: guestFirst || parts[0] || '',
            last_name: guestLast || parts.slice(1).join(' ') || '',
            full_name: profileName || [guestFirst, guestLast].filter(Boolean).join(' ') || ''
          }
        };
      }),
    });
  } catch (err: any) {
    console.error('Server error in /api/payment-point/passes:', err);
    return NextResponse.json({ error: 'Une erreur interne est survenue' }, { status: 500 });
  }
}
