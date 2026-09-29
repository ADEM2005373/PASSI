"use client";

import { useState, useEffect, Suspense } from "react";
import { useTheme } from "next-themes";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Logo } from "@/components/Logo";
import { Sun, Moon, AlertCircle, Ticket, QrCode } from "lucide-react";

// ── Social login SVG icons ──────────────────────────────────────────────────

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden fill="#1877F2">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}

function InstagramIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden>
      <defs>
        <radialGradient id="ig-grad" cx="30%" cy="107%" r="150%">
          <stop offset="0%" stopColor="#ffd600" />
          <stop offset="50%" stopColor="#ff0069" />
          <stop offset="100%" stopColor="#d300c5" />
        </radialGradient>
      </defs>
      <path
        fill="url(#ig-grad)"
        d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"
      />
    </svg>
  );
}

// ── Provider config ─────────────────────────────────────────────────────────

type Provider = "google" | "facebook" | "instagram";

const PROVIDERS: {
  id: Provider;
  label: string;
  icon: React.ReactNode;
  bg: string;
  border: string;
  text: string;
}[] = [
  {
    id: "google",
    label: "Continuer avec Google",
    icon: <GoogleIcon />,
    bg: "bg-white hover:bg-gray-50",
    border: "border border-gray-200",
    text: "text-gray-800",
  },
  {
    id: "facebook",
    label: "Continuer avec Facebook",
    icon: <FacebookIcon />,
    bg: "bg-[#1877F2] hover:bg-[#166FE5]",
    border: "border border-[#1877F2]",
    text: "text-white",
  },
  {
    id: "instagram",
    label: "Continuer avec Instagram",
    icon: <InstagramIcon />,
    bg: "bg-gradient-to-r from-[#F58529] via-[#DD2A7B] to-[#8134AF] hover:opacity-90",
    border: "border-0",
    text: "text-white",
  },
];

// ── Component ───────────────────────────────────────────────────────────────

function LoginContent() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [loadingProvider, setLoadingProvider] = useState<Provider | null>(null);
  const [error, setError] = useState("");

  const searchParams = useSearchParams();

  useEffect(() => {
    setMounted(true);
    const urlError = searchParams.get("error");
    if (urlError) setError("La connexion a échoué. Réessayez.");
  }, [searchParams]);

  const handleOAuth = async (provider: Provider) => {
    setError("");
    setLoadingProvider(provider);
    const supabase = createClient();

    // Map "instagram" to the "facebook" Supabase provider
    // (Supabase uses Facebook's OAuth infrastructure for Instagram logins)
    const supabaseProvider = provider === "instagram" ? "facebook" : provider;

    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: supabaseProvider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        // Note: Removed instagram_basic scopes to prevent Meta "Invalid Scopes" error.
        // Standard Facebook login automatically covers Instagram users anyway!
        ...(provider === "instagram" && {
          queryParams: { display: "popup" },
        }),
      },
    });

    if (oauthError) {
      setError("La connexion a échoué. Réessayez.");
      setLoadingProvider(null);
    }
    // If no error the browser will navigate away to the OAuth provider
  };

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: "var(--bg)" }}>
      {/* ── Left decorative panel ─── */}
      <div className="hidden lg:flex lg:w-1/2 bg-passi-bleu dark:bg-passi-surface relative flex-col justify-between p-16 overflow-hidden">
        <div className="absolute -top-20 -left-20 w-80 h-80 bg-passi-corail/20 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-passi-turquoise/15 rounded-full blur-3xl" />

        <Link href="/" className="relative z-10 block w-fit hover:opacity-80 transition-opacity">
          <Logo variant="dark" className="w-[140px] h-[42px]" />
        </Link>

        <div className="relative z-10 space-y-8">
          <h2 className="text-5xl font-extrabold text-white leading-tight">
            Votre pass
            <br />
            <span className="text-passi-corail">Votre soirée</span>
          </h2>
          
          {/* Interactive Coded Ticket */}
          <div className="relative mt-8 group perspective-[1000px]">
            {/* Glow effect behind */}
            <div className="absolute inset-0 bg-gradient-to-tr from-passi-corail to-passi-turquoise rounded-3xl blur-2xl opacity-40 group-hover:opacity-70 transition-opacity duration-700 animate-pulse" style={{ animationDuration: '3s' }}></div>
            
            {/* The Ticket */}
            <div className="relative bg-white/10 backdrop-blur-xl border border-white/20 p-8 rounded-3xl shadow-2xl transform transition-transform duration-500 hover:-translate-y-2 hover:rotate-2">
              <div className="flex justify-between items-start mb-8">
                <div>
                  <div className="text-passi-turquoise text-xs font-black uppercase tracking-widest mb-2">Accès Premium</div>
                  <div className="text-white font-extrabold text-2xl tracking-tight">VIP Experience</div>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-passi-corail to-orange-400 flex items-center justify-center shadow-lg transform group-hover:rotate-12 transition-transform duration-500">
                  <Ticket className="text-white w-6 h-6" />
                </div>
              </div>
              
              <div className="w-full h-40 bg-white/5 rounded-2xl border border-white/10 flex items-center justify-center relative overflow-hidden group-hover:bg-white/10 transition-colors duration-500">
                {/* Decorative scanner line */}
                <div className="absolute top-0 left-0 w-full h-1 bg-passi-turquoise/50 blur-sm transform -translate-y-full group-hover:translate-y-[10rem] transition-transform duration-[2s] ease-in-out"></div>
                
                <QrCode className="text-white/90 w-20 h-20 group-hover:scale-110 transition-transform duration-500 drop-shadow-2xl" strokeWidth={1.5} />
              </div>

              <div className="mt-8 flex justify-between items-center text-sm font-bold text-white/70">
                <div className="flex items-center gap-2 bg-black/20 px-3 py-1.5 rounded-full border border-white/10">
                  <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
                  <span className="text-green-400">Prêt à scanner</span>
                </div>
                <div className="font-mono text-white/50 tracking-widest">#PS-84729</div>
              </div>
            </div>
          </div>
        </div>

        <p className="text-passi-text-sec text-xs font-medium relative z-10">
          © {new Date().getFullYear()} Passi · Tous droits réservés
        </p>
      </div>

      {/* ── Right: Social login panel ─── */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 relative">
        {/* Theme toggle */}
        <div className="absolute top-6 right-6">
          {mounted && (
            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="p-2.5 rounded-full btn-ghost"
              aria-label="Toggle theme"
            >
              {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          )}
        </div>

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
              Bienvenue 👋
            </h1>
            <p
              className="text-sm font-medium"
              style={{ color: "var(--text-secondary)" }}
            >
              Connectez-vous pour accéder à vos passes.
              <br />
              Aucun mot de passe requis.
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

          {/* Provider buttons */}
          <div className="space-y-3">
            {PROVIDERS.map(({ id, label, icon, bg, border, text }) => (
              <button
                key={id}
                id={`login-${id}`}
                onClick={() => handleOAuth(id)}
                disabled={!!loadingProvider}
                className={`
                  w-full flex items-center justify-center gap-3
                  px-5 py-3.5 rounded-2xl
                  text-sm font-bold
                  transition-all duration-200
                  ${bg} ${border} ${text}
                  disabled:opacity-60 disabled:cursor-not-allowed
                  shadow-sm hover:shadow-md hover:-translate-y-0.5
                  active:scale-95
                `}
              >
                {loadingProvider === id ? (
                  <svg
                    className="animate-spin w-5 h-5"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                ) : (
                  icon
                )}
                {loadingProvider === id ? "Redirection…" : label}
              </button>
            ))}
          </div>

          {/* Divider & legal */}
          <div className="text-center space-y-3">
            <div className="flex items-center gap-3">
              <div
                className="flex-1 h-px"
                style={{ backgroundColor: "var(--border)" }}
              />
              <span
                className="text-xs font-medium"
                style={{ color: "var(--text-muted)" }}
              >
                Connexion sécurisée
              </span>
              <div
                className="flex-1 h-px"
                style={{ backgroundColor: "var(--border)" }}
              />
            </div>
            <p
              className="text-xs font-medium leading-relaxed"
              style={{ color: "var(--text-muted)" }}
            >
              En vous connectant, vous acceptez nos conditions d&apos;utilisation.
              Nous n&apos;avons jamais accès à votre mot de passe.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-passi-bleu flex items-center justify-center text-white">Chargement...</div>}>
      <LoginContent />
    </Suspense>
  );
}
