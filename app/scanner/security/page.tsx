"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { api } from "../../../lib/services/api";
import { useAuth } from "@/lib/context/auth-context";
import QRScanner from "../../../components/QRScanner";
import { Logo } from "@/components/Logo";
import { Sun, Moon, LogOut, ShieldCheck, ChevronDown } from "lucide-react";

type ScanState = "idle" | "success" | "error";

export default function SecurityScanner() {
  const router = useRouter();
  const { logout: contextLogout } = useAuth();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [isSecurity, setIsSecurity] = useState(false);
  const [scanState, setScanState] = useState<ScanState>("idle");
  const [message, setMessage] = useState("");
  const [events, setEvents] = useState<any[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>("");

  useEffect(() => {
    setMounted(true);
    const init = async () => {
      const user = await api.getCurrentUser();
      if (!user || (user.role !== 'security' && user.role !== 'admin')) {
        router.push("/login");
        return;
      }
      setIsSecurity(true);
      const allEvents = await api.getEvents();
      setEvents(allEvents || []);
      if (allEvents && allEvents.length > 0) setSelectedEventId(allEvents[0].id);
    };
    init();
  }, [router]);

  const isProcessingRef = useRef(false);

  const handleScan = async (decodedText: string) => {
    if (isProcessingRef.current) return;
    isProcessingRef.current = true;
    
    try {
      if (!selectedEventId) {
        setScanState("error");
        setMessage("Sélectionnez d'abord un événement");
        setTimeout(() => { setScanState("idle"); isProcessingRef.current = false; }, 3000);
        return;
      }
      const res = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qrUuid: decodedText, type: 'entry', eventId: selectedEventId })
      });
      const result = await res.json();
      setScanState(result.success ? "success" : "error");
      setMessage(result.message);
      
      // Auto return to idle after 3 seconds
      setTimeout(() => { 
        setScanState("idle"); 
        setMessage(""); 
        // 500ms debounce to prevent immediate rescan of the same code
        setTimeout(() => { isProcessingRef.current = false; }, 500);
      }, 3000);
      
    } catch {
      setScanState("error");
      setMessage("Erreur API");
      setTimeout(() => { 
        setScanState("idle"); 
        setTimeout(() => { isProcessingRef.current = false; }, 500);
      }, 3000);
    }
  };

  if (!isSecurity) return null;

  return (
    <>
      {/* ── IDLE VIEW ── */}
      <div style={{ display: scanState === "idle" ? "block" : "none" }}>
        <div className="min-h-screen" style={{ backgroundColor: 'var(--bg)' }}>
          {/* Top bar */}
          <header className="flex items-center justify-between px-6 py-4 border-b" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }}>
            <Logo variant="auto" className="w-[110px] h-[33px]" />
            <div className="flex items-center gap-3">
              {mounted && (
                <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="p-2.5 rounded-xl btn-ghost" aria-label="Toggle theme">
                  {theme === 'dark' ? <Sun size={17}/> : <Moon size={17}/>}
                </button>
              )}
              <button
                onClick={contextLogout}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-red-500 hover:bg-red-500/10 transition-colors"
              >
                <LogOut size={16}/> Quitter
              </button>
            </div>
          </header>

          <div className="max-w-md mx-auto px-6 py-10 space-y-6">
            {/* Title */}
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-passi-bleu dark:bg-passi-surface flex items-center justify-center">
                <ShieldCheck size={24} className="text-passi-turquoise"/>
              </div>
              <div>
                <h1 className="text-xl font-extrabold" style={{ color: 'var(--text-primary)' }}>Scanner Sécurité</h1>
                <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Contrôle d'accès entrée</p>
              </div>
            </div>

            {/* Event selector */}
            <div className="card p-5">
              <label className="label">Événement en cours</label>
              <div className="relative">
                <select
                  className="input pr-10 appearance-none"
                  value={selectedEventId}
                  onChange={e => setSelectedEventId(e.target.value)}
                >
                  <option value="" disabled>Choisir un événement...</option>
                  {events.map(ev => (
                    <option key={ev.id} value={ev.id}>{ev.title}</option>
                  ))}
                </select>
                <ChevronDown size={18} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text-muted)' }}/>
              </div>
            </div>

            {/* Scanner */}
            <div className="card overflow-hidden">
              {!selectedEventId && (
                <div className="absolute inset-0 z-10 bg-black/70 backdrop-blur-sm flex items-center justify-center rounded-2xl">
                  <p className="text-white font-bold text-center px-6">Sélectionnez un événement pour activer le scanner</p>
                </div>
              )}
              <div className="relative">
                <p className="text-center text-sm font-medium py-3 border-b" style={{ color: 'var(--text-secondary)', borderColor: 'var(--border)' }}>
                  Pointez la caméra vers le QR code
                </p>
                <div className="overflow-hidden" style={{ borderRadius: '0 0 1.25rem 1.25rem' }}>
                  <QRScanner onScanSuccess={handleScan} isActive={scanState === "idle"} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── SUCCESS ── */}
      {scanState === "success" && (
        <div className="fixed inset-0 flex flex-col items-center justify-center z-50 text-white" style={{ backgroundColor: '#19C3B1' }}>
          <div className="text-center space-y-4 animate-fade-in-up">
            <div className="w-24 h-24 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-4">
              <span className="text-5xl">✓</span>
            </div>
            <h1 className="text-5xl font-extrabold tracking-tight">ACCÈS AUTORISÉ</h1>
            <p className="text-xl font-medium opacity-90">{message}</p>
          </div>
        </div>
      )}

      {/* ── ERROR ── */}
      {scanState === "error" && (
        <div className="fixed inset-0 flex flex-col items-center justify-center z-50 text-white bg-passi-corail">
          <div className="text-center space-y-4 animate-fade-in-up">
            <div className="w-24 h-24 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-4">
              <span className="text-5xl">✕</span>
            </div>
            <h1 className="text-5xl font-extrabold tracking-tight">ACCÈS REFUSÉ</h1>
            <p className="text-xl font-medium opacity-90">{message}</p>
          </div>
        </div>
      )}
    </>
  );
}
