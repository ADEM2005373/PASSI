"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { api, Event, User, Pass } from "@/lib/services/api";
import Image from "next/image";
import { formatImageUrl } from "@/lib/utils/url";
import { QRCodeSVG } from 'qrcode.react';
import { Logo } from "@/components/Logo";
import { DrinkSelector } from "@/components/DrinkSelector";
import { PaymentNotificationModal } from "@/components/PaymentNotificationModal";
import { Sun, Moon, ArrowLeft, LogOut, MapPin, Calendar, Clock, Ticket, Wine, CheckCircle, AlertCircle, Info, Shirt, Sparkles, Mail } from "lucide-react";

export default function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const resolvedParams = use(params);
  const [event, setEvent] = useState<Event | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [userPasses, setUserPasses] = useState<Pass[]>([]);
  const [paymentModalPass, setPaymentModalPass] = useState<any | null>(null);
  const [numPasses, setNumPasses] = useState(1);
  const [passes, setPasses] = useState<{
    isPrimary?: boolean;
    firstName: string;
    lastName: string;
    instagram: string;
    drinkId: string;
    selectedAromas: string[];
  }[]>([
    { isPrimary: true, firstName: "", lastName: "", instagram: "", drinkId: "", selectedAromas: [] }
  ]);
  const [promoCode, setPromoCode] = useState("");
  const [isBooking, setIsBooking] = useState(false);
  const [imageError, setImageError] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    setPasses(prev => {
      const primaryFirst = user?.first_name || prev[0]?.firstName || "";
      const primaryLast = user?.last_name || prev[0]?.lastName || "";
      const primaryIg = user?.instagram || user?.instagram_handle || prev[0]?.instagram || "";

      const newPasses = [...prev];
      if (newPasses.length === 0) {
        newPasses.push({
          isPrimary: true,
          firstName: primaryFirst,
          lastName: primaryLast,
          instagram: primaryIg,
          drinkId: "",
          selectedAromas: []
        });
      } else {
        newPasses[0] = {
          ...newPasses[0],
          isPrimary: true,
          firstName: primaryFirst || newPasses[0].firstName,
          lastName: primaryLast || newPasses[0].lastName,
          instagram: primaryIg || newPasses[0].instagram
        };
      }

      if (newPasses.length < numPasses) {
        for (let i = newPasses.length; i < numPasses; i++) {
          newPasses.push({
            isPrimary: false,
            firstName: "",
            lastName: "",
            instagram: "",
            drinkId: "",
            selectedAromas: []
          });
        }
      } else { 
        newPasses.length = numPasses; 
      }
      return newPasses;
    });
  }, [numPasses, user]);

  const fetchPasses = async (userId: string, eventId: string) => {
    const p = await api.getUserPasses(userId);
    setUserPasses(p.filter(item => item.event_id === eventId));
  };

  useEffect(() => {
    const fetchData = async () => {
      const currentUser = await api.getCurrentUser();
      if (!currentUser) { 
        router.replace(`/login?redirect=/events/${resolvedParams.id}`); 
        return; 
      }
      setUser(currentUser);
      const eventData = await api.getEvent(resolvedParams.id);
      if (eventData) setEvent(eventData);
      await fetchPasses(currentUser.id, resolvedParams.id);

      const primaryFirst = currentUser.first_name || '';
      const primaryLast = currentUser.last_name || '';
      const primaryIg = currentUser.instagram || currentUser.instagram_handle || '';

      setPasses(prev => {
        const next = [...prev];
        if (next.length === 0) {
          next.push({
            isPrimary: true,
            firstName: primaryFirst,
            lastName: primaryLast,
            instagram: primaryIg,
            drinkId: "",
            selectedAromas: []
          });
        } else {
          next[0] = {
            ...next[0],
            isPrimary: true,
            firstName: primaryFirst,
            lastName: primaryLast,
            instagram: primaryIg
          };
        }
        return next;
      });
    };
    fetchData();
  }, [resolvedParams.id, router]);

  useEffect(() => {
    if (!user) return;
    const interval = setInterval(() => fetchPasses(user.id, resolvedParams.id), 3000);
    return () => clearInterval(interval);
  }, [user]);

  // Auto-detect unpaid pass for this event and show centered payment modal with blur
  useEffect(() => {
    if (!userPasses || userPasses.length === 0) return;
    if (typeof window === 'undefined') return;

    const unpaid = userPasses.find(
      p => p.entry_status === 'pending' || p.entry_status === 'awaiting_payment'
    );
    if (unpaid) {
      const hasAcknowledged = localStorage.getItem(`ack_payment_notice_${unpaid.id}`);
      if (!hasAcknowledged) {
        setPaymentModalPass({
          ...unpaid,
          event: event || (unpaid as any).events,
        });
      }
    }
  }, [userPasses, event]);

  const handleClosePaymentModal = () => {
    if (paymentModalPass?.id && typeof window !== 'undefined') {
      localStorage.setItem(`ack_payment_notice_${paymentModalPass.id}`, 'true');
    }
    setPaymentModalPass(null);
  };

  const handleBook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!event || !user) return;
    setIsBooking(true);
    const formattedGuests = passes.map((pass, index) => ({
      firstName: (index === 0 ? (user.first_name || pass.firstName) : pass.firstName).trim(),
      lastName: (index === 0 ? (user.last_name || pass.lastName) : pass.lastName).trim(),
      drinkName: pass.drinkId || undefined,
      drinkId: pass.drinkId || undefined,
      selectedAromas: pass.selectedAromas || []
    }));
    await api.bookPasses(event.id, user.id, formattedGuests, promoCode.trim() || undefined);
    await fetchPasses(user.id, event.id);
    setIsBooking(false);
    setNumPasses(1);
    setPromoCode("");
    setPasses([{
      isPrimary: true,
      firstName: user.first_name || '',
      lastName: user.last_name || '',
      instagram: user.instagram || user.instagram_handle || '',
      drinkId: "",
      selectedAromas: []
    }]);
  };

  const statusInfo: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
    pending:          { label: 'En attente',     color: 'text-amber-500',       bg: 'bg-amber-500/10',       icon: <Clock size={16}/> },
    awaiting_payment: { label: 'À payer au guichet', color: 'text-amber-400', bg: 'bg-amber-500/10', icon: <AlertCircle size={16}/> },
    activated:        { label: 'Activé ✓',      color: 'text-passi-turquoise', bg: 'bg-passi-turquoise/10', icon: <CheckCircle size={16}/> },
    scanned:          { label: 'Utilisé',        color: 'text-gray-500',        bg: 'bg-gray-500/10',        icon: <CheckCircle size={16}/> },
  };

  if (!event || !user) return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--bg)' }}>
      <div className="flex flex-col items-center gap-4">
        <svg className="animate-spin w-10 h-10 text-passi-corail" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
        </svg>
        <p className="font-bold" style={{ color: 'var(--text-secondary)' }}>Chargement de l'événement...</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg)' }}>
      {/* Sticky Header */}
      <header className="sticky top-0 z-30 flex items-center justify-between px-6 py-4 border-b backdrop-blur-md" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }}>
        <Logo variant="auto" className="w-[110px] h-[33px]" />
        <div className="flex items-center gap-3">
          {mounted && (
            <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="p-2.5 rounded-xl btn-ghost">
              {theme === 'dark' ? <Sun size={17}/> : <Moon size={17}/>}
            </button>
          )}
          <button onClick={() => router.push("/dashboard")} className="btn-ghost flex items-center gap-2 px-4 py-2 text-sm">
            <ArrowLeft size={16}/> Retour
          </button>
          <button onClick={() => { api.logout(); router.replace("/login"); }} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-red-500 hover:bg-red-500/10 transition-colors">
            <LogOut size={16}/>
          </button>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-10 space-y-8">
        {/* Event Hero */}
        <div className="card overflow-hidden shadow-xl">
          {(() => {
            const formattedImage = formatImageUrl(event.image_url);
            const hasImage = Boolean(formattedImage && !imageError && formattedImage !== 'undefined');
            if (hasImage) {
              return (
                <div className="w-full h-64 md:h-80 relative overflow-hidden bg-gray-100 dark:bg-slate-800">
                  <Image
                    src={formattedImage}
                    alt={event.title}
                    fill
                    priority
                    sizes="(max-width: 768px) 100vw, 800px"
                    className="object-cover"
                    onError={() => setImageError(true)}
                  />
                </div>
              );
            }
            return (
              <div className="w-full h-44 relative overflow-hidden bg-gradient-to-br from-passi-bleu via-slate-800 to-passi-corail/30 flex items-center justify-center">
                <div className="absolute inset-0 opacity-15 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white to-transparent" />
                <div className="relative z-10 flex flex-col items-center gap-2 text-white">
                  <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-xl font-black shadow-lg">
                    {event.title ? event.title.slice(0, 2).toUpperCase() : 'EV'}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs uppercase tracking-widest font-bold opacity-80">
                    <Sparkles size={12} className="text-passi-turquoise" />
                    <span>Passi Expérience</span>
                  </div>
                </div>
              </div>
            );
          })()}
          <div className="p-7">
            <h1 className="text-3xl font-extrabold mb-3" style={{ color: 'var(--text-primary)' }}>{event.title}</h1>
            <div className="flex flex-wrap gap-4">
              <span className="flex items-center gap-2 text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>
                <Calendar size={16} className="text-passi-corail"/>
                {new Date(event.date).toLocaleDateString('fr-FR', { day:'numeric', month:'long', year:'numeric' })}
              </span>
              <span className="flex items-center gap-2 text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>
                <Clock size={16} className="text-passi-corail"/>
                {new Date(event.date).toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit' })}
              </span>
              <span className="flex items-center gap-2 text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>
                <MapPin size={16} className="text-passi-corail"/>
                {event.location}
              </span>
              {event.base_price !== undefined && (
                <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                  <Ticket size={14} className="text-amber-400"/>
                  {event.base_price} DT / pass
                </span>
              )}
              {event.dress_code && (
                <span className="flex items-center gap-2 text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>
                  <Shirt size={16} className="text-purple-500"/>
                  {event.dress_code}
                </span>
              )}
            </div>
            {event.description && (
              <div className="mt-6 p-5 rounded-2xl" style={{ backgroundColor: 'var(--bg-input)', border: '1px solid var(--border)' }}>
                <h3 className="flex items-center gap-2 text-sm font-bold mb-2 uppercase tracking-wide" style={{ color: 'var(--text-primary)' }}>
                  <Info size={16} className="text-blue-500"/> À propos de l'événement
                </h3>
                <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--text-secondary)' }}>
                  {event.description}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Your Passes */}
        {userPasses.length > 0 && (
          <div className="card p-7 shadow-sm">
            <h2 className="text-xl font-extrabold mb-5 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
              <Ticket size={20} className="text-passi-corail"/> Mes Passes
            </h2>
            <div className="space-y-4">
              {userPasses.map(pass => {
                const si = statusInfo[pass.entry_status] || { label: pass.entry_status, color: 'text-gray-500', bg: 'bg-gray-500/10', icon: null };
                const passPrice = pass.final_price ?? event.base_price ?? 0;
                return (
                  <div key={pass.id} className="p-5 rounded-2xl" style={{ backgroundColor: 'var(--bg-input)', border: '1.5px solid var(--border)' }}>
                    <div className="flex flex-wrap justify-between items-start gap-4">
                      <div>
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <p className="text-lg font-extrabold" style={{ color: 'var(--text-primary)' }}>{pass.guest_first_name} {pass.guest_last_name}</p>
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-amber-500/15 text-amber-400 border border-amber-500/25">
                            {passPrice} DT
                          </span>
                          <span className="px-2 py-0.5 rounded-md text-[11px] font-mono font-bold bg-neutral-900 text-purple-300 border border-neutral-700">
                            N° {pass.reservation_code || `#${pass.id.slice(0, 8).toUpperCase()}`}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                          <span className={`badge flex items-center gap-1.5 w-fit ${si.bg} ${si.color}`}>
                            {si.icon} {si.label}
                          </span>
                          {pass.promo_used && (
                            <span className="px-2 py-0.5 rounded-md text-[11px] font-mono font-semibold bg-neutral-800 text-neutral-300 border border-neutral-700">
                              Promo: {pass.promo_used}
                            </span>
                          )}
                        </div>
                        {pass.drink_menus?.name && (
                          <div className="flex items-center gap-1.5 mt-2 text-xs text-neutral-300">
                            <Wine size={13} className="text-amber-400" />
                            <span className="font-semibold">{pass.drink_menus.name}</span>
                            {pass.selected_aromas && pass.selected_aromas.length > 0 && (
                              <span className="text-neutral-400 font-normal">
                                ({pass.selected_aromas.join(', ')})
                              </span>
                            )}
                          </div>
                        )}
                        {pass.entry_status === 'pending' && (
                          <div className="mt-2 space-y-2">
                            <p className="text-xs font-medium text-amber-500">En attente d'approbation par les organisateurs...</p>
                            {/* POS Payment Location Info */}
                            <div className="bg-slate-800/60 rounded-xl p-3 border border-slate-700/50 space-y-1 text-xs">
                              <p className="flex items-center gap-2 text-slate-300">
                                <span>📍 Point de vente (POS) :</span>
                                <strong className="text-white">{event.pos_location || (pass.events as any)?.pos_location || "L'Agora Djerba"}</strong>
                              </p>
                              <p className="text-[11px] text-slate-400">
                                Présentez votre QR code ou référence de pass sur place pour régler et valider définitivement votre accès.
                              </p>
                            </div>
                            {/* 24-Hour Urgency Warning */}
                            {(() => {
                              const createdAt = new Date(pass.created_at || Date.now());
                              const expiryDate = new Date(createdAt.getTime() + 24 * 60 * 60 * 1000);
                              const now = new Date();
                              const hoursLeft = Math.max(0, Math.floor((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60)));
                              return (
                                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-2.5 flex items-start gap-2.5">
                                  <span className="text-red-400 text-sm leading-none">⚠️</span>
                                  <div className="text-xs">
                                    <p className="font-semibold text-red-300">Attention : Délai de paiement de 24h</p>
                                    <p className="text-red-400/80 mt-0.5">
                                      Vous avez <strong>{hoursLeft}h restantes</strong> pour régler votre pass au point de vente. Passé ce délai (24h), votre réservation sera automatiquement annulée et refusée.
                                    </p>
                                  </div>
                                </div>
                              );
                            })()}
                            <button
                              type="button"
                              onClick={() => setPaymentModalPass({ ...pass, event: event || (pass.events as any) })}
                              className="text-xs font-bold text-purple-400 hover:text-purple-300 flex items-center gap-1 transition hover:underline mt-1 pt-1 cursor-pointer"
                            >
                              <span>Afficher la notification plein écran</span>
                              <span>↗</span>
                            </button>
                          </div>
                        )}
                        {pass.entry_status === 'awaiting_payment' && (
                          <div className="mt-3 space-y-2">
                            <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 text-xs text-emerald-300 space-y-1.5">
                              <p className="font-bold flex items-center gap-1.5 text-emerald-400">
                                <Mail size={14} />
                                Demande pré-approuvée
                              </p>
                              <p className="text-neutral-300">
                                Félicitations ! Votre demande est pré-approuvée. 📧 <strong className="font-bold underline text-white">Veuillez vérifier vos e-mails</strong> pour finaliser votre règlement de <strong>{passPrice} DT</strong>.
                              </p>
                            </div>
                            {/* POS Payment Location Info */}
                            <div className="bg-slate-800/60 rounded-xl p-3 border border-slate-700/50 space-y-1 text-xs">
                              <p className="flex items-center gap-2 text-slate-300">
                                <span>📍 Point de vente (POS) :</span>
                                <strong className="text-white">{event.pos_location || (pass.events as any)?.pos_location || "L'Agora Djerba"}</strong>
                              </p>
                              <p className="text-[11px] text-slate-400">
                                Présentez votre QR code ou référence de pass sur place pour régler et valider définitivement votre accès.
                              </p>
                            </div>
                            {/* 24-Hour Urgency Warning */}
                            {(() => {
                              const createdAt = new Date(pass.created_at || Date.now());
                              const expiryDate = new Date(createdAt.getTime() + 24 * 60 * 60 * 1000);
                              const now = new Date();
                              const hoursLeft = Math.max(0, Math.floor((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60)));
                              return (
                                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-2.5 flex items-start gap-2.5">
                                  <span className="text-red-400 text-sm leading-none">⚠️</span>
                                  <div className="text-xs">
                                    <p className="font-semibold text-red-300">Attention : Délai de paiement de 24h</p>
                                    <p className="text-red-400/80 mt-0.5">
                                      Vous avez <strong>{hoursLeft}h restantes</strong> pour régler votre pass au point de vente. Passé ce délai (24h), votre réservation sera automatiquement annulée et refusée.
                                    </p>
                                  </div>
                                </div>
                              );
                            })()}
                            <button
                              type="button"
                              onClick={() => setPaymentModalPass({ ...pass, event: event || (pass.events as any) })}
                              className="text-xs font-bold text-purple-400 hover:text-purple-300 flex items-center gap-1 transition hover:underline mt-1 pt-1 cursor-pointer"
                            >
                              <span>Afficher la notification plein écran</span>
                              <span>↗</span>
                            </button>
                          </div>
                        )}
                        {pass.entry_status === 'rejected' && (
                          <div className="mt-3 p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/25 text-xs text-rose-300 space-y-1.5">
                            <p className="font-bold flex items-center gap-1.5 text-rose-400">
                              <AlertCircle size={14} />
                              Demande refusée
                            </p>
                            <p className="text-neutral-300">
                              Votre demande de pass a été refusée. 📧 <strong className="font-bold underline text-white">Veuillez vérifier vos e-mails</strong> pour plus de détails.
                            </p>
                          </div>
                        )}
                      </div>

                      {/* QR Codes / Validation Status */}
                      <div className="flex gap-4 flex-wrap items-center">
                        {pass.entry_status === 'activated' && pass.entry_qr_uuid && (
                          <div className="text-center">
                            <div className="p-3 rounded-2xl bg-white shadow-md inline-block">
                              <QRCodeSVG value={pass.entry_qr_uuid} size={110} fgColor="#101828"/>
                            </div>
                            <p className="text-xs mt-2 font-bold text-passi-corail flex items-center gap-1 justify-center"><Ticket size={12}/> Entrée</p>
                            <p className="text-[10px] font-mono text-neutral-400 font-bold mt-0.5">N° {pass.reservation_code || `#${pass.id.slice(0, 8).toUpperCase()}`}</p>
                          </div>
                        )}
                        {pass.entry_status === 'scanned' && (
                          <div className="text-center p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 min-w-[120px]">
                            <CheckCircle size={26} className="text-emerald-400 mx-auto mb-1" />
                            <p className="text-xs font-bold text-emerald-300">Entrée Validée</p>
                            <p className="text-[11px] font-mono font-bold text-white mt-1 bg-emerald-500/20 px-2 py-0.5 rounded border border-emerald-500/30">
                              N° {pass.reservation_code || `#${pass.id.slice(0, 8).toUpperCase()}`}
                            </p>
                          </div>
                        )}
                        {pass.entry_status === 'activated' && (pass as any).pass_drinks &&
                          (pass as any).pass_drinks.filter((d: any) => d.drink_status === 'activated').map((drink: any) => (
                            <div key={drink.id} className="text-center">
                              <div className="p-3 rounded-2xl bg-white shadow-md inline-block">
                                <QRCodeSVG value={drink.drink_qr_uuid} size={110} fgColor="#19C3B1"/>
                              </div>
                              <p className="text-xs mt-2 font-bold text-passi-turquoise flex items-center gap-1 justify-center">
                                <Wine size={12}/> {drink.drink_menus?.name || 'Boisson'}
                              </p>
                              <p className="text-[10px] font-mono text-neutral-400 font-bold mt-0.5">N° {pass.reservation_code || `#${pass.id.slice(0, 8).toUpperCase()}`}</p>
                            </div>
                          ))
                        }
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Booking Form */}
        {userPasses.length < event.max_passes_per_user && (
          <div className="card p-7 shadow-sm">
            <h2 className="text-xl font-extrabold mb-2 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
              <Ticket size={20} className="text-passi-corail"/> Réserver des passes
            </h2>
            <p className="text-sm font-medium mb-6" style={{ color: 'var(--text-secondary)' }}>
              Vous pouvez encore réserver {event.max_passes_per_user - userPasses.length} pass(es) pour cet événement.
            </p>

            <form onSubmit={handleBook} className="space-y-6">
              <div>
                <label className="label">Nombre de passes</label>
                <select
                  value={numPasses}
                  onChange={e => setNumPasses(Number(e.target.value))}
                  className="input"
                >
                  {Array.from({ length: event.max_passes_per_user - userPasses.length }, (_, i) => i + 1).map(num => (
                    <option key={num} value={num}>{num} {num === 1 ? 'Pass' : 'Passes'}</option>
                  ))}
                </select>
              </div>

              {passes.map((pass, index) => (
                <div key={index} className="p-5 rounded-2xl space-y-4" style={{ backgroundColor: 'var(--bg-input)', border: '1.5px solid var(--border)' }}>
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                      {index === 0 ? "🎫 Pass Principal (Titulaire du compte)" : `🎫 Pass Invité #${index}`}
                    </h4>
                    {index === 0 && (
                      <span className="text-xs bg-purple-500/10 text-purple-400 border border-purple-500/20 px-2 py-0.5 rounded-md font-medium">
                        Pré-rempli automatiquement
                      </span>
                    )}
                  </div>

                  {index === 0 ? (
                    /* PRIMARY USER: LOCKED / PRE-FILLED SUMMARY */
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                      <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800/60">
                        <span className="text-xs text-slate-400 block">Prénom</span>
                        <span className="font-semibold text-white">{pass.firstName || user?.first_name || "—"}</span>
                      </div>
                      <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800/60">
                        <span className="text-xs text-slate-400 block">Nom</span>
                        <span className="font-semibold text-white">{pass.lastName || user?.last_name || "—"}</span>
                      </div>
                      <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800/60">
                        <span className="text-xs text-slate-400 block">Instagram</span>
                        <span className="font-semibold text-white">{pass.instagram || user?.instagram || user?.instagram_handle || "—"}</span>
                      </div>
                    </div>
                  ) : (
                    /* ADDITIONAL GUESTS: EDITABLE INPUTS */
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <label className="label">Prénom</label>
                        <input
                          type="text"
                          placeholder="Prénom de l'invité"
                          value={pass.firstName}
                          onChange={(e) => {
                            const updated = [...passes];
                            updated[index].firstName = e.target.value;
                            setPasses(updated);
                          }}
                          className="input"
                          required
                        />
                      </div>
                      <div>
                        <label className="label">Nom</label>
                        <input
                          type="text"
                          placeholder="Nom de l'invité"
                          value={pass.lastName}
                          onChange={(e) => {
                            const updated = [...passes];
                            updated[index].lastName = e.target.value;
                            setPasses(updated);
                          }}
                          className="input"
                          required
                        />
                      </div>
                      <div>
                        <label className="label">Instagram</label>
                        <input
                          type="text"
                          placeholder="Profil Instagram (@pseudo)"
                          value={pass.instagram}
                          onChange={(e) => {
                            const updated = [...passes];
                            updated[index].instagram = e.target.value;
                            setPasses(updated);
                          }}
                          className="input"
                          required
                        />
                      </div>
                    </div>
                  )}

                  {(((event as any).drink_menus && (event as any).drink_menus.length > 0) || ((event as any).drinks && (event as any).drinks.length > 0)) && (
                    <DrinkSelector
                      drinks={(event as any).drink_menus && (event as any).drink_menus.length > 0 ? (event as any).drink_menus : ((event as any).drinks || [])}
                      selectedDrinkId={pass.drinkId}
                      selectedAromas={pass.selectedAromas}
                      name={`arome-pass-${index}`}
                      required
                      onChange={(drinkId, selectedAromas) => {
                        const updated = [...passes];
                        updated[index].drinkId = drinkId;
                        updated[index].selectedAromas = selectedAromas;
                        setPasses(updated);
                      }}
                    />
                  )}
                </div>
              ))}

              {/* Promo Code Input */}
              <div className="p-5 rounded-2xl" style={{ backgroundColor: 'var(--bg-input)', border: '1.5px solid var(--border)' }}>
                <label className="label flex items-center justify-between">
                  <span>Code Promo (optionnel)</span>
                  {promoCode.trim() && (() => {
                    const matched = event.promo_codes?.find(p => p.code?.toUpperCase() === promoCode.trim().toUpperCase());
                    return matched ? (
                      <span className="text-xs font-bold text-emerald-400">✓ Réduction de {matched.discount_amount} DT / pass appliquée !</span>
                    ) : (
                      <span className="text-xs font-semibold text-neutral-400">Code non reconnu</span>
                    );
                  })()}
                </label>
                <input
                  type="text"
                  placeholder="Ex: STUDENT2026"
                  value={promoCode}
                  onChange={e => setPromoCode(e.target.value.toUpperCase())}
                  className="input font-mono uppercase text-sm"
                />

                {/* Price Calculation Summary */}
                {(() => {
                  const base = event.base_price ?? 0;
                  const matched = event.promo_codes?.find(p => p.code?.toUpperCase() === promoCode.trim().toUpperCase());
                  const discount = matched ? matched.discount_amount : 0;
                  const finalUnit = Math.max(0, base - discount);
                  const total = finalUnit * numPasses;
                  return (
                    <div className="mt-4 pt-3 border-t border-neutral-800 space-y-1.5 text-xs">
                      <div className="flex justify-between text-neutral-400">
                        <span>Prix unitaire de base :</span>
                        <span>{base} DT</span>
                      </div>
                      {discount > 0 && (
                        <div className="flex justify-between text-emerald-400 font-semibold">
                          <span>Réduction promo ({matched?.code}) :</span>
                          <span>-{discount} DT / pass</span>
                        </div>
                      )}
                      <div className="flex justify-between text-sm font-bold text-white pt-2 border-t border-neutral-800/60">
                        <span>Total à régler au Point de Paiement :</span>
                        <span className="text-amber-400 font-black text-base">{total} DT</span>
                      </div>
                    </div>
                  );
                })()}
              </div>

              <button type="submit" disabled={isBooking} className="btn-primary w-full flex items-center justify-center gap-2">
                {isBooking ? (
                  <>
                    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                    Envoi en cours...
                  </>
                ) : (
                  <><Ticket size={18}/> Confirmer la réservation ({(() => {
                    const base = event.base_price ?? 0;
                    const matched = event.promo_codes?.find(p => p.code?.toUpperCase() === promoCode.trim().toUpperCase());
                    const discount = matched ? matched.discount_amount : 0;
                    return Math.max(0, base - discount) * numPasses;
                  })()} DT)</>
                )}
              </button>
            </form>
          </div>
        )}
      </div>

      {paymentModalPass && (
        <PaymentNotificationModal
          reservation={paymentModalPass}
          isOpen={Boolean(paymentModalPass)}
          onClose={handleClosePaymentModal}
        />
      )}
    </div>
  );
}
