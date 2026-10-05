"use client"

import { useEffect, useState } from "react"

export function ImpersonationBanner() {
  const [impersonating, setImpersonating] = useState(false)

  useEffect(() => {
    if (typeof document !== 'undefined') {
      const match = document.cookie.match(/(?:^|; )passi_impersonate_role=([^;]*)/)
      if (match && match[1]) {
        setImpersonating(true)
      }
    }
  }, [])

  if (!impersonating) return null

  const clearImpersonation = () => {
    document.cookie = "passi_impersonate_role=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT"
    window.location.href = "/admin"
  }

  return (
    <div className="fixed top-0 left-0 right-0 bg-red-600 text-white text-xs text-center py-1 z-[9999] font-bold cursor-pointer hover:bg-red-700 transition-colors" onClick={clearImpersonation}>
      Vous êtes en mode simulation. Cliquez ici pour retourner à votre compte Admin.
    </div>
  )
}
