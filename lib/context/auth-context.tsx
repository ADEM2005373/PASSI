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

  const fetchProfile = useCallback(async (authUser: User | any) => {
    const supabase = createClient()
    
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
      // Profile row not yet created
      await supabase.from("profiles").upsert({
        id: authUser.id,
        email: authUser.email ?? "",
        instagram_handle: null,
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
    let mounted = true;
    const supabase = createClient()

    // Initial load - use getSession to avoid network request if possible
    const loadUser = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        if (mounted) await fetchProfile(session.user)
      } else {
        if (mounted) {
          setUser(null)
          setIsLoading(false)
          setIsInitializing(false)
        }
      }
    }
    
    loadUser()

    // React to Supabase auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event: any, session: any) => {
      if (event === "SIGNED_OUT") {
        setUser(null)
        setIsLoading(false)
        setIsInitializing(false)
      } else if (
        event === "SIGNED_IN" ||
        event === "TOKEN_REFRESHED" ||
        event === "USER_UPDATED"
      ) {
        if (session?.user) {
          fetchProfile(session.user)
        }
      }
    })

    return () => {
      mounted = false;
      subscription.unsubscribe()
    }
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
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.user) {
      await fetchProfile(session.user)
    } else {
      setUser(null)
      setIsLoading(false)
    }
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
