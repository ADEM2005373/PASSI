'use client'

import { useState, useEffect } from 'react'
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
  const supabase = createClient()

  useEffect(() => {
    setMounted(true)
    const init = async () => {
      const user = await api.getCurrentUser()
      if (!user || (user.role !== 'barman' && user.role !== 'admin')) {
        router.push("/login")
        return
      }
      setIsBarman(true)
    }
    init()
  }, [router])

  const handleScan = async (decodedUuid: string) => {
    if (scanResult !== null) return
    try {
      const res = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qrUuid: decodedUuid, type: 'drink' })
      })
      const result = await res.json()
      if (result.success) {
        setScanResult('success')
        setMessage(result.message)
        setDrinkDetails(result.drinkDetails)
      } else {
        setScanResult('error')
        setMessage(result.message)
      }
    } catch {
      setScanResult('error')
      setMessage('Erreur API')
    }
  }

  const resetScanner = () => {
    setScanResult(null)
    setMessage('')
    setDrinkDetails(null)
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
          className="fixed inset-0 flex flex-col items-center justify-center p-8 z-50 text-white cursor-pointer"
          style={{ backgroundColor: '#19C3B1' }}
          onClick={resetScanner}
        >
          <div className="text-center space-y-4 animate-fade-in-up">
            <div className="w-28 h-28 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-2">
              <Wine size={52}/>
            </div>
            <h1 className="text-5xl font-extrabold tracking-tight uppercase">{message}</h1>
            {drinkDetails && (
              <h2 className="text-3xl font-bold opacity-90">{drinkDetails}</h2>
            )}
            <p className="text-base opacity-70 mt-10">(Appuyez pour scanner la prochaine boisson)</p>
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
