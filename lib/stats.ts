/**
 * Stats — Tracking de escaneos de QR por sala.
 * Almacena datos en data/stats.json (local) o en Vercel Blob (producción).
 */

import fs from 'fs';
import path from 'path';

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface ConteoFechas {
  [fecha: string]: number; // ej: "2026-05-21": 45
}

export interface SalaStatsEntry {
  nombre: string;
  hash: string;
  total: number;
  diario: ConteoFechas;   // clave: "YYYY-MM-DD"
  mensual: ConteoFechas;  // clave: "YYYY-MM"
}

export interface StatsData {
  global: {
    total: number;
    diario: ConteoFechas;
    mensual: ConteoFechas;
  };
  salas: Record<string, SalaStatsEntry>;
}

// ─── Rutas ────────────────────────────────────────────────────────────────────

const STATS_BLOB_PATH = 'stats-data.json';
const LOCAL_STATS_PATH = path.join(process.cwd(), 'data', 'stats.json');

// ─── Mutex simple (cola en memoria) ──────────────────────────────────────────
// Evita corrupción del JSON si múltiples alumnos escanean QRs simultáneamente.

let writeQueue: Promise<void> = Promise.resolve();

function enqueue(fn: () => Promise<void>): Promise<void> {
  writeQueue = writeQueue.then(fn).catch((err) => {
    console.error('[stats] Error en cola de escritura:', err);
  });
  return writeQueue;
}

// ─── Fechas ───────────────────────────────────────────────────────────────────

export function getFechaHoy(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getMesActual(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

// ─── Lectura ─────────────────────────────────────────────────────────────────

export async function leerStats(): Promise<StatsData> {
  const empty: StatsData = { global: { total: 0, diario: {}, mensual: {} }, salas: {} };

  const hasToken = Boolean(process.env.BLOB_READ_WRITE_TOKEN);

  if (hasToken) {
    try {
      const { list } = await import('@vercel/blob');
      const { blobs } = await list({ prefix: STATS_BLOB_PATH });
      if (blobs.length === 0) return empty;
      const res = await fetch(blobs[0].url, { cache: 'no-store' });
      if (!res.ok) return empty;
      return (await res.json()) as StatsData;
    } catch {
      return empty;
    }
  } else {
    if (!fs.existsSync(LOCAL_STATS_PATH)) return empty;
    try {
      return JSON.parse(fs.readFileSync(LOCAL_STATS_PATH, 'utf-8')) as StatsData;
    } catch {
      return empty;
    }
  }
}

// ─── Escritura ────────────────────────────────────────────────────────────────

async function escribirStats(data: StatsData): Promise<void> {
  const hasToken = Boolean(process.env.BLOB_READ_WRITE_TOKEN);
  const json = JSON.stringify(data);

  if (hasToken) {
    const { put } = await import('@vercel/blob');
    await put(STATS_BLOB_PATH, json, {
      access: 'public',
      contentType: 'application/json',
      addRandomSuffix: false,
      allowOverwrite: true, // Enable overwriting an existing blob with the same pathname
    });
  } else {
    const dir = path.dirname(LOCAL_STATS_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(LOCAL_STATS_PATH, json, 'utf-8');
  }
}

// ─── Registro de Escaneo ──────────────────────────────────────────────────────

export function registrarEscaneo(hash: string, nombre: string): Promise<void> {
  return enqueue(async () => {
    const data = await leerStats();
    const hoy = getFechaHoy();
    const mes = getMesActual();

    // Actualizar global
    data.global.total = (data.global.total || 0) + 1;
    data.global.diario[hoy] = (data.global.diario[hoy] || 0) + 1;
    data.global.mensual[mes] = (data.global.mensual[mes] || 0) + 1;

    // Actualizar sala individual
    if (!data.salas[hash]) {
      data.salas[hash] = { nombre, hash, total: 0, diario: {}, mensual: {} };
    }
    const sala = data.salas[hash];
    sala.nombre = nombre; // actualizar nombre en caso de cambio
    sala.total = (sala.total || 0) + 1;
    sala.diario[hoy] = (sala.diario[hoy] || 0) + 1;
    sala.mensual[mes] = (sala.mensual[mes] || 0) + 1;

    await escribirStats(data);
  });
}
