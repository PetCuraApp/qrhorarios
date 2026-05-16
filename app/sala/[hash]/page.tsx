import { leerHorarios } from '@/lib/storage';
import { notFound } from 'next/navigation';
import SalaClient from './SalaClient';
import type { Metadata } from 'next';

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
  const sala = data?.salas.find((s) => s.hash === hash);

  if (!sala) notFound();

  return (
    <SalaClient
      sala={sala}
      semana={data!.semana}
      generado={data!.generado}
    />
  );
}
