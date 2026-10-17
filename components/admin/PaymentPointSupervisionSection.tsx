"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { api, User, Event } from "@/lib/services/api";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  Cell
} from "recharts";
import { 
  Banknote, 
  AlertTriangle, 
  ShieldAlert, 
  ShieldCheck, 
  Trash2, 
  Plus, 
  FileSpreadsheet, 
  FileText, 
  Download, 
  RefreshCw, 
  Calendar, 
  Clock, 
  User as UserIcon, 
  CheckCircle2, 
  XCircle, 
  DollarSign,
  History,
  FileCheck2,
  ArrowUpRight,
  Filter,
  Check,
  TrendingUp,
  BarChart3,
  Layers,
  ChevronRight,
  Pencil
} from "lucide-react";
import { EditPaymentPointModal } from "./EditPaymentPointModal";

interface PaymentPointSupervisionSectionProps {
  events: Event[];
  profiles: User[];
  onRefreshProfiles: () => Promise<void>;
  onToggleSuspend: (user: User) => Promise<void>;
  onDeleteUser: (userId: string) => Promise<void>;
}

type AdminSupervisionTab = 'live' | 'closures' | 'collections';

export function PaymentPointSupervisionSection({
  events,
  profiles,
  onRefreshProfiles,
  onToggleSuspend,
  onDeleteUser,
}: PaymentPointSupervisionSectionProps) {
  // Navigation Sub-Tabs
  const [activeTab, setActiveTab] = useState<AdminSupervisionTab>('live');

  // Filter Toggle for Closures Tab
  const [onlyDiscrepancies, setOnlyDiscrepancies] = useState<boolean>(false);

  // Account Creation Form State
  const [workerSellPointName, setWorkerSellPointName] = useState("");
  const [workerEmail, setWorkerEmail] = useState("");
  const [workerPassword, setWorkerPassword] = useState("");
  const [workerMsg, setWorkerMsg] = useState("");
  const [isCreatingWorker, setIsCreatingWorker] = useState(false);

  // Edit Payment Point Modal State
  const [editingCashier, setEditingCashier] = useState<any | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const handleOpenEditModal = (cashier: any) => {
    setEditingCashier(cashier);
    setIsEditModalOpen(true);
  };

  const handleCloseEditModal = () => {
    setIsEditModalOpen(false);
    setEditingCashier(null);
  };

  // Cash Supervision State
  const [supervisionData, setSupervisionData] = useState<{
    discrepancyAlerts: any[];
    cashiersOverview: any[];
    allClosures: any[];
    allCollections: any[];
    summary: {
      totalLiveBalance: number;
      totalTodayRevenue: number;
      totalTodayPasses: number;
      alertsCount: number;
      cashiersCount: number;
    };
  }>({
    discrepancyAlerts: [],
    cashiersOverview: [],
    allClosures: [],
    allCollections: [],
    summary: {
      totalLiveBalance: 0,
      totalTodayRevenue: 0,
      totalTodayPasses: 0,
      alertsCount: 0,
      cashiersCount: 0,
    },
  });
  const [isLoading, setIsLoading] = useState(true);

  // Load supervision metrics from backend
  const loadSupervisionData = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await api.getAdminCashSupervision();
      if (data && data.success) {
        setSupervisionData({
          discrepancyAlerts: data.discrepancyAlerts || [],
          cashiersOverview: data.cashiersOverview || [],
          allClosures: data.allClosures || [],
          allCollections: data.allCollections || [],
          summary: data.summary || {
            totalLiveBalance: 0,
            totalTodayRevenue: 0,
            totalTodayPasses: 0,
            alertsCount: 0,
            cashiersCount: 0,
          },
        });
      }
    } catch (err: any) {
      console.warn("Unable to load cash supervision data:", err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSupervisionData();
  }, [loadSupervisionData]);

  // Create worker handler
  const handleCreateWorker = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workerSellPointName.trim()) {
      setWorkerMsg("Veuillez saisir le nom du point de vente.");
      return;
    }
    setIsCreatingWorker(true);
    setWorkerMsg("Création en cours...");
    try {
      await api.adminCreateUser(
        workerEmail.trim(), 
        workerPassword, 
        "", 
        "payment_point", 
        workerSellPointName.trim()
      );
      setWorkerMsg("✓ Point de Vente créé avec succès !");
      setWorkerSellPointName("");
      setWorkerEmail("");
      setWorkerPassword("");
      await onRefreshProfiles();
      await loadSupervisionData();
      setTimeout(() => setWorkerMsg(""), 3500);
    } catch (err: any) {
      setWorkerMsg("Erreur: " + err.message);
    } finally {
      setIsCreatingWorker(false);
    }
  };

  // ─── RECHARTS DATA PREPARATION ───
  // 1. Cashier Comparison: Recette du Jour vs Solde Actuel en Caisse
  const cashierComparisonData = useMemo(() => {
    return (supervisionData.cashiersOverview || []).map((c: any) => {
      const displayName = c.sell_point_name || c.full_name || c.email?.split('@')[0] || c.id?.slice(0, 8) || 'Point de Vente';
      return {
        name: displayName,
        fullName: c.sell_point_name ? `${c.sell_point_name} (${c.email})` : (c.email || displayName),
        recette: Number(c.todayRevenue || 0),
        solde: Number(c.liveDrawerBalance || 0),
        passes: Number(c.todayPassesCount || 0)
      };
    });
  }, [supervisionData.cashiersOverview]);

  // 2. Closures Accuracy: Expected vs Declared over recent closures
  const closuresComparisonData = useMemo(() => {
    return (supervisionData.allClosures || [])
      .slice(0, 8)
      .map((cl: any) => {
        const dateStr = cl.closure_date?.slice(5) || 'N/A'; // MM-DD
        const cashierName = cl.cashier?.sell_point_name || cl.cashier?.full_name || cl.cashier?.email?.split('@')[0] || cl.cashier_id?.slice(0, 6) || 'Point de Vente';
        const expected = Number(cl.expected_amount || 0);
        const declared = Number(cl.declared_amount || 0);
        const discrepancy = Number(cl.discrepancy || 0);
        const hasDiscrepancy = cl.status !== 'MATCHED' || Math.abs(discrepancy) > 0.01;

        return {
          label: `${dateStr} (${cashierName})`,
          expected,
          declared,
          discrepancy,
          hasDiscrepancy,
          status: cl.status
        };
      })
      .reverse();
  }, [supervisionData.allClosures]);

  // Filtered closures based on toggle
  const displayedClosures = useMemo(() => {
    if (!onlyDiscrepancies) return supervisionData.allClosures;
    return supervisionData.allClosures.filter(
      (cl: any) => cl.status !== 'MATCHED' || Math.abs(Number(cl.discrepancy || 0)) > 0.01
    );
  }, [supervisionData.allClosures, onlyDiscrepancies]);

  // ─── ADMIN CSV EXPORT ───
  const handleExportCSV = (type: 'closures' | 'collections') => {
    if (type === 'closures') {
      const headers = ["Date Cloture", "Point de Vente", "Email", "Passes Valides", "Montant Attendu (TND)", "Montant Declare (TND)", "Ecart (TND)", "Statut", "Notes Justificatives"];
      const rows = supervisionData.allClosures.map((cl: any) => [
        cl.closure_date || 'N/A',
        `"${(cl.cashier?.sell_point_name || cl.cashier?.full_name || 'Point de Vente').replace(/"/g, '""')}"`,
        `"${(cl.cashier?.email || cl.cashier_id || '').replace(/"/g, '""')}"`,
        String(cl.passes_approved_count ?? 0),
        String(cl.expected_amount ?? 0),
        String(cl.declared_amount ?? 0),
        String(cl.discrepancy ?? 0),
        cl.status === 'MATCHED' ? 'Conforme' : 'Ecart Detecte',
        `"${(cl.notes || '').replace(/"/g, '""')}"`
      ]);

      if (rows.length === 0) {
        alert("Aucune clôture de caisse à exporter.");
        return;
      }

      const csvContent = "\uFEFF" + [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `audit_clotures_caisse_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      const headers = ["Date et Heure", "Point de Vente", "Email", "Superviseur Beneficiaire", "Montant Remis (TND)", "Notes / Observations"];
      const rows = supervisionData.allCollections.map((col: any) => [
        col.collection_time ? col.collection_time.replace('T', ' ').slice(0, 19) : 'N/A',
        `"${(col.cashier?.sell_point_name || col.cashier?.full_name || 'Point de Vente').replace(/"/g, '""')}"`,
        `"${(col.cashier?.email || col.cashier_id || '').replace(/"/g, '""')}"`,
        `"${(col.supervisor_name || '').replace(/"/g, '""')}"`,
        String(col.collected_amount ?? 0),
        `"${(col.notes || '').replace(/"/g, '""')}"`
      ]);

      if (rows.length === 0) {
        alert("Aucune remise de caisse à exporter.");
        return;
      }

      const csvContent = "\uFEFF" + [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `audit_remises_superviseurs_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  // ─── ADMIN PDF EXPORT ───
  const handleExportPDF = (type: 'closures' | 'collections') => {
    const doc = new jsPDF();
    const todayStr = new Date().toLocaleDateString('fr-FR');
    const nowTimeStr = new Date().toLocaleTimeString('fr-FR');

    // Header
    doc.setFillColor(26, 32, 44);
    doc.rect(0, 0, 210, 36, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("PASSI — AUDIT & SUPERVISION DES CAISSES (POS)", 14, 18);

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(255, 107, 94);
    doc.text(`RAPPORT GÉNÉRÉ LE ${todayStr} À ${nowTimeStr} | SECTION : ${type.toUpperCase()}`, 14, 28);

    // Summary boxes
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(14, 44, 42, 22, 2, 2, 'F');
    doc.roundedRect(62, 44, 42, 22, 2, 2, 'F');
    doc.roundedRect(110, 44, 42, 22, 2, 2, 'F');
    doc.roundedRect(158, 44, 38, 22, 2, 2, 'F');

    doc.setTextColor(100, 116, 139);
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "bold");
    doc.text("ESPÈCES EN CAISSE", 18, 51);
    doc.text("RECETTES DU JOUR", 66, 51);
    doc.text("PASSES AUJOURD'HUI", 114, 51);
    doc.text("ALERTES ÉCARTS", 162, 51);

    doc.setFontSize(12);
    doc.setTextColor(16, 185, 129);
    doc.text(`${supervisionData.summary.totalLiveBalance.toFixed(2)} TND`, 18, 60);
    doc.setTextColor(15, 23, 42);
    doc.text(`${supervisionData.summary.totalTodayRevenue.toFixed(2)} TND`, 66, 60);
    doc.text(`${supervisionData.summary.totalTodayPasses}`, 114, 60);
    doc.setTextColor(supervisionData.summary.alertsCount > 0 ? 225 : 15, 29, 72);
    doc.text(`${supervisionData.summary.alertsCount}`, 162, 60);

    const startY = 74;

    if (type === 'closures') {
      const tableRows = supervisionData.allClosures.map((cl: any) => [
        cl.closure_date || 'N/A',
        cl.cashier?.sell_point_name ? `${cl.cashier.sell_point_name} (${cl.cashier.email})` : (cl.cashier?.full_name || cl.cashier?.email || cl.cashier_id?.slice(0, 8) || 'N/A'),
        String(cl.passes_approved_count ?? 0),
        `${Number(cl.expected_amount).toFixed(2)} DT`,
        `${Number(cl.declared_amount).toFixed(2)} DT`,
        `${Number(cl.discrepancy) > 0 ? '+' : ''}${Number(cl.discrepancy).toFixed(2)} DT`,
        cl.status === 'MATCHED' ? 'Conforme' : 'Écart Détecté',
        cl.notes || '-'
      ]);

      autoTable(doc, {
        startY,
        head: [["Date", "Point de Vente", "Passes", "Attendu", "Déclaré", "Écart", "Statut", "Notes"]],
        body: tableRows.length > 0 ? tableRows : [["-", "Aucune clôture", "-", "-", "-", "-", "-", "-"]],
        theme: 'striped',
        headStyles: { fillColor: [255, 107, 94], fontStyle: 'bold', fontSize: 8 },
        styles: { fontSize: 8 },
      });
    } else {
      const tableRows = supervisionData.allCollections.map((col: any) => [
        col.collection_time ? col.collection_time.replace('T', ' ').slice(0, 16) : 'N/A',
        col.cashier?.sell_point_name ? `${col.cashier.sell_point_name} (${col.cashier.email})` : (col.cashier?.full_name || col.cashier?.email || col.cashier_id?.slice(0, 8) || 'N/A'),
        col.supervisor_name || 'N/A',
        `${Number(col.collected_amount).toFixed(2)} DT`,
        col.notes || '-'
      ]);

      autoTable(doc, {
        startY,
        head: [["Date & Heure", "Point de Vente", "Superviseur Bénéficiaire", "Montant Remis", "Observations"]],
        body: tableRows.length > 0 ? tableRows : [["-", "Aucune remise", "-", "-", "-"]],
        theme: 'striped',
        headStyles: { fillColor: [16, 185, 129], fontStyle: 'bold', fontSize: 8 },
        styles: { fontSize: 8 },
      });
    }

    doc.save(`audit_supervision_${type}_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  // Generate single Bon de Remise from admin table
  const handleDownloadSingleBon = (col: any) => {
    const doc = new jsPDF();
    const dateFormatted = new Date(col.collection_time || new Date()).toLocaleString('fr-FR');
    const pointLabel = col.cashier?.sell_point_name
      ? `${col.cashier.sell_point_name} (${col.cashier.email})`
      : (col.cashier?.full_name || col.cashier?.email || col.cashier_id);

    doc.setFillColor(26, 32, 44);
    doc.rect(0, 0, 210, 36, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    doc.text("PASSI — SYSTÈME CAISSIER", 14, 18);

    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(255, 107, 94);
    doc.text("BON OFFICIEL DE REMISE DE FONDS (ESPÈCES) — COPIE ADMIN", 14, 28);

    doc.setTextColor(30, 41, 59);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text(`RÉFÉRENCE : ${col.id ? col.id.slice(0, 13).toUpperCase() : 'REMISE-' + Date.now()}`, 14, 46);
    doc.setFont("helvetica", "normal");
    doc.text(`Date & Heure : ${dateFormatted}`, 14, 53);
    doc.text(`Point de Vente : ${pointLabel}`, 14, 60);
    doc.text(`Superviseur Bénéficiaire : ${col.supervisor_name}`, 14, 67);

    doc.setFillColor(241, 245, 249);
    doc.roundedRect(14, 76, 182, 32, 3, 3, 'F');
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("MONTANT TOTAL REMIS EN ESPÈCES :", 20, 88);
    doc.setFontSize(22);
    doc.setTextColor(16, 185, 129);
    doc.text(`${Number(col.collected_amount).toFixed(2)} TND`, 20, 101);

    if (col.notes) {
      doc.setFontSize(10);
      doc.setTextColor(71, 85, 105);
      doc.setFont("helvetica", "italic");
      doc.text(`Observations : ${col.notes}`, 14, 120);
    }

    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(14, 145, 85, 45, 2, 2, 'S');
    doc.roundedRect(111, 145, 85, 45, 2, 2, 'S');

    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42);
    doc.text("Signature du Guichetier :", 20, 155);
    doc.text("Signature du Superviseur :", 117, 155);

    doc.save(`Bon_Remise_${(col.supervisor_name || 'superviseur').replace(/\s+/g, '_')}_${col.id.slice(0, 8)}.pdf`);
  };

  return (
    <div className="space-y-8 animate-in fade-in">
      
      {/* ─── STEP A: PROMINENT ALERT BANNER (TOP PRIORITY) ─── */}
      {supervisionData.discrepancyAlerts.length > 0 && (
        <div className="relative overflow-hidden rounded-3xl border-2 border-red-500/80 bg-red-950/30 dark:bg-red-950/40 p-6 shadow-xl animate-pulse">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-red-600 text-white flex items-center justify-center shrink-0 shadow-lg shadow-red-600/40">
                <AlertTriangle className="w-6 h-6 animate-bounce" />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-black text-red-400 flex items-center gap-2">
                  🚨 ALERTE ÉCART DE CAISSE DÉTECTÉ ({supervisionData.discrepancyAlerts.length} signalement{supervisionData.discrepancyAlerts.length > 1 ? 's' : ''})
                </h3>
                <p className="text-xs text-red-200/90 font-medium max-w-2xl leading-relaxed">
                  Des divergences ont été constatées entre les espèces physiques déclarées lors de la clôture et le total attendu par le système.
                </p>
              </div>
            </div>

            {/* Quick Action to switch to closures tab and isolate discrepancies */}
            <button
              onClick={() => {
                setActiveTab('closures');
                setOnlyDiscrepancies(true);
              }}
              className="px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-red-600/30 transition-all active:scale-95 cursor-pointer whitespace-nowrap self-stretch sm:self-auto justify-center"
            >
              <span>Inspecter les clôtures litigieuses</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Quick Alert list preview */}
          <div className="mt-4 pt-4 border-t border-red-500/25 grid grid-cols-1 md:grid-cols-2 gap-3">
            {supervisionData.discrepancyAlerts.slice(0, 2).map((alert: any) => (
              <div key={alert.id} className="p-3 rounded-xl bg-black/40 border border-red-500/30 text-xs text-red-200 flex items-center justify-between">
                <div>
                  <span className="font-bold text-white">{alert.cashier?.email || alert.cashier_id}</span>
                  <span className="text-red-300 ml-2">le {alert.closure_date}</span>
                </div>
                <span className="font-mono font-bold text-red-400 px-2 py-0.5 rounded bg-red-500/10 border border-red-500/20">
                  Écart: {alert.discrepancy > 0 ? '+' : ''}{alert.discrepancy} TND
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── SUMMARY KPI METRICS CARDS ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1 */}
        <div className="card p-5 border border-emerald-500/20 bg-emerald-500/5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
              Espèces Actuelles en Caisse
            </span>
            <Banknote className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
            {supervisionData.summary.totalLiveBalance.toFixed(2)} TND
          </div>
          <p className="text-[11px] text-neutral-500 mt-1">Cumul physique chez les guichetiers</p>
        </div>

        {/* Metric 2 */}
        <div className="card p-5 border border-blue-500/20 bg-blue-500/5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wider">
              Recettes Encaissées Aujourd'hui
            </span>
            <TrendingUp className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-black text-blue-600 dark:text-blue-400 font-mono">
            {supervisionData.summary.totalTodayRevenue.toFixed(2)} TND
          </div>
          <p className="text-[11px] text-neutral-500 mt-1">{supervisionData.summary.totalTodayPasses} pass validés aujourd'hui</p>
        </div>

        {/* Metric 3 */}
        <div className="card p-5 border border-amber-500/20 bg-amber-500/5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider">
              Guichetiers Actifs
            </span>
            <UserIcon className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-black text-amber-600 dark:text-amber-400 font-mono">
            {supervisionData.cashiersOverview.length}
          </div>
          <p className="text-[11px] text-neutral-500 mt-1">Points de paiement configurés</p>
        </div>

        {/* Metric 4 */}
        <div className={`card p-5 border ${supervisionData.summary.alertsCount > 0 ? 'border-red-500/40 bg-red-500/10' : 'border-gray-200 dark:border-neutral-800'}`}>
          <div className="flex items-center justify-between mb-2">
            <span className={`text-xs font-bold uppercase tracking-wider ${supervisionData.summary.alertsCount > 0 ? 'text-red-500' : 'text-neutral-500'}`}>
              Alertes Clôtures
            </span>
            <AlertTriangle className={`w-4 h-4 ${supervisionData.summary.alertsCount > 0 ? 'text-red-500' : 'text-neutral-400'}`} />
          </div>
          <div className={`text-2xl font-black font-mono ${supervisionData.summary.alertsCount > 0 ? 'text-red-500' : 'text-neutral-800 dark:text-neutral-200'}`}>
            {supervisionData.summary.alertsCount}
          </div>
          <p className="text-[11px] text-neutral-500 mt-1">
            {supervisionData.summary.alertsCount > 0 ? 'Écarts nécessitant arbitrage' : 'Toutes les caisses sont équilibrées'}
          </p>
        </div>
      </div>

      {/* ─── STEP A: GRAPHICAL OVERVIEW SECTION (NEW - RECHARTS) ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Chart 1: BarChart - Comparatif des Points de Vente */}
        <div className="card p-6 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h4 className="font-bold text-sm text-neutral-900 dark:text-white flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-blue-500" />
                Comparatif des Points de Vente (Aujourd'hui)
              </h4>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                Recette du jour (Bleu) vs Solde physique actuel en caisse (Émeraude)
              </p>
            </div>
          </div>

          <div className="w-full h-64 relative">
            {cashierComparisonData.length === 0 ? (
              <div className="w-full h-full flex items-center justify-center text-xs text-neutral-400 italic">
                Aucun point de vente actif.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={cashierComparisonData}
                  margin={{ top: 10, right: 10, left: -15, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(150, 150, 150, 0.15)" />
                  <XAxis dataKey="name" fontSize={11} stroke="#888888" tickLine={false} />
                  <YAxis fontSize={11} stroke="#888888" tickLine={false} />
                  <RechartsTooltip
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 p-3 rounded-xl shadow-xl text-xs space-y-1">
                            <p className="font-bold text-neutral-900 dark:text-white border-b border-gray-100 dark:border-neutral-800 pb-1">
                              Guichet: {payload[0]?.payload?.fullName}
                            </p>
                            <p className="text-blue-500 font-semibold">
                              Recette du Jour : <span className="font-mono font-bold">{payload[0]?.value} TND</span>
                            </p>
                            <p className="text-emerald-500 font-semibold">
                              Solde Actuel en Caisse : <span className="font-mono font-bold">{payload[1]?.value} TND</span>
                            </p>
                            <p className="text-neutral-400 text-[10px]">
                              Passes validés: {payload[0]?.payload?.passes}
                            </p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Legend 
                    verticalAlign="top" 
                    height={36}
                    formatter={(value) => <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">{value}</span>}
                  />
                  <Bar dataKey="recette" name="Recette du Jour (TND)" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="solde" name="Solde Actuel en Caisse (TND)" fill="#10B981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Chart 2: BarChart / ComposedChart - Précision des Clôtures (Attendu vs Déclaré) */}
        <div className="card p-6 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h4 className="font-bold text-sm text-neutral-900 dark:text-white flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                Précision des Clôtures (Attendu vs Déclaré)
              </h4>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                Confrontation du théorique et du physique (Les écarts apparaissent en ROUGE)
              </p>
            </div>
          </div>

          <div className="w-full h-64 relative">
            {closuresComparisonData.length === 0 ? (
              <div className="w-full h-full flex items-center justify-center text-xs text-neutral-400 italic">
                Aucune clôture enregistrée.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={closuresComparisonData}
                  margin={{ top: 10, right: 10, left: -15, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(150, 150, 150, 0.15)" />
                  <XAxis dataKey="label" fontSize={10} stroke="#888888" tickLine={false} />
                  <YAxis fontSize={11} stroke="#888888" tickLine={false} />
                  <RechartsTooltip
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        const item = payload[0]?.payload;
                        return (
                          <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 p-3 rounded-xl shadow-xl text-xs space-y-1">
                            <p className="font-bold text-neutral-900 dark:text-white border-b border-gray-100 dark:border-neutral-800 pb-1">
                              Clôture : {label}
                            </p>
                            <p className="text-slate-400 font-semibold">
                              Montant Attendu : <span className="font-mono font-bold text-neutral-900 dark:text-white">{item?.expected} TND</span>
                            </p>
                            <p className={item?.hasDiscrepancy ? "text-red-500 font-bold" : "text-emerald-500 font-bold"}>
                              Montant Déclaré : <span className="font-mono">{item?.declared} TND</span>
                            </p>
                            <p className="text-[10px] font-mono">
                              Statut : <strong className={item?.hasDiscrepancy ? "text-red-500" : "text-emerald-500"}>
                                {item?.hasDiscrepancy ? `Écart: ${item.discrepancy > 0 ? '+' : ''}${item.discrepancy} TND` : "Conforme"}
                              </strong>
                            </p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Legend 
                    verticalAlign="top" 
                    height={36}
                    formatter={(value) => <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">{value}</span>}
                  />
                  <Bar dataKey="expected" name="Montant Attendu (TND)" fill="#64748B" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="declared" name="Montant Déclaré (TND)" radius={[4, 4, 0, 0]}>
                    {closuresComparisonData.map((entry, index) => (
                      <Cell
                        key={`closure-cell-${index}`}
                        fill={entry.hasDiscrepancy ? "#EF4444" : "#10B981"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

      </div>

      {/* ─── STEP B: STRUCTURED SUB-NAVIGATION TABS FOR ADMIN ─── */}
      <div className="space-y-6">
        
        {/* Navigation Tabs Bar */}
        <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-gray-100 dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 w-full sm:w-fit overflow-x-auto shadow-xs">
          
          <button
            onClick={() => setActiveTab('live')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'live'
                ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-xs'
                : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Tab 1 : 🟢 Caisses en Direct ({supervisionData.cashiersOverview.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('closures')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'closures'
                ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-xs'
                : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
            <span>Tab 2 : ⚠️ Journal des Clôtures & Écarts ({supervisionData.allClosures.length})</span>
            {supervisionData.summary.alertsCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-red-500 text-white">
                {supervisionData.summary.alertsCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('collections')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'collections'
                ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-xs'
                : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
            }`}
          >
            <Banknote className="w-3.5 h-3.5 text-emerald-500" />
            <span>Tab 3 : 🤝 Historique des Ramassages ({supervisionData.allCollections.length})</span>
          </button>

        </div>

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* ─── TAB 1: CAISSES EN DIRECT (GRID & DRAWER PROGRESS BARS) ─── */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        {activeTab === 'live' && (
          <div className="space-y-6 animate-in fade-in duration-150">
            
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                  État des Caisses & Tiroirs en Temps Réel
                </h3>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Suivez la charge physique des caisses et l'activité continue des guichetiers
                </p>
              </div>

              <button
                onClick={() => {
                  loadSupervisionData();
                  onRefreshProfiles();
                }}
                disabled={isLoading}
                className="p-2.5 rounded-xl border border-gray-200 dark:border-neutral-800 hover:bg-gray-100 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-400 transition-colors cursor-pointer"
                title="Actualiser les données"
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-amber-500' : ''}`} />
              </button>
            </div>

            {supervisionData.cashiersOverview.length === 0 ? (
              <div className="card p-10 text-center space-y-2">
                <Banknote size={36} className="mx-auto text-neutral-400 opacity-60" />
                <p className="text-sm font-semibold" style={{ color: 'var(--text-muted)' }}>
                  Aucun guichetier créé pour le moment.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {supervisionData.cashiersOverview.map((cashier: any) => {
                  const profileWorker = profiles.find(p => p.id === cashier.id) || (cashier as any);
                  const isClosedToday = (supervisionData.allClosures || []).some(
                    (cl: any) => cl.cashier_id === cashier.id && cl.closure_date === new Date().toISOString().split('T')[0]
                  );
                  
                  // Drawer filling progress bar calculation (e.g. threshold of 500 TND)
                  const drawerCapacity = 500;
                  const progressPct = Math.min(100, Math.round((cashier.liveDrawerBalance / drawerCapacity) * 100));

                  return (
                    <div
                      key={cashier.id}
                      className="card p-5 border border-gray-200 dark:border-neutral-800 hover:border-amber-500/40 transition-all flex flex-col justify-between shadow-xs gap-4"
                    >
                      {/* Top: Header Info & Status Badges */}
                      <div>
                        <div className="flex items-start justify-between gap-2 mb-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-sm ${
                              cashier.is_suspended 
                                ? 'bg-rose-500/10 text-rose-400' 
                                : 'bg-emerald-500/10 text-emerald-500'
                            }`}>
                              <Banknote size={20} />
                            </div>
                            <div className="min-w-0">
                              <h4 className="font-bold text-base truncate text-neutral-900 dark:text-white" title={cashier.sell_point_name || cashier.full_name || "Point de Vente sans nom"}>
                                {cashier.sell_point_name || cashier.full_name || "Point de Vente sans nom"}
                              </h4>
                              <div className="flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400">
                                <span className="truncate max-w-[200px]">({cashier.email})</span>
                              </div>
                              <span className="text-[10px] text-neutral-400 font-mono">
                                ID: {cashier.id.slice(0, 8)}...
                              </span>
                            </div>
                          </div>

                          {/* Status Badge */}
                          <div className="flex items-center gap-1.5 shrink-0">
                            {cashier.is_suspended ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/15 text-rose-400 border border-rose-500/20">
                                Suspendu
                              </span>
                            ) : isClosedToday ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/15 text-blue-400 border border-blue-500/20">
                                Clôturé
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                En service
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Drawer Balance & Progress Bar */}
                        <div className="p-3.5 rounded-2xl bg-gray-50 dark:bg-neutral-950/80 border border-gray-100 dark:border-neutral-800 space-y-3">
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs text-neutral-500 font-medium">Solde Actuel en Tiroir :</span>
                              <span className="text-base font-black text-emerald-600 dark:text-emerald-400 font-mono">
                                {cashier.liveDrawerBalance.toFixed(2)} TND
                              </span>
                            </div>

                            {/* Visual Progress Bar */}
                            <div className="w-full bg-gray-200 dark:bg-neutral-800 h-2 rounded-full overflow-hidden">
                              <div 
                                className={`h-full transition-all duration-500 rounded-full ${
                                  progressPct >= 80 
                                    ? 'bg-rose-500' 
                                    : progressPct >= 50 
                                    ? 'bg-amber-500' 
                                    : 'bg-emerald-500'
                                }`}
                                style={{ width: `${progressPct}%` }}
                              />
                            </div>
                            <div className="flex justify-between text-[10px] text-neutral-400 mt-1">
                              <span>Taux de remplissage : {progressPct}%</span>
                              <span>Seuil ramassage: {drawerCapacity} TND</span>
                            </div>
                          </div>

                          <div className="flex items-center justify-between text-xs pt-2 border-t border-gray-200/60 dark:border-neutral-800/80">
                            <span className="text-neutral-500">Recette aujourd'hui :</span>
                            <span className="font-bold text-neutral-900 dark:text-white">
                              {cashier.todayRevenue.toFixed(2)} TND ({cashier.todayPassesCount} pass)
                            </span>
                          </div>

                          <div className="pt-2 border-t border-gray-200/60 dark:border-neutral-800/80">
                            <span className="text-[10px] text-neutral-400 uppercase font-semibold block">Dernier Ramassage :</span>
                            {cashier.lastCollection ? (
                              <div className="flex items-center justify-between text-xs mt-0.5">
                                <span className="font-bold text-neutral-800 dark:text-neutral-200">
                                  {cashier.lastCollection.amount} TND
                                </span>
                                <span className="text-neutral-400 text-[11px] truncate max-w-[120px]">
                                  par {cashier.lastCollection.supervisor_name}
                                </span>
                              </div>
                            ) : (
                              <span className="text-[11px] text-neutral-400 italic">Aucune remise à ce jour</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Card Actions: Suspend & Delete */}
                      {profileWorker && (
                        <div className="flex items-center justify-between gap-2 pt-2 border-t border-gray-100 dark:border-neutral-800">
                          <button
                            onClick={async () => {
                              await onToggleSuspend(profileWorker);
                              await loadSupervisionData();
                            }}
                            className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                              cashier.is_suspended
                                ? 'bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 border border-emerald-500/30'
                                : 'bg-amber-500/15 text-amber-400 hover:bg-amber-500/25 border border-amber-500/30'
                            }`}
                          >
                            {cashier.is_suspended ? (
                              <>
                                <ShieldCheck size={14} />
                                <span>Réactiver</span>
                              </>
                            ) : (
                              <>
                                <ShieldAlert size={14} />
                                <span>Suspendre</span>
                              </>
                            )}
                          </button>

                          <button
                            onClick={() => handleOpenEditModal({ ...cashier, ...profileWorker })}
                            className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 px-3.5 py-1.5 rounded-xl text-xs font-bold border border-slate-700 transition cursor-pointer"
                            title="Modifier ce point de paiement"
                          >
                            <Pencil className="w-3.5 h-3.5 text-blue-400" />
                            <span>Modifier</span>
                          </button>

                          <button
                            onClick={async () => {
                              if (window.confirm("Êtes-vous sûr de vouloir supprimer ce point de paiement ?")) {
                                await onDeleteUser(cashier.id);
                                await loadSupervisionData();
                              }
                            }}
                            className="p-2 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors cursor-pointer"
                            title="Supprimer ce compte guichetier"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Create New Payment Point Account Box */}
            <div className="card p-7 shadow-xs">
              <h3 className="text-base font-bold mb-1 text-neutral-900 dark:text-white flex items-center gap-2">
                <Plus className="w-4 h-4 text-emerald-500" />
                Créer un nouveau Point de Paiement
              </h3>
              <p className="text-xs text-neutral-400 mb-5">
                Définissez les identifiants de connexion d'un nouvel opérateur de caisse
              </p>

              <form onSubmit={handleCreateWorker} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                <div>
                  <label className="label">Nom du Point de Vente *</label>
                  <input 
                    type="text" 
                    required 
                    value={workerSellPointName} 
                    onChange={e => setWorkerSellPointName(e.target.value)} 
                    placeholder="Ex: Guichet VIP Entrée Nord" 
                    className="input" 
                  />
                </div>

                <div>
                  <label className="label">Adresse Email Guichetier *</label>
                  <input 
                    type="email" 
                    required 
                    value={workerEmail} 
                    onChange={e => setWorkerEmail(e.target.value)} 
                    placeholder="caisse1@passi.tn" 
                    className="input" 
                  />
                </div>

                <div>
                  <label className="label">Mot de passe provisoire *</label>
                  <input 
                    type="password" 
                    required 
                    value={workerPassword} 
                    onChange={e => setWorkerPassword(e.target.value)} 
                    placeholder="••••••••" 
                    className="input" 
                  />
                </div>

                <div>
                  <button 
                    type="submit" 
                    disabled={isCreatingWorker}
                    className="btn-primary w-full flex items-center justify-center gap-2 py-3 cursor-pointer"
                  >
                    {isCreatingWorker ? (
                      <RefreshCw size={16} className="animate-spin" />
                    ) : (
                      <Plus size={16} />
                    )}
                    <span>Créer le Point de Vente</span>
                  </button>
                </div>
              </form>

              {workerMsg && (
                <p className={`mt-3 text-xs font-semibold px-3 py-2 rounded-xl ${workerMsg.startsWith('✓') ? 'bg-passi-turquoise/10 text-passi-turquoise' : 'bg-passi-corail/10 text-passi-corail'}`}>
                  {workerMsg}
                </p>
              )}
            </div>

          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* ─── TAB 2: JOURNAL DES CLÔTURES & ÉCARTS ──────────────────── */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        {activeTab === 'closures' && (
          <div className="card p-7 shadow-xs space-y-6 animate-in fade-in duration-150">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                  <History className="w-5 h-5 text-amber-500" />
                  Journal d'Audit des Clôtures & Écarts
                </h3>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Registre inaltérable des montants déclarés à l'aveugle et détection automatique des écarts
                </p>
              </div>

              {/* Action Buttons & Filter Toggle */}
              <div className="flex flex-wrap items-center gap-3">
                {/* Filter Toggle */}
                <button
                  type="button"
                  onClick={() => setOnlyDiscrepancies(!onlyDiscrepancies)}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    onlyDiscrepancies
                      ? 'bg-red-500 text-white shadow-md shadow-red-500/25'
                      : 'bg-gray-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-gray-200 dark:hover:bg-neutral-700'
                  }`}
                >
                  <Filter className="w-3.5 h-3.5" />
                  <span>{onlyDiscrepancies ? "Écarts uniquement (Actif)" : "Voir uniquement les écarts"}</span>
                </button>

                <button
                  onClick={() => handleExportCSV('closures')}
                  className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold bg-neutral-800 hover:bg-neutral-700 text-white border border-neutral-700 transition-colors cursor-pointer"
                >
                  <FileSpreadsheet size={14} className="text-emerald-400" />
                  <span>CSV</span>
                </button>

                <button
                  onClick={() => handleExportPDF('closures')}
                  className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold bg-passi-corail hover:bg-passi-corail/90 text-white shadow-md shadow-passi-corail/20 transition-all cursor-pointer"
                >
                  <FileText size={14} />
                  <span>PDF</span>
                </button>
              </div>
            </div>

            {/* Closures Table */}
            <div className="overflow-x-auto">
              {displayedClosures.length === 0 ? (
                <div className="text-center py-12 rounded-2xl bg-gray-50 dark:bg-neutral-950/60 border border-dashed border-gray-200 dark:border-neutral-800">
                  <p className="text-xs text-neutral-400">
                    {onlyDiscrepancies 
                      ? "Aucun écart de caisse détecté ! Toutes les clôtures sont conformes." 
                      : "Aucune clôture de caisse enregistrée."}
                  </p>
                </div>
              ) : (
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-neutral-800 text-neutral-400 font-semibold">
                      <th className="py-3 pr-3">Date</th>
                      <th className="py-3 px-3">Caissier / Guichet</th>
                      <th className="py-3 px-3">Passes</th>
                      <th className="py-3 px-3">Attendu</th>
                      <th className="py-3 px-3">Déclaré</th>
                      <th className="py-3 px-3">Écart</th>
                      <th className="py-3 px-3">Statut</th>
                      <th className="py-3 pl-3">Justification</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-neutral-850">
                    {displayedClosures.map((cl: any) => {
                      const hasDiscrepancy = cl.status !== 'MATCHED' || Math.abs(Number(cl.discrepancy || 0)) > 0.01;
                      const diffNum = Number(cl.discrepancy || 0);

                      return (
                        <tr key={cl.id} className="hover:bg-gray-50/50 dark:hover:bg-neutral-900/50 transition-colors">
                          <td className="py-3 pr-3 font-mono font-medium">{cl.closure_date}</td>
                          <td className="py-3 px-3">
                            <div className="min-w-0">
                              <span className="font-bold text-neutral-900 dark:text-white block truncate">
                                {cl.cashier?.sell_point_name || cl.cashier?.full_name || "Point de Vente sans nom"}
                              </span>
                              <span className="text-[11px] text-neutral-500 dark:text-neutral-400 block truncate">
                                ({cl.cashier?.email || cl.cashier_id})
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-3">{cl.passes_approved_count}</td>
                          <td className="py-3 px-3 font-mono">{Number(cl.expected_amount).toFixed(2)} TND</td>
                          <td className="py-3 px-3 font-mono font-bold text-neutral-900 dark:text-white">{Number(cl.declared_amount).toFixed(2)} TND</td>
                          <td className="py-3 px-3 font-mono font-bold">
                            <span className={hasDiscrepancy ? 'text-red-500' : 'text-emerald-500'}>
                              {diffNum > 0 ? '+' : ''}{diffNum.toFixed(2)} TND
                            </span>
                          </td>
                          <td className="py-3 px-3">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                              !hasDiscrepancy
                                ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25'
                                : 'bg-red-500/15 text-red-500 dark:text-red-400 border border-red-500/30'
                            }`}>
                              {!hasDiscrepancy ? (
                                <>
                                  <CheckCircle2 size={11} />
                                  <span>Conforme</span>
                                </>
                              ) : (
                                <>
                                  <AlertTriangle size={11} />
                                  <span>Écart: {diffNum > 0 ? '+' : ''}{diffNum.toFixed(2)} TND</span>
                                </>
                              )}
                            </span>
                          </td>
                          <td className="py-3 pl-3 text-neutral-500 dark:text-neutral-400 max-w-xs truncate" title={cl.notes || ''}>
                            {cl.notes || '-'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* ─── TAB 3: HISTORIQUE DES RAMASSAGES ───────────────────────── */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        {activeTab === 'collections' && (
          <div className="card p-7 shadow-xs space-y-6 animate-in fade-in duration-150">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                  <Banknote className="w-5 h-5 text-emerald-500" />
                  Historique des Remises & Ramassages Superviseur
                </h3>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Traçabilité intégrale des mouvements d'espèces remis aux superviseurs avec génération de reçus
                </p>
              </div>

              {/* Export Buttons */}
              <div className="flex items-center gap-3">
                <button
                  onClick={() => handleExportCSV('collections')}
                  className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold bg-neutral-800 hover:bg-neutral-700 text-white border border-neutral-700 transition-colors cursor-pointer"
                >
                  <FileSpreadsheet size={14} className="text-emerald-400" />
                  <span>Exporter CSV</span>
                </button>
                <button
                  onClick={() => handleExportPDF('collections')}
                  className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold bg-passi-corail hover:bg-passi-corail/90 text-white shadow-md shadow-passi-corail/20 transition-all cursor-pointer"
                >
                  <FileText size={14} />
                  <span>Exporter PDF</span>
                </button>
              </div>
            </div>

            {/* Collections Table */}
            <div className="overflow-x-auto">
              {supervisionData.allCollections.length === 0 ? (
                <div className="text-center py-12 rounded-2xl bg-gray-50 dark:bg-neutral-950/60 border border-dashed border-gray-200 dark:border-neutral-800">
                  <p className="text-xs text-neutral-400">Aucune remise de caisse enregistrée.</p>
                </div>
              ) : (
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-neutral-800 text-neutral-400 font-semibold">
                      <th className="py-3 pr-3">Date & Heure</th>
                      <th className="py-3 px-3">Point de Vente / Guichetier</th>
                      <th className="py-3 px-3">Superviseur Bénéficiaire</th>
                      <th className="py-3 px-3">Montant Remis</th>
                      <th className="py-3 px-3">Notes / Remarques</th>
                      <th className="py-3 pl-3 text-right">Bon de Remise</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-neutral-850">
                    {supervisionData.allCollections.map((col: any) => (
                      <tr key={col.id} className="hover:bg-gray-50/50 dark:hover:bg-neutral-900/50 transition-colors">
                        <td className="py-3 pr-3 font-mono text-neutral-400">
                          {new Date(col.collection_time).toLocaleString('fr-FR')}
                        </td>
                        <td className="py-3 px-3">
                          <div className="min-w-0">
                            <span className="font-bold text-neutral-900 dark:text-white block truncate">
                              {col.cashier?.sell_point_name || col.cashier?.full_name || "Point de Vente sans nom"}
                            </span>
                            <span className="text-[11px] text-neutral-500 dark:text-neutral-400 block truncate">
                              ({col.cashier?.email || col.cashier_id})
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-3 font-bold text-amber-600 dark:text-amber-400">
                          {col.supervisor_name}
                        </td>
                        <td className="py-3 px-3 font-mono font-black text-emerald-600 dark:text-emerald-400">
                          {Number(col.collected_amount).toFixed(2)} TND
                        </td>
                        <td className="py-3 px-3 text-neutral-500 dark:text-neutral-400 max-w-xs truncate" title={col.notes || ''}>
                          {col.notes || '-'}
                        </td>
                        <td className="py-3 pl-3 text-right">
                          <button
                            onClick={() => handleDownloadSingleBon(col)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-gray-100 dark:bg-neutral-800 hover:bg-gray-200 dark:hover:bg-neutral-700 font-bold text-[11px] transition-colors cursor-pointer"
                            title="Télécharger le bon officiel en PDF"
                          >
                            <Download size={13} className="text-passi-corail" />
                            <span>Télécharger Bon (PDF)</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

      </div>

      {/* Edit Payment Point Modal */}
      <EditPaymentPointModal
        isOpen={isEditModalOpen}
        onClose={handleCloseEditModal}
        cashier={editingCashier}
        onSuccess={async () => {
          await onRefreshProfiles();
          await loadSupervisionData();
        }}
      />

    </div>
  );
}
