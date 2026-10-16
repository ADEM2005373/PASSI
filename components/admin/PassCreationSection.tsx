"use client";

import React, { useState, useMemo } from 'react';
import { 
  Search, 
  User as UserIcon, 
  Calendar, 
  Ticket, 
  Crown, 
  Gift, 
  Mail, 
  Check, 
  CheckCircle2, 
  AlertCircle, 
  Sparkles, 
  ExternalLink, 
  ArrowRight,
  X,
  Wine
} from 'lucide-react';
import { api, User, Event } from '@/lib/services/api';

interface PassCreationSectionProps {
  users: User[];
  events: Event[];
  onPassCreated?: () => void;
}

export function PassCreationSection({ users, events, onPassCreated }: PassCreationSectionProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [selectedPassType, setSelectedPassType] = useState<'NORMAL' | 'GIFT' | 'INVITATION' | 'VIP'>('VIP');
  const [selectedDrinkName, setSelectedDrinkName] = useState<string>('');
  const [selectedAromas, setSelectedAromas] = useState<string[]>([]);
  const [guestFirstName, setGuestFirstName] = useState('');
  const [guestLastName, setGuestLastName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string; pass?: any } | null>(null);

  // Filter users by name, email, or instagram handle
  const filteredUsers = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return users.slice(0, 50); // initial limit for performance

    return users.filter(u => {
      const name = (u.full_name || '').toLowerCase();
      const email = (u.email || '').toLowerCase();
      const insta = (u.instagram_handle || '').toLowerCase();
      return name.includes(term) || email.includes(term) || insta.includes(term);
    }).slice(0, 50);
  }, [users, searchTerm]);

  // Selected event object
  const selectedEvent = useMemo(() => {
    return events.find(e => e.id === selectedEventId) || null;
  }, [events, selectedEventId]);

  // Available drinks from selected event (JSONB drinks array or fallback drink_menus)
  const availableDrinks = useMemo(() => {
    if (!selectedEvent) return [];
    const raw = (selectedEvent as any).drinks || (selectedEvent as any).drink_menus;
    if (!raw) return [];
    let list = raw;
    if (typeof raw === 'string') {
      try {
        list = JSON.parse(raw);
      } catch {
        list = [];
      }
    }
    if (!Array.isArray(list)) return [];
    return list.map((d: any) => ({
      id: d.id,
      name: typeof d === 'string' ? d : (d.name || ''),
      aromas: Array.isArray(d.aromas)
        ? d.aromas.filter((a: any) => typeof a === 'string' && a.trim().length > 0)
        : (typeof d.aromas === 'string' ? d.aromas.split(',').map((a: string) => a.trim()).filter(Boolean) : []),
    })).filter(d => d.name && d.name.trim().length > 0);
  }, [selectedEvent]);

  // Currently selected drink details
  const currentDrink = useMemo(() => {
    if (!selectedDrinkName) return null;
    return availableDrinks.find(d => d.name.toLowerCase() === selectedDrinkName.toLowerCase()) || null;
  }, [availableDrinks, selectedDrinkName]);

  // Available aromas for the selected drink
  const availableAromas = useMemo(() => {
    if (!currentDrink || !Array.isArray(currentDrink.aromas)) return [];
    return currentDrink.aromas;
  }, [currentDrink]);

  const handleEventChange = (eventId: string) => {
    setSelectedEventId(eventId);
    setSelectedDrinkName('');
    setSelectedAromas([]);
  };

  const handleDrinkChange = (drinkName: string) => {
    setSelectedDrinkName(drinkName);
    setSelectedAromas([]);
  };

  const handleAromaSelect = (aroma: string) => {
    setSelectedAromas([aroma]);
  };

  const handleSelectUser = (user: User) => {
    setSelectedUser(user);
    setStatusMessage(null);
    if (user.full_name) {
      const parts = user.full_name.trim().split(' ');
      setGuestFirstName(parts[0] || '');
      setGuestLastName(parts.slice(1).join(' ') || '');
    } else {
      setGuestFirstName('');
      setGuestLastName('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) {
      setStatusMessage({ type: 'error', text: 'Veuillez sélectionner un utilisateur destinataire.' });
      return;
    }
    if (!selectedEventId) {
      setStatusMessage({ type: 'error', text: 'Veuillez sélectionner un événement.' });
      return;
    }

    setIsSubmitting(true);
    setStatusMessage(null);

    try {
      const result = await api.createManualPass({
        userId: selectedUser.id,
        eventId: selectedEventId,
        passType: selectedPassType,
        guestFirstName: guestFirstName.trim() || undefined,
        guestLastName: guestLastName.trim() || undefined,
        drink_name: selectedDrinkName.trim() || undefined,
        drinkName: selectedDrinkName.trim() || undefined,
        selected_aromas: selectedAromas,
        selectedAromas: selectedAromas,
      });

      setStatusMessage({
        type: 'success',
        text: result.message || `Pass ${selectedPassType} émis avec succès pour ${selectedUser.email} !`,
        pass: result.pass,
      });

      setSelectedDrinkName('');
      setSelectedAromas([]);

      if (onPassCreated) {
        onPassCreated();
      }
    } catch (err: any) {
      console.error('Erreur création pass manuel:', err);
      setStatusMessage({
        type: 'error',
        text: err.message || 'Une erreur est survenue lors de la création du pass.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-6" style={{ borderColor: 'var(--border)' }}>
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-300 flex items-center justify-center text-black font-extrabold shadow-md shadow-amber-500/20">
              <Sparkles size={20} />
            </div>
            <div>
              <h2 className="text-2xl font-extrabold tracking-tight" style={{ color: 'var(--text-primary)' }}>
                Création de Passes Manuels
              </h2>
              <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                Attribuez manuellement des passes spéciaux (VIP, Cadeau, Invitation) ou standards aux utilisateurs.
              </p>
            </div>
          </div>
        </div>

        {selectedUser && (
          <div className="flex items-center gap-3 px-4 py-2 rounded-2xl bg-amber-500/10 border border-amber-500/30">
            <div className="w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center text-white font-bold text-xs">
              {selectedUser.full_name ? selectedUser.full_name[0].toUpperCase() : selectedUser.email[0].toUpperCase()}
            </div>
            <div className="text-xs">
              <span className="font-semibold block text-amber-500">Cible sélectionnée :</span>
              <span className="font-bold text-white">{selectedUser.full_name || selectedUser.email}</span>
            </div>
            <button
              onClick={() => setSelectedUser(null)}
              className="text-gray-400 hover:text-white ml-2 transition-colors"
              title="Désélectionner"
            >
              <X size={16} />
            </button>
          </div>
        )}
      </div>

      {/* Main Grid: User Selection & Pass Creation Form */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* ── LEFT COLUMN (5 cols): User Search & Selection ── */}
        <div className="lg:col-span-5 card p-6 shadow-sm flex flex-col h-[740px]">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
              <UserIcon size={18} className="text-passi-corail" />
              1. Sélectionner l'Utilisateur
            </h3>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-gray-300">
              {filteredUsers.length} trouvé{filteredUsers.length > 1 ? 's' : ''}
            </span>
          </div>

          {/* Search Box */}
          <div className="relative mb-4">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Nom, email ou @instagram..."
              className="input pl-10 text-sm"
              aria-label="Recherche utilisateur"
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')} 
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Users List */}
          <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
            {filteredUsers.length === 0 ? (
              <div className="h-48 flex flex-col items-center justify-center text-center p-4">
                <AlertCircle size={28} className="text-gray-500 mb-2" />
                <p className="text-sm font-semibold text-gray-400">Aucun utilisateur trouvé</p>
                <p className="text-xs text-gray-500 mt-1">Essayez un autre nom ou handle Instagram.</p>
              </div>
            ) : (
              filteredUsers.map((u) => {
                const isSelected = selectedUser?.id === u.id;
                return (
                  <div
                    key={u.id}
                    onClick={() => handleSelectUser(u)}
                    className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                      isSelected 
                        ? 'bg-amber-500/10 border-amber-500/60 shadow-sm shadow-amber-500/10 ring-1 ring-amber-500/50' 
                        : 'bg-black/20 hover:bg-black/40 border-transparent hover:border-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm flex-shrink-0 ${
                        isSelected 
                          ? 'bg-gradient-to-tr from-amber-500 to-amber-300 text-black' 
                          : 'bg-slate-800 text-white'
                      }`}>
                        {u.full_name ? u.full_name[0].toUpperCase() : u.email[0].toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold truncate leading-tight" style={{ color: 'var(--text-primary)' }}>
                          {u.full_name || 'Sans nom'}
                        </p>
                        <p className="text-xs truncate text-gray-400 leading-tight">
                          {u.email}
                        </p>
                        {u.instagram_handle && (
                          <p className="text-[11px] truncate text-pink-400 font-medium flex items-center gap-1 mt-0.5">
                            <span>IG:</span>
                            <span>{u.instagram_handle.replace('https://www.instagram.com/', '@').replace('https://instagram.com/', '@')}</span>
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex-shrink-0">
                      {isSelected ? (
                        <span className="w-7 h-7 rounded-full bg-amber-500 text-black flex items-center justify-center shadow">
                          <Check size={16} strokeWidth={3} />
                        </span>
                      ) : (
                        <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-slate-800 text-gray-300 hover:text-white hover:bg-slate-700 transition-colors">
                          Choisir
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ── RIGHT COLUMN (7 cols): Pass Configuration Form ── */}
        <div className="lg:col-span-7 card p-7 shadow-sm">
          <div className="flex items-center justify-between mb-6 border-b pb-4" style={{ borderColor: 'var(--border)' }}>
            <h3 className="text-base font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
              <Ticket size={18} className="text-passi-turquoise" />
              2. Paramètres & Émission du Pass
            </h3>
            {selectedUser && (
              <span className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                <CheckCircle2 size={14} /> Prêt à configurer
              </span>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            
            {/* Target User Banner */}
            <div>
              <label className="label text-xs uppercase tracking-wider font-extrabold text-gray-400">
                Utilisateur Destinataire
              </label>
              {selectedUser ? (
                <div className="p-4 rounded-xl border border-amber-500/40 bg-gradient-to-r from-amber-500/10 via-black/40 to-transparent flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-amber-500 text-black font-extrabold flex items-center justify-center text-sm shadow">
                      {selectedUser.full_name ? selectedUser.full_name[0].toUpperCase() : selectedUser.email[0].toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-sm text-white truncate">
                        {selectedUser.full_name || 'Utilisateur sans nom'}
                      </p>
                      <p className="text-xs text-gray-300 truncate">{selectedUser.email}</p>
                      {selectedUser.instagram_handle && (
                        <a 
                          href={selectedUser.instagram_handle.startsWith('http') ? selectedUser.instagram_handle : `https://instagram.com/${selectedUser.instagram_handle.replace('@', '')}`}
                          target="_blank" 
                          rel="noreferrer" 
                          className="text-xs text-pink-400 hover:underline flex items-center gap-1 mt-0.5"
                        >
                          <ExternalLink size={12} /> {selectedUser.instagram_handle}
                        </a>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedUser(null)}
                    className="btn-ghost text-xs px-3 py-1.5 text-gray-400 hover:text-white"
                  >
                    Changer
                  </button>
                </div>
              ) : (
                <div className="p-5 rounded-xl border border-dashed border-gray-700 bg-black/20 text-center">
                  <UserIcon size={24} className="mx-auto text-gray-500 mb-2" />
                  <p className="text-sm font-semibold text-gray-300">Aucun utilisateur sélectionné</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Cliquez sur un utilisateur dans la colonne de gauche pour continuer.
                  </p>
                </div>
              )}
            </div>

            {/* Select Event */}
            <div>
              <label className="label text-xs uppercase tracking-wider font-extrabold text-gray-400">
                Sélectionner l'Événement *
              </label>
              <div className="relative">
                <select
                  value={selectedEventId}
                  onChange={(e) => handleEventChange(e.target.value)}
                  required
                  className="input text-sm appearance-none cursor-pointer"
                  aria-label="Sélectionner l'événement"
                >
                  <option value="">-- Choisir un événement actif --</option>
                  {events.map((evt) => (
                    <option key={evt.id} value={evt.id}>
                      {evt.title} — {new Date(evt.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })} ({evt.base_price ?? 0} DT)
                    </option>
                  ))}
                </select>
                <Calendar size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400" />
              </div>
              {selectedEvent && (
                <div className="mt-2 text-xs flex items-center justify-between text-gray-400 px-1">
                  <span>Lieu: <strong className="text-white">{selectedEvent.location}</strong></span>
                  <span>Prix de base: <strong className="text-amber-400">{selectedEvent.base_price ?? 0} DT</strong></span>
                </div>
              )}
            </div>

            {/* Select Pass Type */}
            <div>
              <label className="label text-xs uppercase tracking-wider font-extrabold text-gray-400 mb-2">
                Type de Pass *
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                
                {/* VIP */}
                <div
                  onClick={() => setSelectedPassType('VIP')}
                  className={`p-4 rounded-xl border cursor-pointer transition-all relative ${
                    selectedPassType === 'VIP'
                      ? 'bg-gradient-to-b from-amber-500/20 to-black/60 border-amber-500 shadow-md shadow-amber-500/20 ring-1 ring-amber-500'
                      : 'bg-black/30 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="flex items-center gap-2 font-extrabold text-sm text-amber-400">
                      <Crown size={18} className="text-amber-400" />
                      VIP
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      Instantané
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 leading-snug">
                    Accès VIP complet. Gratuit, QR code généré immédiatement sans validation ni paiement.
                  </p>
                </div>

                {/* GIFT / CADEAU */}
                <div
                  onClick={() => setSelectedPassType('GIFT')}
                  className={`p-4 rounded-xl border cursor-pointer transition-all relative ${
                    selectedPassType === 'GIFT'
                      ? 'bg-gradient-to-b from-rose-500/20 to-black/60 border-rose-500 shadow-md shadow-rose-500/20 ring-1 ring-rose-500'
                      : 'bg-black/30 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="flex items-center gap-2 font-extrabold text-sm text-rose-400">
                      <Gift size={18} className="text-rose-400" />
                      Cadeau (GIFT)
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30">
                      Offert
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 leading-snug">
                    Pass cadeau gratuit. QR code généré immédiatement, accès instantané pour l'utilisateur.
                  </p>
                </div>

                {/* INVITATION */}
                <div
                  onClick={() => setSelectedPassType('INVITATION')}
                  className={`p-4 rounded-xl border cursor-pointer transition-all relative ${
                    selectedPassType === 'INVITATION'
                      ? 'bg-gradient-to-b from-purple-500/20 to-black/60 border-purple-500 shadow-md shadow-purple-500/20 ring-1 ring-purple-500'
                      : 'bg-black/30 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="flex items-center gap-2 font-extrabold text-sm text-purple-400">
                      <Mail size={18} className="text-purple-400" />
                      Invitation
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                      À accepter
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 leading-snug">
                    L'invité reçoit une notification sur son dashboard pour accepter ou décliner l'invitation.
                  </p>
                </div>

                {/* NORMAL */}
                <div
                  onClick={() => setSelectedPassType('NORMAL')}
                  className={`p-4 rounded-xl border cursor-pointer transition-all relative ${
                    selectedPassType === 'NORMAL'
                      ? 'bg-gradient-to-b from-cyan-500/20 to-black/60 border-cyan-500 shadow-md shadow-cyan-500/20 ring-1 ring-cyan-500'
                      : 'bg-black/30 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="flex items-center gap-2 font-extrabold text-sm text-cyan-400">
                      <Ticket size={18} className="text-cyan-400" />
                      Normal
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                      Standard
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 leading-snug">
                    Pass standard créé en attente (pending). Nécessite paiement au guichet ou approbation.
                  </p>
                </div>

              </div>
            </div>

            {/* Drink & Aroma Selection (VIP / Gift / Invitation) */}
            <div className="p-4 rounded-xl bg-black/20 border border-slate-800 space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="label text-xs uppercase tracking-wider font-extrabold text-gray-400 flex items-center gap-1.5 m-0">
                    <Wine size={14} className="text-passi-turquoise" />
                    <span>Boisson Incluse (VIP, Cadeau, Invitation)</span>
                  </label>
                  {selectedDrinkName && (
                    <button
                      type="button"
                      onClick={() => handleDrinkChange('')}
                      className="text-[11px] text-gray-400 hover:text-white transition-colors underline"
                    >
                      Désélectionner
                    </button>
                  )}
                </div>

                {!selectedEventId ? (
                  <p className="text-xs text-gray-500 italic py-1">
                    Sélectionnez d'abord un événement pour afficher ses boissons disponibles.
                  </p>
                ) : availableDrinks.length === 0 ? (
                  <p className="text-xs text-gray-500 italic py-1">
                    Aucune boisson n'est configurée pour cet événement.
                  </p>
                ) : (
                  <div className="relative">
                    <select
                      value={selectedDrinkName}
                      onChange={(e) => handleDrinkChange(e.target.value)}
                      className="input text-sm appearance-none cursor-pointer bg-slate-900 border-slate-700 text-white pr-10"
                      aria-label="Sélectionner la boisson"
                    >
                      <option value="">-- Aucune boisson / Choisir une boisson --</option>
                      {availableDrinks.map((drink, idx) => (
                        <option key={`${drink.name}-${idx}`} value={drink.name}>
                          {drink.name} {drink.aromas && drink.aromas.length > 0 ? `(${drink.aromas.length} arôme${drink.aromas.length > 1 ? 's' : ''} disponible${drink.aromas.length > 1 ? 's' : ''})` : ''}
                        </option>
                      ))}
                    </select>
                    <Wine size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400" />
                  </div>
                )}
              </div>

              {/* Conditional Aroma Selection Checkboxes */}
              {currentDrink && availableAromas.length > 0 && (
                <div className="pt-3 border-t border-slate-800 space-y-2.5 animate-fadeIn">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-passi-turquoise flex items-center gap-1.5">
                      <Sparkles size={13} />
                      Choisissez votre arôme / goût pour {currentDrink.name} :
                    </span>
                    {selectedAromas.length > 0 && (
                      <span className="text-[11px] text-emerald-400 font-semibold">
                        Sélectionné
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                    {availableAromas.map((aroma, idx) => {
                      const isChecked = selectedAromas[0] === aroma;
                      const radioId = `admin-pass-aroma-${idx}`;
                      return (
                        <label
                          key={aroma}
                          htmlFor={radioId}
                          onClick={() => handleAromaSelect(aroma)}
                          className={`flex items-center gap-2.5 p-2.5 rounded-lg border text-xs cursor-pointer transition-all select-none ${
                            isChecked
                              ? 'bg-passi-turquoise/15 border-passi-turquoise/60 text-passi-turquoise font-bold ring-1 ring-passi-turquoise/40 shadow-sm'
                              : 'bg-black/30 border-slate-800 text-gray-300 hover:bg-black/50 hover:border-slate-700'
                          }`}
                        >
                          <input
                            type="radio"
                            id={radioId}
                            name="admin_arome"
                            value={aroma}
                            checked={isChecked}
                            onChange={() => handleAromaSelect(aroma)}
                            className="w-4 h-4 border-slate-700 text-passi-turquoise focus:ring-passi-turquoise focus:ring-offset-slate-950 cursor-pointer accent-teal-500"
                          />
                          <span className="flex-1 truncate">{aroma}</span>
                          {isChecked && <Check size={14} className="text-passi-turquoise shrink-0" />}
                        </label>
                      );
                    })}
                  </div>

                  {selectedAromas.length > 0 && (
                    <p className="text-[11px] text-gray-400 italic">
                      Sélectionné : <span className="text-white font-medium">{selectedAromas[0]}</span>
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Guest First / Last Name (Optional) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label text-xs">Prénom de l'invité (optionnel)</label>
                <input
                  type="text"
                  value={guestFirstName}
                  onChange={(e) => setGuestFirstName(e.target.value)}
                  placeholder="Ex: Selim"
                  className="input text-sm"
                />
              </div>
              <div>
                <label className="label text-xs">Nom de l'invité (optionnel)</label>
                <input
                  type="text"
                  value={guestLastName}
                  onChange={(e) => setGuestLastName(e.target.value)}
                  placeholder="Ex: Ben Mansour"
                  className="input text-sm"
                />
              </div>
            </div>

            {/* Recap Box */}
            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 text-xs space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Statut initial :</span>
                <span className="font-bold text-white">
                  {selectedPassType === 'VIP' || selectedPassType === 'GIFT' 
                    ? '✓ ACTIVÉ (Payé / Offert)' 
                    : selectedPassType === 'INVITATION'
                    ? '⏳ EN ATTENTE (Invitation)' 
                    : '⏳ EN ATTENTE (Paiement)'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Boisson incluse :</span>
                <span className="font-bold text-passi-turquoise text-right">
                  {selectedDrinkName 
                    ? `${selectedDrinkName}${selectedAromas.length > 0 ? ` (${selectedAromas.join(', ')})` : ''}` 
                    : 'Aucune boisson'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Génération du QR Code d'entrée :</span>
                <span className={`font-bold ${selectedPassType === 'VIP' || selectedPassType === 'GIFT' ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {selectedPassType === 'VIP' || selectedPassType === 'GIFT' 
                    ? '⚡ Immédiat (Visible dès maintenant)' 
                    : selectedPassType === 'INVITATION'
                    ? 'Dévoilé après acceptation de l\'invité' 
                    : 'Dévoilé après validation du paiement'}
                </span>
              </div>
              <div className="flex justify-between items-center border-t border-slate-800 pt-2">
                <span className="text-gray-400">Montant facturé :</span>
                <span className="font-extrabold text-sm text-emerald-400">
                  {selectedPassType === 'VIP' || selectedPassType === 'GIFT' || selectedPassType === 'INVITATION' 
                    ? '0 DT (Offert / Invitation)' 
                    : `${selectedEvent?.base_price ?? 0} DT`}
                </span>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting || !selectedUser || !selectedEventId}
              className={`w-full py-4 rounded-2xl font-extrabold text-sm flex items-center justify-center gap-2 transition-all shadow-lg ${
                isSubmitting || !selectedUser || !selectedEventId
                  ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                  : selectedPassType === 'VIP'
                  ? 'bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-500 text-black hover:shadow-amber-500/25 hover:scale-[1.01]'
                  : selectedPassType === 'GIFT'
                  ? 'bg-gradient-to-r from-rose-500 to-pink-500 text-white hover:shadow-rose-500/25 hover:scale-[1.01]'
                  : selectedPassType === 'INVITATION'
                  ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:shadow-purple-500/25 hover:scale-[1.01]'
                  : 'bg-passi-corail text-white hover:shadow-red-500/25 hover:scale-[1.01]'
              }`}
            >
              {isSubmitting ? (
                <>
                  <svg className="animate-spin w-5 h-5 text-current" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  <span>Création du pass en cours...</span>
                </>
              ) : (
                <>
                  <Sparkles size={18} />
                  <span>
                    Émettre le Pass {selectedPassType === 'GIFT' ? 'Cadeau' : selectedPassType}
                  </span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>

            {/* Status Message */}
            {statusMessage && (
              <div
                className={`p-4 rounded-xl flex items-start gap-3 text-sm animate-fadeIn ${
                  statusMessage.type === 'success'
                    ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300'
                    : 'bg-rose-500/10 border border-rose-500/30 text-rose-300'
                }`}
              >
                {statusMessage.type === 'success' ? (
                  <CheckCircle2 size={20} className="flex-shrink-0 text-emerald-400 mt-0.5" />
                ) : (
                  <AlertCircle size={20} className="flex-shrink-0 text-rose-400 mt-0.5" />
                )}
                <div className="flex-1">
                  <p className="font-bold">{statusMessage.text}</p>
                  {statusMessage.pass && (
                    <p className="text-xs text-gray-400 mt-1">
                      ID du Pass: <code className="text-amber-300">{statusMessage.pass.id}</code>
                    </p>
                  )}
                </div>
              </div>
            )}

          </form>
        </div>

      </div>
    </div>
  );
}
