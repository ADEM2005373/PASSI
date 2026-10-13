import { createClient } from './server';
import { NextResponse } from 'next/server';

export async function requireRole(allowedRoles: string[]) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return { error: NextResponse.json({ error: 'Unauthorized: No session found' }, { status: 401 }), user: null, role: null };
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role, is_suspended')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return { error: NextResponse.json({ error: 'Unauthorized: Profile not found' }, { status: 401 }), user: null, role: null };
    }

    if (profile.is_suspended) {
      return { error: NextResponse.json({ error: 'Compte suspendu. Veuillez contacter un administrateur.' }, { status: 403 }), user: null, role: null };
    }

    const currentRole = (profile.role || '').toLowerCase();
    const normalizedAllowedRoles = allowedRoles.map(r => r.toLowerCase());

    if (!normalizedAllowedRoles.includes(currentRole)) {
      return { error: NextResponse.json({ error: 'Forbidden: Insufficient permissions' }, { status: 403 }), user, role: currentRole };
    }

    return { error: null, user, role: currentRole };
  } catch (err: any) {
    console.error("Security verification error:", err);
    return { error: NextResponse.json({ error: 'Internal Server Error' }, { status: 500 }), user: null, role: null };
  }
}
