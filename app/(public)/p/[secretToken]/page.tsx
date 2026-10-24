"use client";

import { useEffect, useState, useCallback, use } from "react";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import { Logo } from "@/components/Logo";
import {
  Ticket,
  Calendar,
  MapPin,
  User,
  CheckCircle2,
  Share2,
  Copy,
  Check,
  Wine,
  Sparkles,
  ShieldCheck,
  AlertCircle,
  Clock,
  ExternalLink,
  ChevronRight,
  RefreshCw,
} from "lucide-react";

interface QuickPassData {
  id: string;
  reservationCode: string;
  guestFirstName?: string;
  guestLastName?: string;
  guestName: string;
  phone?: string;
  email?: string;
  status: string;
  entryStatus: string;
  finalPrice?: number;
  entryToken: string;
  isEntryUsed: boolean;
  entryUsedAt?: string | null;
  drinkToken: string;
  selectedDrink: string;
  selectedAromas?: string[];
  isDrinkUsed: boolean;
  drinkUsedAt?: string | null;
  eventTitle: string;
  eventDate?: string | null;
  eventLocation?: string | null;
  doorsOpen?: string | null;
  imageUrl?: string | null;
  secretToken: string;
}

export default function QuickPassViewPage({
  params,
}: {
  params: Promise<{ secretToken: string }>;
}) {
  const { secretToken } = use(params);

  const [pass, setPass] = useState<QuickPassData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"entry" | "drink">("entry");
  const [copied, setCopied] = useState(false);

  // 1. Fetch pass initial details
  const fetchPassDetails = useCallback(async () => {
    try {
      const res = await fetch(`/api/public/quick-passes/${encodeURIComponent(secretToken)}`, {
        cache: "no-store",
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error || "Pass introuvable ou lien expiré.");
        return;
      }

      setPass(data.pass);
    } catch (err: any) {
      console.error("Failed to load quick pass:", err);
      setError("Impossible de charger le pass. Vérifiez votre connexion.");
    } finally {
      setLoading(false);
    }
  }, [secretToken]);

  useEffect(() => {
    fetchPassDetails();
  }, [fetchPassDetails]);

  // 2. High-Frequency Live Invalidation Polling (every 2.5s)
  // When scanner redeems entry or drink, QR disappears immediately without manual reload!
  useEffect(() => {
    if (!pass) return;
    // If both tokens are already used, no need to poll actively
    if (pass.isEntryUsed && pass.isDrinkUsed) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/public/quick-passes/${encodeURIComponent(secretToken)}/status`, {
          cache: "no-store",
        });
        if (!res.ok) return;
        const statusData = await res.json();

        if (statusData.success) {
          setPass((prev) => {
            if (!prev) return null;
            // Only update if consumption states changed
            if (
              prev.isEntryUsed !== statusData.is_entry_used ||
              prev.isDrinkUsed !== statusData.is_drink_used
            ) {
              return {
                ...prev,
                isEntryUsed: statusData.is_entry_used,
                entryUsedAt: statusData.entry_used_at || prev.entryUsedAt,
                isDrinkUsed: statusData.is_drink_used,
                drinkUsedAt: statusData.drink_used_at || prev.drinkUsedAt,
                entryStatus: statusData.entry_status || prev.entryStatus,
              };
            }
            return prev;
          });
        }
      } catch (pollErr) {
        // Silent failure on polling to avoid user disruption
      }
    }, 2500);

    return () => clearInterval(interval);
  }, [secretToken, pass?.isEntryUsed, pass?.isDrinkUsed]);

  // Copy shareable link helper
  const handleCopyLink = () => {
    if (typeof window === "undefined") return;
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  // Format scan timestamp (HH:mm)
  const formatScanTime = (isoString?: string | null) => {
    if (!isoString) return new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
    const d = new Date(isoString);
    return isNaN(d.getTime())
      ? new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
      : d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  };

  // Format event date
  const formatEventDate = (isoString?: string | null) => {
    if (!isoString) return "Date à confirmer";
    const d = new Date(isoString);
    return isNaN(d.getTime())
      ? "Date à confirmer"
      : d.toLocaleDateString("fr-FR", {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
        });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-950 text-white flex flex-col items-center justify-center p-6 selection:bg-emerald-500/30">
        <div className="w-16 h-16 rounded-2xl bg-neutral-900 border border-neutral-800 flex items-center justify-center animate-pulse mb-4">
          <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin" />
        </div>
        <p className="text-sm font-semibold text-neutral-400">Chargement de votre Pass Officiel...</p>
      </div>
    );
  }

  if (error || !pass) {
    return (
      <div className="min-h-screen bg-neutral-950 text-white flex flex-col items-center justify-center p-6">
        <div className="max-w-md w-full rounded-3xl bg-neutral-900/90 border border-neutral-800 p-8 text-center shadow-2xl">
          <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Pass Introuvable</h2>
          <p className="text-sm text-neutral-400 mb-6">
            {error || "Ce pass n'existe pas ou le lien de partage est invalide."}
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-white/10 hover:bg-white/15 text-white font-semibold text-sm transition-all"
          >
            Retour à l'accueil
          </Link>
        </div>
      </div>
    );
  }

  const isAwaitingPayment =
    pass.entryStatus === "awaiting_payment" || pass.status === "PENDING_PAYMENT";

  const shareText = `Salut ! Voici ton pass d'accès officiel pour ${pass.eventTitle} (${pass.guestName}) : ${typeof window !== "undefined" ? window.location.href : ""}`;
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(shareText)}`;

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col justify-between selection:bg-emerald-500/30 font-sans relative overflow-x-hidden">
      
      {/* Background Ambience Glows */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[300px] bg-gradient-to-b from-emerald-500/15 via-teal-500/5 to-transparent blur-3xl pointer-events-none -z-10" />
      <div className="absolute bottom-0 right-0 w-[400px] h-[300px] bg-purple-500/10 blur-3xl pointer-events-none -z-10" />

      {/* ─── BRAND TOP BAR ─── */}
      <header className="sticky top-0 z-40 px-4 sm:px-6 py-3.5 backdrop-blur-xl bg-neutral-950/80 border-b border-neutral-800/80">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <Logo className="w-[95px] h-[30px]" />
          
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Pass Live
            </span>
          </div>
        </div>
      </header>

      {/* ─── MAIN MOBILE PASS CONTAINER ─── */}
      <main className="flex-1 max-w-md w-full mx-auto px-4 py-6 flex flex-col gap-5">
        
        {/* Awaiting payment banner (if guest hasn't settled at POS yet) */}
        {isAwaitingPayment && (
          <div className="p-4 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-200 text-xs flex items-start gap-3 shadow-sm animate-in fade-in">
            <Clock className="w-5 h-5 shrink-0 text-amber-400 mt-0.5" />
            <div>
              <p className="font-bold text-sm text-amber-300">Règlement en attente</p>
              <p className="mt-1 leading-relaxed text-amber-200/90">
                Ce pass sera activé dès votre règlement auprès d'un de nos points de vente physiques en présentant la référence <strong className="font-mono text-white">{pass.reservationCode}</strong>.
              </p>
            </div>
          </div>
        )}

        {/* ─── TICKET CARD CONTAINER ─── */}
        <div className="rounded-3xl border border-neutral-800 bg-neutral-900/90 backdrop-blur-xl p-6 shadow-2xl relative overflow-hidden flex flex-col">
          
          {/* Subtle Top Gradient Line */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-600" />

          {/* Event Header & Reference */}
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              <span className="text-[11px] font-black uppercase tracking-wider text-emerald-400 mb-1 flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                Pass Événement Officiel
              </span>
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight leading-snug">
                {pass.eventTitle}
              </h1>
            </div>

            <div className="shrink-0 text-right">
              <span className="text-[10px] uppercase font-bold text-neutral-400 block">Réf. Réservation</span>
              <span className="font-mono font-black text-sm text-purple-400 bg-purple-500/15 px-2.5 py-1 rounded-lg border border-purple-500/25 inline-block mt-0.5">
                {pass.reservationCode}
              </span>
            </div>
          </div>

          {/* Event Key Info Grid */}
          <div className="grid grid-cols-2 gap-2.5 p-3.5 rounded-2xl bg-neutral-950/70 border border-neutral-800/80 mb-5 text-xs">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-emerald-400 shrink-0" />
              <div className="min-w-0">
                <span className="text-[10px] text-neutral-500 uppercase block font-semibold">Date</span>
                <span className="text-neutral-200 font-medium truncate block capitalize">
                  {formatEventDate(pass.eventDate)}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-rose-400 shrink-0" />
              <div className="min-w-0">
                <span className="text-[10px] text-neutral-500 uppercase block font-semibold">Lieu</span>
                <span className="text-neutral-200 font-medium truncate block">
                  {pass.eventLocation || "L'Agora Djerba"}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 col-span-2 pt-2 border-t border-neutral-800/60">
              <User className="w-4 h-4 text-amber-400 shrink-0" />
              <div className="min-w-0 flex items-center justify-between w-full">
                <div>
                  <span className="text-[10px] text-neutral-500 uppercase block font-semibold">Titulaire du Pass</span>
                  <span className="text-white font-bold truncate block">
                    {pass.guestName}
                  </span>
                </div>
                {pass.finalPrice !== undefined && (
                  <span className="font-black text-emerald-400 text-sm">
                    {pass.finalPrice} DT
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* ─── DUAL QR NAVIGATION SELECTOR (ENTRÉE vs BOISSON) ─── */}
          <div className="flex items-center gap-2 p-1 rounded-2xl bg-neutral-950 border border-neutral-800 mb-5">
            <button
              onClick={() => setActiveTab("entry")}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === "entry"
                  ? "bg-emerald-500 text-neutral-950 shadow-md shadow-emerald-500/20"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              <Ticket className="w-4 h-4" />
              <span>Entrée</span>
              {pass.isEntryUsed && (
                <span className="w-2 h-2 rounded-full bg-neutral-950 ml-1" />
              )}
            </button>

            <button
              onClick={() => setActiveTab("drink")}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === "drink"
                  ? "bg-teal-400 text-neutral-950 shadow-md shadow-teal-400/20"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              <Wine className="w-4 h-4" />
              <span>Boisson</span>
              {pass.isDrinkUsed && (
                <span className="w-2 h-2 rounded-full bg-neutral-950 ml-1" />
              )}
            </button>
          </div>

          {/* ═══════════════════════════════════════════════════════════════ */}
          {/* TAB 1: SCAN ENTRÉE (GATE ACCESS)                                */}
          {/* ═══════════════════════════════════════════════════════════════ */}
          {activeTab === "entry" && (
            <div className="flex flex-col items-center text-center animate-in fade-in duration-200">
              
              {!pass.isEntryUsed ? (
                /* ACTIVE ENTRY QR CODE */
                <div className="flex flex-col items-center">
                  <div className="p-4 sm:p-5 rounded-3xl bg-white shadow-2xl border-4 border-emerald-500/30 transition-all hover:scale-[1.01]">
                    <QRCodeSVG
                      value={pass.entryToken}
                      size={210}
                      level="H"
                      fgColor="#0F172A"
                      bgColor="#FFFFFF"
                    />
                  </div>

                  <div className="mt-4 flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/25">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>SCAN ENTRÉE • QR ACTIF</span>
                  </div>

                  <p className="text-xs text-neutral-400 mt-2 max-w-xs leading-relaxed">
                    Présentez ce QR Code aux agents de sécurité à l'entrée de l'événement.
                  </p>
                </div>
              ) : (
                /* FIXED BADGE: ONCE SCANNED, QR CODE DISAPPEARS PERMANENTLY */
                <div className="w-full py-8 px-6 rounded-2xl bg-emerald-500/10 border-2 border-emerald-500/40 flex flex-col items-center text-center animate-in zoom-in-95 duration-300">
                  <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center mb-3">
                    <CheckCircle2 className="w-9 h-9" />
                  </div>
                  
                  <span className="text-lg font-black text-emerald-400 tracking-tight">
                    ✅ ENTRÉE VALIDÉE
                  </span>
                  
                  <p className="text-xs font-bold text-neutral-300 mt-1">
                    Scanné à {formatScanTime(pass.entryUsedAt)}
                  </p>
                  
                  <p className="text-xs text-neutral-400 mt-2 max-w-xs leading-relaxed">
                    Votre accès a été enregistré aux portes de l'événement. Bienvenue et passez une excellente soirée !
                  </p>
                </div>
              )}

            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════ */}
          {/* TAB 2: SCAN BOISSON (DRINK VOUCHER)                            */}
          {/* ═══════════════════════════════════════════════════════════════ */}
          {activeTab === "drink" && (
            <div className="flex flex-col items-center text-center animate-in fade-in duration-200">
              
              {/* Highlight of chosen beverage */}
              <div className="w-full p-3 rounded-2xl bg-gradient-to-r from-teal-500/15 via-emerald-500/10 to-teal-500/15 border border-teal-500/30 mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-teal-400/20 text-teal-400 flex items-center justify-center font-bold">
                    🍹
                  </div>
                  <div className="text-left">
                    <span className="text-[10px] uppercase font-bold text-neutral-400 block">Consommation</span>
                    <span className="text-sm font-black text-white">
                      {pass.selectedDrink}
                      {pass.selectedAromas && pass.selectedAromas.length > 0
                        ? ` (${pass.selectedAromas.join(", ")})`
                        : ""}
                    </span>
                  </div>
                </div>
                <span className="text-xs font-black text-teal-400 px-2 py-0.5 rounded-full bg-teal-400/10 border border-teal-400/20">
                  Offert
                </span>
              </div>

              {!pass.isDrinkUsed ? (
                /* ACTIVE DRINK QR CODE */
                <div className="flex flex-col items-center">
                  <div className="p-4 sm:p-5 rounded-3xl bg-white shadow-2xl border-4 border-teal-400/30 transition-all hover:scale-[1.01]">
                    <QRCodeSVG
                      value={pass.drinkToken}
                      size={210}
                      level="H"
                      fgColor="#0F172A"
                      bgColor="#FFFFFF"
                    />
                  </div>

                  <div className="mt-4 flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-teal-400/10 text-teal-300 border border-teal-400/25">
                    <Wine className="w-3.5 h-3.5" />
                    <span>SCAN BOISSON • COUPON ACTIF</span>
                  </div>

                  <p className="text-xs text-neutral-400 mt-2 max-w-xs leading-relaxed">
                    Présentez ce QR Code au barman pour obtenir votre <strong>{pass.selectedDrink}</strong>.
                  </p>
                </div>
              ) : (
                /* FIXED BADGE: ONCE CLAIMED, DRINK QR DISAPPEARS PERMANENTLY */
                <div className="w-full py-8 px-6 rounded-2xl bg-teal-500/10 border-2 border-teal-500/40 flex flex-col items-center text-center animate-in zoom-in-95 duration-300">
                  <div className="w-16 h-16 rounded-full bg-teal-500/20 text-teal-300 border border-teal-500/40 flex items-center justify-center mb-3">
                    <CheckCircle2 className="w-9 h-9" />
                  </div>
                  
                  <span className="text-lg font-black text-teal-300 tracking-tight">
                    ✅ BOISSON RÉCUPÉRÉE
                  </span>
                  
                  <p className="text-xs font-bold text-neutral-300 mt-1">
                    Scanné à {formatScanTime(pass.drinkUsedAt)}
                  </p>
                  
                  <p className="text-xs text-neutral-400 mt-2 max-w-xs leading-relaxed">
                    Votre consommation ({pass.selectedDrink}) a été servie avec succès au bar. Santé !
                  </p>
                </div>
              )}

            </div>
          )}

          {/* Live Scanner Sync Status Note */}
          <div className="mt-6 pt-4 border-t border-neutral-800 flex items-center justify-between text-[11px] text-neutral-500">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Synchronisation temps réel active
            </span>
            <span>Passi Web Pass</span>
          </div>

        </div>

        {/* ─── SHARING SECTION (FOR MULTI-PASS & FRIENDS FORWARDING) ─── */}
        <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-neutral-300 flex items-center gap-1.5">
              <Share2 className="w-4 h-4 text-emerald-400" />
              Transférer ce pass à un ami
            </span>
            <span className="text-[10px] text-neutral-500">Lien individuel</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-[#25D366]/15 hover:bg-[#25D366]/25 border border-[#25D366]/30 text-[#25D366] text-xs font-bold transition-all active:scale-[0.98]"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>WhatsApp</span>
            </a>

            <button
              onClick={handleCopyLink}
              className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-neutral-800 hover:bg-neutral-700/80 border border-neutral-700 text-white text-xs font-bold transition-all active:scale-[0.98] cursor-pointer"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Copié !</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-neutral-400" />
                  <span>Copier le lien</span>
                </>
              )}
            </button>
          </div>
        </div>

      </main>

      {/* ─── FOOTER ─── */}
      <footer className="py-4 text-center text-xs text-neutral-600 border-t border-neutral-900">
        <p>Propulsé par <strong>Passi</strong> • Plateforme Officielle de Billetterie</p>
      </footer>

    </div>
  );
}
