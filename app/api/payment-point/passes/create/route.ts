import { NextRequest, NextResponse } from 'next/server';
import { createPOSPass } from '@/lib/actions/pos-pass';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result = await createPOSPass(body);
    return NextResponse.json(result, { status: 201 });
  } catch (error: any) {
    console.error('Error in /api/payment-point/passes/create:', error);
    const status = error.message?.includes('Droits insuffisants') ? 403
      : error.message?.includes('requis') || error.message?.includes('manquant') ? 400
      : error.message?.includes('introuvable') ? 404
      : 500;
    return NextResponse.json(
      { error: error.message || 'Une erreur est survenue lors de la création du pass en caisse.' },
      { status }
    );
  }
}
