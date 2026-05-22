import { NextRequest, NextResponse } from 'next/server';
import { leerHorarios } from '@/lib/storage';
import { calcularSemanaActual } from '@/lib/bloques';

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

  // Calcular la semana activa de forma dinámica
  const semanaActiva = calcularSemanaActual(
    data.semanaInicioFecha,
    data.semanasDisponibles || [],
    data.semanaActivaDefault
  );

  // Mapear la sala para usar el horario correspondiente a la semana activa calculada
  const horarioSemana = sala.horariosPorSemana?.[semanaActiva];
  const salaMapeada = {
    ...sala,
    horario: horarioSemana || sala.horario,
  };

  return NextResponse.json({
    sala: salaMapeada,
    semana: semanaActiva,
    generado: data.generado,
  });
}

