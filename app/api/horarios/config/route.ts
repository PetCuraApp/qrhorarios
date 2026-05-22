import { NextRequest, NextResponse } from 'next/server';
import { actualizarConfig } from '@/lib/storage';
import { revalidatePath } from 'next/cache';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const { semanaActivaDefault, semanaInicioFecha } = await request.json();

    if (!semanaActivaDefault) {
      return NextResponse.json({ error: 'La semana activa predeterminada es requerida' }, { status: 400 });
    }

    const ok = await actualizarConfig(semanaActivaDefault, semanaInicioFecha);

    if (!ok) {
      return NextResponse.json({ error: 'No se pudieron actualizar los horarios o no hay datos cargados' }, { status: 404 });
    }

    // Invalidar caché para reflejar el cambio dinámico inmediatamente
    revalidatePath('/');
    revalidatePath('/sala/[hash]');

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    console.error('[config-semana] Error:', error);
    const message = error instanceof Error ? error.message : 'Error al guardar la configuración';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
