"use client";

import { useEffect, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { api, Pass, User, Event } from "@/lib/services/api";
import { useAuth } from "@/lib/context/auth-context";
import { useSimulation } from "@/lib/context/simulation-context";
import { Logo } from "@/components/Logo";
import { Sun, Moon, LogOut, LayoutDashboard, CalendarDays, Users, CheckSquare, Plus, Trash2, Pencil, X, ExternalLink, Check, DollarSign, Download, User as UserIcon, Banknote, ShieldAlert, ShieldCheck, FileSpreadsheet, FileText, Tag, Ticket, Copy, Newspaper, Wine } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { aggregateDrinksReportData, generateDrinksReportPDF } from "@/lib/utils/drinks-report";
import { PassCreationSection } from "@/components/admin/PassCreationSection";
import { NewsManagementSection } from "@/components/admin/NewsManagementSection";
import { FinancialAnalyticsSection } from "@/components/admin/FinancialAnalyticsSection";
import { PassesActivityChart } from "@/components/admin/PassesActivityChart";
import { PaymentPointSupervisionSection } from "@/components/admin/PaymentPointSupervisionSection";
import { formatImageUrl } from "@/lib/utils/url";

export default function AdminDashboard({ initialTab }: { initialTab?: string } = {}) {
  const router = useRouter();
  const { user, logout: contextLogout } = useAuth();
  const { startSimulation } = useSimulation();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [activeTab, setActiveTab] = useState(initialTab || "dashboard");
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
  const [newUserSellPointName, setNewUserSellPointName] = useState("");
  const [userMsg, setUserMsg] = useState("");

  const [adminFullName, setAdminFullName] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [isSavingAdmin, setIsSavingAdmin] = useState(false);
  const [adminMsg, setAdminMsg] = useState("");

  const [rejectModalPass, setRejectModalPass] = useState<Pass | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [isRejecting, setIsRejecting] = useState(false);
  const [approbationMsg, setApprobationMsg] = useState("");
  const [approbEventFilter, setApprobEventFilter] = useState("");
  const [approbStatusFilter, setApprobStatusFilter] = useState("all");
  const [approbOriginFilter, setApprobOriginFilter] = useState("all");
  const [approbOverdueFilter, setApprobOverdueFilter] = useState(false);
  const [approbCashierFilter, setApprobCashierFilter] = useState("all");
  const [approbSearch, setApprobSearch] = useState("");
  const [isRefreshingApprob, setIsRefreshingApprob] = useState(false);

  // Delete pass confirmation state
  const [deleteModalPass, setDeleteModalPass] = useState<Pass | null>(null);
  const [deleteConfirmationInput, setDeleteConfirmationInput] = useState("");
  const [isDeletingPass, setIsDeletingPass] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [drinksReportModal, setDrinksReportModal] = useState<{ eventId: string; eventTitle: string } | null>(null);

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

  const handleExpirePass = async (passId: string) => { 
    if (!confirm("Voulez-vous expirer manuellement cette réservation et libérer la place dans les stocks ?")) return;
    try {
      await api.expireReservation(passId); 
      showApprobationMsg("Réservation expirée et stock rétabli !");
      await fetchData(); 
    } catch (err: any) {
      alert("Erreur lors de l'expiration : " + (err.message || err));
    }
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
    const expectedProfileName = ((deleteModalPass as any).profiles?.full_name || (deleteModalPass as any).user?.full_name || '').trim();
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
    setNewUserEmail(""); setNewUserPassword(""); setNewUserInsta(""); setNewUserRole("user"); setNewUserSellPointName("");
  };

  const handleEditUserClick = (u: User) => {
    setEditingUserId(u.id);
    setNewUserEmail(u.email);
    setNewUserInsta(u.instagram_handle || "");
    setNewUserRole(u.role);
    setNewUserSellPointName(u.sell_point_name || "");
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
    const { rows, totalDrinks } = aggregateDrinksReportData(passes, eventId);
    generateDrinksReportPDF(eventTitle, rows, totalDrinks);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setUserMsg("Enregistrement en cours...");
    try {
      if (newUserInsta && !/^https?:\/\/(www\.)?instagram\.com\/[a-zA-Z0-9_.]{1,30}\/?(\?.*)?$/.test(newUserInsta)) { setUserMsg("URL Instagram invalide"); return; }
      
      if (editingUserId) {
        await api.adminUpdateUser(editingUserId, newUserEmail, newUserPassword || undefined, newUserInsta, newUserRole);
        if (newUserRole === 'payment_point' && newUserSellPointName) {
          await fetch('/api/admin/users', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: editingUserId, sellPointName: newUserSellPointName }),
          });
        }
        setUserMsg("✓ Compte mis à jour avec succès");
        cancelUserEdit();
      } else {
        await api.adminCreateUser(
          newUserEmail, 
          newUserPassword, 
          newUserInsta, 
          newUserRole,
          newUserRole === 'payment_point' ? newUserSellPointName : undefined
        );
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
    if (initialTab) {
      setActiveTab(initialTab === 'points-de-paiement' ? 'payment-points' : initialTab);
      return;
    }
    const path = window.location.pathname;
    if (path === '/admin/passes/create' || path === '/admin/passes-creation') {
      setActiveTab('passes-creation');
    } else {
      const pathParts = path.split('/');
      const tabName = pathParts[2]; // /admin/[tabName]
      if (tabName === 'points-de-paiement') {
        setActiveTab('payment-points');
      } else if (tabName && navItems.some(n => n.id === tabName)) {
        setActiveTab(tabName);
      } else {
        setActiveTab('dashboard');
      }
    }
  }, [initialTab]);

  const handleTabClick = (id: string) => {
    setActiveTab(id);
    const newPath = id === 'dashboard' ? '/admin' : (id === 'passes-creation' ? '/admin/passes/create' : (id === 'payment-points' ? '/admin/payment-points' : `/admin/${id}`));
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

              {/* ── NOUVELLE COURBE ACTIVITÉ DES PASSES & RAPPORTS EXPORTABLES (PDF & CSV) ── */}
              <PassesActivityChart />

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
                        <button 
                          onClick={() => setDrinksReportModal({ eventId: ev.id, eventTitle: ev.title })} 
                          className="p-2.5 rounded-xl bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 transition-colors" 
                          title="Consulter le rapport des boissons (Écran & PDF)"
                        >
                          <Wine size={16}/>
                        </button>
                        <button 
                          onClick={() => handleDownloadDrinksReport(ev.id, ev.title)} 
                          className="p-2.5 rounded-xl bg-passi-turquoise/10 text-passi-turquoise hover:bg-passi-turquoise/20 transition-colors" 
                          title="Télécharger directement le rapport des boissons (PDF)"
                        >
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
                  {newUserRole === 'payment_point' && (
                    <div>
                      <label className="label">Nom du Point de Vente *</label>
                      <input
                        type="text"
                        required
                        value={newUserSellPointName}
                        placeholder="Ex: Guichet VIP Entrée Nord"
                        onChange={e => setNewUserSellPointName(e.target.value)}
                        className="input"
                      />
                    </div>
                  )}
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
                          {(p.sell_point_name || p.email)[0]}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-sm truncate" style={{ color: 'var(--text-primary)' }}>
                            {p.sell_point_name || p.full_name || p.email}
                          </p>
                          <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                            {p.sell_point_name ? `${p.email} • ${p.instagram_handle || 'Point de vente'}` : (p.instagram_handle || p.email)}
                          </p>
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

          {/* ── PAYMENT POINTS TAB (SYSTÈME CAISSIER & SUPERVISION) ── */}
          {activeTab === 'payment-points' && (
            <PaymentPointSupervisionSection
              events={events}
              profiles={profiles}
              onRefreshProfiles={fetchData}
              onToggleSuspend={handleToggleSuspend}
              onDeleteUser={handleDeleteUser}
              onInspectCashierPasses={(cashierId) => {
                setApprobCashierFilter(cashierId);
                setActiveTab('approbations');
              }}
            />
          )}

          {/* ── PASSES & RESERVATIONS TAB ── */}
          {activeTab === 'approbations' && (() => {
            const isPassOverdue = (pass: Pass) => {
              const isUnpaid = pass.status === 'PENDING_PAYMENT' || pass.entry_status === 'awaiting_payment' || pass.entry_status === 'pending';
              if (!isUnpaid) return false;
              if (pass.expires_at) {
                return new Date() > new Date(pass.expires_at);
              }
              if (pass.created_at) {
                const expiry = new Date(new Date(pass.created_at).getTime() + 72 * 60 * 60 * 1000);
                return new Date() > expiry;
              }
              return false;
            };

            const totalOverdueCount = passes.filter(isPassOverdue).length;

            // List of unique Cashiers / Points of Sale
            const availableCashiers: { id: string; label: string }[] = [];
            const seenCashiers = new Set<string>();

            profiles.forEach(p => {
              const role = (p.role || '').toLowerCase();
              if (role === 'payment_point' || role === 'cashier' || p.sell_point_name) {
                const id = p.id;
                if (!seenCashiers.has(id)) {
                  seenCashiers.add(id);
                  const label = p.sell_point_name ? `${p.sell_point_name} (${p.email})` : (p.full_name || p.email || id.slice(0, 8));
                  availableCashiers.push({ id, label });
                }
              }
            });

            // Include distinct sell point names stored directly on passes
            passes.forEach(pass => {
              if (pass.issued_by_pos && !seenCashiers.has(pass.issued_by_pos)) {
                seenCashiers.add(pass.issued_by_pos);
                availableCashiers.push({ id: pass.issued_by_pos, label: `📍 ${pass.issued_by_pos}` });
              }
            });

            // Supervision KPI stats across all passes
            let posCount = 0;
            let posRevenue = 0;
            let webPaidCount = 0;
            let webPaidRevenue = 0;
            let awaitingCount = 0;
            let expiredCount = 0;

            passes.forEach(p => {
              const isPos = p.source === 'POS' || p.pass_origin === 'POS' || Boolean(p.issued_by_pos) || Boolean(p.reservation_code && p.reservation_code.startsWith('POS-'));
              const isPaid = p.status === 'PAID' || ['activated', 'scanned'].includes(p.entry_status);
              const isExpired = p.status === 'EXPIRED' || p.entry_status === 'rejected';
              const price = Number(p.final_price ?? p.total_price ?? 0);

              if (isPos) {
                posCount += 1;
                posRevenue += price;
              } else if (isPaid) {
                webPaidCount += 1;
                webPaidRevenue += price;
              } else if (isExpired) {
                expiredCount += 1;
              } else {
                awaitingCount += 1;
              }
            });

            const approbKpis = {
              posCount,
              posRevenue,
              webPaidCount,
              webPaidRevenue,
              awaitingCount,
              expiredCount,
              totalCount: passes.length,
            };

            const displayedPasses = passes.filter(pass => {
              if (approbEventFilter && pass.event_id !== approbEventFilter) {
                return false;
              }
              if (approbStatusFilter !== 'all') {
                const s = (pass.status || pass.entry_status || '').toLowerCase();
                if (approbStatusFilter === 'pending_payment') {
                  if (s !== 'pending_payment' && pass.entry_status !== 'awaiting_payment') return false;
                } else if (approbStatusFilter === 'paid') {
                  if (s !== 'paid' && !['activated', 'scanned'].includes(pass.entry_status)) return false;
                } else if (approbStatusFilter === 'expired') {
                  if (s !== 'expired' && pass.entry_status !== 'rejected') return false;
                } else if (approbStatusFilter === 'pending') {
                  if (pass.entry_status !== 'pending') return false;
                } else if (s !== approbStatusFilter.toLowerCase()) {
                  return false;
                }
              }
              if (approbOriginFilter !== 'all') {
                const isPos = pass.source === 'POS' || pass.pass_origin === 'POS' || Boolean(pass.issued_by_pos) || Boolean(pass.reservation_code && pass.reservation_code.startsWith('POS-'));
                const isQuick = !isPos && (pass.source === 'QUICK_RESERVATION' || Boolean(pass.reservation_code));
                if (approbOriginFilter === 'POS' && !isPos) return false;
                if (approbOriginFilter === 'QUICK_RESERVATION' && !isQuick) return false;
                if (approbOriginFilter === 'STANDARD' && (isPos || isQuick)) return false;
              }
              if (approbCashierFilter !== 'all') {
                const staffId = pass.cashier_id || pass.approved_by || pass.payment_point_id;
                const matchesId = staffId === approbCashierFilter;
                const matchesPosName = Boolean(pass.issued_by_pos && pass.issued_by_pos === approbCashierFilter);
                const approverProf = profiles.find(p => p.id === staffId);
                const matchesProfileSellPoint = Boolean(approverProf?.sell_point_name && approverProf.sell_point_name === approbCashierFilter);

                if (!matchesId && !matchesPosName && !matchesProfileSellPoint) {
                  return false;
                }
              }
              if (approbOverdueFilter && !isPassOverdue(pass)) {
                return false;
              }
              if (approbSearch.trim()) {
                const q = approbSearch.trim().toLowerCase();
                const code = (pass.reservation_code || '').toLowerCase();
                const phone = (pass.phone || '').toLowerCase();
                const email = (pass.email || (pass as any).profiles?.email || (pass as any).user?.email || '').toLowerCase();
                const names = [
                  pass.guest_first_name,
                  pass.guest_last_name,
                  (pass as any).owner?.full_name,
                  (pass as any).user?.full_name,
                  (pass as any).profiles?.full_name
                ].filter(Boolean).join(' ').toLowerCase();
                const drink = (pass.selected_drink || pass.drink_name || pass.drink_menus?.name || '').toLowerCase();
                if (!code.includes(q) && !phone.includes(q) && !email.includes(q) && !names.includes(q) && !drink.includes(q)) {
                  return false;
                }
              }
              return true;
            });

            return (
              <div className="card p-7 shadow-sm">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                  <div>
                    <h3 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                      Gestion Unifiée des Réservations & Passes
                    </h3>
                    <p className="text-xs text-neutral-400 mt-1">
                      {displayedPasses.length} réservation(s) affichée(s) sur {passes.length} au total
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {approbationMsg && (
                      <p className="text-sm font-semibold px-4 py-2 rounded-xl bg-passi-turquoise/10 text-passi-turquoise">
                        ✓ {approbationMsg}
                      </p>
                    )}
                    <button
                      type="button"
                      disabled={isRefreshingApprob}
                      onClick={async () => {
                        setIsRefreshingApprob(true);
                        try {
                          await fetchData();
                        } finally {
                          setIsRefreshingApprob(false);
                        }
                      }}
                      className="px-3 py-1.5 rounded-xl text-xs font-semibold border border-neutral-700 hover:border-passi-turquoise text-neutral-300 hover:text-white transition-all cursor-pointer"
                      title="Actualiser la liste en temps réel"
                    >
                      {isRefreshingApprob ? "Rafraîchissement..." : "↻ Rafraîchir"}
                    </button>
                  </div>
                </div>

                {/* Supervision KPI Summary Cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
                  <div className="p-4 rounded-2xl bg-purple-500/10 border border-purple-500/20">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-purple-400 block">
                      📍 Émis au Guichet (POS)
                    </span>
                    <div className="text-xl font-black text-purple-200 mt-1">
                      {approbKpis.posCount} <span className="text-xs font-normal text-purple-400">pass</span>
                    </div>
                    <div className="text-xs font-mono font-bold text-purple-300 mt-0.5">
                      {approbKpis.posRevenue.toFixed(2)} TND encaissés
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 block">
                      🌐 Web Encaissés (Guichet)
                    </span>
                    <div className="text-xl font-black text-emerald-200 mt-1">
                      {approbKpis.webPaidCount} <span className="text-xs font-normal text-emerald-400">pass</span>
                    </div>
                    <div className="text-xs font-mono font-bold text-emerald-300 mt-0.5">
                      {approbKpis.webPaidRevenue.toFixed(2)} TND encaissés
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/20">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-blue-400 block">
                      ⏳ Attente Paiement
                    </span>
                    <div className="text-xl font-black text-blue-200 mt-1">
                      {approbKpis.awaitingCount} <span className="text-xs font-normal text-blue-400">réservations</span>
                    </div>
                    <div className="text-xs text-blue-300 mt-0.5">
                      À régler au point de vente
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-neutral-800/60 border border-neutral-700/60">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 block">
                      🎫 Total Passes Événements
                    </span>
                    <div className="text-xl font-black text-neutral-200 mt-1">
                      {approbKpis.totalCount} <span className="text-xs font-normal text-neutral-400">passes</span>
                    </div>
                    <div className="text-xs text-neutral-400 mt-0.5">
                      {approbKpis.expiredCount} expirés / annulés
                    </div>
                  </div>
                </div>

                {/* Filters */}
                <div className="space-y-3 p-4 mb-6 rounded-2xl" style={{ backgroundColor: 'var(--bg-input)', border: '1.5px solid var(--border)' }}>
                  {/* Search Bar */}
                  <div>
                    <input
                      type="text"
                      value={approbSearch}
                      onChange={(e) => setApprobSearch(e.target.value)}
                      placeholder="🔍 Rechercher par code (ex: QCK-...), téléphone, email, nom, boisson..."
                      className="input text-sm w-full font-medium"
                    />
                  </div>

                  {/* Filter Dropdowns & Overdue Toggle */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
                    <div>
                      <label className="label text-xs">Événement</label>
                      <select
                        value={approbEventFilter}
                        onChange={(e) => setApprobEventFilter(e.target.value)}
                        className="input text-xs"
                      >
                        <option value="">Tous les événements</option>
                        {events.map(ev => (
                          <option key={ev.id} value={ev.id}>{ev.title}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="label text-xs">Origine / Flux</label>
                      <select
                        value={approbOriginFilter}
                        onChange={(e) => setApprobOriginFilter(e.target.value)}
                        className="input text-xs"
                      >
                        <option value="all">Tous les flux</option>
                        <option value="POS">📍 Émis au Point de Vente (POS / Guichet)</option>
                        <option value="QUICK_RESERVATION">⚡ Réservation Express (Guest)</option>
                        <option value="STANDARD">👤 Réservation Standard</option>
                      </select>
                    </div>

                    <div>
                      <label className="label text-xs">Point de Vente / Caissier</label>
                      <select
                        value={approbCashierFilter}
                        onChange={(e) => setApprobCashierFilter(e.target.value)}
                        className="input text-xs"
                      >
                        <option value="all">Tous les points de vente</option>
                        {availableCashiers.map(c => (
                          <option key={c.id} value={c.id}>{c.label}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="label text-xs">Statut</label>
                      <select
                        value={approbStatusFilter}
                        onChange={(e) => setApprobStatusFilter(e.target.value)}
                        className="input text-xs"
                      >
                        <option value="all">Tous les statuts</option>
                        <option value="pending_payment">Attente Paiement (PENDING_PAYMENT)</option>
                        <option value="paid">Payé / Activé (PAID)</option>
                        <option value="expired">Expiré (EXPIRED)</option>
                        <option value="pending">En attente approbation (Legacy)</option>
                      </select>
                    </div>

                    <div>
                      <label className="label text-xs">Alerte Échéance</label>
                      <button
                        type="button"
                        onClick={() => setApprobOverdueFilter(!approbOverdueFilter)}
                        className={`w-full py-2 px-3 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                          approbOverdueFilter
                            ? 'bg-red-500/20 text-red-300 border-red-500 shadow-sm shadow-red-500/20'
                            : 'bg-neutral-800/80 text-neutral-300 border-neutral-700 hover:border-neutral-500'
                        }`}
                      >
                        <span>⚠️ En retard (&gt; 72h)</span>
                        <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                          totalOverdueCount > 0 ? 'bg-red-500 text-white font-extrabold' : 'bg-neutral-700 text-neutral-400'
                        }`}>
                          {totalOverdueCount}
                        </span>
                      </button>
                    </div>
                  </div>
                </div>

                {displayedPasses.length === 0 ? (
                  <div className="text-center py-20 rounded-2xl" style={{ backgroundColor: 'var(--bg-input)', border: '1.5px dashed var(--border)' }}>
                    <Check size={40} className="mx-auto mb-3 text-passi-turquoise" />
                    <p className="font-semibold" style={{ color: 'var(--text-muted)' }}>Aucune réservation trouvée</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {displayedPasses.map(pass => {
                      const isPos = pass.source === 'POS' || pass.pass_origin === 'POS' || Boolean(pass.issued_by_pos) || Boolean(pass.reservation_code && pass.reservation_code.startsWith('POS-'));
                      const isQuick = !isPos && (pass.source === 'QUICK_RESERVATION' || Boolean(pass.reservation_code));
                      const overdue = isPassOverdue(pass);
                      const isPaid = pass.status === 'PAID' || ['activated', 'scanned'].includes(pass.entry_status);
                      const isExpired = pass.status === 'EXPIRED' || pass.entry_status === 'rejected';
                      const isUnpaid = !isPaid && !isExpired;

                      const statusConfig: Record<string, { color: string; bg: string; label: string }> = {
                        pending: { color: 'text-amber-500', bg: 'bg-amber-500/10', label: 'En attente' },
                        awaiting_payment: { color: 'text-blue-400', bg: 'bg-blue-500/10', label: 'Att. paiement' },
                        PENDING_PAYMENT: { color: 'text-blue-400', bg: 'bg-blue-500/10', label: 'Att. paiement' },
                        activated: { color: 'text-passi-turquoise', bg: 'bg-passi-turquoise/10', label: 'Payé / Activé' },
                        PAID: { color: 'text-passi-turquoise', bg: 'bg-passi-turquoise/10', label: 'Payé / Activé' },
                        rejected: { color: 'text-passi-corail', bg: 'bg-passi-corail/10', label: 'Expiré / Rejeté' },
                        EXPIRED: { color: 'text-passi-corail', bg: 'bg-passi-corail/10', label: 'Expiré' },
                        CANCELLED: { color: 'text-passi-corail', bg: 'bg-passi-corail/10', label: 'Annulé' },
                      };
                      const statusKey = pass.status || pass.entry_status;
                      const sc = statusConfig[statusKey] || { color: 'text-gray-400', bg: 'bg-gray-500/10', label: statusKey };

                      const guestName = [pass.guest_first_name, pass.guest_last_name].filter(Boolean).join(' ') || (pass as any).owner?.full_name || (pass as any).user?.full_name || 'Invité Express';
                      const contactPhone = pass.phone;
                      const contactEmail = pass.email || (pass as any).profiles?.email || (pass as any).user?.email;
                      const selectedDrink = pass.selected_drink || pass.drink_name || pass.drink_menus?.name;

                      return (
                        <div
                          key={pass.id}
                          className={`p-5 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 transition-all ${
                            overdue ? 'border-red-500/60 bg-red-950/10 shadow-sm shadow-red-900/10' : ''
                          }`}
                          style={{
                            backgroundColor: overdue ? undefined : 'var(--bg-input)',
                            border: overdue ? '1.5px solid rgba(239, 68, 68, 0.4)' : '1.5px solid var(--border)'
                          }}
                        >
                          <div className="flex items-start sm:items-center gap-4 min-w-0 flex-1">
                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl font-bold flex-shrink-0 ${sc.bg} ${sc.color}`}>
                              {isPos ? '📍' : isQuick ? '⚡' : (pass.entry_status === 'pending' ? '!' : isUnpaid ? '$' : isExpired ? 'X' : '✓')}
                            </div>

                            <div className="min-w-0 flex-1">
                              {/* Badges Bar: Origin, Code, Overdue, Status */}
                              <div className="flex flex-wrap items-center gap-2 mb-1.5">
                                {isPos ? (
                                  <span className="px-2.5 py-0.5 rounded-lg text-[11px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30 flex items-center gap-1">
                                    📍 Point de Vente (POS) {pass.issued_by_pos ? `· ${pass.issued_by_pos}` : ''}
                                  </span>
                                ) : isQuick ? (
                                  <span className="px-2.5 py-0.5 rounded-lg text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                                    ⚡ Réservation Express
                                  </span>
                                ) : (
                                  <span className="px-2.5 py-0.5 rounded-lg text-[11px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30 flex items-center gap-1">
                                    👤 Standard
                                  </span>
                                )}

                                {pass.reservation_code && (
                                  <span className="px-2.5 py-0.5 rounded-lg text-[11px] font-mono font-bold bg-neutral-900 text-passi-corail border border-neutral-700">
                                    Code : {pass.reservation_code}
                                  </span>
                                )}

                                {overdue && (
                                  <span className="px-2.5 py-0.5 rounded-lg text-[11px] font-bold bg-red-600/30 text-red-300 border border-red-500/50 flex items-center gap-1 animate-pulse">
                                    ⚠️ En retard (&gt; 72h)
                                  </span>
                                )}

                                <span className={`badge inline-block ${sc.bg} ${sc.color} text-[10px]`}>
                                  {sc.label}
                                </span>
                              </div>

                              {/* Guest Name & Event */}
                              <p className="font-bold text-base" style={{ color: 'var(--text-primary)' }}>
                                {guestName}
                              </p>

                              {/* Contact Details (Phone, Email, Instagram) */}
                              <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-neutral-300">
                                {contactPhone && (
                                  <span className="flex items-center gap-1 font-medium">
                                    📞 {contactPhone}
                                  </span>
                                )}
                                {contactEmail && (
                                  <span className="flex items-center gap-1 font-medium text-neutral-400">
                                    ✉️ {contactEmail}
                                  </span>
                                )}
                                {pass.instagram_handle && pass.instagram_handle !== '@unknown' && (
                                  <span className="text-pink-400 font-medium">
                                    📸 {pass.instagram_handle}
                                  </span>
                                )}
                              </div>

                              <p className="text-xs font-semibold mt-1" style={{ color: 'var(--text-muted)' }}>
                                Événement : <span className="text-neutral-200">{pass.events?.title || 'Inconnu'}</span>
                              </p>

                              {/* Drink Selection */}
                              {selectedDrink && (
                                <p className="text-xs font-semibold text-passi-turquoise mt-0.5">
                                  🍹 Boisson : {selectedDrink}
                                </p>
                              )}

                              {/* Expiration Reference (72h notice) */}
                              {pass.expires_at && (
                                <p className={`text-[11px] mt-1 font-medium ${overdue ? 'text-red-400 font-bold' : 'text-neutral-400'}`}>
                                  ⏳ Échéance indicative : {new Date(pass.expires_at).toLocaleString('fr-FR', {
                                    day: 'numeric',
                                    month: 'short',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                  {overdue ? ' (Délai dépassé - Expiration manuelle requise)' : ' (72h max)'}
                                </p>
                              )}

                              {/* Audit & Approver Trail: Who approved or issued this pass */}
                              {(() => {
                                const staffId = pass.cashier_id || pass.approved_by || pass.payment_point_id;
                                const approverProfile = profiles.find(p => p.id === staffId);
                                const approverDisplayName = pass.issued_by_pos
                                  || approverProfile?.sell_point_name
                                  || approverProfile?.full_name
                                  || (pass as any).approver?.full_name
                                  || approverProfile?.email
                                  || (staffId ? `Guichet (#${staffId.slice(0, 6)})` : null);

                                const isApproverAdmin = (approverProfile?.role || (pass as any).approver?.role || '').toLowerCase() === 'admin';
                                const creatorProfile = profiles.find(p => p.id === pass.created_by);
                                const creatorName = creatorProfile?.full_name || (pass as any).creator?.full_name || creatorProfile?.email || 'Admin';
                                const isManualAdmin = pass.pass_origin === 'ADMIN' || Boolean(pass.created_by);

                                return (
                                  <div className="mt-3 pt-2.5 border-t border-neutral-800/80 flex flex-wrap items-center gap-2 text-xs">
                                    {isPos ? (
                                      <div className="flex flex-wrap items-center gap-1.5">
                                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30 flex items-center gap-1">
                                          📍 Émis en Caisse (POS)
                                        </span>
                                        <span className="text-neutral-300">
                                          Point de vente : <strong className="text-white font-bold">{pass.issued_by_pos || approverDisplayName || 'Guichet'}</strong>
                                        </span>
                                        {pass.payment_approved_at && (
                                          <span className="text-neutral-500 text-[11px]">
                                            · le {new Date(pass.payment_approved_at).toLocaleString('fr-FR', {
                                              day: 'numeric',
                                              month: 'short',
                                              hour: '2-digit',
                                              minute: '2-digit',
                                            })}
                                          </span>
                                        )}
                                      </div>
                                    ) : isPaid ? (
                                      <div className="flex flex-wrap items-center gap-1.5">
                                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                          isApproverAdmin
                                            ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                                            : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                        }`}>
                                          ✓ {isApproverAdmin ? 'Encaissé par Admin' : 'Encaissé au Guichet'}
                                        </span>
                                        {approverDisplayName ? (
                                          <span className="text-neutral-300">
                                            Validé par : <strong className="text-white font-bold">{approverDisplayName}</strong>
                                          </span>
                                        ) : (
                                          <span className="text-neutral-400">Paiement validé</span>
                                        )}
                                        {pass.payment_approved_at && (
                                          <span className="text-neutral-500 text-[11px]">
                                            · le {new Date(pass.payment_approved_at).toLocaleString('fr-FR', {
                                              day: 'numeric',
                                              month: 'short',
                                              hour: '2-digit',
                                              minute: '2-digit',
                                            })}
                                          </span>
                                        )}
                                      </div>
                                    ) : isExpired ? (
                                      <div className="flex items-center gap-1.5 text-neutral-400 text-xs">
                                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                                          ✕ Expiré / Annulé
                                        </span>
                                        {pass.rejection_reason && (
                                          <span className="text-rose-300 text-[11px] italic">({pass.rejection_reason})</span>
                                        )}
                                      </div>
                                    ) : (
                                      <div className="flex items-center gap-1.5 text-neutral-400 text-xs">
                                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                          ⏳ Attente de règlement
                                        </span>
                                        <span className="text-neutral-400 text-[11px]">
                                          À régler et valider sur place au point de vente
                                        </span>
                                      </div>
                                    )}

                                    {isManualAdmin && (
                                      <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-neutral-800 text-neutral-300 border border-neutral-700 ml-auto">
                                        👑 Créé manuellement ({creatorName})
                                      </span>
                                    )}

                                    {pass.final_price !== undefined && pass.final_price !== null && (
                                      <span className="font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md text-[11px] ml-auto">
                                        {Number(pass.final_price).toFixed(2)} TND
                                      </span>
                                    )}
                                  </div>
                                );
                              })()}
                            </div>
                          </div>

                          {/* Action Buttons */}
                          <div className="flex flex-wrap items-center gap-2 flex-shrink-0 mt-3 md:mt-0">
                            {pass.instagram_handle && pass.instagram_handle.startsWith('http') && (
                              <a
                                href={pass.instagram_handle}
                                target="_blank"
                                rel="noreferrer"
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-pink-500 to-rose-500 hover:shadow-lg transition-all"
                              >
                                <ExternalLink size={13}/> IG
                              </a>
                            )}

                            {/* Pending Application (Legacy) */}
                            {pass.entry_status === 'pending' && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleApprove(pass.id)}
                                  className="btn-primary px-3 py-1.5 text-xs bg-green-500 hover:bg-green-600 border-none cursor-pointer"
                                >
                                  Approuver Application
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setRejectModalPass(pass)}
                                  className="btn-ghost px-3 py-1.5 text-xs border border-red-500 text-red-500 cursor-pointer"
                                >
                                  Rejeter
                                </button>
                              </>
                            )}

                            {/* Unpaid Reservation (Quick or Standard awaiting payment) */}
                            {isUnpaid && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleMarkPaid(pass.id)}
                                  className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 shadow-sm transition-all cursor-pointer flex items-center gap-1"
                                  title="Confirmer le paiement physique et envoyer le pass"
                                >
                                  <Check size={14}/> Confirmer Paiement
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleExpirePass(pass.id)}
                                  className="px-3 py-1.5 rounded-xl text-xs font-bold text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 transition-all cursor-pointer"
                                  title="Expirer manuellement cette réservation et libérer le stock"
                                >
                                  Expirer & Restocker
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setRejectModalPass(pass)}
                                  className="btn-ghost px-2.5 py-1.5 text-xs border border-red-500/40 text-red-400 hover:bg-red-500/10 cursor-pointer"
                                  title="Annuler cette réservation"
                                >
                                  Annuler
                                </button>
                              </>
                            )}

                            {/* Paid & Confirmed */}
                            {isPaid && (
                              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 rounded-xl font-bold text-xs">
                                <Check size={14} /> Payé & Confirmé
                              </div>
                            )}

                            {/* Expired status indicator */}
                            {isExpired && (
                              <div className="px-3 py-1.5 bg-red-500/10 text-red-400 border border-red-500/20 rounded-xl font-bold text-xs">
                                Expiré & Restocké
                              </div>
                            )}

                            {/* Permanent Deletion */}
                            <button
                              type="button"
                              onClick={() => {
                                setDeleteModalPass(pass);
                                setDeleteConfirmationInput("");
                                setDeleteError(null);
                              }}
                              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold text-red-400 hover:text-white bg-red-500/10 hover:bg-red-500 border border-red-500/20 hover:border-red-500 transition-all cursor-pointer"
                              title="Supprimer définitivement ce pass"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })()}

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
            const expectedProfileName = ((deleteModalPass as any).profiles?.full_name || (deleteModalPass as any).user?.full_name || '').trim();
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

          {/* ── DRINKS REPORT MODAL (ON-SCREEN & PDF) ── */}
          {mounted && drinksReportModal && (() => {
            const { rows, totalDrinks } = aggregateDrinksReportData(passes, drinksReportModal.eventId);

            return createPortal(
              <div className="fixed inset-0 z-[9999] overflow-y-auto flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
                <div className="relative my-auto bg-white dark:bg-[#151D2A] p-6 sm:p-8 rounded-[2rem] w-full max-w-2xl shadow-2xl border border-purple-500/30 flex flex-col max-h-[90vh]">
                  {/* Header */}
                  <div className="flex items-center justify-between pb-4 border-b border-gray-100 dark:border-neutral-800">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-purple-500/10 flex items-center justify-center text-purple-500 flex-shrink-0">
                        <Wine size={24} />
                      </div>
                      <div>
                        <h3 className="text-xl font-black text-gray-900 dark:text-white">
                          Rapport des boissons
                        </h3>
                        <p className="text-xs text-purple-400 font-bold uppercase tracking-wider">
                          {drinksReportModal.eventTitle}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setDrinksReportModal(null)}
                      className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
                      title="Fermer"
                    >
                      <X size={20} />
                    </button>
                  </div>

                  {/* Summary Metric Cards */}
                  <div className="grid grid-cols-2 gap-3 my-4">
                    <div className="p-4 rounded-2xl bg-neutral-100 dark:bg-[#1A2333] border border-neutral-200 dark:border-[#28354D]">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                        Total Consommations
                      </p>
                      <p className="text-2xl font-black text-emerald-500 mt-1">
                        {totalDrinks}
                      </p>
                    </div>
                    <div className="p-4 rounded-2xl bg-neutral-100 dark:bg-[#1A2333] border border-neutral-200 dark:border-[#28354D]">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                        Combinaisons de Goûts
                      </p>
                      <p className="text-2xl font-black text-purple-400 mt-1">
                        {rows.length}
                      </p>
                    </div>
                  </div>

                  {/* Scrollable Table Area */}
                  <div className="flex-1 overflow-y-auto rounded-2xl border border-neutral-200 dark:border-neutral-800 my-2">
                    <table className="w-full text-left text-sm">
                      <thead className="sticky top-0 bg-neutral-100 dark:bg-[#1E293B] text-xs font-bold uppercase text-neutral-600 dark:text-neutral-300 border-b border-neutral-200 dark:border-neutral-700">
                        <tr>
                          <th className="py-3 px-4">Boisson</th>
                          <th className="py-3 px-4">Arômes / Goûts</th>
                          <th className="py-3 px-4 text-center">Quantité</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                        {rows.length === 0 ? (
                          <tr>
                            <td colSpan={3} className="py-8 text-center text-neutral-400">
                              Aucune boisson réservée pour cet événement.
                            </td>
                          </tr>
                        ) : (
                          rows.map((row, idx) => (
                            <tr key={idx} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/40 transition-colors">
                              <td className="py-3 px-4 font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-purple-400" />
                                <span>{row.drinkName}</span>
                              </td>
                              <td className="py-3 px-4 text-neutral-600 dark:text-neutral-300">
                                {row.aromasDisplay === '-' ? (
                                  <span className="text-neutral-400 dark:text-neutral-500 font-mono text-xs">-</span>
                                ) : (
                                  <div className="flex flex-wrap gap-1">
                                    {row.aromasDisplay.split(', ').map((aroma, aIdx) => (
                                      <span
                                        key={aIdx}
                                        className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-purple-500/10 text-purple-300 border border-purple-500/20"
                                      >
                                        {aroma}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </td>
                              <td className="py-3 px-4 text-center">
                                <span className="inline-flex items-center justify-center min-w-[28px] px-2 py-0.5 rounded-full text-xs font-extrabold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                                  {row.count}
                                </span>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                      {rows.length > 0 && (
                        <tfoot className="bg-neutral-100 dark:bg-[#1A2333] border-t-2 border-neutral-300 dark:border-neutral-700 font-bold text-xs">
                          <tr>
                            <td className="py-3 px-4 text-gray-900 dark:text-white uppercase">Total</td>
                            <td className="py-3 px-4 text-neutral-400">-</td>
                            <td className="py-3 px-4 text-center text-emerald-400 text-sm font-black">
                              {totalDrinks}
                            </td>
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100 dark:border-neutral-800 mt-2">
                    <button
                      type="button"
                      onClick={() => setDrinksReportModal(null)}
                      className="px-4 py-2.5 rounded-xl text-sm font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
                    >
                      Fermer
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDownloadDrinksReport(drinksReportModal.eventId, drinksReportModal.eventTitle)}
                      className="px-5 py-2.5 rounded-xl text-sm font-bold text-neutral-950 bg-gradient-to-r from-teal-400 to-emerald-400 hover:from-teal-300 hover:to-emerald-300 shadow-lg shadow-teal-500/20 transition-all flex items-center gap-2 cursor-pointer font-extrabold"
                    >
                      <Download size={16} />
                      <span>Télécharger le PDF</span>
                    </button>
                  </div>
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
