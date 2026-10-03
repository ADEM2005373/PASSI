"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Logo } from "@/components/Logo";
import { AlertCircle, CheckCircle2, ArrowLeft } from "lucide-react";
import { resetPassword } from "./actions";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess(false);

    const result = await resetPassword(email, window.location.origin);

    if (result.error) {
      setError(result.error || "Une erreur est survenue lors de l'envoi de l'email.");
    } else {
      setSuccess(true);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: "var(--bg)" }}>
      {/* ── Left decorative panel ─── */}
      <div className="hidden lg:flex lg:w-1/2 bg-passi-bleu dark:bg-passi-surface relative flex-col justify-between p-16 pb-10 overflow-y-auto overflow-x-hidden scrollbar-hide">
        <div className="absolute -top-20 -left-20 w-80 h-80 bg-passi-corail/20 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-passi-turquoise/15 rounded-full blur-3xl" />

        <Link href="/" className="relative z-10 block w-fit hover:opacity-80 transition-opacity">
          <Logo variant="dark" className="w-[140px] h-[42px]" />
        </Link>

        <div className="relative z-10 space-y-8 flex-1 flex flex-col justify-center my-12">
          <h2 className="text-5xl font-extrabold text-white leading-tight">
            Récupérez
            <br />
            <span className="text-passi-corail">votre accès</span>
          </h2>
          <p className="text-white/80 text-lg max-w-md mt-4 font-medium leading-relaxed">
            Nous vous enverrons un lien sécurisé pour choisir un nouveau mot de passe.
          </p>
        </div>

        <p className="text-passi-text-sec text-xs font-medium relative z-10 mt-8">
          © {new Date().getFullYear()} Passi · Tous droits réservés
        </p>
      </div>

      {/* ── Right: Form panel ─── */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 relative">
        {/* Mobile logo */}
        <div className="lg:hidden mb-10">
          <Link href="/" className="hover:opacity-80 transition-opacity block w-fit">
            <Logo variant="auto" className="w-[140px] h-[42px]" />
          </Link>
        </div>

        <div className="w-full max-w-sm space-y-6">
          {/* Header */}
          <div className="text-center space-y-2">
            <h1
              className="text-3xl font-extrabold"
              style={{ color: "var(--text-primary)" }}
            >
              Mot de passe oublié
            </h1>
            <p
              className="text-sm font-medium"
              style={{ color: "var(--text-secondary)" }}
            >
              Entrez l'adresse email associée à votre compte.
            </p>
          </div>

          {/* Success banner */}
          {success && (
            <div className="flex flex-col items-center justify-center gap-3 p-6 rounded-2xl bg-passi-turquoise/10 border border-passi-turquoise/20 text-center">
              <CheckCircle2 size={32} className="text-passi-turquoise" />
              <div className="space-y-1">
                <h3 className="text-passi-turquoise font-bold text-lg">Email envoyé !</h3>
                <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                  Consultez votre boîte de réception (et vos spams) pour le lien de réinitialisation.
                </p>
              </div>
            </div>
          )}

          {/* Error banner */}
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-passi-corail/10 border border-passi-corail/20">
              <AlertCircle size={16} className="text-passi-corail flex-shrink-0" />
              <span className="text-passi-corail text-sm font-semibold">
                {error}
              </span>
            </div>
          )}

          {/* Email Form */}
          {!success && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <input
                  type="email"
                  placeholder="Adresse Email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-5 py-3.5 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-black text-sm text-gray-800 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-passi-turquoise/50 transition-all shadow-sm"
                />
              </div>
              
              <button
                type="submit"
                disabled={loading}
                className="w-full px-5 py-3.5 rounded-2xl text-sm font-bold bg-passi-turquoise text-white hover:opacity-90 disabled:opacity-60 transition-all shadow-sm hover:shadow-md hover:-translate-y-0.5"
              >
                {loading ? "Envoi en cours..." : "Recevoir le lien"}
              </button>
            </form>
          )}

          <div className="text-center pt-4">
            <Link 
              href="/login" 
              className="inline-flex items-center gap-2 text-sm font-semibold text-passi-turquoise hover:text-passi-turquoise/80 transition-colors"
            >
              <ArrowLeft size={16} />
              Retour à la connexion
            </Link>
          </div>

        </div>
      </div>
    </div>
  );
}
