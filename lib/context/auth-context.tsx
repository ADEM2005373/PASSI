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
      // Profile row not yet created: populate from user_metadata
      const meta = authUser.user_metadata || {};
      const fullName = meta.full_name || [meta.first_name, meta.last_name].filter(Boolean).join(' ') || null;
      const ig = meta.instagram_handle || meta.instagram || null;

      await supabase.from("profiles").upsert({
        id: authUser.id,
        email: authUser.email ?? "",
        full_name: fullName,
        instagram_handle: ig,
        role: "user",
      })

      const { data: newProfile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", authUser.id)
        .maybeSingle()

      setUser(newProfile ?? null)
    } else {
      let userProfile = profile as User;
      const actualRole = (userProfile.role || '').toUpperCase();
      if (actualRole === 'ADMIN' && typeof document !== 'undefined') {
        const match = document.cookie.match(/(?:^|; )passi_impersonate_role=([^;]*)/);
        if (match) {
          const override = match[1].toLowerCase();
          if (['admin', 'user', 'barman', 'security', 'payment_point'].includes(override)) {
            userProfile = {
              ...userProfile,
              role: override as any,
              original_role: (userProfile.original_role || userProfile.role || 'admin').toLowerCase(),
              instagram_handle: userProfile.instagram_handle || '@admin_simulated',
            };
          }
        }
      }
      setUser(userProfile)
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
    const role = (user?.role || '').toLowerCase()
    const isStaff = role === 'admin' || role === 'security' || role === 'barman' || role === 'payment_point'
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
