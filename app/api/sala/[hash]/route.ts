import { NextRequest, NextResponse } from 'next/server';
import { leerHorarios } from '@/lib/storage';

export const runtime = 'nodejs';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ hash: string }> }
) {
  const { hash } = await params;
  const data = await leerHorarios();

  if (!data) {
    return NextResponse.json({ error: 'No hay horarios cargados' }, { status: 404 });
  }

  const sala = data.salas.find((s) => s.hash === hash);
  if (!sala) {
    return NextResponse.json({ error: 'Sala no encontrada' }, { status: 404 });
  }

  return NextResponse.json({
    sala,
    semana: data.semana,
    generado: data.generado,
  });
}
