"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { api, Pass, Event, User } from "@/lib/services/api";
import { useAuth } from "@/lib/context/auth-context";
import { Logo } from "@/components/Logo";
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
  Sparkles
} from "lucide-react";

export default function PaymentPointDashboard() {
  const router = useRouter();
  const { logout: contextLogout } = useAuth();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>("");
  const [passes, setPasses] = useState<Pass[]>([]);
  const [loadingPasses, setLoadingPasses] = useState(false);
  const [approvingPassId, setApprovingPassId] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [errorToast, setErrorToast] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

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

      // Load active events
      const allEvents = await api.getEvents();
      setEvents(allEvents || []);
      if (allEvents && allEvents.length > 0) {
        setSelectedEventId(allEvents[0].id);
      }
    };
    init();
  }, [router, contextLogout]);

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
      setPasses(data);
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

  // Client-side search filter by user Instagram/Email or Pass ID
  const filteredPasses = useMemo(() => {
    if (!searchQuery.trim()) return passes;
    const q = searchQuery.toLowerCase().trim();
    return passes.filter(p => {
      const idMatch = p.id.toLowerCase().includes(q);
      const instaMatch = (p.instagram_handle || '').toLowerCase().includes(q);
      const emailMatch = ((p as any).user_email || '').toLowerCase().includes(q);
      return idMatch || instaMatch || emailMatch;
    });
  }, [passes, searchQuery]);

  const selectedEvent = useMemo(() => {
    return events.find(e => e.id === selectedEventId);
  }, [events, selectedEventId]);

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col selection:bg-amber-500/30 selection:text-amber-200">
      {/* Top Header */}
      <header className="sticky top-0 z-40 border-b border-neutral-800/80 bg-neutral-950/80 backdrop-blur-md px-4 sm:px-6 py-3.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Logo />
            <div className="h-5 w-[1px] bg-neutral-800 hidden sm:block" />
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <Banknote className="w-3.5 h-3.5" />
                Point de Paiement
              </span>
              <span className="text-xs text-neutral-400 hidden md:inline">
                {currentUser?.email}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="p-2 rounded-xl text-neutral-400 hover:text-neutral-100 hover:bg-neutral-900 border border-neutral-800 transition-colors"
              title="Changer de thème"
            >
              {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <button
              onClick={async () => {
                await contextLogout();
                router.replace("/login");
              }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 border border-rose-500/20 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Déconnexion</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex flex-col gap-6">
        {/* Banner / Instructions */}
        <div className="relative overflow-hidden rounded-2xl border border-amber-500/20 bg-gradient-to-r from-amber-500/10 via-neutral-900 to-neutral-900 p-5 sm:p-6 shadow-xl">
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                <Banknote className="w-6 h-6 text-amber-400" />
                Guichet d'Encaissement & Validation
              </h1>
              <p className="text-sm text-neutral-400 mt-1 max-w-2xl">
                Sélectionnez l'événement en cours, recherchez le festivalier ou le numéro de pass, encaissez le montant exact en espèces et validez le pass pour l'activer instantanément.
              </p>
            </div>

            {/* Quick Stats on selected event */}
            <div className="flex items-center gap-3 bg-neutral-950/60 border border-neutral-800 rounded-xl p-3 shrink-0">
              <div className="text-right">
                <p className="text-xs text-neutral-400 font-medium">En attente de paiement</p>
                <p className="text-lg font-bold text-amber-400">{passes.length} pass</p>
              </div>
              <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400">
                <Ticket className="w-5 h-5" />
              </div>
            </div>
          </div>
        </div>

        {/* Floating Toasts */}
        {successToast && (
          <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-sm animate-in fade-in slide-in-from-top-2">
            <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400" />
            <span className="font-medium">{successToast}</span>
          </div>
        )}

        {errorToast && (
          <div className="flex items-center gap-3 p-4 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-sm animate-in fade-in slide-in-from-top-2">
            <AlertCircle className="w-5 h-5 shrink-0 text-rose-400" />
            <span className="font-medium">{errorToast}</span>
          </div>
        )}

        {/* Controls: Event Selector & Search Bar */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
          {/* Event Dropdown */}
          <div className="md:col-span-5 relative">
            <label className="block text-xs font-medium text-neutral-400 mb-1.5 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-neutral-400" />
              Événement Actif
            </label>
            <select
              value={selectedEventId}
              onChange={(e) => setSelectedEventId(e.target.value)}
              className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500/40 transition-colors cursor-pointer"
            >
              {events.length === 0 ? (
                <option value="">Aucun événement disponible</option>
              ) : (
                events.map(ev => (
                  <option key={ev.id} value={ev.id} className="bg-neutral-900 text-white">
                    {ev.title} — {new Date(ev.date).toLocaleDateString('fr-FR')} (Prix de base: {ev.base_price ?? 0} DT)
                  </option>
                ))
              )}
            </select>
          </div>

          {/* Search Box */}
          <div className="md:col-span-6 relative">
            <label className="block text-xs font-medium text-neutral-400 mb-1.5 flex items-center gap-1.5">
              <Search className="w-3.5 h-3.5 text-neutral-400" />
              Recherche festivalier ou ID pass
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-neutral-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Filtrer par @instagram, email ou ID pass..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-neutral-900 border border-neutral-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500/40 transition-colors"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-neutral-400 hover:text-white"
                >
                  Effacer
                </button>
              )}
            </div>
          </div>

          {/* Refresh Button */}
          <div className="md:col-span-1 flex md:items-end h-full">
            <button
              onClick={() => selectedEventId && fetchPendingPasses(selectedEventId)}
              disabled={loadingPasses || !selectedEventId}
              className="w-full md:w-auto mt-auto p-2.5 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 rounded-xl text-neutral-300 hover:text-white transition-colors flex items-center justify-center disabled:opacity-50"
              title="Actualiser la liste"
            >
              <RefreshCw className={`w-4 h-4 ${loadingPasses ? 'animate-spin text-amber-400' : ''}`} />
            </button>
          </div>
        </div>

        {/* Pass List */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between text-xs text-neutral-400 font-medium px-1">
            <span>
              Passes trouvés: <strong className="text-white">{filteredPasses.length}</strong>
              {searchQuery && ` (sur ${passes.length} en attente)`}
            </span>
            {selectedEvent && (
              <span>Prix de base: <strong className="text-amber-400">{selectedEvent.base_price ?? 0} DT</strong></span>
            )}
          </div>

          {loadingPasses ? (
            <div className="flex flex-col items-center justify-center py-20 rounded-2xl border border-neutral-800/80 bg-neutral-900/30">
              <RefreshCw className="w-8 h-8 text-amber-400 animate-spin mb-3" />
              <p className="text-sm text-neutral-400 font-medium">Chargement des passes en attente...</p>
            </div>
          ) : filteredPasses.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 rounded-2xl border border-neutral-800/80 bg-neutral-900/20 text-center px-4">
              <div className="w-12 h-12 rounded-full bg-neutral-900 flex items-center justify-center text-neutral-500 mb-3 border border-neutral-800">
                <Ticket className="w-6 h-6" />
              </div>
              <h3 className="text-base font-semibold text-white">Aucun pass en attente de paiement</h3>
              <p className="text-xs text-neutral-400 mt-1 max-w-sm">
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
                    className="relative rounded-2xl border border-neutral-800 bg-neutral-900/60 p-5 flex flex-col justify-between hover:border-neutral-700/80 transition-all hover:shadow-lg group"
                  >
                    <div>
                      {/* Header Card */}
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 font-bold text-sm">
                            <UserIcon className="w-4 h-4" />
                          </div>
                          <div>
                            <h4 className="text-sm font-bold text-white truncate max-w-[170px]">
                              {pass.instagram_handle || 'Client Inconnu'}
                            </h4>
                            <p className="text-xs text-neutral-400 truncate max-w-[170px]">
                              {(pass as any).user_email || `ID: ${pass.id.slice(0, 8)}...`}
                            </p>
                          </div>
                        </div>

                        {/* Status Badge */}
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30 shrink-0">
                          <Clock className="w-3 h-3" />
                          À encaisser
                        </span>
                      </div>

                      {/* Details Box */}
                      <div className="bg-neutral-950/70 rounded-xl p-3 border border-neutral-800/80 space-y-2 mb-4">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-neutral-400">Pass ID</span>
                          <span className="font-mono text-neutral-300 font-medium">#{pass.id.slice(0, 8)}</span>
                        </div>

                        {hasPromo && (
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-neutral-400 flex items-center gap-1">
                              <Sparkles className="w-3 h-3 text-amber-400" />
                              Code Promo
                            </span>
                            <span className="font-mono text-amber-400 font-semibold bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                              {pass.promo_used}
                            </span>
                          </div>
                        )}

                        {pass.drink_menus && (
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-neutral-400">Consommation</span>
                            <span className="text-neutral-200 font-medium truncate max-w-[140px]">
                              {pass.drink_menus.name}
                            </span>
                          </div>
                        )}

                        <div className="pt-2 border-t border-neutral-800/80 flex items-center justify-between">
                          <span className="text-xs font-semibold text-neutral-300">Montant à encaisser :</span>
                          <span className="text-lg font-black text-amber-400 tracking-tight">
                            {finalPrice} DT
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Single Primary Action Button: Approve Payment (NO REJECT ALLOWED) */}
                    <div>
                      <button
                        onClick={() => handleApprovePayment(pass)}
                        disabled={isApproving}
                        className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-bold text-sm bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-neutral-950 shadow-lg shadow-emerald-500/20 transition-all active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
                      >
                        {isApproving ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            <span>Validation en cours...</span>
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="w-4 h-4" />
                            <span>Approuver le Paiement ({finalPrice} DT)</span>
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
    </div>
  );
}
