"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Logo } from "@/components/Logo";
import { useAuth } from "@/lib/context/auth-context";

function StaffLoginContent() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [isGoogleLinked, setIsGoogleLinked] = useState<boolean | null>(null);

  const router = useRouter();
  const { user, isInitializing } = useAuth();
  const supabase = createClient();

  useEffect(() => {
    if (user) {
      if (user.role === 'admin') {
        const supabaseClient = createClient();
        supabaseClient.auth.getUser().then(({ data }: any) => {
          setIsGoogleLinked(data.user?.app_metadata?.providers?.includes('google') ?? false);
        });
      } else {
        setIsGoogleLinked(true);
      }
    }
  }, [user]);

  useEffect(() => {
    if (!isInitializing && user && isGoogleLinked !== null) {
      if (user.role === 'admin' && !isGoogleLinked) {
        // Stay on page to show Google Linking UI
      } else {
        // Auto-redirect to appropriate dashboard
        if (user.role === 'admin') router.replace('/admin');
        else if (user.role === 'security') router.replace('/scanner/security');
        else if (user.role === 'barman') router.replace('/scanner/barman');
        else router.replace('/dashboard');
      }
    }
  }, [isInitializing, user, isGoogleLinked, router]);

  const [linkError, setLinkError] = useState("");
  const [isLinking, setIsLinking] = useState(false);
  const searchParams = useSearchParams();

  useEffect(() => {
    if (searchParams.get('error')) {
      if (searchParams.get('error') === 'oauth_failed') {
        setLinkError("L'authentification Google a été annulée ou a échoué.");
      } else {
        setLinkError("Erreur lors de la liaison Google. Ce compte est peut-être déjà utilisé.");
      }
    }
  }, [searchParams]);

  // If already logged in and needs linking, show linking options
  if (!isInitializing && user && isGoogleLinked === false && user.role === 'admin') {
      return (
        <div className="min-h-screen bg-passi-creme flex flex-col items-center justify-center p-6">
          <div className="bg-white p-8 md:p-10 rounded-[2.5rem] shadow-xl max-w-md w-full text-center space-y-6">
            <Logo variant="light" className="w-[120px] h-[35px] mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-passi-bleu">Welcome, {user.email}</h2>
            <p className="text-gray-500 font-medium">
              You are logged in as <strong className="text-passi-corail uppercase">{user.role}</strong>.
            </p>
            
            <div className="bg-gray-50 border border-gray-200 rounded-2xl p-6 text-left shadow-sm">
              <h3 className="font-extrabold text-gray-900 mb-2">Connecter votre compte Google</h3>
              <p className="text-sm text-gray-600 mb-6 font-medium">
                En tant qu'administrateur, vous devez lier votre compte Google lors de votre première connexion.
              </p>
              
              {linkError && (
                <div className="bg-red-50 text-red-600 p-3 rounded-xl mb-4 text-sm font-bold border border-red-100">
                  {linkError}
                </div>
              )}

              <button
                disabled={isLinking}
                onClick={async () => {
                  setLinkError("");
                  setIsLinking(true);
                  try {
                    const { data, error } = await supabase.auth.linkIdentity({ 
                      provider: 'google',
                      options: {
                        redirectTo: `${window.location.origin}/auth/callback`
                      }
                    });
                    
                    if (error) {
                      console.error("Link Error:", error);
                      setLinkError(error.message);
                      setIsLinking(false);
                    }
                  } catch (e: any) {
                    console.error("Link Exception:", e);
                    setLinkError(e.message || "Une erreur inattendue s'est produite");
                    setIsLinking(false);
                  }
                }}
                className="w-full bg-white text-gray-800 border border-gray-200 py-3.5 rounded-xl font-bold flex items-center justify-center gap-3 hover:bg-gray-50 transition-colors shadow-sm disabled:opacity-70"
              >
                {isLinking ? (
                  <div className="w-5 h-5 border-2 border-gray-800 border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden fill="currentColor">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                )}
                {isLinking ? "Redirection..." : "Lier mon compte Google"}
              </button>
            </div>
          </div>
        </div>
      );
    } else if (!isInitializing && user) {
      // Render nothing or a loading spinner while redirecting
      return (
        <div className="min-h-screen bg-passi-creme flex flex-col items-center justify-center p-6">
          <div className="w-16 h-16 border-4 border-passi-corail border-t-transparent rounded-full animate-spin"></div>
        </div>
      );
    }
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
    }
    // No else block needed: the useEffect above will handle the redirect once `user` state updates!
  };

  return (
    <div className="min-h-screen bg-passi-bleu flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md bg-white p-8 md:p-10 rounded-[2.5rem] shadow-2xl relative overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute -top-10 -left-10 w-32 h-32 bg-passi-turquoise/10 rounded-full blur-2xl"></div>
        <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-passi-corail/10 rounded-full blur-2xl"></div>

        <div className="relative z-10 flex justify-center mb-8">
          <Logo variant="light" className="w-[140px] h-[42px]" />
        </div>
        
        <div className="relative z-10 text-center mb-8">
          <h1 className="text-2xl font-extrabold text-passi-bleu">Espace Staff</h1>
          <p className="text-gray-500 font-medium mt-2">Connexion réservée à l'administration</p>
        </div>

        {error && (
          <div className="relative z-10 bg-red-50 text-red-600 p-4 rounded-xl mb-6 text-sm font-bold text-center border border-red-100">
            {error === "Invalid login credentials" ? "Identifiants incorrects" : error}
          </div>
        )}

        <form onSubmit={handleLogin} className="relative z-10 space-y-5">
          <div>
            <label className="block text-sm font-bold text-passi-bleu mb-2">Adresse Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3.5 text-passi-bleu font-medium focus:outline-none focus:ring-2 focus:ring-passi-corail focus:border-transparent transition-all"
              placeholder="staff@passi.com"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-passi-bleu mb-2">Mot de passe</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3.5 text-passi-bleu font-medium focus:outline-none focus:ring-2 focus:ring-passi-corail focus:border-transparent transition-all"
              placeholder="••••••••"
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-passi-corail text-white py-4 rounded-xl font-bold text-lg shadow-lg shadow-passi-corail/30 hover:scale-[1.02] transition-transform disabled:opacity-70 disabled:scale-100"
          >
            {loading ? "Connexion..." : "Se connecter"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function StaffLoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-passi-creme flex items-center justify-center p-6"><div className="w-8 h-8 border-4 border-gray-800 border-t-transparent rounded-full animate-spin"></div></div>}>
      <StaffLoginContent />
    </Suspense>
  );
}
