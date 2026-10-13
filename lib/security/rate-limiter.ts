import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export interface RateLimitStatus {
  allowed: boolean;
  remainingAttempts: number;
  totalAttempts: number;
  resetInSeconds: number;
  errorMessage?: string;
}

const MAX_ATTEMPTS = 10;
const WINDOW_MS = 24 * 60 * 60 * 1000; // 24 heures en millisecondes

// Cache mémoire serveur en tant que fallback immédiat ou cache local
interface MemoryRecord {
  count: number;
  firstAttemptAt: number;
  lastAttemptAt: number;
}
const memoryCache = new Map<string, MemoryRecord>();

function cleanMemoryCache() {
  const now = Date.now();
  for (const [key, record] of memoryCache.entries()) {
    if (now - record.firstAttemptAt > WINDOW_MS) {
      memoryCache.delete(key);
    }
  }
}

/**
 * Normalise un identifiant (email ou IP)
 */
function normalizeIdentifier(val: string): string {
  return (val || '').trim().toLowerCase();
}

/**
 * Vérifie l'état du rate-limit pour un identifiant (IP ou Email)
 */
async function checkSingleIdentifier(identifier: string, isIp: boolean): Promise<RateLimitStatus> {
  const now = Date.now();
  const cleanId = normalizeIdentifier(identifier);
  if (!cleanId) {
    return { allowed: true, remainingAttempts: MAX_ATTEMPTS, totalAttempts: 0, resetInSeconds: 0 };
  }

  // 1. Tenter la vérification via la base de données Supabase
  try {
    const { data, error } = await supabaseAdmin
      .from('login_attempts')
      .select('*')
      .eq('identifier', cleanId)
      .maybeSingle();

    if (!error && data) {
      const firstAttempt = new Date(data.first_attempt_at).getTime();
      const elapsed = now - firstAttempt;

      // Si la fenêtre de 24h est expirée, réinitialiser
      if (elapsed > WINDOW_MS) {
        await supabaseAdmin
          .from('login_attempts')
          .delete()
          .eq('identifier', cleanId);

        return {
          allowed: true,
          remainingAttempts: MAX_ATTEMPTS,
          totalAttempts: 0,
          resetInSeconds: 0,
        };
      }

      // Si encore dans la fenêtre de 24h
      const remaining = Math.max(0, MAX_ATTEMPTS - data.attempt_count);
      const resetInSeconds = Math.ceil((WINDOW_MS - elapsed) / 1000);

      if (data.attempt_count >= MAX_ATTEMPTS) {
        return {
          allowed: false,
          remainingAttempts: 0,
          totalAttempts: data.attempt_count,
          resetInSeconds,
          errorMessage: "Trop de tentatives. Veuillez réessayer demain.",
        };
      }

      return {
        allowed: true,
        remainingAttempts: remaining,
        totalAttempts: data.attempt_count,
        resetInSeconds,
      };
    }
  } catch (err) {
    // Si la table n'existe pas encore ou en cas d'erreur réseau, bascule silencieuse sur le cache mémoire
  }

  // 2. Fallback Cache Mémoire
  cleanMemoryCache();
  const cached = memoryCache.get(cleanId);
  if (!cached) {
    return { allowed: true, remainingAttempts: MAX_ATTEMPTS, totalAttempts: 0, resetInSeconds: 0 };
  }

  const elapsed = now - cached.firstAttemptAt;
  if (elapsed > WINDOW_MS) {
    memoryCache.delete(cleanId);
    return { allowed: true, remainingAttempts: MAX_ATTEMPTS, totalAttempts: 0, resetInSeconds: 0 };
  }

  const remaining = Math.max(0, MAX_ATTEMPTS - cached.count);
  const resetInSeconds = Math.ceil((WINDOW_MS - elapsed) / 1000);

  if (cached.count >= MAX_ATTEMPTS) {
    return {
      allowed: false,
      remainingAttempts: 0,
      totalAttempts: cached.count,
      resetInSeconds,
      errorMessage: "Trop de tentatives. Veuillez réessayer demain.",
    };
  }

  return {
    allowed: true,
    remainingAttempts: remaining,
    totalAttempts: cached.count,
    resetInSeconds,
  };
}

/**
 * Enregistre un échec de tentative de connexion
 */
async function recordFailureForIdentifier(identifier: string, ip: string, email?: string) {
  const now = Date.now();
  const cleanId = normalizeIdentifier(identifier);
  if (!cleanId) return;

  // Mise à jour cache mémoire
  cleanMemoryCache();
  const cached = memoryCache.get(cleanId);
  if (!cached || now - cached.firstAttemptAt > WINDOW_MS) {
    memoryCache.set(cleanId, {
      count: 1,
      firstAttemptAt: now,
      lastAttemptAt: now,
    });
  } else {
    cached.count += 1;
    cached.lastAttemptAt = now;
  }

  // Mise à jour Supabase
  try {
    const { data: existing } = await supabaseAdmin
      .from('login_attempts')
      .select('*')
      .eq('identifier', cleanId)
      .maybeSingle();

    if (!existing) {
      await supabaseAdmin.from('login_attempts').insert({
        identifier: cleanId,
        ip_address: ip,
        email: email ? normalizeIdentifier(email) : null,
        attempt_count: 1,
        first_attempt_at: new Date(now).toISOString(),
        last_attempt_at: new Date(now).toISOString(),
      });
    } else {
      const firstAttempt = new Date(existing.first_attempt_at).getTime();
      if (now - firstAttempt > WINDOW_MS) {
        // Fenêtre expirée, recommencer à 1
        await supabaseAdmin
          .from('login_attempts')
          .update({
            attempt_count: 1,
            first_attempt_at: new Date(now).toISOString(),
            last_attempt_at: new Date(now).toISOString(),
            ip_address: ip,
            email: email ? normalizeIdentifier(email) : existing.email,
          })
          .eq('identifier', cleanId);
      } else {
        // Incrémenter
        await supabaseAdmin
          .from('login_attempts')
          .update({
            attempt_count: existing.attempt_count + 1,
            last_attempt_at: new Date(now).toISOString(),
            ip_address: ip,
            email: email ? normalizeIdentifier(email) : existing.email,
          })
          .eq('identifier', cleanId);
      }
    }
  } catch (err) {
    // Échec DB non bloquant
  }
}

/**
 * Réinitialise les tentatives après une connexion réussie
 */
async function resetIdentifier(identifier: string) {
  const cleanId = normalizeIdentifier(identifier);
  if (!cleanId) return;

  memoryCache.delete(cleanId);

  try {
    await supabaseAdmin
      .from('login_attempts')
      .delete()
      .eq('identifier', cleanId);
  } catch (err) {
    // Non bloquant
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTED PUBLIC API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Vérifie si la requête de connexion est autorisée (IP et Email)
 */
export async function checkLoginRateLimit({
  ip,
  email,
}: {
  ip: string;
  email?: string;
}): Promise<RateLimitStatus> {
  // 1. Vérification par IP
  const ipStatus = await checkSingleIdentifier(ip, true);
  if (!ipStatus.allowed) {
    return ipStatus;
  }

  // 2. Vérification par Email (si renseigné)
  if (email && email.trim()) {
    const emailStatus = await checkSingleIdentifier(email, false);
    if (!emailStatus.allowed) {
      return emailStatus;
    }
    // Renvoyer le plus restrictif des deux
    return {
      allowed: true,
      remainingAttempts: Math.min(ipStatus.remainingAttempts, emailStatus.remainingAttempts),
      totalAttempts: Math.max(ipStatus.totalAttempts, emailStatus.totalAttempts),
      resetInSeconds: Math.max(ipStatus.resetInSeconds, emailStatus.resetInSeconds),
    };
  }

  return ipStatus;
}

/**
 * Enregistre un échec de connexion (incrémente pour l'IP et pour l'email)
 */
export async function recordFailedLogin({
  ip,
  email,
}: {
  ip: string;
  email?: string;
}): Promise<void> {
  await recordFailureForIdentifier(ip, ip, email);
  if (email && email.trim()) {
    await recordFailureForIdentifier(email, ip, email);
  }
}

/**
 * Réinitialise le compteur après une connexion réussie
 */
export async function resetLoginRateLimit({
  ip,
  email,
}: {
  ip: string;
  email?: string;
}): Promise<void> {
  await resetIdentifier(ip);
  if (email && email.trim()) {
    await resetIdentifier(email);
  }
}
