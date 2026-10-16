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
    // 1. Fetch all profiles with payment_point role
    const { data: cashiers, error: cashiersErr } = await supabaseAdmin
      .from('profiles')
      .select('id, email, full_name, role, is_suspended, created_at')
      .ilike('role', 'payment_point')
      .order('email', { ascending: true });

    if (cashiersErr) {
      console.error('Error fetching cashier profiles:', cashiersErr);
    }

    const cashierList = cashiers || [];
    const cashierMap = new Map<string, any>();
    cashierList.forEach(c => cashierMap.set(c.id, c));

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

    // 4. Fetch all approved passes to compute per-cashier live drawer balances and today stats
    const { data: allPasses, error: passesErr } = await supabaseAdmin
      .from('passes')
      .select('id, final_price, payment_approved_at, approved_by, payment_point_id')
      .in('entry_status', ['activated', 'scanned', 'PAID', 'paid'])
      .not('payment_approved_at', 'is', null);

    if (passesErr) {
      console.error('Error fetching passes for cash management:', passesErr);
    }

    const approvedPasses = allPasses || [];

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
          const passTime = p.payment_approved_at ? new Date(p.payment_approved_at).getTime() : 0;
          const price = Number(p.final_price || 0);

          // Live drawer balance counts passes approved since the last collection
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

      return {
        id: cashier.id,
        email: cashier.email,
        full_name: cashier.full_name || 'Guichetier',
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
