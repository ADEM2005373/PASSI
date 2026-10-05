"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { api, Pass, User, Event } from "@/lib/services/api";
import { useAuth } from "@/lib/context/auth-context";
import { Logo } from "@/components/Logo";
import { Sun, Moon, LogOut, LayoutDashboard, CalendarDays, Users, CheckSquare, Plus, Trash2, Pencil, X, ExternalLink, Check, DollarSign, Download, User as UserIcon } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export default function AdminDashboard() {
  const router = useRouter();
  const { user, logout: contextLogout } = useAuth();
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
  const [newDrinks, setNewDrinks] = useState<{name: string}[]>([]);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);

  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserInsta, setNewUserInsta] = useState("");
  const [newUserRole, setNewUserRole] = useState("user");
  const [userMsg, setUserMsg] = useState("");

  const [adminFullName, setAdminFullName] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [isSavingAdmin, setIsSavingAdmin] = useState(false);
  const [adminMsg, setAdminMsg] = useState("");

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

  useEffect(() => {
    setMounted(true);
    const init = async () => {
      const user = await api.getCurrentUser();
      if (!user || user.role !== 'admin') { router.replace("/staff/login"); return; }
      
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

  const handleApprove = async (passId: string) => { await api.approvePass(passId); await fetchData(); };
  const handleMarkPaid = async (passId: string) => { await api.markPassPaid(passId); await fetchData(); };

  const handleSaveEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (new Date(newDate).getTime() < Date.now()) {
      alert("La date de l'événement doit être supérieure à la date d'aujourd'hui.");
      return;
    }
    const validDrinks = newDrinks.filter(d => d.name.trim() !== "");
    if (editingEventId) {
      await api.updateEvent(editingEventId, newTitle, new Date(newDate).toISOString(), newLocation, false, newMax, newImageUrl, newDescription, newDressCode, validDrinks);
    } else {
      await api.createEvent(newTitle, new Date(newDate).toISOString(), newLocation, false, newMax, newImageUrl, newDescription, newDressCode, validDrinks);
    }
    cancelEdit();
    await fetchData();
  };

  const cancelEdit = () => {
    setEditingEventId(null);
    setNewTitle(""); setNewDate(""); setNewLocation(""); setNewMax(1); setNewImageUrl(""); setNewDescription(""); setNewDressCode(""); setNewDrinks([]);
  };

  const handleDeleteEvent = async (eventId: string) => {
    if (confirm("Supprimer définitivement cet événement et tous ses passes ?")) {
      try { await api.deleteEvent(eventId); if (editingEventId === eventId) cancelEdit(); await fetchData(); }
      catch (err: any) { alert("Erreur: " + err.message); }
    }
  };

  const handleEditClick = (event: Event) => {
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
    setNewDrinks(event.drink_menus?.map(d => ({name: d.name})) || []);
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
    { id: 'utilisateurs',     label: 'Utilisateurs',      icon: <Users size={20} /> },
    { id: 'approbations',    label: 'Approbations',      icon: <CheckSquare size={20} /> },
    { id: 'profil',          label: 'Mon Profil',        icon: <UserIcon size={20} /> },
  ];

  useEffect(() => {
    const pathParts = window.location.pathname.split('/');
    const tabName = pathParts[2]; // /admin/[tabName]
    if (tabName && navItems.some(n => n.id === tabName)) {
      setActiveTab(tabName);
    } else {
      setActiveTab('dashboard');
    }
  }, []);

  const handleTabClick = (id: string) => {
    setActiveTab(id);
    const newPath = id === 'dashboard' ? '/admin' : `/admin/${id}`;
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
                      <div className="px-4 py-2 text-xs text-gray-500 uppercase font-bold border-y border-gray-100 dark:border-gray-800 mt-1">Passer en</div>
                      <button onClick={() => { document.cookie = "passi_impersonate_role=user; path=/;"; window.location.href = "/dashboard"; }} className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-passi-surface/20">Utilisateur</button>
                      <button onClick={() => { document.cookie = "passi_impersonate_role=barman; path=/;"; window.location.href = "/scanner/barman"; }} className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-passi-surface/20">Barman</button>
                      <button onClick={() => { document.cookie = "passi_impersonate_role=security; path=/;"; window.location.href = "/scanner/security"; }} className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-passi-surface/20">Sécurité</button>
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
                      <input type={f.type} required={f.required} value={f.val} placeholder={f.placeholder || ''} onChange={e => f.set(e.target.value)} className="input" />
                    </div>
                  ))}
                  <div>
                    <label className="label">Max passes / utilisateur</label>
                    <input type="number" min="1" max="10" required value={newMax} onChange={e => setNewMax(parseInt(e.target.value))} className="input" />
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
                    <input type="url" value={newImageUrl} onChange={e => setNewImageUrl(e.target.value)} placeholder="https://..." className="input" />
                  </div>

                  {/* Drinks */}
                  <div className="p-4 rounded-xl" style={{ backgroundColor: 'var(--bg-input)', border: '1.5px solid var(--border)' }}>
                    <label className="label">Menu boissons (optionnel)</label>
                    {newDrinks.map((drink, index) => (
                      <div key={index} className="flex gap-2 mb-2">
                        <input type="text" placeholder="Ex: Vodka Redbull" value={drink.name}
                          onChange={e => { const u=[...newDrinks]; u[index].name=e.target.value; setNewDrinks(u); }}
                          className="input flex-1 text-sm"
                        />
                        <button type="button" onClick={() => setNewDrinks(newDrinks.filter((_,i)=>i!==index))} className="p-2.5 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors">
                          <X size={16}/>
                        </button>
                      </div>
                    ))}
                    <button type="button" onClick={() => setNewDrinks([...newDrinks, {name:""}])} className="flex items-center gap-2 text-sm font-bold text-passi-turquoise hover:text-passi-turquoise/80 mt-2">
                      <Plus size={16}/> Ajouter une boisson
                    </button>
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
                        <h4 className="font-bold text-base" style={{ color: 'var(--text-primary)' }}>{ev.title}</h4>
                        <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>{ev.location}</p>
                        <p className="text-xs mt-1 font-semibold text-passi-turquoise">
                          {new Date(ev.date).toLocaleDateString('fr-FR', { day:'numeric', month:'long', year:'numeric' })} · {new Date(ev.date).toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit' })}
                        </p>
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
                          <option value="security">Sécurité</option>
                          <option value="barman">Barman</option>
                        </select>
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

          {/* ── PASSES TAB ── */}
          {activeTab === 'approbations' && (
            <div className="card p-7 shadow-sm">
              <h3 className="text-lg font-bold mb-6" style={{ color: 'var(--text-primary)' }}>Approbation des passes</h3>
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
                    };
                    const sc = statusConfig[pass.entry_status] || { color: 'text-gray-500', bg: 'bg-gray-500/10', label: pass.entry_status };
                    return (
                      <div key={pass.id} className="p-5 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 transition-colors" style={{ backgroundColor: 'var(--bg-input)', border: '1.5px solid var(--border)' }}>
                        <div className="flex items-center gap-4">
                          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl font-bold ${sc.bg} ${sc.color}`}>
                            {pass.entry_status === 'pending' ? '!' : pass.entry_status === 'awaiting_payment' ? '$' : '✓'}
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
                            <button onClick={() => handleApprove(pass.id)} className="btn-ghost px-4 py-2 text-sm">Approuver</button>
                          )}
                          {pass.entry_status === 'awaiting_payment' && (
                            <button onClick={() => handleMarkPaid(pass.id)} className="px-4 py-2 rounded-xl text-sm font-bold text-white bg-passi-turquoise hover:bg-passi-turquoise/90 transition-all">
                              Activer le pass
                            </button>
                          )}
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

        </div>
      </main>
    </div>
  );
}
