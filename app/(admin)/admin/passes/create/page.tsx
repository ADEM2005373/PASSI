"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import Link from "next/link";
import { api, User, Event } from "@/lib/services/api";
import { useAuth } from "@/lib/context/auth-context";
import { Logo } from "@/components/Logo";
import { PassCreationSection } from "@/components/admin/PassCreationSection";
import { 
  Sun, 
  Moon, 
  ArrowLeft, 
  Sparkles,
  Ticket
} from "lucide-react";

export default function CreatePassPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [users, setUsers] = useState<User[]>([]);
  const [events, setEvents] = useState<Event[]>([]);

  const loadData = async () => {
    try {
      const [allUsers, allEvents] = await Promise.all([
        api.getProfiles(),
        api.getEvents()
      ]);
      setUsers(allUsers);
      setEvents(allEvents);
    } catch (err) {
      console.error("Failed to load users or events:", err);
    }
  };

  useEffect(() => {
    setMounted(true);
    const checkAuth = async () => {
      const currentUser = await api.getCurrentUser();
      if (!currentUser || currentUser.role !== 'admin') {
        router.replace("/staff/login");
        return;
      }

      const { createClient } = await import('@/lib/supabase/client');
      const supabase = createClient();
      const { data: { user: authUser } } = await supabase.auth.getUser();
      const isGoogleLinked = authUser?.identities?.some((id: any) => id.provider === 'google') ?? false;

      if (!isGoogleLinked) {
        router.replace("/staff/login");
        return;
      }

      setIsAdmin(true);
      await loadData();
      setIsLoading(false);
    };

    checkAuth();
  }, [router]);

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--bg)' }}>
        <div className="flex flex-col items-center gap-4">
          <svg className="animate-spin w-10 h-10 text-passi-corail" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <p className="font-bold text-sm" style={{ color: 'var(--text-secondary)' }}>
            Chargement de l'espace d'émission de passes...
          </p>
        </div>
      </div>
    );
  }

  if (!isAdmin) return null;

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--bg)' }}>
      {/* Top Navbar */}
      <header className="h-18 px-6 md:px-10 border-b flex items-center justify-between sticky top-0 z-30 backdrop-blur-md bg-opacity-90" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-4">
          <Link
            href="/admin"
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-gray-400 hover:text-white bg-black/20 hover:bg-black/40 border border-slate-800 transition-all"
          >
            <ArrowLeft size={16} />
            <span>Dashboard Admin</span>
          </Link>
          <div className="h-4 w-px bg-slate-700 hidden sm:block"></div>
          <Logo variant="auto" className="w-[100px] h-[30px]" />
        </div>

        <div className="flex items-center gap-3">
          {mounted && (
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="p-2 rounded-xl btn-ghost"
              title="Basculer le thème"
            >
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          )}

          <div className="flex items-center gap-2 pl-2 border-l border-slate-800">
            <div className="w-8 h-8 rounded-full bg-passi-corail flex items-center justify-center text-white font-bold text-xs">
              {user?.full_name ? user.full_name[0].toUpperCase() : (user?.email ? user.email[0].toUpperCase() : 'A')}
            </div>
            <span className="text-xs font-bold hidden sm:inline" style={{ color: 'var(--text-primary)' }}>
              {user?.full_name || 'Admin'}
            </span>
          </div>
        </div>
      </header>

      {/* Main Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 md:p-10">
        <PassCreationSection 
          users={users} 
          events={events} 
          onPassCreated={loadData} 
        />
      </main>
    </div>
  );
}
