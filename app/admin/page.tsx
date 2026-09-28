"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { api, Pass, User, Event } from "../../lib/services/api";
import { useAuth } from "@/lib/context/auth-context";
import { Logo } from "@/components/Logo";
import { Sun, Moon, LogOut, LayoutDashboard, CalendarDays, Users, CheckSquare, Plus, Trash2, Pencil, X, ExternalLink, Check, DollarSign } from "lucide-react";

export default function AdminDashboard() {
  const router = useRouter();
  const { logout: contextLogout } = useAuth();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [activeTab, setActiveTab] = useState("dashboard");

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
  const [newDrinks, setNewDrinks] = useState<{name: string}[]>([]);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);

  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserInsta, setNewUserInsta] = useState("");
  const [newUserRole, setNewUserRole] = useState("user");
  const [userMsg, setUserMsg] = useState("");

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
      if (!user || user.role !== 'admin') { router.push("/login"); return; }
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
    const validDrinks = newDrinks.filter(d => d.name.trim() !== "");
    if (editingEventId) {
      await api.updateEvent(editingEventId, newTitle, new Date(newDate).toISOString(), newLocation, false, newMax, newImageUrl, validDrinks);
    } else {
      await api.createEvent(newTitle, new Date(newDate).toISOString(), newLocation, false, newMax, newImageUrl, validDrinks);
    }
    cancelEdit();
    await fetchData();
  };

  const cancelEdit = () => {
    setEditingEventId(null);
    setNewTitle(""); setNewDate(""); setNewLocation(""); setNewMax(1); setNewImageUrl(""); setNewDrinks([]);
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
    setNewDrinks(event.drink_menus?.map(d => ({name: d.name})) || []);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleRoleChange = async (userId: string, newRole: string) => { await api.updateRole(userId, newRole); await fetchData(); };

  const handleDeleteUser = async (userId: string) => {
    if (confirm("Supprimer définitivement cet utilisateur et tous ses passes ?")) {
      try { await api.deleteUser(userId); await fetchData(); }
      catch (err: any) { alert("Erreur: " + err.message); }
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setUserMsg("Création en cours...");
    try {
      if (!newUserInsta.startsWith('@') || newUserInsta.length < 2) { setUserMsg("Le pseudo Instagram doit commencer par @"); return; }
      await api.adminCreateUser(newUserEmail, newUserPassword, newUserInsta, newUserRole);
      setUserMsg("✓ Compte créé avec succès");
      setNewUserEmail(""); setNewUserPassword(""); setNewUserInsta(""); setNewUserRole("user");
      await fetchData();
      setTimeout(() => setUserMsg(""), 3000);
    } catch (err: any) { setUserMsg("Erreur: " + err.message); }
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

  const navItems = [
    { id: 'dashboard', label: 'Tableau de bord', icon: <LayoutDashboard size={20} /> },
    { id: 'events',    label: 'Événements',       icon: <CalendarDays size={20} /> },
    { id: 'staff',     label: 'Utilisateurs',      icon: <Users size={20} /> },
    { id: 'passes',    label: 'Approbations',      icon: <CheckSquare size={20} /> },
  ];

  const statCards = [
    { label: "Chiffre d'affaires", value: `${stats.revenue} DA`, color: 'bg-passi-turquoise', icon: <DollarSign size={20} className="text-white" /> },
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
                onClick={() => setActiveTab(id)}
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
            onClick={() => setActiveTab(id)}
            className={`flex flex-col items-center gap-1 ${activeTab === id ? 'text-passi-corail' : 'text-gray-400'}`}
          >
            {icon}
            <span className="text-[10px] font-bold">{label}</span>
          </button>
        ))}
      </nav>

      {/* ─── MAIN ─── */}
      <main className="flex-1 overflow-y-auto hide-scrollbar pb-24 md:pb-0">
        <div className="max-w-5xl mx-auto p-6 md:p-10 space-y-8 animate-fade-in-up">

          {/* Header */}
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-bold tracking-widest uppercase text-passi-corail mb-1">Passi Admin</p>
              <h1 className="text-3xl font-extrabold capitalize" style={{ color: 'var(--text-primary)' }}>
                {navItems.find(n => n.id === activeTab)?.label}
              </h1>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-passi-corail flex items-center justify-center text-white font-bold text-sm">A</div>
              <div>
                <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Admin</p>
                <p className="text-xs text-passi-turquoise font-semibold">● En ligne</p>
              </div>
            </div>
          </div>

          {/* ── DASHBOARD TAB ── */}
          {activeTab === 'dashboard' && (
            <div className="space-y-8">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
                {statCards.map((s, i) => (
                  <div key={i} className="card p-5 flex items-center gap-4 shadow-sm">
                    <div className={`w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 ${s.color}`}>{s.icon}</div>
                    <div>
                      <p className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>{s.label}</p>
                      <p className="text-2xl font-extrabold" style={{ color: 'var(--text-primary)' }}>{s.value}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Chart */}
              <div className="card p-8 shadow-sm">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Activité des passes</h3>
                  <span className="badge bg-passi-turquoise/15 text-passi-turquoise">+14% cette semaine</span>
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
          {activeTab === 'events' && (
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
          {activeTab === 'staff' && (
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
              <div className="lg:col-span-2 card p-7 shadow-sm self-start">
                <h3 className="text-lg font-bold mb-6" style={{ color: 'var(--text-primary)' }}>Créer un compte</h3>
                <form onSubmit={handleCreateUser} className="space-y-4">
                  {[
                    { label:"Email", type:"email", val:newUserEmail, set:setNewUserEmail, ph:"admin@passi.com" },
                    { label:"Mot de passe", type:"password", val:newUserPassword, set:setNewUserPassword, ph:"••••••••" },
                    { label:"Instagram (@)", type:"text", val:newUserInsta, set:setNewUserInsta, ph:"@pseudo" },
                  ].map(f => (
                    <div key={f.label}>
                      <label className="label">{f.label}</label>
                      <input type={f.type} required value={f.val} placeholder={f.ph} onChange={e => f.set(e.target.value)} className="input"/>
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
                  <button type="submit" className="btn-primary w-full">Créer le membre</button>
                  {userMsg && (
                    <p className={`text-xs font-semibold px-3 py-2 rounded-xl ${userMsg.startsWith('✓') ? 'bg-passi-turquoise/10 text-passi-turquoise' : 'bg-passi-corail/10 text-passi-corail'}`}>{userMsg}</p>
                  )}
                </form>
              </div>

              <div className="lg:col-span-3 card p-7 shadow-sm">
                <h3 className="text-lg font-bold mb-6" style={{ color: 'var(--text-primary)' }}>Annuaire & Permissions</h3>
                <div className="space-y-3 max-h-[600px] overflow-y-auto hide-scrollbar">
                  {profiles.map(p => (
                    <div key={p.id} className="flex justify-between items-center p-4 rounded-2xl transition-colors" style={{ backgroundColor: 'var(--bg-input)', border: '1.5px solid var(--border)' }}>
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-passi-corail to-orange-400 flex items-center justify-center text-white font-bold text-sm uppercase">
                          {p.email[0]}
                        </div>
                        <div>
                          <p className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>{p.email}</p>
                          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{p.instagram_handle}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
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
          {activeTab === 'passes' && (
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
                            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>@{pass.instagram_handle?.replace('@','')}</p>
                            <span className={`badge mt-1 ${sc.bg} ${sc.color}`}>{sc.label}</span>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <a
                            href={`https://instagram.com/${pass.instagram_handle?.replace('@','')}`}
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

        </div>
      </main>
    </div>
  );
}
