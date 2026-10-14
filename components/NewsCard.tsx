"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { NewsItem } from "@/lib/services/api";
import { formatImageUrl } from "@/lib/utils/url";
import { Calendar, Newspaper, Sparkles, UserCheck, X, ArrowRight } from "lucide-react";

interface NewsCardProps {
  news: NewsItem;
  priority?: boolean;
  className?: string;
}

export function NewsCard({ news, priority = false, className = "" }: NewsCardProps) {
  const [imageError, setImageError] = useState(false);
  const [modalImageError, setModalImageError] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Lock body scroll and listen for Escape key when modal is open
  useEffect(() => {
    if (!isModalOpen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsModalOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isModalOpen]);

  const formattedUrl = formatImageUrl(news.image_url);
  const hasValidImage = Boolean(formattedUrl && !imageError && formattedUrl !== "undefined");
  const hasValidModalImage = Boolean(formattedUrl && !modalImageError && formattedUrl !== "undefined");

  // Format date in French: "Publié le 14 Octobre 2026"
  const formattedDate = news.created_at
    ? (() => {
        try {
          const dateObj = new Date(news.created_at);
          const formatted = dateObj.toLocaleDateString("fr-FR", {
            day: "numeric",
            month: "long",
            year: "numeric",
          });
          return `Publié le ${formatted}`;
        } catch {
          return "Publié récemment";
        }
      })()
    : "Publié récemment";

  // Initials for fallback badge
  const initials = news.title
    ? news.title
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((w) => w[0]?.toUpperCase())
        .join("") || "NW"
    : "NW";

  const authorName = news.admin_profile?.full_name || news.admin_profile?.email?.split("@")[0] || "Équipe Passi";

  return (
    <>
      <article
        className={`card overflow-hidden flex flex-col group transition-all duration-300 hover:shadow-xl hover:-translate-y-1 border border-gray-100 dark:border-slate-800 ${className}`}
        style={{ borderRadius: "24px" }}
      >
        {/* Media / Visual Banner */}
        <div
          className="h-52 sm:h-60 w-full relative overflow-hidden select-none bg-slate-900 cursor-pointer"
          onClick={() => setIsModalOpen(true)}
        >
          {hasValidImage ? (
            <Image
              src={formattedUrl}
              alt={news.title}
              fill
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              className="object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
              onError={() => setImageError(true)}
              priority={priority}
            />
          ) : (
            /* Stylized Fallback */
            <div className="w-full h-full relative overflow-hidden bg-gradient-to-br from-passi-bleu via-slate-800 to-passi-corail/30 flex items-center justify-center">
              <div className="absolute inset-0 opacity-15 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white to-transparent pointer-events-none" />
              <div className="relative z-10 flex flex-col items-center text-center p-4">
                <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 shadow-lg flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
                  <span className="text-xl font-black text-white tracking-wider">
                    {initials}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-white/80 uppercase tracking-widest">
                  <Sparkles size={13} className="text-passi-corail" />
                  <span>Actualité Officielle</span>
                </div>
              </div>
            </div>
          )}

          {/* Ambient Gradient Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent pointer-events-none" />

          {/* Badges Overlay */}
          <div className="absolute top-4 left-4 flex items-center gap-2">
            <span className="bg-white/95 dark:bg-slate-900/90 backdrop-blur-md px-3 py-1 rounded-full text-xs font-bold text-passi-corail flex items-center gap-1.5 shadow-md border border-white/20">
              <Newspaper size={13} />
              <span>Passi News</span>
            </span>
          </div>
        </div>

        {/* Content Section */}
        <div className="p-6 sm:p-7 flex-1 flex flex-col justify-between">
          <div className="space-y-3">
            {/* Metadata Row */}
            <div className="flex flex-wrap items-center gap-3 text-xs font-semibold text-gray-500 dark:text-gray-400">
              <span className="flex items-center gap-1.5 text-passi-corail">
                <Calendar size={14} />
                <span>{formattedDate}</span>
              </span>
              <span className="text-gray-300 dark:text-gray-700">•</span>
              <span className="flex items-center gap-1.5">
                <UserCheck size={14} className="text-passi-turquoise" />
                <span>{authorName}</span>
              </span>
            </div>

            {/* Title */}
            <h2
              onClick={() => setIsModalOpen(true)}
              className="text-xl sm:text-2xl font-extrabold leading-snug tracking-tight group-hover:text-passi-corail transition-colors cursor-pointer"
              style={{ color: "var(--text-primary)" }}
            >
              {news.title}
            </h2>

            {/* Content Body Preview (Line clamped) */}
            <div
              className="text-sm sm:text-base leading-relaxed whitespace-pre-line line-clamp-3 sm:line-clamp-4 font-normal"
              style={{ color: "var(--text-secondary)" }}
            >
              {news.content}
            </div>
          </div>

          {/* Lire la suite Button */}
          <div className="pt-3 mt-2 flex items-center justify-between border-t border-gray-100/80 dark:border-slate-800/80">
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 hover:underline text-sm font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <span>Lire la suite</span>
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </article>

      {/* Read More Modal / Dialog Overlay */}
      {isModalOpen && mounted && typeof document !== "undefined" && createPortal(
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setIsModalOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby={`news-modal-title-${news.id}`}
        >
          <div
            className="relative w-full max-w-2xl max-h-[90vh] flex flex-col rounded-3xl shadow-2xl overflow-hidden border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
            style={{ backgroundColor: "var(--bg-card, #0f172a)" }}
          >
            {/* Top Close Button (X icon) */}
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="absolute top-4 right-4 z-30 p-2.5 rounded-full bg-black/60 hover:bg-black/85 text-white/90 hover:text-white backdrop-blur-md transition-all border border-white/10 shadow-lg cursor-pointer"
              aria-label="Fermer"
            >
              <X size={18} />
            </button>

            {/* Scrollable Container */}
            <div className="overflow-y-auto flex-1">
              {/* Modal Visual Banner */}
              {hasValidModalImage ? (
                <div className="relative w-full h-60 sm:h-80 overflow-hidden bg-slate-900 select-none">
                  <Image
                    src={formattedUrl}
                    alt={news.title}
                    fill
                    sizes="(max-width: 768px) 100vw, 800px"
                    className="object-cover"
                    onError={() => setModalImageError(true)}
                    priority
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent pointer-events-none" />
                  <div className="absolute top-4 left-4 flex items-center gap-2">
                    <span className="bg-white/95 dark:bg-slate-900/90 backdrop-blur-md px-3 py-1 rounded-full text-xs font-bold text-passi-corail flex items-center gap-1.5 shadow-md border border-white/20">
                      <Newspaper size={13} />
                      <span>Passi News</span>
                    </span>
                  </div>
                </div>
              ) : (
                <div className="w-full py-10 relative overflow-hidden bg-gradient-to-br from-passi-bleu via-slate-800 to-passi-corail/30 flex items-center justify-center">
                  <div className="absolute top-4 left-4 flex items-center gap-2">
                    <span className="bg-white/95 dark:bg-slate-900/90 backdrop-blur-md px-3 py-1 rounded-full text-xs font-bold text-passi-corail flex items-center gap-1.5 shadow-md border border-white/20">
                      <Newspaper size={13} />
                      <span>Passi News</span>
                    </span>
                  </div>
                  <div className="w-16 h-16 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 shadow-lg flex items-center justify-center">
                    <span className="text-2xl font-black text-white tracking-wider">
                      {initials}
                    </span>
                  </div>
                </div>
              )}

              {/* Modal Article Content */}
              <div className="p-6 sm:p-8 space-y-4">
                {/* Metadata Row */}
                <div className="flex flex-wrap items-center gap-3 text-xs sm:text-sm font-semibold text-gray-500 dark:text-gray-400">
                  <span className="flex items-center gap-1.5 text-passi-corail">
                    <Calendar size={15} />
                    <span>{formattedDate}</span>
                  </span>
                  <span className="text-gray-300 dark:text-gray-700">•</span>
                  <span className="flex items-center gap-1.5">
                    <UserCheck size={15} className="text-passi-turquoise" />
                    <span>{authorName}</span>
                  </span>
                </div>

                {/* Title */}
                <h2
                  id={`news-modal-title-${news.id}`}
                  className="text-2xl sm:text-3xl font-extrabold leading-snug tracking-tight"
                  style={{ color: "var(--text-primary)" }}
                >
                  {news.title}
                </h2>

                {/* Complete Un-truncated Content */}
                <div
                  className="text-sm sm:text-base leading-relaxed whitespace-pre-wrap font-normal pt-2"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {news.content}
                </div>
              </div>
            </div>

            {/* Modal Footer with Close Button */}
            <div className="p-4 sm:px-8 border-t border-gray-100 dark:border-slate-800/80 bg-gray-50/80 dark:bg-slate-900/80 backdrop-blur-sm flex justify-end">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-5 py-2.5 rounded-xl font-bold text-sm bg-gray-200 hover:bg-gray-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-gray-800 dark:text-gray-200 transition-colors cursor-pointer"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
