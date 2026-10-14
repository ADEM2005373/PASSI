"use client";

import React, { useMemo } from 'react';
import { Wine, Sparkles, Check } from 'lucide-react';

export interface DrinkOption {
  id?: string;
  name: string;
  aromas?: string[];
  price?: number;
}

export interface DrinkSelectorProps {
  drinks: DrinkOption[];
  selectedDrinkId?: string;
  selectedAromas?: string[];
  onChange?: (drinkId: string, selectedAromas: string[]) => void;
  label?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
}

/**
 * DrinkSelector Component
 * Provides drink selection via an HTML <select> dropdown,
 * and conditionally maps checkboxes for available aromas/flavors.
 */
export function DrinkSelector({
  drinks,
  selectedDrinkId = '',
  selectedAromas = [],
  onChange,
  label = "Boisson incluse",
  required = false,
  disabled = false,
  className = "",
}: DrinkSelectorProps) {
  // Find current selected drink from options (matches by id or fallback by name)
  const selectedDrink = useMemo(() => {
    if (!selectedDrinkId) return null;
    return drinks.find(d => (d.id && d.id === selectedDrinkId) || d.name === selectedDrinkId) || null;
  }, [drinks, selectedDrinkId]);

  // Available aromas for the currently selected drink
  const availableAromas = useMemo(() => {
    if (!selectedDrink || !Array.isArray(selectedDrink.aromas)) return [];
    return selectedDrink.aromas.filter((a): a is string => typeof a === 'string' && a.trim().length > 0);
  }, [selectedDrink]);

  // Handler for drink dropdown change
  const handleDrinkChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newDrinkId = e.target.value;
    // When changing drink, reset selected aromas to empty array
    if (onChange) {
      onChange(newDrinkId, []);
    }
  };

  // Handler for aroma checkbox toggling
  const handleAromaToggle = (aroma: string) => {
    if (!onChange) return;
    const exists = selectedAromas.includes(aroma);
    const updated = exists 
      ? selectedAromas.filter(a => a !== aroma)
      : [...selectedAromas, aroma];
    onChange(selectedDrinkId, updated);
  };

  if (!drinks || drinks.length === 0) {
    return null;
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {/* 1. Drink Dropdown */}
      <div>
        {label && (
          <label className="label flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-neutral-300 mb-1.5">
            <Wine size={14} className="text-passi-turquoise" />
            <span>{label}</span>
            {required && <span className="text-red-400">*</span>}
          </label>
        )}
        <select
          value={selectedDrinkId}
          onChange={handleDrinkChange}
          required={required}
          disabled={disabled}
          className="input w-full cursor-pointer bg-neutral-900 border-neutral-700 text-white focus:border-passi-turquoise"
          aria-label="Sélectionnez une boisson"
        >
          <option value="">-- Choisir une boisson --</option>
          {drinks.map((drink, idx) => {
            const val = drink.id || drink.name;
            const aromaCount = drink.aromas && drink.aromas.length > 0 ? ` (${drink.aromas.length} arômes disponibles)` : '';
            return (
              <option key={drink.id || `drink-${idx}`} value={val}>
                {drink.name}{aromaCount}
              </option>
            );
          })}
        </select>
      </div>

      {/* 2. Conditional Aromas / Flavors Checkboxes */}
      {selectedDrink && availableAromas.length > 0 && (
        <div className="p-3.5 rounded-xl bg-neutral-900/80 border border-neutral-800 space-y-2.5 animate-in fade-in slide-in-from-top-1 duration-200">
          <div className="flex items-center gap-1.5 text-xs font-bold text-passi-turquoise">
            <Sparkles size={13} />
            <span>Choisissez vos arômes / goûts :</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
            {availableAromas.map((aroma, idx) => {
              const isChecked = selectedAromas.includes(aroma);
              const checkboxId = `aroma-${selectedDrink.id || 'drink'}-${idx}`;

              return (
                <label
                  key={aroma}
                  htmlFor={checkboxId}
                  className={`flex items-center gap-2.5 p-2 rounded-lg border text-xs cursor-pointer transition-all select-none ${
                    isChecked
                      ? 'bg-passi-turquoise/15 border-passi-turquoise/40 text-passi-turquoise font-bold'
                      : 'bg-neutral-800/60 border-neutral-700/60 text-neutral-300 hover:bg-neutral-800 hover:text-white'
                  }`}
                >
                  <input
                    type="checkbox"
                    id={checkboxId}
                    name="selected_aromas"
                    value={aroma}
                    checked={isChecked}
                    disabled={disabled}
                    onChange={() => handleAromaToggle(aroma)}
                    className="w-4 h-4 rounded border-neutral-600 text-passi-turquoise focus:ring-passi-turquoise focus:ring-offset-neutral-900 cursor-pointer accent-teal-500"
                  />
                  <span className="flex-1">{aroma}</span>
                  {isChecked && <Check size={12} className="text-passi-turquoise shrink-0" />}
                </label>
              );
            })}
          </div>

          {selectedAromas.length > 0 && (
            <p className="text-[11px] text-neutral-400 italic pt-1">
              Sélectionné(s) : {selectedAromas.join(', ')}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default DrinkSelector;
