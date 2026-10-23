"use client";

import React from "react";

export interface ReservationCardProps {
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
  };
}

export function ReservationCard({ reservation }: ReservationCardProps) {
  // Calculate remaining time from created_at (48 hours limit)
  const createdAt = reservation.created_at ? new Date(reservation.created_at) : new Date();
  const expiryDate = new Date(createdAt.getTime() + 48 * 60 * 60 * 1000);
  const now = new Date();
  const hoursLeft = Math.max(0, Math.floor((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60)));

  const event = reservation.event || reservation.events;
  const eventTitle = event?.title || "Événement Passi";
  const posLocation = event?.pos_location || (reservation as any).pos_location || "L'Agora Djerba";
  const totalPrice = reservation.total_price ?? reservation.final_price ?? event?.base_price ?? 0;
  const guestName = [reservation.guest_first_name, reservation.guest_last_name].filter(Boolean).join(" ");

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl text-white transition-all hover:border-slate-700">
      <div className="flex justify-between items-start gap-4">
        <div>
          <span className="text-xs bg-amber-500/10 text-amber-400 px-2.5 py-1 rounded-full font-medium inline-block">
            ⏳ En attente de paiement
          </span>
          <h3 className="text-xl font-bold mt-2 text-white">{eventTitle}</h3>
          {guestName && (
            <p className="text-xs text-slate-400 mt-1">Invité : {guestName}</p>
          )}
        </div>
        <span className="text-lg font-bold text-purple-400 shrink-0">{totalPrice} TND</span>
      </div>

      {/* Selected Drink Information (if any) */}
      {reservation.drink_name && (
        <div className="mt-3 flex items-center gap-2 text-xs text-slate-300 bg-slate-800/40 px-3 py-1.5 rounded-lg border border-slate-700/40 w-fit">
          <span className="text-amber-400">🍹</span>
          <span className="font-medium text-slate-200">{reservation.drink_name}</span>
          {reservation.selected_aromas && reservation.selected_aromas.length > 0 && (
            <span className="text-slate-400">({reservation.selected_aromas.join(', ')})</span>
          )}
        </div>
      )}

      {/* POS Payment Location Info */}
      <div className="mt-4 bg-slate-800/60 rounded-xl p-4 border border-slate-700/50 space-y-2 text-sm">
        <p className="flex items-center gap-2 text-slate-300">
          <span>📍 Point de vente (POS) :</span>
          <strong className="text-white">{posLocation}</strong>
        </p>
        <p className="text-xs text-slate-400">
          Présentez votre QR code ou référence de pass sur place pour régler et valider définitivement votre accès.
        </p>
      </div>

      {/* 48-Hour Urgency Warning */}
      <div className="mt-4 bg-red-500/10 border border-red-500/20 rounded-xl p-3 flex items-start gap-3">
        <span className="text-red-400 text-lg leading-none">⚠️</span>
        <div className="text-xs">
          <p className="font-semibold text-red-300">Attention : Délai de paiement de 48h</p>
          <p className="text-red-400/80 mt-0.5">
            Vous avez <strong>{hoursLeft}h restantes</strong> pour régler votre pass au point de vente. Passé ce délai, votre réservation sera automatiquement annulée et refusée.
          </p>
        </div>
      </div>
    </div>
  );
}

export default ReservationCard;
