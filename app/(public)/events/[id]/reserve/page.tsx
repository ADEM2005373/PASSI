"use client";

import { useEffect, useState, use, useMemo } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { api, Event, User, DrinkItem } from "@/lib/services/api";
import { formatImageUrl } from "@/lib/utils/url";
import { Logo } from "@/components/Logo";
import { DrinkSelector } from "@/components/DrinkSelector";
import {
  Calendar,
  Clock,
  MapPin,
  Ticket,
  Wine,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Shirt,
  Info,
  ChevronRight,
} from "lucide-react";

export default function EventDirectReservePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const resolvedParams = use(params);
  const [event, setEvent] = useState<Event | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Reservation Choices
  const [selectedDrinkId, setSelectedDrinkId] = useState<string>("");
  const [selectedAromas, setSelectedAromas] = useState<string[]>([]);
  const [promoCode, setPromoCode] = useState<string>("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [imageError, setImageError] = useState(false);

  // 1. Fetch event and check authentication status
  useEffect(() => {
    let isMounted = true;
    async function loadEventData() {
      try {
        setLoading(true);
        const [eventData, user] = await Promise.all([
          api.getEvent(resolvedParams.id),
          api.getCurrentUser().catch(() => null),
        ]);

        if (!isMounted) return;

        if (!eventData) {
          setError("Événement introuvable.");
          setLoading(false);
          return;
        }

        setEvent(eventData);
        setCurrentUser(user || null);

        // Pre-select first drink if only one is available
        const drinksList = (eventData.drink_menus && eventData.drink_menus.length > 0)
          ? eventData.drink_menus
          : (eventData.drinks || []);

        if (drinksList.length === 1) {
          const firstDrink = drinksList[0];
          const drinkName = firstDrink.name || firstDrink.id || "";
          setSelectedDrinkId(drinkName);
          if (firstDrink.aromas && firstDrink.aromas.length === 1) {
            setSelectedAromas([firstDrink.aromas[0]]);
          }
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err?.message || "Impossible de charger l'événement.");
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadEventData();
    return () => {
      isMounted = false;
    };
  }, [resolvedParams.id]);

  // Available drinks computed list
  const availableDrinks: DrinkItem[] = useMemo(() => {
    if (!event) return [];
    if (event.drink_menus && event.drink_menus.length > 0) {
      return event.drink_menus;
    }
    return event.drinks || [];
  }, [event]);

  // Pricing calculations
  const priceCalculation = useMemo(() => {
    const base = event?.base_price ?? 0;
    const matched = event?.promo_codes?.find(
      (p) => p.code?.toUpperCase() === promoCode.trim().toUpperCase()
    );
    const discount = matched ? matched.discount_amount : 0;
    const finalPrice = Math.max(0, base - discount);
    return { base, discount, finalPrice, matchedCode: matched?.code };
  }, [event, promoCode]);

  // Proceed to Auth or Direct Submit
  const handleProceedToAuth = () => {
    if (!event) return;
    setValidationError(null);

    // Validate drink choice if drinks are available for this event
    if (availableDrinks.length > 0 && !selectedDrinkId) {
      setValidationError("Veuillez sélectionner votre boisson incluse.");
      return;
    }

    setIsSubmitting(true);

    const reservationIntent = {
      eventId: event.id,
      eventTitle: event.title,
      drinkName: selectedDrinkId || undefined,
      aromas: selectedAromas,
      promoCode: promoCode.trim() || undefined,
      timestamp: Date.now(),
    };

    try {
      localStorage.setItem("pending_reservation", JSON.stringify(reservationIntent));
    } catch (e) {
      console.warn("Could not save to localStorage:", e);
    }

    // If user is already logged in, route directly to processor
    if (currentUser) {
      router.push("/reservations/process");
    } else {
      // Directs to login with next destination in direct OAuth mode to process pass creation
      router.push("/login?next=/reservations/process&auth=oauth");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white p-6">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-3 border-purple-500/20 border-t-purple-500 rounded-full animate-spin" />
          <p className="text-sm font-semibold text-slate-400 animate-pulse">
            Chargement de l'événement...
          </p>
        </div>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white p-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-rose-500/10 text-rose-400 flex items-center justify-center mb-4">
          <AlertCircle size={32} />
        </div>
        <h2 className="text-2xl font-bold mb-2">Événement introuvable</h2>
        <p className="text-slate-400 text-sm max-w-sm mb-6">
          {error || "L'événement demandé n'est pas disponible ou a été déplacé."}
        </p>
        <Link
          href="/"
          className="px-6 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-sm transition"
        >
          Retour à l'accueil
        </Link>
      </div>
    );
  }

  const formattedImage = formatImageUrl(event.image_url);
  const hasImage = Boolean(formattedImage && !imageError && formattedImage !== "undefined");

  return (
    <div className="min-h-screen bg-[#07090E] text-white flex flex-col font-sans selection:bg-purple-600/30">
      {/* Sticky Top Header */}
      <header className="sticky top-0 z-40 bg-[#07090E]/85 backdrop-blur-xl border-b border-white/5 px-4 md:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-xs font-semibold px-2.5 py-1.5 rounded-lg hover:bg-white/5"
          >
            <ArrowLeft size={16} />
            <span className="hidden sm:inline">Retour</span>
          </Link>
          <div className="h-4 w-px bg-white/10 hidden sm:block" />
          <Logo variant="dark" className="w-[105px] h-[32px]" />
        </div>

        {/* Conversion Progress Stepper */}
        <div className="hidden md:flex items-center gap-2 text-xs font-medium text-slate-400">
          <span className="flex items-center gap-1.5 text-purple-400 font-bold bg-purple-500/10 px-2.5 py-1 rounded-full border border-purple-500/20">
            <span className="w-4 h-4 rounded-full bg-purple-600 text-white flex items-center justify-center text-[10px]">1</span>
            Choix de la boisson
          </span>
          <ChevronRight size={14} className="text-slate-600" />
          <span className="flex items-center gap-1.5 opacity-60">
            <span className="w-4 h-4 rounded-full bg-slate-800 text-slate-400 flex items-center justify-center text-[10px]">2</span>
            Connexion rapide
          </span>
          <ChevronRight size={14} className="text-slate-600" />
          <span className="flex items-center gap-1.5 opacity-60">
            <span className="w-4 h-4 rounded-full bg-slate-800 text-slate-400 flex items-center justify-center text-[10px]">3</span>
            Pass validé
          </span>
        </div>

        {currentUser ? (
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-purple-600/20 text-purple-300 font-bold text-xs flex items-center justify-center border border-purple-500/30">
              {currentUser.first_name ? currentUser.first_name[0].toUpperCase() : "U"}
            </div>
            <span className="text-xs text-slate-300 hidden sm:inline font-medium">
              {currentUser.first_name || "Connecté"}
            </span>
          </div>
        ) : (
          <Link
            href={`/login?next=/events/${event.id}/reserve`}
            className="text-xs font-semibold text-purple-400 hover:text-purple-300 transition px-3 py-1.5 rounded-lg hover:bg-purple-500/10"
          >
            Déjà un compte ?
          </Link>
        )}
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-6 md:py-10 space-y-8">
        {/* Event Card / Header */}
        <div className="relative rounded-3xl overflow-hidden bg-slate-900/60 border border-slate-800/80 shadow-2xl backdrop-blur-xl">
          {/* Cover Media */}
          {hasImage ? (
            <div className="relative w-full h-48 sm:h-64 bg-slate-950 overflow-hidden">
              <Image
                src={formattedImage}
                alt={event.title}
                fill
                priority
                sizes="(max-width: 768px) 100vw, 900px"
                className="object-cover"
                onError={() => setImageError(true)}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0d121f] via-[#0d121f]/50 to-transparent" />
              <div className="absolute top-4 left-4 flex gap-2">
                <span className="bg-purple-600/90 text-white text-[11px] font-bold uppercase tracking-wider px-3 py-1 rounded-full shadow-lg backdrop-blur-md">
                  Réservation Directe
                </span>
                {event.base_price !== undefined && (
                  <span className="bg-slate-900/90 text-amber-400 border border-amber-400/30 text-[11px] font-bold px-3 py-1 rounded-full shadow-lg backdrop-blur-md">
                    {event.base_price > 0 ? `${event.base_price} DT / pass` : "Entrée Libre"}
                  </span>
                )}
              </div>
            </div>
          ) : (
            <div className="relative w-full h-32 bg-gradient-to-r from-purple-900/50 via-slate-900 to-pink-900/40 p-6 flex items-center justify-between">
              <span className="bg-purple-600 text-white text-[11px] font-bold uppercase tracking-wider px-3 py-1 rounded-full shadow-lg">
                Réservation Directe
              </span>
              {event.base_price !== undefined && (
                <span className="text-amber-400 font-extrabold text-sm">
                  {event.base_price > 0 ? `${event.base_price} DT` : "Gratuit"}
                </span>
              )}
            </div>
          )}

          {/* Event Metadata */}
          <div className="p-6 md:p-8 space-y-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight leading-tight">
                {event.title}
              </h1>
              <p className="text-slate-400 text-sm mt-1">
                Configurez votre pass et vos consommations avant de confirmer votre place.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-y-2 gap-x-5 text-xs sm:text-sm text-slate-300 pt-2 border-t border-slate-800/80">
              <span className="flex items-center gap-2">
                <Calendar size={16} className="text-purple-400 shrink-0" />
                <strong>
                  {new Date(event.date).toLocaleDateString("fr-FR", {
                    weekday: "short",
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </strong>
              </span>
              <span className="flex items-center gap-2">
                <Clock size={16} className="text-purple-400 shrink-0" />
                <span>
                  {new Date(event.date).toLocaleTimeString("fr-FR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </span>
              <span className="flex items-center gap-2">
                <MapPin size={16} className="text-purple-400 shrink-0" />
                <span className="truncate max-w-[200px]">{event.location}</span>
              </span>
              {event.dress_code && (
                <span className="flex items-center gap-2">
                  <Shirt size={16} className="text-pink-400 shrink-0" />
                  <span>{event.dress_code}</span>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Drink & Aroma Selection Box */}
        <div className="rounded-3xl bg-slate-900/60 border border-slate-800/80 p-6 md:p-8 space-y-6 shadow-xl backdrop-blur-xl">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-purple-400 text-xs font-bold uppercase tracking-wider">
                <Wine size={16} />
                <span>Consommation incluse avec votre pass</span>
              </div>
              <h2 className="text-xl font-bold text-white">
                Choisissez votre boisson &amp; arômes
              </h2>
              <p className="text-slate-400 text-xs sm:text-sm">
                Votre choix sera directement encodé sur votre QR code et disponible au bar de la soirée.
              </p>
            </div>
            <span className="text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3 py-1 rounded-full font-bold flex items-center gap-1 shrink-0">
              <Sparkles size={13} />
              Inclus
            </span>
          </div>

          {availableDrinks.length > 0 ? (
            <div className="space-y-4 pt-2">
              <DrinkSelector
                drinks={availableDrinks}
                selectedDrinkId={selectedDrinkId}
                selectedAromas={selectedAromas}
                onChange={(drinkId, aromas) => {
                  setSelectedDrinkId(drinkId);
                  setSelectedAromas(aromas);
                  if (validationError) setValidationError(null);
                }}
                label="Boisson sélectionnée *"
                required
                name="reserve-drink-arome"
              />
            </div>
          ) : (
            <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 text-slate-300 text-sm flex items-center gap-3">
              <Ticket size={20} className="text-purple-400 shrink-0" />
              <span>Cet événement inclut l'accès direct et standard. Aucune boisson spécifique à pré-sélectionner.</span>
            </div>
          )}

          {/* Validation Warning */}
          {validationError && (
            <div className="flex items-center gap-2 p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-semibold animate-shake">
              <AlertCircle size={16} className="shrink-0" />
              <span>{validationError}</span>
            </div>
          )}
        </div>

        {/* Promo Code & Pricing Summary */}
        <div className="rounded-3xl bg-slate-900/60 border border-slate-800/80 p-6 md:p-8 space-y-6 shadow-xl backdrop-blur-xl">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Ticket size={18} className="text-purple-400" />
            <span>Récapitulatif de votre pass</span>
          </h3>

          {/* Promo code input */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              Code Promo (optionnel)
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="Ex: VIP2026, STUDENT..."
                value={promoCode}
                onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                className="w-full px-4 py-3 rounded-2xl bg-slate-950 border border-slate-800 text-white placeholder-slate-600 text-sm font-mono uppercase focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all"
              />
              {priceCalculation.matchedCode && (
                <span className="absolute right-3.5 top-3 text-xs font-bold text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 size={15} />
                  -{priceCalculation.discount} DT
                </span>
              )}
            </div>
          </div>

          {/* Price breakdown */}
          <div className="pt-4 border-t border-slate-800 space-y-2 text-sm">
            <div className="flex justify-between text-slate-400 text-xs">
              <span>Tarif de base du pass :</span>
              <span>{priceCalculation.base > 0 ? `${priceCalculation.base} DT` : "Gratuit"}</span>
            </div>
            {priceCalculation.discount > 0 && (
              <div className="flex justify-between text-emerald-400 text-xs font-semibold">
                <span>Réduction appliquée ({priceCalculation.matchedCode}) :</span>
                <span>-{priceCalculation.discount} DT</span>
              </div>
            )}
            <div className="flex justify-between items-center text-white font-bold pt-2 border-t border-slate-800">
              <span className="text-sm">Total à régler au Point de Paiement :</span>
              <span className="text-amber-400 font-extrabold text-xl">
                {priceCalculation.finalPrice > 0 ? `${priceCalculation.finalPrice} DT` : "0 DT"}
              </span>
            </div>
          </div>

          {/* High-conversion Action Button */}
          <div className="pt-2 space-y-4">
            <button
              onClick={handleProceedToAuth}
              disabled={isSubmitting}
              className="w-full relative group overflow-hidden py-4 px-6 rounded-2xl font-extrabold text-base bg-gradient-to-r from-purple-600 via-pink-600 to-passi-corail text-white shadow-xl shadow-purple-900/30 hover:shadow-purple-600/40 hover:scale-[1.01] active:scale-[0.99] transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {/* Shine effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 transform -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
              
              {isSubmitting ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Traitement de votre choix...</span>
                </>
              ) : (
                <>
                  <span>Valider mon pass</span>
                  <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>

            {/* Production trust indicators */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-[11px] text-slate-400">
              <div className="flex items-center gap-2 justify-center sm:justify-start">
                <ShieldCheck size={14} className="text-emerald-400 shrink-0" />
                <span>Aucune CB requise</span>
              </div>
              <div className="flex items-center gap-2 justify-center">
                <Sparkles size={14} className="text-purple-400 shrink-0" />
                <span>Validation instantanée</span>
              </div>
              <div className="flex items-center gap-2 justify-center sm:justify-end">
                <Ticket size={14} className="text-pink-400 shrink-0" />
                <span>Règlement au guichet</span>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
