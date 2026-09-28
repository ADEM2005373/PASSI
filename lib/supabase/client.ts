import { createBrowserClient } from '@supabase/ssr'

// Singleton pattern — reuse the same client instance across the app.
// @supabase/ssr's createBrowserClient automatically uses cookies for session
// storage (instead of localStorage) which persists across page reloads,
// tab closures, and device restarts — keeping users logged in until an
// explicit signOut() call.
let client: ReturnType<typeof createBrowserClient> | undefined

export function createClient() {
  if (client) return client

  client = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  return client
}
