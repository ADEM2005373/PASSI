import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireRole } from '@/lib/supabase/api-security';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

/**
 * GET /api/payment-point/cash-management
 * Returns cashier POS live drawer balance, today's revenue, approved passes, and history
 */
export async function GET(req: NextRequest) {
  const { error: authError, user } = await requireRole(['payment_point', 'admin']);
  if (authError || !user) return authError;

  const cashierId = user.id;

  try {
    // 1. Fetch latest supervisor collection for this cashier
    let lastCollection: any = null;
    let collectionsHistory: any[] = [];
    try {
      const { data: collections, error: colErr } = await supabaseAdmin
        .from('cash_collections')
        .select('*')
        .eq('cashier_id', cashierId)
        .order('collection_time', { ascending: false })
        .limit(20);

      if (!colErr && collections) {
        collectionsHistory = collections;
        lastCollection = collections[0] || null;
      }
    } catch (e) {
      console.warn('cash_collections query warning:', e);
    }

    // 2. Query passes approved by this cashier
    // We match on approved_by = cashierId OR payment_point_id = cashierId
    const { data: allApprovedPasses, error: passesErr } = await supabaseAdmin
      .from('passes')
      .select('id, guest_first_name, guest_last_name, user_id, final_price, payment_approved_at, approved_by, payment_point_id, events(title)')
      .or(`approved_by.eq.${cashierId},payment_point_id.eq.${cashierId}`)
      .in('entry_status', ['activated', 'scanned', 'PAID', 'paid'])
      .order('payment_approved_at', { ascending: false });

    if (passesErr) {
      console.error('Error fetching approved passes for cashier:', passesErr);
    }

    const passes = allApprovedPasses || [];

    // 3. Compute Live Cash Drawer Balance (Solde En Caisse Actuel)
    // Formula: Sum of final_price of passes approved since the last cash_collection timestamp
    const lastCollectionTime = lastCollection ? new Date(lastCollection.collection_time).getTime() : 0;
    
    let liveDrawerBalance = 0;
    const passesSinceCollection: any[] = [];

    passes.forEach((p: any) => {
      const approvedTime = p.payment_approved_at ? new Date(p.payment_approved_at).getTime() : 0;
      if (approvedTime > lastCollectionTime) {
        liveDrawerBalance += Number(p.final_price || 0);
        passesSinceCollection.push(p);
      }
    });

    // 4. Compute Today's Revenue & Passes
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const startOfTodayMs = startOfToday.getTime();

    let todayRevenue = 0;
    let todayPassesCount = 0;
    const todayPasses: any[] = [];

    passes.forEach((p: any) => {
      const approvedTime = p.payment_approved_at ? new Date(p.payment_approved_at).getTime() : 0;
      if (approvedTime >= startOfTodayMs) {
        todayRevenue += Number(p.final_price || 0);
        todayPassesCount += 1;
        todayPasses.push({
          id: p.id,
          guestName: [p.guest_first_name, p.guest_last_name].filter(Boolean).join(' ') || 'Invité',
          eventTitle: (p.events as any)?.title || 'Événement Passi',
          price: Number(p.final_price || 0),
          approvedAt: p.payment_approved_at || new Date().toISOString()
        });
      }
    });

    // 5. Fetch Closures History for this cashier
    let closuresHistory: any[] = [];
    try {
      const { data: closures, error: closErr } = await supabaseAdmin
        .from('cash_closures')
        .select('*')
        .eq('cashier_id', cashierId)
        .order('created_at', { ascending: false })
        .limit(20);

      if (!closErr && closures) {
        closuresHistory = closures;
      }
    } catch (e) {
      console.warn('cash_closures query warning:', e);
    }

    return NextResponse.json({
      success: true,
      cashierId,
      liveDrawerBalance: Math.round(liveDrawerBalance * 100) / 100,
      todayRevenue: Math.round(todayRevenue * 100) / 100,
      todayPassesCount,
      lastCollection,
      todayPasses,
      closuresHistory,
      collectionsHistory,
    });

  } catch (err: any) {
    console.error('Server error in /api/payment-point/cash-management GET:', err);
    return NextResponse.json({ error: 'Erreur interne lors de la récupération des données de caisse' }, { status: 500 });
  }
}

/**
 * POST /api/payment-point/cash-management
 * Handles:
 * 1. action = "close" (Clôture journalière à l'aveugle avec détection d'écart)
 * 2. action = "collect" (Remise de fonds à un superviseur et remise à zéro du solde en caisse)
 */
export async function POST(req: NextRequest) {
  const { error: authError, user } = await requireRole(['payment_point', 'admin']);
  if (authError || !user) return authError;

  const cashierId = user.id;

  try {
    const body = await req.json();
    const { action } = body || {};

    // ── ACTION 1: CLÔTURE DE CAISSE JOURNALIÈRE (BLIND CLOSE) ──
    if (action === 'close') {
      const { declared_amount, notes } = body;
      const declaredNum = Number(declared_amount);

      if (isNaN(declaredNum) || declaredNum < 0) {
        return NextResponse.json({ error: 'Montant physique compté invalide' }, { status: 400 });
      }

      // Calculate expected amount from passes approved today by this cashier
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      const startOfTodayIso = startOfToday.toISOString();

      const { data: todayPasses, error: passesErr } = await supabaseAdmin
        .from('passes')
        .select('id, final_price, payment_approved_at')
        .or(`approved_by.eq.${cashierId},payment_point_id.eq.${cashierId}`)
        .in('entry_status', ['activated', 'scanned', 'PAID', 'paid'])
        .gte('payment_approved_at', startOfTodayIso);

      if (passesErr) {
        console.error('Error fetching today passes for closure:', passesErr);
      }

      const count = (todayPasses || []).length;
      const expectedAmount = (todayPasses || []).reduce((sum, p) => sum + Number(p.final_price || 0), 0);
      const roundedExpected = Math.round(expectedAmount * 100) / 100;
      const roundedDeclared = Math.round(declaredNum * 100) / 100;
      const discrepancy = Math.round((roundedDeclared - roundedExpected) * 100) / 100;

      const isMatched = discrepancy === 0;
      const status = isMatched ? 'MATCHED' : 'DISCREPANCY_ALERT';

      if (!isMatched && (!notes || !notes.trim())) {
        return NextResponse.json({ 
          error: "Un écart de caisse a été détecté. Une note justificative d'explication est strictement obligatoire.",
          requiresNotes: true,
          discrepancy,
          expectedAmount: roundedExpected,
          declaredAmount: roundedDeclared
        }, { status: 422 });
      }

      // Insert record into cash_closures
      const { data: newClosure, error: insertErr } = await supabaseAdmin
        .from('cash_closures')
        .insert({
          cashier_id: cashierId,
          closure_date: new Date().toISOString().split('T')[0],
          passes_approved_count: count,
          expected_amount: roundedExpected,
          declared_amount: roundedDeclared,
          status,
          notes: notes?.trim() || null,
        })
        .select('*')
        .single();

      if (insertErr) {
        console.error('Error inserting cash closure:', insertErr);
        return NextResponse.json({ 
          error: "Erreur lors de l'enregistrement de la clôture. Veuillez vérifier que la migration SQL a été exécutée.",
          details: insertErr.message
        }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        closure: newClosure,
        status,
        discrepancy,
        expectedAmount: roundedExpected,
        declaredAmount: roundedDeclared,
        message: isMatched 
          ? "Caisse clôturée avec succès. Aucun écart détecté."
          : `Clôture enregistrée avec un écart de ${discrepancy > 0 ? '+' : ''}${discrepancy} TND. Signalement transmis à l'administrateur.`
      });
    }

    // ── ACTION 2: REMISE DE CAISSE AU SUPERVISEUR (COLLECTION / RESET) ──
    if (action === 'collect') {
      const { supervisor_name, collected_amount, notes } = body;

      if (!supervisor_name || !supervisor_name.trim()) {
        return NextResponse.json({ error: 'Le nom et prénom du superviseur sont requis' }, { status: 400 });
      }

      const collectedNum = Number(collected_amount);
      if (isNaN(collectedNum) || collectedNum <= 0) {
        return NextResponse.json({ error: 'Le montant remis doit être un nombre positif supérieur à zéro' }, { status: 400 });
      }

      // Insert into cash_collections
      const { data: newCollection, error: colErr } = await supabaseAdmin
        .from('cash_collections')
        .insert({
          cashier_id: cashierId,
          supervisor_name: supervisor_name.trim(),
          collected_amount: Math.round(collectedNum * 100) / 100,
          collection_time: new Date().toISOString(),
          notes: notes?.trim() || null,
        })
        .select('*')
        .single();

      if (colErr) {
        console.error('Error inserting cash collection:', colErr);
        return NextResponse.json({ 
          error: "Erreur lors de l'enregistrement de la remise de fonds. Veuillez vérifier la migration SQL.",
          details: colErr.message
        }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        collection: newCollection,
        message: `Remise de ${newCollection.collected_amount} TND effectuée avec succès au superviseur ${newCollection.supervisor_name}. Le solde en caisse a été réinitialisé à 0.00 TND.`
      });
    }

    return NextResponse.json({ error: 'Action non reconnue' }, { status: 400 });

  } catch (err: any) {
    console.error('Server error in /api/payment-point/cash-management POST:', err);
    return NextResponse.json({ error: 'Erreur interne lors de la transaction' }, { status: 500 });
  }
}
