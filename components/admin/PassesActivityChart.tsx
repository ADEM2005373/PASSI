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
  Ticket, 
  Activity, 
  CheckCircle2, 
  Clock, 
  FileText, 
  FileSpreadsheet, 
  Loader2, 
  ArrowUpRight, 
  ArrowDownRight,
  TrendingUp,
  Flame
} from 'lucide-react';
import { api } from '@/lib/services/api';
import { 
  generatePassesActivityCSVReport, 
  generatePassesActivityPDFReport 
} from '@/lib/utils/analytics-export';
import { 
  PassesActivityResponse, 
  DailyPassesActivityItem 
} from '@/lib/actions/analytics';

interface PassesActivityChartProps {
  initialTimeframe?: number;
  className?: string;
}

export function PassesActivityChart({
  initialTimeframe = 30,
  className = "",
}: PassesActivityChartProps) {
  const [isMounted, setIsMounted] = useState(false);
  const [timeframe, setTimeframe] = useState<number>(initialTimeframe);
  const [analytics, setAnalytics] = useState<PassesActivityResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);
  const [isExportingCsv, setIsExportingCsv] = useState<boolean>(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Fetch passes activity analytics when timeframe changes
  useEffect(() => {
    let isCancelled = false;
    const fetchAnalytics = async () => {
      setIsLoading(true);
      try {
        const data = await api.getPassesActivityAnalytics(timeframe);
        if (!isCancelled) {
          setAnalytics(data);
        }
      } catch (err) {
        console.error("Failed to load passes activity analytics:", err);
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

  // Derived peak day and validation rate
  const metrics = useMemo(() => {
    if (!analytics || !analytics.dailyData || analytics.dailyData.length === 0) {
      return { peakDay: null, validationRate: 0 };
    }

    const peak = analytics.peakDay
      ? analytics.peakDay
      : (() => {
          const maxItem = analytics.dailyData.reduce((prev, curr) => 
            curr.totalPasses > prev.totalPasses ? curr : prev
          , analytics.dailyData[0]);
          return maxItem && maxItem.totalPasses > 0 
            ? { date: maxItem.date, formattedDate: maxItem.formattedDate, count: maxItem.totalPasses }
            : null;
        })();

    const rate = analytics.totalPasses > 0 
      ? Math.round((analytics.totalValidated / analytics.totalPasses) * 100) 
      : 0;

    return {
      peakDay: peak && peak.count > 0 ? peak : null,
      validationRate: rate
    };
  }, [analytics]);

  const handleExportPDF = () => {
    if (!analytics || analytics.dailyData.length === 0) return;
    setIsExportingPdf(true);
    try {
      generatePassesActivityPDFReport(analytics);
    } catch (err: any) {
      console.error("Erreur export PDF activité passes:", err);
      alert("Erreur lors de la génération du rapport PDF: " + err.message);
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handleExportCSV = () => {
    if (!analytics || analytics.dailyData.length === 0) return;
    setIsExportingCsv(true);
    try {
      generatePassesActivityCSVReport(analytics);
    } catch (err: any) {
      console.error("Erreur export CSV activité passes:", err);
      alert("Erreur lors de la génération de l'export CSV: " + err.message);
    } finally {
      setIsExportingCsv(false);
    }
  };

  // Custom Chart Tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data: DailyPassesActivityItem = payload[0].payload;
      return (
        <div className="p-3.5 rounded-2xl bg-neutral-900/95 border border-neutral-700/80 shadow-2xl backdrop-blur-md text-xs space-y-2 min-w-[200px]">
          <p className="font-extrabold text-white text-sm flex items-center justify-between">
            <span>{data.formattedDate}</span>
            <span className="text-[11px] font-mono text-neutral-400 font-normal">{data.date}</span>
          </p>

          <div className="pt-1.5 border-t border-neutral-800 space-y-1.5">
            <div className="flex items-center justify-between text-passi-corail font-bold">
              <span className="flex items-center gap-1.5">
                <Ticket size={14} /> Passes Créés :
              </span>
              <span className="text-sm">{data.totalPasses}</span>
            </div>
            <div className="flex items-center justify-between text-emerald-400 font-medium">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 size={13} /> Passes Validés :
              </span>
              <span>{data.validatedPasses}</span>
            </div>
            <div className="flex items-center justify-between text-amber-400 font-medium">
              <span className="flex items-center gap-1.5">
                <Clock size={13} /> En Attente :
              </span>
              <span>{data.pendingPasses}</span>
            </div>
          </div>

          <div className="pt-1.5 border-t border-neutral-800 flex items-center justify-between text-[11px]">
            <span className="text-neutral-400">Évolution (J-1) :</span>
            <span className={`font-semibold flex items-center gap-0.5 ${
              data.volumeDiff > 0 ? 'text-emerald-400' : data.volumeDiff < 0 ? 'text-rose-400' : 'text-neutral-400'
            }`}>
              {data.volumeDiff > 0 && <ArrowUpRight size={13} />}
              {data.volumeDiff < 0 && <ArrowDownRight size={13} />}
              {data.volumeTrend}
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
            <div className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-passi-corail">
              <Activity size={18} />
            </div>
            <h3 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
              Activité des passes
            </h3>
          </div>
          <p className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
            Suivi des réservations quotidiennes, validations et tendances de volume
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
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                timeframe === tf.val
                  ? 'bg-passi-corail text-white shadow-sm'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-neutral-800/30'
              }`}
            >
              {tf.label}
            </button>
          ))}
        </div>
      </div>

      {/* 2. Top Summary Metric Cards */}
      {analytics && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          <div className="p-3.5 rounded-2xl bg-[var(--bg-input)] border border-[var(--border)] space-y-1">
            <span className="text-[11px] font-semibold text-[var(--text-secondary)] block">
              Total des Passes ({timeframe}j)
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
              {analytics.averageDailyPasses} <span className="text-xs font-semibold text-[var(--text-secondary)]">/ jour</span>
            </p>
          </div>

          <div className="p-3.5 rounded-2xl bg-[var(--bg-input)] border border-[var(--border)] space-y-1">
            <span className="text-[11px] font-semibold text-[var(--text-secondary)] block">
              Pic d'Activité
            </span>
            <p className="text-base font-extrabold text-amber-400 truncate">
              {metrics.peakDay 
                ? `${metrics.peakDay.count} passes (${metrics.peakDay.formattedDate})` 
                : 'Aucune activité'}
            </p>
          </div>

          <div className="p-3.5 rounded-2xl bg-[var(--bg-input)] border border-[var(--border)] space-y-1">
            <span className="text-[11px] font-semibold text-[var(--text-secondary)] block">
              Passes Validés vs En Attente
            </span>
            <p className="text-base font-extrabold text-emerald-400 truncate">
              {analytics.totalValidated} <span className="text-xs text-[var(--text-secondary)] font-normal">validés</span> ({metrics.validationRate}%)
            </p>
            <p className="text-[11px] font-medium text-amber-400/90 truncate">
              {analytics.totalPending} en attente
            </p>
          </div>
        </div>
      )}

      {/* 3. Recharts Courbe d'Activité (AreaChart) */}
      <div className="w-full h-64 md:h-72 relative">
        {isLoading ? (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-neutral-400 text-xs">
            <Loader2 size={24} className="animate-spin text-passi-corail" />
            <span>Chargement des données d'activité...</span>
          </div>
        ) : !isMounted ? (
          <div className="w-full h-full" />
        ) : !analytics || analytics.dailyData.length === 0 ? (
          <div className="w-full h-full flex items-center justify-center text-xs text-neutral-400">
            Aucune donnée d'activité pour cette période.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={analytics.dailyData}
              margin={{ top: 12, right: 12, left: -10, bottom: 0 }}
            >
              <defs>
                <linearGradient id="passesActivityGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#FF6B5E" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#FF6B5E" stopOpacity={0.0} />
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
                allowDecimals={false}
                axisLine={{ stroke: 'rgba(255, 255, 255, 0.1)' }}
                tickFormatter={(val) => `${val}`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area 
                type="monotone" 
                dataKey="totalPasses" 
                name="Passes Créés" 
                stroke="#FF6B5E" 
                strokeWidth={2.5} 
                fillOpacity={1} 
                fill="url(#passesActivityGrad)"
                dot={{ r: 2.5, fill: "#FF6B5E" }}
                activeDot={{ r: 5, fill: "#FF6B5E", stroke: "#FFFFFF", strokeWidth: 2 }}
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
          title="Télécharger le rapport d'activité des passes au format PDF"
        >
          {isExportingPdf ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <FileText size={16} />
          )}
          <span>Télécharger le Rapport d'Activité (PDF)</span>
        </button>

        <button
          type="button"
          onClick={handleExportCSV}
          disabled={isExportingCsv || !analytics || analytics.dailyData.length === 0}
          className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs bg-passi-corail/15 text-passi-corail border border-passi-corail/30 hover:bg-passi-corail/25 transition-all cursor-pointer shadow-sm active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
          title="Exporter le tableau d'activité des passes au format CSV"
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

export const PassesActivitySection = PassesActivityChart;
export default PassesActivityChart;
