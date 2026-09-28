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
    const { email, password, instagramHandle, role } = await req.json();

    if (!email || !password || !role) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // 1. Create Auth User
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (authError) throw authError;
    const userId = authData.user.id;

    // 2. Insert Profile
    const { error: profileError } = await supabaseAdmin.from('profiles').insert([
      {
        id: userId,
        email,
        role,
        instagram_handle: instagramHandle || '',
      },
    ]);

    if (profileError) {
      // Rollback if profile creation fails
      await supabaseAdmin.auth.admin.deleteUser(userId);
      throw profileError;
    }

    return NextResponse.json({ success: true, userId });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const { error: authError } = await requireRole(['admin']);
  if (authError) return authError;

  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');

    if (!userId) {
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

    if (profileError) throw profileError;

    // 4. Delete the auth user
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (authError) throw authError;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const { error: authError } = await requireRole(['admin']);
  if (authError) return authError;

  try {
    const { userId, role: newRole } = await req.json();

    if (!userId || !newRole) {
      return NextResponse.json({ error: 'User ID and Role are required' }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from('profiles')
      .update({ role: newRole })
      .eq('id', userId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
