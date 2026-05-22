import { NextRequest, NextResponse } from 'next/server';
import { registrarEscaneo } from '@/lib/stats';
import { leerHorarios } from '@/lib/storage';

export const runtime = 'nodejs';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ hash: string }> }
) {
  try {
    const { hash } = await params;

    // Resolver el nombre de la sala para el registro
    const data = await leerHorarios();
    const sala = data?.salas.find((s) => s.hash === hash);
    const nombre = sala?.nombre ?? hash;

    // Registrar de forma segura (cola async)
    await registrarEscaneo(hash, nombre);

    return NextResponse.json({ ok: true });
  } catch (error) {
    // El tracking es no-crítico: nunca bloquear al alumno con un error
    console.error('[track] Error registrando escaneo:', error);
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}
