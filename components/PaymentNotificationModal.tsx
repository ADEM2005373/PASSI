"use client";

import React, { useEffect } from "react";
import { 
  X, 
  AlertTriangle, 
  MapPin, 
  Clock, 
  CheckCircle2, 
  Ticket, 
  Sparkles, 
  Calendar,
  ShieldAlert,
  ArrowRight
} from "lucide-react";
import { Logo } from "@/components/Logo";

export interface PaymentNotificationModalProps {
  reservation: {
    id?: string;
    created_at?: string;
    total_price?: number;
    final_price?: number;
    guest_first_name?: string;
    guest_last_name?: string;
    drink_name?: string | null;
    selected_aromas?: string[] | null;
    entry_status?: string;
    status?: string;
    event?: {
      title?: string;
      pos_location?: string;
      base_price?: number;
      location?: string;
      date?: string;
    } | null;
    events?: {
      title?: string;
      pos_location?: string;
      base_price?: number;
      location?: string;
      date?: string;
    } | null;
    [key: string]: any;
  } | null;
  isOpen: boolean;
  onClose: () => void;
}

export function PaymentNotificationModal({
  reservation,
  isOpen,
  onClose,
}: PaymentNotificationModalProps) {
  // Lock body scroll while full-screen card is open
  useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !reservation) return null;

  // Calculate remaining time from created_at (72 hours limit)
  const createdAt = reservation.created_at ? new Date(reservation.created_at) : new Date();
  const expiryDate = new Date(createdAt.getTime() + 72 * 60 * 60 * 1000);
  const now = new Date();
  const hoursLeft = Math.max(0, Math.floor((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60)));

  const event = reservation.event || reservation.events;
  const eventTitle = event?.title || "Événement Passi";
  const eventDate = event?.date || "";
  const eventLocation = event?.location || "";
  const posLocation = event?.pos_location || (reservation as any).pos_location || "L'Agora Djerba";
  const totalPrice = reservation.total_price ?? reservation.final_price ?? event?.base_price ?? 0;
  const guestName = [reservation.guest_first_name, reservation.guest_last_name].filter(Boolean).join(" ");
  const passRef = reservation.id ? `#${reservation.id.slice(0, 8).toUpperCase()}` : "";

  return (
    <div 
      className="fixed inset-0 z-[99999] w-screen h-screen min-h-screen bg-slate-950 text-white overflow-y-auto flex flex-col justify-between animate-in fade-in duration-300"
      role="dialog"
      aria-modal="true"
    >
      {/* Background Ambient Lighting Effects */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[700px] h-[500px] bg-gradient-to-b from-purple-600/25 via-pink-600/15 to-transparent rounded-full blur-[140px]" />
        <div className="absolute top-1/3 -left-40 w-96 h-96 bg-amber-500/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-10 -right-40 w-[500px] h-[500px] bg-passi-corail/15 rounded-full blur-[150px]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.04)_0%,_transparent_70%)]" />
      </div>

      {/* Top Header Bar */}
      <header className="relative z-10 w-full px-6 py-5 md:px-12 flex items-center justify-between border-b border-slate-800/80 bg-slate-950/70 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <Logo variant="dark" className="w-[110px] h-[32px]" />
          <span className="hidden sm:inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-amber-400 bg-amber-500/15 px-3 py-1 rounded-full border border-amber-500/30">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
            Paiement Requis
          </span>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800 hover:border-slate-600 transition shadow-sm text-xs font-semibold cursor-pointer group"
          aria-label="Fermer la notification"
        >
          <span>Fermer</span>
          <X size={16} className="group-hover:rotate-90 transition-transform duration-200" />
        </button>
      </header>

      {/* Main Full-Screen Display Card Content */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 py-8 md:py-12 max-w-4xl mx-auto w-full">
        {/* Urgent Header Badge & Main Title */}
        <div className="text-center space-y-3 mb-8 w-full">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs sm:text-sm font-extrabold tracking-wide uppercase shadow-lg shadow-amber-500/10">
            <AlertTriangle size={16} className="text-amber-400" />
            <span>Action Requise pour Valider Votre Accès</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight leading-tight">
            Notification de Paiement
          </h1>
          <p className="text-slate-300 text-sm sm:text-base max-w-xl mx-auto leading-relaxed">
            Votre demande de pass a été enregistrée avec succès. Veuillez suivre les instructions ci-dessous pour régler et activer votre billet.
          </p>
        </div>

        {/* Central Display Card (Full-Featured Pass Notification) */}
        <div className="w-full bg-slate-900/90 border border-slate-700/80 rounded-[2.5rem] shadow-2xl p-6 sm:p-10 backdrop-blur-xl relative overflow-hidden space-y-6">
          {/* Top Decorative Color Bar */}
          <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-amber-500 via-purple-600 to-passi-corail" />

          {/* Block 1: Reservation Details Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-6 border-b border-slate-800">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 px-3 py-1 rounded-full border border-amber-500/30">
                  ⏳ En attente de règlement
                </span>
                {passRef && (
                  <span className="text-xs font-mono text-slate-400 bg-slate-800/80 px-2.5 py-0.5 rounded-md border border-slate-700/60">
                    {passRef}
                  </span>
                )}
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white mt-1">
                {eventTitle}
              </h2>
              <div className="flex flex-wrap items-center gap-3 text-xs sm:text-sm text-slate-400 pt-0.5">
                {guestName && (
                  <span>👤 Invité : <strong className="text-slate-200">{guestName}</strong></span>
                )}
                {eventLocation && (
                  <span>📍 {eventLocation}</span>
                )}
                {eventDate && (
                  <span>📅 {eventDate}</span>
                )}
              </div>
            </div>

            {/* Price Tag */}
            <div className="bg-gradient-to-br from-purple-900/50 to-pink-900/40 border border-purple-500/30 rounded-2xl px-5 py-3 sm:text-right shrink-0">
              <span className="text-[11px] uppercase tracking-wider text-purple-300 font-bold block">Montant à régler</span>
              <span className="text-2xl sm:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-300 via-pink-300 to-white">
                {totalPrice} TND
              </span>
            </div>
          </div>

          {/* Selected Drink Banner (if present) */}
          {reservation.drink_name && (
            <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-xl shrink-0">
                  🍹
                </div>
                <div>
                  <span className="text-[11px] text-slate-400 uppercase tracking-wider font-bold block">Boisson incluse avec le pass</span>
                  <div className="text-sm font-bold text-white flex items-center gap-2">
                    <span>{reservation.drink_name}</span>
                    {reservation.selected_aromas && reservation.selected_aromas.length > 0 && (
                      <span className="text-xs font-normal text-amber-300/90 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                        {reservation.selected_aromas.join(', ')}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <Sparkles className="w-5 h-5 text-amber-400 shrink-0 hidden sm:block" />
            </div>
          )}

          {/* Block 2: Designated POS (Point de Vente) Showcase */}
          <div className="bg-gradient-to-r from-purple-950/70 via-slate-900 to-indigo-950/70 border border-purple-500/40 rounded-3xl p-5 sm:p-6 space-y-3 shadow-lg">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-purple-500/20 border border-purple-500/40 text-purple-300 flex items-center justify-center text-xl shrink-0">
                <MapPin size={24} className="text-purple-400" />
              </div>
              <div>
                <span className="text-xs text-purple-300 font-extrabold uppercase tracking-wider block">Point de Vente Désigné (POS)</span>
                <p className="text-xl sm:text-2xl font-black text-white underline decoration-purple-400 decoration-2 underline-offset-4">
                  {posLocation}
                </p>
              </div>
            </div>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed pl-1">
              Rendez-vous directement au point de vente ci-dessus pour régler votre pass en espèces ou par carte. Présentez votre nom ou votre référence de pass <strong>{passRef || ""}</strong> pour validation immédiate par le caissier.
            </p>
          </div>

          {/* Block 3: 72-Hour Urgency Alert */}
          <div className="bg-gradient-to-r from-red-950/70 via-rose-950/50 to-slate-900 border border-red-500/40 rounded-3xl p-5 sm:p-6 space-y-3">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-red-500/20 border border-red-500/40 text-red-400 flex items-center justify-center shrink-0">
                  <Clock size={24} />
                </div>
                <div>
                  <span className="text-xs text-red-300 font-extrabold uppercase tracking-wider block">Délai Limite de Règlement</span>
                  <p className="text-lg sm:text-xl font-black text-red-200">
                    Compte à rebours : 72 Heures
                  </p>
                </div>
              </div>
              <div className="bg-red-500/20 border border-red-500/30 rounded-2xl px-4 py-2 text-center shrink-0">
                <span className="text-lg sm:text-2xl font-black text-red-400 block">{hoursLeft}h</span>
                <span className="text-[10px] uppercase font-bold text-red-300/80">restantes</span>
              </div>
            </div>
            <p className="text-xs sm:text-sm text-red-300/90 leading-relaxed pl-1">
              ⚠️ <strong>Attention :</strong> Vous disposez de <strong>{hoursLeft} heures</strong> pour régler votre pass au point de vente. Passé ce délai strict de <strong>72h</strong>, les réservations non payées sont automatiquement annulées et les places remises en vente.
            </p>
          </div>
        </div>

        {/* Action Button: Mandatory Acknowledgement / Close */}
        <div className="w-full mt-6 space-y-3 text-center">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-5 px-8 rounded-2xl bg-gradient-to-r from-purple-600 via-pink-600 to-passi-corail hover:opacity-95 text-white font-black text-base sm:text-lg shadow-2xl shadow-purple-900/50 flex items-center justify-center gap-3 transition-all hover:scale-[1.01] active:scale-95 cursor-pointer"
          >
            <CheckCircle2 size={24} className="text-white" />
            <span>J'ai bien compris — Continuer vers mon espace</span>
            <ArrowRight size={20} className="text-white/80" />
          </button>
          <p className="text-xs text-slate-400">
            En fermant cette carte, vous confirmez avoir pris connaissance des consignes de règlement au point de vente <strong>{posLocation}</strong> sous 72h.
          </p>
        </div>
      </main>

      {/* Footer Info */}
      <footer className="relative z-10 w-full px-6 py-4 text-center border-t border-slate-800/80 bg-slate-950/70 text-xs text-slate-500">
        Cette notification reste toujours consultable à tout moment dans votre onglet <strong className="text-slate-300">Mes réservations</strong>.
      </footer>
    </div>
  );
}

export default PaymentNotificationModal;
