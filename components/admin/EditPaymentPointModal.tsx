"use client";

import React, { useState, useEffect } from "react";
import { Pencil, X, Check, AlertCircle, Banknote, Lock } from "lucide-react";
import { updatePaymentPointProfile } from "@/app/actions/admin";
import { api } from "@/lib/services/api";

export interface EditPaymentPointModalProps {
  isOpen: boolean;
  onClose: () => void;
  cashier: any | null;
  onSuccess: () => Promise<void> | void;
}

export function EditPaymentPointModal({
  isOpen,
  onClose,
  cashier,
  onSuccess,
}: EditPaymentPointModalProps) {
  const [sellPointName, setSellPointName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Pre-populate fields whenever modal opens with a cashier
  useEffect(() => {
    if (cashier) {
      setSellPointName(cashier.sell_point_name || cashier.full_name || "");
      setFirstName(cashier.first_name || "");
      setLastName(cashier.last_name || "");
      setEmail(cashier.email || "");
      setPassword("");
      setError("");
      setSuccess("");
    }
  }, [cashier, isOpen]);

  if (!isOpen || !cashier) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!sellPointName.trim()) {
      setError("Le nom du point de vente est obligatoire.");
      return;
    }

    if (!email.trim()) {
      setError("L'adresse email est obligatoire.");
      return;
    }

    if (password && password.length < 6) {
      setError("Le mot de passe doit comporter au moins 6 caractères.");
      return;
    }

    setIsSubmitting(true);

    try {
      // 1. Try Server Action first
      let res = await updatePaymentPointProfile({
        cashierId: cashier.id,
        sellPointName: sellPointName.trim(),
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim().toLowerCase(),
        password: password ? password : undefined,
      });

      // 2. Fallback to API route if Server Action returned failure
      if (!res.success) {
        await api.updatePaymentPointProfile({
          userId: cashier.id,
          sellPointName: sellPointName.trim(),
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim().toLowerCase(),
          password: password ? password : undefined,
        });
      }

      setSuccess("✓ Modifications enregistrées avec succès !");
      await onSuccess();

      setTimeout(() => {
        onClose();
      }, 700);
    } catch (err: any) {
      console.error("Error updating cashier:", err);
      setError(err.message || "Impossible de mettre à jour le point de vente.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-3xl p-6 sm:p-7 max-w-lg w-full shadow-2xl space-y-5 animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-payment-point-title"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-gray-100 dark:border-neutral-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0">
              <Pencil className="w-5 h-5" />
            </div>
            <div>
              <h3 id="edit-payment-point-title" className="text-base font-bold text-neutral-900 dark:text-white">
                Modifier le Point de Paiement
              </h3>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                {cashier.sell_point_name || cashier.full_name || cashier.email}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
            title="Fermer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Notifications */}
        {error && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs font-semibold">
            <AlertCircle size={15} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-xs font-semibold">
            <Check size={15} className="shrink-0" />
            <span>{success}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Nom du Point de Vente */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-1.5">
              Nom du Point de Vente *
            </label>
            <div className="relative">
              <input
                type="text"
                required
                value={sellPointName}
                onChange={(e) => setSellPointName(e.target.value)}
                placeholder="Ex: l'agora_djerba"
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-black text-sm text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all font-medium"
              />
              <Banknote size={16} className="absolute right-3.5 top-3 text-neutral-400 pointer-events-none" />
            </div>
            <p className="text-[11px] text-neutral-400 mt-1">
              Affiché sur l&apos;interface de supervision et sur les reçus de paiement.
            </p>
          </div>

          {/* Email */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-1.5">
              Adresse Email de connexion *
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="caisse@passi.tn"
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-black text-sm text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all font-medium"
            />
          </div>

          {/* Prénom & Nom */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-1.5">
                Prénom du Guichetier
              </label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Ex: Mohamed"
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-black text-sm text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-1.5">
                Nom de famille
              </label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Ex: Trabelsi"
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-black text-sm text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
              />
            </div>
          </div>

          {/* Nouveau mot de passe (optionnel) */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-1.5">
              Nouveau mot de passe (optionnel)
            </label>
            <div className="relative">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Laisser vide pour ne pas modifier"
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-black text-sm text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
              />
              <Lock size={16} className="absolute right-3.5 top-3 text-neutral-400 pointer-events-none" />
            </div>
            <p className="text-[11px] text-neutral-400 mt-1">
              Remplissez uniquement si vous souhaitez réinitialiser les identifiants de ce guichetier.
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-gray-100 dark:border-neutral-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-neutral-600 dark:text-neutral-300 hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-600/20 disabled:opacity-60 transition-all flex items-center gap-2 cursor-pointer"
            >
              <Pencil size={14} />
              <span>{isSubmitting ? "Enregistrement..." : "Enregistrer les modifications"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
