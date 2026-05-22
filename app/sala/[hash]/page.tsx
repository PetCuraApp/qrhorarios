import { leerHorarios } from '@/lib/storage';
import { notFound } from 'next/navigation';
import SalaClient from './SalaClient';
import type { Metadata } from 'next';
import { calcularSemanaActual } from '@/lib/bloques';

interface Props {
  params: Promise<{ hash: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { hash } = await params;
  const data = await leerHorarios();
  const sala = data?.salas.find((s) => s.hash === hash);
  return {
    title: sala ? `Horario — ${sala.nombre}` : 'Sala no encontrada',
  };
}

export default async function SalaPage({ params }: Props) {
  const { hash } = await params;
  const data = await leerHorarios();

  if (!data) notFound();

  const sala = data.salas.find((s) => s.hash === hash);
  if (!sala) notFound();

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

  return (
    <SalaClient
      sala={salaMapeada}
      semana={semanaActiva}
      generado={data.generado}
    />
  );
}

