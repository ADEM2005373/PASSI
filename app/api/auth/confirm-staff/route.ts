import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

/**
 * POST /api/auth/confirm-staff
 * Checks if the provided email belongs to an internal role (ADMIN, BARMAN, SECURITY, PAYMENT_POINT).
 * If yes, auto-confirms their email in auth.users so their login can succeed immediately.
 * If the account belongs to a regular user, it refuses to confirm, preserving the standard user verification flow.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email } = body || {};

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ confirmed: false }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();

    // 1. Check if user has an admin or staff role in profiles
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, role')
      .eq('email', cleanEmail)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ confirmed: false });
    }

    const role = (profile.role || '').toLowerCase();
    const isStaffOrAdmin = ['admin', 'staff', 'barman', 'security', 'payment_point'].includes(role);

    if (!isStaffOrAdmin) {
      // Regular users are NOT auto-confirmed; they must use standard email confirmation
      return NextResponse.json({ confirmed: false });
    }

    // 2. Auto-confirm internal user via Supabase Admin API
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      profile.id,
      { email_confirm: true }
    );

    if (updateError) {
      console.error("[confirm-staff] Error updating user confirmation status:", updateError);
      return NextResponse.json({ confirmed: false }, { status: 500 });
    }

    return NextResponse.json({ confirmed: true, role });
  } catch (err: any) {
    console.error("[confirm-staff] Server exception:", err);
    return NextResponse.json({ confirmed: false }, { status: 500 });
  }
}
