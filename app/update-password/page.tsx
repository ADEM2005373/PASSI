"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Logo } from "@/components/Logo";
import { AlertCircle, Lock } from "lucide-react";

export default function UpdatePasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (password !== confirmPassword) {
      setError("Les mots de passe ne correspondent pas.");
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setError("Le mot de passe doit contenir au moins 6 caractères.");
      setLoading(false);
      return;
    }

    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({
      password: password,
    });

    if (updateError) {
      setError(updateError.message || "Impossible de mettre à jour le mot de passe. Le lien a peut-être expiré.");
    } else {
      router.push("/dashboard");
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
            Nouveau
            <br />
            <span className="text-passi-turquoise">départ</span>
          </h2>
          <p className="text-white/80 text-lg max-w-md mt-4 font-medium leading-relaxed">
            Choisissez un mot de passe sécurisé pour protéger vos passes et vos informations.
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
            <div className="mx-auto w-12 h-12 bg-passi-turquoise/10 text-passi-turquoise rounded-full flex items-center justify-center mb-4">
              <Lock size={24} />
            </div>
            <h1
              className="text-3xl font-extrabold"
              style={{ color: "var(--text-primary)" }}
            >
              Nouveau mot de passe
            </h1>
            <p
              className="text-sm font-medium"
              style={{ color: "var(--text-secondary)" }}
            >
              Votre mot de passe doit comporter au moins 6 caractères.
            </p>
          </div>

          {/* Error banner */}
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-passi-corail/10 border border-passi-corail/20">
              <AlertCircle size={16} className="text-passi-corail flex-shrink-0" />
              <span className="text-passi-corail text-sm font-semibold">
                {error}
              </span>
            </div>
          )}

          {/* Password Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <input
                type="password"
                placeholder="Nouveau mot de passe"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-5 py-3.5 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-black text-sm text-gray-800 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-passi-turquoise/50 transition-all shadow-sm"
              />
            </div>
            
            <div>
              <input
                type="password"
                placeholder="Confirmez le mot de passe"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-5 py-3.5 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-black text-sm text-gray-800 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-passi-turquoise/50 transition-all shadow-sm"
              />
            </div>
            
            <button
              type="submit"
              disabled={loading}
              className="w-full px-5 py-3.5 rounded-2xl text-sm font-bold bg-passi-turquoise text-white hover:opacity-90 disabled:opacity-60 transition-all shadow-sm hover:shadow-md hover:-translate-y-0.5 mt-2"
            >
              {loading ? "Mise à jour..." : "Mettre à jour le mot de passe"}
            </button>
          </form>

        </div>
      </div>
    </div>
  );
}
