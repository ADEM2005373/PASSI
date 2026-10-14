'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import QRScanner from '@/components/QRScanner'
import { useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import { api } from '@/lib/services/api'
import { useAuth } from '@/lib/context/auth-context'
import { Logo } from '@/components/Logo'
import { Sun, Moon, LogOut, Wine } from 'lucide-react'

export default function BarmanScannerPage() {
  const router = useRouter()
  const { logout: contextLogout } = useAuth()
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [isBarman, setIsBarman] = useState(false)
  const [scanResult, setScanResult] = useState<'success' | 'error' | null>(null)
  const [message, setMessage] = useState('')
  const [drinkDetails, setDrinkDetails] = useState<string | null>(null)
  const [selectedAromas, setSelectedAromas] = useState<string[]>([])
  const [guestName, setGuestName] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    setMounted(true)
    const init = async () => {
      const user = await api.getCurrentUser()
      const userRole = (user?.role || '').toLowerCase()
      const origRole = (user?.original_role || '').toLowerCase()
      const isAllowed = userRole === 'barman' || userRole === 'admin' || origRole === 'admin'

      if (!user || !isAllowed) {
        router.replace("/login")
        return
      }
      setIsBarman(true)
    }
    init()
  }, [router])

  const isProcessingRef = useRef(false)

  const handleScan = async (decodedUuid: string) => {
    if (isProcessingRef.current) return
    isProcessingRef.current = true
    
    try {
      const res = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qrUuid: decodedUuid, type: 'drink' })
      })
      const result = await res.json()
      if (result.success) {
        setScanResult('success')
        setMessage(result.message || 'BOISSON VALIDÉE')
        setDrinkDetails(result.drink_name || result.drinkDetails || 'Boisson')
        setSelectedAromas(result.selected_aromas || result.pass?.selected_aromas || [])
        setGuestName(result.guest_name || result.pass?.guest_name || null)
      } else {
        setScanResult('error')
        setMessage(result.message)
      }
      
      // Auto close after 5 seconds to give the barman plenty of time to view aromas
      setTimeout(() => {
        resetScanner()
      }, 5000)
      
    } catch {
      setScanResult('error')
      setMessage('Erreur API')
      setTimeout(() => {
        resetScanner()
      }, 3000)
    }
  }

  const resetScanner = () => {
    setScanResult(null)
    setMessage('')
    setDrinkDetails(null)
    setSelectedAromas([])
    setGuestName(null)
    // 500ms debounce to prevent immediate rescan of the exact same code
    setTimeout(() => {
      isProcessingRef.current = false
    }, 500)
  }

  if (!isBarman) return null

  return (
    <>
      {/* ── IDLE VIEW ── */}
      <div style={{ display: scanResult === null ? 'block' : 'none' }} className="min-h-screen" >
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
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ backgroundColor: 'var(--bg-input)' }}>
                <Wine size={24} className="text-passi-turquoise"/>
              </div>
              <div>
                <h1 className="text-xl font-extrabold" style={{ color: 'var(--text-primary)' }}>Scanner Barman</h1>
                <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Validation des consommations</p>
              </div>
            </div>

            {/* Scanner */}
            <div className="card overflow-hidden">
              <p className="text-center text-sm font-medium py-3 border-b" style={{ color: 'var(--text-secondary)', borderColor: 'var(--border)' }}>
                Pointez la caméra vers le QR code boisson
              </p>
              <div style={{ borderRadius: '0 0 1.25rem 1.25rem', overflow: 'hidden' }}>
                <QRScanner onScanSuccess={handleScan} isActive={scanResult === null} />
              </div>
            </div>

            <p className="text-xs text-center font-medium" style={{ color: 'var(--text-muted)' }}>
              Chaque QR code de boisson ne peut être scanné qu'une seule fois.
            </p>
          </div>
        </div>
      </div>

      {/* ── SUCCESS ── */}
      {scanResult === 'success' && (
        <div
          className="fixed inset-0 flex flex-col items-center justify-center p-6 z-50 text-white cursor-pointer bg-slate-950/95 backdrop-blur-md"
          onClick={resetScanner}
        >
          <div className="w-full max-w-md mx-auto text-center space-y-4 animate-fade-in-up bg-slate-900 border-2 border-emerald-500/40 rounded-3xl p-6 shadow-2xl shadow-emerald-500/20">
            <div className="w-20 h-20 rounded-full bg-emerald-500/20 border-2 border-emerald-500 text-emerald-400 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/30">
              <Wine size={42} />
            </div>

            <div>
              <span className="inline-block px-3 py-1 bg-emerald-500/20 text-emerald-300 font-bold text-xs uppercase tracking-wider rounded-full mb-1">
                ✓ Consommation Validée
              </span>
              <h1 className="text-2xl font-black tracking-tight uppercase text-white">{message}</h1>
              {guestName && (
                <p className="text-xs font-semibold text-slate-400 mt-1">
                  Titulaire : <span className="text-white font-bold">{guestName}</span>
                </p>
              )}
            </div>

            {/* Drink & Aromas Card */}
            <div className="p-4 bg-slate-800/90 rounded-2xl border border-slate-700/80 text-left shadow-lg">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Boisson à servir</span>
                <span className="text-xs bg-emerald-500/20 text-emerald-300 font-semibold px-2 py-0.5 rounded">1x Verre</span>
              </div>
              <p className="text-xl font-black text-white">Boisson : {drinkDetails || 'Boisson'}</p>

              {/* New Aromas Display */}
              {selectedAromas && selectedAromas.length > 0 ? (
                <div className="mt-3 pt-3 border-t border-slate-700/60">
                  <p className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                    <span>✨</span> Arômes choisis :
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {selectedAromas.map((aroma, idx) => (
                      <span
                        key={idx}
                        className="bg-amber-400/20 text-amber-300 border border-amber-400/30 px-2.5 py-1 rounded-lg text-sm font-extrabold shadow-sm"
                      >
                        {aroma}
                      </span>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="mt-2 pt-2 border-t border-slate-700/40">
                  <p className="text-xs text-slate-400 italic">
                    Recette standard (aucun arôme spécifique sélectionné)
                  </p>
                </div>
              )}
            </div>

            <p className="text-xs text-slate-400 font-medium pt-2">
              (Touchez l'écran pour scanner la prochaine boisson)
            </p>
          </div>
        </div>
      )}

      {/* ── ERROR ── */}
      {scanResult === 'error' && (
        <div
          className="fixed inset-0 flex flex-col items-center justify-center p-8 z-50 text-white cursor-pointer bg-passi-corail"
          onClick={resetScanner}
        >
          <div className="text-center space-y-4 animate-fade-in-up">
            <div className="w-28 h-28 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-2">
              <span className="text-5xl">✕</span>
            </div>
            <h1 className="text-5xl font-extrabold tracking-tight uppercase">{message}</h1>
            <p className="text-base opacity-70 mt-10">(Appuyez pour scanner la prochaine boisson)</p>
          </div>
        </div>
      )}
    </>
  )
}
