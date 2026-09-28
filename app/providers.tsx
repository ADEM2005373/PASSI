"use client"

import { ThemeProvider } from "next-themes"
import { AuthProvider } from "@/lib/context/auth-context"
import { GlobalNav } from "@/components/GlobalNav"

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <AuthProvider>
        <GlobalNav />
        {children}
      </AuthProvider>
    </ThemeProvider>
  )
}
