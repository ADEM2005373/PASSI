"use client";

import React, { useState, useEffect, useCallback } from "react";
import { api, User, Event } from "@/lib/services/api";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
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
  ArrowUpRight
} from "lucide-react";

interface PaymentPointSupervisionSectionProps {
  events: Event[];
  profiles: User[];
  onRefreshProfiles: () => Promise<void>;
  onToggleSuspend: (user: User) => Promise<void>;
  onDeleteUser: (userId: string) => Promise<void>;
}

export function PaymentPointSupervisionSection({
  events,
  profiles,
  onRefreshProfiles,
  onToggleSuspend,
  onDeleteUser,
}: PaymentPointSupervisionSectionProps) {
  // Account Creation Form State
  const [workerEmail, setWorkerEmail] = useState("");
  const [workerPassword, setWorkerPassword] = useState("");
  const [workerMsg, setWorkerMsg] = useState("");
  const [isCreatingWorker, setIsCreatingWorker] = useState(false);

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
  const [activeAuditTab, setActiveAuditTab] = useState<'closures' | 'collections'>('closures');

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
    setIsCreatingWorker(true);
    setWorkerMsg("Création en cours...");
    try {
      await api.adminCreateUser(workerEmail, workerPassword, "", "payment_point");
      setWorkerMsg("✓ Compte Guichetier créé avec succès !");
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

  // ─── ADMIN CSV EXPORT (CLOSURES & COLLECTIONS) ───
  const handleExportCSV = () => {
    if (activeAuditTab === 'closures') {
      const headers = ["Date Cloture", "Guichetier", "Passes Valides", "Montant Attendu (TND)", "Montant Declare (TND)", "Ecart (TND)", "Statut", "Notes Justificatives"];
      const rows = supervisionData.allClosures.map((cl: any) => [
        cl.closure_date || 'N/A',
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
      const headers = ["Date et Heure", "Guichetier", "Superviseur Beneficiaire", "Montant Remis (TND)", "Notes / Observations"];
      const rows = supervisionData.allCollections.map((col: any) => [
        col.collection_time ? col.collection_time.replace('T', ' ').slice(0, 19) : 'N/A',
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
  const handleExportPDF = () => {
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
    doc.text(`RAPPORT GÉNÉRÉ LE ${todayStr} À ${nowTimeStr} | ADMIN AUDIT REPORT`, 14, 28);

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

    let startY = 74;

    if (activeAuditTab === 'closures') {
      const tableRows = supervisionData.allClosures.map((cl: any) => [
        cl.closure_date || 'N/A',
        cl.cashier?.email || cl.cashier_id?.slice(0, 8) || 'N/A',
        String(cl.passes_approved_count ?? 0),
        `${Number(cl.expected_amount).toFixed(2)} DT`,
        `${Number(cl.declared_amount).toFixed(2)} DT`,
        `${Number(cl.discrepancy) > 0 ? '+' : ''}${Number(cl.discrepancy).toFixed(2)} DT`,
        cl.status === 'MATCHED' ? 'Conforme' : 'Écart Détecté',
        cl.notes || '-'
      ]);

      autoTable(doc, {
        startY,
        head: [["Date", "Guichetier", "Passes", "Attendu", "Déclaré", "Écart", "Statut", "Notes"]],
        body: tableRows.length > 0 ? tableRows : [["-", "Aucune clôture", "-", "-", "-", "-", "-", "-"]],
        theme: 'striped',
        headStyles: { fillColor: [255, 107, 94], fontStyle: 'bold', fontSize: 8 },
        styles: { fontSize: 8 },
      });
    } else {
      const tableRows = supervisionData.allCollections.map((col: any) => [
        col.collection_time ? col.collection_time.replace('T', ' ').slice(0, 16) : 'N/A',
        col.cashier?.email || col.cashier_id?.slice(0, 8) || 'N/A',
        col.supervisor_name || 'N/A',
        `${Number(col.collected_amount).toFixed(2)} DT`,
        col.notes || '-'
      ]);

      autoTable(doc, {
        startY,
        head: [["Date & Heure", "Guichetier", "Superviseur Bénéficiaire", "Montant Remis", "Observations"]],
        body: tableRows.length > 0 ? tableRows : [["-", "Aucune remise", "-", "-", "-"]],
        theme: 'striped',
        headStyles: { fillColor: [16, 185, 129], fontStyle: 'bold', fontSize: 8 },
        styles: { fontSize: 8 },
      });
    }

    doc.save(`audit_supervision_caisses_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  // Generate single Bon de Remise from admin table
  const handleDownloadSingleBon = (col: any) => {
    const doc = new jsPDF();
    const dateFormatted = new Date(col.collection_time || new Date()).toLocaleString('fr-FR');

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
    doc.text(`Point de Vente / Caissier : ${col.cashier?.email || col.cashier_id}`, 14, 60);
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
      
      {/* ─── 1. FINANCIAL DISCREPANCY ALERT BANNER (TOP PRIORITY) ─── */}
      {supervisionData.discrepancyAlerts.length > 0 && (
        <div className="relative overflow-hidden rounded-3xl border-2 border-rose-500/80 bg-gradient-to-r from-rose-500/20 via-rose-500/10 to-red-500/20 dark:from-rose-950/40 dark:via-rose-900/20 dark:to-red-950/40 p-6 shadow-xl animate-pulse">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-500 text-white flex items-center justify-center shrink-0 shadow-lg shadow-rose-500/40">
              <AlertTriangle className="w-6 h-6 animate-bounce" />
            </div>
            <div className="flex-1 space-y-3">
              <div>
                <h3 className="text-lg font-black text-rose-700 dark:text-rose-300 flex items-center gap-2">
                  🚨 ALERTE ÉCART DE CAISSE ({supervisionData.discrepancyAlerts.length} signalement{supervisionData.discrepancyAlerts.length > 1 ? 's' : ''})
                </h3>
                <p className="text-xs text-rose-800 dark:text-rose-200 mt-0.5 font-medium">
                  Des divergences entre le montant physique déclaré lors de la clôture et le total attendu par le système requièrent votre attention immédiate.
                </p>
              </div>

              <div className="space-y-2.5 pt-1">
                {supervisionData.discrepancyAlerts.map((alert: any) => {
                  const cashierName = alert.cashier?.full_name || alert.cashier?.email || alert.cashier_id;
                  const dateStr = alert.closure_date;
                  const declared = alert.declared_amount;
                  const expected = alert.expected_amount;
                  const count = alert.passes_approved_count;
                  const diff = alert.discrepancy;
                  const notes = alert.notes || 'Aucune justification fournie';

                  return (
                    <div 
                      key={alert.id}
                      className="p-3.5 rounded-2xl bg-white/80 dark:bg-neutral-900/90 border border-rose-300 dark:border-rose-800/80 text-xs text-neutral-800 dark:text-neutral-100 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-xs"
                    >
                      <div className="space-y-1">
                        <p className="font-bold text-rose-600 dark:text-rose-400">
                          Point de vente : <span className="text-neutral-900 dark:text-white">{cashierName}</span>
                        </p>
                        <p className="text-neutral-600 dark:text-neutral-300">
                          A déclaré <strong className="text-neutral-900 dark:text-white font-mono">{declared} TND</strong> au lieu de <strong className="text-neutral-900 dark:text-white font-mono">{expected} TND</strong> ({count} pass validés) le {dateStr}.
                        </p>
                        <p className="text-neutral-500 dark:text-neutral-400 italic">
                          Note du caissier : "{notes}"
                        </p>
                      </div>

                      <div className="shrink-0 flex items-center gap-3">
                        <span className="px-3 py-1.5 rounded-xl font-mono font-black text-sm bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30">
                          Écart : {diff > 0 ? '+' : ''}{diff} TND
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── 2. SUMMARY METRICS CARDS ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1 */}
        <div className="card p-5 border border-emerald-500/20 bg-emerald-500/5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
              Espèces Actuelles en Caisse
            </span>
            <Banknote className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
            {supervisionData.summary.totalLiveBalance.toFixed(2)} TND
          </div>
          <p className="text-[11px] text-neutral-500 mt-1">Cumul en tiroir chez tous les guichetiers</p>
        </div>

        {/* Metric 2 */}
        <div className="card p-5 border border-amber-500/20 bg-amber-500/5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider">
              Recettes Encaissées Aujourd'hui
            </span>
            <DollarSign className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-black text-amber-600 dark:text-amber-400">
            {supervisionData.summary.totalTodayRevenue.toFixed(2)} TND
          </div>
          <p className="text-[11px] text-neutral-500 mt-1">{supervisionData.summary.totalTodayPasses} pass validés aujourd'hui</p>
        </div>

        {/* Metric 3 */}
        <div className="card p-5 border border-blue-500/20 bg-blue-500/5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wider">
              Guichetiers Actifs
            </span>
            <UserIcon className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-black text-blue-600 dark:text-blue-400">
            {supervisionData.cashiersOverview.length}
          </div>
          <p className="text-[11px] text-neutral-500 mt-1">Points de paiement configurés</p>
        </div>

        {/* Metric 4 */}
        <div className={`card p-5 border ${supervisionData.summary.alertsCount > 0 ? 'border-rose-500/40 bg-rose-500/10' : 'border-gray-200 dark:border-neutral-800'}`}>
          <div className="flex items-center justify-between mb-2">
            <span className={`text-xs font-bold uppercase tracking-wider ${supervisionData.summary.alertsCount > 0 ? 'text-rose-600' : 'text-neutral-500'}`}>
              Alertes Clôtures
            </span>
            <AlertTriangle className={`w-4 h-4 ${supervisionData.summary.alertsCount > 0 ? 'text-rose-600' : 'text-neutral-400'}`} />
          </div>
          <div className={`text-2xl font-black ${supervisionData.summary.alertsCount > 0 ? 'text-rose-600' : 'text-neutral-800 dark:text-neutral-200'}`}>
            {supervisionData.summary.alertsCount}
          </div>
          <p className="text-[11px] text-neutral-500 mt-1">
            {supervisionData.summary.alertsCount > 0 ? 'Écarts non résolus' : 'Toutes les caisses sont équilibrées'}
          </p>
        </div>
      </div>

      {/* ─── 3. LIVE CASHIERS OVERVIEW GRID (FEATURE 2) ─── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
              Supervision en Temps Réel des Caissiers
            </h3>
            <p className="text-xs text-neutral-400 mt-0.5">
              Solde physique actuel en tiroir, activité du jour et dernier ramassage superviseur
            </p>
          </div>

          <button
            onClick={() => {
              loadSupervisionData();
              onRefreshProfiles();
            }}
            disabled={isLoading}
            className="p-2.5 rounded-xl border border-gray-200 dark:border-neutral-800 hover:bg-gray-100 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-400 transition-colors"
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
              const profileWorker = profiles.find(p => p.id === cashier.id);

              return (
                <div
                  key={cashier.id}
                  className="card p-5 border border-gray-200 dark:border-neutral-800 hover:border-amber-500/40 transition-all flex flex-col justify-between shadow-xs gap-4"
                >
                  {/* Top: Info & Status */}
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-sm ${cashier.is_suspended ? 'bg-rose-500/10 text-rose-400' : 'bg-emerald-500/10 text-emerald-500'}`}>
                          <Banknote size={20} />
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-bold text-sm truncate" style={{ color: 'var(--text-primary)' }}>
                            {cashier.email}
                          </h4>
                          <span className="text-[11px] text-neutral-400 font-mono">
                            ID: {cashier.id.slice(0, 8)}...
                          </span>
                        </div>
                      </div>

                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                        cashier.is_suspended
                          ? 'bg-rose-500/15 text-rose-400 border border-rose-500/20'
                          : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                      }`}>
                        {cashier.is_suspended ? 'Suspendu' : 'Actif'}
                      </span>
                    </div>

                    {/* Stats Grid inside card */}
                    <div className="p-3.5 rounded-2xl bg-gray-50 dark:bg-neutral-950/80 border border-gray-100 dark:border-neutral-800 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-neutral-500">Solde Actuel en Tiroir :</span>
                        <span className="text-base font-black text-emerald-600 dark:text-emerald-400 font-mono">
                          {cashier.liveDrawerBalance.toFixed(2)} TND
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-xs pt-1 border-t border-gray-200/60 dark:border-neutral-800/80">
                        <span className="text-neutral-500">Aujourd'hui :</span>
                        <span className="font-bold text-neutral-800 dark:text-neutral-200">
                          {cashier.todayRevenue.toFixed(2)} TND ({cashier.todayPassesCount} pass)
                        </span>
                      </div>

                      <div className="pt-1 border-t border-gray-200/60 dark:border-neutral-800/80">
                        <span className="text-[10px] text-neutral-400 uppercase font-semibold block">Dernier Ramassage :</span>
                        {cashier.lastCollection ? (
                          <div className="flex items-center justify-between text-xs mt-0.5">
                            <span className="font-bold text-neutral-700 dark:text-neutral-300">
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

                  {/* Actions: Suspend & Delete */}
                  {profileWorker && (
                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-gray-100 dark:border-neutral-800">
                      <button
                        onClick={() => onToggleSuspend(profileWorker)}
                        className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
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
                        onClick={() => onDeleteUser(cashier.id)}
                        className="p-2 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors"
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
      </div>

      {/* ─── 4. FULL AUDIT LOG TABS & EXPORTS (FEATURE 3 & 4) ─── */}
      <div className="card p-7 shadow-sm space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
              Historique & Registre d'Audit Complet
            </h3>
            <p className="text-xs text-neutral-400 mt-0.5">
              Traçabilité inaltérable des clôtures journalières et des remises de fonds aux superviseurs
            </p>
          </div>

          {/* Export Buttons */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-neutral-800 hover:bg-neutral-700 text-white border border-neutral-700 transition-colors cursor-pointer"
            >
              <FileSpreadsheet size={15} className="text-emerald-400" />
              <span>Exporter CSV ({activeAuditTab === 'closures' ? 'Clôtures' : 'Remises'})</span>
            </button>
            <button
              onClick={handleExportPDF}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-passi-corail hover:bg-passi-corail/90 text-white shadow-md shadow-passi-corail/20 transition-all cursor-pointer"
            >
              <FileText size={15} />
              <span>Exporter PDF d'Audit</span>
            </button>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-gray-100 dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 w-fit">
          <button
            onClick={() => setActiveAuditTab('closures')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeAuditTab === 'closures'
                ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-xs'
                : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
            }`}
          >
            <History size={14} className="text-amber-500" />
            <span>Tab 1 : Clôtures Journalières ({supervisionData.allClosures.length})</span>
          </button>

          <button
            onClick={() => setActiveAuditTab('collections')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeAuditTab === 'collections'
                ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-xs'
                : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
            }`}
          >
            <Banknote size={14} className="text-emerald-500" />
            <span>Tab 2 : Remises Superviseurs ({supervisionData.allCollections.length})</span>
          </button>
        </div>

        {/* TAB 1: CLÔTURES JOURNALIÈRES */}
        {activeAuditTab === 'closures' && (
          <div className="overflow-x-auto">
            {supervisionData.allClosures.length === 0 ? (
              <div className="text-center py-12 rounded-2xl bg-gray-50 dark:bg-neutral-950/60 border border-dashed border-gray-200 dark:border-neutral-800">
                <p className="text-xs text-neutral-400">Aucune clôture de caisse enregistrée.</p>
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
                  {supervisionData.allClosures.map((cl: any) => (
                    <tr key={cl.id} className="hover:bg-gray-50/50 dark:hover:bg-neutral-900/50 transition-colors">
                      <td className="py-3 pr-3 font-mono font-medium">{cl.closure_date}</td>
                      <td className="py-3 px-3">
                        <span className="font-semibold text-neutral-900 dark:text-white">{cl.cashier?.email || cl.cashier_id}</span>
                      </td>
                      <td className="py-3 px-3">{cl.passes_approved_count}</td>
                      <td className="py-3 px-3 font-mono">{Number(cl.expected_amount).toFixed(2)} TND</td>
                      <td className="py-3 px-3 font-mono font-bold text-neutral-900 dark:text-white">{Number(cl.declared_amount).toFixed(2)} TND</td>
                      <td className="py-3 px-3 font-mono font-bold">
                        <span className={Number(cl.discrepancy) === 0 ? 'text-emerald-500' : 'text-rose-500'}>
                          {Number(cl.discrepancy) > 0 ? '+' : ''}{Number(cl.discrepancy).toFixed(2)} TND
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          cl.status === 'MATCHED'
                            ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25'
                            : 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/25'
                        }`}>
                          {cl.status === 'MATCHED' ? (
                            <>
                              <CheckCircle2 size={11} />
                              <span>Conforme</span>
                            </>
                          ) : (
                            <>
                              <AlertTriangle size={11} />
                              <span>Écart Détecté</span>
                            </>
                          )}
                        </span>
                      </td>
                      <td className="py-3 pl-3 text-neutral-500 dark:text-neutral-400 max-w-xs truncate" title={cl.notes || ''}>
                        {cl.notes || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* TAB 2: REMISES SUPERVISEURS */}
        {activeAuditTab === 'collections' && (
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
                    <th className="py-3 px-3">Guichetier</th>
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
                      <td className="py-3 px-3 font-semibold text-neutral-900 dark:text-white">
                        {col.cashier?.email || col.cashier_id}
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
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gray-100 dark:bg-neutral-800 hover:bg-gray-200 dark:hover:bg-neutral-700 font-bold text-[11px] transition-colors"
                          title="Télécharger le bon officiel en PDF"
                        >
                          <Download size={12} className="text-passi-corail" />
                          <span>PDF</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {/* ─── 5. CREATE NEW PAYMENT POINT ACCOUNT CARD ─── */}
      <div className="card p-7 shadow-sm">
        <h3 className="text-lg font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
          Créer un nouveau Point de Paiement
        </h3>
        <p className="text-xs text-neutral-400 mb-6">
          Définissez les identifiants de connexion d'un nouvel opérateur de caisse
        </p>

        <form onSubmit={handleCreateWorker} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div>
            <label className="label">Adresse Email Guichetier</label>
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
            <label className="label">Mot de passe provisoire</label>
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
              className="btn-primary w-full flex items-center justify-center gap-2 py-3"
            >
              {isCreatingWorker ? (
                <RefreshCw size={16} className="animate-spin" />
              ) : (
                <Plus size={16} />
              )}
              <span>Créer le compte Guichet</span>
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
  );
}
