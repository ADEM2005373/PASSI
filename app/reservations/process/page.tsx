'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Ticket, Sparkles } from 'lucide-react';

export default function ProcessReservationPage() {
  const router = useRouter();
  const [statusMessage, setStatusMessage] = useState('Finalisation de votre pass en cours...');
  const hasProcessed = useRef(false);

  useEffect(() => {
    if (hasProcessed.current) return;
    hasProcessed.current = true;

    const processPendingReservation = async () => {
      if (typeof window === 'undefined') return;

      const pending = localStorage.getItem('pending_reservation');
      if (!pending) {
        router.push('/reservations');
        return;
      }

      try {
        const { eventId, drinkName, aromas, promoCode } = JSON.parse(pending);

        setStatusMessage('Validation de votre sélection de boisson...');

        // Automatically submit the pass request to the backend API
        const response = await fetch('/api/passes/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ eventId, drinkName, aromas, promoCode }),
        });

        if (response.ok) {
          localStorage.removeItem('pending_reservation');
          setStatusMessage('Pass réservé avec succès ! Redirection en cours...');
        } else {
          const errData = await response.json().catch(() => ({}));
          console.warn('[ProcessReservation] Submission response not OK:', errData);
          // Clear if already booked to avoid infinite loop
          if (errData?.error && (errData.error.includes('atteinte') || errData.error.includes('limite'))) {
            localStorage.removeItem('pending_reservation');
          }
        }
      } catch (error) {
        console.error('Auto-reservation error:', error);
      } finally {
        // Smooth transition directly to "Mes réservations"
        setTimeout(() => {
          router.push('/reservations');
        }, 500);
      }
    };

    processPendingReservation();
  }, [router]);

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white px-6 relative overflow-hidden">
      {/* Background ambient glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-purple-600/15 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute top-1/3 left-1/3 w-72 h-72 bg-passi-corail/10 rounded-full blur-[100px] pointer-events-none" />

      <div className="relative z-10 flex flex-col items-center text-center max-w-sm space-y-6">
        <div className="relative">
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-purple-600 to-pink-600 flex items-center justify-center shadow-2xl shadow-purple-900/40 animate-pulse">
            <Ticket className="w-10 h-10 text-white" />
          </div>
          <div className="absolute -bottom-1 -right-1 bg-amber-400 text-slate-950 p-1.5 rounded-full shadow-md animate-bounce">
            <Sparkles size={14} />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-center gap-2">
            <div className="animate-spin rounded-full h-5 w-5 border-2 border-purple-500 border-t-transparent" />
            <h2 className="text-xl font-bold tracking-tight text-white">{statusMessage}</h2>
          </div>
          <p className="text-sm text-slate-400 leading-relaxed">
            Vous y êtes presque ! Redirection vers vos réservations.
          </p>
        </div>

        <div className="w-48 h-1.5 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
          <div className="h-full bg-gradient-to-r from-purple-500 via-pink-500 to-passi-corail animate-pulse w-full" />
        </div>
      </div>
    </div>
  );
}
