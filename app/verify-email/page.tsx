"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useTheme } from "next-themes";
import { Logo } from "@/components/Logo";
import { verifyEmailOtpAction, resendEmailOtpAction } from "@/lib/actions/auth";
import { 
  KeyRound, 
  ArrowLeft, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  Sun, 
  Moon, 
  Mail, 
  ShieldCheck,
  Sparkles
} from "lucide-react";

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { theme, setTheme } = useTheme();

  const [mounted, setMounted] = useState(false);
  const [email, setEmail] = useState("");
  const [isEditingEmail, setIsEditingEmail] = useState(false);
  const [editedEmail, setEditedEmail] = useState("");

  // 8 individual digit states to match Supabase 8-digit OTP token
  const OTP_LENGTH = 8;
  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(""));
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Resend cooldown timer
  const [cooldown, setCooldown] = useState(60);
  const [isResending, setIsResending] = useState(false);

  useEffect(() => {
    setMounted(true);
    const emailParam = searchParams.get("email");
    if (emailParam) {
      setEmail(emailParam);
      setEditedEmail(emailParam);
    }
  }, [searchParams]);

  // Focus first input on mount
  useEffect(() => {
    if (mounted && inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, [mounted]);

  // Cooldown countdown
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const handleDigitChange = (index: number, value: string) => {
    // Only accept numeric digits
    const cleaned = value.replace(/\D/g, "");
    if (!cleaned) {
      const newDigits = [...digits];
      newDigits[index] = "";
      setDigits(newDigits);
      return;
    }

    // Handle single digit
    const newDigits = [...digits];
    newDigits[index] = cleaned.slice(-1);
    setDigits(newDigits);

    // Auto-advance to next input
    if (index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      if (!digits[index] && index > 0) {
        // Move to previous box if current is empty
        inputRefs.current[index - 1]?.focus();
        const newDigits = [...digits];
        newDigits[index - 1] = "";
        setDigits(newDigits);
      }
    } else if (e.key === "ArrowLeft" && index > 0) {
      e.preventDefault();
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === "ArrowRight" && index < OTP_LENGTH - 1) {
      e.preventDefault();
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text").trim().replace(/\D/g, "");
    if (!pastedData) return;

    const newDigits = [...digits];
    for (let i = 0; i < OTP_LENGTH; i++) {
      newDigits[i] = pastedData[i] || "";
    }
    setDigits(newDigits);

    const nextIndex = Math.min(pastedData.length, OTP_LENGTH - 1);
    inputRefs.current[nextIndex]?.focus();

    // Auto-submit if all digits pasted
    if (pastedData.length >= OTP_LENGTH) {
      executeVerification(pastedData.slice(0, OTP_LENGTH));
    }
  };

  const executeVerification = async (codeToVerify?: string) => {
    const fullCode = codeToVerify || digits.join("");
    if (fullCode.length !== OTP_LENGTH) {
      setError(`Veuillez saisir les ${OTP_LENGTH} chiffres du code reçu par email.`);
      return;
    }

    if (!email) {
      setError("Veuillez renseigner votre adresse email.");
      return;
    }

    setError(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      const result = await verifyEmailOtpAction(email, fullCode);
      if (result.success) {
        setSuccessMsg("✓ Compte vérifié avec succès ! Redirection en cours...");
        setTimeout(() => {
          router.push(result.redirectTo || "/onboarding");
        }, 800);
      } else {
        setError(result.error || "Code invalide ou expiré.");
      }
    } catch (err: any) {
      setError(err?.message || "Erreur de connexion. Veuillez réessayer.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    executeVerification();
  };

  const handleResend = async () => {
    if (cooldown > 0 || isResending) return;
    if (!email) {
      setError("Adresse email introuvable pour le renvoi.");
      return;
    }

    setIsResending(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await resendEmailOtpAction(email);
      if (res.success) {
        setSuccessMsg("✓ Un nouveau code à 6 chiffres a été envoyé à votre adresse email !");
        setCooldown(60);
      } else {
        setError(res.error || "Impossible d'envoyer un nouveau code pour le moment.");
      }
    } catch (err: any) {
      setError(err?.message || "Erreur lors du renvoi du code.");
    } finally {
      setIsResending(false);
    }
  };

  const handleSaveEditedEmail = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = editedEmail.trim();
    if (!clean || !clean.includes("@")) {
      setError("Veuillez entrer une adresse email valide.");
      return;
    }
    setEmail(clean);
    setIsEditingEmail(false);
    setError(null);
  };

  return (
    <div className="min-h-screen flex flex-col justify-between" style={{ backgroundColor: "var(--bg)" }}>
      {/* Top Navbar */}
      <header className="px-6 py-5 flex items-center justify-between border-b" style={{ borderColor: "var(--border)" }}>
        <Link href="/" className="hover:opacity-85 transition-opacity">
          <Logo variant="auto" className="w-[110px] h-[34px]" />
        </Link>
        {mounted && (
          <button
            type="button"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="p-2.5 rounded-xl border transition-colors hover:bg-neutral-800/10 dark:hover:bg-neutral-200/10"
            style={{ borderColor: "var(--border)" }}
            aria-label="Changer de thème"
          >
            {theme === "dark" ? <Sun size={18} className="text-amber-400" /> : <Moon size={18} className="text-slate-600" />}
          </button>
        )}
      </header>

      {/* Main Container */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 my-8">
        <div className="w-full max-w-md relative">
          {/* Decorative ambient glow */}
          <div className="absolute -top-12 -left-12 w-48 h-48 bg-passi-corail/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-12 -right-12 w-48 h-48 bg-passi-turquoise/20 rounded-full blur-3xl pointer-events-none" />

          {/* Glassmorphic Verification Card */}
          <div
            className="relative p-7 sm:p-9 rounded-3xl shadow-xl backdrop-blur-xl border transition-all"
            style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border)" }}
          >
            {/* Header Icon & Title */}
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-passi-corail/20 to-passi-turquoise/20 border border-passi-turquoise/30 text-passi-turquoise mb-4 shadow-sm">
                <KeyRound size={30} className="stroke-[2.2]" />
              </div>
              <h1 className="text-2xl font-extrabold tracking-tight" style={{ color: "var(--text-primary)" }}>
                Code de vérification
              </h1>
              <p className="text-sm mt-1.5 font-medium" style={{ color: "var(--text-secondary)" }}>
                Saisissez le code à 8 chiffres envoyé par email pour confirmer votre compte.
              </p>
            </div>

            {/* Email pill / Editor */}
            <div
              className="p-3.5 rounded-2xl mb-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs font-semibold"
              style={{ backgroundColor: "var(--bg-input)", border: "1.5px solid var(--border)" }}
            >
              {isEditingEmail ? (
                <form onSubmit={handleSaveEditedEmail} className="flex items-center gap-2 w-full">
                  <input
                    type="email"
                    required
                    value={editedEmail}
                    onChange={(e) => setEditedEmail(e.target.value)}
                    className="flex-1 bg-transparent border-b border-passi-turquoise px-1 py-0.5 text-xs font-semibold focus:outline-none"
                    placeholder="nouvel-email@domaine.com"
                    autoFocus
                  />
                  <button type="submit" className="text-passi-turquoise hover:underline px-1 py-0.5">
                    OK
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditedEmail(email);
                      setIsEditingEmail(false);
                    }}
                    className="text-neutral-400 hover:text-white px-1 py-0.5"
                  >
                    Annuler
                  </button>
                </form>
              ) : (
                <>
                  <div className="flex items-center gap-2 truncate max-w-[240px]">
                    <Mail size={15} className="text-passi-turquoise flex-shrink-0" />
                    <span className="truncate" style={{ color: "var(--text-primary)" }}>
                      {email || "Votre email"}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsEditingEmail(true)}
                    className="text-passi-corail hover:underline transition-colors flex-shrink-0"
                  >
                    Modifier l'email
                  </button>
                </>
              )}
            </div>

            {/* Error & Success Alerts */}
            {error && (
              <div className="mb-5 p-3.5 rounded-2xl flex items-start gap-2.5 bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-semibold animate-in fade-in duration-200">
                <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
                <span className="leading-relaxed">{error}</span>
              </div>
            )}

            {successMsg && (
              <div className="mb-5 p-3.5 rounded-2xl flex items-start gap-2.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold animate-in fade-in duration-200">
                <CheckCircle2 size={16} className="flex-shrink-0 mt-0.5" />
                <span className="leading-relaxed">{successMsg}</span>
              </div>
            )}

            {/* OTP Form */}
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* 8 Digit Input Slots */}
              <div className="grid grid-cols-8 gap-1.5 sm:gap-2">
                {digits.map((digit, idx) => (
                  <input
                    key={idx}
                    ref={(el) => {
                      inputRefs.current[idx] = el;
                    }}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleDigitChange(idx, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(idx, e)}
                    onPaste={handlePaste}
                    className={`w-full aspect-[4/5] sm:aspect-square flex items-center justify-center text-center text-lg sm:text-2xl font-black rounded-xl sm:rounded-2xl transition-all outline-none border ${
                      digit
                        ? "border-passi-turquoise text-passi-turquoise bg-passi-turquoise/5 shadow-[0_0_12px_rgba(45,212,191,0.15)]"
                        : "border-neutral-700 focus:border-passi-corail focus:ring-2 focus:ring-passi-corail/30"
                    }`}
                    style={{
                      backgroundColor: "var(--bg-input)",
                      color: digit ? "#2DD4BF" : "var(--text-primary)",
                    }}
                    disabled={loading}
                    aria-label={`Chiffre ${idx + 1}`}
                  />
                ))}
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading || digits.some((d) => !d)}
                className="w-full py-4 rounded-2xl text-sm font-extrabold text-white bg-gradient-to-r from-passi-corail via-rose-500 to-passi-turquoise hover:opacity-95 active:scale-[0.98] transition-all shadow-lg shadow-passi-corail/25 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin w-5 h-5 text-white" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Vérification en cours...
                  </>
                ) : (
                  <>
                    <ShieldCheck size={18} />
                    Confirmer mon compte
                  </>
                )}
              </button>
            </form>

            {/* Resend Code Section */}
            <div className="mt-6 pt-5 border-t text-center space-y-3" style={{ borderColor: "var(--border)" }}>
              <p className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                Vous n'avez pas reçu le code ?
              </p>
              <button
                type="button"
                onClick={handleResend}
                disabled={cooldown > 0 || isResending}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-passi-turquoise hover:underline disabled:text-neutral-500 disabled:no-underline transition-colors cursor-pointer disabled:cursor-not-allowed"
              >
                <RefreshCw size={13} className={isResending ? "animate-spin" : ""} />
                {isResending
                  ? "Envoi en cours..."
                  : cooldown > 0
                  ? `Renvoyer le code (${cooldown}s)`
                  : "Renvoyer un nouveau code"}
              </button>
            </div>

            {/* Return to Login */}
            <div className="mt-4 text-center">
              <Link
                href="/login"
                className="inline-flex items-center gap-1 text-xs font-semibold text-neutral-400 hover:text-white transition-colors"
              >
                <ArrowLeft size={13} />
                Retour à la page de connexion
              </Link>
            </div>
          </div>
        </div>
      </main>

      {/* Footer info */}
      <footer className="py-4 text-center text-xs text-neutral-500 border-t" style={{ borderColor: "var(--border)" }}>
        Sécurisé par Passi Auth & OTP Verification
      </footer>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-black text-white">
          <div className="flex flex-col items-center gap-3">
            <svg className="animate-spin w-8 h-8 text-passi-corail" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <p className="text-sm font-semibold text-neutral-400">Chargement de la vérification...</p>
          </div>
        </div>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  );
}
