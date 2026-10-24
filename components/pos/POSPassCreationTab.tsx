'use client';

import { useState, useEffect, useMemo } from 'react';
import { Event, DrinkItem } from '@/lib/services/api';
import { 
  Sparkles, 
  CheckCircle2, 
  Ticket, 
  User, 
  Mail, 
  Phone, 
  Wine, 
  Copy, 
  Check, 
  ExternalLink, 
  Share2, 
  Plus, 
  Minus, 
  Banknote, 
  AlertCircle,
  Calendar
} from 'lucide-react';

interface POSPassCreationTabProps {
  eventId?: string;
  posName?: string;
  events?: Event[];
  onPassCreated?: (passResult: any) => void;
}

export function POSPassCreationTab({ 
  eventId = '', 
  posName = 'Guichet Point de Vente',
  events = [],
  onPassCreated 
}: POSPassCreationTabProps) {
  const [selectedEvId, setSelectedEvId] = useState<string>(eventId || (events[0]?.id ?? ''));

  // Update selected event if prop changes
  useEffect(() => {
    if (eventId) {
      setSelectedEvId(eventId);
    } else if (!selectedEvId && events.length > 0) {
      setSelectedEvId(events[0].id);
    }
  }, [eventId, events, selectedEvId]);

  const currentEvent = events.find((e) => e.id === selectedEvId) || events[0];
  const defaultEventPrice = Number(currentEvent?.base_price ?? 35);

  // ─── EVENT DRINKS STATE & DYNAMIC LOADING ───
  const [fetchedDrinks, setFetchedDrinks] = useState<DrinkItem[]>([]);
  const [loadingDrinks, setLoadingDrinks] = useState(false);

  useEffect(() => {
    if (!selectedEvId) {
      setFetchedDrinks([]);
      return;
    }

    const evt = events.find((e) => e.id === selectedEvId);
    const existing = (evt?.drink_menus && evt.drink_menus.length > 0)
      ? evt.drink_menus
      : (Array.isArray(evt?.drinks) && evt.drinks.length > 0 ? evt.drinks : null);

    if (existing) {
      setFetchedDrinks(existing);
      return;
    }

    // Dynamic fallback fetch from Supabase
    let active = true;
    setLoadingDrinks(true);
    import('@/lib/supabase/client').then(({ createClient }) => {
      const supabase = createClient();
      supabase
        .from('drink_menus')
        .select('*')
        .eq('event_id', selectedEvId)
        .then((res: any) => {
          if (!active) return;
          setLoadingDrinks(false);
          if (!res.error && res.data && res.data.length > 0) {
            setFetchedDrinks(res.data);
          } else {
            setFetchedDrinks([]);
          }
        })
        .catch(() => {
          if (active) setLoadingDrinks(false);
        });
    });

    return () => {
      active = false;
    };
  }, [selectedEvId, events]);

  const availableDrinks: DrinkItem[] = useMemo(() => {
    if (fetchedDrinks.length > 0) return fetchedDrinks;
    const evt = events.find((e) => e.id === selectedEvId);
    if (evt?.drink_menus && evt.drink_menus.length > 0) return evt.drink_menus;
    if (Array.isArray(evt?.drinks) && evt.drinks.length > 0) return evt.drinks;
    return [];
  }, [fetchedDrinks, events, selectedEvId]);

  // Selected Drink & Aromas
  const [selectedDrinkName, setSelectedDrinkName] = useState<string>('');
  const [selectedAromas, setSelectedAromas] = useState<string[]>([]);
  const [customDrinkFallback, setCustomDrinkFallback] = useState<string>('');

  // Automatically update selected drink when event changes
  useEffect(() => {
    if (availableDrinks.length > 0) {
      const first = availableDrinks[0].name;
      setSelectedDrinkName(first);
      setSelectedAromas([]);
    } else {
      setSelectedDrinkName('');
      setSelectedAromas([]);
    }
  }, [selectedEvId, availableDrinks]);

  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    quantity: 1,
    totalPrice: defaultEventPrice,
  });

  // Automatically update price when event or quantity changes
  useEffect(() => {
    const base = Number(currentEvent?.base_price ?? 35);
    setFormData((prev) => ({
      ...prev,
      totalPrice: base * prev.quantity,
    }));
  }, [selectedEvId, currentEvent]);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState('');
  const [createdResult, setCreatedResult] = useState<{
    reservationCode: string;
    webPassUrl: string;
    totalPrice: number;
    count: number;
    pass: any;
  } | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  const handleQuantityChange = (newQty: number) => {
    const safeQty = Math.max(1, Math.min(10, newQty));
    const base = Number(currentEvent?.base_price ?? 35);
    setFormData((prev) => ({
      ...prev,
      quantity: safeQty,
      totalPrice: base * safeQty,
    }));
  };

  const handleSelectDrink = (drinkName: string) => {
    setSelectedDrinkName(drinkName);
    setSelectedAromas([]);
  };

  const handleToggleAroma = (aroma: string) => {
    setSelectedAromas((prev) => {
      const exists = prev.includes(aroma);
      return exists ? prev.filter((a) => a !== aroma) : [...prev, aroma];
    });
  };

  const handleCopy = (text: string, type: 'link' | 'code') => {
    navigator.clipboard.writeText(text);
    if (type === 'link') {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 3000);
    } else {
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 3000);
    }
  };

  const handleReset = () => {
    setSuccessMsg('');
    setCreatedResult(null);
    setErrorMsg(null);
    const base = Number(currentEvent?.base_price ?? 35);
    setFormData({
      fullName: '',
      email: '',
      phone: '',
      quantity: 1,
      totalPrice: base,
    });
    if (availableDrinks.length > 0) {
      setSelectedDrinkName(availableDrinks[0].name);
    } else {
      setSelectedDrinkName('');
    }
    setSelectedAromas([]);
    setCustomDrinkFallback('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg('');

    try {
      if (!selectedEvId) {
        throw new Error('Veuillez sélectionner un événement.');
      }

      if (!formData.fullName.trim()) {
        throw new Error('Le nom complet du client est obligatoire.');
      }

      if (!formData.email.trim() || !formData.email.includes('@')) {
        throw new Error('Une adresse email valide est obligatoire pour envoyer le pass.');
      }

      const effectiveDrink = selectedDrinkName || customDrinkFallback.trim();
      if (availableDrinks.length > 0 && !effectiveDrink) {
        throw new Error('Veuillez sélectionner une boisson parmi la carte de l\'événement.');
      }

      const formattedSelectedDrink = effectiveDrink
        ? (selectedAromas.length > 0 ? `${effectiveDrink} (${selectedAromas.join(', ')})` : effectiveDrink)
        : undefined;

      const res = await fetch('/api/pos/passes/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId: selectedEvId,
          userName: formData.fullName.trim(),
          fullName: formData.fullName.trim(),
          userEmail: formData.email.trim(),
          email: formData.email.trim(),
          phone: formData.phone.trim() || undefined,
          drinkName: effectiveDrink || undefined,
          selectedDrink: formattedSelectedDrink,
          aromas: selectedAromas,
          selectedAromas: selectedAromas,
          totalPrice: Number(formData.totalPrice),
          quantity: Number(formData.quantity),
          posLocation: posName,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Erreur lors de la création du pass');
      }

      setSuccessMsg(data.message || 'Pass créé, payé et validé avec succès ! QR code prêt.');
      setCreatedResult({
        reservationCode: data.reservationCode,
        webPassUrl: data.webPassUrl,
        totalPrice: Number(data.totalPrice || formData.totalPrice),
        count: Number(data.count || formData.quantity),
        pass: data.pass,
      });

      // Notify parent to refresh KPIs immediately
      if (onPassCreated) {
        onPassCreated(data);
      }
    } catch (err: any) {
      console.error('POS pass creation error:', err);
      setErrorMsg(err.message || 'Erreur lors de la communication avec le serveur.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in duration-200">
      
      {/* Header Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-purple-900/30 via-indigo-900/20 to-purple-900/30 border border-purple-500/30 dark:border-purple-500/20 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30 mb-2">
            <Sparkles className="w-3.5 h-3.5 text-purple-400" />
            <span>Guichet · Émission Directe Sans Compte</span>
          </div>
          <h3 className="text-xl font-black text-neutral-900 dark:text-white flex items-center gap-2">
            🎟️ Émission Rapide de Pass (Point de Vente)
          </h3>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
            Création, encaissement espèces et activation instantanée pour les clients au guichet physique.
          </p>
        </div>

        <div className="px-3.5 py-2 rounded-xl bg-purple-500/10 border border-purple-500/25 text-purple-700 dark:text-purple-300 text-xs font-semibold shrink-0">
          📍 {posName}
        </div>
      </div>

      {/* Success Notification & Web Pass Display */}
      {createdResult && (
        <div className="p-6 rounded-2xl bg-emerald-950/20 border-2 border-emerald-500/40 text-neutral-900 dark:text-white shadow-xl space-y-5 animate-in zoom-in-95 duration-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/30">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-bold text-base text-emerald-600 dark:text-emerald-400">
                {successMsg}
              </h4>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                Le pass est automatiquement marqué <strong>PAYÉ</strong> et <strong>APPROUVÉ</strong>. Les métriques de votre tiroir de caisse ont été mises à jour.
              </p>
            </div>
          </div>

          {/* Quick Share & Codes Box */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            
            {/* Box 1: Reference Code */}
            <div className="p-4 rounded-xl bg-neutral-900 border border-neutral-800 space-y-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                Code de Réservation
              </span>
              <div className="flex items-center justify-between">
                <span className="text-2xl font-black font-mono text-[#FF6B5E] tracking-wider">
                  {createdResult.reservationCode}
                </span>
                <button
                  type="button"
                  onClick={() => handleCopy(createdResult.reservationCode, 'code')}
                  className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-all cursor-pointer text-xs flex items-center gap-1.5"
                  title="Copier le code"
                >
                  {copiedCode ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedCode ? 'Copié' : 'Copier'}</span>
                </button>
              </div>
              <p className="text-[11px] text-neutral-400">
                Total encaissé : <strong className="text-white font-mono">{createdResult.totalPrice.toFixed(2)} TND</strong> ({createdResult.count} billet{createdResult.count > 1 ? 's' : ''})
              </p>
            </div>

            {/* Box 2: Shareable Web Pass URL */}
            <div className="p-4 rounded-xl bg-neutral-900 border border-neutral-800 space-y-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                Pass Web & QR Code Dynamique
              </span>
              <div className="flex items-center gap-2">
                <a
                  href={createdResult.webPassUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-md shadow-emerald-900/20 cursor-pointer truncate"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Ouvrir le Pass Web</span>
                </a>
                <button
                  type="button"
                  onClick={() => handleCopy(createdResult.webPassUrl, 'link')}
                  className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-all cursor-pointer"
                  title="Copier l'URL du pass"
                >
                  {copiedLink ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[11px] text-neutral-400 truncate">
                Lien client : <span className="font-mono text-neutral-300">{createdResult.webPassUrl}</span>
              </p>
            </div>

          </div>

          {/* Action Row */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-emerald-500/20">
            <a
              href={`https://wa.me/?text=${encodeURIComponent(`Bonjour ! Voici votre Pass officiel Passi pour l'événement : ${createdResult.webPassUrl}`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 text-xs font-bold inline-flex items-center gap-2 transition-all cursor-pointer"
            >
              <Share2 className="w-4 h-4" />
              <span>Transférer sur WhatsApp</span>
            </a>

            <button
              type="button"
              onClick={handleReset}
              className="px-5 py-2 rounded-xl bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 hover:opacity-90 font-bold text-xs inline-flex items-center gap-2 transition-all cursor-pointer shadow-sm ml-auto"
            >
              <Plus className="w-4 h-4" />
              <span>Émettre un autre Pass</span>
            </button>
          </div>
        </div>
      )}

      {/* Main Creation Form (Only displayed when no pass just created, or can create again) */}
      {!createdResult && (
        <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl p-6 sm:p-8 text-neutral-900 dark:text-white shadow-xs">
          
          {errorMsg && (
            <div className="mb-6 p-4 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/25 text-rose-700 dark:text-rose-400 text-xs sm:text-sm flex items-center gap-2.5 animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            
            {/* Event Selection */}
            {events.length > 0 && (
              <div>
                <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1.5 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-purple-500" />
                  Événement concerné *
                </label>
                <select
                  value={selectedEvId}
                  onChange={(e) => setSelectedEvId(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-xl px-4 py-2.5 text-neutral-900 dark:text-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-purple-500/40 transition cursor-pointer"
                >
                  {events.map((ev) => (
                    <option key={ev.id} value={ev.id} className="bg-white dark:bg-neutral-900">
                      {ev.title} — {new Date(ev.date).toLocaleDateString('fr-FR')} (Prix de base: {ev.base_price ?? 35} TND)
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Customer Full Name */}
            <div>
              <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1.5 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-purple-500" />
                Nom complet du client *
              </label>
              <input
                type="text"
                required
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                className="w-full bg-gray-50 dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-xl px-4 py-2.5 text-neutral-900 dark:text-white text-sm placeholder-neutral-400 dark:placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-purple-500/40 transition"
                placeholder="Ex: Mohamed Ben Salah"
              />
            </div>

            {/* Customer Email & Phone */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1.5 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-purple-500" />
                  Email (pour recevoir le QR Code) *
                </label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full bg-gray-50 dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-xl px-4 py-2.5 text-neutral-900 dark:text-white text-sm placeholder-neutral-400 dark:placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-purple-500/40 transition"
                  placeholder="client@email.com"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1.5 flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-neutral-400" />
                  Numéro de Téléphone (optionnel)
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full bg-gray-50 dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-xl px-4 py-2.5 text-neutral-900 dark:text-white text-sm placeholder-neutral-400 dark:placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-purple-500/40 transition"
                  placeholder="Ex: +216 98 123 456"
                />
              </div>
            </div>

            {/* ─── EVENT DRINKS SELECTOR (STRICTLY FROM EVENT DRINK MENU) ─── */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300 flex items-center gap-1.5">
                  <Wine className="w-3.5 h-3.5 text-purple-500" />
                  <span>Boisson incluse avec le Pass *</span>
                </label>
                {availableDrinks.length > 0 && (
                  <span className="text-[11px] text-purple-600 dark:text-purple-400 font-semibold">
                    {availableDrinks.length} boisson(s) sur la carte de l'événement
                  </span>
                )}
              </div>

              {loadingDrinks ? (
                <div className="p-4 rounded-xl bg-gray-50 dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 flex items-center gap-2 text-xs text-neutral-400">
                  <div className="w-3.5 h-3.5 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                  <span>Chargement des boissons de l'événement...</span>
                </div>
              ) : availableDrinks.length > 0 ? (
                <div className="space-y-3">
                  
                  {/* Selectable Drink Cards Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                    {availableDrinks.map((drink, idx) => {
                      const isSelected = selectedDrinkName === drink.name;
                      const hasAromas = drink.aromas && Array.isArray(drink.aromas) && drink.aromas.length > 0;

                      return (
                        <button
                          key={drink.id || `drink-${idx}`}
                          type="button"
                          onClick={() => handleSelectDrink(drink.name)}
                          className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-1.5 ${
                            isSelected
                              ? "bg-purple-500/15 border-purple-500 text-purple-900 dark:text-white shadow-sm ring-1 ring-purple-500/30"
                              : "bg-gray-50 dark:bg-neutral-800/60 border-gray-200 dark:border-neutral-700/80 text-neutral-700 dark:text-neutral-300 hover:border-purple-400/50"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-bold text-xs sm:text-sm flex items-center gap-1.5 truncate">
                              🍹 {drink.name}
                            </span>
                            {isSelected ? (
                              <CheckCircle2 className="w-4 h-4 text-purple-500 shrink-0" />
                            ) : (
                              <div className="w-4 h-4 rounded-full border border-gray-300 dark:border-neutral-600 shrink-0" />
                            )}
                          </div>

                          {hasAromas && (
                            <span className="text-[10px] text-neutral-500 dark:text-neutral-400">
                              {drink.aromas!.length} parfum{drink.aromas!.length > 1 ? 's' : ''} au choix
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* Aromas Selection (if selected drink has aroma options) */}
                  {(() => {
                    const activeDrinkObj = availableDrinks.find((d) => d.name === selectedDrinkName);
                    if (!activeDrinkObj?.aromas || !Array.isArray(activeDrinkObj.aromas) || activeDrinkObj.aromas.length === 0) return null;

                    return (
                      <div className="p-3.5 rounded-xl bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800/40 space-y-2 animate-in fade-in">
                        <span className="text-[11px] font-bold text-purple-800 dark:text-purple-300 block">
                          🍃 Parfums / Arômes disponibles pour <strong>{selectedDrinkName}</strong> (sélectionnez au choix) :
                        </span>
                        <div className="flex flex-wrap gap-2">
                          {activeDrinkObj.aromas.map((aroma: string) => {
                            const isAromaSelected = selectedAromas.includes(aroma);
                            return (
                              <button
                                key={aroma}
                                type="button"
                                onClick={() => handleToggleAroma(aroma)}
                                className={`px-3 py-1 rounded-lg text-xs font-semibold border transition cursor-pointer flex items-center gap-1 ${
                                  isAromaSelected
                                    ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                                    : 'bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border-gray-200 dark:border-neutral-700 hover:border-purple-400'
                                }`}
                              >
                                <span>{aroma}</span>
                                <span className="text-[10px]">{isAromaSelected ? '✓' : '+'}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}

                </div>
              ) : (
                /* Fallback if event has no drinks configured in database */
                <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs space-y-2">
                  <p className="font-semibold">
                    ℹ️ Aucune carte de boisson n'est spécifiquement configurée pour cet événement.
                  </p>
                  <input
                    type="text"
                    value={customDrinkFallback}
                    onChange={(e) => setCustomDrinkFallback(e.target.value)}
                    placeholder="Optionnel : Boisson libre ou sans boisson..."
                    className="w-full bg-white dark:bg-neutral-800 border border-amber-500/30 rounded-lg px-3 py-1.5 text-xs text-neutral-900 dark:text-white placeholder-neutral-500 focus:outline-none focus:border-amber-400"
                  />
                </div>
              )}
            </div>

            {/* Quantity Stepper & Price Calculation */}
            <div className="p-4 rounded-xl bg-gray-50 dark:bg-neutral-800/60 border border-gray-200 dark:border-neutral-700/80 grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
              
              {/* Quantity Stepper */}
              <div>
                <label className="block text-xs font-bold text-neutral-600 dark:text-neutral-400 mb-1.5">
                  Nombre de Passes
                </label>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => handleQuantityChange(formData.quantity - 1)}
                    disabled={formData.quantity <= 1}
                    className="w-9 h-9 rounded-lg bg-gray-200 dark:bg-neutral-700 hover:bg-gray-300 dark:hover:bg-neutral-600 disabled:opacity-40 flex items-center justify-center font-bold text-neutral-800 dark:text-white transition cursor-pointer"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="font-mono text-lg font-black w-8 text-center">
                    {formData.quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleQuantityChange(formData.quantity + 1)}
                    disabled={formData.quantity >= 10}
                    className="w-9 h-9 rounded-lg bg-gray-200 dark:bg-neutral-700 hover:bg-gray-300 dark:hover:bg-neutral-600 disabled:opacity-40 flex items-center justify-center font-bold text-neutral-800 dark:text-white transition cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                  <span className="text-xs text-neutral-500 dark:text-neutral-400 ml-1">
                    ({currentEvent?.base_price ?? 35} TND / pass)
                  </span>
                </div>
              </div>

              {/* Total Price (Editable) */}
              <div>
                <label className="block text-xs font-bold text-neutral-600 dark:text-neutral-400 mb-1.5 flex items-center gap-1.5">
                  <Banknote className="w-3.5 h-3.5 text-emerald-500" />
                  Montant Total Encaissé (TND) *
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    required
                    value={formData.totalPrice}
                    onChange={(e) => setFormData({ ...formData, totalPrice: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 rounded-xl pl-4 pr-14 py-2 text-neutral-900 dark:text-white font-mono font-black text-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/40 transition"
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-neutral-400">
                    TND
                  </span>
                </div>
              </div>

            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-purple-600 via-indigo-600 to-pink-600 hover:from-purple-500 hover:via-indigo-500 hover:to-pink-500 text-white font-black py-3.5 px-6 rounded-xl transition shadow-lg shadow-purple-900/25 text-sm sm:text-base flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 active:scale-[0.99] mt-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Création, encaissement & validation en cours...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  <span>Encaisser & Valider le Pass instantanément ⚡ ({formData.totalPrice.toFixed(2)} TND)</span>
                </>
              )}
            </button>

            <p className="text-[11px] text-center text-neutral-400 dark:text-neutral-500">
              🔒 Dès validation, le pass est actif, le QR code est généré et le montant est ajouté au tiroir de caisse.
            </p>

          </form>

        </div>
      )}

    </div>
  );
}
