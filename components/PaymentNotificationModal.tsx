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
  ArrowRight
} from "lucide-react";

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
  // Lock background scrolling while the modal card is shown on screen
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
  const posLocation = event?.pos_location || (reservation as any).pos_location || "L'Agora Djerba";
  const totalPrice = reservation.total_price ?? reservation.final_price ?? event?.base_price ?? 0;
  const guestName = [reservation.guest_first_name, reservation.guest_last_name].filter(Boolean).join(" ");
  const passRef = reservation.id ? `#${reservation.id.slice(0, 8).toUpperCase()}` : "";

  return (
    <div 
      className="fixed inset-0 z-[99999] flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-2xl overflow-y-auto animate-in fade-in duration-300"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      {/* Centered Display Card in Middle of Screen */}
      <div 
        className="relative w-full max-w-lg md:max-w-xl my-auto bg-slate-900 border border-slate-700/80 rounded-[2.5rem] shadow-[0_25px_70px_rgba(0,0,0,0.85)] overflow-hidden text-white animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Gradient Accent Bar */}
        <div className="h-2.5 bg-gradient-to-r from-amber-500 via-purple-600 to-passi-corail" />

        {/* Top-Right Close Button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer la notification"
          className="absolute top-5 right-5 w-10 h-10 rounded-full bg-slate-800/90 border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700 hover:scale-105 transition flex items-center justify-center cursor-pointer shadow-md group z-20"
        >
          <X size={18} className="group-hover:rotate-90 transition-transform duration-200" />
        </button>

        <div className="p-6 sm:p-8 space-y-5">
          {/* Top Icon & Headline */}
          <div className="text-center space-y-2.5 pt-1">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto shadow-xl shadow-amber-500/15">
              <AlertTriangle size={32} />
            </div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/25 text-xs font-black uppercase tracking-wider">
              <span>⏳ Paiement Requis</span>
              {passRef && <span className="opacity-70 font-mono">({passRef})</span>}
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Rappel de Paiement
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 max-w-md mx-auto leading-relaxed">
              Votre réservation a bien été enregistrée. Pour valider définitivement votre accès, veuillez suivre ces instructions :
            </p>
          </div>

          {/* Reservation Card Details */}
          <div className="bg-slate-950/75 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-inner">
            <div className="flex justify-between items-start gap-3">
              <div>
                <span className="text-[11px] bg-amber-500/15 text-amber-400 px-2.5 py-0.5 rounded-full font-bold border border-amber-500/20 inline-block">
                  En attente de paiement
                </span>
                <h3 className="text-lg sm:text-xl font-extrabold mt-1.5 text-white leading-snug">
                  {eventTitle}
                </h3>
                {guestName && (
                  <p className="text-xs text-slate-400 mt-0.5">Invité : <strong className="text-slate-200">{guestName}</strong></p>
                )}
              </div>
              <span className="text-lg sm:text-xl font-black text-purple-400 shrink-0">
                {totalPrice} TND
              </span>
            </div>

            {/* Selected Drink Info */}
            {reservation.drink_name && (
              <div className="flex items-center gap-2 text-xs text-slate-300 bg-slate-800/60 px-3 py-2 rounded-xl border border-slate-700/50 w-fit">
                <span className="text-amber-400 text-sm">🍹</span>
                <span className="font-semibold text-slate-100">{reservation.drink_name}</span>
                {reservation.selected_aromas && reservation.selected_aromas.length > 0 && (
                  <span className="text-slate-400">({reservation.selected_aromas.join(', ')})</span>
                )}
              </div>
            )}

            {/* POS Payment Location Info */}
            <div className="bg-slate-800/80 rounded-xl p-4 border border-slate-700/60 space-y-1.5 text-xs sm:text-sm">
              <p className="flex items-center gap-2 text-slate-200 font-semibold">
                <span className="text-base leading-none">📍</span>
                <span>Point de vente (POS) :</span>
                <strong className="text-white font-extrabold underline decoration-purple-400 decoration-2 underline-offset-2">
                  {posLocation}
                </strong>
              </p>
              <p className="text-[11px] text-slate-400 leading-relaxed pl-6">
                Présentez votre nom ou votre référence de pass sur place pour régler et valider définitivement votre accès.
              </p>
            </div>

            {/* 72-Hour Urgency Warning */}
            <div className="bg-red-500/15 border border-red-500/30 rounded-xl p-4 flex items-start gap-3">
              <Clock size={20} className="text-red-400 shrink-0 mt-0.5" />
              <div className="text-xs space-y-1">
                <p className="font-extrabold text-red-300 flex items-center justify-between">
                  <span>Attention : Délai de paiement de 72h</span>
                  <span className="bg-red-500/20 px-2 py-0.5 rounded text-[11px] font-black text-red-400">
                    {hoursLeft}h restantes
                  </span>
                </p>
                <p className="text-red-400/90 leading-relaxed">
                  Vous avez <strong>{hoursLeft}h restantes</strong> pour régler votre pass au point de vente. Passé ce délai (72h), votre réservation sera automatiquement annulée.
                </p>
              </div>
            </div>
          </div>

          {/* Acknowledgement & Close Button */}
          <div className="pt-2 space-y-2.5">
            <button
              type="button"
              onClick={onClose}
              className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-purple-600 via-pink-600 to-passi-corail hover:opacity-95 text-white font-extrabold text-sm sm:text-base shadow-xl shadow-purple-950/40 flex items-center justify-center gap-2.5 transition-all hover:scale-[1.01] active:scale-95 cursor-pointer"
            >
              <CheckCircle2 size={20} />
              <span>J'ai bien compris — Fermer</span>
            </button>
            <p className="text-[11px] text-center text-slate-400">
              Cliquez pour fermer la carte et retourner sur votre page.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PaymentNotificationModal;
