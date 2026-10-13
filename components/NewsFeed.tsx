"use client";

import { useEffect, useState } from "react";
import { NewsCard } from "./NewsCard";
import { api, NewsItem } from "@/lib/services/api";
import { Newspaper, RefreshCw, Sparkles } from "lucide-react";

interface NewsFeedProps {
  initialNews?: NewsItem[];
  className?: string;
  showHeader?: boolean;
}

export function NewsFeed({ initialNews, className = "", showHeader = true }: NewsFeedProps) {
  const [news, setNews] = useState<NewsItem[]>(initialNews || []);
  const [loading, setLoading] = useState<boolean>(!initialNews);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  const fetchNews = async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    try {
      const items = await api.getNews();
      setNews(items);
    } catch (err) {
      console.error("[NewsFeed] Error fetching news:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (!initialNews || initialNews.length === 0) {
      fetchNews();
    }
  }, []);

  return (
    <section className={`w-full max-w-5xl mx-auto space-y-8 ${className}`}>
      {showHeader && (
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-gray-100 dark:border-slate-800/80 pb-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-passi-corail/10 text-passi-corail mb-3">
              <Sparkles size={14} />
              <span>Restez Informés</span>
            </div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight" style={{ color: "var(--text-primary)" }}>
              Actualités & <span className="text-passi-corail">Annonces</span>
            </h1>
            <p className="text-sm sm:text-base mt-2" style={{ color: "var(--text-secondary)" }}>
              Découvrez les dernières nouveautés, programmations d'événements et annonces de Passi.
            </p>
          </div>

          <button
            onClick={() => fetchNews(true)}
            disabled={refreshing || loading}
            className="self-start sm:self-auto flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold bg-white dark:bg-passi-surface hover:bg-gray-50 dark:hover:bg-slate-800 border border-gray-200 dark:border-slate-700 shadow-sm transition-all duration-200 cursor-pointer disabled:opacity-50"
            style={{ color: "var(--text-primary)" }}
            title="Rafraîchir les actualités"
          >
            <RefreshCw size={15} className={refreshing ? "animate-spin text-passi-corail" : ""} />
            <span>{refreshing ? "Actualisation..." : "Rafraîchir"}</span>
          </button>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
          {[1, 2, 3, 4].map((n) => (
            <div
              key={n}
              className="card p-0 overflow-hidden animate-pulse border border-gray-100 dark:border-slate-800"
              style={{ borderRadius: "24px" }}
            >
              <div className="h-56 bg-gray-200 dark:bg-slate-800" />
              <div className="p-6 space-y-4">
                <div className="h-4 bg-gray-200 dark:bg-slate-800 rounded w-1/3" />
                <div className="h-6 bg-gray-200 dark:bg-slate-800 rounded w-4/5" />
                <div className="h-4 bg-gray-200 dark:bg-slate-800 rounded w-full" />
                <div className="h-4 bg-gray-200 dark:bg-slate-800 rounded w-2/3" />
              </div>
            </div>
          ))}
        </div>
      ) : news.length === 0 ? (
        /* Empty State */
        <div
          className="card p-12 text-center flex flex-col items-center justify-center space-y-4 border border-dashed border-gray-200 dark:border-slate-800"
          style={{ borderRadius: "24px" }}
        >
          <div className="w-16 h-16 rounded-3xl bg-passi-corail/10 text-passi-corail flex items-center justify-center">
            <Newspaper size={32} />
          </div>
          <h3 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>
            Aucune actualité pour le moment
          </h3>
          <p className="text-sm max-w-md" style={{ color: "var(--text-secondary)" }}>
            Les organisateurs et administrateurs n'ont pas encore publié d'annonces. Revenez très bientôt pour découvrir les prochaines mises à jour !
          </p>
        </div>
      ) : (
        /* News Cards Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
          {news.map((item, idx) => (
            <NewsCard key={item.id} news={item} priority={idx < 2} />
          ))}
        </div>
      )}
    </section>
  );
}
