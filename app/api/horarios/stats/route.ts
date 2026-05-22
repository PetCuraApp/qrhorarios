import { NextResponse } from 'next/server';
import { leerStats } from '@/lib/stats';

export const runtime = 'nodejs';

// GET /api/horarios/stats — Protegido por middleware (requiere cookie admin)
export async function GET() {
  try {
    const stats = await leerStats();
    return NextResponse.json(stats);
  } catch (error) {
    console.error('[stats] Error leyendo estadísticas:', error);
    return NextResponse.json({ error: 'Error al leer estadísticas' }, { status: 500 });
  }
}
