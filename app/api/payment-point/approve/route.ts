import { NextRequest, NextResponse } from 'next/server';
import { approvePassPaymentAction } from '@/lib/actions/pass-lifecycle';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { passId } = body || {};

    if (!passId || typeof passId !== 'string') {
      return NextResponse.json({ error: 'Identifiant de pass manquant ou invalide' }, { status: 400 });
    }

    const result = await approvePassPaymentAction(passId);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Server error in payment-point approve:', error);
    const status = error.message?.includes('non autorisée') || error.message?.includes('non authentifié')
      ? 403 
      : error.message?.includes('introuvable')
      ? 404
      : 500;
    return NextResponse.json({ error: error.message || 'Une erreur interne est survenue' }, { status });
  }
}

