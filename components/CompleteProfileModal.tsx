"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { AlertCircle, CheckCircle2, Lock } from "lucide-react"

function InstagramCameraIcon({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="white" aria-hidden>
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
    </svg>
  )
}

type Props = {
  userId: string
  /** Called after the profile is successfully saved so the parent can refresh. */
  onComplete: (handle: string) => void
}

/**
 * CompleteProfileModal
 *
 * Displayed as a full-screen overlay whenever a logged-in user has a
 * null `instagram_handle` in their profile (e.g. after a Google login).
 * The user cannot dismiss this modal — they must provide their handle
 * before accessing the dashboard.
 */
export function CompleteProfileModal({ userId, onComplete }: Props) {
  const [handle, setHandle] = useState("")
  const [error, setError] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [done, setDone] = useState(false)

  const validate = (value: string): string => {
    if (!value.trim()) return "Le pseudo Instagram est requis."
    const clean = value.startsWith("@") ? value.slice(1) : value
    if (clean.length < 1) return "Le pseudo Instagram est requis."
    // Instagram allows letters, numbers, underscores and periods
    if (!/^[a-zA-Z0-9_.]{1,30}$/.test(clean))
      return "Pseudo invalide. Utilisez uniquement des lettres, chiffres, _ ou ."
    return ""
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const validation = validate(handle)
    if (validation) { setError(validation); return }

    setError("")
    setIsSaving(true)

    const normalised = handle.trim().startsWith("@")
      ? handle.trim()
      : `@${handle.trim()}`

    const supabase = createClient()
    const { error: dbError } = await supabase
      .from("profiles")
      .update({ instagram_handle: normalised })
      .eq("id", userId)

    if (dbError) {
      setError("Impossible d'enregistrer. Réessayez.")
      setIsSaving(false)
      return
    }

    setDone(true)
    // Short pause to show success before dismissing
    setTimeout(() => onComplete(normalised), 900)
  }

  return (
    /* Full-screen, non-dismissable overlay */
    <div
      className="fixed inset-0 z-[999] flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)" }}
    >
      <div
        className="w-full max-w-md rounded-[2rem] shadow-2xl overflow-hidden"
        style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}
      >
        {/* Header accent strip */}
        <div className="h-1.5 bg-gradient-to-r from-passi-corail via-[#F58529] to-[#DD2A7B]" />

        <div className="p-8 space-y-6">
          {/* Icon + headline */}
          <div className="flex flex-col items-center text-center space-y-3">
            <div className="w-16 h-16 rounded-[1.5rem] bg-gradient-to-br from-[#F58529] via-[#DD2A7B] to-[#8134AF] flex items-center justify-center shadow-lg">
              <InstagramCameraIcon size={30} />
            </div>
            <div>
              <h2
                className="text-2xl font-extrabold"
                style={{ color: "var(--text-primary)" }}
              >
                Une dernière étape
              </h2>
              <p
                className="text-sm font-medium mt-1 max-w-xs mx-auto leading-relaxed"
                style={{ color: "var(--text-secondary)" }}
              >
                Votre pseudo Instagram est requis pour valider votre identité
                lors des événements.
              </p>
            </div>
          </div>

          {/* Why we need it */}
          <div
            className="flex items-start gap-3 p-4 rounded-xl"
            style={{ backgroundColor: "var(--bg-input)", border: "1px solid var(--border)" }}
          >
            <Lock size={18} className="text-passi-turquoise flex-shrink-0 mt-0.5" />
            <p
              className="text-xs font-medium leading-relaxed"
              style={{ color: "var(--text-secondary)" }}
            >
              Nous utilisons votre compte Instagram uniquement pour confirmer
              votre identité lors de l'approbation de votre pass. Nous ne
              postez rien en votre nom.
            </p>
          </div>

          {/* Form */}
          {done ? (
            <div className="flex flex-col items-center gap-3 py-4">
              <CheckCircle2 size={48} className="text-passi-turquoise" />
              <p
                className="font-bold text-center"
                style={{ color: "var(--text-primary)" }}
              >
                Profil complété ! Chargement…
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="ig-handle" className="label">
                  Pseudo Instagram
                </label>
                <div className="relative">
                  <span
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold"
                    style={{ color: "var(--text-muted)" }}
                  >
                    @
                  </span>
                  <input
                    id="ig-handle"
                    type="text"
                    autoComplete="username"
                    autoFocus
                    value={handle.startsWith("@") ? handle.slice(1) : handle}
                    onChange={(e) => {
                      setError("")
                      setHandle(e.target.value)
                    }}
                    className="input"
                    style={{ paddingLeft: "2.5rem" }}
                    placeholder="votre_pseudo"
                    maxLength={31}
                  />
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-passi-corail/10 border border-passi-corail/20">
                  <AlertCircle size={15} className="text-passi-corail flex-shrink-0" />
                  <span className="text-passi-corail text-sm font-semibold">
                    {error}
                  </span>
                </div>
              )}

              <button
                type="submit"
                disabled={isSaving}
                className="btn-primary w-full flex items-center justify-center gap-2"
              >
                {isSaving ? (
                  <>
                    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Enregistrement…
                  </>
                ) : (
                  "Confirmer et accéder à mon espace"
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
