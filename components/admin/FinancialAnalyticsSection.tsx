"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  FileText, 
  FileSpreadsheet, 
  Calendar, 
  Ticket, 
  Loader2, 
  Sparkles,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';
import { api } from '@/lib/services/api';
import { generateCSVReport, generatePDFReport } from '@/lib/utils/analytics-export';
import { DashboardAnalyticsResponse, DailyAnalyticsItem } from '@/lib/actions/analytics';

interface FinancialAnalyticsSectionProps {
  initialTimeframe?: number;
  className?: string;
}

export function FinancialAnalyticsSection({
  initialTimeframe = 30,
  className = "",
}: FinancialAnalyticsSectionProps) {
  const [isMounted, setIsMounted] = useState(false);
  const [timeframe, setTimeframe] = useState<number>(initialTimeframe);
  const [analytics, setAnalytics] = useState<DashboardAnalyticsResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);
  const [isExportingCsv, setIsExportingCsv] = useState<boolean>(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Fetch financial analytics when timeframe changes
  useEffect(() => {
    let isCancelled = false;
    const fetchAnalytics = async () => {
      setIsLoading(true);
      try {
        const data = await api.getDashboardAnalytics(timeframe);
        if (!isCancelled) {
          setAnalytics(data);
        }
      } catch (err) {
        console.error("Failed to load financial analytics:", err);
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    };

    fetchAnalytics();
    return () => {
      isCancelled = true;
    };
  }, [timeframe]);

  // Overall metrics calculation
  const metrics = useMemo(() => {
    if (!analytics || !analytics.dailyData || analytics.dailyData.length === 0) {
      return { peakDay: null, overallGrowthRate: 0 };
    }

    const peak = analytics.dailyData.reduce((prev, curr) => 
      curr.dailyRevenue > prev.dailyRevenue ? curr : prev
    , analytics.dailyData[0]);

    // Trend comparing second half of timeframe with first half
    const half = Math.floor(analytics.dailyData.length / 2);
    const firstHalfRev = analytics.dailyData.slice(0, half).reduce((sum, d) => sum + d.dailyRevenue, 0);
    const secondHalfRev = analytics.dailyData.slice(half).reduce((sum, d) => sum + d.dailyRevenue, 0);
    const growth = firstHalfRev > 0 ? ((secondHalfRev - firstHalfRev) / firstHalfRev) * 100 : 0;

    return {
      peakDay: peak && peak.dailyRevenue > 0 ? peak : null,
      overallGrowthRate: Math.round(growth * 10) / 10
    };
  }, [analytics]);

  const handleExportPDF = () => {
    if (!analytics || analytics.dailyData.length === 0) return;
    setIsExportingPdf(true);
    try {
      generatePDFReport(analytics);
    } catch (err: any) {
      console.error("Erreur export PDF:", err);
      alert("Erreur lors de la génération du rapport PDF: " + err.message);
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handleExportCSV = () => {
    if (!analytics || analytics.dailyData.length === 0) return;
    setIsExportingCsv(true);
    try {
      generateCSVReport(analytics);
    } catch (err: any) {
      console.error("Erreur export CSV:", err);
      alert("Erreur lors de la génération de l'export CSV: " + err.message);
    } finally {
      setIsExportingCsv(false);
    }
  };

  // Custom Chart Tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data: DailyAnalyticsItem = payload[0].payload;
      return (
        <div className="p-3 rounded-2xl bg-neutral-900/95 border border-neutral-700/80 shadow-2xl backdrop-blur-md text-xs space-y-1.5 min-w-[190px]">
          <p className="font-extrabold text-white text-sm flex items-center justify-between">
            <span>{data.formattedDate}</span>
            <span className="text-[11px] font-mono text-neutral-400 font-normal">{data.date}</span>
          </p>

          <div className="pt-1.5 border-t border-neutral-800 space-y-1">
            <div className="flex items-center justify-between text-emerald-400 font-bold">
              <span className="flex items-center gap-1">
                <DollarSign size={13} /> Chiffre d'Affaires :
              </span>
              <span>{data.dailyRevenue.toFixed(2)} TND</span>
            </div>
            <div className="flex items-center justify-between text-neutral-300">
              <span className="flex items-center gap-1 text-neutral-400">
                <Ticket size={13} className="text-passi-corail" /> Passes vendus :
              </span>
              <span className="font-bold text-white">{data.passCount}</span>
            </div>
          </div>

          <div className="pt-1.5 border-t border-neutral-800 flex items-center justify-between text-[11px]">
            <span className="text-neutral-400">Tendance jour :</span>
            <span className={`font-semibold flex items-center gap-0.5 ${
              data.revenueDiff > 0 ? 'text-emerald-400' : data.revenueDiff < 0 ? 'text-rose-400' : 'text-neutral-400'
            }`}>
              {data.revenueDiff > 0 && <ArrowUpRight size={13} />}
              {data.revenueDiff < 0 && <ArrowDownRight size={13} />}
              {data.revenueTrend}
            </span>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className={`card p-6 md:p-8 shadow-sm space-y-6 ${className}`}>
      {/* 1. Header with Timeframe selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--border)] pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <TrendingUp size={18} />
            </div>
            <h3 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
              Évolution du Chiffre d'Affaires
            </h3>
          </div>
          <p className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
            Suivi des ventes quotidiennes et des tendances financières de la billetterie
          </p>
        </div>

        {/* Timeframe Filter Buttons */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-[var(--bg-input)] border border-[var(--border)] self-start sm:self-auto">
          {[
            { label: '7 jours', val: 7 },
            { label: '30 jours', val: 30 },
            { label: '90 jours', val: 90 },
          ].map(tf => (
            <button
              key={tf.val}
              type="button"
              onClick={() => setTimeframe(tf.val)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                timeframe === tf.val
                  ? 'bg-emerald-500 text-neutral-950 shadow-sm'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-neutral-800/30'
              }`}
            >
              {tf.label}
            </button>
          ))}
        </div>
      </div>

      {/* 2. Top Summary Indicators */}
      {analytics && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          <div className="p-3.5 rounded-2xl bg-[var(--bg-input)] border border-[var(--border)] space-y-1">
            <span className="text-[11px] font-semibold text-[var(--text-secondary)] block">
              Chiffre d'Affaires ({timeframe}j)
            </span>
            <p className="text-xl font-extrabold text-emerald-400">
              {analytics.totalRevenue.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} TND
            </p>
          </div>

          <div className="p-3.5 rounded-2xl bg-[var(--bg-input)] border border-[var(--border)] space-y-1">
            <span className="text-[11px] font-semibold text-[var(--text-secondary)] block">
              Passes Encaissés
            </span>
            <p className="text-xl font-extrabold text-passi-corail">
              {analytics.totalPasses}
            </p>
          </div>

          <div className="p-3.5 rounded-2xl bg-[var(--bg-input)] border border-[var(--border)] space-y-1">
            <span className="text-[11px] font-semibold text-[var(--text-secondary)] block">
              Moyenne Journalière
            </span>
            <p className="text-xl font-extrabold text-white">
              {analytics.averageDailyRevenue.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} TND
            </p>
          </div>

          <div className="p-3.5 rounded-2xl bg-[var(--bg-input)] border border-[var(--border)] space-y-1">
            <span className="text-[11px] font-semibold text-[var(--text-secondary)] block">
              Pic de Vente Journalier
            </span>
            <p className="text-base font-extrabold text-amber-400 truncate">
              {metrics.peakDay 
                ? `${metrics.peakDay.dailyRevenue.toFixed(0)} TND (${metrics.peakDay.formattedDate})` 
                : 'Aucune vente'}
            </p>
          </div>
        </div>
      )}

      {/* 3. Recharts Courbe Financière (AreaChart) */}
      <div className="w-full h-64 md:h-72 relative">
        {isLoading ? (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-neutral-400 text-xs">
            <Loader2 size={24} className="animate-spin text-emerald-400" />
            <span>Chargement des métriques financières...</span>
          </div>
        ) : !isMounted ? (
          <div className="w-full h-full" />
        ) : !analytics || analytics.dailyData.length === 0 ? (
          <div className="w-full h-full flex items-center justify-center text-xs text-neutral-400">
            Aucune donnée financière pour cette période.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={analytics.dailyData}
              margin={{ top: 12, right: 12, left: -10, bottom: 0 }}
            >
              <defs>
                <linearGradient id="financialRevenueGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10B981" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#10B981" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid 
                strokeDasharray="3 3" 
                vertical={false} 
                stroke="rgba(255, 255, 255, 0.08)" 
              />
              <XAxis 
                dataKey="formattedDate" 
                stroke="rgba(255, 255, 255, 0.4)"
                fontSize={11} 
                tickLine={false}
                axisLine={{ stroke: 'rgba(255, 255, 255, 0.1)' }}
              />
              <YAxis 
                stroke="rgba(255, 255, 255, 0.4)"
                fontSize={11} 
                tickLine={false}
                axisLine={{ stroke: 'rgba(255, 255, 255, 0.1)' }}
                tickFormatter={(val) => `${val} DT`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area 
                type="monotone" 
                dataKey="dailyRevenue" 
                name="Chiffre d'Affaires" 
                stroke="#10B981" 
                strokeWidth={2.5} 
                fillOpacity={1} 
                fill="url(#financialRevenueGrad)"
                dot={{ r: 2.5, fill: "#10B981" }}
                activeDot={{ r: 5, fill: "#10B981", stroke: "#FFFFFF", strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* 4. Export Action Buttons (PDF & CSV) */}
      <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-4 border-t border-[var(--border)]">
        <button
          type="button"
          onClick={handleExportPDF}
          disabled={isExportingPdf || !analytics || analytics.dailyData.length === 0}
          className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs bg-red-500/10 text-red-400 border border-red-500/25 hover:bg-red-500/20 transition-all cursor-pointer shadow-sm active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
          title="Télécharger le rapport d'activité au format PDF"
        >
          {isExportingPdf ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <FileText size={16} />
          )}
          <span>Télécharger le Rapport Analytique (PDF)</span>
        </button>

        <button
          type="button"
          onClick={handleExportCSV}
          disabled={isExportingCsv || !analytics || analytics.dailyData.length === 0}
          className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 hover:bg-emerald-500/20 transition-all cursor-pointer shadow-sm active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
          title="Exporter le tableau analytique au format CSV"
        >
          {isExportingCsv ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <FileSpreadsheet size={16} />
          )}
          <span>Exporter les données (CSV)</span>
        </button>
      </div>
    </div>
  );
}

export default FinancialAnalyticsSection;
