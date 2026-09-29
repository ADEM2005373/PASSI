"use client"

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import type { User } from "@/lib/services/api"

type AuthContextValue = {
  user: User | null
  isLoading: boolean
  /** True while the initial session check is in flight */
  isInitializing: boolean
  logout: () => Promise<void>
  /** Refresh the in-memory user (e.g. after completing the profile) */
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  isLoading: true,
  isInitializing: true,
  logout: async () => {},
  refreshUser: async () => {},
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isInitializing, setIsInitializing] = useState(true)
  const router = useRouter()

  const fetchProfile = useCallback(async () => {
    const supabase = createClient()
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser()

    if (!authUser) {
      setUser(null)
      setIsLoading(false)
      setIsInitializing(false)
      return
    }

    // Try to find the profile row
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", authUser.id)
      .maybeSingle()

    if (!profile) {
      // Profile row not yet created (race condition between callback and provider
      // redirect). Create it now as a safety net with data from OAuth metadata.
      const meta = authUser.user_metadata ?? {}
      const rawHandle: string =
        meta.user_name || meta.preferred_username || meta.full_name || ""
      const instagramHandle: string | null =
        rawHandle && !rawHandle.includes(" ")
          ? rawHandle.startsWith("@")
            ? rawHandle
            : `@${rawHandle}`
          : null

      await supabase.from("profiles").upsert({
        id: authUser.id,
        email: authUser.email ?? "",
        instagram_handle: instagramHandle,
        role: "user",
      })

      const { data: newProfile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", authUser.id)
        .maybeSingle()

      setUser(newProfile ?? null)
    } else {
      setUser(profile as User)
    }

    setIsLoading(false)
    setIsInitializing(false)
  }, [])

  useEffect(() => {
    // Initial load
    fetchProfile()

    // React to Supabase auth state changes
    const supabase = createClient()
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event: any) => {
      if (event === "SIGNED_OUT") {
        setUser(null)
        setIsLoading(false)
        setIsInitializing(false)
      } else if (
        event === "SIGNED_IN" ||
        event === "TOKEN_REFRESHED" ||
        event === "USER_UPDATED"
      ) {
        fetchProfile()
      }
    })

    return () => subscription.unsubscribe()
  }, [fetchProfile])

  const logout = useCallback(async () => {
    const isStaff = user?.role === 'admin' || user?.role === 'security' || user?.role === 'barman'
    const supabase = createClient()
    await supabase.auth.signOut()
    setUser(null)
    router.replace(isStaff ? "/staff/login" : "/login")
    router.refresh()
  }, [router, user])

  const refreshUser = useCallback(async () => {
    setIsLoading(true)
    await fetchProfile()
  }, [fetchProfile])

  return (
    <AuthContext.Provider
      value={{ user, isLoading, isInitializing, logout, refreshUser }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
