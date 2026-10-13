"use server";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getURL } from "@/lib/utils/url";

export async function resetPassword(email: string, origin: string) {
  const cookieStore = await cookies();
  
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        },
      },
    }
  );

  const baseUrl = origin || getURL();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${getURL()}/auth/callback?next=/update-password`,
  });

  if (error) {
    return { error: error.message };
  }

  return { success: true };
}
