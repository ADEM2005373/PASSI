"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { 
  Search, 
  X, 
  Calendar, 
  MapPin, 
  ArrowRight, 
  Ticket, 
  Sparkles, 
  Clock 
} from "lucide-react";
import { Event } from "@/lib/services/api";
import { 
  searchEventsFaultTolerant, 
  splitHighlightParts, 
  ScoredEvent 
} from "@/lib/utils/search";

interface SearchBarWithSuggestionsProps {
  events: Event[];
  value?: string;
  onChange?: (val: string) => void;
  onSelectEvent?: (event: Event) => void;
  placeholder?: string;
  className?: string;
  showFilters?: boolean;
  selectedDate?: string;
  onDateChange?: (date: string) => void;
  selectedLocation?: string;
  onLocationChange?: (location: string) => void;
  autoRedirectOnSelect?: boolean;
}

export function SearchBarWithSuggestions({
  events = [],
  value: controlledValue,
  onChange,
  onSelectEvent,
  placeholder = "Rechercher une soirée, un concert, un lieu...",
  className = "",
  showFilters = false,
  selectedDate = "",
  onDateChange,
  selectedLocation = "",
  onLocationChange,
  autoRedirectOnSelect = true,
}: SearchBarWithSuggestionsProps) {
  const router = useRouter();
  const [internalQuery, setInternalQuery] = useState(controlledValue || "");
  const [debouncedQuery, setDebouncedQuery] = useState(controlledValue || "");
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number>(-1);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync with controlled value if passed
  useEffect(() => {
    if (controlledValue !== undefined && controlledValue !== internalQuery) {
      setInternalQuery(controlledValue);
      setDebouncedQuery(controlledValue);
    }
  }, [controlledValue]);

  // Debounce query (250ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(internalQuery);
      if (onChange) {
        onChange(internalQuery);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [internalQuery, onChange]);

  // Compute fuzzy matches based on debounced query
  const suggestions: ScoredEvent[] = useMemo(() => {
    if (!debouncedQuery || debouncedQuery.trim().length < 2) {
      return [];
    }

    return searchEventsFaultTolerant(events, debouncedQuery, {
      threshold: 0.35,
      maxResults: 6,
      includeLocationAndDesc: true,
    });
  }, [events, debouncedQuery]);

  // Handle outside click to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextVal = e.target.value;
    setInternalQuery(nextVal);
    setActiveIndex(-1);
    if (nextVal.trim().length >= 2) {
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  };

  const handleClear = () => {
    setInternalQuery("");
    setDebouncedQuery("");
    setActiveIndex(-1);
    setIsOpen(false);
    if (onChange) onChange("");
    inputRef.current?.focus();
  };

  const handleSelect = useCallback((event: Event) => {
    setIsOpen(false);
    setInternalQuery(event.title);
    if (onChange) onChange(event.title);
    if (onSelectEvent) onSelectEvent(event);

    if (autoRedirectOnSelect) {
      router.push(`/events/${event.id}`);
    }
  }, [autoRedirectOnSelect, onChange, onSelectEvent, router]);

  // Keyboard Navigation: ArrowUp, ArrowDown, Enter, Escape
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || suggestions.length === 0) {
      if (e.key === "Enter" && internalQuery.trim()) {
        setIsOpen(false);
        if (onChange) onChange(internalQuery);
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActiveIndex(prev => (prev < suggestions.length - 1 ? prev + 1 : 0));
        break;
      case "ArrowUp":
        e.preventDefault();
        setActiveIndex(prev => (prev > 0 ? prev - 1 : suggestions.length - 1));
        break;
      case "Enter":
        e.preventDefault();
        if (activeIndex >= 0 && activeIndex < suggestions.length) {
          handleSelect(suggestions[activeIndex].event);
        } else {
          setIsOpen(false);
          if (onChange) onChange(internalQuery);
        }
        break;
      case "Escape":
        e.preventDefault();
        setIsOpen(false);
        break;
      default:
        break;
    }
  };

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      {/* Search Input Container */}
      <div className="relative flex flex-col md:flex-row items-center bg-white dark:bg-passi-surface/90 backdrop-blur-md p-1.5 md:p-2 rounded-3xl md:rounded-full border border-gray-200 dark:border-neutral-800 shadow-xl shadow-black/5 focus-within:ring-2 focus-within:ring-passi-corail/50 focus-within:border-passi-corail transition-all duration-300">
        {/* Main Search Input */}
        <div className="flex items-center px-4 py-2.5 flex-1 w-full relative">
          <Search 
            size={20} 
            className="text-passi-corail shrink-0 mr-3 transition-transform duration-300 group-focus-within:scale-110" 
          />
          <input
            ref={inputRef}
            type="text"
            value={internalQuery}
            onChange={handleInputChange}
            onFocus={() => {
              if (internalQuery.trim().length >= 2) setIsOpen(true);
            }}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            aria-autocomplete="list"
            aria-expanded={isOpen}
            className="w-full bg-transparent outline-none text-sm md:text-base font-semibold text-passi-bleu dark:text-neutral-100 placeholder-gray-400 dark:placeholder-neutral-500"
          />

          {internalQuery && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors ml-1"
              title="Effacer la recherche"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Optional Secondary Filters (Date & Location) */}
        {showFilters && (
          <div className="flex items-center w-full md:w-auto gap-2 px-2 pb-2 md:pb-0 md:px-0">
            <div className="hidden md:block w-px h-8 bg-gray-200 dark:bg-neutral-800 mx-1" />

            {/* Date filter */}
            {onDateChange && (
              <div className="flex items-center px-3 py-2 bg-gray-50 dark:bg-neutral-800/80 rounded-full text-xs font-medium text-gray-700 dark:text-neutral-300 border border-gray-200/80 dark:border-neutral-700/80">
                <Calendar size={15} className="text-passi-turquoise mr-2 shrink-0" />
                <input
                  type="date"
                  value={selectedDate}
                  onChange={e => onDateChange(e.target.value)}
                  className="bg-transparent outline-none cursor-pointer w-28 text-passi-bleu dark:text-white"
                />
              </div>
            )}

            {/* Location filter */}
            {onLocationChange && (
              <div className="flex items-center px-3 py-2 bg-gray-50 dark:bg-neutral-800/80 rounded-full text-xs font-medium text-gray-700 dark:text-neutral-300 border border-gray-200/80 dark:border-neutral-700/80">
                <MapPin size={15} className="text-passi-turquoise mr-2 shrink-0" />
                <input
                  type="text"
                  placeholder="Lieu"
                  value={selectedLocation}
                  onChange={e => onLocationChange(e.target.value)}
                  className="bg-transparent outline-none w-20 text-passi-bleu dark:text-white placeholder-gray-400 dark:placeholder-neutral-500"
                />
              </div>
            )}
          </div>
        )}

        {/* Search Submit Button */}
        <button
          type="button"
          onClick={() => {
            setIsOpen(false);
            if (onChange) onChange(internalQuery);
          }}
          className="bg-gradient-to-r from-passi-corail to-orange-500 text-white p-3 rounded-full hover:scale-105 active:scale-95 transition-all shadow-md shadow-passi-corail/30 shrink-0 hidden md:flex items-center justify-center cursor-pointer ml-1"
          title="Rechercher"
        >
          <Search size={18} />
        </button>
      </div>

      {/* Dynamic Suggestions Floating Dropdown */}
      {isOpen && internalQuery.trim().length >= 2 && (
        <div className="absolute left-0 right-0 top-full mt-2 z-50 overflow-hidden rounded-3xl bg-white/95 dark:bg-neutral-900/95 backdrop-blur-2xl border border-gray-200/90 dark:border-neutral-800 shadow-2xl shadow-black/20 animate-in fade-in slide-in-from-top-2 duration-200">
          {suggestions.length === 0 ? (
            <div className="p-6 text-center text-sm text-gray-500 dark:text-neutral-400">
              <Ticket size={28} className="mx-auto mb-2 text-gray-400 dark:text-neutral-600 opacity-60" />
              <p className="font-semibold text-passi-bleu dark:text-white">Aucun événement trouvé</p>
              <p className="text-xs mt-1">
                Aucun résultat pour <span className="font-bold text-passi-corail">"{internalQuery}"</span>. Vérifiez l'orthographe ou essayez un mot-clé plus court.
              </p>
            </div>
          ) : (
            <div>
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 dark:border-neutral-800 text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-neutral-400">
                <span className="flex items-center gap-1.5">
                  <Sparkles size={13} className="text-passi-corail" />
                  Suggestions en direct ({suggestions.length})
                </span>
                <span className="hidden sm:inline text-[10px] lowercase font-normal opacity-70">
                  utilisez ↑ ↓ pour naviguer, Entrée pour valider
                </span>
              </div>

              {/* Suggestions List */}
              <ul className="max-h-[380px] overflow-y-auto divide-y divide-gray-100 dark:divide-neutral-800/60 hide-scrollbar">
                {suggestions.map(({ event, matchType }, idx) => {
                  const isSelected = activeIndex === idx;
                  const parts = splitHighlightParts(event.title, debouncedQuery);

                  return (
                    <li
                      key={event.id}
                      onClick={() => handleSelect(event)}
                      onMouseEnter={() => setActiveIndex(idx)}
                      className={`flex items-center gap-3.5 p-3.5 sm:px-5 cursor-pointer transition-all ${
                        isSelected 
                          ? "bg-passi-corail/10 dark:bg-passi-corail/15" 
                          : "hover:bg-gray-50 dark:hover:bg-neutral-800/50"
                      }`}
                    >
                      {/* Event Thumbnail */}
                      <div className="w-12 h-12 rounded-2xl overflow-hidden bg-gray-200 dark:bg-neutral-800 shrink-0 relative border border-gray-200/60 dark:border-neutral-700/60">
                        {event.image_url ? (
                          <img
                            src={event.image_url}
                            alt={event.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-passi-corail font-bold text-xs bg-passi-corail/10">
                            <Ticket size={18} />
                          </div>
                        )}
                      </div>

                      {/* Event Details with Highlighted Title */}
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-bold text-passi-bleu dark:text-white truncate">
                          {parts.map((part, pIdx) => (
                            part.highlight ? (
                              <mark 
                                key={pIdx} 
                                className="bg-transparent text-passi-corail font-extrabold underline decoration-passi-corail/40"
                              >
                                {part.text}
                              </mark>
                            ) : (
                              <span key={pIdx}>{part.text}</span>
                            )
                          ))}
                        </h4>

                        <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 dark:text-neutral-400">
                          {event.date && (
                            <span className="flex items-center gap-1 shrink-0">
                              <Calendar size={12} className="text-passi-turquoise" />
                              {new Date(event.date).toLocaleDateString('fr-FR', {
                                day: 'numeric',
                                month: 'short'
                              })}
                            </span>
                          )}

                          {event.location && (
                            <span className="flex items-center gap-1 truncate max-w-[140px] sm:max-w-[200px]">
                              <MapPin size={12} className="text-gray-400" />
                              {event.location}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Right Tag / Badge */}
                      <div className="flex items-center gap-2 shrink-0">
                        {event.base_price !== undefined && (
                          <span className="text-xs font-mono font-bold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                            {event.base_price} DT
                          </span>
                        )}
                        <ArrowRight size={14} className={`text-gray-400 transition-transform ${isSelected ? 'translate-x-1 text-passi-corail' : ''}`} />
                      </div>
                    </li>
                  );
                })}
              </ul>

              {/* Bottom Footer: Apply query filter to full catalogue */}
              <div 
                onClick={() => {
                  setIsOpen(false);
                  if (onChange) onChange(internalQuery);
                }}
                className="p-3 bg-gray-50 dark:bg-neutral-800/40 text-center text-xs font-bold text-passi-corail hover:underline cursor-pointer border-t border-gray-100 dark:border-neutral-800 flex items-center justify-center gap-1.5"
              >
                <span>Filtrer tous les résultats pour "{internalQuery}"</span>
                <ArrowRight size={14} />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
