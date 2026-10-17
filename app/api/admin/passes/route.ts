import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { createClient } from '@supabase/supabase-js';
import { requireRole } from '@/lib/supabase/api-security';
import { approvePhase1PassAction, rejectPassAction, approvePassPaymentAction } from '@/lib/actions/pass-lifecycle';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: NextRequest) {
  const { error: authError } = await requireRole(['admin']);
  if (authError) return authError;

  const { searchParams } = new URL(req.url);
  const statusFilter = searchParams.get('status');
  const eventIdFilter = searchParams.get('eventId');

  try {
    let query = supabaseAdmin
      .from('passes')
      .select(`
        *,
        event:events(*),
        creator:profiles!passes_created_by_fkey(id, email, full_name, role),
        approver:profiles!passes_approved_by_fkey(id, email, full_name, role)
      `)
      .order('created_at', { ascending: false });

    if (statusFilter && statusFilter !== 'all') {
      const lower = statusFilter.toLowerCase();
      const upper = statusFilter.toUpperCase();
      query = query.or(`entry_status.eq.${lower},entry_status.eq.${upper}`);
    }

    if (eventIdFilter && eventIdFilter !== 'all' && eventIdFilter.trim() !== '') {
      query = query.eq('event_id', eventIdFilter);
    }

    let { data, error } = await query;

    // Fallback if relationship embedding fails (e.g. if foreign keys are not yet applied)
    if (error) {
      console.warn("Foreign relationship select failed in GET /api/admin/passes, falling back:", error);
      let fallbackQuery = supabaseAdmin
        .from('passes')
        .select('*, event:events(*)')
        .order('created_at', { ascending: false });

      if (statusFilter && statusFilter !== 'all') {
        const lower = statusFilter.toLowerCase();
        const upper = statusFilter.toUpperCase();
        fallbackQuery = fallbackQuery.or(`entry_status.eq.${lower},entry_status.eq.${upper}`);
      }
      if (eventIdFilter && eventIdFilter !== 'all' && eventIdFilter.trim() !== '') {
        fallbackQuery = fallbackQuery.eq('event_id', eventIdFilter);
      }

      const fallbackRes = await fallbackQuery;
      data = fallbackRes.data;

      if (!data) {
        let eventsOnlyQuery = supabaseAdmin
          .from('passes')
          .select('*, events(*)')
          .order('created_at', { ascending: false });
        if (statusFilter && statusFilter !== 'all') {
          const lower = statusFilter.toLowerCase();
          const upper = statusFilter.toUpperCase();
          eventsOnlyQuery = eventsOnlyQuery.or(`entry_status.eq.${lower},entry_status.eq.${upper}`);
        }
        if (eventIdFilter && eventIdFilter !== 'all' && eventIdFilter.trim() !== '') {
          eventsOnlyQuery = eventsOnlyQuery.eq('event_id', eventIdFilter);
        }
        data = (await eventsOnlyQuery).data;
      }
    }

    if (!data) return NextResponse.json({ passes: [] });

    // Ensure profiles data is mapped for pass owners, approvers, and creators
    const userIds = [...new Set(data.map((p: any) => p.user_id).filter(Boolean))];
    const approverIds = [...new Set(data.map((p: any) => p.approved_by || p.payment_point_id).filter(Boolean))];
    const creatorIds = [...new Set(data.map((p: any) => p.created_by).filter(Boolean))];
    const allProfileIds = [...new Set([...userIds, ...approverIds, ...creatorIds])];

    let profilesMap: Record<string, any> = {};
    if (allProfileIds.length > 0) {
      const { data: profs } = await supabaseAdmin
        .from('profiles')
        .select('id, email, full_name, instagram_handle, role')
        .in('id', allProfileIds);
      if (profs) {
        profs.forEach((pr: any) => { profilesMap[pr.id] = pr; });
      }
    }

    const formattedPasses = data.map((pass: any) => {
      const prof = profilesMap[pass.user_id] || pass.user || pass.profiles || {};
      const approverProf = pass.approver || profilesMap[pass.approved_by] || profilesMap[pass.payment_point_id] || null;
      const creatorProf = pass.creator || profilesMap[pass.created_by] || null;
      const evt = pass.event || pass.events || {};

      const isManualAdmin = Boolean(
        pass.created_by ||
        pass.pass_origin === 'ADMIN' ||
        ['VIP', 'GIFT', 'INVITATION'].includes(pass.pass_type?.toUpperCase())
      );
      const passOrigin = pass.pass_origin || (isManualAdmin ? 'ADMIN' : 'USER');

      // Format creator with full_name, first_name, last_name, email, role
      const formattedCreator = creatorProf ? {
        ...creatorProf,
        first_name: creatorProf.first_name || (creatorProf.full_name ? creatorProf.full_name.split(' ')[0] : (creatorProf.email ? creatorProf.email.split('@')[0] : '')),
        last_name: creatorProf.last_name || (creatorProf.full_name && creatorProf.full_name.split(' ').length > 1 ? creatorProf.full_name.split(' ').slice(1).join(' ') : ''),
      } : null;

      // Format owner with full_name, first_name, last_name, email, instagram
      const formattedOwner = prof && prof.id ? {
        ...prof,
        first_name: prof.first_name || (prof.full_name ? prof.full_name.split(' ')[0] : (pass.guest_first_name || '')),
        last_name: prof.last_name || (prof.full_name && prof.full_name.split(' ').length > 1 ? prof.full_name.split(' ').slice(1).join(' ') : (pass.guest_last_name || '')),
        instagram: prof.instagram_handle || '',
      } : null;

      // Resolve instagram_handle: avoid '@unknown' fallback
      let resolvedInstagram = '';
      if (prof.instagram_handle && prof.instagram_handle.trim() !== '') {
        resolvedInstagram = prof.instagram_handle.trim();
      } else if (pass.instagram_handle && pass.instagram_handle.trim() !== '' && pass.instagram_handle !== '@unknown') {
        resolvedInstagram = pass.instagram_handle.trim();
      } else if (prof.email) {
        resolvedInstagram = `(${prof.email})`;
      } else if (prof.full_name) {
        resolvedInstagram = `@${prof.full_name.toLowerCase().replace(/\s+/g, '.')}`;
      }

      return {
        ...pass,
        status: pass.entry_status || pass.status,
        entry_status: pass.entry_status || pass.status,
        pass_origin: passOrigin,
        events: evt,
        event: evt,
        profiles: prof,
        user: prof,
        owner: formattedOwner,
        approver: approverProf,
        creator: formattedCreator,
        instagram_handle: resolvedInstagram,
        drink_menus: pass.drink_name ? { name: pass.drink_name } : (pass.drink_menus || null),
      };
    });

    return NextResponse.json({ passes: formattedPasses });
  } catch (err: any) {
    console.error("Error in GET /api/admin/passes:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const { error: authError } = await requireRole(['admin']);
  if (authError) return authError;

  try {
    const body = await req.json();
    const { passId, action, rejectionReason } = body || {};

    if (!passId || typeof passId !== 'string' || !action || typeof action !== 'string') {
      return NextResponse.json({ error: 'Pass ID and valid action are required' }, { status: 400 });
    }

    if (!['approve', 'mark_paid', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'Action non autorisée' }, { status: 400 });
    }

    // Backend Validation Guards
    const { data: existingPass, error: fetchError } = await supabaseAdmin
      .from('passes')
      .select('*')
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
      const result = await approvePhase1PassAction(passId);
      return NextResponse.json(result);

    } else if (action === 'mark_paid') {
      // Step 2: Mark Paid -> Delegate to approvePassPaymentAction to capture Admin/Cashier approver
      const result = await approvePassPaymentAction(passId);
      return NextResponse.json(result);

    } else if (action === 'reject') {
      const result = await rejectPassAction(passId, rejectionReason);
      return NextResponse.json(result);
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error: any) {
    console.error("Server error in passes PATCH:", error);
    return NextResponse.json({ error: "Une erreur interne est survenue" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const { error: authError } = await requireRole(['admin']);
  if (authError) return authError;

  try {
    const body = await req.json();
    const { passId, holderNameConfirmation } = body || {};

    if (!passId || typeof passId !== 'string') {
      return NextResponse.json({ error: 'Identifiant du pass requis' }, { status: 400 });
    }

    if (!holderNameConfirmation || typeof holderNameConfirmation !== 'string') {
      return NextResponse.json(
        { error: 'Veuillez saisir le nom du titulaire pour confirmer la suppression.' },
        { status: 400 }
      );
    }

    // 1. Fetch pass without ambiguous relationship embedding
    const { data: pass, error: fetchError } = await supabaseAdmin
      .from('passes')
      .select('id, guest_first_name, guest_last_name, user_id, entry_status')
      .eq('id', passId)
      .maybeSingle();

    if (fetchError) {
      console.error('Error fetching pass for deletion:', fetchError);
      return NextResponse.json({ error: 'Erreur lors de la recherche du pass: ' + fetchError.message }, { status: 500 });
    }

    if (!pass) {
      return NextResponse.json({ error: 'Pass introuvable' }, { status: 404 });
    }

    // Fetch user profile name separately if user_id is present
    let profileFullName = '';
    if (pass.user_id) {
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('full_name')
        .eq('id', pass.user_id)
        .maybeSingle();
      profileFullName = (profile?.full_name || '').trim();
    }

    // 2. Compute expected holder names with whitespace normalization
    const normalize = (s: string) => (s || '').trim().replace(/\s+/g, ' ').toLowerCase();

    const guestFullName = [pass.guest_first_name, pass.guest_last_name]
      .map(s => (s || '').trim())
      .filter(Boolean)
      .join(' ');
    
    const expectedCandidates = [guestFullName, profileFullName]
      .filter(n => n.length > 0)
      .map(normalize);

    const inputClean = normalize(holderNameConfirmation);
    const isMatched = expectedCandidates.includes(inputClean);

    if (!isMatched) {
      return NextResponse.json(
        {
          error: `Le nom saisi ne correspond pas. Nom attendu : "${guestFullName || profileFullName || 'Inconnu'}"`,
        },
        { status: 400 }
      );
    }

    // 3. Delete associated pass_drinks first to prevent foreign key errors
    await supabaseAdmin
      .from('pass_drinks')
      .delete()
      .eq('pass_id', passId);

    // 4. Delete pass strictly by id without status filter (allows ACTIVATED, PENDING, PAID, etc.)
    const { data: deletedData, error: deleteError } = await supabaseAdmin
      .from('passes')
      .delete()
      .eq('id', passId)
      .select('id');

    if (deleteError) {
      console.error('Error deleting pass in admin DELETE:', deleteError);
      if (deleteError.message?.includes('immutable and cannot be deleted')) {
        return NextResponse.json(
          {
            error:
              "Ce pass est finalisé/payé. Pour autoriser sa suppression par les administrateurs, appliquez la migration 'supabase/allow_admin_delete_pass.sql'.",
          },
          { status: 403 }
        );
      }
      return NextResponse.json({ error: 'Impossible de supprimer le pass: ' + deleteError.message }, { status: 500 });
    }

    if (!deletedData || deletedData.length === 0) {
      return NextResponse.json(
        { error: "Pass introuvable ou suppression bloquée par les permissions (RLS)." },
        { status: 404 }
      );
    }

    try {
      revalidatePath('/admin');
      revalidatePath('/admin/approbations');
    } catch (e) {
      // safe fallback if outside server action context
    }

    return NextResponse.json({ success: true, message: 'Pass supprimé avec succès' });
  } catch (err: any) {
    console.error('Server error in admin passes DELETE:', err);
    return NextResponse.json({ error: 'Une erreur interne est survenue' }, { status: 500 });
  }
}

