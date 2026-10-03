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
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const searchParams = useSearchParams();

  useEffect(() => {
    setMounted(true);
    const urlError = searchParams.get("error");
    if (urlError) setError("La connexion a échoué. Réessayez.");
  }, [searchParams]);

  const handleEmailLogin = async () => {
    setError("");
    setLoading(true);
    const supabase = createClient();

    // First try to sign in
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      // If invalid credentials, maybe user doesn't exist. We could try to sign up.
      if (signInError.message.includes("Invalid login credentials")) {
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        });
        
        if (signUpError) {
          setError(signUpError.message || "Erreur d'inscription.");
        } else {
          setError("Veuillez vérifier vos emails pour confirmer votre inscription.");
        }
      } else {
        setError(signInError.message || "La connexion a échoué.");
      }
    } else {
      window.location.href = "/";
    }
    setLoading(false);
  };

  const handleOAuth = async (provider: Provider) => {
    setError("");
    setLoadingProvider(provider);
    const supabase = createClient();

    // Map "instagram" to the "facebook" Supabase provider
    const supabaseProvider = provider === "instagram" ? "facebook" : provider;

    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: supabaseProvider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: {
          prompt: 'select_account',
          ...(provider === "instagram" && { display: "popup" }),
        }
      },
    });

    if (oauthError) {
      setError("La connexion a échoué. Réessayez.");
      setLoadingProvider(null);
    }
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
            Votre pass
            <br />
            <span className="text-passi-corail">Votre soirée</span>
          </h2>
          
          {/* Interactive Coded Ticket / Poster */}
          <div className="relative mt-12 w-full max-w-sm mx-auto group">
            <style dangerouslySetInnerHTML={{__html: `
              @keyframes blob {
                0% { transform: translate(0px, 0px) scale(1); }
                33% { transform: translate(30px, -50px) scale(1.1); }
                66% { transform: translate(-20px, 20px) scale(0.9); }
                100% { transform: translate(0px, 0px) scale(1); }
              }
              .animate-blob { animation: blob 7s infinite; }
              .animation-delay-2000 { animation-delay: 2s; }
              .animation-delay-4000 { animation-delay: 4s; }
              @keyframes shimmer {
                100% { transform: translateX(100%); }
              }
              @keyframes scan {
                0% { top: 5%; opacity: 0; }
                10% { opacity: 1; }
                90% { opacity: 1; }
                100% { top: 95%; opacity: 0; }
              }
            `}} />
            
            {/* Animated gradient blobs in background */}
            <div className="absolute top-0 -left-4 w-48 h-48 bg-passi-corail rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob"></div>
            <div className="absolute top-0 -right-4 w-48 h-48 bg-passi-turquoise rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob animation-delay-2000"></div>
            <div className="absolute -bottom-8 left-20 w-48 h-48 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob animation-delay-4000"></div>

            {/* Glassmorphic Card */}
            <div className="relative bg-white/10 dark:bg-black/20 backdrop-blur-3xl border border-white/30 p-6 rounded-[2rem] shadow-[0_8px_32px_0_rgba(31,38,135,0.37)] overflow-hidden transform transition-all duration-500 hover:scale-[1.02] hover:rotate-1">
              
              {/* Shine effect */}
              <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/20 to-white/0 transform -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]"></div>

              {/* Event Cover Image placeholder / Top Section */}
              <div className="relative w-full h-32 rounded-2xl overflow-hidden mb-6 flex items-center justify-center shadow-inner">
                <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=800&auto=format&fit=crop')] bg-cover bg-center"></div>
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/10"></div>
                <div className="relative z-10 w-full px-4 text-left flex justify-between items-end h-full pb-3">
                  <div>
                    <span className="bg-passi-corail text-white text-[10px] font-black uppercase px-2 py-1 rounded-lg mb-1 inline-block shadow-lg">VIP Pass</span>
                    <h3 className="text-white font-extrabold text-xl leading-none drop-shadow-md">Summer Festival</h3>
                  </div>
                  <Ticket className="text-white w-6 h-6 mb-1 drop-shadow-lg" />
                </div>
              </div>

              {/* QR Code Section */}
              <div className="bg-white rounded-2xl p-4 flex flex-col items-center justify-center relative shadow-[inset_0_0_20px_rgba(0,0,0,0.05)] border-2 border-transparent group-hover:border-passi-turquoise/30 transition-colors duration-500">
                {/* Scanner Laser */}
                <div className="absolute top-0 left-0 w-full h-0.5 bg-passi-turquoise shadow-[0_0_15px_rgba(0,255,255,0.8)] z-20 animate-[scan_2s_ease-in-out_infinite]"></div>
                <QrCode className="w-32 h-32 text-gray-900 drop-shadow-sm" strokeWidth={1.5} />
                <div className="mt-3 text-gray-400 font-mono text-xs tracking-widest uppercase">ID: 84729-PASSI</div>
              </div>

              {/* Footer details */}
              <div className="mt-6 flex justify-between items-center text-sm">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gray-200 border-2 border-white/50 overflow-hidden shadow-sm">
                    <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Felix" alt="avatar" className="w-full h-full object-cover" />
                  </div>
                  <div>
                    <div className="text-white font-bold text-xs">Alex Dupont</div>
                    <div className="text-white/70 text-[10px] font-medium">1x Entrée • 2x Boissons</div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 bg-green-500/20 text-green-400 px-3 py-1.5 rounded-full border border-green-500/30 backdrop-blur-sm">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse"></div>
                  <span className="text-xs font-bold uppercase tracking-wider">Actif</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <p className="text-passi-text-sec text-xs font-medium relative z-10 mt-8">
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

          {/* Email/Password Form */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleEmailLogin();
            }}
            className="space-y-4"
          >
            <div>
              <input
                type="email"
                placeholder="Email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-5 py-3.5 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-black text-sm text-gray-800 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-passi-turquoise/50 transition-all"
              />
            </div>
            <div>
              <input
                type="password"
                placeholder="Mot de passe"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-5 py-3.5 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-black text-sm text-gray-800 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-passi-turquoise/50 transition-all"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full px-5 py-3.5 rounded-2xl text-sm font-bold bg-passi-turquoise text-white hover:opacity-90 disabled:opacity-60 transition-all shadow-sm hover:shadow-md hover:-translate-y-0.5"
            >
              {loading ? "Connexion..." : "Se connecter / S'inscrire"}
            </button>
          </form>

          <div className="flex justify-center -mt-2">
            <Link 
              href="/forgot-password" 
              className="text-xs font-semibold text-passi-turquoise hover:text-passi-turquoise/80 transition-colors"
            >
              Mot de passe oublié ?
            </Link>
          </div>

          <div className="flex items-center gap-3 py-2">
            <div className="flex-1 h-px" style={{ backgroundColor: "var(--border)" }} />
            <span className="text-xs font-medium uppercase tracking-widest text-gray-400">Ou</span>
            <div className="flex-1 h-px" style={{ backgroundColor: "var(--border)" }} />
          </div>

          {/* Provider buttons */}
          <div className="space-y-3">
            {PROVIDERS.map(({ id, label, icon, bg, border, text }) => (
              <button
                key={id}
                id={`login-${id}`}
                onClick={() => handleOAuth(id)}
                disabled={loading}
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
