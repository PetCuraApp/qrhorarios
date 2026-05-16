import { NextResponse } from 'next/server';
import { leerHorarios } from '@/lib/storage';

export const runtime = 'nodejs';

export async function GET() {
  const data = await leerHorarios();
  if (!data) {
    return NextResponse.json({ error: 'No hay horarios cargados aún' }, { status: 404 });
  }
  return NextResponse.json(data);
}
