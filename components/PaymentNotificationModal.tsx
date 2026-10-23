"use client";

import React, { useEffect } from "react";
import { X, AlertTriangle, MapPin, Clock, CheckCircle2, Ticket } from "lucide-react";

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
    } | null;
    events?: {
      title?: string;
      pos_location?: string;
      base_price?: number;
      location?: string;
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
  // Close on Escape key press
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
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

  return (
    <div
      className="fixed inset-0 z-[999] flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg bg-slate-900 border border-slate-700/80 rounded-[2.5rem] shadow-2xl overflow-hidden text-white animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Gradient Accent Bar */}
        <div className="h-2 bg-gradient-to-r from-amber-500 via-purple-600 to-rose-500" />

        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer"
          className="absolute top-5 right-5 w-9 h-9 rounded-full bg-slate-800/80 border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700 transition flex items-center justify-center cursor-pointer shadow-sm"
        >
          <X size={18} />
        </button>

        <div className="p-6 sm:p-8 space-y-5">
          {/* Top Icon & Headline */}
          <div className="text-center space-y-2">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto shadow-lg shadow-amber-500/10">
              <AlertTriangle size={28} />
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Rappel de Paiement Requis
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 max-w-sm mx-auto leading-relaxed">
              Votre réservation a bien été enregistrée. Pour valider définitivement votre accès, veuillez suivre ces instructions :
            </p>
          </div>

          {/* Reservation Card Details */}
          <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-5 space-y-3.5 shadow-inner">
            <div className="flex justify-between items-start gap-3">
              <div>
                <span className="text-[11px] bg-amber-500/15 text-amber-400 px-2.5 py-0.5 rounded-full font-bold border border-amber-500/20 inline-block">
                  ⏳ En attente de paiement
                </span>
                <h3 className="text-lg font-extrabold mt-1.5 text-white leading-snug">{eventTitle}</h3>
                {guestName && (
                  <p className="text-xs text-slate-400 mt-0.5">Invité : {guestName}</p>
                )}
              </div>
              <span className="text-base sm:text-lg font-black text-purple-400 shrink-0">{totalPrice} TND</span>
            </div>

            {/* Selected Drink Info */}
            {reservation.drink_name && (
              <div className="flex items-center gap-2 text-xs text-slate-300 bg-slate-800/50 px-3 py-1.5 rounded-lg border border-slate-700/40 w-fit">
                <span className="text-amber-400">🍹</span>
                <span className="font-medium text-slate-200">{reservation.drink_name}</span>
                {reservation.selected_aromas && reservation.selected_aromas.length > 0 && (
                  <span className="text-slate-400">({reservation.selected_aromas.join(', ')})</span>
                )}
              </div>
            )}

            {/* POS Payment Location Info */}
            <div className="bg-slate-800/70 rounded-xl p-3.5 border border-slate-700/60 space-y-1.5 text-xs sm:text-sm">
              <p className="flex items-center gap-2 text-slate-200 font-medium">
                <span className="text-base leading-none">📍</span>
                <span>Point de vente (POS) :</span>
                <strong className="text-white font-extrabold underline decoration-purple-400 decoration-2 underline-offset-2">{posLocation}</strong>
              </p>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Présentez votre QR code ou référence de pass sur place pour régler et valider définitivement votre accès.
              </p>
            </div>

            {/* 72-Hour Urgency Warning */}
            <div className="bg-red-500/15 border border-red-500/30 rounded-xl p-3.5 flex items-start gap-3">
              <span className="text-red-400 text-lg leading-none shrink-0 mt-0.5">⚠️</span>
              <div className="text-xs">
                <p className="font-bold text-red-300">Attention : Délai de paiement de 72h</p>
                <p className="text-red-400/90 mt-0.5 leading-relaxed">
                  Vous avez <strong>{hoursLeft}h restantes</strong> pour régler votre pass au point de vente. Passé ce délai (72h), votre réservation sera automatiquement annulée et refusée.
                </p>
              </div>
            </div>
          </div>

          {/* Acknowledgement / Dismiss Button */}
          <div className="pt-1">
            <button
              type="button"
              onClick={onClose}
              className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-purple-600 via-pink-600 to-passi-corail hover:opacity-95 text-white font-extrabold text-sm sm:text-base shadow-xl shadow-purple-950/40 flex items-center justify-center gap-2 transition-all hover:scale-[1.01] active:scale-95 cursor-pointer"
            >
              <CheckCircle2 size={19} />
              <span>J'ai bien compris</span>
            </button>
            <p className="text-[11px] text-center text-slate-400 mt-2">
              Cette notification reste consultable à tout moment dans <strong>Mes réservations</strong>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PaymentNotificationModal;
