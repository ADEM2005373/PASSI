import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export const dynamic = 'force-dynamic';

/**
 * GET /api/public/quick-passes/:secretToken/status
 * Lightweight, high-frequency polling endpoint (every 2-3s) to detect live gate entry
 * and bar drink consumption without requiring full browser reload.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ secretToken: string }> }
) {
  try {
    const { secretToken: rawToken } = await params;
    const secretToken = rawToken?.trim();

    if (!secretToken) {
      return NextResponse.json(
        { error: 'Jeton de pass manquant.' },
        { status: 400 }
      );
    }

    let { data: pass } = await supabaseAdmin
      .from('passes')
      .select('id, entry_status, drink_status, is_entry_used, entry_used_at, drink_token, is_drink_used, drink_used_at, status')
      .eq('secret_token', secretToken)
      .maybeSingle();

    if (!pass) {
      const { data: fallback } = await supabaseAdmin
        .from('passes')
        .select('id, entry_status, drink_status, is_entry_used, entry_used_at, drink_token, is_drink_used, drink_used_at, status')
        .or(`id.eq.${secretToken},reservation_code.eq.${secretToken}`)
        .maybeSingle();
      pass = fallback;
    }

    if (!pass) {
      return NextResponse.json(
        { error: 'Pass introuvable.' },
        { status: 404 }
      );
    }

    const isEntryUsed = Boolean(pass.is_entry_used || pass.entry_status === 'scanned');
    const isDrinkUsed = Boolean(pass.is_drink_used || pass.drink_status === 'scanned');

    return NextResponse.json({
      success: true,
      passId: pass.id,
      is_entry_used: isEntryUsed,
      entry_used_at: pass.entry_used_at,
      is_drink_used: isDrinkUsed,
      drink_used_at: pass.drink_used_at,
      status: pass.status,
      entry_status: pass.entry_status,
    });
  } catch (error: any) {
    console.error('Error fetching quick pass status:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la vérification de statut.' },
      { status: 500 }
    );
  }
}
