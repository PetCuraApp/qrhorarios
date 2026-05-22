/**
 * Storage abstraction usando Vercel Blob o archivos locales en desarrollo.
 */

import type { HorariosData } from './parser';
import fs from 'fs';
import path from 'path';

const DATA_BLOB_PATH = 'horarios-data.json';
const LOCAL_STORAGE_PATH = path.join(process.cwd(), 'data', 'horarios.json');

async function usarVercelBlob(): Promise<boolean> {
  // Siempre intentar usar Blob en producción (Vercel)
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN) || process.env.VERCEL === '1';
}

/** Guarda el JSON de horarios procesados */
export async function guardarHorarios(data: HorariosData): Promise<void> {
  const isVercel = process.env.VERCEL === '1';
  const hasToken = Boolean(process.env.BLOB_READ_WRITE_TOKEN);

  if (isVercel || hasToken) {
    if (!hasToken) {
      throw new Error('Falta configuración de Vercel Blob. Por favor, añade el Storage "Blob" en tu dashboard de Vercel y conecta el proyecto.');
    }
    const { put } = await import('@vercel/blob');
    const json = JSON.stringify(data);
    await put(DATA_BLOB_PATH, json, {
      access: 'public',
      contentType: 'application/json',
      addRandomSuffix: false,
      allowOverwrite: true, // Enable overwriting an existing blob with the same pathname
    });
  } else {
    // Fallback local: solo en desarrollo real
    const dir = path.dirname(LOCAL_STORAGE_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(LOCAL_STORAGE_PATH, JSON.stringify(data, null, 2));
  }
}

/** Lee el JSON de horarios procesados */
export async function leerHorarios(): Promise<HorariosData | null> {
  const hasToken = Boolean(process.env.BLOB_READ_WRITE_TOKEN);

  if (hasToken) {
    try {
      const { list } = await import('@vercel/blob');
      const { blobs } = await list({ prefix: DATA_BLOB_PATH });
      if (blobs.length === 0) return null;

      // Usar revalidate: 0 para evitar cacheo de datos antiguos
      const res = await fetch(blobs[0].url, { next: { revalidate: 0 } });
      if (!res.ok) return null;
      return (await res.json()) as HorariosData;
    } catch (e) {
      console.error('Error leyendo de Blob:', e);
      return null;
    }
  } else {
    // Lectura local
    if (fs.existsSync(LOCAL_STORAGE_PATH)) {
      try {
        const content = fs.readFileSync(LOCAL_STORAGE_PATH, 'utf-8');
        return JSON.parse(content) as HorariosData;
      } catch (e) {
        console.error('Error parseando storage local:', e);
        return null;
      }
    }
    return null;
  }
}

/** Guarda el Excel original (solo en Blob para producción) */
export async function guardarExcel(buffer: Buffer, filename: string): Promise<string | null> {
  const hasToken = Boolean(process.env.BLOB_READ_WRITE_TOKEN);

  if (hasToken) {
    const { put } = await import('@vercel/blob');
    const result = await put(`excel/${filename}`, buffer, {
      access: 'public',
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      addRandomSuffix: false,
    });
    return result.url;
  }
  return null;
}

/** Actualiza los metadatos de configuración sin alterar los horarios */
export async function actualizarConfig(semanaActivaDefault: string, semanaInicioFecha?: string): Promise<boolean> {
  const data = await leerHorarios();
  if (!data) return false;

  data.semanaActivaDefault = semanaActivaDefault;
  // Soporte de compatibilidad
  (data as any).semana = semanaActivaDefault;
  
  if (semanaInicioFecha !== undefined) {
    data.semanaInicioFecha = semanaInicioFecha || undefined;
  }
  
  // Actualizar el fallback 'horario' de cada sala para que apunte a la semana activa por defecto elegida
  for (const sala of data.salas) {
    if (sala.horariosPorSemana && sala.horariosPorSemana[semanaActivaDefault]) {
      sala.horario = sala.horariosPorSemana[semanaActivaDefault];
    }
  }

  await guardarHorarios(data);
  return true;
}

