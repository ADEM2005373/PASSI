"use client";

import { useState, useEffect } from "react";
import { QRCodeSVG } from "qrcode.react";
import { 
  Ticket, 
  Beer, 
  CheckCircle2, 
  Crown, 
  Gift, 
  Mail, 
  Check, 
  X, 
  Wine, 
  Loader2, 
  Sparkles,
  AlertCircle
} from "lucide-react";
import { api, Pass } from "@/lib/services/api";

type PassCardProps = {
  pass: Pass;
  onUpdate?: (updatedPass: Pass) => void;
};

export function PassCard({ pass, onUpdate }: PassCardProps) {
  const [localPass, setLocalPass] = useState<Pass>(pass);
  const [activeTab, setActiveTab] = useState<"entry" | "drink">("entry");

  // Drink Selection state
  const [selectedDrinkId, setSelectedDrinkId] = useState<string>("");
  const [isSubmittingDrink, setIsSubmittingDrink] = useState(false);
  const [drinkError, setDrinkError] = useState<string | null>(null);

  // Invitation response state
  const [isRespondingInvitation, setIsRespondingInvitation] = useState(false);
  const [invitationError, setInvitationError] = useState<string | null>(null);

  // Sync props to state
  useEffect(() => {
    setLocalPass(pass);
  }, [pass]);

  const passType = (localPass.pass_type || "NORMAL").toUpperCase();
  const isVip = passType === "VIP";
  const isGift = passType === "GIFT";
  const isInvitation = passType === "INVITATION";
  const isSpecialPass = isVip || isGift || (isInvitation && localPass.invitation_status === "ACCEPTED");

  // Check if invitation is pending
  const isPendingInvitation = isInvitation && localPass.invitation_status === "PENDING";
  const isDeclinedInvitation = isInvitation && localPass.invitation_status === "DECLINED";

  // Check if drink tab should be available:
  // 1. Pass already has a drink attached (drink_id or drink_status)
  // 2. OR Pass is eligible for asynchronous drink selection (VIP, GIFT, ACCEPTED INVITATION) and available drinks exist
  const hasAvailableDrinks = (localPass.available_drinks && localPass.available_drinks.length > 0) || false;
  const hasDrinkTab = 
    Boolean(localPass.drink_id || (localPass.drink_status && localPass.drink_status !== "none")) ||
    (isSpecialPass && hasAvailableDrinks);

  // Handle invitation accept or decline
  const handleInvitationResponse = async (action: "accept" | "decline") => {
    setIsRespondingInvitation(true);
    setInvitationError(null);
    try {
      const res = await api.respondToInvitation(localPass.id, action);
      if (res.pass) {
        setLocalPass(res.pass);
        if (onUpdate) onUpdate(res.pass);
      }
    } catch (err: any) {
      console.error("Invitation response error:", err);
      setInvitationError(err.message || "Erreur lors de la réponse");
    } finally {
      setIsRespondingInvitation(false);
    }
  };

  // Handle drink selection submission
  const handleSelectDrink = async () => {
    if (!selectedDrinkId) return;
    setIsSubmittingDrink(true);
    setDrinkError(null);
    try {
      const res = await api.selectPassDrink(localPass.id, selectedDrinkId);
      if (res.pass) {
        setLocalPass(res.pass);
        if (onUpdate) onUpdate(res.pass);
      }
    } catch (err: any) {
      console.error("Select drink error:", err);
      setDrinkError(err.message || "Erreur lors de la sélection");
    } finally {
      setIsSubmittingDrink(false);
    }
  };

  const drinkQrValue = localPass.drink_qr_code || localPass.drink_qr_uuid;
  const entryQrValue = localPass.entry_qr_uuid;

  return (
    <div
      className={`rounded-[2.5rem] p-6 shadow-2xl flex flex-col w-full max-w-md mx-auto h-full relative transition-all duration-300 ${
        isVip
          ? "bg-gradient-to-b from-[#1c1813] via-[#14110d] to-[#0a0907] border-2 border-amber-500/70 shadow-[0_0_40px_rgba(245,158,11,0.22)]"
          : isGift
          ? "bg-gradient-to-b from-[#121c17] via-[#0c1410] to-[#090e0b] border-2 border-emerald-500/50 shadow-[0_0_35px_rgba(16,185,129,0.18)]"
          : isInvitation
          ? "bg-gradient-to-b from-[#181524] via-[#110e1c] to-[#0a0812] border-2 border-purple-500/50 shadow-[0_0_35px_rgba(168,85,247,0.18)]"
          : "bg-[#121212] border border-[#2a2a2a]"
      }`}
    >
      {/* Top Special Badge */}
      <div className="flex items-center justify-between mb-4">
        {isVip && (
          <div className="w-full flex items-center justify-center">
            <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-gradient-to-r from-amber-500/20 via-yellow-500/20 to-amber-500/20 border border-amber-500/40 text-amber-300 font-black text-xs uppercase tracking-widest shadow-sm">
              <Crown size={14} className="text-amber-400" />
              <span>VIP Pass Exclusif</span>
              <Sparkles size={14} className="text-amber-400" />
            </span>
          </div>
        )}

        {isGift && (
          <div className="w-full flex items-center justify-center">
            <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-bold text-xs uppercase tracking-wider">
              <Gift size={14} className="text-emerald-400" />
              <span>Pass Cadeau Offert</span>
            </span>
          </div>
        )}

        {isInvitation && (
          <div className="w-full flex items-center justify-center">
            <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-purple-500/20 border border-purple-500/40 text-purple-300 font-bold text-xs uppercase tracking-wider">
              <Mail size={14} className="text-purple-400" />
              <span>Invitation Officielle</span>
            </span>
          </div>
        )}
      </div>

      {/* INVITATION PENDING FLOW: QR code is hidden until user accepts */}
      {isPendingInvitation ? (
        <div className="flex flex-col items-center justify-center flex-1 py-6 text-center animate-in fade-in duration-300">
          <div className="w-16 h-16 rounded-3xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400 mb-4 shadow-lg shadow-purple-500/10">
            <Mail size={32} />
          </div>
          <span className="text-xs font-bold uppercase tracking-widest text-purple-400 mb-1">
            Invitation en attente
          </span>
          <h3 className="text-2xl font-black text-white mb-2 leading-tight">
            {localPass.events?.title || "Événement Passi"}
          </h3>
          <p className="text-sm text-neutral-300 mb-6 max-w-xs leading-relaxed font-medium">
            Vous avez été invité(e) d'honneur à cet événement. Veuillez confirmer votre présence pour débloquer votre Pass d'accès.
          </p>

          {invitationError && (
            <div className="mb-4 text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 px-3 py-2 rounded-xl flex items-center gap-2">
              <AlertCircle size={14} />
              <span>{invitationError}</span>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3 w-full max-w-xs">
            <button
              onClick={() => handleInvitationResponse("accept")}
              disabled={isRespondingInvitation}
              className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-extrabold text-sm bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-neutral-950 shadow-lg shadow-emerald-500/25 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              {isRespondingInvitation ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Check size={16} />
              )}
              <span>Accepter</span>
            </button>
            <button
              onClick={() => handleInvitationResponse("decline")}
              disabled={isRespondingInvitation}
              className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-bold text-sm bg-white/10 hover:bg-rose-500/20 text-neutral-300 hover:text-rose-300 border border-white/10 hover:border-rose-500/30 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              <X size={16} />
              <span>Décliner</span>
            </button>
          </div>
        </div>
      ) : isDeclinedInvitation ? (
        <div className="flex flex-col items-center justify-center flex-1 py-10 text-center">
          <div className="w-16 h-16 rounded-3xl bg-neutral-800 flex items-center justify-center text-neutral-500 mb-4">
            <X size={32} />
          </div>
          <h3 className="text-xl font-bold text-neutral-300 mb-1">Invitation déclinée</h3>
          <p className="text-xs text-neutral-500">Vous avez décliné l'invitation à cet événement.</p>
        </div>
      ) : (
        /* STANDARD & ACCEPTED PASS VIEW: DUAL TABS (ENTRY / DRINK) */
        <>
          {/* Dual-tab toggle */}
          <div
            className={`flex rounded-full p-1.5 mb-6 border ${
              isVip
                ? "bg-[#18140f] border-amber-500/30"
                : isGift
                ? "bg-[#0d1712] border-emerald-500/30"
                : isInvitation
                ? "bg-[#120f1c] border-purple-500/30"
                : "bg-[#1e1e1e] border-[#2a2a2a]"
            }`}
          >
            <button
              onClick={() => setActiveTab("entry")}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-full text-xs sm:text-sm font-bold transition-all duration-300 ${
                activeTab === "entry"
                  ? isVip
                    ? "bg-gradient-to-r from-amber-500 to-yellow-500 text-neutral-950 shadow-lg shadow-amber-500/30"
                    : isGift
                    ? "bg-emerald-500 text-neutral-950 shadow-lg shadow-emerald-500/30"
                    : isInvitation
                    ? "bg-purple-500 text-white shadow-lg shadow-purple-500/30"
                    : "bg-[#DC143C] text-white shadow-lg"
                  : "bg-transparent text-neutral-400 hover:text-white"
              }`}
            >
              <Ticket size={16} />
              <span>Accès Entrée</span>
            </button>

            {hasDrinkTab && (
              <button
                onClick={() => setActiveTab("drink")}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-full text-xs sm:text-sm font-bold transition-all duration-300 ${
                  activeTab === "drink"
                    ? isVip
                      ? "bg-gradient-to-r from-amber-500 to-yellow-500 text-neutral-950 shadow-lg shadow-amber-500/30"
                      : isGift
                      ? "bg-emerald-500 text-neutral-950 shadow-lg shadow-emerald-500/30"
                      : isInvitation
                      ? "bg-purple-500 text-white shadow-lg shadow-purple-500/30"
                      : "bg-[#DC143C] text-white shadow-lg"
                    : "bg-transparent text-neutral-400 hover:text-white"
                }`}
              >
                <Beer size={16} />
                <span>Consommation</span>
              </button>
            )}
          </div>

          {/* QR Code & Content */}
          <div className="flex flex-col items-center justify-center flex-1 py-2">
            {/* 1. ENTRY TAB */}
            {activeTab === "entry" && (
              <div className="animate-in fade-in zoom-in duration-300 flex flex-col items-center w-full">
                {localPass.entry_status === "scanned" ? (
                  <div className="flex flex-col items-center text-center my-6">
                    <div className="w-20 h-20 bg-neutral-900 rounded-full flex items-center justify-center mb-6 border border-neutral-800">
                      <CheckCircle2 className="text-emerald-400" size={40} />
                    </div>
                    <h3 className="text-2xl font-black text-white">Pass d'entrée validé</h3>
                    <p className="text-neutral-400 mt-1 font-medium text-sm">Entrée déjà scannée à la porte.</p>
                  </div>
                ) : entryQrValue ? (
                  <>
                    <div
                      className={`p-5 rounded-[2rem] shadow-2xl transition-all duration-300 ${
                        isVip
                          ? "bg-white p-5 border-4 border-amber-500/40 shadow-amber-500/20"
                          : "bg-white p-5 border border-gray-100 shadow-black/50"
                      }`}
                    >
                      <QRCodeSVG 
                        value={entryQrValue} 
                        size={210} 
                        level="H"
                        fgColor="#0F172A"
                      />
                    </div>
                    <p className="mt-6 text-neutral-400 text-xs font-bold tracking-widest uppercase flex items-center gap-1.5">
                      <Ticket size={14} className={isVip ? "text-amber-400" : "text-passi-corail"} />
                      <span>Présenter à l'entrée de l'événement</span>
                    </p>
                  </>
                ) : (
                  <div className="w-[210px] h-[210px] bg-neutral-900 rounded-[2rem] flex flex-col items-center justify-center text-neutral-400 text-xs p-4 border border-neutral-800">
                    <Loader2 size={24} className="animate-spin mb-2 text-passi-corail" />
                    <span>Chargement du QR Code...</span>
                  </div>
                )}
              </div>
            )}

            {/* 2. DRINK TAB */}
            {activeTab === "drink" && (
              <div className="animate-in fade-in zoom-in duration-300 flex flex-col items-center w-full">
                {localPass.drink_status === "scanned" ? (
                  <div className="flex flex-col items-center text-center my-6">
                    <div className="w-20 h-20 bg-neutral-900 rounded-full flex items-center justify-center mb-6 border border-neutral-800">
                      <CheckCircle2 className="text-emerald-400" size={40} />
                    </div>
                    <h3 className="text-2xl font-black text-white">Boisson Récupérée</h3>
                    <p className="text-neutral-400 mt-1 font-medium text-sm">Santé et bonne soirée !</p>
                  </div>
                ) : drinkQrValue ? (
                  /* Drink QR Code Already Generated & Active */
                  <>
                    <div
                      className={`p-5 rounded-[2rem] shadow-2xl transition-all duration-300 ${
                        isVip
                          ? "bg-white p-5 border-4 border-amber-500/40 shadow-amber-500/20"
                          : "bg-white p-5 border border-gray-100 shadow-black/50"
                      }`}
                    >
                      <QRCodeSVG 
                        value={drinkQrValue} 
                        size={210} 
                        level="H"
                        fgColor="#0F172A"
                      />
                    </div>
                    <p className="mt-6 text-neutral-200 text-xs font-bold tracking-wide uppercase flex items-center gap-2">
                      <Wine size={15} className="text-amber-400" />
                      <span>{localPass.drink_menus?.name || "Boisson réservée"}</span>
                    </p>
                    <p className="text-[11px] text-neutral-400 mt-1">
                      Présentez ce QR Code directement au barman
                    </p>
                  </>
                ) : (
                  /* ASYNCHRONOUS DRINK SELECTION FORM */
                  <div className="w-full flex flex-col items-center text-center p-1">
                    <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-3">
                      <Wine size={26} />
                    </div>
                    <h3 className="text-lg font-extrabold text-white mb-1">
                      Choisissez votre boisson
                    </h3>
                    <p className="text-xs text-neutral-400 mb-4 max-w-xs leading-relaxed">
                      {isSpecialPass
                        ? "Boisson offerte avec votre pass. Sélectionnez votre consommation ci-dessous :"
                        : "Sélectionnez votre consommation pour cet événement :"}
                    </p>

                    {drinkError && (
                      <div className="mb-3 text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 px-3 py-2 rounded-xl flex items-center gap-2 w-full">
                        <AlertCircle size={14} />
                        <span>{drinkError}</span>
                      </div>
                    )}

                    {/* Drink Selection List */}
                    {hasAvailableDrinks ? (
                      <div className="w-full space-y-2 mb-4 max-h-48 overflow-y-auto px-1 hide-scrollbar">
                        {localPass.available_drinks?.map((drink) => {
                          const isSelected = selectedDrinkId === drink.id;
                          return (
                            <button
                              key={drink.id}
                              type="button"
                              onClick={() => setSelectedDrinkId(drink.id)}
                              className={`w-full flex items-center justify-between p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                                isSelected
                                  ? "bg-amber-500/20 border-amber-500 text-white shadow-md"
                                  : "bg-neutral-900/60 border-neutral-800 text-neutral-300 hover:bg-neutral-800/60"
                              }`}
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <Beer 
                                  size={16} 
                                  className={isSelected ? "text-amber-400" : "text-neutral-500"} 
                                />
                                <span className="text-xs font-bold truncate">{drink.name}</span>
                              </div>
                              <span className="text-[11px] font-mono text-neutral-400 shrink-0 ml-2">
                                {isSpecialPass ? "Offert" : `${drink.price ?? 0} DT`}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="py-6 text-xs text-neutral-400">
                        Aucune consommation disponible pour cet événement.
                      </div>
                    )}

                    {/* Submit Drink Selection */}
                    {hasAvailableDrinks && (
                      <button
                        onClick={handleSelectDrink}
                        disabled={!selectedDrinkId || isSubmittingDrink}
                        className="w-full py-3 px-4 rounded-xl font-bold text-xs bg-amber-500 hover:bg-amber-400 text-neutral-950 shadow-lg shadow-amber-500/25 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                      >
                        {isSubmittingDrink ? (
                          <>
                            <Loader2 size={16} className="animate-spin" />
                            <span>Génération du QR Code...</span>
                          </>
                        ) : (
                          <>
                            <Check size={16} />
                            <span>Générer mon QR Boisson</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
