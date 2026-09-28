"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Logo } from "@/components/Logo";
import { useAuth } from "@/lib/context/auth-context";

export default function StaffLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { user, isInitializing } = useAuth();
  const supabase = createClient();

  // If already logged in, show linking options or redirect to dashboard
  if (!isInitializing && user) {
    return (
      <div className="min-h-screen bg-passi-creme flex flex-col items-center justify-center p-6">
        <div className="bg-white p-8 md:p-10 rounded-[2.5rem] shadow-xl max-w-md w-full text-center space-y-6">
          <Logo variant="dark" className="w-[120px] h-[35px] mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-passi-bleu">Welcome, {user.email}</h2>
          <p className="text-gray-500 font-medium">
            You are logged in as <strong className="text-passi-corail uppercase">{user.role}</strong>.
          </p>
          
          <div className="bg-blue-50 border border-blue-100 rounded-2xl p-6 text-left shadow-sm">
            <h3 className="font-extrabold text-blue-900 mb-2">Connecter votre compte Meta</h3>
            <p className="text-sm text-blue-800 mb-6 font-medium">
              Liez votre compte Facebook ou Instagram. La prochaine fois, vous pourrez vous connecter directement depuis la page de connexion publique !
            </p>
            <button
              onClick={async () => {
                await supabase.auth.linkIdentity({ 
                  provider: 'facebook',
                  options: {
                    redirectTo: `${window.location.origin}/auth/callback`
                  }
                });
              }}
              className="w-full bg-[#1877F2] text-white py-3.5 rounded-xl font-bold flex items-center justify-center gap-3 hover:bg-[#166FE5] transition-colors shadow-md shadow-[#1877F2]/20"
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden fill="currentColor">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
              </svg>
              Lier mon compte
            </button>
          </div>

          <button
            onClick={() => router.push('/dashboard')}
            className="w-full bg-passi-bleu text-white py-4 rounded-xl font-bold mt-4 hover:bg-passi-bleu/90 transition-colors"
          >
            Accéder à mon espace
          </button>
        </div>
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
    } else {
      router.push("/dashboard");
    }
  };

  return (
    <div className="min-h-screen bg-passi-bleu flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md bg-white p-8 md:p-10 rounded-[2.5rem] shadow-2xl relative overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute -top-10 -left-10 w-32 h-32 bg-passi-turquoise/10 rounded-full blur-2xl"></div>
        <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-passi-corail/10 rounded-full blur-2xl"></div>

        <div className="relative z-10 flex justify-center mb-8">
          <Logo variant="dark" className="w-[140px] h-[42px]" />
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
