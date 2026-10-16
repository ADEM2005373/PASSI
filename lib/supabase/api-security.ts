import { createClient } from './server';
import { NextResponse } from 'next/server';

export async function requireRole(allowedRoles: string[]) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return { error: NextResponse.json({ error: 'Unauthorized: No session found' }, { status: 401 }), user: null, role: null };
    }

    let { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role, is_suspended')
      .eq('id', user.id)
      .maybeSingle();

    if (!profile && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      try {
        const { createClient: createAdminClient } = await import('@supabase/supabase-js');
        const supabaseAdmin = createAdminClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!
        );
        const meta = user.user_metadata || {};
        const isStaff = user.email?.includes('passi.com');
        const inferredRole = (meta.role || (isStaff ? 'admin' : 'user')).toLowerCase();
        const fullName = meta.full_name || [meta.first_name, meta.last_name].filter(Boolean).join(' ') || (user.email ? user.email.split('@')[0] : 'Utilisateur');

        const { data: newProfile } = await supabaseAdmin
          .from('profiles')
          .upsert({
            id: user.id,
            email: user.email || '',
            full_name: fullName,
            first_name: meta.first_name || fullName.split(' ')[0] || '',
            last_name: meta.last_name || fullName.split(' ').slice(1).join(' ') || '',
            role: inferredRole,
            is_suspended: false,
          }, { onConflict: 'id' })
          .select('role, is_suspended')
          .single();

        if (newProfile) {
          profile = newProfile;
          profileError = null;
        }
      } catch (e) {
        console.warn("api-security profile auto-creation warning:", e);
      }
    }

    if (!profile) {
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
