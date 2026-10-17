"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { AlertCircle, CheckCircle2, Lock, ArrowRight, Sparkles } from "lucide-react"

export default function OnboardingPage() {
  const router = useRouter()
  const [handle, setHandle] = useState("")
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [error, setError] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [loadingUser, setLoadingUser] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    async function checkAuth() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        router.replace("/login")
        return
      }

      setUserId(user.id)

      // Récupérer le profil existant
      const { data: profile } = await supabase
        .from("profiles")
        .select("instagram_handle, role, full_name, first_name, last_name")
        .eq("id", user.id)
        .maybeSingle()

      const isSimulating = typeof document !== 'undefined' && document.cookie.includes('passi_impersonate_role')
      const isAdminRole = (profile?.role || '').toLowerCase() === "admin"

      if (isAdminRole && !isSimulating) {
        router.replace("/admin")
        return
      }

      // Pré-remplir les champs s'ils existent déjà
      const meta = user.user_metadata || {}
      const existingFirst = profile?.first_name || meta.first_name || (profile?.full_name ? profile.full_name.split(' ')[0] : "")
      const existingLast = profile?.last_name || meta.last_name || (profile?.full_name && profile.full_name.split(' ').length > 1 ? profile.full_name.split(' ').slice(1).join(' ') : "")
      if (existingFirst) setFirstName(existingFirst)
      if (existingLast) setLastName(existingLast)
      if (profile?.instagram_handle) setHandle(profile.instagram_handle)

      // Si le profil a déjà un instagram_handle ET un nom complet, rediriger vers le dashboard
      const hasName = Boolean(existingFirst && existingLast)
      const hasInstagram = Boolean(profile?.instagram_handle && profile.instagram_handle.trim().length > 0)

      if (isSimulating || (hasInstagram && hasName)) {
        router.replace("/dashboard")
        return
      }

      setLoadingUser(false)
    }

    checkAuth()
  }, [router])

  const validateInput = (value: string): { isValid: boolean; formatted: string; errorMsg?: string } => {
    const raw = value.trim()
    if (!raw) {
      return { isValid: false, formatted: "", errorMsg: "Veuillez renseigner votre profil ou lien Instagram." }
    }

    // Accepte soit @pseudo, soit pseudo, soit https://instagram.com/pseudo
    let cleanHandle = raw
    if (cleanHandle.startsWith("@")) {
      cleanHandle = cleanHandle.substring(1)
    }

    if (cleanHandle.startsWith("http://") || cleanHandle.startsWith("https://")) {
      const match = cleanHandle.match(/instagram\.com\/([a-zA-Z0-9_.]{1,30})/)
      if (match && match[1]) {
        return { isValid: true, formatted: `https://instagram.com/${match[1]}` }
      }
      return { isValid: false, formatted: "", errorMsg: "Format de lien invalide (ex: https://instagram.com/pseudo)." }
    }

    // Validation du pseudo seul (caractères alphanumériques, points, tirets bas, max 30 caractères)
    if (/^[a-zA-Z0-9_.]{1,30}$/.test(cleanHandle)) {
      return { isValid: true, formatted: `https://instagram.com/${cleanHandle}` }
    }

    return { isValid: false, formatted: "", errorMsg: "Nom d'utilisateur Instagram invalide." }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    const cleanFirst = firstName.trim()
    const cleanLast = lastName.trim()

    if (!cleanFirst) {
      setError("Le prénom est obligatoire.")
      return
    }

    if (!cleanLast) {
      setError("Le nom de famille est obligatoire.")
      return
    }

    const { isValid, formatted, errorMsg } = validateInput(handle)
    if (!isValid || !userId) {
      setError(errorMsg || "Saisie Instagram invalide.")
      return
    }

    setIsSubmitting(true)
    const supabase = createClient()
    const resolvedFullName = `${cleanFirst} ${cleanLast}`

    let hasSucceeded = false
    let failureMsg = ""

    // 1. Essai de mise à jour directe via client
    const updatePayload: Record<string, any> = {
      instagram_handle: formatted,
      full_name: resolvedFullName,
      first_name: cleanFirst,
      last_name: cleanLast,
    }

    let { error: updateError } = await supabase
      .from("profiles")
      .update(updatePayload)
      .eq("id", userId)

    if (updateError && (updateError.message?.includes('first_name') || updateError.message?.includes('last_name'))) {
      delete updatePayload.first_name
      delete updatePayload.last_name
      const retryRes = await supabase.from("profiles").update(updatePayload).eq("id", userId)
      updateError = retryRes.error
    }

    if (!updateError) {
      hasSucceeded = true
    } else {
      console.warn("Client-side profile update failed, trying server API:", updateError)
    }

    // 2. Toujours notifier/synchroniser via l'API serveur robuste
    try {
      const apiRes = await fetch("/api/user/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          firstName: cleanFirst,
          lastName: cleanLast,
          fullName: resolvedFullName,
          instagramHandle: formatted,
          instagramUrl: formatted,
        }),
      })
      if (apiRes.ok) {
        hasSucceeded = true
      } else if (!hasSucceeded) {
        const apiData = await apiRes.json().catch(() => ({}))
        failureMsg = apiData.error || "Erreur serveur"
      }
    } catch (apiErr: any) {
      console.error("API fallback failed:", apiErr)
      if (!hasSucceeded) {
        failureMsg = apiErr?.message || "Erreur de connexion"
      }
    }

    if (!hasSucceeded) {
      setError(failureMsg || "Erreur lors de l'enregistrement. Veuillez réessayer.")
      setIsSubmitting(false)
      return
    }

    setIsSuccess(true)
    // Redirection immédiate vers le Dashboard
    setTimeout(() => {
      window.location.href = "/dashboard"
    }, 600)
  }

  if (loadingUser) {
    return (
      <div className="min-h-screen bg-[#0B0F19] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-passi-corail/20 border-t-passi-corail rounded-full animate-spin" />
          <p className="text-gray-400 text-sm font-medium">Chargement de votre compte...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0B0F19] text-white flex flex-col justify-center items-center px-4 py-12 relative overflow-hidden selection:bg-passi-corail/30">
      {/* Background Glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-gradient-to-tr from-[#E1306C]/15 to-[#F77737]/15 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute -bottom-20 -right-20 w-80 h-80 bg-passi-turquoise/10 rounded-full blur-[100px] pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        {/* Card Container */}
        <div className="bg-[#121826]/90 border border-gray-800/80 rounded-[2.5rem] shadow-2xl backdrop-blur-xl overflow-hidden p-8 sm:p-10">
          {/* Header Strip */}
          <div className="h-1.5 w-full bg-gradient-to-r from-[#F58529] via-[#DD2A7B] to-[#8134AF] -mx-10 -mt-10 mb-8" />

          {/* Icon Badge */}
          <div className="flex flex-col items-center text-center space-y-4 mb-8">
            <div className="relative">
              <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-[#F58529] via-[#DD2A7B] to-[#8134AF] flex items-center justify-center shadow-lg shadow-[#DD2A7B]/20">
                <svg width={36} height={36} viewBox="0 0 24 24" fill="white" aria-hidden>
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
                </svg>
              </div>
              <div className="absolute -bottom-1 -right-1 bg-passi-corail text-white p-1 rounded-full shadow-md">
                <Sparkles size={14} />
              </div>
            </div>

            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
                Finalisez votre profil
              </h1>
              <p className="text-gray-400 text-sm mt-2 max-w-xs mx-auto leading-relaxed">
                Renseignez votre compte Instagram pour valider vos pass lors des entrées.
              </p>
            </div>
          </div>

          {/* Information Notice */}
          <div className="flex items-start gap-3 p-4 rounded-2xl bg-white/[0.03] border border-gray-800 mb-6">
            <Lock size={18} className="text-passi-corail shrink-0 mt-0.5" />
            <p className="text-xs text-gray-400 leading-relaxed">
              Votre identifiant Instagram est utilisé uniquement par les organisateurs pour confirmer votre identité lors des événements Passi.
            </p>
          </div>

          {/* Form */}
          {isSuccess ? (
            <div className="flex flex-col items-center justify-center py-6 text-center space-y-3">
              <CheckCircle2 className="w-14 h-14 text-green-400 animate-bounce" />
              <p className="text-lg font-bold text-white">Profil validé avec succès !</p>
              <p className="text-sm text-gray-400">Redirection vers votre espace...</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="first-name" className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1.5">
                    Prénom *
                  </label>
                  <input
                    id="first-name"
                    type="text"
                    required
                    placeholder="Ex: Adem"
                    value={firstName}
                    onChange={(e) => {
                      setFirstName(e.target.value)
                      if (error) setError("")
                    }}
                    className="w-full px-4 py-3 rounded-2xl bg-[#090D16] border border-gray-700/80 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-passi-corail focus:ring-2 focus:ring-passi-corail/20 transition-all duration-200"
                  />
                </div>
                <div>
                  <label htmlFor="last-name" className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1.5">
                    Nom *
                  </label>
                  <input
                    id="last-name"
                    type="text"
                    required
                    placeholder="Ex: Ouerhani"
                    value={lastName}
                    onChange={(e) => {
                      setLastName(e.target.value)
                      if (error) setError("")
                    }}
                    className="w-full px-4 py-3 rounded-2xl bg-[#090D16] border border-gray-700/80 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-passi-corail focus:ring-2 focus:ring-passi-corail/20 transition-all duration-200"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="instagram-handle" className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1.5">
                  Profil Instagram *
                </label>
                <div className="relative">
                  <input
                    id="instagram-handle"
                    type="text"
                    required
                    placeholder="https://instagram.com/username ou @pseudo"
                    value={handle}
                    onChange={(e) => {
                      setHandle(e.target.value)
                      if (error) setError("")
                    }}
                    className="w-full px-4 py-3 rounded-2xl bg-[#090D16] border border-gray-700/80 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-passi-corail focus:ring-2 focus:ring-passi-corail/20 transition-all duration-200"
                  />
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-medium animate-shake">
                  <AlertCircle size={16} className="shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-4 rounded-2xl font-bold text-sm bg-gradient-to-r from-passi-corail to-[#F58529] text-white hover:opacity-95 active:scale-[0.98] transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-passi-corail/25 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                    <span>Enregistrement...</span>
                  </>
                ) : (
                  <>
                    <span>Accéder à mon espace</span>
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </form>
          )}
        </div>

        {/* Footer info */}
        <p className="text-center text-xs text-gray-500 mt-6 font-medium">
          Passi · Billetterie événementielle nouvelle génération
        </p>
      </div>
    </div>
  )
}
