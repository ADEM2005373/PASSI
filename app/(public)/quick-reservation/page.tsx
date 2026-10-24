"use client";

import React, { Suspense, useEffect, useState, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { api, Event, QuickReservationResponse } from "@/lib/services/api";
import { formatImageUrl } from "@/lib/utils/url";
import { Logo } from "@/components/Logo";
import {
  Calendar,
  Clock,
  MapPin,
  Ticket,
  Wine,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  Newspaper,
  ChevronRight,
  ShieldAlert,
  CreditCard,
  Building,
  Info,
} from "lucide-react";

interface NewsItem {
  id: string;
  title: string;
  content: string;
  image_url?: string;
  created_at?: string;
}

function QuickReservationContent() {
  const searchParams = useSearchParams();
  const initialEventId = searchParams.get("eventId") || searchParams.get("event") || "";

  const [events, setEvents] = useState<Event[]>([]);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>(initialEventId);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Form Fields (Minimal: First Name, Last Name, Phone, Email, optional Instagram)
  const [firstName, setFirstName] = useState<string>("");
  const [lastName, setLastName] = useState<string>("");
  const [phone, setPhone] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [instagram, setInstagram] = useState<string>("");
  const [promoCode, setPromoCode] = useState<string>("");

  // Drink Selection
  const [selectedDrinkName, setSelectedDrinkName] = useState<string>("");
  const [selectedAromas, setSelectedAromas] = useState<string[]>([]);
  const [customDrink, setCustomDrink] = useState<string>("");

  // Submission & Confirmation State
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<QuickReservationResponse | null>(null);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const [showNewsModal, setShowNewsModal] = useState<NewsItem | null>(null);

  // Load events and news
  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      try {
        setLoading(true);
        setError(null);

        const [eventsList, newsList] = await Promise.all([
          api.getEvents().catch(() => []),
          api.getNews().catch(() => []),
        ]);

        if (!isMounted) return;

        setEvents(eventsList || []);
        setNews((newsList as NewsItem[]) || []);

        // Preselect event if matched
        if (initialEventId && eventsList.some(e => e.id === initialEventId)) {
          setSelectedEventId(initialEventId);
        } else if (eventsList.length > 0 && !selectedEventId) {
          setSelectedEventId(eventsList[0].id);
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err?.message || "Impossible de charger les événements.");
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadData();
    return () => {
      isMounted = false;
    };
  }, [initialEventId]);

  // Selected Event Object
  const selectedEvent = useMemo(() => {
    return events.find(e => e.id === selectedEventId) || null;
  }, [events, selectedEventId]);

  // Available Drinks for selected event
  const availableDrinks = useMemo(() => {
    if (!selectedEvent) return [];
    if (selectedEvent.drink_menus && selectedEvent.drink_menus.length > 0) {
      return selectedEvent.drink_menus;
    }
    if (Array.isArray(selectedEvent.drinks) && selectedEvent.drinks.length > 0) {
      return selectedEvent.drinks.map((d: any, idx: number) => ({
        id: d.id || `drink-${idx}`,
        name: d.name || "",
        aromas: Array.isArray(d.aromas) ? d.aromas : [],
      }));
    }
    return [];
  }, [selectedEvent]);

  // Reset drink choice when event changes
  useEffect(() => {
    if (availableDrinks.length > 0) {
      setSelectedDrinkName(availableDrinks[0].name || "");
      setSelectedAromas([]);
    } else {
      setSelectedDrinkName("");
      setSelectedAromas([]);
    }
  }, [selectedEventId, availableDrinks]);

  // Calculated Pricing
  const basePrice = selectedEvent?.base_price ?? 0;
  const discountAmount = useMemo(() => {
    if (!promoCode || !selectedEvent?.promo_codes) return 0;
    const match = selectedEvent.promo_codes.find(
      p => p.code.trim().toUpperCase() === promoCode.trim().toUpperCase()
    );
    return match ? Number(match.discount_amount) : 0;
  }, [promoCode, selectedEvent]);
  const finalPrice = Math.max(0, basePrice - discountAmount);

  // Form Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEventId) {
      setSubmitError("Veuillez sélectionner un événement.");
      return;
    }

    if (!firstName.trim() || !lastName.trim() || !phone.trim() || !email.trim()) {
      setSubmitError("Veuillez remplir tous les champs obligatoires (*).");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setSubmitError("Veuillez fournir une adresse email valide.");
      return;
    }

    const resolvedDrink = customDrink.trim()
      ? customDrink.trim()
      : selectedDrinkName
      ? selectedAromas.length > 0
        ? `${selectedDrinkName} (${selectedAromas.join(", ")})`
        : selectedDrinkName
      : undefined;

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const response = await api.createQuickReservation({
        eventId: selectedEventId,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone.trim(),
        email: email.trim(),
        instagram: instagram.trim() ? instagram.trim() : undefined,
        selectedDrink: resolvedDrink,
        promoCode: promoCode.trim() ? promoCode.trim() : undefined,
      });

      setConfirmation(response);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err: any) {
      setSubmitError(err?.message || "Une erreur est survenue lors de la réservation express.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 3000);
  };

  // ── CONFIRMATION SUCCESS VIEW ──
  if (confirmation) {
    const res = confirmation.reservation;
    const expiresDate = res.expiresAt ? new Date(res.expiresAt) : null;

    return (
      <div className="min-h-screen bg-[#07090E] text-white flex flex-col font-sans selection:bg-rose-500/30">
        {/* Navigation Header */}
        <header className="sticky top-0 z-40 bg-[#07090E]/90 backdrop-blur-xl border-b border-white/10 px-4 md:px-8 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <Logo variant="dark" className="w-[110px] h-[34px]" />
          </Link>
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
              ⚡ Réservation Express
            </span>
          </div>
        </header>

        <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-8 md:py-12 animate-fade-in-up">
          {/* Success Banner */}
          <div className="text-center space-y-4 mb-8">
            <div className="w-20 h-20 mx-auto rounded-3xl bg-gradient-to-tr from-emerald-500/20 to-teal-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-xl shadow-emerald-500/10">
              <CheckCircle2 size={44} className="animate-pulse" />
            </div>

            <div className="inline-block px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              PENDING_PAYMENT
            </div>

            <h1 className="text-2xl md:text-4xl font-extrabold tracking-tight">
              Réservation Validée !
            </h1>

            {/* Core Required Confirmation Message */}
            <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/15 via-rose-500/10 to-amber-500/15 border border-amber-500/30 text-amber-200 text-sm md:text-base font-semibold leading-relaxed max-w-xl mx-auto shadow-lg shadow-amber-950/20">
              &ldquo;{confirmation.message || "Reservation complete. Please pay for your pass at our physical sell points within 48 hours."}&rdquo;
            </div>
          </div>

          {/* Reservation Card Details */}
          <div className="rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.07] to-white/[0.02] p-6 md:p-8 backdrop-blur-2xl shadow-2xl space-y-6">
            {/* Reservation Code Highlight */}
            <div className="p-6 rounded-2xl bg-neutral-900/90 border border-neutral-700/80 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase font-bold tracking-wider text-neutral-400">
                  Votre Code de Réservation
                </p>
                <p className="text-2xl md:text-3xl font-mono font-extrabold text-[#FF6B5E] tracking-wider mt-1">
                  {res.reservationCode}
                </p>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Présentez ce code ou votre numéro de téléphone au guichet
                </p>
              </div>

              <button
                type="button"
                onClick={() => handleCopyCode(res.reservationCode)}
                className="w-full sm:w-auto px-5 py-3 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs flex items-center justify-center gap-2 border border-white/15 transition-all cursor-pointer"
              >
                {copiedCode ? (
                  <>
                    <Check size={16} className="text-emerald-400" />
                    <span>Copié dans le presse-papiers</span>
                  </>
                ) : (
                  <>
                    <Copy size={16} />
                    <span>Copier le Code</span>
                  </>
                )}
              </button>
            </div>

            {/* Visual 48-Hour Reference */}
            {expiresDate && (
              <div className="flex items-center gap-3 p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-200 text-xs">
                <Clock size={20} className="text-red-400 flex-shrink-0" />
                <div>
                  <span className="font-bold">Échéance indicative de 48 heures : </span>
                  <span>
                    À régler avant le{" "}
                    <strong>
                      {expiresDate.toLocaleDateString("fr-FR", {
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                      })}{" "}
                      à{" "}
                      {expiresDate.toLocaleTimeString("fr-FR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </strong>
                    .
                  </span>
                </div>
              </div>
            )}

            {/* Recap Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm pt-2">
              <div className="p-4 rounded-xl bg-white/[0.03] border border-white/5 space-y-1">
                <span className="text-xs text-neutral-400 block">Événement</span>
                <span className="font-bold text-white text-base block">{res.eventTitle}</span>
              </div>

              <div className="p-4 rounded-xl bg-white/[0.03] border border-white/5 space-y-1">
                <span className="text-xs text-neutral-400 block">Titulaire</span>
                <span className="font-bold text-white text-base block">
                  {res.guestFirstName} {res.guestLastName}
                </span>
                <span className="text-xs text-neutral-400 block">
                  📞 {res.phone} · ✉️ {res.email}
                </span>
              </div>

              <div className="p-4 rounded-xl bg-white/[0.03] border border-white/5 space-y-1">
                <span className="text-xs text-neutral-400 block">Boisson sélectionnée</span>
                <span className="font-bold text-[#4DEEEA] block">
                  🍹 {res.selectedDrink || "Sélection standard"}
                </span>
              </div>

              <div className="p-4 rounded-xl bg-white/[0.03] border border-white/5 space-y-1">
                <span className="text-xs text-neutral-400 block">Montant à régler sur place</span>
                <span className="font-bold text-emerald-400 text-xl block">
                  {res.finalPrice} TND
                </span>
              </div>
            </div>

            {/* Sell Points Guidance */}
            <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/10 space-y-3">
              <h4 className="font-bold text-sm flex items-center gap-2 text-white">
                <Building size={16} className="text-[#FF6B5E]" />
                Où et comment payer ?
              </h4>
              <p className="text-xs text-neutral-300 leading-relaxed">
                Rendez-vous à l'un de nos guichets ou points de vente partenaires officiels. Donnez votre{" "}
                <strong className="text-white">code de réservation ({res.reservationCode})</strong> ou votre numéro de téléphone (
                <strong className="text-white">{res.phone}</strong>) au caissier.
              </p>
              <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-200 text-xs flex items-center gap-2">
                <Sparkles size={16} className="text-purple-400 flex-shrink-0" />
                <span>
                  Dès encaissement, votre billet officiel avec QR code sera généré et expédié directement à{" "}
                  <strong>{res.email}</strong>.
                </span>
              </div>
            </div>

            {/* Account Sync Note */}
            <div className="text-center text-xs text-neutral-400 pt-2">
              <p>
                Vous avez déjà un compte ou prévoyez d'en créer un plus tard avec{" "}
                <strong className="text-neutral-200">{res.email}</strong> ?
              </p>
              <p className="text-neutral-500 mt-0.5">
                Votre pass sera automatiquement lié et synchronisé dans votre espace personnel lors de votre connexion.
              </p>
            </div>

            {/* Navigation Actions */}
            <div className="flex flex-col sm:flex-row gap-3 pt-4">
              <Link
                href="/"
                className="flex-1 py-3.5 px-6 rounded-2xl bg-white/10 hover:bg-white/15 text-white font-bold text-center text-sm transition"
              >
                Retour à l'accueil
              </Link>
              <button
                type="button"
                onClick={() => {
                  setConfirmation(null);
                  setFirstName("");
                  setLastName("");
                  setPhone("");
                  setEmail("");
                  setInstagram("");
                }}
                className="flex-1 py-3.5 px-6 rounded-2xl bg-gradient-to-r from-[#FF6B5E] to-rose-600 text-white font-bold text-center text-sm shadow-lg shadow-rose-950/30 hover:opacity-95 transition cursor-pointer"
              >
                Faire une autre réservation
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // ── MAIN FORM VIEW ──
  return (
    <div className="min-h-screen bg-[#07090E] text-white flex flex-col font-sans selection:bg-rose-500/30">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-[#07090E]/90 backdrop-blur-xl border-b border-white/10 px-4 md:px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-neutral-400 hover:text-white text-xs font-semibold px-3 py-1.5 rounded-xl hover:bg-white/5 transition"
          >
            <ArrowLeft size={16} />
            <span className="hidden sm:inline">Accueil</span>
          </Link>
          <div className="h-4 w-px bg-white/10 hidden sm:block" />
          <Logo variant="dark" className="w-[110px] h-[34px]" />
        </div>

        <div className="flex items-center gap-3">
          <span className="hidden md:inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
            ⚡ Réservation Express sans inscription
          </span>
          <Link
            href="/login"
            className="text-xs font-semibold text-neutral-300 hover:text-white transition px-3 py-1.5 rounded-xl hover:bg-white/10"
          >
            Déjà membre ? Se connecter
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-8 md:py-12 space-y-10 animate-fade-in-up">
        {/* Hero Title */}
        <div className="text-center space-y-3 max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-gradient-to-r from-amber-500/20 to-[#FF6B5E]/20 text-amber-300 border border-amber-500/30">
            <Sparkles size={14} className="text-amber-400" />
            Accès Direct Invités · Sans création de compte préalable
          </div>
          <h1 className="text-3xl md:text-5xl font-black tracking-tight leading-tight">
            Réservation <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#FF6B5E] via-rose-400 to-[#4DEEEA]">Express</span>
          </h1>
          <p className="text-sm md:text-base text-neutral-400 leading-relaxed">
            Choisissez votre événement et vos consommations en quelques secondes. Réglez votre pass à nos points de vente dans les 48 heures.
          </p>
        </div>

        {/* Loading Spinner */}
        {loading && (
          <div className="py-20 text-center">
            <div className="w-12 h-12 border-3 border-[#FF6B5E]/20 border-t-[#FF6B5E] rounded-full animate-spin mx-auto mb-4" />
            <p className="text-sm text-neutral-400 font-semibold">Chargement des événements...</p>
          </div>
        )}

        {/* Global Error Banner */}
        {error && (
          <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-300 text-sm flex items-center gap-3">
            <AlertCircle size={20} className="flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {!loading && (
          <form onSubmit={handleSubmit} className="space-y-10">
            {/* ── STEP 1: SELECT EVENT ── */}
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="w-7 h-7 rounded-xl bg-[#FF6B5E] text-white flex items-center justify-center font-bold text-xs shadow-md shadow-[#FF6B5E]/30">
                    1
                  </span>
                  <h2 className="text-lg md:text-xl font-extrabold text-white">
                    Sélectionnez votre événement
                  </h2>
                </div>
                <span className="text-xs text-neutral-400">
                  {events.length} événement(s) disponible(s)
                </span>
              </div>

              {events.length === 0 ? (
                <div className="p-8 text-center rounded-2xl bg-white/[0.02] border border-white/5 text-neutral-400 text-sm">
                  Aucun événement disponible pour le moment.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {events.map((ev) => {
                    const isSelected = ev.id === selectedEventId;
                    const eventDate = new Date(ev.date);
                    const formattedImg = formatImageUrl(ev.image_url);

                    return (
                      <div
                        key={ev.id}
                        onClick={() => setSelectedEventId(ev.id)}
                        className={`group relative rounded-2xl p-4 transition-all duration-200 cursor-pointer border flex flex-col justify-between ${
                          isSelected
                            ? "bg-gradient-to-b from-rose-500/15 to-transparent border-[#FF6B5E] shadow-xl shadow-rose-950/30 scale-[1.01]"
                            : "bg-white/[0.03] hover:bg-white/[0.06] border-white/10 hover:border-white/20"
                        }`}
                      >
                        {isSelected && (
                          <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-[#FF6B5E] text-white flex items-center justify-center shadow-md">
                            <Check size={14} />
                          </div>
                        )}

                        <div className="space-y-3">
                          {formattedImg && (
                            <div className="relative w-full h-32 rounded-xl overflow-hidden bg-neutral-900 border border-white/10">
                              <Image
                                src={formattedImg}
                                alt={ev.title}
                                fill
                                sizes="(max-width: 768px) 100vw, 33vw"
                                className="object-cover group-hover:scale-105 transition-transform duration-300"
                              />
                            </div>
                          )}

                          <div>
                            <div className="flex items-center justify-between gap-2">
                              <h3 className="font-bold text-white text-base truncate">{ev.title}</h3>
                              <span className="px-2 py-0.5 rounded-lg text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                {ev.base_price ?? 0} TND
                              </span>
                            </div>

                            <p className="text-xs text-neutral-400 flex items-center gap-1.5 mt-1">
                              <MapPin size={13} className="text-[#FF6B5E]" />
                              <span className="truncate">{ev.location}</span>
                            </p>

                            <p className="text-xs text-[#4DEEEA] flex items-center gap-1.5 mt-1 font-medium">
                              <Calendar size={13} />
                              {eventDate.toLocaleDateString("fr-FR", {
                                weekday: "short",
                                day: "numeric",
                                month: "short",
                              })}{" "}
                              · {eventDate.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                            </p>
                          </div>
                        </div>

                        {ev.dress_code && (
                          <p className="text-[11px] text-neutral-400 mt-3 pt-2 border-t border-white/5 truncate">
                            👗 Dress code : {ev.dress_code}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* ── STEP 2: CHOOSE DRINK OPTION ── */}
            {selectedEvent && (
              <section className="space-y-4">
                <div className="flex items-center gap-2.5">
                  <span className="w-7 h-7 rounded-xl bg-[#4DEEEA] text-slate-950 flex items-center justify-center font-extrabold text-xs shadow-md shadow-[#4DEEEA]/30">
                    2
                  </span>
                  <div>
                    <h2 className="text-lg md:text-xl font-extrabold text-white">
                      Choisissez votre consommation
                    </h2>
                    <p className="text-xs text-neutral-400">
                      Incluse avec votre pass d'entrée
                    </p>
                  </div>
                </div>

                <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/10 space-y-4">
                  {availableDrinks.length > 0 ? (
                    <div className="space-y-3">
                      <label className="text-xs font-bold text-neutral-300 block">
                        Boisson incluse disponible :
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                        {availableDrinks.map((drink, idx) => {
                          const isSelected = selectedDrinkName === drink.name && !customDrink.trim();
                          return (
                            <button
                              key={drink.id || idx}
                              type="button"
                              onClick={() => {
                                setSelectedDrinkName(drink.name);
                                setCustomDrink("");
                                setSelectedAromas([]);
                              }}
                              className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                                isSelected
                                  ? "bg-[#4DEEEA]/15 border-[#4DEEEA] text-white shadow-md shadow-cyan-950/20"
                                  : "bg-white/[0.02] border-white/10 text-neutral-300 hover:border-white/20"
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-sm">🍹 {drink.name}</span>
                                {isSelected && <Check size={14} className="text-[#4DEEEA]" />}
                              </div>
                            </button>
                          );
                        })}
                      </div>

                      {/* Aromas if available for selected drink */}
                      {(() => {
                        const currentDrinkObj = availableDrinks.find(d => d.name === selectedDrinkName);
                        if (!currentDrinkObj || !currentDrinkObj.aromas || currentDrinkObj.aromas.length === 0) {
                          return null;
                        }

                        return (
                          <div className="pt-3 border-t border-white/5 space-y-2">
                            <label className="text-xs font-semibold text-neutral-400 block">
                              Arômes disponibles pour {selectedDrinkName} (optionnel) :
                            </label>
                            <div className="flex flex-wrap gap-2">
                              {currentDrinkObj.aromas.map((aroma: string, aIdx: number) => {
                                const isChecked = selectedAromas.includes(aroma);
                                return (
                                  <button
                                    key={aIdx}
                                    type="button"
                                    onClick={() => {
                                      if (isChecked) {
                                        setSelectedAromas(selectedAromas.filter(a => a !== aroma));
                                      } else {
                                        setSelectedAromas([...selectedAromas, aroma]);
                                      }
                                    }}
                                    className={`px-3 py-1 rounded-lg text-xs font-medium border transition cursor-pointer ${
                                      isChecked
                                        ? "bg-purple-500/20 text-purple-300 border-purple-500/50"
                                        : "bg-white/[0.03] text-neutral-400 border-white/10 hover:border-white/20"
                                    }`}
                                  >
                                    {aroma} {isChecked ? "✓" : "+"}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  ) : (
                    <div className="text-xs text-neutral-400">
                      Boisson standard ou au choix du barman incluse à l'entrée.
                    </div>
                  )}

                  {/* Optional Custom Drink */}
                  <div className="pt-2">
                    <label className="text-xs font-semibold text-neutral-400 block mb-1">
                      Ou préciser une boisson personnalisée :
                    </label>
                    <input
                      type="text"
                      value={customDrink}
                      onChange={(e) => setCustomDrink(e.target.value)}
                      placeholder="Ex: Cocktail sans alcool spécial, Soda..."
                      className="w-full px-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-white placeholder-neutral-500 text-sm focus:outline-none focus:border-[#4DEEEA]"
                    />
                  </div>
                </div>
              </section>
            )}

            {/* ── STEP 3: MINIMAL GUEST FORM ── */}
            <section className="space-y-4">
              <div className="flex items-center gap-2.5">
                <span className="w-7 h-7 rounded-xl bg-purple-500 text-white flex items-center justify-center font-bold text-xs shadow-md shadow-purple-500/30">
                  3
                </span>
                <div>
                  <h2 className="text-lg md:text-xl font-extrabold text-white">
                    Vos Coordonnées (Formulaire Minimal)
                  </h2>
                  <p className="text-xs text-neutral-400">
                    Nécessaires pour l'envoi de votre billet et l'identification au point de vente
                  </p>
                </div>
              </div>

              <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/10 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-neutral-300 block mb-1.5">
                      Prénom <span className="text-[#FF6B5E]">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="Ex: Yasmine"
                      className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/10 text-white placeholder-neutral-500 text-sm focus:outline-none focus:border-[#FF6B5E]"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-neutral-300 block mb-1.5">
                      Nom <span className="text-[#FF6B5E]">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="Ex: Ben Salem"
                      className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/10 text-white placeholder-neutral-500 text-sm focus:outline-none focus:border-[#FF6B5E]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-neutral-300 block mb-1.5">
                      Téléphone <span className="text-[#FF6B5E]">*</span>
                    </label>
                    <input
                      type="tel"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="Ex: +216 20 123 456"
                      className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/10 text-white placeholder-neutral-500 text-sm focus:outline-none focus:border-[#FF6B5E]"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-neutral-300 block mb-1.5">
                      Email <span className="text-[#FF6B5E]">*</span>
                    </label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Ex: yasmine@example.com"
                      className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/10 text-white placeholder-neutral-500 text-sm focus:outline-none focus:border-[#FF6B5E]"
                    />
                    <p className="text-[11px] text-neutral-500 mt-1">
                      Votre pass QR PDF officiel sera envoyé à cette adresse dès paiement.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <div>
                    <label className="text-xs font-semibold text-neutral-400 block mb-1.5">
                      Pseudo ou Profil Instagram (Optionnel)
                    </label>
                    <input
                      type="text"
                      value={instagram}
                      onChange={(e) => setInstagram(e.target.value)}
                      placeholder="Ex: @yasmine.bs (non obligatoire)"
                      className="w-full px-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-white placeholder-neutral-500 text-sm focus:outline-none focus:border-purple-400"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-neutral-400 block mb-1.5">
                      Code Promo (Optionnel)
                    </label>
                    <input
                      type="text"
                      value={promoCode}
                      onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                      placeholder="Ex: STUDENT2026"
                      className="w-full px-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-white placeholder-neutral-500 text-sm font-mono focus:outline-none focus:border-amber-400 uppercase"
                    />
                  </div>
                </div>

                {/* 48-Hour Lifecycle Notice */}
                <div className="mt-4 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-start gap-3">
                  <Info size={18} className="text-amber-400 flex-shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-bold">
                      Règlement à nos points de vente physiques dans les 48 heures :
                    </p>
                    <p className="text-amber-200/90 leading-relaxed">
                      Votre réservation sera enregistrée en statut <code>PENDING_PAYMENT</code>. Vous disposerez de 48 heures pour régler votre pass en espèces au guichet. Un e-mail contenant votre billet QR vous sera envoyé immédiatement après confirmation.
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* Error Display */}
            {submitError && (
              <div className="p-4 rounded-2xl bg-red-500/15 border border-red-500/30 text-red-300 text-sm flex items-center gap-3">
                <AlertCircle size={20} className="flex-shrink-0" />
                <span>{submitError}</span>
              </div>
            )}

            {/* Price Recap & Submit Button */}
            <div className="p-6 rounded-2xl bg-gradient-to-r from-neutral-900 via-neutral-900 to-neutral-900/90 border border-white/15 flex flex-col sm:flex-row items-center justify-between gap-6 shadow-xl">
              <div>
                <span className="text-xs text-neutral-400 block">Total à régler au guichet</span>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-extrabold text-white">{finalPrice} TND</span>
                  {discountAmount > 0 && (
                    <span className="text-sm line-through text-neutral-500 font-semibold">
                      {basePrice} TND (-{discountAmount} TND)
                    </span>
                  )}
                </div>
                <span className="text-[11px] text-[#4DEEEA] font-medium block mt-0.5">
                  ✓ Entrée événement + boisson sélectionnée
                </span>
              </div>

              <button
                type="submit"
                disabled={isSubmitting || !selectedEventId}
                className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-gradient-to-r from-[#FF6B5E] to-rose-600 hover:from-[#ff594a] hover:to-rose-500 text-white font-extrabold text-base shadow-xl shadow-rose-950/40 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                    <span>Traitement express...</span>
                  </>
                ) : (
                  <>
                    <span>Confirmer la Réservation Express</span>
                    <ArrowRight size={18} />
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* ── NEWS SECTION ── */}
        {news.length > 0 && (
          <section className="pt-8 border-t border-white/10 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Newspaper size={18} className="text-[#FF6B5E]" />
                <h3 className="text-base md:text-lg font-bold text-white">
                  Actualités & Annonces Récentes
                </h3>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {news.slice(0, 3).map((item) => {
                const formattedNewsImg = formatImageUrl(item.image_url);
                return (
                  <div
                    key={item.id}
                    onClick={() => setShowNewsModal(item)}
                    className="p-4 rounded-2xl bg-white/[0.02] hover:bg-white/[0.05] border border-white/5 hover:border-white/15 transition-all cursor-pointer space-y-2.5"
                  >
                    {formattedNewsImg && (
                      <div className="relative w-full h-24 rounded-xl overflow-hidden bg-neutral-900 border border-white/5">
                        <Image
                          src={formattedNewsImg}
                          alt={item.title}
                          fill
                          sizes="(max-width: 768px) 100vw, 33vw"
                          className="object-cover"
                        />
                      </div>
                    )}
                    <h4 className="font-bold text-sm text-white line-clamp-1">{item.title}</h4>
                    <p className="text-xs text-neutral-400 line-clamp-2 leading-relaxed">
                      {item.content}
                    </p>
                    <span className="text-[10px] text-[#4DEEEA] font-semibold block pt-1">
                      Lire l'annonce →
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* News Modal */}
        {showNewsModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
            <div className="max-w-lg w-full rounded-3xl bg-neutral-900 border border-white/15 p-6 space-y-4 shadow-2xl">
              <div className="flex justify-between items-start gap-4">
                <h3 className="text-lg font-bold text-white">{showNewsModal.title}</h3>
                <button
                  type="button"
                  onClick={() => setShowNewsModal(null)}
                  className="p-2 rounded-xl bg-white/10 text-neutral-400 hover:text-white"
                >
                  ✕
                </button>
              </div>
              <p className="text-xs text-neutral-300 leading-relaxed whitespace-pre-wrap">
                {showNewsModal.content}
              </p>
              <button
                type="button"
                onClick={() => setShowNewsModal(null)}
                className="w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs"
              >
                Fermer
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default function QuickReservationPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#07090E] flex flex-col items-center justify-center text-white p-6">
          <div className="w-12 h-12 border-3 border-[#FF6B5E]/20 border-t-[#FF6B5E] rounded-full animate-spin mb-4" />
          <p className="text-sm font-semibold text-neutral-400">Chargement de la réservation express...</p>
        </div>
      }
    >
      <QuickReservationContent />
    </Suspense>
  );
}
