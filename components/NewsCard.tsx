"use client";

import { useState } from "react";
import Image from "next/image";
import { NewsItem } from "@/lib/services/api";
import { formatImageUrl } from "@/lib/utils/url";
import { Calendar, Newspaper, Sparkles, UserCheck } from "lucide-react";

interface NewsCardProps {
  news: NewsItem;
  priority?: boolean;
  className?: string;
}

export function NewsCard({ news, priority = false, className = "" }: NewsCardProps) {
  const [imageError, setImageError] = useState(false);

  const formattedUrl = formatImageUrl(news.image_url);
  const hasValidImage = Boolean(formattedUrl && !imageError && formattedUrl !== "undefined");

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
    <article
      className={`card overflow-hidden flex flex-col group transition-all duration-300 hover:shadow-xl hover:-translate-y-1 border border-gray-100 dark:border-slate-800 ${className}`}
      style={{ borderRadius: "24px" }}
    >
      {/* Media / Visual Banner */}
      <div className="h-52 sm:h-60 w-full relative overflow-hidden select-none bg-slate-900">
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
            className="text-xl sm:text-2xl font-extrabold leading-snug tracking-tight group-hover:text-passi-corail transition-colors"
            style={{ color: "var(--text-primary)" }}
          >
            {news.title}
          </h2>

          {/* Content Body */}
          <div
            className="text-sm sm:text-base leading-relaxed whitespace-pre-line line-clamp-4 font-normal"
            style={{ color: "var(--text-secondary)" }}
          >
            {news.content}
          </div>
        </div>
      </div>
    </article>
  );
}
