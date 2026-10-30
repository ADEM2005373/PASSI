"use client";

import { useState, useEffect, useMemo } from "react";
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
  AlertCircle,
  ArrowRight
} from "lucide-react";
import { api, Pass } from "@/lib/services/api";
import { claimPassDrink } from "@/app/actions/passes";

export interface DrinkOptionItem {
  id?: string;
  name: string;
  aromas?: string[];
  category?: string;
  price?: number;
}

type PassCardProps = {
  pass: Pass;
  onUpdate?: (updatedPass: Pass) => void;
};

export function PassCard({ pass, onUpdate }: PassCardProps) {
  const [localPass, setLocalPass] = useState<Pass>(pass);
  const [activeTab, setActiveTab] = useState<"entry" | "drink">("entry");

  // Drink Selection Form State for Admin-Granted / Special Passes
  const [selectedDrinkName, setSelectedDrinkName] = useState<string>("");
  const [selectedAromas, setSelectedAromas] = useState<string[]>([]);
  const [isClaimingDrink, setIsClaimingDrink] = useState<boolean>(false);
  const [claimError, setClaimError] = useState<string | null>(null);

  // Invitation response state
  const [isRespondingInvitation, setIsRespondingInvitation] = useState(false);
  const [invitationError, setInvitationError] = useState<string | null>(null);

  // Sync props to state
  useEffect(() => {
    setLocalPass(pass);
  }, [pass]);

  // Pass type classification
  const passType = (localPass.pass_type || "NORMAL").toUpperCase();
  const isVip = passType === "VIP";
  const isGift = passType === "GIFT" || passType === "CADEAU";
  const isInvitation = passType === "INVITATION";
  const isSpecialPass = isVip || isGift || (isInvitation && localPass.invitation_status === "ACCEPTED");

  // Pass Reference Number (e.g. QCK-9A2E5B, POS-..., or #A1B2C3D4)
  const passNumber = localPass.reservation_code || (localPass.id ? `#${localPass.id.slice(0, 8).toUpperCase()}` : "");
  const isDrinkScanned = localPass.drink_status === "scanned" || Boolean((localPass as any).is_drink_used);

  // Active status of pass
  const isPassActive =
    localPass.entry_status === "activated" ||
    localPass.entry_status === "scanned" ||
    (localPass as any).status === "PAID" ||
    (localPass as any).status === "ACTIVATED" ||
    isSpecialPass;

  // Has a drink been selected?
  const hasDrink = Boolean(
    (localPass.drink_name && localPass.drink_name.trim().length > 0) ||
    (localPass.drink_id && localPass.drink_id.trim().length > 0)
  );

  // QR Code values
  const drinkQrValue = localPass.drink_qr_code || localPass.drink_qr_uuid;
  const entryQrValue = localPass.entry_qr_uuid;

  // Auto-heal: If pass is active, has drink_name/drink_id, but no drink QR code generated yet, auto-heal it
  useEffect(() => {
    if (
      isPassActive &&
      hasDrink &&
      !drinkQrValue &&
      !isClaimingDrink
    ) {
      setIsClaimingDrink(true);
      claimPassDrink(localPass.id, localPass.drink_name || localPass.drink_id!, localPass.selected_aromas || [])
        .then((res) => {
          if (res.pass) {
            setLocalPass(res.pass);
            if (onUpdate) onUpdate(res.pass);
          }
        })
        .catch((err) => {
          console.warn("Auto-healing drink QR code failed:", err);
        })
        .finally(() => {
          setIsClaimingDrink(false);
        });
    }
  }, [isPassActive, hasDrink, drinkQrValue, localPass.id, localPass.drink_name, localPass.drink_id, localPass.selected_aromas]);

  // Resolve available drinks from pass.available_drinks or pass.events.drinks
  const rawDrinks = useMemo(() => {
    if (localPass.available_drinks && localPass.available_drinks.length > 0) {
      return localPass.available_drinks;
    }
    if (localPass.events && Array.isArray((localPass.events as any).drinks)) {
      return (localPass.events as any).drinks;
    }
    return [];
  }, [localPass.available_drinks, localPass.events]);

  const [fetchedDrinks, setFetchedDrinks] = useState<any[]>([]);
  const [isLoadingDrinks, setIsLoadingDrinks] = useState<boolean>(false);

  // Fallback: If no drinks pre-populated on pass, fetch from event
  useEffect(() => {
    if (rawDrinks.length > 0) return;
    if (!localPass.event_id) return;

    let isMounted = true;
    setIsLoadingDrinks(true);
    api.getEvent(localPass.event_id)
      .then((event) => {
        if (!isMounted || !event) return;
        const drinks = (event.drinks && event.drinks.length > 0)
          ? event.drinks
          : (event.drink_menus && event.drink_menus.length > 0)
          ? event.drink_menus
          : [];
        setFetchedDrinks(drinks);
      })
      .catch((err) => {
        console.warn("Failed to fetch event drinks for pass:", err);
      })
      .finally(() => {
        if (isMounted) setIsLoadingDrinks(false);
      });

    return () => {
      isMounted = false;
    };
  }, [localPass.event_id, rawDrinks.length]);

  const availableDrinksList: DrinkOptionItem[] = useMemo(() => {
    const list = rawDrinks.length > 0 ? rawDrinks : fetchedDrinks;
    return list.map((d: any, idx: number): DrinkOptionItem => ({
      id: d.id || d.name || `drink-${idx}`,
      name: d.name,
      aromas: Array.isArray(d.aromas) ? d.aromas : [],
      category: d.category || 'Boisson',
      price: d.price || 0,
    }));
  }, [rawDrinks, fetchedDrinks]);

  // Currently selected drink object
  const currentSelectedDrinkObj = useMemo(() => {
    if (!selectedDrinkName) return null;
    return availableDrinksList.find(
      (d: DrinkOptionItem) => d.name === selectedDrinkName || d.id === selectedDrinkName
    ) || null;
  }, [availableDrinksList, selectedDrinkName]);

  // Aromas for the chosen drink
  const currentAromas = useMemo(() => {
    if (!currentSelectedDrinkObj || !Array.isArray(currentSelectedDrinkObj.aromas)) {
      return [];
    }
    return currentSelectedDrinkObj.aromas.filter(
      (a: any) => typeof a === "string" && a.trim().length > 0
    );
  }, [currentSelectedDrinkObj]);

  // Check if invitation is pending or declined
  const isPendingInvitation = isInvitation && localPass.invitation_status === "PENDING";
  const isDeclinedInvitation = isInvitation && localPass.invitation_status === "DECLINED";

  // Check email notification banners
  const isAwaitingPayment = localPass.entry_status === "awaiting_payment" || (localPass as any).status === "PENDING_PAYMENT";
  const isRejected = localPass.entry_status === "rejected" || (localPass as any).status === "REJECTED";

  // Drink Tab is available if:
  // 1. Pass has a drink (assigned or active)
  // 2. OR Pass is active (user can claim their drink)
  // 3. OR Pass has drink_status set
  const hasDrinkTab =
    hasDrink ||
    Boolean(localPass.drink_status && localPass.drink_status !== "none") ||
    isPassActive;

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

  // Handle drink selection change
  const handleDrinkChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setSelectedDrinkName(val);
    setSelectedAromas([]); // Reset aromas when drink changes
    setClaimError(null);
  };

  // Handle single aroma selection
  const handleAromaSelect = (aroma: string) => {
    setSelectedAromas([aroma]);
  };

  // Handle drink confirmation submission
  const handleConfirmDrink = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const drinkNameToSubmit = selectedDrinkName || localPass.drink_name || localPass.drink_id;
    if (!drinkNameToSubmit) {
      setClaimError("Veuillez choisir une boisson.");
      return;
    }

    setIsClaimingDrink(true);
    setClaimError(null);
    try {
      const actualDrinkName = currentSelectedDrinkObj?.name || drinkNameToSubmit;
      const res = await claimPassDrink(localPass.id, actualDrinkName, selectedAromas);

      if (!res.success) {
        setClaimError(res.error || "Impossible d'enregistrer votre boisson.");
        return;
      }

      if (res.pass) {
        setLocalPass(res.pass);
        if (onUpdate) onUpdate(res.pass);
      }
    } catch (err: any) {
      console.error("Drink claim error:", err);
      setClaimError(err.message || "Une erreur est survenue lors de l'enregistrement.");
    } finally {
      setIsClaimingDrink(false);
    }
  };

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
      {/* Top Pass Header: Type Badge & Permanent Pass Number */}
      <div className="flex items-center justify-between gap-2 mb-4 w-full">
        <div className="flex items-center gap-1.5 flex-wrap">
          {isVip ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r from-amber-500/20 via-yellow-500/20 to-amber-500/20 border border-amber-500/40 text-amber-300 font-black text-xs uppercase tracking-widest shadow-sm">
              <Crown size={13} className="text-amber-400" />
              <span>VIP Pass</span>
            </span>
          ) : isGift ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-bold text-xs uppercase tracking-wider">
              <Gift size={13} className="text-emerald-400" />
              <span>Pass Cadeau</span>
            </span>
          ) : isInvitation ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/20 border border-purple-500/40 text-purple-300 font-bold text-xs uppercase tracking-wider">
              <Mail size={13} className="text-purple-400" />
              <span>Invitation</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-neutral-800 border border-neutral-700 text-neutral-300 font-bold text-xs uppercase tracking-wider">
              <Ticket size={13} className="text-[#DC143C]" />
              <span>Pass Officiel</span>
            </span>
          )}
        </div>

        {/* Permanent Pass Number Badge (Always Visible Before & After Scan) */}
        {passNumber && (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-neutral-900/90 border border-neutral-700/80 shadow-inner">
            <span className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider">N° Pass</span>
            <span className="font-mono font-black text-xs text-purple-300 tracking-wide">
              {passNumber}
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
        /* STANDARD & ACTIVE PASS VIEW: DUAL TABS (ENTRY / DRINK) */
        <>
          {/* Condition 1: PENDING_PAYMENT Info Banner */}
          {isAwaitingPayment && (
            <div className="mb-5 bg-emerald-500/15 border border-emerald-500/35 rounded-2xl p-4 text-emerald-200 flex items-start gap-3 animate-in fade-in duration-300 shadow-sm">
              <Mail size={18} className="text-emerald-400 shrink-0 mt-0.5" />
              <div className="text-xs leading-relaxed">
                <strong className="block text-emerald-300 font-extrabold mb-0.5">Demande pré-approuvée ! 🎉</strong>
                Félicitations ! Votre demande est pré-approuvée. 📧 <strong className="font-bold underline text-white">Veuillez vérifier vos e-mails</strong> pour découvrir nos points de vente et finaliser votre paiement.
              </div>
            </div>
          )}

          {/* Condition 2: REJECTED Warning Banner */}
          {isRejected && (
            <div className="mb-5 bg-rose-500/15 border border-rose-500/35 rounded-2xl p-4 text-rose-200 flex items-start gap-3 animate-in fade-in duration-300 shadow-sm">
              <AlertCircle size={18} className="text-rose-400 shrink-0 mt-0.5" />
              <div className="text-xs leading-relaxed">
                <strong className="block text-rose-300 font-extrabold mb-0.5">Demande de pass refusée</strong>
                Votre demande de pass a été refusée. 📧 <strong className="font-bold underline text-white">Veuillez vérifier vos e-mails</strong> pour plus de détails.
              </div>
            </div>
          )}

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
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-full text-xs sm:text-sm font-bold transition-all duration-300 cursor-pointer ${
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
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-full text-xs sm:text-sm font-bold transition-all duration-300 cursor-pointer ${
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
                {!hasDrink && isPassActive && (
                  <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-amber-400 text-neutral-950 animate-pulse">
                    À choisir
                  </span>
                )}
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
                    <div className="w-20 h-20 bg-neutral-900 rounded-full flex items-center justify-center mb-4 border border-neutral-800">
                      <CheckCircle2 className="text-emerald-400" size={40} />
                    </div>
                    <h3 className="text-2xl font-black text-white">Pass d'entrée validé</h3>
                    <p className="text-neutral-400 mt-1 font-medium text-sm">Entrée déjà scannée à la porte.</p>

                    {/* Permanent Pass Number Display After Scan */}
                    {passNumber && (
                      <div className="mt-4 px-3.5 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center gap-2">
                        <span className="text-[10px] uppercase font-bold text-emerald-400/80 tracking-wider">N° Pass</span>
                        <span className="font-mono font-black text-sm text-white">
                          {passNumber}
                        </span>
                      </div>
                    )}
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
                    <p className="mt-5 text-neutral-400 text-xs font-bold tracking-widest uppercase flex items-center gap-1.5">
                      <Ticket size={14} className={isVip ? "text-amber-400" : "text-[#DC143C]"} />
                      <span>Présenter à l'entrée de l'événement</span>
                    </p>

                    {/* Pass Number Display Before Scan */}
                    {passNumber && (
                      <div className="mt-2.5 px-3.5 py-1.5 rounded-xl bg-neutral-900/80 border border-neutral-800 flex items-center gap-2">
                        <span className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider">N° Pass</span>
                        <span className="font-mono font-black text-xs text-purple-300">
                          {passNumber}
                        </span>
                      </div>
                    )}

                    {/* Unclaimed Drink Call-to-Action Banner */}
                    {!hasDrink && isPassActive && (
                      <div
                        onClick={() => setActiveTab("drink")}
                        className="mt-5 w-full p-3.5 rounded-2xl bg-gradient-to-r from-amber-500/15 via-yellow-500/10 to-amber-500/15 border border-amber-500/30 flex items-center justify-between gap-3 cursor-pointer hover:border-amber-500/60 transition-all group shadow-sm"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                            <Wine size={16} />
                          </div>
                          <div className="text-left">
                            <p className="text-xs font-bold text-amber-300">Boisson offerte disponible !</p>
                            <p className="text-[11px] text-neutral-400">Cliquez pour choisir votre boisson</p>
                          </div>
                        </div>
                        <span className="text-[11px] font-extrabold text-amber-300 bg-amber-500/20 px-2.5 py-1 rounded-lg group-hover:bg-amber-400 group-hover:text-black transition-all flex items-center gap-1">
                          <span>Choisir</span>
                          <ArrowRight size={12} />
                        </span>
                      </div>
                    )}
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
                {isDrinkScanned ? (
                  <div className="flex flex-col items-center text-center my-6">
                    <div className="w-20 h-20 bg-neutral-900 rounded-full flex items-center justify-center mb-4 border border-neutral-800">
                      <CheckCircle2 className="text-teal-400" size={40} />
                    </div>
                    <h3 className="text-2xl font-black text-white">Consommation servie</h3>
                    <p className="text-neutral-400 mt-1 font-medium text-sm">
                      {localPass.drink_name || localPass.drink_menus?.name || "Boisson"} déjà récupérée au bar.
                    </p>

                    {/* Permanent Pass Number Display After Drink Scan */}
                    {passNumber && (
                      <div className="mt-4 px-3.5 py-1.5 rounded-xl bg-teal-500/15 border border-teal-500/30 flex items-center gap-2">
                        <span className="text-[10px] uppercase font-bold text-teal-400/80 tracking-wider">N° Pass</span>
                        <span className="font-mono font-black text-sm text-white">
                          {passNumber}
                        </span>
                      </div>
                    )}
                  </div>
                ) : (hasDrink && drinkQrValue) ? (
                  /* DRINK QR CODE ALREADY GENERATED & ACTIVE */
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
                    <div className="mt-6 text-neutral-200 text-xs font-bold tracking-wide uppercase flex flex-col items-center gap-1">
                      <div className="flex items-center gap-2">
                        <Wine size={15} className="text-amber-400" />
                        <span>{localPass.drink_name || localPass.drink_menus?.name || "Boisson réservée"}</span>
                      </div>
                      {localPass.selected_aromas && localPass.selected_aromas.length > 0 && (
                        <span className="text-[11px] text-amber-300 font-medium normal-case">
                          Arôme : {localPass.selected_aromas[0]}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-neutral-400 mt-1 font-medium">
                      Présentez ce QR Code directement au barman
                    </p>

                    {/* Pass Number Display Before Drink Scan */}
                    {passNumber && (
                      <div className="mt-2.5 px-3.5 py-1.5 rounded-xl bg-neutral-900/80 border border-neutral-800 flex items-center gap-2">
                        <span className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider">N° Pass</span>
                        <span className="font-mono font-black text-xs text-teal-300">
                          {passNumber}
                        </span>
                      </div>
                    )}
                  </>
                ) : (!hasDrink && isPassActive) ? (
                  /* DRINK SELECTION FORM FOR ACTIVE PASSES MISSING DRINK */
                  <div className="w-full flex flex-col items-center text-center p-1">
                    <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-3 shadow-lg shadow-amber-500/10">
                      <Wine size={26} />
                    </div>
                    <h3 className="text-lg font-extrabold text-white mb-1">
                      Choisissez votre boisson incluse
                    </h3>
                    <p className="text-xs text-neutral-400 mb-4 max-w-xs leading-relaxed">
                      Sélectionnez votre consommation offerte avec votre pass pour débloquer votre QR Code Barman :
                    </p>

                    {claimError && (
                      <div className="mb-4 text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 px-3.5 py-2.5 rounded-xl flex items-center gap-2 w-full text-left">
                        <AlertCircle size={15} className="shrink-0" />
                        <span>{claimError}</span>
                      </div>
                    )}

                    {isLoadingDrinks ? (
                      <div className="py-8 flex flex-col items-center justify-center gap-2 text-neutral-400 text-xs">
                        <Loader2 size={24} className="animate-spin text-amber-400" />
                        <span>Chargement des boissons de l'événement...</span>
                      </div>
                    ) : availableDrinksList.length > 0 ? (
                      <form onSubmit={handleConfirmDrink} className="w-full space-y-4 text-left">
                        {/* 1. Drink Dropdown */}
                        <div>
                          <label 
                            htmlFor={`drink-select-${localPass.id}`}
                            className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-neutral-300 mb-2"
                          >
                            <Wine size={14} className="text-amber-400" />
                            <span>Boisson au choix</span>
                            <span className="text-rose-400">*</span>
                          </label>
                          <select
                            id={`drink-select-${localPass.id}`}
                            value={selectedDrinkName}
                            onChange={handleDrinkChange}
                            disabled={isClaimingDrink}
                            className="w-full px-3.5 py-3 rounded-xl bg-neutral-900 border border-neutral-700 text-white font-medium text-sm focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition-colors cursor-pointer"
                            required
                          >
                            <option value="">-- Choisir une boisson --</option>
                            {availableDrinksList.map((drink: DrinkOptionItem, idx: number) => {
                              const aromaCount = drink.aromas && drink.aromas.length > 0 
                                ? ` (${drink.aromas.length} saveurs disponibles)` 
                                : '';
                              return (
                                <option key={drink.id || `drink-${idx}`} value={drink.name}>
                                  {drink.name}{aromaCount}
                                </option>
                              );
                            })}
                          </select>
                        </div>

                        {/* 2. Conditional Aromas Radio Buttons */}
                        {selectedDrinkName && currentAromas.length > 0 && (
                          <div className="p-3.5 rounded-xl bg-neutral-900/90 border border-neutral-800 space-y-2.5 animate-in fade-in slide-in-from-top-1 duration-200">
                            <div className="flex items-center gap-1.5 text-xs font-bold text-amber-400">
                              <Sparkles size={13} />
                              <span>Choisissez votre arôme / goût :</span>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                              {currentAromas.map((aroma: string, idx: number) => {
                                const isChecked = selectedAromas[0] === aroma;
                                const radioId = `aroma-${localPass.id}-${idx}`;

                                return (
                                  <label
                                    key={aroma}
                                    htmlFor={radioId}
                                    onClick={() => handleAromaSelect(aroma)}
                                    className={`flex items-center gap-2.5 p-2 rounded-lg border text-xs cursor-pointer transition-all select-none ${
                                      isChecked
                                        ? 'bg-amber-500/15 border-amber-500/40 text-amber-300 font-bold'
                                        : 'bg-neutral-800/60 border-neutral-700/60 text-neutral-300 hover:bg-neutral-800 hover:text-white'
                                    }`}
                                  >
                                    <input
                                      type="radio"
                                      id={radioId}
                                      name={`arome-${localPass.id}`}
                                      value={aroma}
                                      checked={isChecked}
                                      disabled={isClaimingDrink}
                                      onChange={() => handleAromaSelect(aroma)}
                                      className="w-4 h-4 border-neutral-600 text-amber-500 focus:ring-amber-400 focus:ring-offset-neutral-900 cursor-pointer accent-amber-500"
                                    />
                                    <span className="flex-1">{aroma}</span>
                                    {isChecked && <Check size={12} className="text-amber-400 shrink-0" />}
                                  </label>
                                );
                              })}
                            </div>

                            {selectedAromas.length > 0 && (
                              <p className="text-[11px] text-amber-300/80 italic pt-1">
                                Sélectionné : {selectedAromas[0]}
                              </p>
                            )}
                          </div>
                        )}

                        {/* 3. Submit Button */}
                        <button
                          type="submit"
                          disabled={!selectedDrinkName || isClaimingDrink}
                          className="w-full mt-2 py-3.5 px-4 rounded-xl font-extrabold text-xs uppercase tracking-wider bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-neutral-950 shadow-lg shadow-amber-500/25 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                        >
                          {isClaimingDrink ? (
                            <>
                              <Loader2 size={16} className="animate-spin" />
                              <span>Enregistrement...</span>
                            </>
                          ) : (
                            <>
                              <Check size={16} />
                              <span>Confirmer ma boisson</span>
                            </>
                          )}
                        </button>
                      </form>
                    ) : (
                      <div className="py-6 text-xs text-neutral-400">
                        Aucune boisson disponible pour cet événement.
                      </div>
                    )}
                  </div>
                ) : hasDrink ? (
                  /* Has drink assigned but QR code is still pending / auto-healing */
                  <div className="w-full flex flex-col items-center text-center p-3">
                    <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-3">
                      <Wine size={26} />
                    </div>
                    <h3 className="text-lg font-extrabold text-white mb-1">
                      {localPass.drink_name || localPass.drink_menus?.name || "Boisson réservée"}
                    </h3>
                    <p className="text-xs text-neutral-400 mb-4 max-w-xs leading-relaxed">
                      {isPassActive
                        ? "Votre consommation a été confirmée avec votre pass. Chargement de votre QR Code..."
                        : "Votre QR Code de consommation sera débloqué dès la validation de votre règlement."}
                    </p>
                    {isPassActive && (
                      <button
                        onClick={() => handleConfirmDrink()}
                        disabled={isClaimingDrink}
                        className="py-2.5 px-4 rounded-xl font-bold text-xs bg-amber-500 hover:bg-amber-400 text-neutral-950 shadow-lg shadow-amber-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                      >
                        {isClaimingDrink ? (
                          <>
                            <Loader2 size={16} className="animate-spin" />
                            <span>Génération du QR Code...</span>
                          </>
                        ) : (
                          <>
                            <Check size={16} />
                            <span>Afficher mon QR Code Boisson</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                ) : (
                  /* Inactive pass with no drink yet */
                  <div className="w-full flex flex-col items-center text-center p-3">
                    <div className="w-14 h-14 rounded-2xl bg-neutral-800 flex items-center justify-center text-neutral-400 mb-3">
                      <Wine size={26} />
                    </div>
                    <h3 className="text-lg font-extrabold text-white mb-1">
                      Boisson incluse
                    </h3>
                    <p className="text-xs text-neutral-400 max-w-xs leading-relaxed">
                      Votre QR Code de consommation sera débloqué dès la validation de votre pass.
                    </p>
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
