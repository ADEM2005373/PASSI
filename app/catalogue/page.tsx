"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { 
  Calendar, 
  MapPin, 
  Ticket, 
  ArrowRight, 
  Search, 
  Heart, 
  Sparkles, 
  Sun, 
  Moon, 
  ArrowLeft,
  Shirt,
  Info,
  SlidersHorizontal,
  X
} from "lucide-react";
import { api, Event } from "@/lib/services/api";
import { Logo } from "@/components/Logo";
import { SearchBarWithSuggestions } from "@/components/SearchBarWithSuggestions";
import { searchEventsFaultTolerant } from "@/lib/utils/search";
import { EventCard } from "@/components/EventCard";

const CATEGORIES = [
  "Tous",
  "Concerts",
  "Soirées",
  "Spectacles",
  "Théâtre",
  "Expériences"
];

export default function CataloguePage() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters state
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Tous");
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedLocation, setSelectedLocation] = useState("");

  // Hydration safety & URL query param parsing
  useEffect(() => {
    setMounted(true);
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const q = params.get("q");
      if (q) setSearchQuery(q);
      const cat = params.get("cat");
      if (cat && CATEGORIES.includes(cat)) setSelectedCategory(cat);
      const loc = params.get("loc");
      if (loc) setSelectedLocation(loc);
      const date = params.get("date");
      if (date) setSelectedDate(date);
    }
  }, []);

  // Fetch events from Supabase
  useEffect(() => {
    async function loadEvents() {
      setLoading(true);
      try {
        const data = await api.getEvents();
        setEvents(data || []);
      } catch (err) {
        console.error("Erreur lors du chargement des événements:", err);
      } finally {
        setLoading(false);
      }
    }
    loadEvents();
  }, []);

  // Fault-tolerant filtered events list
  const filteredEvents = useMemo(() => {
    // 1. Fuzzy, typo & space-omission tolerance search
    let results: Event[] = events;
    if (searchQuery.trim().length > 0) {
      results = searchEventsFaultTolerant(events, searchQuery, {
        threshold: 0.35,
        includeLocationAndDesc: true,
      }).map(item => item.event);
    }

    // 2. Secondary filters (Category, Date, Location)
    return results.filter(event => {
      // Category filter
      const matchCat = 
        selectedCategory === "Tous" ||
        (event.title && event.title.toLowerCase().includes(selectedCategory.toLowerCase())) ||
        (event.description && event.description.toLowerCase().includes(selectedCategory.toLowerCase()));

      // Location filter
      const matchLoc = 
        !selectedLocation.trim() || 
        (event.location && event.location.toLowerCase().includes(selectedLocation.toLowerCase().trim()));

      // Date filter
      const matchDate = 
        !selectedDate.trim() || 
        (event.date && event.date.includes(selectedDate));

      return matchCat && matchLoc && matchDate;
    });
  }, [events, searchQuery, selectedCategory, selectedLocation, selectedDate]);

  const clearAllFilters = () => {
    setSearchQuery("");
    setSelectedCategory("Tous");
    setSelectedDate("");
    setSelectedLocation("");
  };

  const hasActiveFilters = 
    searchQuery.trim().length > 0 || 
    selectedCategory !== "Tous" || 
    selectedDate !== "" || 
    selectedLocation !== "";

  return (
    <div className="min-h-screen bg-passi-creme dark:bg-passi-bleu text-passi-bleu dark:text-neutral-100 transition-colors duration-300 flex flex-col font-sans">
      {/* Navigation Header */}
      <header className="sticky top-0 z-40 bg-passi-creme/90 dark:bg-passi-bleu/90 backdrop-blur-md border-b border-gray-200 dark:border-slate-800 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-20 flex items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <Link href="/" className="hover:opacity-85 transition-opacity shrink-0">
              <Logo className="w-[110px] h-[34px] sm:w-[130px] sm:h-[40px]" />
            </Link>
            <nav className="hidden md:flex items-center gap-6 text-sm font-bold">
              <Link href="/" className="hover:text-passi-corail transition-colors text-gray-600 dark:text-gray-300">
                Accueil
              </Link>
              <Link href="/catalogue" className="text-passi-corail">
                Catalogue
              </Link>
              <Link href="/dashboard" className="hover:text-passi-corail transition-colors text-gray-600 dark:text-gray-300">
                Mon Espace
              </Link>
            </nav>
          </div>

          <div className="flex items-center gap-3">
            {mounted && (
              <button
                onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
                className="p-2.5 rounded-full bg-white dark:bg-slate-800 text-passi-bleu dark:text-white shadow-sm border border-gray-200 dark:border-slate-700 hover:scale-110 transition-transform"
                aria-label="Basculer le mode sombre"
              >
                {resolvedTheme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
              </button>
            )}

            <Link
              href="/login"
              className="bg-passi-corail text-white px-5 py-2.5 rounded-full text-sm font-bold hover:bg-passi-corail/90 shadow-md shadow-passi-corail/30 transition-all hover:scale-105 shrink-0"
            >
              Connexion
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-12">
        {/* Page Hero & Header */}
        <div className="mb-10 text-center sm:text-left">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-passi-corail/10 text-passi-corail text-xs font-bold uppercase tracking-wider mb-3">
            <Sparkles size={14} />
            Catalogue officiel Passi
          </div>
          <h1 className="text-3xl sm:text-5xl font-extrabold text-passi-bleu dark:text-white tracking-tight">
            Explorez tous les <span className="text-passi-corail">événements.</span>
          </h1>
          <p className="mt-3 text-sm sm:text-base text-gray-600 dark:text-gray-300 max-w-2xl font-medium">
            Découvrez nos concerts, soirées, spectacles et expériences immersives. Utilisez la recherche tolérante pour trouver instantanément votre billet.
          </p>
        </div>

        {/* Search Bar with Fault-Tolerance and Live Suggestions */}
        <div className="mb-8 max-w-4xl">
          <SearchBarWithSuggestions
            events={events}
            value={searchQuery}
            onChange={setSearchQuery}
            showFilters={true}
            selectedDate={selectedDate}
            onDateChange={setSelectedDate}
            selectedLocation={selectedLocation}
            onLocationChange={setSelectedLocation}
            placeholder="Rechercher par titre, soirée, artiste ou lieu..."
            autoRedirectOnSelect={true}
          />
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-4 mb-6 hide-scrollbar">
          {CATEGORIES.map(category => {
            const isSelected = selectedCategory === category;
            return (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`px-5 py-2.5 rounded-full text-xs sm:text-sm font-bold whitespace-nowrap transition-all duration-200 shadow-sm ${
                  isSelected
                    ? "bg-passi-bleu dark:bg-white text-white dark:text-passi-bleu shadow-passi-bleu/20 scale-105"
                    : "bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 border border-gray-200 dark:border-slate-700"
                }`}
              >
                {category}
              </button>
            );
          })}

          {hasActiveFilters && (
            <button
              onClick={clearAllFilters}
              className="px-4 py-2 rounded-full text-xs font-bold text-passi-corail hover:bg-passi-corail/10 transition-colors flex items-center gap-1.5 ml-auto shrink-0"
            >
              <X size={14} />
              Réinitialiser les filtres
            </button>
          )}
        </div>

        {/* Results Header */}
        <div className="flex items-center justify-between mb-8 pb-3 border-b border-gray-200 dark:border-slate-800">
          <div className="text-sm font-bold text-gray-500 dark:text-gray-400">
            {loading ? (
              <span>Chargement des événements...</span>
            ) : (
              <span>
                <strong className="text-passi-bleu dark:text-white font-extrabold">{filteredEvents.length}</strong> événement{filteredEvents.length > 1 ? "s" : ""} disponible{filteredEvents.length > 1 ? "s" : ""}
                {searchQuery && (
                  <span> pour "<span className="text-passi-corail">{searchQuery}</span>"</span>
                )}
              </span>
            )}
          </div>
        </div>

        {/* Events Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="h-96 rounded-3xl bg-white dark:bg-slate-800 animate-pulse border border-gray-200 dark:border-slate-700" />
            ))}
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="bg-white dark:bg-passi-surface rounded-3xl p-12 text-center border border-gray-200 dark:border-slate-800 max-w-xl mx-auto shadow-sm my-8">
            <div className="w-16 h-16 rounded-full bg-passi-corail/10 text-passi-corail flex items-center justify-center mx-auto mb-4">
              <Search size={32} />
            </div>
            <h3 className="text-xl font-bold text-passi-bleu dark:text-white mb-2">
              Aucun événement trouvé
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
              Aucun résultat ne correspond à votre recherche {searchQuery ? `"${searchQuery}"` : ""}. Essayez de modifier vos critères ou vérifiez les filtres de date et de lieu.
            </p>
            {hasActiveFilters && (
              <button
                onClick={clearAllFilters}
                className="bg-passi-corail text-white px-6 py-2.5 rounded-full text-sm font-bold hover:scale-105 transition-transform shadow-md shadow-passi-corail/30"
              >
                Afficher tous les événements
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredEvents.map((event, index) => (
              <EventCard key={event.id} event={event} index={index} />
            ))}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="mt-20 bg-white dark:bg-passi-surface py-8 border-t border-gray-200 dark:border-slate-800 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs font-medium text-gray-500 dark:text-gray-400">
          <Logo className="w-[100px] h-[30px]" />
          <p>© {new Date().getFullYear()} Passi. Billetterie intelligente et sans friction.</p>
        </div>
      </footer>
    </div>
  );
}
