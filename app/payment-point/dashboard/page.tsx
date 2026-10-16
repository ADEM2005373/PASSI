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
  DollarSign
} from "lucide-react";

export default function PaymentPointDashboard() {
  const router = useRouter();
  const { logout: contextLogout } = useAuth();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  
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

  // Modal 1: Blind Closure (Clôture à l'aveugle)
  const [isClosureModalOpen, setIsClosureModalOpen] = useState(false);
  const [declaredAmountInput, setDeclaredAmountInput] = useState<string>("");
  const [closureNotesInput, setClosureNotesInput] = useState<string>("");
  const [closureDiscrepancyWarning, setClosureDiscrepancyWarning] = useState<string | null>(null);
  const [isSubmittingClosure, setIsSubmittingClosure] = useState(false);

  // Modal 2: Supervisor Cash Collection (Remise de Fonds)
  const [isCollectionModalOpen, setIsCollectionModalOpen] = useState(false);
  const [supervisorNameInput, setSupervisorNameInput] = useState<string>("");
  const [collectedAmountInput, setCollectedAmountInput] = useState<string>("");
  const [collectionNotesInput, setCollectionNotesInput] = useState<string>("");
  const [collectionConfirmed, setCollectionConfirmed] = useState(false);
  const [isSubmittingCollection, setIsSubmittingCollection] = useState(false);
  const [lastCompletedCollection, setLastCompletedCollection] = useState<any>(null);

  // Tab for Drawer Details / History
  const [showHistorySection, setShowHistorySection] = useState(false);

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
      const user = await api.getCurrentUser();
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
        const s = p.entry_status || p.status;
        return s === 'awaiting_payment' || s === 'PENDING_PAYMENT';
      });
      setPasses(preApprovedOnly);
    } catch (err: any) {
      console.error("Error fetching passes:", err);
      setErrorToast("Erreur lors de la récupération des passes en attente");
    } finally {
      setLoadingPasses(false);
    }
  };

  const handleApprovePayment = async (pass: Pass) => {
    if (approvingPassId) return;
    setApprovingPassId(pass.id);
    setErrorToast(null);
    setSuccessToast(null);

    try {
      await api.approvePaymentPointPass(pass.id);
      setSuccessToast(`Paiement de ${pass.final_price ?? 0} DT validé pour le pass #${pass.id.slice(0, 8)} !`);
      
      // Remove approved pass from the pending list
      setPasses(prev => prev.filter(p => p.id !== pass.id));

      // Instantly refresh POS drawer balance and stats
      loadCashierPosData();

      setTimeout(() => {
        setSuccessToast(null);
      }, 4000);
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

  // Search filter
  const filteredPasses = useMemo(() => {
    if (!searchQuery.trim()) return passes;
    const searchTerm = searchQuery.toLowerCase().trim();
    return passes.filter((pass) => {
      const passId = pass.id.toLowerCase();
      const guestFullName = `${pass.guest_first_name || ''} ${pass.guest_last_name || ''}`.trim().toLowerCase();
      const userProfileName = ((pass as any).user?.full_name || (pass as any).user_name || `${(pass as any).user?.first_name || ''} ${(pass as any).user?.last_name || ''}`).trim().toLowerCase();
      const fullName = `${guestFullName} ${userProfileName}`.trim().toLowerCase();
      
      return fullName.includes(searchTerm) || passId.includes(searchTerm);
    });
  }, [passes, searchQuery]);

  const selectedEvent = useMemo(() => {
    return events.find(e => e.id === selectedEventId);
  }, [events, selectedEventId]);

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 flex flex-col selection:bg-amber-500/30 selection:text-amber-800 dark:selection:text-amber-200 transition-colors duration-200 font-sans">
      {/* Top Header */}
      <header className="sticky top-0 z-40 border-b border-gray-200 dark:border-neutral-800/80 bg-white/85 dark:bg-neutral-950/85 backdrop-blur-md px-4 sm:px-6 py-3.5 transition-colors">
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
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Déconnexion</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex flex-col gap-6">

        {/* ─── CASH DRAWER & FINANCIAL OVERVIEW METRICS (FEATURE A) ─── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          
          {/* Card 1: Solde en Caisse Actuel (Live Physical Drawer Balance) */}
          <div className="relative overflow-hidden rounded-2xl border border-emerald-500/30 dark:border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 via-white dark:via-neutral-900 to-white dark:to-neutral-900 p-5 shadow-sm transition-all flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Solde En Caisse Actuel
                </span>
                <span className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <Banknote className="w-4 h-4" />
                </span>
              </div>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-3xl sm:text-4xl font-black text-emerald-600 dark:text-emerald-400 tracking-tight">
                  {cashierData.liveDrawerBalance.toFixed(2)}
                </span>
                <span className="text-base font-bold text-emerald-700 dark:text-emerald-300">TND</span>
              </div>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-2 leading-snug">
                Espèces physiques encaissées depuis la dernière remise superviseur.
              </p>
            </div>

            {/* Quick Action: Remise de Fonds */}
            <div className="mt-4 pt-3 border-t border-emerald-500/15 flex items-center justify-between gap-2">
              <button
                onClick={handleOpenCollectionModal}
                className="w-full py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all active:scale-95 cursor-pointer"
              >
                <ArrowUpRight className="w-3.5 h-3.5" />
                <span>Remise de Caisse au Superviseur</span>
              </button>
            </div>
          </div>

          {/* Card 2: Recette du Jour (Today's Revenue & Passes Count) */}
          <div className="rounded-2xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/70 p-5 shadow-sm transition-all flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                  Recette du Jour
                </span>
                <span className="p-1.5 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                  <DollarSign className="w-4 h-4" />
                </span>
              </div>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-3xl sm:text-4xl font-black text-neutral-900 dark:text-white tracking-tight">
                  {cashierData.todayRevenue.toFixed(2)}
                </span>
                <span className="text-base font-bold text-amber-600 dark:text-amber-400">TND</span>
              </div>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-2">
                {cashierData.todayPassesCount} pass validé(s) aujourd'hui par votre compte.
              </p>
            </div>

            {/* Action: Clôturer la Caisse */}
            <div className="mt-4 pt-3 border-t border-gray-100 dark:border-neutral-800 flex items-center justify-between gap-2">
              <button
                onClick={handleOpenClosureModal}
                className="w-full py-2 px-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all active:scale-95 cursor-pointer"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Clôturer la Caisse du Jour</span>
              </button>
            </div>
          </div>

          {/* Card 3: Rapports & Dernière Remise */}
          <div className="rounded-2xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/70 p-5 shadow-sm transition-all flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                  Dernier Ramassage
                </span>
                <span className="p-1.5 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
                  <FileCheck2 className="w-4 h-4" />
                </span>
              </div>

              {cashierData.lastCollection ? (
                <div>
                  <div className="text-lg font-bold text-neutral-900 dark:text-white">
                    {cashierData.lastCollection.collected_amount} TND
                  </div>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5 truncate">
                    Remis à : <strong className="text-neutral-800 dark:text-neutral-200">{cashierData.lastCollection.supervisor_name}</strong>
                  </p>
                  <p className="text-[10px] text-neutral-400 dark:text-neutral-500 mt-1">
                    {new Date(cashierData.lastCollection.collection_time).toLocaleString('fr-FR')}
                  </p>
                </div>
              ) : (
                <div>
                  <p className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">Aucune remise effectuée</p>
                  <p className="text-xs text-neutral-400 mt-1">Les espèces s'accumulent dans votre caisse.</p>
                </div>
              )}
            </div>

            {/* Actions: Exporter Rapport & Historique */}
            <div className="mt-4 pt-3 border-t border-gray-100 dark:border-neutral-800 flex items-center gap-2">
              <button
                onClick={handleExportCashierReportPDF}
                className="flex-1 py-2 px-3 rounded-xl bg-gray-100 dark:bg-neutral-800 hover:bg-gray-200 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-200 font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                title="Télécharger le rapport de caisse du jour en PDF"
              >
                <Download className="w-3.5 h-3.5 text-passi-corail" />
                <span>Rapport PDF</span>
              </button>
              
              <button
                onClick={() => setShowHistorySection(!showHistorySection)}
                className={`py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1 transition-all cursor-pointer ${
                  showHistorySection
                    ? 'bg-neutral-900 text-white dark:bg-white dark:text-black'
                    : 'bg-gray-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400'
                }`}
                title="Afficher l'historique des clôtures et remises"
              >
                <History className="w-3.5 h-3.5" />
                <span>{showHistorySection ? 'Masquer' : 'Historique'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Floating Toasts */}
        {successToast && (
          <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-sm animate-in fade-in slide-in-from-top-2 shadow-sm">
            <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <span className="font-medium">{successToast}</span>
            {lastCompletedCollection && (
              <button
                onClick={() => handleDownloadBonDeRemise(lastCompletedCollection)}
                className="ml-auto inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-all"
              >
                <Download className="w-3 h-3" />
                <span>Télécharger Bon de Remise</span>
              </button>
            )}
          </div>
        )}

        {errorToast && (
          <div className="flex items-center gap-3 p-4 rounded-xl bg-rose-50 dark:bg-rose-500/15 border border-rose-200 dark:border-rose-500/30 text-rose-800 dark:text-rose-300 text-sm animate-in fade-in slide-in-from-top-2 shadow-sm">
            <AlertCircle className="w-5 h-5 shrink-0 text-rose-600 dark:text-rose-400" />
            <span className="font-medium">{errorToast}</span>
          </div>
        )}

        {/* ─── OPTIONAL AUDIT LOGS FOR CASHIER (CLÔTURES & REMISES) ─── */}
        {showHistorySection && (
          <div className="p-5 rounded-2xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/60 shadow-sm space-y-4 animate-in fade-in">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-neutral-800 pb-3">
              <h3 className="font-bold text-sm text-neutral-900 dark:text-white flex items-center gap-2">
                <History className="w-4 h-4 text-amber-500" />
                Historique de votre caisse (Dernières clôtures et remises)
              </h3>
              <button 
                onClick={() => setShowHistorySection(false)}
                className="text-xs text-neutral-400 hover:text-neutral-700 dark:hover:text-white"
              >
                Fermer
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Clôtures */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Clôtures Journalières</h4>
                {cashierData.closuresHistory.length === 0 ? (
                  <p className="text-xs text-neutral-400 italic">Aucune clôture enregistrée.</p>
                ) : (
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {cashierData.closuresHistory.map((cl: any) => (
                      <div key={cl.id} className="p-2.5 rounded-xl bg-gray-50 dark:bg-neutral-950 border border-gray-100 dark:border-neutral-800 text-xs flex items-center justify-between">
                        <div>
                          <span className="font-semibold">{cl.closure_date}</span>
                          <span className="text-neutral-400 ml-2">Déclaré: {cl.declared_amount} DT / Attendu: {cl.expected_amount} DT</span>
                          {cl.notes && <p className="text-[10px] text-neutral-500 italic mt-0.5">Note: {cl.notes}</p>}
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

              {/* Remises */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Remises Superviseurs</h4>
                {cashierData.collectionsHistory.length === 0 ? (
                  <p className="text-xs text-neutral-400 italic">Aucune remise effectuée.</p>
                ) : (
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {cashierData.collectionsHistory.map((col: any) => (
                      <div key={col.id} className="p-2.5 rounded-xl bg-gray-50 dark:bg-neutral-950 border border-gray-100 dark:border-neutral-800 text-xs flex items-center justify-between">
                        <div>
                          <span className="font-bold text-emerald-600">{col.collected_amount} TND</span>
                          <span className="text-neutral-500 ml-2">à {col.supervisor_name}</span>
                          <p className="text-[10px] text-neutral-400">{new Date(col.collection_time).toLocaleString('fr-FR')}</p>
                        </div>
                        <button
                          onClick={() => handleDownloadBonDeRemise(col)}
                          className="px-2 py-1 rounded bg-gray-200 dark:bg-neutral-800 hover:bg-gray-300 text-[10px] font-bold flex items-center gap-1"
                        >
                          <Download className="w-3 h-3" />
                          <span>Bon PDF</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ─── CONTROLS: EVENT SELECTOR & SEARCH BAR ─── */}
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
              Recherche par nom ou ID pass
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-neutral-400 dark:text-neutral-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Rechercher par nom d'invité ou ID pass..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-neutral-900 dark:text-white placeholder-neutral-400 dark:placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500/40 transition-colors shadow-xs"
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

        {/* ─── PASSES AWAITING CASH PAYMENT ─── */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400 font-medium px-1">
            <span>
              Passes en attente d'encaissement: <strong className="text-neutral-900 dark:text-white">{filteredPasses.length}</strong>
              {searchQuery && ` (sur ${passes.length} au total)`}
            </span>
            {selectedEvent && (
              <span>Prix de base de l'événement: <strong className="text-amber-600 dark:text-amber-400">{selectedEvent.base_price ?? 0} DT</strong></span>
            )}
          </div>

          {loadingPasses ? (
            <div className="flex flex-col items-center justify-center py-20 rounded-2xl border border-gray-200 dark:border-neutral-800/80 bg-white/60 dark:bg-neutral-900/30">
              <RefreshCw className="w-8 h-8 text-amber-500 dark:text-amber-400 animate-spin mb-3" />
              <p className="text-sm text-neutral-600 dark:text-neutral-400 font-medium">Chargement des passes en attente...</p>
            </div>
          ) : filteredPasses.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 rounded-2xl border border-gray-200 dark:border-neutral-800/80 bg-white dark:bg-neutral-900/20 text-center px-4 shadow-xs">
              <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-neutral-900 flex items-center justify-center text-neutral-400 dark:text-neutral-500 mb-3 border border-gray-200 dark:border-neutral-800">
                <Ticket className="w-6 h-6" />
              </div>
              <h3 className="text-base font-semibold text-neutral-900 dark:text-white">Aucun pass en attente d'encaissement</h3>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 max-w-sm">
                {searchQuery
                  ? "Aucun pass ne correspond à votre recherche. Essayez un autre mot-clé."
                  : "Tous les pass pour cet événement ont été réglés ou aucune demande n'est en attente."}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredPasses.map((pass) => {
                const finalPrice = pass.final_price ?? selectedEvent?.base_price ?? 0;
                const isApproving = approvingPassId === pass.id;
                const hasPromo = Boolean(pass.promo_used);

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
                            <h4 className="text-sm font-bold text-neutral-900 dark:text-white truncate max-w-[170px]">
                              {[pass.guest_first_name, pass.guest_last_name].filter(Boolean).join(' ') || (pass as any).user?.full_name || (pass as any).user_name || pass.instagram_handle || 'Client Inconnu'}
                            </h4>
                            <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate max-w-[170px]">
                              {pass.instagram_handle ? `${pass.instagram_handle} • ` : ''}ID: #{pass.id.slice(0, 8)}
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
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-neutral-500 dark:text-neutral-400">Pass ID</span>
                          <span className="font-mono text-neutral-700 dark:text-neutral-300 font-medium">#{pass.id.slice(0, 8)}</span>
                        </div>

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

                        {pass.drink_menus && (
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-neutral-500 dark:text-neutral-400">Consommation</span>
                            <span className="text-neutral-800 dark:text-neutral-200 font-medium truncate max-w-[140px]">
                              {pass.drink_menus.name}
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
                        onClick={() => handleApprovePayment(pass)}
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
      </main>

      {/* ─── MODAL 1: BLIND CLOSURE ("CLÔTURE À L'AVEUGLE") ─── */}
      {isClosureModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-3xl p-6 sm:p-7 max-w-lg w-full shadow-2xl relative">
            
            {/* Header */}
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
                className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-600 dark:hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Blind Count Notice */}
            <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 mb-5 flex items-start gap-3">
              <EyeOff className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="text-xs text-amber-900 dark:text-amber-300 leading-relaxed">
                <strong>Sécurité de Clôture à l'Aveugle :</strong> Le montant attendu par le système est masqué. Comptez vos billets physiques en caisse et indiquez le total exact.
              </div>
            </div>

            {/* Discrepancy Alert If Triggered */}
            {closureDiscrepancyWarning && (
              <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-500/15 border border-rose-200 dark:border-rose-500/30 text-rose-800 dark:text-rose-300 text-xs mb-5 space-y-2 animate-in fade-in">
                <div className="flex items-center gap-2 font-bold text-rose-600 dark:text-rose-400">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>Alerte Écart de Caisse</span>
                </div>
                <p className="leading-relaxed">{closureDiscrepancyWarning}</p>
              </div>
            )}

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
                    autoFocus
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-neutral-400">
                    TND
                  </span>
                </div>
              </div>

              {/* Justification note (required if discrepancy detected) */}
              <div>
                <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1.5">
                  Note / Justification {closureDiscrepancyWarning ? <span className="text-rose-500">* (Obligatoire)</span> : "(Optionnel)"}
                </label>
                <textarea
                  rows={3}
                  required={Boolean(closureDiscrepancyWarning)}
                  placeholder={
                    closureDiscrepancyWarning
                      ? "Expliquez la cause de cet écart (ex: erreur de rendu monnaie, billet endommagé, etc.)..."
                      : "Observations éventuelles sur le service..."
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
                  {isSubmittingClosure ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Vérification...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Valider la Clôture</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL 2: SUPERVISOR CASH COLLECTION ("REMISE DE FONDS") ─── */}
      {isCollectionModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-3xl p-6 sm:p-7 max-w-lg w-full shadow-2xl relative">
            
            {/* Header */}
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
                className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-600 dark:hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitSupervisorCollection} className="space-y-4">
              {/* Supervisor Name */}
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

              {/* Amount Handed Over */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300">
                    Montant remis en espèces (TND) *
                  </label>
                  <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
                    Solde actuel : {cashierData.liveDrawerBalance.toFixed(2)} TND
                  </span>
                </div>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={collectedAmountInput}
                    onChange={(e) => setCollectedAmountInput(e.target.value)}
                    className="w-full bg-gray-50 dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-lg font-bold text-emerald-600 dark:text-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-neutral-400">
                    TND
                  </span>
                </div>
                <p className="text-[11px] text-neutral-400 mt-1">
                  Ce montant sera déduit de votre solde en caisse actif pour le remettre à 0.00 TND.
                </p>
              </div>

              {/* Date & Time (Display only) */}
              <div>
                <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1.5">
                  Date et Heure du ramassage
                </label>
                <input
                  type="text"
                  disabled
                  value={new Date().toLocaleString('fr-FR')}
                  className="w-full bg-gray-100 dark:bg-neutral-800/60 border border-gray-200 dark:border-neutral-800 rounded-xl px-3.5 py-2 text-xs font-mono text-neutral-600 dark:text-neutral-400 cursor-not-allowed"
                />
              </div>

              {/* Notes */}
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

              {/* Confirmation Checkbox */}
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
                  {isSubmittingCollection ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Enregistrement...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Confirmer la Remise</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
