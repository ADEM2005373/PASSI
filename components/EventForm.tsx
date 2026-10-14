"use client";

import React, { useState } from "react";
import { Plus, X, Calendar, Wine, Tag, ArrowRight } from "lucide-react";
import { formatImageUrl } from "@/lib/utils/url";

export interface DrinkFormItem {
  id?: string;
  name: string;
  aromas: string; // Comma-separated string in the UI (e.g., "Fraise, Passion")
}

export interface PromoCodeFormItem {
  code: string;
  discount_amount: number;
}

export interface EventFormData {
  title: string;
  date: string;
  location: string;
  max_passes_per_user: number;
  base_price: number;
  image_url?: string;
  description?: string;
  dress_code?: string;
  drinks: DrinkFormItem[];
  promo_codes: PromoCodeFormItem[];
}

export interface FormattedDrinkPayload {
  id?: string;
  name: string;
  aromas: string[]; // Structured JSONB array for Supabase
}

export interface FormattedEventPayload {
  title: string;
  date: string;
  location: string;
  max_passes_per_user: number;
  base_price: number;
  image_url: string;
  description?: string;
  dress_code?: string;
  drinks: FormattedDrinkPayload[];
  promo_codes: PromoCodeFormItem[];
}

interface EventFormProps {
  initialData?: Partial<EventFormData>;
  isEditing?: boolean;
  onSubmit: (formattedData: FormattedEventPayload) => Promise<void> | void;
  onCancel?: () => void;
  isSubmitting?: boolean;
}

/**
 * EventForm Component
 * Renders an event creation/edit form with:
 * - Two inputs per drink item: Name (Input 1) and Available Aromas (Input 2)
 * - Comma-separated aroma parsing to structured string[] in the submit handler
 */
export function EventForm({
  initialData,
  isEditing = false,
  onSubmit,
  onCancel,
  isSubmitting = false,
}: EventFormProps) {
  const [title, setTitle] = useState(initialData?.title || "");
  const [date, setDate] = useState(initialData?.date || "");
  const [location, setLocation] = useState(initialData?.location || "");
  const [maxPasses, setMaxPasses] = useState(initialData?.max_passes_per_user || 1);
  const [basePrice, setBasePrice] = useState(initialData?.base_price || 0);
  const [imageUrl, setImageUrl] = useState(initialData?.image_url || "");
  const [description, setDescription] = useState(initialData?.description || "");
  const [dressCode, setDressCode] = useState(initialData?.dress_code || "");
  
  // Drinks state with object structure: [{ name: "Mojito", aromas: "Fraise, Passion" }]
  const [drinks, setDrinks] = useState<DrinkFormItem[]>(
    initialData?.drinks && initialData.drinks.length > 0
      ? initialData.drinks
      : []
  );

  const [promoCodes, setPromoCodes] = useState<PromoCodeFormItem[]>(
    initialData?.promo_codes || []
  );

  // Add a new drink item with the two fields initialized
  const handleAddDrink = () => {
    setDrinks([...drinks, { name: "", aromas: "" }]);
  };

  // Remove a drink item by index
  const handleRemoveDrink = (index: number) => {
    setDrinks(drinks.filter((_, i) => i !== index));
  };

  // Update a specific field for a drink item
  const handleDrinkChange = (index: number, field: keyof DrinkFormItem, value: string) => {
    const updated = [...drinks];
    updated[index] = { ...updated[index], [field]: value };
    setDrinks(updated);
  };

  // Handle Form Submission with Step C Transformation
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Transform the comma-separated aromas string into a real array of strings
    const formattedDrinks: FormattedDrinkPayload[] = drinks
      .filter(drink => drink.name && drink.name.trim().length > 0)
      .map(drink => ({
        ...(drink.id ? { id: drink.id } : {}),
        name: drink.name.trim(),
        aromas: drink.aromas
          ? drink.aromas.split(",").map(a => a.trim()).filter(Boolean)
          : []
      }));

    const formattedPayload: FormattedEventPayload = {
      title: title.trim(),
      date: new Date(date).toISOString(),
      location: location.trim(),
      max_passes_per_user: Number(maxPasses),
      base_price: Number(basePrice),
      image_url: formatImageUrl(imageUrl),
      description: description.trim(),
      dress_code: dressCode.trim(),
      drinks: formattedDrinks,
      promo_codes: promoCodes
        .filter(p => p.code.trim().length > 0 && Number(p.discount_amount) > 0)
        .map(p => ({
          code: p.code.trim().toUpperCase(),
          discount_amount: Number(p.discount_amount)
        }))
    };

    await onSubmit(formattedPayload);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* General Event Information */}
      <div className="space-y-4">
        <div>
          <label className="label">Titre de l'événement *</label>
          <input
            type="text"
            required
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Ex: Rooftop Sunset Session #4"
            className="input w-full"
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
              className="input w-full"
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
              className="input w-full"
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
              className="input w-full"
            />
          </div>

          <div>
            <label className="label">Prix du ticket de base (DT) *</label>
            <input
              type="number"
              min="0"
              step="0.5"
              required
              value={basePrice}
              onChange={e => setBasePrice(parseFloat(e.target.value) || 0)}
              placeholder="25"
              className="input w-full font-bold text-amber-500"
            />
          </div>
        </div>

        <div>
          <label className="label">URL Image de couverture (optionnel)</label>
          <input
            type="url"
            value={imageUrl}
            onChange={e => setImageUrl(e.target.value)}
            placeholder="https://..."
            className="input w-full"
          />
        </div>

        <div>
          <label className="label">Description / Détails</label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Détails de la soirée, programmation..."
            className="input w-full min-h-[80px]"
          />
        </div>

        <div>
          <label className="label">Dress code (optionnel)</label>
          <input
            type="text"
            value={dressCode}
            onChange={e => setDressCode(e.target.value)}
            placeholder="Ex: All Black, Chic..."
            className="input w-full"
          />
        </div>
      </div>

      {/* Drinks & Aromas Section */}
      <div 
        className="p-4 rounded-xl space-y-3" 
        style={{ backgroundColor: "var(--bg-input)", border: "1.5px solid var(--border)" }}
      >
        <div className="flex justify-between items-center mb-1">
          <div>
            <label className="label !mb-0 font-bold flex items-center gap-2">
              <Wine size={16} className="text-purple-400" />
              Menu boissons & arômes (optionnel)
            </label>
            <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">
              Définissez chaque boisson et ses arômes disponibles (séparés par des virgules).
            </p>
          </div>
          <button
            type="button"
            onClick={handleAddDrink}
            className="flex items-center gap-1.5 text-xs font-bold text-passi-turquoise hover:text-passi-turquoise/80 cursor-pointer"
          >
            <Plus size={14} /> Ajouter une boisson
          </button>
        </div>

        {drinks.length === 0 ? (
          <div className="py-4 text-center text-xs text-[var(--text-secondary)] border border-dashed border-[var(--border)] rounded-xl">
            Aucune boisson définie. Cliquez sur "Ajouter une boisson" pour en configurer.
          </div>
        ) : (
          <div className="space-y-3">
            {drinks.map((drink, index) => (
              <div
                key={drink.id || index}
                className="p-3 rounded-xl border border-[var(--border)] bg-black/10 space-y-2 relative"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-passi-turquoise">
                    Boisson #{index + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRemoveDrink(index)}
                    className="p-1.5 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors cursor-pointer"
                    title="Supprimer cette boisson"
                  >
                    <X size={14} />
                  </button>
                </div>

                {/* TWO INPUTS PER DRINK ITEM */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {/* Input 1: Drink Name */}
                  <div>
                    <label className="text-[11px] font-semibold text-[var(--text-secondary)] block mb-1">
                      Nom de la boisson *
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: Mojito, Café..."
                      value={drink.name}
                      onChange={e => handleDrinkChange(index, "name", e.target.value)}
                      className="input text-sm w-full"
                      required
                    />
                  </div>

                  {/* Input 2: Available Aromas */}
                  <div>
                    <label className="text-[11px] font-semibold text-[var(--text-secondary)] block mb-1">
                      Arômes disponibles
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: Fraise, Passion, Pêche (séparés par des virgules)"
                      value={drink.aromas}
                      onChange={e => handleDrinkChange(index, "aromas", e.target.value)}
                      className="input text-sm w-full"
                    />
                  </div>
                </div>

                {/* Visual preview of parsed aromas */}
                {drink.aromas && drink.aromas.trim() && (
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="text-[10px] text-[var(--text-secondary)] mr-1">
                      Arômes détectés :
                    </span>
                    {drink.aromas
                      .split(",")
                      .map(a => a.trim())
                      .filter(Boolean)
                      .map((aroma, aIdx) => (
                        <span
                          key={aIdx}
                          className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-passi-turquoise/15 text-passi-turquoise border border-passi-turquoise/25"
                        >
                          {aroma}
                        </span>
                      ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Form Action Buttons */}
      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={isSubmitting}
          className="btn-primary flex-1 py-3 text-sm font-bold"
        >
          {isSubmitting
            ? "Enregistrement..."
            : isEditing
            ? "Mettre à jour l'événement"
            : "Publier l'événement"}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="btn-ghost px-5 py-3 text-sm font-bold"
          >
            Annuler
          </button>
        )}
      </div>
    </form>
  );
}

export default EventForm;
