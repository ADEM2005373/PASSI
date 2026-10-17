import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireRole } from '@/lib/supabase/api-security';

// Initialize Supabase Admin client with Service Role Key
// This allows us to safely bypass Row Level Security to create and delete users
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

export async function POST(req: NextRequest) {
  const { error: authError } = await requireRole(['admin']);
  if (authError) return authError;

  try {
    const body = await req.json();
    const { 
      email, 
      password, 
      instagramHandle, 
      role, 
      is_suspended, 
      sell_point_name, 
      sellPointName, 
      firstName, 
      lastName 
    } = body || {};

    if (!email || typeof email !== 'string' || !password || typeof password !== 'string' || !role || typeof role !== 'string') {
      return NextResponse.json({ error: 'Champs requis manquants ou invalides (email, password, role)' }, { status: 400 });
    }

    const rawRole = role.toLowerCase();
    const normalizedRole = rawRole === 'cashier' ? 'payment_point' : rawRole;
    if (!['admin', 'user', 'security', 'barman', 'payment_point'].includes(normalizedRole)) {
      return NextResponse.json({ error: 'Rôle invalide' }, { status: 400 });
    }

    const resolvedSellPointName = (sell_point_name || sellPointName || '').trim();
    const resolvedFirstName = (firstName || '').trim();
    const resolvedLastName = (lastName || '').trim();
    const resolvedFullName = resolvedSellPointName || 
      (resolvedFirstName && resolvedLastName ? `${resolvedFirstName} ${resolvedLastName}` : (resolvedFirstName || ''));

    // 1. Create Auth User with email_confirm: true to bypass email confirmation for staff/admin
    const userMetadata: Record<string, any> = {
      role: normalizedRole.toUpperCase(),
    };
    if (resolvedSellPointName) userMetadata.sell_point_name = resolvedSellPointName;
    if (resolvedFirstName) userMetadata.first_name = resolvedFirstName;
    if (resolvedLastName) userMetadata.last_name = resolvedLastName;
    if (resolvedFullName) userMetadata.full_name = resolvedFullName;

    const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.createUser({
      email: String(email).trim().toLowerCase(),
      password: String(password),
      email_confirm: true,
      user_metadata: userMetadata,
    });

    if (authErr) {
      console.error("Auth creation error in users POST:", authErr);
      return NextResponse.json({ error: authErr.message || "Impossible de créer le compte utilisateur" }, { status: 400 });
    }
    const userId = authData.user.id;

    // 2. Insert Profile with defensive fallback if sell_point_name column not migrated yet
    const profilePayload: Record<string, any> = {
      id: userId,
      email: String(email).trim().toLowerCase(),
      role: normalizedRole,
      instagram_handle: instagramHandle ? String(instagramHandle).slice(0, 50) : '',
      is_suspended: Boolean(is_suspended),
      full_name: resolvedFullName || null,
      first_name: resolvedFirstName || null,
      last_name: resolvedLastName || null,
    };
    if (resolvedSellPointName) {
      profilePayload.sell_point_name = resolvedSellPointName;
    }

    let { error: profileError } = await supabaseAdmin.from('profiles').insert([profilePayload]);

    if (profileError && profileError.message?.includes('sell_point_name')) {
      delete profilePayload.sell_point_name;
      const retryResult = await supabaseAdmin.from('profiles').insert([profilePayload]);
      profileError = retryResult.error;
    }

    if (profileError) {
      console.error("Profile creation error in users POST:", profileError);
      // Rollback auth user if profile insertion failed
      await supabaseAdmin.auth.admin.deleteUser(userId);
      return NextResponse.json({ error: "Impossible de créer le profil utilisateur" }, { status: 500 });
    }

    return NextResponse.json({ success: true, userId });
  } catch (error: any) {
    console.error("Server error in users POST:", error);
    return NextResponse.json({ error: "Une erreur interne est survenue" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const { error: authError } = await requireRole(['admin']);
  if (authError) return authError;

  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');

    if (!userId || typeof userId !== 'string') {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 });
    }

    // 1. Find passes owned by this user
    const { data: userPasses } = await supabaseAdmin
      .from('passes')
      .select('id')
      .eq('user_id', userId);

    if (userPasses && userPasses.length > 0) {
      const passIds = userPasses.map(p => p.id);
      // Delete pass_drinks linked to their passes
      await supabaseAdmin.from('pass_drinks').delete().in('pass_id', passIds);
      // Delete their passes
      await supabaseAdmin.from('passes').delete().eq('user_id', userId);
    }

    // 2. Delete events created by this user
    await supabaseAdmin.from('events').delete().eq('creator_id', userId);

    // 3. Delete the profile
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .delete()
      .eq('id', userId);

    if (profileError) {
      console.error("Profile deletion error in users DELETE:", profileError);
      return NextResponse.json({ error: "Impossible de supprimer le profil" }, { status: 500 });
    }

    // 4. Delete the auth user
    const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (authDeleteError) {
      console.error("Auth deletion error in users DELETE:", authDeleteError);
      return NextResponse.json({ error: "Impossible de supprimer le compte d'authentification" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Server error in users DELETE:", error);
    return NextResponse.json({ error: "Une erreur interne est survenue" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const { error: authError } = await requireRole(['admin']);
  if (authError) return authError;

  try {
    const body = await req.json();
    const { userId, role, email, password, instagramHandle, is_suspended, sell_point_name, sellPointName, full_name } = body || {};

    if (!userId || typeof userId !== 'string') {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    const resolvedSellPoint = sell_point_name !== undefined ? sell_point_name : sellPointName;

    // 1. Update Auth User if email, password, or metadata provided
    const authUpdates: Record<string, any> = {};
    if (email) authUpdates.email = String(email).trim().toLowerCase();
    if (password) authUpdates.password = String(password);
    if (resolvedSellPoint !== undefined) {
      authUpdates.user_metadata = {
        sell_point_name: resolvedSellPoint ? String(resolvedSellPoint).trim() : null,
      };
    }

    if (Object.keys(authUpdates).length > 0) {
      const { error: authUpdateError } = await supabaseAdmin.auth.admin.updateUserById(userId, authUpdates);
      if (authUpdateError) {
        console.error("Auth update error in users PATCH:", authUpdateError);
        return NextResponse.json({ error: "Impossible de modifier les identifiants" }, { status: 400 });
      }
    }

    // 2. Update Profile
    const profileUpdates: any = {};
    if (role) {
      const rawRole = role.toLowerCase();
      const normRole = rawRole === 'cashier' ? 'payment_point' : rawRole;
      if (['admin', 'user', 'security', 'barman', 'payment_point'].includes(normRole)) {
        profileUpdates.role = normRole;
      }
    }
    if (email) profileUpdates.email = String(email).trim().toLowerCase();
    if (instagramHandle !== undefined) profileUpdates.instagram_handle = String(instagramHandle).slice(0, 50);
    if (is_suspended !== undefined) profileUpdates.is_suspended = Boolean(is_suspended);
    if (full_name !== undefined) profileUpdates.full_name = full_name;
    if (resolvedSellPoint !== undefined) {
      profileUpdates.sell_point_name = resolvedSellPoint ? String(resolvedSellPoint).trim() : null;
      if (!profileUpdates.full_name && resolvedSellPoint) {
        profileUpdates.full_name = String(resolvedSellPoint).trim();
      }
    }

    if (Object.keys(profileUpdates).length > 0) {
      let { error } = await supabaseAdmin
        .from('profiles')
        .update(profileUpdates)
        .eq('id', userId);

      if (error && error.message?.includes('sell_point_name')) {
        delete profileUpdates.sell_point_name;
        const retryResult = await supabaseAdmin
          .from('profiles')
          .update(profileUpdates)
          .eq('id', userId);
        error = retryResult.error;
      }

      if (error) {
        console.error("Profile update error in users PATCH:", error);
        return NextResponse.json({ error: "Impossible de modifier le profil" }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Server error in users PATCH:", error);
    return NextResponse.json({ error: "Une erreur interne est survenue" }, { status: 500 });
  }
}
