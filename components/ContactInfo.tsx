"use client";

import React from 'react';
import { Mail, Phone, ExternalLink, Headphones, ArrowRight } from 'lucide-react';

/**
 * Official contact data for Passi
 */
export const CONTACT_DATA = {
  email: {
    address: 'passi.official216@gmail.com',
    href: 'mailto:passi.official216@gmail.com',
    label: 'Support Passi',
  },
  phones: [
    {
      id: 'phone-1',
      number: '(+216) 29 763 603',
      href: 'tel:+21629763603',
      label: 'Ligne 1',
    },
    {
      id: 'phone-2',
      number: '(+216) 99 763 405',
      href: 'tel:+21699763405',
      label: 'Ligne 2',
    },
  ],
  whatsapp: [
    {
      id: 'wa-1',
      number: '(+216) 29 763 603',
      href: 'https://wa.me/21629763603',
      label: 'WhatsApp 1',
    },
    {
      id: 'wa-2',
      number: '(+216) 96 383 110',
      href: 'https://wa.me/21696383110',
      label: 'WhatsApp 2',
    },
  ],
};

/**
 * Authentic WhatsApp vector icon
 */
export function WhatsAppIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91C2.13 13.66 2.59 15.36 3.45 16.86L2.05 22L7.3 20.62C8.75 21.41 10.38 21.83 12.04 21.83C17.5 21.83 21.95 17.38 21.95 11.92C21.95 9.27 20.92 6.78 19.05 4.91C17.18 3.03 14.69 2 12.04 2M12.05 3.67C14.25 3.67 16.31 4.53 17.87 6.09C19.42 7.65 20.28 9.72 20.28 11.92C20.28 16.46 16.58 20.15 12.04 20.15C10.56 20.15 9.11 19.76 7.85 19L7.55 18.83L4.43 19.65L5.26 16.61L5.06 16.29C4.24 15 3.8 13.47 3.8 11.91C3.81 7.37 7.5 3.67 12.05 3.67M9.11 7.74C8.94 7.74 8.68 7.81 8.46 8.05C8.24 8.29 7.62 8.87 7.62 10.05C7.62 11.23 8.48 12.36 8.6 12.53C8.73 12.69 10.27 15.08 12.64 16.1C14.62 16.95 15.02 16.78 15.46 16.74C15.9 16.7 16.87 16.16 17.07 15.6C17.27 15.03 17.27 14.55 17.21 14.45C17.15 14.34 17 14.28 16.74 14.15C16.48 14.02 15.22 13.4 14.98 13.31C14.75 13.23 14.58 13.19 14.41 13.45C14.24 13.71 13.75 14.28 13.6 14.45C13.46 14.63 13.31 14.65 13.05 14.52C12.79 14.39 11.96 14.12 10.98 13.24C10.21 12.56 9.7 11.72 9.55 11.46C9.4 11.2 9.53 11.06 9.66 10.93C9.78 10.82 9.92 10.63 10.06 10.47C10.19 10.32 10.23 10.21 10.32 10.03C10.41 9.86 10.36 9.71 10.3 9.58C10.23 9.45 9.74 8.24 9.53 7.76C9.33 7.29 9.13 7.35 8.97 7.34L8.56 7.34C8.39 7.34 8.94 7.74 9.11 7.74Z" />
    </svg>
  );
}

export interface ContactInfoProps {
  variant?: 'card' | 'landing' | 'footer' | 'compact';
  title?: string;
  subtitle?: string;
  className?: string;
}

/**
 * Reusable ContactInfo Component
 * Displays clickable email, phone numbers, and WhatsApp channels.
 */
export function ContactInfo({
  variant = 'card',
  title,
  subtitle,
  className = '',
}: ContactInfoProps) {
  // ── VARIANT 1: DASHBOARD CARD (Mon Profil & Dashboard) ──
  if (variant === 'card') {
    return (
      <div className={`w-full bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-3xl p-6 md:p-8 shadow-xl shadow-gray-100/50 dark:shadow-none transition-all ${className}`}>
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-wider bg-passi-corail/10 text-passi-corail border border-passi-corail/20 mb-2.5">
              <Headphones size={13} />
              <span>Support & Assistance</span>
            </div>
            <h3 className="text-xl md:text-2xl font-black text-passi-bleu dark:text-white">
              {title || "Besoin d'aide ? Contactez-nous"}
            </h3>
            <p className="text-sm font-medium text-passi-text-sec mt-1">
              {subtitle || "Notre équipe est à votre disposition par e-mail, téléphone ou WhatsApp pour répondre à vos questions."}
            </p>
          </div>
        </div>

        {/* Channels Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
          {/* 1. Email */}
          <div className="p-4 rounded-2xl bg-gray-50 dark:bg-slate-800/60 border border-gray-200/80 dark:border-slate-700/60 flex flex-col justify-between hover:border-passi-corail/40 transition-colors group">
            <div>
              <div className="w-10 h-10 rounded-xl bg-passi-corail/15 text-passi-corail flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                <Mail size={18} />
              </div>
              <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-1">
                E-mail
              </span>
              <a
                href={CONTACT_DATA.email.href}
                className="text-sm font-bold text-passi-bleu dark:text-white hover:text-passi-corail dark:hover:text-passi-corail transition-colors break-all block"
                title="Envoyer un e-mail à Passi"
              >
                {CONTACT_DATA.email.address}
              </a>
            </div>
            <a
              href={CONTACT_DATA.email.href}
              className="mt-4 inline-flex items-center gap-1.5 text-xs font-bold text-passi-corail hover:underline"
            >
              <span>Écrire un e-mail</span>
              <ArrowRight size={13} />
            </a>
          </div>

          {/* 2. Phone Call */}
          <div className="p-4 rounded-2xl bg-gray-50 dark:bg-slate-800/60 border border-gray-200/80 dark:border-slate-700/60 flex flex-col justify-between hover:border-passi-turquoise/40 transition-colors group">
            <div>
              <div className="w-10 h-10 rounded-xl bg-passi-turquoise/15 text-passi-turquoise flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                <Phone size={18} />
              </div>
              <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-1">
                Téléphone
              </span>
              <div className="space-y-1.5">
                {CONTACT_DATA.phones.map((item) => (
                  <a
                    key={item.id}
                    href={item.href}
                    className="flex items-center justify-between text-xs sm:text-sm font-bold text-passi-bleu dark:text-white hover:text-passi-turquoise transition-colors p-1.5 rounded-lg hover:bg-passi-turquoise/10"
                    title={`Appeler ${item.number}`}
                  >
                    <span>{item.number}</span>
                    <span className="text-[10px] text-gray-400 dark:text-gray-400 font-semibold">{item.label}</span>
                  </a>
                ))}
              </div>
            </div>
            <p className="mt-3 text-[11px] text-gray-400 dark:text-gray-400 italic">
              Appel direct 7j/7
            </p>
          </div>

          {/* 3. WhatsApp */}
          <div className="p-4 rounded-2xl bg-gray-50 dark:bg-slate-800/60 border border-gray-200/80 dark:border-slate-700/60 flex flex-col justify-between hover:border-emerald-500/40 transition-colors group">
            <div>
              <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                <WhatsAppIcon className="w-5 h-5 text-emerald-500 dark:text-emerald-400" />
              </div>
              <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-1">
                WhatsApp Direct
              </span>
              <div className="space-y-1.5">
                {CONTACT_DATA.whatsapp.map((item) => (
                  <a
                    key={item.id}
                    href={item.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between text-xs sm:text-sm font-bold text-passi-bleu dark:text-white hover:text-emerald-500 dark:hover:text-emerald-400 transition-colors p-1.5 rounded-lg hover:bg-emerald-500/10"
                    title={`Discuter sur WhatsApp avec ${item.number}`}
                  >
                    <span>{item.number}</span>
                    <ExternalLink size={12} className="text-emerald-500 dark:text-emerald-400 opacity-70" />
                  </a>
                ))}
              </div>
            </div>
            <p className="mt-3 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              Réponse rapide garantie
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── VARIANT 2: LANDING PAGE DEDICATED SECTION ──
  if (variant === 'landing') {
    return (
      <section id="contact" className={`py-24 bg-passi-creme dark:bg-passi-bleu transition-colors relative overflow-hidden ${className}`}>
        {/* Glow ambient effects */}
        <div className="absolute top-1/2 left-1/4 -translate-y-1/2 w-80 h-80 bg-passi-turquoise/15 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute top-1/2 right-1/4 -translate-y-1/2 w-80 h-80 bg-passi-corail/15 rounded-full blur-3xl pointer-events-none"></div>

        <div className="max-w-7xl mx-auto px-6 relative z-10">
          {/* Header */}
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-extrabold uppercase tracking-widest bg-passi-corail/10 text-passi-corail border border-passi-corail/20 mb-4 shadow-sm">
              <Headphones size={14} />
              <span>Support & Contact</span>
            </span>
            <h2 className="text-3xl md:text-5xl font-black text-passi-bleu dark:text-white tracking-tight leading-tight mb-4">
              {title || "Une question ? Besoin d'assistance ?"}
            </h2>
            <p className="text-base md:text-xl font-medium text-passi-text-sec leading-relaxed">
              {subtitle || "Notre équipe est disponible 7j/7 pour vous accompagner lors de vos événements et vos réservations de pass."}
            </p>
          </div>

          {/* Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Card 1: Email */}
            <div className="bg-white dark:bg-passi-surface rounded-3xl p-8 border border-gray-100 dark:border-gray-800 shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between group">
              <div>
                <div className="w-14 h-14 rounded-2xl bg-passi-corail/15 text-passi-corail flex items-center justify-center mb-6 group-hover:scale-110 transition-transform shadow-md shadow-passi-corail/10">
                  <Mail size={26} />
                </div>
                <h3 className="text-xl font-extrabold text-passi-bleu dark:text-white mb-2">
                  Écrivez-nous
                </h3>
                <p className="text-sm text-passi-text-sec font-medium mb-6 leading-relaxed">
                  Pour toute demande de partenariat, question générale ou problème avec un pass.
                </p>
              </div>

              <div className="pt-4 border-t border-gray-100 dark:border-gray-800">
                <a
                  href={CONTACT_DATA.email.href}
                  className="block text-center py-3 px-4 rounded-xl bg-passi-corail text-white font-bold text-sm hover:bg-passi-corail/90 shadow-lg shadow-passi-corail/25 transition-all active:scale-95"
                >
                  {CONTACT_DATA.email.address}
                </a>
              </div>
            </div>

            {/* Card 2: Phone */}
            <div className="bg-white dark:bg-passi-surface rounded-3xl p-8 border border-gray-100 dark:border-gray-800 shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between group">
              <div>
                <div className="w-14 h-14 rounded-2xl bg-passi-turquoise/15 text-passi-turquoise flex items-center justify-center mb-6 group-hover:scale-110 transition-transform shadow-md shadow-passi-turquoise/10">
                  <Phone size={26} />
                </div>
                <h3 className="text-xl font-extrabold text-passi-bleu dark:text-white mb-2">
                  Appelez-nous
                </h3>
                <p className="text-sm text-passi-text-sec font-medium mb-6 leading-relaxed">
                  Discutez en direct avec nos conseillers pour une réponse instantanée à vos urgences.
                </p>
              </div>

              <div className="space-y-2.5 pt-4 border-t border-gray-100 dark:border-gray-800">
                {CONTACT_DATA.phones.map((phone) => (
                  <a
                    key={phone.id}
                    href={phone.href}
                    className="flex items-center justify-between py-2.5 px-4 rounded-xl bg-gray-50 dark:bg-gray-800/70 border border-gray-100 dark:border-gray-700/60 font-bold text-sm text-passi-bleu dark:text-white hover:text-passi-turquoise hover:border-passi-turquoise/50 transition-all"
                  >
                    <span className="flex items-center gap-2">
                      <Phone size={14} className="text-passi-turquoise" />
                      <span>{phone.number}</span>
                    </span>
                    <span className="text-xs text-passi-text-sec font-semibold">{phone.label}</span>
                  </a>
                ))}
              </div>
            </div>

            {/* Card 3: WhatsApp */}
            <div className="bg-white dark:bg-passi-surface rounded-3xl p-8 border border-gray-100 dark:border-gray-800 shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between group">
              <div>
                <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform shadow-md shadow-emerald-500/10">
                  <WhatsAppIcon className="w-7 h-7 text-emerald-500 dark:text-emerald-400" />
                </div>
                <h3 className="text-xl font-extrabold text-passi-bleu dark:text-white mb-2">
                  WhatsApp Direct
                </h3>
                <p className="text-sm text-passi-text-sec font-medium mb-6 leading-relaxed">
                  Échangez en quelques secondes sur WhatsApp avec nos agents dédiés.
                </p>
              </div>

              <div className="space-y-2.5 pt-4 border-t border-gray-100 dark:border-gray-800">
                {CONTACT_DATA.whatsapp.map((wa) => (
                  <a
                    key={wa.id}
                    href={wa.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between py-2.5 px-4 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/10 border border-emerald-500/20 font-bold text-sm text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500 hover:text-white dark:hover:text-black transition-all"
                  >
                    <span className="flex items-center gap-2">
                      <WhatsAppIcon className="w-4 h-4" />
                      <span>{wa.number}</span>
                    </span>
                    <ExternalLink size={14} />
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
    );
  }

  // ── VARIANT 3: FOOTER ROW / COMPACT ──
  return (
    <div className={`flex flex-wrap items-center justify-center gap-y-3.5 gap-x-6 text-sm text-passi-text-sec ${className}`}>
      {/* Email */}
      <a
        href={CONTACT_DATA.email.href}
        className="flex items-center gap-2 hover:text-passi-corail transition-colors font-medium"
        title="Envoyer un e-mail à Passi"
      >
        <Mail size={16} className="text-passi-corail shrink-0" />
        <span>{CONTACT_DATA.email.address}</span>
      </a>

      <span className="hidden sm:inline text-gray-300 dark:text-gray-700">•</span>

      {/* Téléphone (Both numbers with / separator) */}
      <div className="flex items-center gap-1.5 flex-wrap justify-center">
        <span className="flex items-center gap-1.5 font-bold text-passi-bleu dark:text-white mr-0.5">
          <Phone size={15} className="text-passi-turquoise shrink-0" />
          <span>Tél :</span>
        </span>
        <a
          href={CONTACT_DATA.phones[0].href}
          className="hover:text-passi-turquoise transition-colors font-medium hover:underline whitespace-nowrap"
          title={`Appeler ${CONTACT_DATA.phones[0].number}`}
        >
          {CONTACT_DATA.phones[0].number}
        </a>
        <span className="text-gray-400 dark:text-gray-600 font-semibold mx-1">/</span>
        <a
          href={CONTACT_DATA.phones[1].href}
          className="hover:text-passi-turquoise transition-colors font-medium hover:underline whitespace-nowrap"
          title={`Appeler ${CONTACT_DATA.phones[1].number}`}
        >
          {CONTACT_DATA.phones[1].number}
        </a>
      </div>

      <span className="hidden sm:inline text-gray-300 dark:text-gray-700">•</span>

      {/* WhatsApp (Both numbers with / separator) */}
      <div className="flex items-center gap-1.5 flex-wrap justify-center">
        <span className="flex items-center gap-1.5 font-bold text-passi-bleu dark:text-white mr-0.5">
          <WhatsAppIcon className="w-4 h-4 text-emerald-500 shrink-0" />
          <span>WhatsApp :</span>
        </span>
        <a
          href={CONTACT_DATA.whatsapp[0].href}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-emerald-500 dark:hover:text-emerald-400 transition-colors font-medium hover:underline whitespace-nowrap"
          title={`Discuter sur WhatsApp avec ${CONTACT_DATA.whatsapp[0].number}`}
        >
          {CONTACT_DATA.whatsapp[0].number}
        </a>
        <span className="text-gray-400 dark:text-gray-600 font-semibold mx-1">/</span>
        <a
          href={CONTACT_DATA.whatsapp[1].href}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-emerald-500 dark:hover:text-emerald-400 transition-colors font-medium hover:underline whitespace-nowrap"
          title={`Discuter sur WhatsApp avec ${CONTACT_DATA.whatsapp[1].number}`}
        >
          {CONTACT_DATA.whatsapp[1].number}
        </a>
      </div>
    </div>
  );
}

export default ContactInfo;
