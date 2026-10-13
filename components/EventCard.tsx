"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Event } from "@/lib/services/api";
import { formatImageUrl } from "@/lib/utils/url";
import { Calendar, MapPin, Shirt, Heart, ArrowRight, Ticket, Sparkles } from "lucide-react";

interface EventCardProps {
  event: Event;
  index?: number;
  className?: string;
  href?: string;
  onFavoriteToggle?: (eventId: string) => void;
  isFavorite?: boolean;
}

/**
 * EventCard Component
 * Displays event details with resilient image loading via next/image.
 * Automatically sanitizes GitHub blob URLs to raw user content URLs and
 * renders a stylized placeholder fallback when the image fails to load.
 */
export function EventCard({
  event,
  index = 0,
  className = "",
  href,
  onFavoriteToggle,
  isFavorite = false,
}: EventCardProps) {
  const [imageError, setImageError] = useState(false);

  const formattedImageUrl = formatImageUrl(event.image_url);
  const hasValidImage = Boolean(formattedImageUrl && !imageError && formattedImageUrl !== "undefined");

  // Generate stylized event initials for fallback badge
  const initials = event.title
    ? event.title
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((w) => w[0]?.toUpperCase())
        .join("") || "EV"
    : "EV";

  const formattedDate = event.date
    ? new Date(event.date).toLocaleDateString("fr-FR", {
        weekday: "long",
        day: "numeric",
        month: "long",
      })
    : "Date à confirmer";

  const destinationHref = href || `/events/${event.id}`;

  return (
    <div
      className={`bg-white dark:bg-passi-surface rounded-[2rem] overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 border border-gray-200 dark:border-slate-800 group flex flex-col hover:-translate-y-1 ${className}`}
    >
      {/* Card Header & Media Container */}
      <div className="h-56 bg-gray-100 dark:bg-slate-800 relative overflow-hidden select-none">
        {hasValidImage ? (
          <Image
            src={formattedImageUrl}
            alt={event.title || "Image de l'événement"}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            className="object-cover group-hover:scale-110 transition-transform duration-700"
            onError={() => setImageError(true)}
            priority={index < 3}
          />
        ) : (
          /* Stylized Fallback when image is missing or fails to load */
          <div className="w-full h-full relative overflow-hidden bg-gradient-to-br from-passi-bleu via-slate-800 to-passi-corail/30 flex items-center justify-center">
            {/* Background pattern */}
            <div className="absolute inset-0 opacity-15 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white to-transparent" />
            
            {/* Ambient animated badge */}
            <div className="relative z-10 flex flex-col items-center text-center p-4">
              <div className="w-16 h-16 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 shadow-lg flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
                <span className="text-2xl font-black text-white tracking-wider">
                  {initials}
                </span>
              </div>
              <div className="flex items-center gap-1 text-[11px] font-semibold text-white/80 uppercase tracking-widest">
                <Sparkles size={12} className="text-passi-turquoise" />
                <span>Passi Expérience</span>
              </div>
            </div>
          </div>
        )}

        {/* Gradient Overlay for Legibility */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent pointer-events-none" />

        {/* Price Badge */}
        {event.base_price !== undefined && (
          <div className="absolute top-4 left-4 bg-white/95 dark:bg-slate-900/90 backdrop-blur-md px-3.5 py-1 rounded-full text-xs font-black text-passi-bleu dark:text-white shadow-md border border-white/20">
            {event.base_price > 0 ? `${event.base_price} DT` : "Entrée Libre"}
          </div>
        )}

        {/* Favorite Button */}
        <button
          type="button"
          aria-label="Ajouter aux favoris"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onFavoriteToggle?.(event.id);
          }}
          className={`absolute top-4 right-4 backdrop-blur-md p-2 rounded-full transition-colors ${
            isFavorite
              ? "bg-passi-corail text-white shadow-md shadow-passi-corail/30"
              : "bg-white/20 text-white hover:bg-passi-corail"
          }`}
        >
          <Heart size={18} className={isFavorite ? "fill-current" : ""} />
        </button>

        {/* Category Tag */}
        <div className="absolute bottom-4 left-4 text-white">
          <span className="bg-passi-corail px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider shadow-sm flex items-center gap-1.5">
            <Ticket size={12} />
            <span>Événement</span>
          </span>
        </div>
      </div>

      {/* Card Body */}
      <div className="p-6 flex-1 flex flex-col justify-between">
        <div>
          <h3 className="font-extrabold text-xl text-passi-bleu dark:text-white mb-4 leading-snug line-clamp-2">
            {event.title}
          </h3>

          <div className="space-y-2.5 mb-6">
            {/* Date */}
            <div className="flex items-center text-xs font-medium text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-slate-800/80 p-2.5 rounded-xl border border-gray-100 dark:border-slate-800">
              <div className="bg-white dark:bg-slate-700 p-1.5 rounded-lg mr-2.5 shadow-xs shrink-0">
                <Calendar size={14} className="text-passi-turquoise" />
              </div>
              <span className="capitalize">{formattedDate}</span>
            </div>

            {/* Location */}
            {event.location && (
              <div className="flex items-center text-xs font-medium text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-slate-800/80 p-2.5 rounded-xl border border-gray-100 dark:border-slate-800">
                <div className="bg-white dark:bg-slate-700 p-1.5 rounded-lg mr-2.5 shadow-xs shrink-0">
                  <MapPin size={14} className="text-passi-corail" />
                </div>
                <span className="truncate">{event.location}</span>
              </div>
            )}

            {/* Dress code */}
            {event.dress_code && (
              <div className="flex items-center text-xs font-medium text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-slate-800/80 p-2.5 rounded-xl border border-gray-100 dark:border-slate-800">
                <div className="bg-white dark:bg-slate-700 p-1.5 rounded-lg mr-2.5 shadow-xs shrink-0">
                  <Shirt size={14} className="text-purple-500" />
                </div>
                <span className="truncate">{event.dress_code}</span>
              </div>
            )}

            {/* Description preview */}
            {event.description && (
              <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 pt-1">
                {event.description}
              </p>
            )}
          </div>
        </div>

        {/* CTA Button */}
        <Link
          href={destinationHref}
          className="block text-center w-full bg-passi-bleu text-white py-3.5 rounded-2xl font-bold hover:bg-passi-corail transition-colors shadow-md shadow-passi-bleu/20 text-sm flex items-center justify-center gap-2 group-hover:shadow-lg"
        >
          <span>Réserver mon Pass</span>
          <ArrowRight size={16} />
        </Link>
      </div>
    </div>
  );
}

export default EventCard;
