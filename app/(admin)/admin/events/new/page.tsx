"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { api, PromoCode } from "@/lib/services/api";
import { formatImageUrl } from "@/lib/utils/url";
import { useAuth } from "@/lib/context/auth-context";
import { Logo } from "@/components/Logo";
import { 
  Sun, 
  Moon, 
  ArrowLeft, 
  CalendarDays, 
  Plus, 
  X, 
  Tag, 
  Ticket, 
  Check, 
  Wine, 
  DollarSign 
} from "lucide-react";

export default function NewEventPage() {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [location, setLocation] = useState("");
  const [maxPasses, setMaxPasses] = useState(1);
  const [ticketPrice, setTicketPrice] = useState<number>(20);
  const [imageUrl, setImageUrl] = useState("");
  const [description, setDescription] = useState("");
  const [dressCode, setDressCode] = useState("");
  const [drinks, setDrinks] = useState<{ name: string }[]>([]);
  const [promoCodes, setPromoCodes] = useState<PromoCode[]>([]);

  useEffect(() => {
    setMounted(true);
    const checkAuth = async () => {
      const user = await api.getCurrentUser();
      if (!user || user.role !== 'admin') {
        router.replace("/staff/login");
        return;
      }
      setIsAdmin(true);
    };
    checkAuth();
  }, [router]);

  const handleAddDrink = () => {
    setDrinks([...drinks, { name: "" }]);
  };

  const handleRemoveDrink = (index: number) => {
    setDrinks(drinks.filter((_, i) => i !== index));
  };

  const handleDrinkChange = (index: number, val: string) => {
    const updated = [...drinks];
    updated[index].name = val;
    setDrinks(updated);
  };

  const handleAddPromoCode = () => {
    setPromoCodes([...promoCodes, { code: "", discount_amount: 5 }]);
  };

  const handleRemovePromoCode = (index: number) => {
    setPromoCodes(promoCodes.filter((_, i) => i !== index));
  };

  const handlePromoChange = (index: number, field: 'code' | 'discount_amount', val: any) => {
    const updated = [...promoCodes];
    if (field === 'code') {
      updated[index].code = String(val).toUpperCase();
    } else {
      updated[index].discount_amount = Math.max(0, parseFloat(val) || 0);
    }
    setPromoCodes(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (new Date(date).getTime() < Date.now()) {
      setErrorMsg("La date de l'événement doit être ultérieure à aujourd'hui.");
      return;
    }

    if (ticketPrice < 0) {
      setErrorMsg("Le prix du ticket ne peut pas être négatif.");
      return;
    }

    setIsSubmitting(true);
    try {
      const validDrinks = drinks.filter(d => d.name.trim() !== "");
      const validPromoCodes = promoCodes
        .filter(p => p.code.trim() !== "" && p.discount_amount > 0)
        .map(p => ({ code: p.code.trim().toUpperCase(), discount_amount: Number(p.discount_amount) }));

      await api.createEvent(
        title.trim(),
        new Date(date).toISOString(),
        location.trim(),
        false,
        Number(maxPasses) || 1,
        formatImageUrl(imageUrl.trim()),
        description.trim() || undefined,
        dressCode.trim() || undefined,
        validDrinks,
        ticketPrice,
        validPromoCodes
      );

      router.push("/admin/evenements");
    } catch (err: any) {
      console.error("Error creating event:", err);
      setErrorMsg(err.message || "Impossible de créer l'événement");
      setIsSubmitting(false);
    }
  };

  if (!mounted || !isAdmin) return null;

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text-primary)]">
      {/* Top Header */}
      <header className="sticky top-0 z-30 border-b border-[var(--border)] bg-[var(--bg-card)]/80 backdrop-blur-md px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push("/admin/evenements")}
            className="btn-ghost p-2 rounded-xl text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            title="Retour à la liste"
          >
            <ArrowLeft size={18} />
          </button>
          <Logo variant="auto" className="w-[110px] h-[33px]" />
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-passi-corail/10 text-passi-corail border border-passi-corail/20">
            Nouvel Événement
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="p-2 rounded-xl btn-ghost text-[var(--text-secondary)]"
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-3xl mx-auto p-6 md:p-10 space-y-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
            Créer un nouvel événement
          </h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            Définissez le tarif de base, configurez les codes promo pour le guichet et publiez votre événement.
          </p>
        </div>

        {errorMsg && (
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-sm font-semibold">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="card p-7 shadow-sm space-y-6">
          {/* General Info */}
          <div className="space-y-4">
            <h2 className="text-base font-bold flex items-center gap-2 text-passi-corail">
              <CalendarDays size={18} /> Informations Générales
            </h2>

            <div>
              <label className="label">Titre de l'événement *</label>
              <input
                type="text"
                required
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Ex: Rooftop Sunset Session #4"
                className="input"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Date & Heure *</label>
                <input
                  type="datetime-local"
                  required
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  className="input"
                />
              </div>

              <div>
                <label className="label">Lieu de l'événement *</label>
                <input
                  type="text"
                  required
                  value={location}
                  onChange={e => setLocation(e.target.value)}
                  placeholder="Ex: Le Panoramique, Gammarth"
                  className="input"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Max passes par utilisateur</label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  required
                  value={maxPasses}
                  onChange={e => setMaxPasses(parseInt(e.target.value) || 1)}
                  className="input"
                />
              </div>

              <div>
                <label className="label">Prix du ticket (DT) *</label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    required
                    value={ticketPrice}
                    onChange={e => setTicketPrice(Math.max(0, parseFloat(e.target.value) || 0))}
                    placeholder="25"
                    className="input font-bold text-amber-500 pr-10"
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 font-bold text-xs text-neutral-400">
                    DT
                  </span>
                </div>
              </div>
            </div>
          </div>

          <hr style={{ borderColor: 'var(--border)' }} />

          {/* Pricing & Promo Codes */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold flex items-center gap-2 text-passi-turquoise">
                  <Tag size={18} /> Codes Promo & Réductions
                </h2>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                  Ajoutez des codes applicables au guichet physique ou lors de la demande.
                </p>
              </div>
              <button
                type="button"
                onClick={handleAddPromoCode}
                className="flex items-center gap-1.5 text-xs font-bold text-passi-turquoise hover:underline cursor-pointer"
              >
                <Plus size={15} /> Ajouter un code
              </button>
            </div>

            {promoCodes.length === 0 ? (
              <div className="p-4 rounded-xl text-center text-xs text-[var(--text-muted)]" style={{ backgroundColor: 'var(--bg-input)', border: '1px dashed var(--border)' }}>
                Aucun code promo configuré pour cet événement.
              </div>
            ) : (
              <div className="space-y-2.5">
                {promoCodes.map((promo, idx) => (
                  <div key={idx} className="flex items-center gap-3 p-3 rounded-xl" style={{ backgroundColor: 'var(--bg-input)', border: '1px solid var(--border)' }}>
                    <div className="flex-1">
                      <input
                        type="text"
                        placeholder="CODE (ex: STUDENT2026)"
                        value={promo.code}
                        onChange={e => handlePromoChange(idx, 'code', e.target.value)}
                        className="input text-xs font-mono uppercase"
                      />
                    </div>
                    <div className="w-32 relative">
                      <input
                        type="number"
                        min="1"
                        step="0.5"
                        placeholder="Réduction"
                        value={promo.discount_amount || ''}
                        onChange={e => handlePromoChange(idx, 'discount_amount', e.target.value)}
                        className="input text-xs font-bold text-emerald-400 pr-8"
                      />
                      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] font-bold text-neutral-500">
                        DT
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemovePromoCode(idx)}
                      className="p-2.5 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors"
                      title="Supprimer ce code promo"
                    >
                      <X size={15} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <hr style={{ borderColor: 'var(--border)' }} />

          {/* Details & Menu */}
          <div className="space-y-4">
            <h2 className="text-base font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
              <Wine size={18} className="text-purple-400" /> Détails Additionnels & Boissons
            </h2>

            <div>
              <label className="label">Description / Détails</label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Détails de la soirée, programmation DJ, accès..."
                className="input min-h-[90px] py-3"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Dress code (optionnel)</label>
                <input
                  type="text"
                  value={dressCode}
                  onChange={e => setDressCode(e.target.value)}
                  placeholder="Ex: All Black, Chic..."
                  className="input"
                />
              </div>

              <div>
                <label className="label">URL Image de couverture (optionnel)</label>
                <input
                  type="url"
                  value={imageUrl}
                  onChange={e => setImageUrl(e.target.value)}
                  onBlur={e => setImageUrl(formatImageUrl(e.target.value))}
                  placeholder="https://... (Lien direct ou GitHub auto-converti)"
                  className="input"
                />
                {imageUrl && (
                  <p className="text-[11px] text-passi-text-sec mt-1 truncate">
                    Formaté : {formatImageUrl(imageUrl)}
                  </p>
                )}
              </div>
            </div>

            {/* Drinks List */}
            <div className="p-4 rounded-xl" style={{ backgroundColor: 'var(--bg-input)', border: '1px solid var(--border)' }}>
              <div className="flex justify-between items-center mb-2">
                <label className="label !mb-0">Menu boissons incluses (optionnel)</label>
                <button
                  type="button"
                  onClick={handleAddDrink}
                  className="flex items-center gap-1 text-xs font-bold text-passi-turquoise hover:underline"
                >
                  <Plus size={14} /> Ajouter boisson
                </button>
              </div>
              {drinks.map((d, index) => (
                <div key={index} className="flex gap-2 mb-2">
                  <input
                    type="text"
                    placeholder="Ex: Gin Tonic, Bière artisanale"
                    value={d.name}
                    onChange={e => handleDrinkChange(index, e.target.value)}
                    className="input flex-1 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveDrink(index)}
                    className="p-2.5 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500/20"
                  >
                    <X size={15} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-4 pt-4">
            <button
              type="button"
              onClick={() => router.push("/admin/evenements")}
              className="btn-ghost flex-1 py-3 text-sm font-bold"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-primary flex-1 py-3 text-sm font-bold flex items-center justify-center gap-2"
            >
              {isSubmitting ? "Création en cours..." : "Publier l'événement"}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
