import { NextRequest, NextResponse } from "next/server";
import {
  checkLoginRateLimit,
  recordFailedLogin,
  resetLoginRateLimit,
} from "@/lib/security/rate-limiter";

function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  return req.headers.get("x-real-ip") || "127.0.0.1";
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { action = "check", email } = body || {};
    const ip = getClientIp(req);

    if (action === "check") {
      const status = await checkLoginRateLimit({ ip, email });
      if (!status.allowed) {
        return NextResponse.json(
          {
            allowed: false,
            error: "Trop de tentatives. Veuillez réessayer demain.",
            resetInSeconds: status.resetInSeconds,
          },
          { status: 429 }
        );
      }
      return NextResponse.json({
        allowed: true,
        remainingAttempts: status.remainingAttempts,
        totalAttempts: status.totalAttempts,
      });
    }

    if (action === "record_failure") {
      await recordFailedLogin({ ip, email });
      const status = await checkLoginRateLimit({ ip, email });
      if (!status.allowed) {
        return NextResponse.json(
          {
            allowed: false,
            error: "Trop de tentatives. Veuillez réessayer demain.",
            resetInSeconds: status.resetInSeconds,
          },
          { status: 429 }
        );
      }
      return NextResponse.json({
        allowed: true,
        remainingAttempts: status.remainingAttempts,
      });
    }

    if (action === "reset") {
      await resetLoginRateLimit({ ip, email });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Action non reconnue" }, { status: 400 });
  } catch (error: any) {
    console.error("[Rate-Limit API] Error:", error);
    // En cas d'erreur interne, ne pas bloquer les utilisateurs légitimes
    return NextResponse.json({ allowed: true });
  }
}
