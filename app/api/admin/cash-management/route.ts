import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireRole } from '@/lib/supabase/api-security';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

/**
 * GET /api/admin/cash-management
 * Supervision des caisses :
 * - Discrepancy alerts (écarts de caisse)
 * - Live Cashier Overview (Solde actuel en caisse, statut, dernière remise, etc.)
 * - Audit logs (Historique des clôtures et remises superviseurs)
 */
export async function GET(req: NextRequest) {
  const { error: authError } = await requireRole(['admin']);
  if (authError) return authError;

  try {
    // 1. Fetch all approved/paid passes to compute per-cashier/admin live drawer balances and today stats
    const { data: allPasses, error: passesErr } = await supabaseAdmin
      .from('passes')
      .select('id, final_price, payment_approved_at, approved_by, payment_point_id, created_at, entry_status')
      .in('entry_status', ['activated', 'scanned', 'PAID', 'paid']);

    if (passesErr) {
      console.error('Error fetching passes for cash management:', passesErr);
    }

    const approvedPasses = allPasses || [];
    const activeStaffIds = [
      ...new Set([
        ...approvedPasses.map((p: any) => p.approved_by || p.payment_point_id),
      ].filter(Boolean))
    ];

    // Fetch all profiles designated as cashiers / payment points (or active approvers)
    // Supports 'payment_point', 'PAYMENT_POINT', 'cashier', 'CASHIER'
    const validRoles = ['payment_point', 'PAYMENT_POINT', 'cashier', 'CASHIER'];
    let cashiersQuery = supabaseAdmin
      .from('profiles')
      .select('id, email, full_name, role, is_suspended, created_at');

    if (activeStaffIds.length > 0) {
      cashiersQuery = cashiersQuery.or(
        `role.in.(${validRoles.join(',')}),id.in.(${activeStaffIds.join(',')})`
      );
    } else {
      cashiersQuery = cashiersQuery.in('role', validRoles);
    }

    let { data: cashiers, error: cashiersErr } = await cashiersQuery.order('email', { ascending: true });

    if (cashiersErr) {
      console.error('Error fetching cashier profiles from Supabase, attempting fallback:', cashiersErr);
    }

    let cashierList = cashiers || [];
    // Resilient fallback: if query returned an error or empty list, fetch all profiles and filter in JavaScript
    if (cashiersErr || cashierList.length === 0) {
      const { data: allProfs, error: allProfsErr } = await supabaseAdmin
        .from('profiles')
        .select('id, email, full_name, role, is_suspended, created_at');
      
      if (!allProfsErr && allProfs) {
        cashierList = allProfs.filter((p: any) => {
          const r = (p.role || '').toLowerCase();
          return r === 'payment_point' || r === 'cashier' || (activeStaffIds.length > 0 && activeStaffIds.includes(p.id));
        });
      }
    }

    const cashierMap = new Map<string, any>();
    cashierList.forEach(c => {
      const isSimulation = (c.role || '').toLowerCase() === 'admin';
      const cleanName = c.full_name || (c.email ? c.email.split('@')[0] : 'Guichetier');
      cashierMap.set(c.id, {
        ...c,
        cleanName,
        isSimulation,
        email: isSimulation ? `${cleanName} (Mode Simulation)` : c.email,
        full_name: isSimulation ? `${cleanName} (Mode Simulation)` : cleanName,
      });
    });

    // 2. Fetch all cash_collections (Audit log Tab 2 & for calculating live drawer balances)
    let collectionsList: any[] = [];
    try {
      const { data: cols, error: colErr } = await supabaseAdmin
        .from('cash_collections')
        .select('*')
        .order('collection_time', { ascending: false });

      if (!colErr && cols) {
        collectionsList = cols.map((col: any) => ({
          ...col,
          cashier: cashierMap.get(col.cashier_id) || { email: 'Inconnu', full_name: 'Guichetier Inconnu' }
        }));
      }
    } catch (e) {
      console.warn('cash_collections query warning in admin:', e);
    }

    // 3. Fetch all cash_closures (Audit log Tab 1 & Discrepancy Alerts)
    let closuresList: any[] = [];
    try {
      const { data: clos, error: closErr } = await supabaseAdmin
        .from('cash_closures')
        .select('*')
        .order('created_at', { ascending: false });

      if (!closErr && clos) {
        closuresList = clos.map((item: any) => ({
          ...item,
          cashier: cashierMap.get(item.cashier_id) || { email: 'Inconnu', full_name: 'Guichetier Inconnu' }
        }));
      }
    } catch (e) {
      console.warn('cash_closures query warning in admin:', e);
    }

    // Filter discrepancy alerts
    const discrepancyAlerts = closuresList.filter((c: any) => c.status === 'DISCREPANCY_ALERT');

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const startOfTodayMs = startOfToday.getTime();

    // Map latest collection per cashier
    const latestCollectionByCashier = new Map<string, any>();
    collectionsList.forEach((col: any) => {
      const existing = latestCollectionByCashier.get(col.cashier_id);
      if (!existing || new Date(col.collection_time).getTime() > new Date(existing.collection_time).getTime()) {
        latestCollectionByCashier.set(col.cashier_id, col);
      }
    });

    // 5. Build Live Cashier Cards
    let totalLiveBalanceAll = 0;
    let totalTodayRevenueAll = 0;
    let totalTodayPassesAll = 0;

    const cashiersOverview = cashierList.map((cashier: any) => {
      const lastCol = latestCollectionByCashier.get(cashier.id) || null;
      const lastColTime = lastCol ? new Date(lastCol.collection_time).getTime() : 0;

      let liveDrawerBalance = 0;
      let todayRevenue = 0;
      let todayPassesCount = 0;

      approvedPasses.forEach((p: any) => {
        const approvedBy = p.approved_by || p.payment_point_id;
        if (approvedBy === cashier.id) {
          const passDateStr = p.payment_approved_at || p.created_at;
          const passTime = passDateStr ? new Date(passDateStr).getTime() : 0;
          const price = Number(p.final_price || 0);

          // Live drawer balance counts passes approved since the last collection
          // If no collections yet (lastColTime === 0), it sums all approved passes
          if (passTime > lastColTime) {
            liveDrawerBalance += price;
          }

          // Today's metrics
          if (passTime >= startOfTodayMs) {
            todayRevenue += price;
            todayPassesCount += 1;
          }
        }
      });

      const roundedLive = Math.round(liveDrawerBalance * 100) / 100;
      const roundedToday = Math.round(todayRevenue * 100) / 100;

      totalLiveBalanceAll += roundedLive;
      totalTodayRevenueAll += roundedToday;
      totalTodayPassesAll += todayPassesCount;

      const cleanName = cashier.full_name || (cashier.email ? cashier.email.split('@')[0] : 'Guichetier');
      const isSimulation = (cashier.role || '').toLowerCase() === 'admin';

      return {
        id: cashier.id,
        email: isSimulation ? `${cleanName} (Mode Simulation)` : cashier.email,
        full_name: isSimulation ? `${cleanName} (Mode Simulation)` : cleanName,
        is_simulation: isSimulation,
        is_suspended: Boolean(cashier.is_suspended),
        liveDrawerBalance: roundedLive,
        todayRevenue: roundedToday,
        todayPassesCount,
        lastCollection: lastCol ? {
          amount: Number(lastCol.collected_amount),
          supervisor_name: lastCol.supervisor_name,
          collection_time: lastCol.collection_time,
          notes: lastCol.notes
        } : null
      };
    });

    return NextResponse.json({
      success: true,
      discrepancyAlerts,
      cashiersOverview,
      allClosures: closuresList,
      allCollections: collectionsList,
      summary: {
        totalLiveBalance: Math.round(totalLiveBalanceAll * 100) / 100,
        totalTodayRevenue: Math.round(totalTodayRevenueAll * 100) / 100,
        totalTodayPasses: totalTodayPassesAll,
        alertsCount: discrepancyAlerts.length,
        cashiersCount: cashierList.length
      }
    });

  } catch (err: any) {
    console.error('Server error in /api/admin/cash-management GET:', err);
    return NextResponse.json({ error: 'Erreur interne lors de la récupération des données de supervision' }, { status: 500 });
  }
}
