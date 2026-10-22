"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { formatImageUrl } from "@/lib/utils/url";
import {
  Calendar,
  Sparkles,
  Ticket,
  Newspaper,
  Clock,
  X,
  Share2,
  CheckCircle2,
} from "lucide-react";

export interface LandingEvent {
  id: string;
  title: string;
  date: string;
  location: string;
  base_price?: number;
  description?: string;
  image_url?: string;
  dress_code?: string;
  pre_orders_enabled?: boolean;
}

export interface LandingNews {
  id: string;
  title: string;
  content: string;
  image_url?: string;
  created_at?: string;
  admin_profile?: {
    full_name?: string;
    email?: string;
  } | null;
}

interface RawNewsRow {
  id: string;
  title: string;
  content: string;
  image_url?: string;
  created_at?: string;
  profiles?: {
    full_name?: string;
    email?: string;
  } | null;
}

export function LandingActualites() {
  const [events, setEvents] = useState<LandingEvent[]>([]);
  const [news, setNews] = useState<LandingNews[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [activeTab, setActiveTab] = useState<"events" | "news">("events");
  const [selectedNews, setSelectedNews] = useState<LandingNews | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      const supabase = createClient();

      // Check current session state to drive seamless CTA navigation
      try {
        const { data: { user } } = await supabase.auth.getUser();
        setIsAuthenticated(Boolean(user));
      } catch {
        setIsAuthenticated(false);
      }

      // 1. Fetch upcoming events with fallback to latest events
      try {
        const nowIso = new Date().toISOString();
        const { data: upcomingEvents, error: eventsError } = await supabase
          .from("events")
          .select("id, title, date, location, base_price, description, image_url, dress_code, pre_orders_enabled")
          .gte("date", nowIso)
          .order("date", { ascending: true })
          .limit(6);

        if (!eventsError && upcomingEvents && upcomingEvents.length > 0) {
          setEvents(upcomingEvents as LandingEvent[]);
        } else {
          // Fallback: If no upcoming events in the future, fetch most recent events
          const { data: latestEvents } = await supabase
            .from("events")
            .select("id, title, date, location, base_price, description, image_url, dress_code, pre_orders_enabled")
            .order("date", { ascending: false })
            .limit(6);
          setEvents((latestEvents as LandingEvent[]) || []);
        }
      } catch (err) {
        console.error("[LandingActualites] Error fetching events:", err);
      }

      // 2. Fetch latest news announcements
      try {
        const { data: newsData, error: newsError } = await supabase
          .from("news")
          .select("id, title, content, image_url, created_at, profiles(full_name, email)")
          .order("created_at", { ascending: false })
          .limit(6);

        if (!newsError && newsData) {
          const formattedNews: LandingNews[] = (newsData as unknown as RawNewsRow[]).map((item) => ({
            id: item.id,
            title: item.title,
            content: item.content,
            image_url: item.image_url,
            created_at: item.created_at,
            admin_profile: item.profiles || null,
          }));
          setNews(formattedNews);
        } else {
          // Fallback without relation join if relation is unavailable
          const { data: fallbackNews } = await supabase
            .from("news")
            .select("id, title, content, image_url, created_at")
            .order("created_at", { ascending: false })
            .limit(6);
          setNews((fallbackNews as LandingNews[]) || []);
        }
      } catch (err) {
        console.error("[LandingActualites] Error fetching news:", err);
      }

      setLoading(false);
    }

    loadData();
  }, []);

  const handleShare = (eventId?: string) => {
    if (typeof window !== "undefined") {
      const url = eventId ? `${window.location.origin}/events/${eventId}` : window.location.href;
      if (navigator.clipboard) {
        navigator.clipboard.writeText(url);
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2500);
      }
    }
  };

  return (
    <section id="actualites" className="pt-28 md:pt-36 pb-16 px-6 max-w-7xl mx-auto relative scroll-mt-24">
      {/* Decorative ambient background glows */}
      <div className="absolute top-1/2 left-1/4 -translate-y-1/2 w-96 h-96 bg-purple-600/10 dark:bg-purple-600/15 rounded-full blur-3xl -z-10 pointer-events-none" />
      <div className="absolute bottom-10 right-1/4 w-80 h-80 bg-passi-corail/10 dark:bg-passi-corail/15 rounded-full blur-3xl -z-10 pointer-events-none" />

      {/* Section Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold bg-purple-500/10 text-purple-400 border border-purple-500/20 backdrop-blur-sm">
            <Sparkles size={14} className="text-purple-400" />
            <span>Actualité &amp; Événements</span>
          </div>
          <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight text-passi-bleu dark:text-white">
            Vivez l&apos;expérience <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-500 via-pink-500 to-passi-corail">Passi</span>.
          </h2>
          <p className="text-base md:text-lg text-passi-text-sec max-w-2xl font-medium">
            Explorez les programmations à venir, réservez vos pass sécurisés en quelques clics et découvrez les dernières annonces de la communauté.
          </p>
        </div>

        {/* View Switcher Tabs (Events vs News) */}
        <div className="flex items-center p-1.5 bg-gray-200/80 dark:bg-slate-900 border border-gray-300/80 dark:border-slate-800 rounded-2xl self-start md:self-auto shadow-inner">
          <button
            type="button"
            onClick={() => setActiveTab("events")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs md:text-sm font-bold transition-all duration-200 cursor-pointer ${
              activeTab === "events"
                ? "bg-white dark:bg-slate-800 text-passi-bleu dark:text-white shadow-md"
                : "text-gray-600 dark:text-slate-400 hover:text-passi-bleu dark:hover:text-white"
            }`}
          >
            <Ticket size={16} className={activeTab === "events" ? "text-passi-corail" : ""} />
            <span>Événements à venir</span>
            {events.length > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-passi-corail/20 text-passi-corail font-extrabold">
                {events.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("news")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs md:text-sm font-bold transition-all duration-200 cursor-pointer ${
              activeTab === "news"
                ? "bg-white dark:bg-slate-800 text-passi-bleu dark:text-white shadow-md"
                : "text-gray-600 dark:text-slate-400 hover:text-passi-bleu dark:hover:text-white"
            }`}
          >
            <Newspaper size={16} className={activeTab === "news" ? "text-purple-400" : ""} />
            <span>Actualités &amp; Annonces</span>
            {news.length > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-500/20 text-purple-400 font-extrabold">
                {news.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Copied Link Toast */}
      {copiedLink && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-passi-turquoise text-passi-bleu font-bold text-xs shadow-2xl animate-in fade-in slide-in-from-bottom-2 duration-200">
          <CheckCircle2 size={16} />
          <span>Lien copié dans le presse-papiers !</span>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className="bg-slate-900/50 border border-slate-800 rounded-3xl p-6 h-96 animate-pulse flex flex-col justify-between"
            >
              <div className="space-y-4">
                <div className="h-4 bg-slate-800 rounded w-1/3" />
                <div className="h-6 bg-slate-800 rounded w-3/4" />
                <div className="h-4 bg-slate-800 rounded w-full" />
                <div className="h-4 bg-slate-800 rounded w-2/3" />
              </div>
              <div className="h-10 bg-slate-800 rounded-xl" />
            </div>
          ))}
        </div>
      ) : activeTab === "events" ? (
        /* ── EVENTS GRID ── */
        events.length === 0 ? (
          <div className="bg-white/80 dark:bg-slate-900/60 backdrop-blur-md border border-dashed border-gray-300 dark:border-slate-800 rounded-3xl p-12 text-center max-w-xl mx-auto space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-purple-500/10 text-purple-400 flex items-center justify-center mx-auto">
              <Calendar size={32} />
            </div>
            <h3 className="text-xl font-bold text-passi-bleu dark:text-white">
              Aucun événement programmé pour le moment
            </h3>
            <p className="text-sm text-passi-text-sec">
              De nouvelles soirées et événements exclusifs seront bientôt ajoutés. Restez connectés !
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {events.map((event) => {
              const formattedImageUrl = formatImageUrl(event.image_url);
              const hasValidImage = Boolean(formattedImageUrl && formattedImageUrl !== "undefined");
              const formattedDate = event.date
                ? (() => {
                    try {
                      return new Date(event.date).toLocaleDateString("fr-FR", {
                        weekday: "short",
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      });
                    } catch {
                      return new Date(event.date).toLocaleDateString();
                    }
                  })()
                : "Date à confirmer";

              // Destination URL: Direct reservation if authenticated, else login with preserved return redirect
              const destinationHref = isAuthenticated
                ? `/events/${event.id}`
                : `/login?redirect=/events/${event.id}/reserve`;

              return (
                <div
                  key={event.id}
                  className="bg-slate-900 border border-slate-800 hover:border-slate-700/80 rounded-2xl p-6 flex flex-col justify-between transition-all duration-300 hover:shadow-2xl hover:shadow-purple-900/10 hover:-translate-y-1 group"
                >
                  <div>
                    {/* Media preview (if event has image) */}
                    {hasValidImage ? (
                      <div className="relative w-full h-44 rounded-xl overflow-hidden mb-4 bg-slate-950 border border-slate-800">
                        <Image
                          src={formattedImageUrl}
                          alt={event.title || "Image de l'événement"}
                          fill
                          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                          className="object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent opacity-80" />
                        <span className="absolute top-3 left-3 text-xs bg-purple-500/20 text-purple-300 border border-purple-500/30 px-2.5 py-1 rounded-full font-medium backdrop-blur-md">
                          Événement à venir
                        </span>
                        {event.base_price !== undefined && (
                          <span className="absolute top-3 right-3 text-xs bg-slate-900/90 text-white border border-white/10 px-2.5 py-1 rounded-full font-bold backdrop-blur-md">
                            {event.base_price > 0 ? `${event.base_price} TND` : "Gratuit"}
                          </span>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs bg-purple-500/10 text-purple-400 px-2.5 py-1 rounded-full font-medium border border-purple-500/20">
                          Événement à venir
                        </span>
                        {event.base_price !== undefined && (
                          <span className="text-xs font-bold text-passi-corail">
                            {event.base_price > 0 ? `${event.base_price} TND` : "Gratuit"}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Title */}
                    <h3 className="text-xl font-bold text-white mt-1 group-hover:text-purple-300 transition-colors line-clamp-2">
                      {event.title}
                    </h3>

                    {/* Description preview */}
                    <p className="text-slate-400 text-sm mt-2 line-clamp-3 leading-relaxed">
                      {event.description || "Aucune description fournie pour cet événement."}
                    </p>

                    {/* Read-only metadata */}
                    <div className="mt-4 space-y-1.5 text-xs text-slate-400 bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
                      <p className="flex items-center gap-2">
                        <span className="text-base shrink-0">📅</span>
                        <span>Date : <strong className="text-slate-200 capitalize">{formattedDate}</strong></span>
                      </p>
                      <p className="flex items-center gap-2">
                        <span className="text-base shrink-0">📍</span>
                        <span className="truncate">Lieu : <strong className="text-slate-200">{event.location || "Lieu à confirmer"}</strong></span>
                      </p>
                      <p className="flex items-center gap-2">
                        <span className="text-base shrink-0">💰</span>
                        <span>Tarif : <strong className="text-slate-200">{event.base_price !== undefined && event.base_price > 0 ? `${event.base_price} TND` : "Entrée Libre"}</strong></span>
                      </p>
                      {event.dress_code && (
                        <p className="flex items-center gap-2">
                          <span className="text-base shrink-0">👔</span>
                          <span className="truncate">Dress code : <strong className="text-slate-200">{event.dress_code}</strong></span>
                        </p>
                      )}
                    </div>
                  </div>

                  {/* CTA Conversion Button */}
                  <div className="mt-6 pt-4 border-t border-slate-800">
                    <a
                      href={destinationHref}
                      className="w-full block text-center bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-semibold py-2.5 rounded-xl transition shadow-lg shadow-purple-900/20 hover:shadow-purple-600/30 text-sm"
                    >
                      Réserver ma place 🎟️
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : (
        /* ── NEWS / ANNOUNCEMENTS GRID ── */
        news.length === 0 ? (
          <div className="bg-white/80 dark:bg-slate-900/60 backdrop-blur-md border border-dashed border-gray-300 dark:border-slate-800 rounded-3xl p-12 text-center max-w-xl mx-auto space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-purple-500/10 text-purple-400 flex items-center justify-center mx-auto">
              <Newspaper size={32} />
            </div>
            <h3 className="text-xl font-bold text-passi-bleu dark:text-white">
              Aucune actualité publiée pour le moment
            </h3>
            <p className="text-sm text-passi-text-sec">
              Les organisateurs n&apos;ont pas encore publié d&apos;annonces. Revenez très bientôt !
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {news.map((item) => {
              const formattedImageUrl = formatImageUrl(item.image_url);
              const hasValidImage = Boolean(formattedImageUrl && formattedImageUrl !== "undefined");
              const formattedDate = item.created_at
                ? (() => {
                    try {
                      return new Date(item.created_at).toLocaleDateString("fr-FR", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      });
                    } catch {
                      return "Récemment";
                    }
                  })()
                : "Récemment";

              const author = item.admin_profile?.full_name || item.admin_profile?.email?.split("@")[0] || "Équipe Passi";

              return (
                <div
                  key={item.id}
                  className="bg-slate-900 border border-slate-800 hover:border-slate-700/80 rounded-2xl p-6 flex flex-col justify-between transition-all duration-300 hover:shadow-2xl hover:shadow-purple-900/10 hover:-translate-y-1 group"
                >
                  <div>
                    {hasValidImage ? (
                      <div
                        className="relative w-full h-44 rounded-xl overflow-hidden mb-4 bg-slate-950 border border-slate-800 cursor-pointer"
                        onClick={() => setSelectedNews(item)}
                      >
                        <Image
                          src={formattedImageUrl}
                          alt={item.title}
                          fill
                          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                          className="object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent opacity-80" />
                        <span className="absolute top-3 left-3 text-xs bg-purple-500/20 text-purple-300 border border-purple-500/30 px-2.5 py-1 rounded-full font-medium backdrop-blur-md">
                          Annonce officielle
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs bg-purple-500/10 text-purple-400 px-2.5 py-1 rounded-full font-medium border border-purple-500/20">
                          Annonce officielle
                        </span>
                      </div>
                    )}

                    <h3
                      onClick={() => setSelectedNews(item)}
                      className="text-xl font-bold text-white mt-1 group-hover:text-purple-300 transition-colors line-clamp-2 cursor-pointer"
                    >
                      {item.title}
                    </h3>

                    <p className="text-slate-400 text-sm mt-2 line-clamp-3 leading-relaxed whitespace-pre-line">
                      {item.content}
                    </p>

                    <div className="mt-4 flex items-center justify-between text-xs text-slate-400 pt-3 border-t border-slate-800/80">
                      <span className="flex items-center gap-1.5">
                        <Clock size={13} className="text-slate-500" />
                        <span>{formattedDate}</span>
                      </span>
                      <span className="text-purple-400 font-medium">Par {author}</span>
                    </div>
                  </div>

                  <div className="mt-6 pt-4 border-t border-slate-800 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedNews(item)}
                      className="flex-1 text-center bg-slate-800 hover:bg-slate-700 text-white font-semibold py-2.5 rounded-xl transition text-sm cursor-pointer"
                    >
                      Lire l&apos;annonce 📖
                    </button>
                    <button
                      type="button"
                      aria-label="Partager l'actualité"
                      onClick={() => handleShare()}
                      className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
                      title="Copier le lien"
                    >
                      <Share2 size={16} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {/* ── MODAL: News Details (Read-Only) ── */}
      {selectedNews && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setSelectedNews(null)}
        >
          <div
            className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl p-6 sm:p-8 space-y-6 relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setSelectedNews(null)}
              aria-label="Fermer"
              className="absolute top-5 right-5 p-2 rounded-full bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition cursor-pointer"
            >
              <X size={18} />
            </button>

            {selectedNews.image_url && (
              <div className="relative w-full h-64 rounded-2xl overflow-hidden bg-slate-950 border border-slate-800">
                <Image
                  src={formatImageUrl(selectedNews.image_url)}
                  alt={selectedNews.title}
                  fill
                  className="object-cover"
                />
              </div>
            )}

            <div className="space-y-3">
              <span className="text-xs bg-purple-500/20 text-purple-300 border border-purple-500/30 px-3 py-1 rounded-full font-medium inline-block">
                Annonce officielle
              </span>
              <h3 className="text-2xl sm:text-3xl font-extrabold text-white">
                {selectedNews.title}
              </h3>
              <p className="text-xs text-slate-400">
                Publié le{" "}
                {selectedNews.created_at
                  ? new Date(selectedNews.created_at).toLocaleDateString("fr-FR", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })
                  : "récemment"}{" "}
                • {selectedNews.admin_profile?.full_name || "Équipe Passi"}
              </p>
            </div>

            <div className="prose prose-invert max-w-none text-slate-300 text-sm sm:text-base leading-relaxed whitespace-pre-line border-t border-slate-800 pt-4">
              {selectedNews.content}
            </div>

            <div className="pt-4 border-t border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedNews(null)}
                className="px-6 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-sm transition cursor-pointer"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export default LandingActualites;
