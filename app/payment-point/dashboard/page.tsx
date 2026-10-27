"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { api, Pass, Event, User } from "@/lib/services/api";
import { useAuth } from "@/lib/context/auth-context";
import { Logo } from "@/components/Logo";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
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
  Sun, 
  Moon, 
  LogOut, 
  Search, 
  CheckCircle2, 
  Calendar, 
  Banknote, 
  Ticket, 
  User as UserIcon, 
  AlertCircle, 
  RefreshCw, 
  Clock, 
  Sparkles, 
  Lock, 
  EyeOff, 
  FileText, 
  Download, 
  AlertTriangle, 
  ArrowUpRight, 
  ShieldCheck, 
  History, 
  Check, 
  X, 
  FileCheck2, 
  DollarSign, 
  Wallet, 
  TrendingUp, 
  BarChart3, 
  Activity, 
  ChevronRight,
  Users,
  CheckCheck
} from "lucide-react";

import { POSPassCreationTab } from "@/components/pos/POSPassCreationTab";

type CashierTab = 'guichet' | 'creation' | 'analytics' | 'operations';

export default function PaymentPointDashboard() {
  const router = useRouter();
  const { logout: contextLogout } = useAuth();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  
  // Navigation State
  const [activeTab, setActiveTab] = useState<CashierTab>('guichet');

  // Events and pending passes state
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>("");
  const [passes, setPasses] = useState<Pass[]>([]);
  const [loadingPasses, setLoadingPasses] = useState(false);
  const [approvingPassId, setApprovingPassId] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [errorToast, setErrorToast] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // ─── SYSTÈME CAISSIER: POS CASH MANAGEMENT STATE ───
  const [cashierData, setCashierData] = useState<{
    liveDrawerBalance: number;
    todayRevenue: number;
    todayPassesCount: number;
    lastCollection: any;
    todayPasses: any[];
    closuresHistory: any[];
    collectionsHistory: any[];
  }>({
    liveDrawerBalance: 0,
    todayRevenue: 0,
    todayPassesCount: 0,
    lastCollection: null,
    todayPasses: [],
    closuresHistory: [],
    collectionsHistory: [],
  });
  const [loadingCashierData, setLoadingCashierData] = useState(false);

  // Blind Closure State (Inline & Modal)
  const [isClosureModalOpen, setIsClosureModalOpen] = useState(false);
  const [declaredAmountInput, setDeclaredAmountInput] = useState<string>("");
  const [closureNotesInput, setClosureNotesInput] = useState<string>("");
  const [closureDiscrepancyWarning, setClosureDiscrepancyWarning] = useState<string | null>(null);
  const [isSubmittingClosure, setIsSubmittingClosure] = useState(false);

  // Supervisor Cash Collection State (Inline & Modal)
  const [isCollectionModalOpen, setIsCollectionModalOpen] = useState(false);
  const [supervisorNameInput, setSupervisorNameInput] = useState<string>("");
  const [collectedAmountInput, setCollectedAmountInput] = useState<string>("");
  const [collectionNotesInput, setCollectionNotesInput] = useState<string>("");
  const [collectionConfirmed, setCollectionConfirmed] = useState(false);
  const [isSubmittingCollection, setIsSubmittingCollection] = useState(false);
  const [lastCompletedCollection, setLastCompletedCollection] = useState<any>(null);

  // Fetch POS Financial Data
  const loadCashierPosData = useCallback(async () => {
    try {
      setLoadingCashierData(true);
      const data = await api.getCashierPosData();
      setCashierData(data);
    } catch (err: any) {
      console.warn("Unable to load POS cashier data:", err.message);
    } finally {
      setLoadingCashierData(false);
    }
  }, []);

  useEffect(() => {
    setMounted(true);
    const init = async () => {
      let user = await api.getCurrentUser();
      if (!user) {
        // Auto-recovery fallback check for cashier profile
        try {
          const { createClient } = await import('@/lib/supabase/client');
          const supabase = createClient();
          const { data: { user: authUser } } = await supabase.auth.getUser();
          if (authUser) {
            console.warn("Profil manquant pour l'utilisateur connecté, tentative d'auto-création...");
            const meta = authUser.user_metadata || {};
            const isStaff = authUser.email?.includes('passi.com');
            const defaultRole = (meta.role || (isStaff ? 'admin' : 'payment_point')).toLowerCase();
            const fullName = meta.full_name || [meta.first_name, meta.last_name].filter(Boolean).join(' ') || (authUser.email ? authUser.email.split('@')[0] : 'Caissier');
            
            await supabase.from('profiles').upsert({
              id: authUser.id,
              email: authUser.email || '',
              full_name: fullName,
              role: defaultRole,
            }, { onConflict: 'id' });

            user = await api.getCurrentUser();
          }
        } catch (e) {
          console.warn("Auto-recovery in POS dashboard init failed:", e);
        }
      }

      if (!user) {
        router.replace("/login");
        return;
      }
      
      const role = (user.role || '').toLowerCase();
      if (user.is_suspended) {
        await contextLogout();
        router.replace("/login?error=account_suspended");
        return;
      }

      if (role !== 'payment_point' && role !== 'admin') {
        router.replace("/login");
        return;
      }

      setCurrentUser(user);

      // Load active events & POS data in parallel
      const allEvents = await api.getEvents();
      setEvents(allEvents || []);
      if (allEvents && allEvents.length > 0) {
        setSelectedEventId(allEvents[0].id);
      }

      await loadCashierPosData();
    };
    init();
  }, [router, contextLogout, loadCashierPosData]);

  // Load passes whenever selected event changes
  useEffect(() => {
    if (!selectedEventId) {
      setPasses([]);
      return;
    }

    fetchPendingPasses(selectedEventId);
  }, [selectedEventId]);

  const fetchPendingPasses = async (eventId: string) => {
    setLoadingPasses(true);
    setErrorToast(null);
    try {
      const data = await api.getPaymentPointPasses(eventId);
      const preApprovedOnly = (data || []).filter((p: any) => {
        const es = p.entry_status;
        const s = p.status;
        if (es === 'pending' || s === 'pending' || s === 'PENDING') return false;
        return es === 'awaiting_payment' || s === 'PENDING_PAYMENT';
      });
      setPasses(preApprovedOnly);
    } catch (err: any) {
      console.error("Error fetching passes:", err);
      setErrorToast("Erreur lors de la récupération des passes en attente");
    } finally {
      setLoadingPasses(false);
    }
  };

  const handleApprovePayment = async (pass: Pass, orderPasses: Pass[] = [pass]) => {
    if (approvingPassId) return;
    setApprovingPassId(pass.id);
    setErrorToast(null);
    setSuccessToast(null);

    try {
      const isMulti = orderPasses.length > 1;
      const totalAmount = orderPasses.reduce(
        (acc, p: any) => acc + Number(p.final_price ?? selectedEvent?.base_price ?? 0),
        0
      );
      const resCode = pass.reservation_code;

      await api.approvePaymentPointPass(pass.id);

      if (isMulti && resCode) {
        setSuccessToast(
          `Paiement groupé de ${totalAmount} DT validé pour les ${orderPasses.length} passes (${resCode}) ! Tous les billets ont été expédiés par e-mail.`
        );
      } else {
        setSuccessToast(
          `Paiement de ${pass.final_price ?? totalAmount} DT validé pour le pass #${pass.id.slice(0, 8)} ! Le billet a été expédié par e-mail.`
        );
      }
      
      // Remove all approved passes from the pending list
      const idsToRemove = new Set(orderPasses.map(p => p.id));
      if (resCode) {
        setPasses(prev => prev.filter(p => p.reservation_code !== resCode && !idsToRemove.has(p.id)));
      } else {
        setPasses(prev => prev.filter(p => !idsToRemove.has(p.id)));
      }

      // Instantly refresh POS drawer balance and stats
      loadCashierPosData();

      setTimeout(() => {
        setSuccessToast(null);
      }, 5000);
    } catch (err: any) {
      console.error("Approve error:", err);
      setErrorToast(err.message || "Erreur lors de l'approbation du paiement");
      setTimeout(() => {
        setErrorToast(null);
      }, 5000);
    } finally {
      setApprovingPassId(null);
    }
  };

  // ─── BLIND CLOSURE SUBMISSION ───
  const handleOpenClosureModal = () => {
    setDeclaredAmountInput("");
    setClosureNotesInput("");
    setClosureDiscrepancyWarning(null);
    setIsClosureModalOpen(true);
  };

  const handleSubmitBlindClosure = async (e: React.FormEvent) => {
    e.preventDefault();
    const declaredNum = parseFloat(declaredAmountInput);
    if (isNaN(declaredNum) || declaredNum < 0) {
      setErrorToast("Veuillez saisir un montant physique valide.");
      return;
    }

    setIsSubmittingClosure(true);
    setErrorToast(null);

    try {
      const res = await api.submitCashClosure(declaredNum, closureNotesInput);
      setSuccessToast(res.message);
      setIsClosureModalOpen(false);
      setDeclaredAmountInput("");
      setClosureNotesInput("");
      setClosureDiscrepancyWarning(null);
      await loadCashierPosData();
      setTimeout(() => setSuccessToast(null), 5000);
    } catch (err: any) {
      if (err.requiresNotes) {
        setClosureDiscrepancyWarning(
          `Écart de caisse détecté ! Vous avez déclaré ${err.declaredAmount} TND au lieu de ${err.expectedAmount} TND (Écart : ${err.discrepancy > 0 ? '+' : ''}${err.discrepancy} TND). Veuillez obligatoirement saisir une note justificative pour valider.`
        );
      } else {
        setErrorToast(err.message || "Erreur lors de la clôture de caisse");
      }
    } finally {
      setIsSubmittingClosure(false);
    }
  };

  // ─── SUPERVISOR COLLECTION SUBMISSION & RESET ───
  const handleOpenCollectionModal = () => {
    setSupervisorNameInput("");
    setCollectedAmountInput(String(cashierData.liveDrawerBalance || 0));
    setCollectionNotesInput("");
    setCollectionConfirmed(false);
    setIsCollectionModalOpen(true);
  };

  const handleSubmitSupervisorCollection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supervisorNameInput.trim()) {
      setErrorToast("Veuillez renseigner le nom et prénom du superviseur.");
      return;
    }

    const collectedNum = parseFloat(collectedAmountInput);
    if (isNaN(collectedNum) || collectedNum <= 0) {
      setErrorToast("Le montant remis doit être un montant supérieur à zéro.");
      return;
    }

    if (!collectionConfirmed) {
      setErrorToast("Veuillez cocher la case de confirmation de remise en main propre.");
      return;
    }

    setIsSubmittingCollection(true);
    setErrorToast(null);

    try {
      const res = await api.submitSupervisorCollection(supervisorNameInput, collectedNum, collectionNotesInput);
      setLastCompletedCollection(res.collection);
      setSuccessToast(res.message);
      setIsCollectionModalOpen(false);
      setSupervisorNameInput("");
      setCollectedAmountInput("");
      setCollectionNotesInput("");
      setCollectionConfirmed(false);
      await loadCashierPosData();
      setTimeout(() => setSuccessToast(null), 6000);
    } catch (err: any) {
      setErrorToast(err.message || "Erreur lors de la remise de caisse au superviseur");
    } finally {
      setIsSubmittingCollection(false);
    }
  };

  // ─── GENERATE BON DE REMISE (PDF) ───
  const handleDownloadBonDeRemise = (collection?: any) => {
    const col = collection || lastCompletedCollection || cashierData.lastCollection;
    if (!col) {
      alert("Aucune information de remise disponible pour générer le bon.");
      return;
    }

    const doc = new jsPDF();
    const dateFormatted = new Date(col.collection_time || col.created_at || new Date()).toLocaleString('fr-FR');

    // Header with Passi Brand
    doc.setFillColor(26, 32, 44);
    doc.rect(0, 0, 210, 36, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    doc.text("PASSI — SYSTÈME CAISSIER", 14, 18);

    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(255, 107, 94);
    doc.text("BON OFFICIEL DE REMISE DE FONDS (ESPÈCES)", 14, 28);

    // Metadata section
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text(`RÉFÉRENCE : ${col.id ? col.id.slice(0, 13).toUpperCase() : 'REMISE-' + Date.now()}`, 14, 46);
    doc.setFont("helvetica", "normal");
    doc.text(`Date & Heure du ramassage : ${dateFormatted}`, 14, 53);
    doc.text(`Point de Vente / Caissier : ${currentUser?.email || 'Caissier Passi'}`, 14, 60);
    doc.text(`Superviseur Bénéficiaire : ${col.supervisor_name}`, 14, 67);

    // Big Amount Box
    doc.setFillColor(241, 245, 249);
    doc.roundedRect(14, 76, 182, 32, 3, 3, 'F');
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("MONTANT TOTAL REMIS EN ESPÈCES :", 20, 88);
    doc.setFontSize(22);
    doc.setTextColor(16, 185, 129);
    doc.text(`${Number(col.collected_amount).toFixed(2)} TND`, 20, 101);

    // Notes
    if (col.notes) {
      doc.setFontSize(10);
      doc.setTextColor(71, 85, 105);
      doc.setFont("helvetica", "italic");
      doc.text(`Observations / Notes : ${col.notes}`, 14, 120);
    }

    // Handover statement
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.setFont("helvetica", "normal");
    doc.text(
      "Par la présente, le superviseur certifie avoir réceptionné l'intégralité du montant en espèces ci-dessus désigné.",
      14,
      135
    );
    doc.text(
      "Ce reçu fait foi d'apurement de la caisse physique du guichetier pour la période clôturée.",
      14,
      141
    );

    // Signatures blocks
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(14, 155, 85, 45, 2, 2, 'S');
    doc.roundedRect(111, 155, 85, 45, 2, 2, 'S');

    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42);
    doc.text("Signature du Guichetier :", 20, 165);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 116, 139);
    doc.text(`(${currentUser?.email})`, 20, 171);

    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42);
    doc.text("Signature du Superviseur :", 117, 165);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 116, 139);
    doc.text(`(${col.supervisor_name})`, 117, 171);

    doc.save(`Bon_Remise_${col.supervisor_name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  // ─── GENERATE DAILY CASHIER REPORT (PDF) ───
  const handleExportCashierReportPDF = () => {
    const doc = new jsPDF();
    const todayStr = new Date().toLocaleDateString('fr-FR');
    const nowTimeStr = new Date().toLocaleTimeString('fr-FR');

    // Header
    doc.setFillColor(26, 32, 44);
    doc.rect(0, 0, 210, 36, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.setFont("helvetica", "bold");
    doc.text("PASSI — RAPPORT JOURNALIER DE CAISSE", 14, 18);

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(255, 107, 94);
    doc.text(`GÉNÉRÉ LE ${todayStr} À ${nowTimeStr} | GUICHETIER : ${currentUser?.email || 'N/A'}`, 14, 28);

    // Summary boxes
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(14, 44, 56, 24, 2, 2, 'F');
    doc.roundedRect(77, 44, 56, 24, 2, 2, 'F');
    doc.roundedRect(140, 44, 56, 24, 2, 2, 'F');

    doc.setTextColor(100, 116, 139);
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text("SOLDE PHYSIQUE ACTUEL", 18, 52);
    doc.text("RECETTE DU JOUR", 81, 52);
    doc.text("PASSES VALIDÉS AUJOURD'HUI", 144, 52);

    doc.setFontSize(14);
    doc.setTextColor(16, 185, 129);
    doc.text(`${cashierData.liveDrawerBalance.toFixed(2)} TND`, 18, 62);
    doc.setTextColor(15, 23, 42);
    doc.text(`${cashierData.todayRevenue.toFixed(2)} TND`, 81, 62);
    doc.text(`${cashierData.todayPassesCount} pass`, 144, 62);

    // Detailed passes table
    const tableRows = (cashierData.todayPasses || []).map((p: any) => [
      `#${p.id.slice(0, 8)}`,
      p.guestName || 'Invité',
      p.eventTitle || 'Passi',
      `${Number(p.price).toFixed(2)} TND`,
      p.approvedAt ? new Date(p.approvedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : 'N/A'
    ]);

    if (tableRows.length === 0) {
      tableRows.push(["-", "Aucun pass validé aujourd'hui", "-", "0.00 TND", "-"]);
    }

    autoTable(doc, {
      startY: 76,
      head: [["ID Pass", "Nom Invité", "Événement", "Montant", "Heure"]],
      body: tableRows,
      foot: [["Total Encaissé", "", "", `${cashierData.todayRevenue.toFixed(2)} TND`, `${cashierData.todayPassesCount} pass`]],
      theme: 'striped',
      headStyles: { fillColor: [255, 107, 94], fontStyle: 'bold' },
      footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold' },
    });

    doc.save(`Rapport_Caisse_${new Date().toISOString().split('T')[0]}_${currentUser?.email?.split('@')[0]}.pdf`);
  };

  // Search filter supporting reservation code, phone, email, guest name, and pass ID
  const filteredPasses = useMemo(() => {
    if (!searchQuery.trim()) return passes;
    const searchTerm = searchQuery.toLowerCase().trim();
    return passes.filter((pass: any) => {
      const passId = (pass.id || '').toLowerCase();
      const reservationCode = (pass.reservation_code || '').toLowerCase();
      const guestFullName = `${pass.guest_first_name || ''} ${pass.guest_last_name || ''}`.trim().toLowerCase();
      const userProfileName = (pass.user?.full_name || pass.user_name || `${pass.user?.first_name || ''} ${pass.user?.last_name || ''}`).trim().toLowerCase();
      const fullName = `${guestFullName} ${userProfileName}`.trim().toLowerCase();
      const phone = (pass.phone || '').toLowerCase();
      const email = (pass.email || pass.user_email || '').toLowerCase();
      
      return (
        reservationCode.includes(searchTerm) ||
        phone.includes(searchTerm) ||
        email.includes(searchTerm) ||
        fullName.includes(searchTerm) ||
        passId.includes(searchTerm)
      );
    });
  }, [passes, searchQuery]);

  const selectedEvent = useMemo(() => {
    return events.find(e => e.id === selectedEventId);
  }, [events, selectedEventId]);

  // Group passes by reservation_code when applicable
  const groupedOrders = useMemo(() => {
    const groups: { [key: string]: any[] } = {};
    const individualOrders: any[] = [];

    filteredPasses.forEach((pass: any) => {
      if (pass.reservation_code) {
        if (!groups[pass.reservation_code]) {
          groups[pass.reservation_code] = [];
        }
        groups[pass.reservation_code].push(pass);
      } else {
        individualOrders.push({
          orderId: pass.id,
          reservationCode: null,
          isMultiPass: false,
          passes: [pass],
          totalPrice: Number(pass.final_price ?? selectedEvent?.base_price ?? 0),
          buyerName: [pass.guest_first_name, pass.guest_last_name].filter(Boolean).join(' ') || pass.user?.full_name || pass.user_name || pass.instagram_handle || 'Client Inconnu',
          email: pass.email || pass.user_email || null,
          phone: pass.phone || null,
          primaryPass: pass,
        });
      }
    });

    const reservationGroups = Object.entries(groups).map(([resCode, passList]) => {
      const primaryPass = passList[0];
      const totalPrice = passList.reduce(
        (sum, p) => sum + Number(p.final_price ?? selectedEvent?.base_price ?? 0),
        0
      );
      const buyerName = [primaryPass.guest_first_name, primaryPass.guest_last_name].filter(Boolean).join(' ') || primaryPass.user?.full_name || primaryPass.user_name || primaryPass.instagram_handle || 'Client Inconnu';

      return {
        orderId: resCode,
        reservationCode: resCode,
        isMultiPass: passList.length > 1,
        passes: passList,
        totalPrice,
        buyerName,
        email: primaryPass.email || primaryPass.user_email || null,
        phone: primaryPass.phone || null,
        primaryPass,
      };
    });

    return [...reservationGroups, ...individualOrders];
  }, [filteredPasses, selectedEvent]);

  // Check if today's register is closed
  const isTodayRegisterClosed = useMemo(() => {
    const todayIso = new Date().toISOString().split('T')[0];
    return (cashierData.closuresHistory || []).some(
      (c: any) => c.closure_date === todayIso
    );
  }, [cashierData.closuresHistory]);

  // ─── RECHARTS DATA PREPARATION ───
  // 1. Last 7 Days Revenue & Passes Trend
  const last7DaysData = useMemo(() => {
    const days = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateIso = d.toISOString().split('T')[0];
      const dayLabel = d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' });
      
      if (i === 0) {
        days.push({
          date: dateIso,
          dayLabel,
          recette: cashierData.todayRevenue,
          passes: cashierData.todayPassesCount,
        });
      } else {
        const closure = (cashierData.closuresHistory || []).find((c: any) => c.closure_date === dateIso);
        days.push({
          date: dateIso,
          dayLabel,
          recette: closure ? Number(closure.expected_amount || closure.declared_amount || 0) : 0,
          passes: closure ? Number(closure.passes_approved_count || 0) : 0,
        });
      }
    }
    return days;
  }, [cashierData.todayRevenue, cashierData.todayPassesCount, cashierData.closuresHistory]);

  // 2. Hourly Sales Distribution (Peak activity detection)
  const hourlySalesData = useMemo(() => {
    const hoursOrder = [14, 16, 18, 20, 22, 23, 0, 1, 2, 3];
    const buckets: { [key: string]: { passes: number; revenue: number } } = {};
    hoursOrder.forEach(h => {
      buckets[`${h}h`] = { passes: 0, revenue: 0 };
    });

    (cashierData.todayPasses || []).forEach((pass: any) => {
      const timeStr = pass.approvedAt || pass.created_at;
      if (timeStr) {
        const d = new Date(timeStr);
        const hour = d.getHours();
        const key = `${hour}h`;
        if (!buckets[key]) {
          buckets[key] = { passes: 0, revenue: 0 };
        }
        buckets[key].passes += 1;
        buckets[key].revenue += Number(pass.price || 0);
      }
    });

    return Object.entries(buckets).map(([hour, val]) => ({
      hour,
      passes: val.passes,
      revenue: val.revenue,
    }));
  }, [cashierData.todayPasses]);

  // Peak Hour detection
  const peakHour = useMemo(() => {
    if (!hourlySalesData || hourlySalesData.length === 0) return null;
    const sorted = [...hourlySalesData].sort((a, b) => b.passes - a.passes);
    return sorted[0].passes > 0 ? sorted[0] : null;
  }, [hourlySalesData]);

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 flex flex-col selection:bg-amber-500/30 selection:text-amber-800 dark:selection:text-amber-200 transition-colors duration-200 font-sans">
      
      {/* ─── APP HEADER ─── */}
      <header className="sticky top-0 z-40 border-b border-gray-200 dark:border-neutral-800/80 bg-white/90 dark:bg-neutral-950/90 backdrop-blur-md px-4 sm:px-6 py-3 transition-colors">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Logo className="w-[105px] h-[32px] sm:w-[120px] sm:h-[36px]" />
            <div className="h-5 w-[1px] bg-gray-200 dark:bg-neutral-800 hidden sm:block" />
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/25">
                <Banknote className="w-3.5 h-3.5" />
                Système Caissier (POS)
              </span>
              <span className="text-xs text-neutral-500 dark:text-neutral-400 hidden md:inline">
                {currentUser?.email}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
              className="p-2 rounded-xl text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-gray-100 dark:hover:bg-neutral-900 border border-gray-200 dark:border-neutral-800 transition-colors"
              title="Changer de thème"
              aria-label="Basculer le mode d'affichage"
            >
              {resolvedTheme === "dark" ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-neutral-700" />}
            </button>
            <button
              onClick={async () => {
                await contextLogout();
                router.replace("/login");
              }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Déconnexion</span>
            </button>
          </div>
        </div>
      </header>

      {/* ─── STEP A: STICKY TOP KPI HEADER (ALWAYS VISIBLE) ─── */}
      <div className="sticky top-[57px] z-30 border-b border-gray-200/90 dark:border-neutral-800/90 bg-white/95 dark:bg-neutral-950/95 backdrop-blur-md px-4 sm:px-6 py-3 transition-colors shadow-xs">
        <div className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          
          {/* Card 1: Solde En Caisse (Tiroir Actuel) */}
          <div className="rounded-2xl border border-emerald-500/30 dark:border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 via-white dark:via-neutral-900/90 to-white dark:to-neutral-900/90 p-4 shadow-xs flex items-center justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 truncate">
                  Solde En Caisse (Tiroir Actuel)
                </span>
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-3xl font-black text-emerald-600 dark:text-emerald-400 tracking-tight font-mono">
                  {cashierData.liveDrawerBalance.toFixed(2)}
                </span>
                <span className="text-sm font-bold text-emerald-700 dark:text-emerald-400">TND</span>
              </div>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-1 italic">
                Depuis le dernier ramassage
              </p>
            </div>
            <div className="w-11 h-11 rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/25">
              <Wallet className="w-5 h-5" />
            </div>
          </div>

          {/* Card 2: Recette du Jour */}
          <div className="rounded-2xl border border-blue-500/30 dark:border-blue-500/20 bg-gradient-to-br from-blue-500/10 via-white dark:via-neutral-900/90 to-white dark:to-neutral-900/90 p-4 shadow-xs flex items-center justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="w-2 h-2 rounded-full bg-blue-500" />
                <span className="text-[11px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400 truncate">
                  Recette du Jour
                </span>
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-3xl font-black text-blue-500 dark:text-blue-400 tracking-tight font-mono">
                  {cashierData.todayRevenue.toFixed(2)}
                </span>
                <span className="text-sm font-bold text-blue-600 dark:text-blue-400">TND</span>
              </div>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-1">
                Total encaissé aujourd'hui
              </p>
            </div>
            <div className="w-11 h-11 rounded-2xl bg-blue-500/15 text-blue-500 flex items-center justify-center shrink-0 border border-blue-500/25">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>

          {/* Card 3: Passes Encaissés Aujourd'hui */}
          <div className="rounded-2xl border border-purple-500/30 dark:border-purple-500/20 bg-gradient-to-br from-purple-500/10 via-white dark:via-neutral-900/90 to-white dark:to-neutral-900/90 p-4 shadow-xs flex items-center justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="w-2 h-2 rounded-full bg-purple-500" />
                <span className="text-[11px] font-bold uppercase tracking-wider text-purple-700 dark:text-purple-400 truncate">
                  Passes Encaissés Aujourd'hui
                </span>
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-3xl font-black text-purple-500 dark:text-purple-400 tracking-tight font-mono">
                  {cashierData.todayPassesCount}
                </span>
                <span className="text-sm font-bold text-purple-600 dark:text-purple-400">pass</span>
              </div>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-1">
                Validé(s) par votre compte
              </p>
            </div>
            <div className="w-11 h-11 rounded-2xl bg-purple-500/15 text-purple-500 flex items-center justify-center shrink-0 border border-purple-500/25">
              <Ticket className="w-5 h-5" />
            </div>
          </div>

        </div>
      </div>

      {/* ─── MAIN CONTENT CONTAINER ─── */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex flex-col gap-6">

        {/* Floating Toasts */}
        {successToast && (
          <div className="flex items-center gap-3 p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-sm animate-in fade-in shadow-sm">
            <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <span className="font-semibold">{successToast}</span>
            {lastCompletedCollection && (
              <button
                onClick={() => handleDownloadBonDeRemise(lastCompletedCollection)}
                className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Télécharger Bon de Remise</span>
              </button>
            )}
          </div>
        )}

        {errorToast && (
          <div className="flex items-center gap-3 p-4 rounded-2xl bg-rose-50 dark:bg-rose-500/15 border border-rose-200 dark:border-rose-500/30 text-rose-800 dark:text-rose-300 text-sm animate-in fade-in shadow-sm">
            <AlertCircle className="w-5 h-5 shrink-0 text-rose-600 dark:text-rose-400" />
            <span className="font-semibold">{errorToast}</span>
          </div>
        )}

        {/* ─── STEP B: CLEAN 3-TAB NAVIGATION BAR ─── */}
        <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-gray-200/60 dark:bg-neutral-900 border border-gray-300/60 dark:border-neutral-800 w-full sm:w-fit overflow-x-auto shadow-xs">
          
          <button
            onClick={() => setActiveTab('guichet')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'guichet'
                ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-xs'
                : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
            }`}
          >
            <Ticket className="w-4 h-4 text-amber-500" />
            <span>🎫 Guichet & Encaissement</span>
            {filteredPasses.length > 0 && (
              <span className="ml-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500 text-white">
                {filteredPasses.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('creation')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'creation'
                ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-xs'
                : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
            }`}
          >
            <Sparkles className="w-4 h-4 text-purple-500" />
            <span>⚡ Émission Directe (Vente Guichet)</span>
          </button>

          <button
            onClick={() => setActiveTab('analytics')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'analytics'
                ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-xs'
                : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
            }`}
          >
            <BarChart3 className="w-4 h-4 text-blue-500" />
            <span>📊 Statistiques & Graphiques</span>
          </button>

          <button
            onClick={() => setActiveTab('operations')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'operations'
                ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-xs'
                : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
            }`}
          >
            <Lock className="w-4 h-4 text-emerald-500" />
            <span>🔒 Opérations de Caisse (Clôture & Remise)</span>
            {!isTodayRegisterClosed && (
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse ml-0.5" />
            )}
          </button>

        </div>

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* ─── ONGLET 1: GUICHET & ENCAISSEMENT (DEFAULT TAB) ─────────── */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        {activeTab === 'guichet' && (
          <div className="space-y-6 animate-in fade-in duration-150">
            
            {/* Top Control Bar: Event Selector, Search, Refresh */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
              {/* Event Dropdown */}
              <div className="md:col-span-5 relative">
                <label className="text-xs font-semibold text-neutral-600 dark:text-neutral-400 mb-1.5 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-neutral-500 dark:text-neutral-400" />
                  Événement Actif
                </label>
                <select
                  value={selectedEventId}
                  onChange={(e) => setSelectedEventId(e.target.value)}
                  className="w-full bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl px-3.5 py-2.5 text-sm font-medium text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500/40 transition-colors cursor-pointer shadow-xs"
                >
                  {events.length === 0 ? (
                    <option value="">Aucun événement disponible</option>
                  ) : (
                    events.map(ev => (
                      <option key={ev.id} value={ev.id} className="bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white">
                        {ev.title} — {new Date(ev.date).toLocaleDateString('fr-FR')} (Prix de base: {ev.base_price ?? 0} DT)
                      </option>
                    ))
                  )}
                </select>
              </div>

              {/* Search Box */}
              <div className="md:col-span-6 relative">
                <label className="text-xs font-semibold text-neutral-600 dark:text-neutral-400 mb-1.5 flex items-center gap-1.5">
                  <Search className="w-3.5 h-3.5 text-neutral-500 dark:text-neutral-400" />
                  Recherche par code réservation, tél, e-mail ou nom
                </label>
                <div className="relative">
                  <Search className="w-4 h-4 text-neutral-400 dark:text-neutral-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Rechercher par code (ex: QCK-...), tél, e-mail ou nom..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl pl-10 pr-16 py-2.5 text-sm text-neutral-900 dark:text-white placeholder-neutral-400 dark:placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500/40 transition-colors shadow-xs"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-neutral-400 hover:text-neutral-700 dark:hover:text-white font-medium"
                    >
                      Effacer
                    </button>
                  )}
                </div>
              </div>

              {/* Refresh Button */}
              <div className="md:col-span-1 flex md:items-end h-full">
                <button
                  onClick={() => {
                    if (selectedEventId) fetchPendingPasses(selectedEventId);
                    loadCashierPosData();
                  }}
                  disabled={loadingPasses || !selectedEventId}
                  className="w-full md:w-auto mt-auto p-2.5 bg-white dark:bg-neutral-900 hover:bg-gray-100 dark:hover:bg-neutral-800 border border-gray-200 dark:border-neutral-800 rounded-xl text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white transition-colors flex items-center justify-center disabled:opacity-50 shadow-xs cursor-pointer"
                  title="Actualiser la liste et les données de caisse"
                >
                  <RefreshCw className={`w-4 h-4 ${loadingPasses || loadingCashierData ? 'animate-spin text-amber-500' : ''}`} />
                </button>
              </div>
            </div>

            {/* List Header Info */}
            <div className="flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400 font-medium px-1">
              <span>
                Passes en attente d'encaissement: <strong className="text-neutral-900 dark:text-white">{filteredPasses.length}</strong>
                {groupedOrders.length !== filteredPasses.length && (
                  <span className="text-neutral-500 dark:text-neutral-400 font-normal"> ({groupedOrders.length} commande{groupedOrders.length > 1 ? 's' : ''})</span>
                )}
                {searchQuery && ` (sur ${passes.length} au total)`}
              </span>
              {selectedEvent && (
                <span>Prix de base de l'événement: <strong className="text-amber-600 dark:text-amber-400">{selectedEvent.base_price ?? 0} DT</strong></span>
              )}
            </div>

            {/* Passes Waiting for Approval Grid */}
            {loadingPasses ? (
              <div className="flex flex-col items-center justify-center py-20 rounded-2xl border border-gray-200 dark:border-neutral-800/80 bg-white/60 dark:bg-neutral-900/30">
                <RefreshCw className="w-8 h-8 text-amber-500 dark:text-amber-400 animate-spin mb-3" />
                <p className="text-sm text-neutral-600 dark:text-neutral-400 font-medium">Chargement des passes en attente...</p>
              </div>
            ) : groupedOrders.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 rounded-2xl border border-gray-200 dark:border-neutral-800/80 bg-white dark:bg-neutral-900/20 text-center px-4 shadow-xs">
                <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-neutral-900 flex items-center justify-center text-neutral-400 dark:text-neutral-500 mb-3 border border-gray-200 dark:border-neutral-800">
                  <Ticket className="w-6 h-6" />
                </div>
                <h3 className="text-base font-semibold text-neutral-900 dark:text-white">Aucun pass en attente d'encaissement</h3>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 max-w-sm">
                  {searchQuery
                    ? "Aucun pass ne correspond à votre recherche. Essayez un autre mot-clé (code, email, téléphone ou nom)."
                    : "Tous les pass pour cet événement ont été réglés ou aucune demande n'est en attente."}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {groupedOrders.map((order: any) => {
                  // MULTI-PASS ORDER CARD
                  if (order.isMultiPass) {
                    const isApproving = order.passes.some((p: any) => p.id === approvingPassId);
                    const firstPass = order.primaryPass;

                    return (
                      <div
                        key={order.orderId}
                        className="relative rounded-2xl border-2 border-purple-500/30 dark:border-purple-500/30 bg-gradient-to-b from-purple-500/[0.04] via-white dark:via-neutral-900/80 to-white dark:to-neutral-900/80 p-5 flex flex-col justify-between hover:border-purple-500/50 transition-all hover:shadow-lg dark:hover:shadow-purple-500/5 group shadow-xs"
                      >
                        <div>
                          {/* Header Card */}
                          <div className="flex items-start justify-between gap-3 mb-3">
                            <div className="flex items-center gap-2.5">
                              <div className="w-10 h-10 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-600 dark:text-purple-400 font-bold text-sm shrink-0">
                                <Users className="w-5 h-5" />
                              </div>
                              <div>
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <h4 className="text-sm font-black text-neutral-900 dark:text-white truncate max-w-[150px]">
                                    {order.buyerName}
                                  </h4>
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-purple-500/20 text-purple-700 dark:text-purple-300 border border-purple-500/30">
                                    ⚡ {order.passes.length} passes
                                  </span>
                                </div>
                                <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate max-w-[180px] mt-0.5">
                                  <span className="font-bold text-purple-600 dark:text-purple-400 font-mono">{order.reservationCode}</span>
                                  {order.phone ? ` • 📞 ${order.phone}` : ''}
                                </p>
                              </div>
                            </div>

                            {/* Status Badge */}
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30 shrink-0">
                              <Clock className="w-3 h-3" />
                              {order.passes.length} passes à encaisser
                            </span>
                          </div>

                          {/* Details Box */}
                          <div className="bg-gray-50/90 dark:bg-neutral-950/80 rounded-xl p-3 border border-gray-200/80 dark:border-neutral-800/80 space-y-2 mb-4">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-neutral-500 dark:text-neutral-400">Code Réservation</span>
                              <span className="font-mono text-purple-600 dark:text-purple-400 font-black bg-purple-500/15 px-2 py-0.5 rounded border border-purple-500/25">
                                {order.reservationCode}
                              </span>
                            </div>

                            {order.email && (
                              <div className="flex items-center justify-between text-xs">
                                <span className="text-neutral-500 dark:text-neutral-400">E-mail acheteur</span>
                                <span className="text-neutral-800 dark:text-neutral-200 font-medium truncate max-w-[150px]" title={order.email}>
                                  {order.email}
                                </span>
                              </div>
                            )}

                            {order.phone && (
                              <div className="flex items-center justify-between text-xs">
                                <span className="text-neutral-500 dark:text-neutral-400">Téléphone</span>
                                <span className="text-neutral-800 dark:text-neutral-200 font-medium">
                                  {order.phone}
                                </span>
                              </div>
                            )}

                            {/* Tickets Breakdown List */}
                            <div className="pt-2 border-t border-gray-200/80 dark:border-neutral-800/80">
                              <p className="text-[11px] font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-1.5 flex items-center justify-between">
                                <span>Détail des {order.passes.length} billets</span>
                                <span className="text-purple-600 dark:text-purple-400 font-semibold">{order.passes[0]?.final_price ?? selectedEvent?.base_price ?? 0} DT/pass</span>
                              </p>
                              <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                                {order.passes.map((p: any, idx: number) => {
                                  const guestName = [p.guest_first_name, p.guest_last_name].filter(Boolean).join(' ') || `Billet #${idx + 1}`;
                                  const drink = p.selected_drink || p.drink_name || p.drink_menus?.name || 'Standard';
                                  const aroma = p.selected_aroma ? ` (${p.selected_aroma})` : '';
                                  return (
                                    <div key={p.id} className="flex items-center justify-between text-xs bg-white dark:bg-neutral-900/90 px-2.5 py-1.5 rounded-lg border border-gray-200/60 dark:border-neutral-800/60">
                                      <span className="font-semibold text-neutral-800 dark:text-neutral-200 truncate max-w-[130px]">
                                        #{idx + 1} {guestName}
                                      </span>
                                      <span className="text-neutral-500 dark:text-neutral-400 text-[11px] truncate max-w-[130px]">
                                        🍹 {drink}{aroma}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>

                            <div className="pt-2 border-t border-gray-200 dark:border-neutral-800/80 flex items-center justify-between">
                              <span className="text-xs font-bold text-neutral-700 dark:text-neutral-300">Total Commande ({order.passes.length} passes) :</span>
                              <span className="text-xl font-black text-emerald-600 dark:text-emerald-400 tracking-tight">
                                {order.totalPrice} DT
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Primary Action Button: Approve All Passes in Order */}
                        <div>
                          <button
                            onClick={() => handleApprovePayment(firstPass, order.passes)}
                            disabled={isApproving}
                            className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-black text-sm bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-400 hover:to-teal-400 text-white shadow-lg shadow-emerald-500/25 transition-all active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
                          >
                            {isApproving ? (
                              <>
                                <RefreshCw className="w-4 h-4 animate-spin" />
                                <span>Validation des {order.passes.length} passes...</span>
                              </>
                            ) : (
                              <>
                                <CheckCheck className="w-4 h-4" />
                                <span>Encaisser la commande ({order.passes.length} passes · {order.totalPrice} DT)</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  }

                  // SINGLE PASS CARD
                  const pass = order.primaryPass;
                  const finalPrice = order.totalPrice;
                  const isApproving = approvingPassId === pass.id;
                  const hasPromo = Boolean(pass.promo_used);
                  const isQuick = pass.source === 'QUICK_RESERVATION' || Boolean(pass.reservation_code);

                  return (
                    <div
                      key={pass.id}
                      className="relative rounded-2xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/60 p-5 flex flex-col justify-between hover:border-amber-500/40 dark:hover:border-neutral-700/80 transition-all hover:shadow-md dark:hover:shadow-lg group shadow-xs"
                    >
                      <div>
                        {/* Header Card */}
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400 font-bold text-sm">
                              <UserIcon className="w-4 h-4" />
                            </div>
                            <div>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <h4 className="text-sm font-bold text-neutral-900 dark:text-white truncate max-w-[150px]">
                                  {order.buyerName}
                                </h4>
                                {isQuick && (
                                  <span className="px-1.5 py-0.5 rounded-md text-[10px] font-black bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                                    ⚡ Express
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate max-w-[180px]">
                                {pass.reservation_code ? (
                                  <span className="font-bold text-amber-600 dark:text-amber-400 font-mono">{pass.reservation_code}</span>
                                ) : (
                                  `#${pass.id.slice(0, 8)}`
                                )}
                                {pass.phone ? ` • 📞 ${pass.phone}` : pass.instagram_handle ? ` • ${pass.instagram_handle}` : ''}
                              </p>
                            </div>
                          </div>

                          {/* Status Badge */}
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/25 shrink-0">
                            <Clock className="w-3 h-3" />
                            À encaisser
                          </span>
                        </div>

                        {/* Details Box */}
                        <div className="bg-gray-50 dark:bg-neutral-950/70 rounded-xl p-3 border border-gray-200/80 dark:border-neutral-800/80 space-y-2 mb-4">
                          {pass.reservation_code && (
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-neutral-500 dark:text-neutral-400">Code Réservation</span>
                              <span className="font-mono text-purple-600 dark:text-purple-400 font-bold bg-purple-500/10 px-1.5 py-0.5 rounded border border-purple-500/20">
                                {pass.reservation_code}
                              </span>
                            </div>
                          )}

                          <div className="flex items-center justify-between text-xs">
                            <span className="text-neutral-500 dark:text-neutral-400">Pass ID</span>
                            <span className="font-mono text-neutral-700 dark:text-neutral-300 font-medium">#{pass.id.slice(0, 8)}</span>
                          </div>

                          {pass.email && (
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-neutral-500 dark:text-neutral-400">E-mail</span>
                              <span className="text-neutral-800 dark:text-neutral-200 font-medium truncate max-w-[150px]" title={pass.email}>
                                {pass.email}
                              </span>
                            </div>
                          )}

                          {pass.phone && (
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-neutral-500 dark:text-neutral-400">Téléphone</span>
                              <span className="text-neutral-800 dark:text-neutral-200 font-medium">
                                {pass.phone}
                              </span>
                            </div>
                          )}

                          {hasPromo && (
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-neutral-500 dark:text-neutral-400 flex items-center gap-1">
                                <Sparkles className="w-3 h-3 text-amber-500 dark:text-amber-400" />
                                Code Promo
                              </span>
                              <span className="font-mono text-amber-600 dark:text-amber-400 font-semibold bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                                {pass.promo_used}
                              </span>
                            </div>
                          )}

                          {(pass.selected_drink || pass.drink_name || pass.drink_menus) && (
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-neutral-500 dark:text-neutral-400">Consommation</span>
                              <span className="text-neutral-800 dark:text-neutral-200 font-medium truncate max-w-[140px]">
                                {pass.selected_drink || pass.drink_name || pass.drink_menus?.name}
                                {pass.selected_aroma ? ` (${pass.selected_aroma})` : ''}
                              </span>
                            </div>
                          )}

                          <div className="pt-2 border-t border-gray-200 dark:border-neutral-800/80 flex items-center justify-between">
                            <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">Montant à encaisser :</span>
                            <span className="text-lg font-black text-amber-600 dark:text-amber-400 tracking-tight">
                              {finalPrice} DT
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Primary Action Button: Approve Payment */}
                      <div>
                        <button
                          onClick={() => handleApprovePayment(pass, order.passes)}
                          disabled={isApproving}
                          className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-bold text-sm bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white shadow-md shadow-emerald-500/20 transition-all active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
                        >
                          {isApproving ? (
                            <>
                              <RefreshCw className="w-4 h-4 animate-spin" />
                              <span>Validation en cours...</span>
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="w-4 h-4" />
                              <span>Encaisser & Valider ({finalPrice} DT)</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* ─── ONGLET 2: ÉMISSION DIRECTE DE PASS (VENTE GUICHET / POS) ─── */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        {activeTab === 'creation' && (
          <POSPassCreationTab
            eventId={selectedEventId}
            posName={currentUser?.full_name || currentUser?.email?.split('@')[0] || 'Guichet Point de Vente'}
            events={events}
            onPassCreated={async (passRes) => {
              setSuccessToast(passRes.message || 'Pass émis, payé et activé avec succès !');
              await loadCashierPosData();
              if (selectedEventId) {
                try {
                  const res = await api.getPaymentPointPasses(selectedEventId);
                  setPasses(res || []);
                } catch (e) {}
              }
              setTimeout(() => setSuccessToast(null), 5000);
            }}
          />
        )}

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* ─── ONGLET 2: STATISTIQUES & GRAPHIQUES (VISUAL ANALYTICS) ─── */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        {activeTab === 'analytics' && (
          <div className="space-y-6 animate-in fade-in duration-150">
            
            {/* Header of Analytics Tab with Export Button */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 shadow-xs">
              <div>
                <h3 className="text-lg font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-blue-500" />
                  Statistiques & Performances de Caisse
                </h3>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                  Visualisation graphique de vos encaissements et suivi des pics d'affluence
                </p>
              </div>

              {/* Prominent Export Button */}
              <button
                onClick={handleExportCashierReportPDF}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs bg-gradient-to-r from-passi-corail to-amber-500 hover:opacity-90 text-white shadow-md shadow-passi-corail/25 transition-all active:scale-95 cursor-pointer whitespace-nowrap self-start sm:self-auto"
              >
                <FileText className="w-4 h-4" />
                <span>📄 Exporter Rapport de Caisse (PDF)</span>
              </button>
            </div>

            {/* 2-Chart Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* Chart 1: Évolution des Encaissements (7 derniers jours) */}
              <div className="p-5 rounded-2xl bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 shadow-xs flex flex-col justify-between">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h4 className="font-bold text-sm text-neutral-900 dark:text-white flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-emerald-500" />
                      Évolution des Encaissements (7 derniers jours)
                    </h4>
                    <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                      Recette quotidienne (TND) et volume de passes encaissés
                    </p>
                  </div>
                </div>

                <div className="w-full h-64 relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={last7DaysData}
                      margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient id="cashierRevenueGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10B981" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="#10B981" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(150, 150, 150, 0.15)" />
                      <XAxis dataKey="dayLabel" fontSize={11} stroke="#888888" tickLine={false} />
                      <YAxis fontSize={11} stroke="#888888" tickLine={false} allowDecimals={false} />
                      <RechartsTooltip
                        content={({ active, payload, label }) => {
                          if (active && payload && payload.length) {
                            return (
                              <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 p-3 rounded-xl shadow-xl text-xs space-y-1">
                                <p className="font-bold text-neutral-900 dark:text-white border-b border-gray-100 dark:border-neutral-800 pb-1">{label}</p>
                                <p className="text-emerald-500 font-semibold">
                                  Recette : <span className="font-mono font-bold">{payload[0]?.value} TND</span>
                                </p>
                                {payload[1] && (
                                  <p className="text-blue-500 font-semibold">
                                    Passes : <span className="font-mono font-bold">{payload[1]?.value}</span>
                                  </p>
                                )}
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
                      <Area
                        type="monotone"
                        dataKey="recette"
                        name="Recette (TND)"
                        stroke="#10B981"
                        strokeWidth={2.5}
                        fill="url(#cashierRevenueGrad)"
                      />
                      <Area
                        type="monotone"
                        dataKey="passes"
                        name="Nombre de Passes"
                        stroke="#3B82F6"
                        strokeWidth={2}
                        fill="transparent"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Chart 2: Répartition Horaire des Ventes (Peak Activity) */}
              <div className="p-5 rounded-2xl bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 shadow-xs flex flex-col justify-between">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h4 className="font-bold text-sm text-neutral-900 dark:text-white flex items-center gap-2">
                      <Clock className="w-4 h-4 text-amber-500" />
                      Répartition Horaire des Ventes (Aujourd'hui)
                    </h4>
                    <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                      Visualisation des créneaux d'affluence et heures de pointe
                    </p>
                  </div>
                  {peakHour && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                      Pic: {peakHour.hour} ({peakHour.passes} pass)
                    </span>
                  )}
                </div>

                <div className="w-full h-64 relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={hourlySalesData}
                      margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(150, 150, 150, 0.15)" />
                      <XAxis dataKey="hour" fontSize={11} stroke="#888888" tickLine={false} />
                      <YAxis fontSize={11} stroke="#888888" tickLine={false} allowDecimals={false} />
                      <RechartsTooltip
                        content={({ active, payload, label }) => {
                          if (active && payload && payload.length) {
                            return (
                              <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 p-3 rounded-xl shadow-xl text-xs space-y-1">
                                <p className="font-bold text-neutral-900 dark:text-white border-b border-gray-100 dark:border-neutral-800 pb-1">Créneau : {label}</p>
                                <p className="text-amber-500 font-semibold">
                                  Passes validés : <span className="font-mono font-bold">{payload[0]?.value}</span>
                                </p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Bar
                        dataKey="passes"
                        name="Passes Validés"
                        radius={[6, 6, 0, 0]}
                      >
                        {hourlySalesData.map((entry, index) => (
                          <Cell 
                            key={`cell-${index}`} 
                            fill={entry.passes > 0 && entry.passes === peakHour?.passes ? '#F59E0B' : '#6366F1'} 
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

            </div>

            {/* Quick Metrics Bar Underneath Charts */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800">
                <span className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400">Panier Moyen Aujourd'hui</span>
                <p className="text-xl font-black text-neutral-900 dark:text-white mt-1 font-mono">
                  {cashierData.todayPassesCount > 0 
                    ? (cashierData.todayRevenue / cashierData.todayPassesCount).toFixed(2) + ' TND' 
                    : '0.00 TND'}
                </p>
                <p className="text-[10px] text-neutral-400 mt-0.5">Par pass validé au guichet</p>
              </div>

              <div className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800">
                <span className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400">Heure de Pointe</span>
                <p className="text-xl font-black text-amber-500 mt-1 font-mono">
                  {peakHour ? `${peakHour.hour} (${peakHour.passes} pass)` : 'Pas encore de pic'}
                </p>
                <p className="text-[10px] text-neutral-400 mt-0.5">Créneau avec le plus fort trafic</p>
              </div>

              <div className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800">
                <span className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400">Clôtures Conformes</span>
                <p className="text-xl font-black text-emerald-500 mt-1 font-mono">
                  {cashierData.closuresHistory.length > 0 
                    ? Math.round((cashierData.closuresHistory.filter((c: any) => c.status === 'MATCHED').length / cashierData.closuresHistory.length) * 100) + '%'
                    : '100%'}
                </p>
                <p className="text-[10px] text-neutral-400 mt-0.5">Taux d'exactitude comptable</p>
              </div>
            </div>

          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* ─── ONGLET 3: OPÉRATIONS DE CAISSE (CLÔTURE & REMISE) ──────── */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        {activeTab === 'operations' && (
          <div className="space-y-6 animate-in fade-in duration-150">
            
            {/* Split 2-Column Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

              {/* ───────────────────────────────────────────────────────── */}
              {/* LEFT CARD: CLÔTURE JOURNALIÈRE À L'AVEUGLE */}
              {/* ───────────────────────────────────────────────────────── */}
              <div className="p-6 rounded-3xl bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 shadow-sm flex flex-col justify-between space-y-6">
                <div>
                  {/* Top Status & Title */}
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center font-bold border border-amber-500/20">
                        <Lock className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-neutral-900 dark:text-white">
                          Clôture Journalière à l'Aveugle
                        </h3>
                        <p className="text-xs text-neutral-500 dark:text-neutral-400">
                          Comptage physique & audit de conformité journalier
                        </p>
                      </div>
                    </div>

                    {/* Status indicator */}
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold shrink-0 ${
                      isTodayRegisterClosed
                        ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                        : 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                    }`}>
                      {isTodayRegisterClosed ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Caisse Clôturée</span>
                        </>
                      ) : (
                        <>
                          <Clock className="w-3.5 h-3.5" />
                          <span>En Attente de Clôture</span>
                        </>
                      )}
                    </span>
                  </div>

                  {/* Step-by-Step Instructions */}
                  <div className="p-3.5 rounded-2xl bg-amber-500/5 border border-amber-500/15 text-xs text-neutral-700 dark:text-neutral-300 space-y-2 mb-5">
                    <p className="font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                      <EyeOff className="w-4 h-4" />
                      Procédure de Sécurité à l'Aveugle :
                    </p>
                    <ol className="list-decimal list-inside space-y-1 text-[11px] text-neutral-600 dark:text-neutral-400 pl-1">
                      <li>Comptez vos espèces physiques en tiroir sans consulter le solde théorique.</li>
                      <li>Saisissez le montant exact compté ci-dessous.</li>
                      <li>Le système confrontera votre saisie et exigera une justification en cas d'écart.</li>
                    </ol>
                  </div>

                  {/* Discrepancy Warning if triggered */}
                  {closureDiscrepancyWarning && (
                    <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-500/15 border border-rose-200 dark:border-rose-500/30 text-rose-800 dark:text-rose-300 text-xs mb-5 space-y-2 animate-in fade-in">
                      <div className="flex items-center gap-2 font-bold text-rose-600 dark:text-rose-400">
                        <AlertTriangle className="w-4 h-4 shrink-0" />
                        <span>Alerte Écart de Caisse</span>
                      </div>
                      <p className="leading-relaxed">{closureDiscrepancyWarning}</p>
                    </div>
                  )}

                  {/* Form */}
                  <form onSubmit={handleSubmitBlindClosure} className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1.5">
                        Montant physique compté en TND *
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          required
                          placeholder="Ex: 240.00"
                          value={declaredAmountInput}
                          onChange={(e) => setDeclaredAmountInput(e.target.value)}
                          className="w-full bg-gray-50 dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-lg font-bold text-neutral-900 dark:text-white placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                        />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-neutral-400">
                          TND
                        </span>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1.5">
                        Note / Justification {closureDiscrepancyWarning ? <span className="text-rose-500">* (Obligatoire)</span> : "(Optionnel)"}
                      </label>
                      <textarea
                        rows={2}
                        required={Boolean(closureDiscrepancyWarning)}
                        placeholder={
                          closureDiscrepancyWarning
                            ? "Expliquez la cause de cet écart (ex: erreur de rendu monnaie)..."
                            : "Observations éventuelles..."
                        }
                        value={closureNotesInput}
                        onChange={(e) => setClosureNotesInput(e.target.value)}
                        className={`w-full bg-gray-50 dark:bg-neutral-950 border rounded-xl p-3 text-xs text-neutral-900 dark:text-white placeholder-neutral-400 focus:outline-none focus:ring-2 transition-colors ${
                          closureDiscrepancyWarning
                            ? 'border-rose-400 focus:ring-rose-500/40'
                            : 'border-gray-200 dark:border-neutral-800 focus:ring-amber-500/40'
                        }`}
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={isSubmittingClosure}
                      className="w-full py-3 px-4 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-amber-500/20 transition-all disabled:opacity-50 cursor-pointer"
                    >
                      {isSubmittingClosure ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Vérification & Clôture...</span>
                        </>
                      ) : (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>Valider la Clôture de Caisse</span>
                        </>
                      )}
                    </button>
                  </form>
                </div>

                {/* Mini-table of last closures */}
                <div className="pt-4 border-t border-gray-100 dark:border-neutral-800 space-y-2">
                  <h4 className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider flex items-center gap-1.5">
                    <History className="w-3.5 h-3.5" />
                    Dernières Clôtures Enregistrées
                  </h4>
                  {cashierData.closuresHistory.length === 0 ? (
                    <p className="text-xs text-neutral-400 italic">Aucune clôture enregistrée.</p>
                  ) : (
                    <div className="space-y-1.5 max-h-40 overflow-y-auto">
                      {cashierData.closuresHistory.slice(0, 3).map((cl: any) => (
                        <div key={cl.id} className="p-2.5 rounded-xl bg-gray-50 dark:bg-neutral-950 border border-gray-100 dark:border-neutral-800 text-xs flex items-center justify-between">
                          <div>
                            <span className="font-semibold text-neutral-900 dark:text-white">{cl.closure_date}</span>
                            <span className="text-neutral-400 ml-2">Déclaré: {cl.declared_amount} DT / Attendu: {cl.expected_amount} DT</span>
                          </div>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            cl.status === 'MATCHED'
                              ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                              : 'bg-rose-500/10 text-rose-600 border border-rose-500/20'
                          }`}>
                            {cl.status === 'MATCHED' ? 'Conforme' : `Écart (${cl.discrepancy} DT)`}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* ───────────────────────────────────────────────────────── */}
              {/* RIGHT CARD: REMISE AU SUPERVISEUR (RAMASSAGE) */}
              {/* ───────────────────────────────────────────────────────── */}
              <div className="p-6 rounded-3xl bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 shadow-sm flex flex-col justify-between space-y-6">
                <div>
                  {/* Top Title & Info */}
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center font-bold border border-emerald-500/20">
                        <ArrowUpRight className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-neutral-900 dark:text-white">
                          Remise de Caisse au Superviseur
                        </h3>
                        <p className="text-xs text-neutral-500 dark:text-neutral-400">
                          Passation des espèces physiques & remise à zéro du tiroir
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Drawer Notice Banner */}
                  <div className="p-3.5 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 flex items-center justify-between mb-5">
                    <div>
                      <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider block">
                        Solde Disponible en Tiroir
                      </span>
                      <span className="text-xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
                        {cashierData.liveDrawerBalance.toFixed(2)} TND
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setCollectedAmountInput(String(cashierData.liveDrawerBalance || 0))}
                      className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] transition-all cursor-pointer shadow-xs"
                    >
                      Remettre la totalité
                    </button>
                  </div>

                  {/* Handover Form */}
                  <form onSubmit={handleSubmitSupervisorCollection} className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1.5">
                        Nom et Prénom du Superviseur *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Ex: Mohamed Ben Salah"
                        value={supervisorNameInput}
                        onChange={(e) => setSupervisorNameInput(e.target.value)}
                        className="w-full bg-gray-50 dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 rounded-xl px-4 py-2.5 text-sm font-semibold text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1.5">
                        Montant remis en espèces (TND) *
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          required
                          placeholder="0.00"
                          value={collectedAmountInput}
                          onChange={(e) => setCollectedAmountInput(e.target.value)}
                          className="w-full bg-gray-50 dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-lg font-bold text-emerald-600 dark:text-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                        />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-neutral-400">
                          TND
                        </span>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1.5">
                        Observations / Notes (Optionnel)
                      </label>
                      <input
                        type="text"
                        placeholder="Ex: Sac scellé N° 402, vérification conjointe OK"
                        value={collectionNotesInput}
                        onChange={(e) => setCollectionNotesInput(e.target.value)}
                        className="w-full bg-gray-50 dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 rounded-xl px-3.5 py-2.5 text-xs text-neutral-900 dark:text-white placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                      />
                    </div>

                    <label className="flex items-start gap-2.5 p-3 rounded-xl bg-gray-50 dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        required
                        checked={collectionConfirmed}
                        onChange={(e) => setCollectionConfirmed(e.target.checked)}
                        className="mt-0.5 w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                      />
                      <span className="text-xs font-medium text-neutral-800 dark:text-neutral-200 leading-snug">
                        Je confirme avoir remis ce montant exact en espèces en main propre au superviseur désigné.
                      </span>
                    </label>

                    <button
                      type="submit"
                      disabled={isSubmittingCollection || !collectionConfirmed}
                      className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-emerald-500/20 transition-all disabled:opacity-50 cursor-pointer"
                    >
                      {isSubmittingCollection ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Enregistrement...</span>
                        </>
                      ) : (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>Confirmer la Remise & Réinitialiser</span>
                        </>
                      )}
                    </button>
                  </form>
                </div>

                {/* Mini-table of last 3 supervisor collections with PDF button */}
                <div className="pt-4 border-t border-gray-100 dark:border-neutral-800 space-y-2">
                  <h4 className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider flex items-center gap-1.5">
                    <FileCheck2 className="w-3.5 h-3.5 text-emerald-500" />
                    Dernières Remises Superviseur (Bons PDF)
                  </h4>
                  {cashierData.collectionsHistory.length === 0 ? (
                    <p className="text-xs text-neutral-400 italic">Aucune remise effectuée.</p>
                  ) : (
                    <div className="space-y-1.5 max-h-40 overflow-y-auto">
                      {cashierData.collectionsHistory.slice(0, 3).map((col: any) => (
                        <div key={col.id} className="p-2.5 rounded-xl bg-gray-50 dark:bg-neutral-950 border border-gray-100 dark:border-neutral-800 text-xs flex items-center justify-between">
                          <div>
                            <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono">{col.collected_amount} TND</span>
                            <span className="text-neutral-600 dark:text-neutral-300 ml-2 font-medium">à {col.supervisor_name}</span>
                            <p className="text-[10px] text-neutral-400">{new Date(col.collection_time).toLocaleString('fr-FR')}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleDownloadBonDeRemise(col)}
                            className="px-2.5 py-1.5 rounded-lg bg-gray-200 dark:bg-neutral-800 hover:bg-gray-300 dark:hover:bg-neutral-700 text-[10px] font-bold text-neutral-800 dark:text-neutral-200 flex items-center gap-1.5 transition-all cursor-pointer"
                          >
                            <Download className="w-3 h-3 text-passi-corail" />
                            <span>Télécharger Bon (PDF)</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>

            </div>

          </div>
        )}

      </main>

      {/* ─── MODAL 1: BLIND CLOSURE (BACKUP / SHORTCUT) ─── */}
      {isClosureModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-3xl p-6 sm:p-7 max-w-lg w-full shadow-2xl relative">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold">
                  <Lock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-neutral-900 dark:text-white">
                    Clôture de Caisse Journalière
                  </h3>
                  <p className="text-xs text-neutral-500">
                    Audit de conformité & Comptage physique à l'aveugle
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsClosureModalOpen(false)}
                className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-600 dark:hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitBlindClosure} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1.5">
                  Montant physique compté en TND *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  placeholder="Ex: 240.00"
                  value={declaredAmountInput}
                  onChange={(e) => setDeclaredAmountInput(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-lg font-bold text-neutral-900 dark:text-white placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1.5">
                  Note / Justification
                </label>
                <textarea
                  rows={3}
                  placeholder="Observations éventuelles..."
                  value={closureNotesInput}
                  onChange={(e) => setClosureNotesInput(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 rounded-xl p-3 text-xs text-neutral-900 dark:text-white placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                />
              </div>

              <div className="flex items-center gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsClosureModalOpen(false)}
                  className="flex-1 py-3 px-4 rounded-xl border border-gray-200 dark:border-neutral-800 text-xs font-bold text-neutral-600 dark:text-neutral-400 hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingClosure}
                  className="flex-1 py-3 px-4 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md transition-all disabled:opacity-50"
                >
                  {isSubmittingClosure ? "Vérification..." : "Valider la Clôture"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL 2: SUPERVISOR COLLECTION (BACKUP / SHORTCUT) ─── */}
      {isCollectionModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-3xl p-6 sm:p-7 max-w-lg w-full shadow-2xl relative">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold">
                  <Banknote className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-neutral-900 dark:text-white">
                    Remise de Caisse au Superviseur
                  </h3>
                  <p className="text-xs text-neutral-500">
                    Passation des espèces physiques & Réinitialisation du tiroir
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsCollectionModalOpen(false)}
                className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-600 dark:hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitSupervisorCollection} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1.5">
                  Nom et Prénom du Superviseur *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Mohamed Ben Salah"
                  value={supervisorNameInput}
                  onChange={(e) => setSupervisorNameInput(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 rounded-xl px-4 py-2.5 text-sm font-semibold text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                  autoFocus
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300">
                    Montant remis en espèces (TND) *
                  </label>
                  <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
                    Solde actuel : {cashierData.liveDrawerBalance.toFixed(2)} TND
                  </span>
                </div>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={collectedAmountInput}
                  onChange={(e) => setCollectedAmountInput(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-lg font-bold text-emerald-600 dark:text-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1.5">
                  Observations / Remarques (Optionnel)
                </label>
                <input
                  type="text"
                  placeholder="Ex: Sac scellé N° 402, vérification conjointe OK"
                  value={collectionNotesInput}
                  onChange={(e) => setCollectionNotesInput(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 rounded-xl px-3.5 py-2.5 text-xs text-neutral-900 dark:text-white placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                />
              </div>

              <label className="flex items-start gap-2.5 p-3 rounded-xl bg-gray-50 dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 cursor-pointer select-none">
                <input
                  type="checkbox"
                  required
                  checked={collectionConfirmed}
                  onChange={(e) => setCollectionConfirmed(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                />
                <span className="text-xs font-medium text-neutral-800 dark:text-neutral-200 leading-snug">
                  Je confirme avoir remis ce montant exact en espèces en main propre au superviseur désigné.
                </span>
              </label>

              <div className="flex items-center gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsCollectionModalOpen(false)}
                  className="flex-1 py-3 px-4 rounded-xl border border-gray-200 dark:border-neutral-800 text-xs font-bold text-neutral-600 dark:text-neutral-400 hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingCollection || !collectionConfirmed}
                  className="flex-1 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md transition-all disabled:opacity-50 cursor-pointer"
                >
                  {isSubmittingCollection ? "Enregistrement..." : "Confirmer la Remise"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
