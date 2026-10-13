"use client"

import { useSimulation } from "@/lib/context/simulation-context"

export function ImpersonationBanner() {
  const { isSimulating, simulatedRole, stopSimulation } = useSimulation()

  if (!isSimulating) return null

  const roleLabel = simulatedRole ? simulatedRole.toUpperCase() : "SIMULATION"

  return (
    <div
      id="impersonation-banner"
      className="fixed top-0 left-0 right-0 bg-gradient-to-r from-red-600 to-amber-600 text-white text-xs text-center py-1.5 z-[9999] font-bold cursor-pointer hover:opacity-95 transition-opacity shadow-md flex items-center justify-center gap-2"
      onClick={() => stopSimulation()}
      title="Cliquez pour quitter le mode simulation"
    >
      <span className="bg-white/20 px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wider">{roleLabel}</span>
      <span>Vous êtes en mode simulation. Cliquez ici pour retourner au panneau Administrateur.</span>
    </div>
  )
}
