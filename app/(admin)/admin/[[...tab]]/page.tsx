"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { api, Pass, User, Event } from "@/lib/services/api";
import { useAuth } from "@/lib/context/auth-context";
import { useSimulation } from "@/lib/context/simulation-context";
import { Logo } from "@/components/Logo";
import { Sun, Moon, LogOut, LayoutDashboard, CalendarDays, Users, CheckSquare, Plus, Trash2, Pencil, X, ExternalLink, Check, DollarSign, Download, User as UserIcon, Banknote, ShieldAlert, ShieldCheck, FileSpreadsheet, FileText, Tag, Ticket, Copy, Newspaper } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { PassCreationSection } from "@/components/admin/PassCreationSection";
import { NewsManagementSection } from "@/components/admin/NewsManagementSection";
import { FinancialAnalyticsSection } from "@/components/admin/FinancialAnalyticsSection";
import { formatImageUrl } from "@/lib/utils/url";

export default function AdminDashboard() {
  const router = useRouter();
  const { user, logout: contextLogout } = useAuth();
  const { startSimulation } = useSimulation();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const [passes, setPasses] = useState<Pass[]>([]);
  const [profiles, setProfiles] = useState<User[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [stats, setStats] = useState({ totalUsers: 0, totalEvents: 0, totalPasses: 0, revenue: 0, chartData: [0, 0, 0, 0, 0, 0, 0] });
  const [isLoading, setIsLoading] = useState(true);

  const [newTitle, setNewTitle] = useState("");
  const [newDate, setNewDate] = useState("");
  const [newLocation, setNewLocation] = useState("");
  const [newMax, setNewMax] = useState(1);
  const [newImageUrl, setNewImageUrl] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newDressCode, setNewDressCode] = useState("");
  const [newDrinks, setNewDrinks] = useState<{ id?: string; name: string; aromas: string }[]>([]);
  const [newBasePrice, setNewBasePrice] = useState<number>(0);
  const [newPromoCodes, setNewPromoCodes] = useState<{code: string; discount_amount: number}[]>([]);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);

  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserInsta, setNewUserInsta] = useState("");
  const [newUserRole, setNewUserRole] = useState("user");
  const [userMsg, setUserMsg] = useState("");

  // Payment Point state
  const [ppWorkerEmail, setPpWorkerEmail] = useState("");
  const [ppWorkerPassword, setPpWorkerPassword] = useState("");
  const [ppWorkerMsg, setPpWorkerMsg] = useState("");
  const [ppFilterEventId, setPpFilterEventId] = useState("");
  const [ppFilterDate, setPpFilterDate] = useState("");
  const [ppStats, setPpStats] = useState<any>({ workers: [], dailyBreakdown: [], overallTotalPasses: 0, overallTotalCollected: 0 });
  const [loadingPpStats, setLoadingPpStats] = useState(false);

  const [adminFullName, setAdminFullName] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [isSavingAdmin, setIsSavingAdmin] = useState(false);
  const [adminMsg, setAdminMsg] = useState("");

  const [rejectModalPass, setRejectModalPass] = useState<Pass | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [isRejecting, setIsRejecting] = useState(false);
  const [approbationMsg, setApprobationMsg] = useState("");

  // Delete pass confirmation state
  const [deleteModalPass, setDeleteModalPass] = useState<Pass | null>(null);
  const [deleteConfirmationInput, setDeleteConfirmationInput] = useState("");
  const [isDeletingPass, setIsDeletingPass] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    if (user?.full_name) setAdminFullName(user.full_name);
  }, [user]);

  const handleSaveAdminProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingAdmin(true);
    setAdminMsg("Enregistrement en cours...");
    try {
      const { createClient } = await import('@/lib/supabase/client');
      const supabase = createClient();
      
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ full_name: adminFullName })
        .eq('id', user?.id);
        
      if (profileError) throw profileError;
      
      if (adminPassword) {
        const { error: pwdError } = await supabase.auth.updateUser({ password: adminPassword });
        if (pwdError) throw pwdError;
      }
      
      setAdminMsg("✓ Profil mis à jour avec succès");
      setAdminPassword("");
      setTimeout(() => setAdminMsg(""), 3000);
    } catch (err: any) {
      setAdminMsg("Erreur: " + err.message);
    } finally {
      setIsSavingAdmin(false);
    }
  };

  const fetchData = async () => {
    const allPasses = await api.getAllPasses();
    setPasses(allPasses);
    const allProfs = await api.getProfiles();
    setProfiles(allProfs);
    const allEvts = await api.getEvents();
    setEvents(allEvts);
    const dbStats = await api.getStats();
    setStats(dbStats);
    await fetchPpStats(ppFilterEventId, ppFilterDate);
  };

  const fetchPpStats = async (eventId?: string, date?: string) => {
    setLoadingPpStats(true);
    try {
      const data = await api.getPaymentPointFinancialStats({
        eventId: eventId || undefined,
        date: date || undefined,
      });
      setPpStats(data);
    } catch (e) {
      console.error("Error fetching PP stats:", e);
    } finally {
      setLoadingPpStats(false);
    }
  };

  const handleToggleSuspend = async (userToToggle: User) => {
    try {
      const newStatus = !userToToggle.is_suspended;
      await api.toggleUserSuspension(userToToggle.id, newStatus);
      await fetchData();
    } catch (err: any) {
      alert("Erreur: " + err.message);
    }
  };

  const handleCreatePaymentPointWorker = async (e: React.FormEvent) => {
    e.preventDefault();
    setPpWorkerMsg("Création en cours...");
    try {
      await api.adminCreateUser(ppWorkerEmail, ppWorkerPassword, "", "payment_point");
      setPpWorkerMsg("✓ Compte Point de Paiement créé avec succès !");
      setPpWorkerEmail("");
      setPpWorkerPassword("");
      await fetchData();
      setTimeout(() => setPpWorkerMsg(""), 3500);
    } catch (err: any) {
      setPpWorkerMsg("Erreur: " + err.message);
    }
  };

  const handleExportCSV = () => {
    const headers = ["Date Approbation", "Point de Paiement", "Pass ID Approuve", "Evenement", "Montant Collecte (DT)"];
    const rows: string[][] = [];

    ppStats.workers.forEach((w: any) => {
      w.passes.forEach((p: any) => {
        rows.push([
          p.approvedAt ? p.approvedAt.split('T')[0] : 'N/A',
          `"${(w.email || '').replace(/"/g, '""')}"`,
          `"${p.id}"`,
          `"${(p.eventTitle || '').replace(/"/g, '""')}"`,
          String(p.finalPrice)
        ]);
      });
    });

    if (rows.length === 0) {
      alert("Aucune donnée financière à exporter.");
      return;
    }

    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `rapport_points_paiement_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportPDF = () => {
    if (!ppStats.workers || ppStats.workers.length === 0) {
      alert("Aucune donnée financière à exporter.");
      return;
    }

    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text("Rapport Financier - Points de Paiement Passi", 14, 20);
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Généré le: ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')}`, 14, 28);
    doc.text(`Total passes approuvés: ${ppStats.overallTotalPasses} | Total encaissé: ${ppStats.overallTotalCollected} DT`, 14, 34);

    const tableRows: any[] = [];
    ppStats.workers.forEach((w: any) => {
      w.passes.forEach((p: any) => {
        tableRows.push([
          p.approvedAt ? p.approvedAt.replace('T', ' ').slice(0, 16) : 'N/A',
          w.email,
          p.id.slice(0, 8) + '...',
          p.eventTitle,
          `${p.finalPrice} DT`
        ]);
      });
    });

    autoTable(doc, {
      startY: 40,
      head: [["Date", "Point de Paiement", "Pass ID", "Événement", "Montant"]],
      body: tableRows,
      foot: [["Total", "", `${ppStats.overallTotalPasses} pass`, "", `${ppStats.overallTotalCollected} DT`]],
      theme: 'striped',
      headStyles: { fillColor: [255, 107, 94] },
      footStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' },
    });

    doc.save(`rapport_points_paiement_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  useEffect(() => {
    setMounted(true);
    const init = async () => {
      const user = await api.getCurrentUser();
      const currentUserRole = (user?.role || '').toLowerCase();
      const originalUserRole = (user?.original_role || '').toLowerCase();
      const isUserAdmin = currentUserRole === 'admin' || originalUserRole === 'admin';
      if (!user || !isUserAdmin) { router.replace("/staff/login"); return; }
      
      const { createClient } = await import('@/lib/supabase/client');
      const supabase = createClient();
      const { data: { user: authUser } } = await supabase.auth.getUser();
      const isGoogleLinked = authUser?.identities?.some((id: any) => id.provider === 'google') ?? false;

      if (!isGoogleLinked) {
        router.replace("/staff/login");
        return;
      }

      setIsAdmin(true);
      await fetchData();
      setIsLoading(false);
    };
    init();
  }, [router]);

  const showApprobationMsg = (msg: string) => {
    setApprobationMsg(msg);
    setTimeout(() => setApprobationMsg(""), 3000);
  };

  const handleApprove = async (passId: string) => { 
    await api.approvePass(passId); 
    showApprobationMsg("Application approuvée !");
    await fetchData(); 
  };
  const handleMarkPaid = async (passId: string) => { 
    await api.markPassPaid(passId); 
    showApprobationMsg("Paiement confirmé !");
    await fetchData(); 
  };

  const handleReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectModalPass) return;
    setIsRejecting(true);
    try {
      await api.rejectPass(rejectModalPass.id, rejectionReason);
      setRejectModalPass(null);
      setRejectionReason("");
      showApprobationMsg("Pass rejeté !");
      await fetchData();
    } catch (err: any) {
      alert("Erreur: " + err.message);
    } finally {
      setIsRejecting(false);
    }
  };

  const handleDeletePass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deleteModalPass) return;

    const normalize = (s: string) => (s || '').trim().replace(/\s+/g, ' ').toLowerCase();
    const expectedGuestName = [deleteModalPass.guest_first_name, deleteModalPass.guest_last_name]
      .map(s => (s || '').trim())
      .filter(Boolean)
      .join(' ');
    const expectedProfileName = ((deleteModalPass as any).profiles?.full_name || '').trim();
    const expectedCandidates = [expectedGuestName, expectedProfileName]
      .filter(Boolean)
      .map(normalize);

    const inputClean = normalize(deleteConfirmationInput);
    const isMatch = expectedCandidates.includes(inputClean);

    if (!isMatch) {
      setDeleteError(`Le nom saisi ne correspond pas. Veuillez saisir exactement : "${expectedGuestName || expectedProfileName || 'Inconnu'}"`);
      return;
    }

    setIsDeletingPass(true);
    setDeleteError(null);
    try {
      await api.deletePass(deleteModalPass.id, deleteConfirmationInput.trim());
      setDeleteModalPass(null);
      setDeleteConfirmationInput("");
      showApprobationMsg("Pass supprimé définitivement avec succès !");
      await fetchData();
    } catch (err: any) {
      console.error("Delete pass error:", err);
      setDeleteError(err.message || "Erreur lors de la suppression du pass");
    } finally {
      setIsDeletingPass(false);
    }
  };

  const handleSaveEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (new Date(newDate).getTime() < Date.now()) {
      alert("La date de l'événement doit être supérieure à la date d'aujourd'hui.");
      return;
    }
    const validDrinks = newDrinks
      .filter(d => d.name && d.name.trim() !== "")
      .map(d => ({
        ...(d.id ? { id: d.id } : {}),
        name: d.name.trim(),
        aromas: d.aromas ? d.aromas.split(',').map((a: string) => a.trim()).filter(Boolean) : []
      }));
    const validPromoCodes = newPromoCodes
      .filter(p => p.code.trim() !== "" && Number(p.discount_amount) > 0)
      .map(p => ({ code: p.code.trim().toUpperCase(), discount_amount: Number(p.discount_amount) }));

    const formattedImage = formatImageUrl(newImageUrl);

    if (editingEventId) {
      await api.updateEvent(
        editingEventId, 
        newTitle, 
        new Date(newDate).toISOString(), 
        newLocation, 
        false, 
        newMax, 
        formattedImage, 
        newDescription, 
        newDressCode, 
        validDrinks,
        newBasePrice,
        validPromoCodes
      );
    } else {
      await api.createEvent(
        newTitle, 
        new Date(newDate).toISOString(), 
        newLocation, 
        false, 
        newMax, 
        formattedImage, 
        newDescription, 
        newDressCode, 
        validDrinks,
        newBasePrice,
        validPromoCodes
      );
    }
    cancelEdit();
    await fetchData();
  };

  const cancelEdit = () => {
    setEditingEventId(null);
    setNewTitle(""); 
    setNewDate(""); 
    setNewLocation(""); 
    setNewMax(1); 
    setNewImageUrl(""); 
    setNewDescription(""); 
    setNewDressCode(""); 
    setNewDrinks([]);
    setNewBasePrice(0);
    setNewPromoCodes([]);
  };

  const handleDeleteEvent = async (eventId: string) => {
    if (confirm("Supprimer définitivement cet événement et tous ses passes ?")) {
      try { await api.deleteEvent(eventId); if (editingEventId === eventId) cancelEdit(); await fetchData(); }
      catch (err: any) { alert("Erreur: " + err.message); }
    }
  };

  const handleEditClick = async (event: Event) => {
    setEditingEventId(event.id);
    setNewTitle(event.title);
    const d = new Date(event.date);
    const tzoffset = (new Date()).getTimezoneOffset() * 60000;
    setNewDate((new Date(d.getTime() - tzoffset)).toISOString().slice(0, 16));
    setNewLocation(event.location);
    setNewMax(event.max_passes_per_user);
    setNewImageUrl(event.image_url || "");
    setNewDescription(event.description || "");
    setNewDressCode(event.dress_code || "");
    
    // Helper to map drinks from either drink_menus or drinks JSONB
    const mapDrinksToState = (drinksList: any[]) => {
      return drinksList.map(item => ({
        id: item.id,
        name: item.name || "",
        aromas: Array.isArray(item.aromas)
          ? item.aromas.join(', ')
          : (typeof item.aromas === 'string' ? item.aromas : '')
      }));
    };

    // 1. Immediately map drinks from event, preserving existing IDs
    const initialDrinks = (event.drink_menus && event.drink_menus.length > 0)
      ? mapDrinksToState(event.drink_menus)
      : (Array.isArray(event.drinks) && event.drinks.length > 0 ? mapDrinksToState(event.drinks) : []);
    setNewDrinks(initialDrinks);

    setNewBasePrice(event.base_price ?? 0);
    setNewPromoCodes(Array.isArray(event.promo_codes) ? event.promo_codes : []);
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // 2. Fetch fresh event data from DB to guarantee drinks list is not missing or stale
    try {
      const freshEvent = await api.getEvent(event.id);
      if (freshEvent && Array.isArray(freshEvent.drink_menus) && freshEvent.drink_menus.length > 0) {
        setNewDrinks(mapDrinksToState(freshEvent.drink_menus));
      } else if (freshEvent && Array.isArray(freshEvent.drinks) && freshEvent.drinks.length > 0) {
        setNewDrinks(mapDrinksToState(freshEvent.drinks));
      }
    } catch (err) {
      console.error("Failed to load fresh drinks for edit event:", err);
    }
  };

  const cancelUserEdit = () => {
    setEditingUserId(null);
    setNewUserEmail(""); setNewUserPassword(""); setNewUserInsta(""); setNewUserRole("user");
  };

  const handleEditUserClick = (u: User) => {
    setEditingUserId(u.id);
    setNewUserEmail(u.email);
    setNewUserInsta(u.instagram_handle || "");
    setNewUserRole(u.role);
    setNewUserPassword("");
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleRoleChange = async (userId: string, newRole: string) => { 
    try {
      await api.updateRole(userId, newRole); 
      await fetchData(); 
    } catch (err: any) { alert("Erreur: " + err.message); }
  };

  const handleDeleteUser = async (userId: string) => {
    if (confirm("Supprimer définitivement cet utilisateur et tous ses passes ?")) {
      try { await api.deleteUser(userId); if (editingUserId === userId) cancelUserEdit(); await fetchData(); }
      catch (err: any) { alert("Erreur: " + err.message); }
    }
  };

  const handleDownloadDrinksReport = (eventId: string, eventTitle: string) => {
    const eventPasses = passes.filter(p => p.event_id === eventId && p.drink_menus);
    const drinkCounts: Record<string, number> = {};
    let totalDrinks = 0;
    
    eventPasses.forEach(p => {
      if (p.drink_menus) {
        const dName = p.drink_menus.name;
        drinkCounts[dName] = (drinkCounts[dName] || 0) + 1;
        totalDrinks++;
      }
    });

    const doc = new jsPDF();
    doc.text(`Rapport des boissons: ${eventTitle}`, 14, 20);
    
    let tableData = Object.entries(drinkCounts).map(([name, count]) => [name, count]);
    
    if (tableData.length === 0) {
      tableData = [['Aucune boisson réservée', 0]];
    }
    
    autoTable(doc, {
      startY: 30,
      head: [['Boisson', 'Quantité']],
      body: tableData,
      foot: [['Total', totalDrinks]],
    });

    doc.save(`boissons_${eventTitle.replace(/\s+/g, '_')}.pdf`);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setUserMsg("Enregistrement en cours...");
    try {
      if (newUserInsta && !/^https?:\/\/(www\.)?instagram\.com\/[a-zA-Z0-9_.]{1,30}\/?(\?.*)?$/.test(newUserInsta)) { setUserMsg("URL Instagram invalide"); return; }
      
      if (editingUserId) {
        await api.adminUpdateUser(editingUserId, newUserEmail, newUserPassword || undefined, newUserInsta, newUserRole);
        setUserMsg("✓ Compte mis à jour avec succès");
        cancelUserEdit();
      } else {
        await api.adminCreateUser(newUserEmail, newUserPassword, newUserInsta, newUserRole);
        setUserMsg("✓ Compte créé avec succès");
        cancelUserEdit();
      }
      await fetchData();
      setTimeout(() => setUserMsg(""), 3000);
    } catch (err: any) { setUserMsg("Erreur: " + err.message); }
  };

  const navItems = [
    { id: 'dashboard', label: 'Tableau de bord', icon: <LayoutDashboard size={20} /> },
    { id: 'evenements',    label: 'Événements',       icon: <CalendarDays size={20} /> },
    { id: 'passes-creation', label: 'Création de Passes', icon: <Ticket size={20} /> },
    { id: 'payment-points', label: 'Points de Paiement', icon: <Banknote size={20} /> },
    { id: 'utilisateurs',     label: 'Utilisateurs',      icon: <Users size={20} /> },
    { id: 'approbations',    label: 'Approbations',      icon: <CheckSquare size={20} /> },
    { id: 'news',            label: 'Actualités',        icon: <Newspaper size={20} /> },
    { id: 'profil',          label: 'Mon Profil',        icon: <UserIcon size={20} /> },
  ];

  useEffect(() => {
    const path = window.location.pathname;
    if (path === '/admin/passes/create' || path === '/admin/passes-creation') {
      setActiveTab('passes-creation');
    } else {
      const pathParts = path.split('/');
      const tabName = pathParts[2]; // /admin/[tabName]
      if (tabName && navItems.some(n => n.id === tabName)) {
        setActiveTab(tabName);
      } else {
        setActiveTab('dashboard');
      }
    }
  }, []);

  const handleTabClick = (id: string) => {
    setActiveTab(id);
    const newPath = id === 'dashboard' ? '/admin' : (id === 'passes-creation' ? '/admin/passes/create' : `/admin/${id}`);
    window.history.pushState(null, '', newPath);
  };

  if (isLoading) return (
    <div className="h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--bg)' }}>
      <div className="flex flex-col items-center gap-4">
        <svg className="animate-spin w-10 h-10 text-passi-corail" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
        </svg>
        <p className="font-bold" style={{ color: 'var(--text-secondary)' }}>Chargement du workspace...</p>
      </div>
    </div>
  );
  if (!isAdmin) return null;

  const statCards = [
    { label: "Chiffre d'affaires", value: `${stats.revenue} TND`, color: 'bg-passi-turquoise', icon: <DollarSign size={20} className="text-white" /> },
    { label: "Passes actifs",       value: stats.totalPasses,     color: 'bg-passi-corail',    icon: <CheckSquare size={20} className="text-white" /> },
    { label: "Utilisateurs",        value: stats.totalUsers,      color: 'bg-purple-500',      icon: <Users size={20} className="text-white" /> },
    { label: "Événements",          value: stats.totalEvents,     color: 'bg-blue-500',        icon: <CalendarDays size={20} className="text-white" /> },
  ];

  return (
    <div className="flex flex-col md:flex-row h-screen overflow-hidden" style={{ backgroundColor: 'var(--bg)' }}>

      {/* ─── SIDEBAR (DESKTOP) ─── */}
      <aside className="hidden md:flex w-64 flex-shrink-0 flex-col justify-between border-r" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }}>
        <div>
          <div className="h-18 flex items-center px-7 pt-7 pb-5 border-b" style={{ borderColor: 'var(--border)' }}>
            <Logo variant="auto" className="w-[120px] h-[36px]" />
          </div>

          {/* Theme toggle in sidebar */}
          <div className="px-4 pt-4">
            {mounted && (
              <button
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl btn-ghost text-sm"
              >
                {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
                <span>Mode {theme === 'dark' ? 'clair' : 'sombre'}</span>
              </button>
            )}
          </div>

          <nav className="p-4 space-y-1 mt-2">
            {navItems.map(({ id, label, icon }) => (
              <button
                key={id}
                onClick={() => handleTabClick(id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-150 ${activeTab === id ? 'nav-active' : 'hover:bg-[var(--bg-input)]'}`}
                style={{ color: activeTab === id ? '#FF6B5E' : 'var(--text-secondary)' }}
              >
                {icon}
                {label}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-4 border-t" style={{ borderColor: 'var(--border)' }}>
          <button
            onClick={contextLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-red-500 hover:bg-red-500/10 transition-all"
          >
            <LogOut size={18} />
            Déconnexion
          </button>
        </div>
      </aside>

      {/* ─── MOBILE TOP BAR ─── */}
      <div className="md:hidden flex items-center justify-between px-6 py-4 border-b flex-shrink-0" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }}>
        <Logo variant="auto" className="w-[100px] h-[30px]" />
        <div className="flex items-center gap-4">
          {mounted && (
            <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="text-gray-500">
              {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            </button>
          )}
          <button onClick={contextLogout} className="text-red-500"><LogOut size={20} /></button>
        </div>
      </div>

      {/* ─── MOBILE BOTTOM NAV ─── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 flex justify-around p-3 border-t z-50 pb-safe" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }}>
        {navItems.map(({ id, label, icon }) => (
          <button
            key={id}
            onClick={() => handleTabClick(id)}
            className={`flex flex-col items-center gap-1 ${activeTab === id ? 'text-passi-corail' : 'text-gray-400'}`}
          >
            {icon}
            <span className="text-[10px] font-bold">{label}</span>
          </button>
        ))}
      </nav>

      {/* ─── MAIN ─── */}
      <main className="flex-1 overflow-y-auto hide-scrollbar pb-24 md:pb-0">
        <div className="max-w-5xl mx-auto p-4 md:p-10 space-y-6 md:space-y-8 animate-fade-in-up">

          {/* Header */}
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] md:text-xs font-bold tracking-widest uppercase text-passi-corail mb-1">Passi Admin</p>
              <h1 className="text-2xl md:text-3xl font-extrabold capitalize" style={{ color: 'var(--text-primary)' }}>
                {navItems.find(n => n.id === activeTab)?.label || 'Tableau de bord'}
              </h1>
            </div>
            <div className="relative z-50">
              <div 
                className="flex items-center gap-3 cursor-pointer"
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              >
                <div className="w-9 h-9 rounded-full bg-passi-corail flex items-center justify-center text-white font-bold text-sm">
                  {user?.full_name ? user.full_name[0].toUpperCase() : (user?.email ? user.email[0].toUpperCase() : 'A')}
                </div>
                <div>
                  <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                    {user?.full_name || (user?.email ? user.email.split('@')[0] : 'Admin')}
                  </p>
                  <p className="text-xs text-passi-turquoise font-semibold">● En ligne</p>
                </div>
              </div>
              
              {/* Dropdown menu */}
              {isDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsDropdownOpen(false)}></div>
                  <div className="absolute right-0 mt-2 w-48 rounded-xl shadow-lg bg-white dark:bg-passi-bleu ring-1 ring-black ring-opacity-5 transition-all duration-200 overflow-hidden z-50">
                    <div className="py-1">
                      <div className="px-4 py-2 text-xs text-gray-500 uppercase font-bold border-b border-gray-100 dark:border-gray-800">Mon Compte</div>
                      <button onClick={() => { handleTabClick('profil'); setIsDropdownOpen(false); }} className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-passi-surface/20">Profil</button>
                      <div className="px-4 py-2 text-xs text-gray-500 uppercase font-bold border-y border-gray-100 dark:border-gray-800 mt-1">Simuler un rôle</div>
                      <button 
                        onClick={async () => { 
                          setIsDropdownOpen(false); 
                          try {
                            const currentRole = (user?.original_role || user?.role || '').toUpperCase();
                            if (currentRole !== 'ADMIN') {
                              throw new Error("Unauthorized: Only admins can simulate accounts.");
                            }
                            await startSimulation('user'); 
                          } catch (e: any) { alert(e.message); }
                        }} 
                        className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-passi-surface/20"
                      >
                        Utilisateur
                      </button>
                      <button 
                        onClick={async () => { 
                          setIsDropdownOpen(false); 
                          try {
                            const currentRole = (user?.original_role || user?.role || '').toUpperCase();
                            if (currentRole !== 'ADMIN') {
                              throw new Error("Unauthorized: Only admins can simulate accounts.");
                            }
                            await startSimulation('barman'); 
                          } catch (e: any) { alert(e.message); }
                        }} 
                        className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-passi-surface/20"
                      >
                        Barman
                      </button>
                      <button 
                        onClick={async () => { 
                          setIsDropdownOpen(false); 
                          try {
                            const currentRole = (user?.original_role || user?.role || '').toUpperCase();
                            if (currentRole !== 'ADMIN') {
                              throw new Error("Unauthorized: Only admins can simulate accounts.");
                            }
                            await startSimulation('security'); 
                          } catch (e: any) { alert(e.message); }
                        }} 
                        className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-passi-surface/20"
                      >
                        Sécurité
                      </button>
                      <button 
                        onClick={async () => { 
                          setIsDropdownOpen(false); 
                          try {
                            const currentRole = (user?.original_role || user?.role || '').toUpperCase();
                            if (currentRole !== 'ADMIN') {
                              throw new Error("Unauthorized: Only admins can simulate accounts.");
                            }
                            await startSimulation('payment_point'); 
                          } catch (e: any) { alert(e.message); }
                        }} 
                        className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-passi-surface/20"
                      >
                        Point de Paiement
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* ── DASHBOARD TAB ── */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6 md:space-y-8">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-5">
                {statCards.map((s, i) => (
                  <div key={i} className="card p-4 md:p-5 flex items-center gap-3 md:gap-4 shadow-sm">
                    <div className={`w-10 h-10 md:w-11 md:h-11 rounded-xl md:rounded-2xl flex items-center justify-center flex-shrink-0 ${s.color}`}>{s.icon}</div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] md:text-xs font-semibold leading-tight mb-0.5 truncate" style={{ color: 'var(--text-secondary)' }} title={s.label}>{s.label}</p>
                      <p className="text-xl md:text-2xl font-extrabold truncate" style={{ color: 'var(--text-primary)' }}>{s.value}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Chart */}
              <div className="card p-8 shadow-sm">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Activité des passes</h3>
                </div>
                <div className="w-full h-56 relative" style={{ borderBottom: '1px solid var(--border)', borderLeft: '1px solid var(--border)' }}>
                  {(() => {
                    const data = stats.chartData || [0,0,0,0,0,0,0];
                    const maxVal = Math.max(...data, 1);
                    const points = data.map((val, i) => ({ x: (i/(data.length-1))*100, y: 100-(val/maxVal)*80, val }));
                    const fillPath = `M0 100 L${points.map(p=>`${p.x} ${p.y}`).join(' L')} L100 100 Z`;
                    const linePath = `M${points.map(p=>`${p.x} ${p.y}`).join(' L')}`;
                    return (
                      <svg className="w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 100 100">
                        <defs>
                          <linearGradient id="grad-admin" x1="0%" y1="0%" x2="0%" y2="100%">
                            <stop offset="0%" stopColor="#FF6B5E" stopOpacity="0.35"/>
                            <stop offset="100%" stopColor="#FF6B5E" stopOpacity="0"/>
                          </linearGradient>
                        </defs>
                        <path d={fillPath} fill="url(#grad-admin)"/>
                        <path d={linePath} fill="none" stroke="#FF6B5E" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                        {points.map((p,i) => (
                          <circle key={i} cx={p.x} cy={p.y} r="2.5" fill="#FF6B5E"/>
                        ))}
                      </svg>
                    );
                  })()}
                  <div className="absolute -bottom-6 left-0 text-xs font-medium" style={{ color: 'var(--text-muted)' }}>J-6</div>
                  <div className="absolute -bottom-6 left-1/2 text-xs font-medium" style={{ color: 'var(--text-muted)', transform:'translateX(-50%)' }}>Moy.</div>
                  <div className="absolute -bottom-6 right-0 text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Aujourd'hui</div>
                </div>
              </div>

              {/* ── NOUVELLE COURBE FINANCIÈRE & RAPPORTS EXPORTABLES (PDF & CSV) ── */}
              <FinancialAnalyticsSection />
            </div>
          )}

          {/* ── EVENTS TAB ── */}
          {activeTab === 'evenements' && (
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
              {/* Form */}
              <div className="lg:col-span-2 card p-7 shadow-sm self-start">
                <h3 className="text-lg font-bold mb-6" style={{ color: 'var(--text-primary)' }}>
                  {editingEventId ? 'Modifier l\'événement' : 'Créer un événement'}
                </h3>
                <form onSubmit={handleSaveEvent} className="space-y-4">
                  {[
                    { label: "Titre", type: "text", val: newTitle, set: setNewTitle, required: true, placeholder: "Summer Festival" },
                    { label: "Date & Heure", type: "datetime-local", val: newDate, set: setNewDate, required: true },
                    { label: "Lieu", type: "text", val: newLocation, set: setNewLocation, required: true, placeholder: "Rooftop Club, Alger" },
                  ].map(f => (
                    <div key={f.label}>
                      <label className="label">{f.label}</label>
                      <input type={f.type} aria-label={f.label} required={f.required} value={f.val} placeholder={f.placeholder || ''} onChange={e => f.set(e.target.value)} className="input" />
                    </div>
                  ))}
                  <div>
                    <label className="label">Max passes / utilisateur</label>
                    <input type="number" aria-label="Max passes par utilisateur" min="1" max="10" required value={newMax} onChange={e => setNewMax(parseInt(e.target.value))} className="input" />
                  </div>
                  <div>
                    <label className="label">Prix du ticket (DT) *</label>
                    <input 
                      type="number" 
                      aria-label="Prix du ticket" 
                      min="0" 
                      step="0.5" 
                      required 
                      value={newBasePrice} 
                      onChange={e => setNewBasePrice(Math.max(0, parseFloat(e.target.value) || 0))} 
                      placeholder="Ex: 25" 
                      className="input font-bold text-amber-500" 
                    />
                  </div>
                  <div>
                    <label className="label">Description / Détails</label>
                    <textarea value={newDescription} onChange={e => setNewDescription(e.target.value)} placeholder="Ajoutez les détails de l'événement..." className="input min-h-[80px] py-3" />
                  </div>
                  <div>
                    <label className="label">Dress code (optionnel)</label>
                    <input type="text" value={newDressCode} onChange={e => setNewDressCode(e.target.value)} placeholder="Ex: Tenue correcte exigée..." className="input" />
                  </div>
                  <div>
                    <label className="label">URL de l'image (optionnel)</label>
                    <input 
                      type="url" 
                      value={newImageUrl} 
                      onChange={e => setNewImageUrl(e.target.value)} 
                      onBlur={e => setNewImageUrl(formatImageUrl(e.target.value))}
                      placeholder="https://... (Lien direct ou GitHub auto-converti)" 
                      className="input" 
                    />
                    {newImageUrl && (
                      <p className="text-[11px] text-passi-text-sec mt-1 truncate">
                        Formaté : {formatImageUrl(newImageUrl)}
                      </p>
                    )}
                  </div>

                  {/* Promo Codes */}
                  <div className="p-4 rounded-xl" style={{ backgroundColor: 'var(--bg-input)', border: '1.5px solid var(--border)' }}>
                    <div className="flex justify-between items-center mb-1">
                      <label className="label !mb-0 flex items-center gap-1.5">
                        <Tag size={16} className="text-passi-corail" />
                        Codes Promo (optionnel)
                      </label>
                      <span className="text-xs text-neutral-400 font-semibold">{newPromoCodes.length} code(s)</span>
                    </div>
                    <p className="text-xs text-neutral-400 mb-3">Définissez des codes de réduction à appliquer au guichet ou en ligne.</p>
                    {newPromoCodes.map((promo, index) => (
                      <div key={index} className="flex gap-2 mb-2 items-center">
                        <input 
                          type="text" 
                          placeholder="CODE (ex: STUDENT2026)" 
                          value={promo.code}
                          onChange={e => {
                            const updated = [...newPromoCodes];
                            updated[index].code = e.target.value.toUpperCase();
                            setNewPromoCodes(updated);
                          }}
                          className="input flex-1 text-sm font-mono uppercase"
                        />
                        <div className="relative w-28">
                          <input 
                            type="number" 
                            placeholder="Réduction" 
                            min="1"
                            step="0.5"
                            value={promo.discount_amount || ''}
                            onChange={e => {
                              const updated = [...newPromoCodes];
                              updated[index].discount_amount = Math.max(0, parseFloat(e.target.value) || 0);
                              setNewPromoCodes(updated);
                            }}
                            className="input text-sm pr-7 font-bold text-emerald-400"
                          />
                          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-neutral-500">DT</span>
                        </div>
                        <button 
                          type="button" 
                          onClick={() => setNewPromoCodes(newPromoCodes.filter((_, i) => i !== index))} 
                          className="p-2.5 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors"
                          title="Supprimer ce code promo"
                        >
                          <X size={16}/>
                        </button>
                      </div>
                    ))}
                    <button 
                      type="button" 
                      onClick={() => setNewPromoCodes([...newPromoCodes, { code: "", discount_amount: 5 }])} 
                      className="flex items-center gap-2 text-sm font-bold text-passi-corail hover:text-passi-corail/80 mt-2"
                    >
                      <Plus size={16}/> Ajouter un code promo
                    </button>
                  </div>

                  {/* Drinks & Aromas */}
                  <div className="p-4 rounded-xl" style={{ backgroundColor: 'var(--bg-input)', border: '1.5px solid var(--border)' }}>
                    <div className="flex justify-between items-center mb-2">
                      <div>
                        <label className="label !mb-0 font-bold">Menu boissons & arômes (optionnel)</label>
                        <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">
                          Définissez chaque boisson et ses arômes disponibles (séparés par des virgules).
                        </p>
                      </div>
                      <button 
                        type="button" 
                        onClick={() => setNewDrinks([...newDrinks, { name: "", aromas: "" }])} 
                        className="flex items-center gap-1.5 text-xs font-bold text-passi-turquoise hover:text-passi-turquoise/80 cursor-pointer"
                      >
                        <Plus size={14}/> Ajouter une boisson
                      </button>
                    </div>

                    {newDrinks.length === 0 ? (
                      <div className="py-4 text-center text-xs text-[var(--text-secondary)] border border-dashed border-[var(--border)] rounded-xl">
                        Aucune boisson définie. Cliquez sur "Ajouter une boisson" pour configurer les consommations.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {newDrinks.map((drink, index) => (
                          <div 
                            key={drink.id || index} 
                            className="p-3 rounded-xl border border-[var(--border)] bg-black/10 space-y-2 relative"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-bold uppercase tracking-wider text-passi-turquoise">
                                Boisson #{index + 1}
                              </span>
                              <button 
                                type="button" 
                                onClick={() => setNewDrinks(newDrinks.filter((_, i) => i !== index))} 
                                className="p-1.5 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors cursor-pointer"
                                title="Supprimer cette boisson"
                              >
                                <X size={14}/>
                              </button>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                              <div>
                                <label className="text-[11px] font-semibold text-[var(--text-secondary)] block mb-1">
                                  Nom de la boisson *
                                </label>
                                <input 
                                  type="text" 
                                  placeholder="Ex: Mojito, Café..." 
                                  value={drink.name}
                                  onChange={e => { 
                                    const u = [...newDrinks]; 
                                    u[index] = { ...u[index], name: e.target.value }; 
                                    setNewDrinks(u); 
                                  }}
                                  className="input text-sm w-full"
                                  required
                                />
                              </div>
                              <div>
                                <label className="text-[11px] font-semibold text-[var(--text-secondary)] block mb-1">
                                  Arômes disponibles
                                </label>
                                <input 
                                  type="text" 
                                  placeholder="Ex: Fraise, Passion, Pêche (séparés par des virgules)" 
                                  value={drink.aromas || ""}
                                  onChange={e => { 
                                    const u = [...newDrinks]; 
                                    u[index] = { ...u[index], aromas: e.target.value }; 
                                    setNewDrinks(u); 
                                  }}
                                  className="input text-sm w-full"
                                />
                              </div>
                            </div>

                            {drink.aromas && drink.aromas.trim() && (
                              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                                <span className="text-[10px] text-[var(--text-secondary)] mr-1">Arômes détectés :</span>
                                {drink.aromas.split(',').map(a => a.trim()).filter(Boolean).map((aroma, aIdx) => (
                                  <span 
                                    key={aIdx} 
                                    className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-passi-turquoise/15 text-passi-turquoise border border-passi-turquoise/25"
                                  >
                                    {aroma}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button type="submit" className="btn-primary flex-1">
                      {editingEventId ? 'Mettre à jour' : 'Publier'}
                    </button>
                    {editingEventId && (
                      <button type="button" onClick={cancelEdit} className="btn-ghost px-4">
                        <X size={18}/>
                      </button>
                    )}
                  </div>
                </form>
              </div>

              {/* Event list */}
              <div className="lg:col-span-3 card p-7 shadow-sm">
                <h3 className="text-lg font-bold mb-6" style={{ color: 'var(--text-primary)' }}>Événements actifs</h3>
                <div className="space-y-4">
                  {events.length === 0 && (
                    <div className="text-center py-16 rounded-2xl" style={{ backgroundColor: 'var(--bg-input)', border: '1.5px dashed var(--border)' }}>
                      <p className="font-medium" style={{ color: 'var(--text-muted)' }}>Aucun événement</p>
                    </div>
                  )}
                  {events.map(ev => (
                    <div key={ev.id} className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-5 rounded-2xl gap-4" style={{ backgroundColor: 'var(--bg-input)', border: '1.5px solid var(--border)' }}>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-base" style={{ color: 'var(--text-primary)' }}>{ev.title}</h4>
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20">
                            {ev.base_price ?? 0} DT
                          </span>
                        </div>
                        <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>{ev.location}</p>
                        <p className="text-xs mt-1 font-semibold text-passi-turquoise">
                          {new Date(ev.date).toLocaleDateString('fr-FR', { day:'numeric', month:'long', year:'numeric' })} · {new Date(ev.date).toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit' })}
                        </p>
                        {ev.promo_codes && ev.promo_codes.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {ev.promo_codes.map((pr, idx) => (
                              <span key={idx} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-mono font-medium bg-neutral-800 text-neutral-300 border border-neutral-700">
                                <Tag size={10} className="text-passi-corail" />
                                {pr.code}: -{pr.discount_amount}DT
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => handleDownloadDrinksReport(ev.id, ev.title)} className="p-2.5 rounded-xl bg-passi-turquoise/10 text-passi-turquoise hover:bg-passi-turquoise/20 transition-colors" title="Télécharger le rapport des boissons">
                          <Download size={16}/>
                        </button>
                        <button onClick={() => handleEditClick(ev)} className="btn-ghost p-2.5 !rounded-xl">
                          <Pencil size={16}/>
                        </button>
                        <button onClick={() => handleDeleteEvent(ev.id)} className="p-2.5 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors">
                          <Trash2 size={16}/>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── PASSES CREATION TAB ── */}
          {activeTab === 'passes-creation' && (
            <PassCreationSection 
              users={profiles} 
              events={events} 
              onPassCreated={fetchData} 
            />
          )}

          {/* ── STAFF TAB ── */}
          {activeTab === 'utilisateurs' && (
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
              <div className="lg:col-span-2 card p-7 shadow-sm self-start">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                    {editingUserId ? "Modifier un compte" : "Créer un compte"}
                  </h3>
                  {editingUserId && (
                    <button onClick={cancelUserEdit} className="text-sm text-passi-corail underline">Annuler</button>
                  )}
                </div>
                <form onSubmit={handleSaveUser} className="space-y-4">
                  {[
                    { label:"Email", type:"email", val:newUserEmail, set:setNewUserEmail, ph:"admin@passi.com" },
                    { label: editingUserId ? "Mot de passe (optionnel)" : "Mot de passe", type:"password", val:newUserPassword, set:setNewUserPassword, ph:"••••••••" },
                    { label:"URL Instagram (Optionnel)", type:"url", val:newUserInsta, set:setNewUserInsta, ph:"https://instagram.com/pseudo" },
                  ].map(f => (
                    <div key={f.label}>
                      <label className="label">{f.label}</label>
                      <input type={f.type} required={f.type !== "url" && !(f.type === "password" && editingUserId)} value={f.val} placeholder={f.ph} onChange={e => f.set(e.target.value)} className="input"/>
                    </div>
                  ))}
                  <div>
                    <label className="label">Rôle</label>
                    <select value={newUserRole} onChange={e => setNewUserRole(e.target.value)} className="input">
                      <option value="user">Utilisateur</option>
                      <option value="admin">Admin</option>
                      <option value="payment_point">Point de Paiement</option>
                      <option value="security">Sécurité</option>
                      <option value="barman">Barman</option>
                    </select>
                  </div>
                  <button type="submit" className="btn-primary w-full">
                    {editingUserId ? "Enregistrer les modifications" : "Créer le membre"}
                  </button>
                  {userMsg && (
                    <p className={`text-xs font-semibold px-3 py-2 rounded-xl ${userMsg.startsWith('✓') ? 'bg-passi-turquoise/10 text-passi-turquoise' : 'bg-passi-corail/10 text-passi-corail'}`}>{userMsg}</p>
                  )}
                </form>
              </div>

              <div className="lg:col-span-3 card p-7 shadow-sm">
                <h3 className="text-lg font-bold mb-6" style={{ color: 'var(--text-primary)' }}>Annuaire & Permissions</h3>
                <div className="space-y-3 max-h-[600px] overflow-y-auto hide-scrollbar">
                  {profiles.map(p => (
                    <div key={p.id} className="flex justify-between items-center p-4 rounded-2xl transition-colors gap-4" style={{ backgroundColor: 'var(--bg-input)', border: '1.5px solid var(--border)' }}>
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="w-9 h-9 flex-shrink-0 rounded-full bg-gradient-to-tr from-passi-corail to-orange-400 flex items-center justify-center text-white font-bold text-sm uppercase">
                          {p.email[0]}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-sm truncate" style={{ color: 'var(--text-primary)' }}>{p.email}</p>
                          <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{p.instagram_handle}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {p.instagram_handle && (
                          <a
                            href={p.instagram_handle}
                            target="_blank" rel="noreferrer"
                            className="p-2 rounded-xl bg-pink-500/10 text-pink-500 hover:bg-pink-500/20 transition-colors flex items-center justify-center"
                            title="Profil IG"
                          >
                            <ExternalLink size={15}/>
                          </a>
                        )}
                        <select
                          value={p.role}
                          onChange={e => handleRoleChange(p.id, e.target.value)}
                          className="input !w-auto text-xs !py-1.5 !px-3"
                        >
                          <option value="user">Utilisateur</option>
                          <option value="admin">Admin</option>
                          <option value="payment_point">Point de Paiement</option>
                          <option value="security">Sécurité</option>
                          <option value="barman">Barman</option>
                        </select>
                        <button 
                          onClick={() => handleToggleSuspend(p)} 
                          className={`p-2 rounded-xl transition-colors ${p.is_suspended ? 'bg-amber-500/10 text-amber-500 hover:bg-amber-500/20' : 'bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20'}`}
                          title={p.is_suspended ? "Compte suspendu (Cliquer pour réactiver)" : "Compte actif (Cliquer pour suspendre)"}
                        >
                          {p.is_suspended ? <ShieldAlert size={15}/> : <ShieldCheck size={15}/>}
                        </button>
                        <button onClick={() => handleEditUserClick(p)} className="p-2 rounded-xl bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 transition-colors">
                          <Pencil size={15}/>
                        </button>
                        <button onClick={() => handleDeleteUser(p.id)} className="p-2 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors">
                          <Trash2 size={15}/>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── PAYMENT POINTS TAB ── */}
          {activeTab === 'payment-points' && (
            <div className="space-y-8">
              {/* Top Section: Worker Account Management & Worker Table */}
              <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
                {/* Form to create restricted Payment Point Worker Account */}
                <div className="lg:col-span-2 card p-7 shadow-sm self-start">
                  <div className="flex items-center gap-2.5 mb-2">
                    <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center">
                      <Banknote size={18} />
                    </div>
                    <h3 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                      Nouveau Guichetier
                    </h3>
                  </div>
                  <p className="text-xs text-neutral-400 mb-5">
                    Créez un compte restreint dédié au personnel de terrain pour collecter les paiements en espèces.
                  </p>

                  <form onSubmit={handleCreatePaymentPointWorker} className="space-y-4">
                    <div>
                      <label className="label">Email du travailleur</label>
                      <input 
                        type="email" 
                        required 
                        value={ppWorkerEmail} 
                        onChange={e => setPpWorkerEmail(e.target.value)} 
                        placeholder="point1@passi.com" 
                        className="input" 
                      />
                    </div>
                    <div>
                      <label className="label">Mot de passe provisoire</label>
                      <input 
                        type="password" 
                        required 
                        value={ppWorkerPassword} 
                        onChange={e => setPpWorkerPassword(e.target.value)} 
                        placeholder="••••••••" 
                        className="input" 
                      />
                    </div>

                    <button type="submit" className="btn-primary w-full flex items-center justify-center gap-2">
                      <Plus size={16} />
                      Créer le compte Guichet
                    </button>

                    {ppWorkerMsg && (
                      <p className={`text-xs font-semibold px-3 py-2 rounded-xl ${ppWorkerMsg.startsWith('✓') ? 'bg-passi-turquoise/10 text-passi-turquoise' : 'bg-passi-corail/10 text-passi-corail'}`}>
                        {ppWorkerMsg}
                      </p>
                    )}
                  </form>
                </div>

                {/* Table listing all Payment Point Workers */}
                <div className="lg:col-span-3 card p-7 shadow-sm">
                  <div className="flex justify-between items-center mb-6">
                    <div>
                      <h3 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                        Travailleurs "Point de Paiement"
                      </h3>
                      <p className="text-xs text-neutral-400 mt-0.5">
                        Personnel autorisé à encaisser et valider des pass physiques
                      </p>
                    </div>
                    <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20">
                      {profiles.filter(p => (p.role || '').toLowerCase() === 'payment_point').length} guichetier(s)
                    </span>
                  </div>

                  <div className="space-y-3 max-h-[450px] overflow-y-auto hide-scrollbar">
                    {profiles.filter(p => (p.role || '').toLowerCase() === 'payment_point').length === 0 ? (
                      <div className="text-center py-12 rounded-2xl" style={{ backgroundColor: 'var(--bg-input)', border: '1.5px dashed var(--border)' }}>
                        <Banknote size={32} className="mx-auto mb-2 text-neutral-500 opacity-60" />
                        <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>
                          Aucun compte Point de Paiement pour l'instant.
                        </p>
                      </div>
                    ) : (
                      profiles
                        .filter(p => (p.role || '').toLowerCase() === 'payment_point')
                        .map(worker => (
                          <div 
                            key={worker.id} 
                            className="flex items-center justify-between p-4 rounded-2xl transition-colors gap-3" 
                            style={{ backgroundColor: 'var(--bg-input)', border: '1.5px solid var(--border)' }}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm ${worker.is_suspended ? 'bg-rose-500/10 text-rose-400' : 'bg-amber-500/10 text-amber-400'}`}>
                                <Banknote size={18} />
                              </div>
                              <div className="min-w-0">
                                <p className="font-bold text-sm truncate" style={{ color: 'var(--text-primary)' }}>
                                  {worker.email}
                                </p>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${worker.is_suspended ? 'bg-rose-500/15 text-rose-400 border border-rose-500/20' : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'}`}>
                                    {worker.is_suspended ? 'Suspendu' : 'Actif'}
                                  </span>
                                  <span className="text-[11px] text-neutral-500 font-mono">
                                    ID: {worker.id.slice(0, 8)}...
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                onClick={() => handleToggleSuspend(worker)}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                                  worker.is_suspended
                                    ? 'bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 border border-emerald-500/30'
                                    : 'bg-amber-500/15 text-amber-400 hover:bg-amber-500/25 border border-amber-500/30'
                                }`}
                              >
                                {worker.is_suspended ? (
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
                                onClick={() => handleDeleteUser(worker.id)}
                                className="p-2 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors"
                                title="Supprimer ce compte guichetier"
                              >
                                <Trash2 size={15}/>
                              </button>
                            </div>
                          </div>
                        ))
                    )}
                  </div>
                </div>
              </div>

              {/* Financial Reporting & Export Section */}
              <div className="card p-7 shadow-sm space-y-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
                      Rapport Financier des Encaissements
                    </h3>
                    <p className="text-xs text-neutral-400 mt-0.5">
                      Suivi en temps réel des encaissements en espèces par travailleur et par date.
                    </p>
                  </div>

                  {/* Export Buttons */}
                  <div className="flex items-center gap-3">
                    <button
                      onClick={handleExportCSV}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-neutral-800 hover:bg-neutral-700 text-white border border-neutral-700 transition-colors cursor-pointer"
                    >
                      <FileSpreadsheet size={15} className="text-emerald-400" />
                      <span>Exporter CSV</span>
                    </button>
                    <button
                      onClick={handleExportPDF}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-passi-corail hover:bg-passi-corail/90 text-white shadow-md shadow-passi-corail/20 transition-all cursor-pointer"
                    >
                      <FileText size={15} />
                      <span>Exporter PDF</span>
                    </button>
                  </div>
                </div>

                {/* Filters */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 rounded-2xl" style={{ backgroundColor: 'var(--bg-input)', border: '1.5px solid var(--border)' }}>
                  <div>
                    <label className="label">Filtrer par Événement</label>
                    <select
                      value={ppFilterEventId}
                      onChange={(e) => {
                        setPpFilterEventId(e.target.value);
                        fetchPpStats(e.target.value, ppFilterDate);
                      }}
                      className="input text-sm"
                    >
                      <option value="">Tous les événements</option>
                      {events.map(ev => (
                        <option key={ev.id} value={ev.id}>{ev.title}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="label">Filtrer par Date d'approbation</label>
                    <input
                      type="date"
                      value={ppFilterDate}
                      onChange={(e) => {
                        setPpFilterDate(e.target.value);
                        fetchPpStats(ppFilterEventId, e.target.value);
                      }}
                      className="input text-sm"
                    />
                  </div>

                  <div className="flex items-end">
                    <button
                      type="button"
                      onClick={() => {
                        setPpFilterEventId("");
                        setPpFilterDate("");
                        fetchPpStats("", "");
                      }}
                      className="w-full btn-ghost text-xs font-bold py-3"
                    >
                      Réinitialiser les filtres
                    </button>
                  </div>
                </div>

                {/* Summary Metrics Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="p-5 rounded-2xl bg-amber-500/10 border border-amber-500/20">
                    <p className="text-xs font-semibold text-amber-400">Total Espèces Collectées</p>
                    <p className="text-2xl font-black text-amber-300 mt-1">
                      {ppStats.overallTotalCollected} DT
                    </p>
                  </div>
                  <div className="p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
                    <p className="text-xs font-semibold text-emerald-400">Total Passes Validés</p>
                    <p className="text-2xl font-black text-emerald-300 mt-1">
                      {ppStats.overallTotalPasses} pass
                    </p>
                  </div>
                  <div className="p-5 rounded-2xl bg-purple-500/10 border border-purple-500/20">
                    <p className="text-xs font-semibold text-purple-400">Guichetiers Actifs</p>
                    <p className="text-2xl font-black text-purple-300 mt-1">
                      {ppStats.workers.length}
                    </p>
                  </div>
                </div>

                {/* Detailed Breakdown per Payment Point Worker */}
                <div>
                  <h4 className="text-base font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
                    Détail par Guichetier & Encaissements
                  </h4>

                  {loadingPpStats ? (
                    <div className="text-center py-12 text-sm text-neutral-400">
                      Calcul des statistiques en cours...
                    </div>
                  ) : ppStats.workers.length === 0 ? (
                    <div className="text-center py-12 rounded-2xl" style={{ backgroundColor: 'var(--bg-input)', border: '1.5px dashed var(--border)' }}>
                      <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>
                        Aucune transaction validée pour ces critères.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {ppStats.workers.map((worker: any) => (
                        <div 
                          key={worker.id}
                          className="p-5 rounded-2xl space-y-3"
                          style={{ backgroundColor: 'var(--bg-input)', border: '1.5px solid var(--border)' }}
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b" style={{ borderColor: 'var(--border)' }}>
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-amber-500/15 text-amber-400 flex items-center justify-center font-bold text-xs">
                                {worker.email[0]?.toUpperCase()}
                              </div>
                              <div>
                                <h5 className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>{worker.email}</h5>
                                <p className="text-xs text-neutral-400">ID: {worker.id}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-4 text-xs font-bold">
                              <span className="text-neutral-400">
                                Passes: <strong className="text-white">{worker.totalPasses}</strong>
                              </span>
                              <span className="px-2.5 py-1 rounded-lg bg-amber-500/15 text-amber-400 border border-amber-500/25">
                                Total: {worker.totalCollected} DT
                              </span>
                            </div>
                          </div>

                          {/* Passes list preview */}
                          <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                              <thead>
                                <tr className="text-neutral-400 border-b border-neutral-800">
                                  <th className="py-2 pr-3 font-semibold">Date</th>
                                  <th className="py-2 px-3 font-semibold">Pass ID</th>
                                  <th className="py-2 px-3 font-semibold">Événement</th>
                                  <th className="py-2 px-3 font-semibold">Client</th>
                                  <th className="py-2 pl-3 font-semibold text-right">Montant</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-neutral-800/60">
                                {worker.passes.map((p: any) => (
                                  <tr key={p.id} className="text-neutral-300 hover:bg-neutral-800/30">
                                    <td className="py-2 pr-3 font-mono text-neutral-400">
                                      {p.approvedAt ? p.approvedAt.replace('T', ' ').slice(0, 16) : 'N/A'}
                                    </td>
                                    <td className="py-2 px-3 font-mono font-medium text-amber-400">
                                      #{p.id.slice(0, 8)}
                                    </td>
                                    <td className="py-2 px-3">{p.eventTitle}</td>
                                    <td className="py-2 px-3 text-neutral-400 truncate max-w-[150px]">
                                      {p.instagramHandle || p.userEmail || 'Inconnu'}
                                    </td>
                                    <td className="py-2 pl-3 text-right font-bold text-white">
                                      {p.finalPrice} DT
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Daily Breakdown Table */}
                {ppStats.dailyBreakdown.length > 0 && (
                  <div className="pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
                    <h4 className="text-base font-bold mb-3" style={{ color: 'var(--text-primary)' }}>
                      Récapitulatif Journalier (Groupé par DATE)
                    </h4>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="text-neutral-400 border-b border-neutral-800">
                            <th className="py-2.5 pr-4 font-semibold">Date</th>
                            <th className="py-2.5 px-4 font-semibold">Passes Encaissés</th>
                            <th className="py-2.5 pl-4 font-semibold text-right">Total Collecté</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-800/60">
                          {ppStats.dailyBreakdown.map((day: any) => (
                            <tr key={day.date} className="text-neutral-300">
                              <td className="py-2.5 pr-4 font-mono font-bold text-white">{day.date}</td>
                              <td className="py-2.5 px-4">{day.totalPasses} pass</td>
                              <td className="py-2.5 pl-4 text-right font-mono font-bold text-amber-400">
                                {day.totalCollected} DT
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── PASSES TAB ── */}
          {activeTab === 'approbations' && (
            <div className="card p-7 shadow-sm">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Approbation des passes</h3>
                {approbationMsg && (
                  <p className="text-sm font-semibold px-4 py-2 rounded-xl bg-passi-turquoise/10 text-passi-turquoise">
                    ✓ {approbationMsg}
                  </p>
                )}
              </div>
              {passes.length === 0 ? (
                <div className="text-center py-20 rounded-2xl" style={{ backgroundColor: 'var(--bg-input)', border: '1.5px dashed var(--border)' }}>
                  <Check size={40} className="mx-auto mb-3 text-passi-turquoise" />
                  <p className="font-semibold" style={{ color: 'var(--text-muted)' }}>Aucune demande en attente</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {passes.map(pass => {
                    const statusConfig: Record<string, { color: string; bg: string; label: string }> = {
                      pending: { color: 'text-amber-500', bg: 'bg-amber-500/10', label: 'En attente' },
                      awaiting_payment: { color: 'text-blue-500', bg: 'bg-blue-500/10', label: 'Att. paiement' },
                      activated: { color: 'text-passi-turquoise', bg: 'bg-passi-turquoise/10', label: 'Activé' },
                      rejected: { color: 'text-passi-corail', bg: 'bg-passi-corail/10', label: 'Rejeté' },
                    };
                    const sc = statusConfig[pass.entry_status] || { color: 'text-gray-500', bg: 'bg-gray-500/10', label: pass.entry_status };
                    return (
                      <div key={pass.id} className={`p-5 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 transition-colors ${sc.bg === 'bg-passi-corail/10' ? 'opacity-70' : ''}`} style={{ backgroundColor: 'var(--bg-input)', border: '1.5px solid var(--border)' }}>
                        <div className="flex items-center gap-4">
                          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl font-bold ${sc.bg} ${sc.color}`}>
                            {pass.entry_status === 'pending' ? '!' : pass.entry_status === 'awaiting_payment' ? '$' : pass.entry_status === 'rejected' ? 'X' : '✓'}
                          </div>
                          <div>
                            <p className="font-bold text-base" style={{ color: 'var(--text-primary)' }}>{pass.guest_first_name} {pass.guest_last_name}</p>
                            <p className="text-sm truncate max-w-[200px]" title={pass.instagram_handle} style={{ color: 'var(--text-secondary)' }}>{pass.instagram_handle}</p>
                            <p className="text-xs font-semibold mt-1" style={{ color: 'var(--text-muted)' }}>
                              Événement: {pass.events?.title || 'Inconnu'}
                            </p>
                            {pass.drink_menus && (
                              <p className="text-xs font-semibold text-passi-corail">
                                Boisson: {pass.drink_menus.name}
                              </p>
                            )}
                            <span className={`badge mt-2 inline-block ${sc.bg} ${sc.color}`}>{sc.label}</span>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <a
                            href={pass.instagram_handle || '#'}
                            target="_blank" rel="noreferrer"
                            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-pink-500 to-rose-500 hover:shadow-lg transition-all"
                          >
                            <ExternalLink size={15}/> Profil IG
                          </a>
                          {pass.entry_status === 'pending' && (
                            <>
                              <button onClick={() => handleApprove(pass.id)} className="btn-primary px-4 py-2 text-sm bg-green-500 hover:bg-green-600 border-none">Approuver Application</button>
                              <button onClick={() => setRejectModalPass(pass)} className="btn-ghost px-4 py-2 text-sm border border-red-500 text-red-500">Rejeter</button>
                            </>
                          )}
                          {pass.entry_status === 'awaiting_payment' && (
                            <>
                              <button onClick={() => handleMarkPaid(pass.id)} className="px-4 py-2 rounded-xl text-sm font-bold text-white bg-green-500 hover:bg-green-600 transition-all">Confirmer Paiement</button>
                              <button onClick={() => setRejectModalPass(pass)} className="btn-ghost px-4 py-2 text-sm border border-red-500 text-red-500">Annuler / Rejeter</button>
                            </>
                          )}
                          {['activated', 'scanned'].includes(pass.entry_status) && (
                            <div className="flex items-center gap-2 px-4 py-2 bg-green-500/10 text-green-600 rounded-xl font-bold text-sm" title="Paid passes cannot be modified or revoked.">
                              <Check size={16} /> Payé & Confirmé
                            </div>
                          )}

                          <button
                            type="button"
                            onClick={() => {
                              setDeleteModalPass(pass);
                              setDeleteConfirmationInput("");
                              setDeleteError(null);
                            }}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-bold text-red-500 hover:text-white bg-red-500/10 hover:bg-red-500 border border-red-500/20 hover:border-red-500 transition-all cursor-pointer"
                            title="Supprimer définitivement ce pass"
                          >
                            <Trash2 size={15} /> Supprimer
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── PROFILE TAB ── */}
          {activeTab === 'profil' && (
            <div className="card p-7 shadow-sm max-w-2xl">
              <h3 className="text-lg font-bold mb-6" style={{ color: 'var(--text-primary)' }}>Mon Profil</h3>
              
              <form onSubmit={handleSaveAdminProfile} className="space-y-6">
                <div>
                  <label className="label">Nom complet</label>
                  <input type="text" value={adminFullName} onChange={e => setAdminFullName(e.target.value)} placeholder="Votre nom" className="input" />
                </div>
                
                <div>
                  <label className="label">Email (lecture seule)</label>
                  <input type="email" disabled value={user?.email || ''} className="input opacity-70 cursor-not-allowed" />
                </div>
                
                <hr style={{ borderColor: 'var(--border)' }} />
                
                <div>
                  <label className="label">Nouveau mot de passe (optionnel)</label>
                  <input type="password" value={adminPassword} onChange={e => setAdminPassword(e.target.value)} placeholder="••••••••" className="input" />
                  <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Laissez vide si vous ne souhaitez pas modifier votre mot de passe.</p>
                </div>
                
                <button type="submit" disabled={isSavingAdmin} className="btn-primary w-full">
                  {isSavingAdmin ? "Enregistrement..." : "Mettre à jour le profil"}
                </button>
                
                {adminMsg && (
                  <p className={`text-sm font-semibold px-4 py-3 rounded-xl mt-4 ${adminMsg.startsWith('✓') ? 'bg-passi-turquoise/10 text-passi-turquoise' : 'bg-passi-corail/10 text-passi-corail'}`}>
                    {adminMsg}
                  </p>
                )}
              </form>
            </div>
          )}

          {/* ── ACTUALITÉS ── */}
          {activeTab === 'news' && (
            <NewsManagementSection />
          )}

          {/* ── REJECTION MODAL ── */}
          {mounted && rejectModalPass && createPortal(
            <div className="fixed inset-0 z-[9999] overflow-y-auto flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
              <div className="relative my-auto bg-white dark:bg-passi-bleu p-6 rounded-2xl w-full max-w-md shadow-2xl" style={{ border: '1px solid var(--border)' }}>
                <h3 className="text-xl font-bold mb-2">Rejeter le Pass</h3>
                <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
                  Êtes-vous sûr de vouloir rejeter ce pass ? Cette action marquera la demande comme rejetée.
                </p>
                <form onSubmit={handleReject} className="space-y-4">
                  <div>
                    <label className="label">Raison du rejet (Optionnel)</label>
                    <textarea
                      value={rejectionReason}
                      onChange={e => setRejectionReason(e.target.value)}
                      placeholder="Notes internes ou raison..."
                      className="input min-h-[80px]"
                    />
                  </div>
                  <div className="flex gap-3 justify-end">
                    <button type="button" onClick={() => setRejectModalPass(null)} className="btn-ghost px-4 py-2">
                      Annuler
                    </button>
                    <button type="submit" disabled={isRejecting} className="btn-primary px-4 py-2 bg-red-500 hover:bg-red-600 border-none text-white">
                      {isRejecting ? "En cours..." : "Confirmer le Rejet"}
                    </button>
                  </div>
                </form>
              </div>
            </div>,
            document.body
          )}

          {/* ── DELETE PASS CONFIRMATION MODAL ── */}
          {mounted && deleteModalPass && (() => {
            const normalize = (s: string) => (s || '').trim().replace(/\s+/g, ' ').toLowerCase();
            const expectedGuestName = [deleteModalPass.guest_first_name, deleteModalPass.guest_last_name]
              .map(s => (s || '').trim())
              .filter(Boolean)
              .join(' ');
            const expectedProfileName = ((deleteModalPass as any).profiles?.full_name || '').trim();
            const targetName = expectedGuestName || expectedProfileName || 'Inconnu';
            const expectedCandidates = [expectedGuestName, expectedProfileName].filter(Boolean).map(normalize);

            const isMatch = expectedCandidates.includes(normalize(deleteConfirmationInput));

            return createPortal(
              <div className="fixed inset-0 z-[9999] overflow-y-auto flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
                <div className="relative my-auto bg-white dark:bg-[#151D2A] p-6 sm:p-8 rounded-[2rem] w-full max-w-lg shadow-2xl border border-red-500/30">
                  <div className="flex items-center gap-3 mb-4 text-red-500">
                    <div className="w-12 h-12 rounded-2xl bg-red-500/10 flex items-center justify-center flex-shrink-0">
                      <Trash2 size={24} />
                    </div>
                    <div>
                      <h3 className="text-xl font-black text-gray-900 dark:text-white">
                        Supprimer définitivement ce Pass
                      </h3>
                      <p className="text-xs text-red-500 font-semibold uppercase tracking-wider">
                        Action irréversible
                      </p>
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 mb-6 text-sm text-red-700 dark:text-red-300 space-y-1">
                    <p className="font-bold">⚠️ Attention :</p>
                    <p className="text-xs leading-relaxed text-red-600 dark:text-red-300/90">
                      Ce pass sera immédiatement et définitivement supprimé de la base de données, y compris tous ses QR codes d'accès et de boisson.
                    </p>
                  </div>

                  {/* Pass Holder Info Card */}
                  <div className="p-4 rounded-2xl bg-gray-50 dark:bg-[#0D131F] border border-gray-200 dark:border-gray-800 mb-6 space-y-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-gray-500 dark:text-gray-400 font-medium">Titulaire du Pass :</span>
                      <span className="font-extrabold text-gray-900 dark:text-white text-sm">{targetName}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-gray-500 dark:text-gray-400 font-medium">Événement :</span>
                      <span className="font-bold text-gray-800 dark:text-gray-200">{deleteModalPass.events?.title || 'Inconnu'}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-gray-500 dark:text-gray-400 font-medium">Statut :</span>
                      <span className="font-mono font-bold uppercase text-xs px-2 py-0.5 rounded-lg bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
                        {deleteModalPass.entry_status}
                      </span>
                    </div>
                  </div>

                  <form onSubmit={handleDeletePass} className="space-y-5">
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <label className="block text-xs font-bold text-gray-700 dark:text-gray-300">
                          Pour confirmer, veuillez saisir le nom du titulaire :
                        </label>
                        <button
                          type="button"
                          onClick={() => setDeleteConfirmationInput(targetName)}
                          className="text-[11px] font-bold text-passi-corail hover:underline flex items-center gap-1 cursor-pointer"
                          title="Remplir automatiquement le champ"
                        >
                          <Copy size={12} /> Copier le nom
                        </button>
                      </div>
                      <div
                        onClick={() => setDeleteConfirmationInput(targetName)}
                        className="mb-2 p-2.5 rounded-xl bg-gray-100 dark:bg-black/30 border border-dashed border-gray-300 dark:border-gray-700 font-mono font-bold text-sm text-center text-red-500 select-all cursor-pointer hover:bg-gray-200 dark:hover:bg-black/50 transition-colors"
                        title="Cliquez pour insérer ce nom"
                      >
                        {targetName}
                      </div>
                      <input
                        type="text"
                        value={deleteConfirmationInput}
                        onChange={e => {
                          setDeleteConfirmationInput(e.target.value);
                          setDeleteError(null);
                        }}
                        placeholder={`Tapez "${targetName}"`}
                        className={`w-full px-4 py-3 rounded-xl border text-sm font-semibold transition-all outline-none ${
                          isMatch
                            ? "border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                            : "border-gray-300 dark:border-gray-700 bg-white dark:bg-[#0D131F] text-gray-900 dark:text-white focus:border-red-500"
                        }`}
                        autoFocus
                      />
                      {isMatch ? (
                        <p className="text-xs text-emerald-500 font-bold mt-1.5 flex items-center gap-1">
                          <Check size={14} /> Nom correspondant, confirmation valide.
                        </p>
                      ) : (
                        <p className="text-[11px] text-gray-400 mt-1">
                          Astuce : vous pouvez aussi cliquer sur le nom ci-dessus pour le remplir automatiquement.
                        </p>
                      )}
                    </div>

                    {deleteError && (
                      <div className="p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-xs text-red-500 font-semibold">
                        {deleteError}
                      </div>
                    )}

                    <div className="flex gap-3 justify-end pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          setDeleteModalPass(null);
                          setDeleteConfirmationInput("");
                          setDeleteError(null);
                        }}
                        disabled={isDeletingPass}
                        className="px-4 py-2.5 rounded-xl text-sm font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
                      >
                        Annuler
                      </button>
                      <button
                        type="submit"
                        disabled={!isMatch || isDeletingPass}
                        className="px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-red-600 hover:bg-red-700 shadow-lg shadow-red-600/30 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 cursor-pointer"
                      >
                        {isDeletingPass ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                            <span>Suppression...</span>
                          </>
                        ) : (
                          <>
                            <Trash2 size={16} />
                            <span>Supprimer définitivement</span>
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                </div>
              </div>,
              document.body
            );
          })()}

        </div>
      </main>
    </div>
  );
}
