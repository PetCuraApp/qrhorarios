import { NextRequest, NextResponse } from 'next/server';
import QRCode from 'qrcode';
import { urlSala } from '@/lib/hash';
import { leerHorarios } from '@/lib/storage';

export const runtime = 'nodejs';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ hash: string }> }
) {
  const { hash } = await params;

  // Verificar que la sala existe
  const data = await leerHorarios();
  const sala = data?.salas.find((s) => s.hash === hash);

  if (!sala) {
    return NextResponse.json({ error: 'Sala no encontrada' }, { status: 404 });
  }

  const url = urlSala(hash);

  // Generar QR como data URL y convertir a buffer
  const dataUrl = await QRCode.toDataURL(url, {
    width: 400,
    margin: 2,
    color: {
      dark: '#0f172a',
      light: '#ffffff',
    },
    errorCorrectionLevel: 'M',
  });

  // Convertir data URL base64 a ArrayBuffer
  const base64 = dataUrl.replace(/^data:image\/png;base64,/, '');
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  return new Response(bytes.buffer as ArrayBuffer, {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=86400',
    },
  });
}
