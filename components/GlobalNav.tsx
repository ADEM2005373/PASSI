"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Home,
  LayoutDashboard,
  ShieldCheck,
  Wine,
  LogOut,
  Menu,
  X,
} from "lucide-react"
import { useState } from "react"
import { useAuth } from "@/lib/context/auth-context"
import { Logo } from "@/components/Logo"

type NavLink = {
  href: string
  label: string
  icon: React.ReactNode
  roles: string[] // empty = all authenticated roles
}

const NAV_LINKS: NavLink[] = [
  {
    href: "/dashboard",
    label: "Mon Espace",
    icon: <Home size={20} />,
    roles: ["user"],
  },
  {
    href: "/admin",
    label: "Administration",
    icon: <LayoutDashboard size={20} />,
    roles: ["admin"],
  },
  {
    href: "/scanner/security",
    label: "Scanner Entrée",
    icon: <ShieldCheck size={20} />,
    roles: ["admin", "security"],
  },
  {
    href: "/scanner/barman",
    label: "Scanner Bar",
    icon: <Wine size={20} />,
    roles: ["admin", "barman"],
  },
]

export function GlobalNav() {
  const { user, logout } = useAuth()
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)

  // Don't render nav on public pages or pages with their own embedded nav
  const EXCLUDED_PATHS = ["/dashboard", "/admin", "/scanner"]
  const isExcluded = pathname === "/" || EXCLUDED_PATHS.some((p) => pathname?.startsWith(p))
  if (!user || isExcluded) return null

  const role = user.role
  const visibleLinks = NAV_LINKS.filter(
    (link) => link.roles.length === 0 || link.roles.includes(role)
  )

  const isActive = (href: string) => pathname?.startsWith(href)

  return (
    <>
      {/* ── Desktop top navbar ─────────────────────────────────────────── */}
      <nav className="hidden md:flex fixed top-0 left-0 right-0 z-50 h-16 bg-passi-bleu/95 backdrop-blur-md border-b border-white/10 items-center px-8 gap-6">
        <Link href="/" className="mr-4 flex-shrink-0">
          <Logo variant="dark" className="w-[100px] h-[30px]" />
        </Link>

        <div className="flex items-center gap-2 flex-1">
          {visibleLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all duration-200 ${
                isActive(link.href)
                  ? "bg-passi-corail text-white shadow-lg shadow-passi-corail/30"
                  : "text-white/60 hover:text-white hover:bg-white/10"
              }`}
            >
              {link.icon}
              {link.label}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-4">
          <span className="text-xs font-semibold text-white/40 uppercase tracking-widest">
            {role}
          </span>
          <button
            onClick={logout}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white/60 hover:text-passi-corail hover:bg-white/10 transition-all duration-200"
            aria-label="Se déconnecter"
          >
            <LogOut size={18} />
            <span>Déconnexion</span>
          </button>
        </div>
      </nav>

      {/* ── Mobile hamburger header ─────────────────────────────────────── */}
      <header className="md:hidden fixed top-0 left-0 right-0 z-50 h-16 bg-passi-bleu/95 backdrop-blur-md border-b border-white/10 flex items-center justify-between px-5">
        <Link href="/">
          <Logo variant="dark" className="w-[90px] h-[26px]" />
        </Link>
        <button
          onClick={() => setMobileOpen((v) => !v)}
          className="p-2 rounded-xl bg-white/10 text-white"
          aria-label="Menu"
        >
          {mobileOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </header>

      {/* ── Mobile slide-in drawer ──────────────────────────────────────── */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
        >
          <div
            className="absolute top-16 left-0 right-0 bg-passi-bleu border-b border-white/10 p-6 flex flex-col gap-3"
            onClick={(e) => e.stopPropagation()}
          >
            {visibleLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 px-5 py-3.5 rounded-2xl text-sm font-bold transition-all duration-200 ${
                  isActive(link.href)
                    ? "bg-passi-corail text-white shadow-lg shadow-passi-corail/30"
                    : "text-white/70 hover:text-white hover:bg-white/10"
                }`}
              >
                {link.icon}
                {link.label}
              </Link>
            ))}

            <div className="h-px bg-white/10 my-1" />

            <button
              onClick={() => {
                setMobileOpen(false)
                logout()
              }}
              className="flex items-center gap-3 px-5 py-3.5 rounded-2xl text-sm font-bold text-passi-corail hover:bg-white/10 transition-all duration-200 w-full text-left"
              aria-label="Se déconnecter"
            >
              <LogOut size={20} />
              Se déconnecter
            </button>
          </div>
        </div>
      )}
      {/* Spacer to push page content below the fixed nav */}
      <div className="h-16" aria-hidden="true" />
    </>
  )
}
