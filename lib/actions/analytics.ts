"use server";

import { createClient } from '@supabase/supabase-js';
import { requireRole } from '@/lib/supabase/api-security';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export interface DailyAnalyticsItem {
  date: string; // "YYYY-MM-DD"
  formattedDate: string; // e.g. "14 oct."
  passCount: number;
  dailyRevenue: number;
  volumeDiff: number;
  revenueDiff: number;
  volumeTrend: string; // e.g. "+5 passes", "-2 passes", "0 passes"
  revenueTrend: string; // e.g. "+100 TND", "-50 TND", "0 TND"
}

export interface DashboardAnalyticsResponse {
  dailyData: DailyAnalyticsItem[];
  totalRevenue: number;
  totalPasses: number;
  averageDailyRevenue: number;
  startDate: string;
  endDate: string;
}

/**
 * Server Action: getDashboardAnalytics
 * Fetches approved/paid passes from Supabase, aggregates daily pass counts and revenue,
 * and calculates day-over-day trends for both volume and financial revenue.
 */
export async function getDashboardAnalytics(
  timeframeDays: number = 30
): Promise<DashboardAnalyticsResponse> {
  const { error: authError } = await requireRole(['admin']);
  if (authError) {
    throw new Error('Action non autorisée : droits administrateur requis');
  }

  // 1. Query paid and activated passes
  const { data: passesData, error } = await supabaseAdmin
    .from('passes')
    .select('id, final_price, payment_approved_at, created_at, entry_status')
    .or('payment_approved_at.not.is.null,entry_status.in.(activated,scanned,PAID,paid)')
    .order('payment_approved_at', { ascending: true });

  if (error) {
    console.error('Error fetching passes in getDashboardAnalytics:', error);
    throw new Error('Impossible de récupérer les données analytiques');
  }

  const rawPasses = passesData || [];

  // 2. Build continuous date range
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  // Map to accumulate daily revenue and counts
  const dailyMap = new Map<string, { passCount: number; dailyRevenue: number }>();

  // Initialize all days in the timeframe window (defaults to last N days)
  const daysToInclude = Math.max(7, Math.min(365, timeframeDays));
  for (let i = daysToInclude - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    dailyMap.set(dateStr, { passCount: 0, dailyRevenue: 0 });
  }

  // 3. Aggregate each pass into the appropriate date bucket
  for (const pass of rawPasses) {
    const dateRaw = pass.payment_approved_at || pass.created_at;
    if (!dateRaw) continue;

    const dateStr = dateRaw.split('T')[0];
    const price = Math.max(0, Number(pass.final_price) || 0);

    // If pass is outside the current timeframe window, still add it if valid
    if (!dailyMap.has(dateStr)) {
      dailyMap.set(dateStr, { passCount: 0, dailyRevenue: 0 });
    }

    const current = dailyMap.get(dateStr)!;
    current.passCount += 1;
    current.dailyRevenue += price;
  }

  // 4. Sort dates chronologically ascending
  const sortedDates = Array.from(dailyMap.keys()).sort();

  // If we only want the requested timeframe window (e.g. last 7 or 30 days)
  const windowDates = sortedDates.slice(-daysToInclude);

  // 5. Calculate day-over-day trends
  let totalRevenue = 0;
  let totalPasses = 0;

  const dailyData: DailyAnalyticsItem[] = windowDates.map((dateStr, index) => {
    const entry = dailyMap.get(dateStr) || { passCount: 0, dailyRevenue: 0 };
    totalRevenue += entry.dailyRevenue;
    totalPasses += entry.passCount;

    let volumeDiff = 0;
    let revenueDiff = 0;

    if (index > 0) {
      const prevDate = windowDates[index - 1];
      const prevEntry = dailyMap.get(prevDate) || { passCount: 0, dailyRevenue: 0 };
      volumeDiff = entry.passCount - prevEntry.passCount;
      revenueDiff = entry.dailyRevenue - prevEntry.dailyRevenue;
    }

    // Format trend indicators (e.g. "+5 passes", "-2 passes", "0 passes")
    const volumeTrend = index === 0
      ? "0 passes"
      : volumeDiff > 0
        ? `+${volumeDiff} passes`
        : volumeDiff < 0
          ? `${volumeDiff} passes`
          : "0 passes";

    // Format revenue indicators (e.g. "+150 TND", "-20 TND", "0 TND")
    const revenueTrend = index === 0
      ? "0 TND"
      : revenueDiff > 0
        ? `+${revenueDiff.toFixed(2)} TND`
        : revenueDiff < 0
          ? `${revenueDiff.toFixed(2)} TND`
          : "0 TND";

    // Human readable short date (e.g. "14 oct.")
    const dateObj = new Date(dateStr + "T00:00:00");
    const formattedDate = dateObj.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short'
    });

    return {
      date: dateStr,
      formattedDate,
      passCount: entry.passCount,
      dailyRevenue: Math.round(entry.dailyRevenue * 100) / 100,
      volumeDiff,
      revenueDiff: Math.round(revenueDiff * 100) / 100,
      volumeTrend,
      revenueTrend
    };
  });

  return {
    dailyData,
    totalRevenue: Math.round(totalRevenue * 100) / 100,
    totalPasses,
    averageDailyRevenue: dailyData.length > 0 ? Math.round((totalRevenue / dailyData.length) * 100) / 100 : 0,
    startDate: windowDates[0] || '',
    endDate: windowDates[windowDates.length - 1] || ''
  };
}
