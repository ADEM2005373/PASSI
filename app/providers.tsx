"use client"

import { ThemeProvider } from "next-themes"
import { AuthProvider } from "@/lib/context/auth-context"
import { SimulationProvider } from "@/lib/context/simulation-context"
import { GlobalNav } from "@/components/GlobalNav"

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <AuthProvider>
        <SimulationProvider>
          <GlobalNav />
          {children}
        </SimulationProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}
